import { useCallback, useEffect, useState } from 'react';
import {
  Box, Alert, Skeleton, TextField, Button, Paper, Typography, Grid, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText, Link,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Tabs, Tab,
} from '@mui/material';
import { PictureAsPdf, Lock } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { brandColors } from '../../theme';
import { todayISO, formatDateDDMMYYYY } from '../../utils/date';

const formatAed = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface VatBox { amount: number; vatAmount?: number; }

interface VatLineItem {
  documentNumber: string;
  date: string;
  partyName: string;
  partyTrn?: string | null;
  description: string;
  taxableAmount: number;
  vatAmount: number;
  total: number;
  source: string;
}

interface VatReturn {
  box1_standardRatedSupplies: VatBox;
  box2_zeroRatedSupplies: { amount: number };
  box3_exemptSupplies: { amount: number };
  box4_goodsImports: VatBox;
  box5_totalTaxDue: number;
  box9_standardRatedExpenses: VatBox;
  box10_totalDeductibleTax: number;
  box11_netVatDue: number;
  taxablePeriod: { from: string; to: string };
  supportingData: {
    invoiceCount: number;
    purchaseCount: number;
    expenseCount?: number;
    creditNoteCount?: number;
    debitNoteCount?: number;
  };
  schedules?: {
    sales: VatLineItem[];
    purchases: VatLineItem[];
    expenses: VatLineItem[];
  };
  journalReconciliation?: {
    outputVatFromJournals: number;
    inputVatFromJournals: number;
    outputMatches: boolean;
    inputMatches: boolean;
  };
  excludedInvoices?: {
    totalExcluded: number;
    salesCount: number;
    purchaseCount: number;
    sales: Array<{ documentNumber: string; date: string; partyName: string; total: number }>;
    purchases: Array<{ documentNumber: string; date: string; partyName: string; total: number }>;
  };
  hasUnlockedPeriod: boolean;
  filing?: {
    id: string;
    status: string;
    filingDate: string | null;
    filedBy?: string | null;
    notes?: string | null;
  } | null;
}

function quarterStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(Math.floor(d.getMonth() / 3) * 3 + 1).padStart(2, '0')}-01`;
}

function VatBoxRow({ box, label, showVat = true }: { box: VatBox; label: string; showVat?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2">{label}</Typography>
      <Box sx={{ textAlign: 'right' }}>
        <Typography variant="body2">Amount: {formatAed(box.amount)}</Typography>
        {showVat && box.vatAmount !== undefined && (
          <Typography variant="body2" color="text.secondary">VAT: {formatAed(box.vatAmount)}</Typography>
        )}
      </Box>
    </Box>
  );
}

function ScheduleTable({ rows }: { rows: VatLineItem[] }) {
  if (!rows.length) {
    return <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>No entries</Typography>;
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Invoice No</TableCell>
            <TableCell>Party Name</TableCell>
            <TableCell>TRN</TableCell>
            <TableCell>Description</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell align="right">VAT</TableCell>
            <TableCell align="right">Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.source}-${r.documentNumber}-${r.date}`}>
              <TableCell>{formatDateDDMMYYYY(r.date)}</TableCell>
              <TableCell>{r.documentNumber}</TableCell>
              <TableCell>{r.partyName}</TableCell>
              <TableCell>{r.partyTrn || '—'}</TableCell>
              <TableCell>{r.description}</TableCell>
              <TableCell align="right">{formatAed(r.taxableAmount)}</TableCell>
              <TableCell align="right">{formatAed(r.vatAmount)}</TableCell>
              <TableCell align="right">{formatAed(r.total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function VatReturnPage() {
  const [periodFrom, setPeriodFrom] = useState(quarterStartIso());
  const [periodTo, setPeriodTo] = useState(todayISO());
  const [data, setData] = useState<VatReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [excludedOpen, setExcludedOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [filingDate, setFilingDate] = useState(todayISO());
  const [filingNotes, setFilingNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [tab, setTab] = useState(0);

  const fetchReturn = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: VatReturn }>('/accounts/vat-return', { params: { periodFrom, periodTo } });
      setData(res.data.data);
    } catch {
      setError('Failed to load VAT return');
    } finally {
      setLoading(false);
    }
  }, [periodFrom, periodTo]);

  useEffect(() => { fetchReturn(); }, [fetchReturn]);

  const handlePdf = async () => {
    setPdfBusy(true);
    setError('');
    try {
      const res = await api.get('/accounts/vat-return/pdf', {
        params: { periodFrom, periodTo },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `VAT_Return_${periodFrom}_${periodTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download VAT return PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleRepair = async () => {
    setSaving(true);
    try {
      const res = await api.post<{
        created: number;
        errors: string[];
        message?: string;
        paymentFunds?: { fixed: number; details: string[] };
      }>('/accounts/repair-invoice-journals');
      setSuccess(
        res.data.message
          || `Repaired ${res.data.created} invoice journal(s)`
            + (res.data.paymentFunds ? `; fixed ${res.data.paymentFunds.fixed} cash/bank payment(s)` : ''),
      );
      if (res.data.errors?.length) setError(res.data.errors.join('; '));
      await fetchReturn();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Repair failed');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/accounts/vat-return/finalize', {
        periodFrom,
        periodTo,
        filingDate,
        notes: filingNotes || undefined,
      });
      setFinalizeOpen(false);
      setSuccess('VAT return finalized with filing date captured.');
      await fetchReturn();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Finalize failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader title="VAT Return (Form 201)" subtitle="UAE FTA-style return with invoice schedules for tax consultant / filing" />

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" label="Period From" type="date" value={periodFrom}
          onChange={(e) => setPeriodFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" label="Period To" type="date" value={periodTo}
          onChange={(e) => setPeriodTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button variant="outlined" onClick={fetchReturn}>Refresh</Button>
        <Button variant="contained" startIcon={<PictureAsPdf />} disabled={pdfBusy} onClick={handlePdf}>
          {pdfBusy ? 'Preparing…' : 'Download PDF'}
        </Button>
        <Button variant="outlined" color="secondary" startIcon={<Lock />}
          disabled={data?.filing?.status === 'FINALIZED'}
          onClick={() => setFinalizeOpen(true)}>
          Finalize Return
        </Button>
        <Button variant="text" disabled={saving} onClick={handleRepair}>
          Repair VAT &amp; cash/bank journals
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Alert severity="info" sx={{ mb: 2 }}>
        Includes confirmed and paid VAT sales/purchase invoices, credit/debit notes, and VAT-able expenses.
        PDF includes company header/logo and detailed schedules for authority or tax consultant use.
      </Alert>

      {data?.filing?.status === 'FINALIZED' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          This period is finalized
          {data.filing.filingDate ? ` — filing date ${formatDateDDMMYYYY(data.filing.filingDate)}` : ''}
          {data.filing.filedBy ? ` · ${data.filing.filedBy}` : ''}.
        </Alert>
      )}

      {data?.excludedInvoices && data.excludedInvoices.totalExcluded > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {data.excludedInvoices.totalExcluded} invoice(s) excluded (non-VAT / out of scope).{' '}
          <Link component="button" variant="body2" onClick={() => setExcludedOpen(true)}>View list</Link>
        </Alert>
      )}

      {data?.hasUnlockedPeriod && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Open accounting periods overlap this range — figures may still change until periods are closed.
        </Alert>
      )}

      {data?.journalReconciliation && (!data.journalReconciliation.outputMatches || !data.journalReconciliation.inputMatches) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Document totals and GL VAT accounts differ slightly. Use “Repair missing VAT journals” if Input/Output VAT ledgers look empty.
          (GL Output {formatAed(data.journalReconciliation.outputVatFromJournals)} · Input {formatAed(data.journalReconciliation.inputVatFromJournals)})
        </Alert>
      )}

      {loading ? (
        <Skeleton variant="rounded" height={500} />
      ) : data && (
        <Paper sx={{ p: 3, maxWidth: 1100 }}>
          <Typography variant="h6" gutterBottom sx={{ color: brandColors.darkGreen }}>
            VAT Return — Taxable Period
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {formatDateDDMMYYYY(data.taxablePeriod.from)} to {formatDateDDMMYYYY(data.taxablePeriod.to)}
          </Typography>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Form 201 Summary" />
            <Tab label={`Sales (${data.schedules?.sales.length ?? 0})`} />
            <Tab label={`Purchases (${data.schedules?.purchases.length ?? 0})`} />
            <Tab label={`Expenses (${data.schedules?.expenses.length ?? 0})`} />
          </Tabs>

          {tab === 0 && (
            <>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Output Tax (Sales)</Typography>
              <VatBoxRow box={data.box1_standardRatedSupplies} label="Box 1 — Standard rated supplies (5%)" />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2">Box 2 — Zero rated supplies</Typography>
                <Typography variant="body2">{formatAed(data.box2_zeroRatedSupplies.amount)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2">Box 3 — Exempt supplies</Typography>
                <Typography variant="body2">{formatAed(data.box3_exemptSupplies.amount)}</Typography>
              </Box>
              <VatBoxRow box={data.box4_goodsImports} label="Box 4 — Goods imported into UAE" />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 2, bgcolor: brandColors.lightGreen, px: 2, borderRadius: 1, my: 2 }}>
                <Typography fontWeight={700}>Box 5 — Total tax due</Typography>
                <Typography fontWeight={700}>{formatAed(data.box5_totalTaxDue)}</Typography>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Input Tax (Purchases & Expenses)</Typography>
              <VatBoxRow box={data.box9_standardRatedExpenses} label="Box 9 — Standard rated expenses (5%)" />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 2, bgcolor: 'grey.100', px: 2, borderRadius: 1, my: 2 }}>
                <Typography fontWeight={700}>Box 10 — Total deductible tax</Typography>
                <Typography fontWeight={700}>{formatAed(data.box10_totalDeductibleTax)}</Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 2, bgcolor: brandColors.darkGreen, color: 'white', px: 2, borderRadius: 1 }}>
                <Typography fontWeight={700}>Box 11 — Net VAT due (Box 5 − Box 10)</Typography>
                <Typography fontWeight={700}>{formatAed(data.box11_netVatDue)}</Typography>
              </Box>

              <Grid container spacing={2} sx={{ mt: 3 }}>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">Sales invoices</Typography>
                  <Typography>{data.supportingData.invoiceCount}</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">Purchase invoices</Typography>
                  <Typography>{data.supportingData.purchaseCount}</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">VAT expenses</Typography>
                  <Typography>{data.supportingData.expenseCount ?? 0}</Typography>
                </Grid>
              </Grid>
            </>
          )}

          {tab === 1 && <ScheduleTable rows={data.schedules?.sales || []} />}
          {tab === 2 && <ScheduleTable rows={data.schedules?.purchases || []} />}
          {tab === 3 && <ScheduleTable rows={data.schedules?.expenses || []} />}
        </Paper>
      )}

      <Dialog open={excludedOpen} onClose={() => setExcludedOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Excluded Invoices (Out of VAT Scope)</DialogTitle>
        <DialogContent>
          {data?.excludedInvoices?.sales.length ? (
            <>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>Sales</Typography>
              <List dense>
                {data.excludedInvoices.sales.map((inv) => (
                  <ListItem key={inv.documentNumber}>
                    <ListItemText
                      primary={inv.documentNumber}
                      secondary={`${inv.partyName} · ${formatDateDDMMYYYY(inv.date)} · ${formatAed(inv.total)}`}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          ) : null}
          {data?.excludedInvoices?.purchases.length ? (
            <>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>Purchases</Typography>
              <List dense>
                {data.excludedInvoices.purchases.map((inv) => (
                  <ListItem key={inv.documentNumber}>
                    <ListItemText
                      primary={inv.documentNumber}
                      secondary={`${inv.partyName} · ${formatDateDDMMYYYY(inv.date)} · ${formatAed(inv.total)}`}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={finalizeOpen} onClose={() => setFinalizeOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Finalize VAT Return</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Lock this period&apos;s return snapshot and capture the FTA filing date for your records / tax consultant.
          </Typography>
          <TextField fullWidth label="Filing Date" type="date" value={filingDate} sx={{ mb: 2 }}
            onChange={(e) => setFilingDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField fullWidth label="Notes (optional)" multiline minRows={2} value={filingNotes}
            onChange={(e) => setFilingNotes(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinalizeOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={saving} onClick={handleFinalize}>
            {saving ? 'Saving…' : 'Finalize'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
