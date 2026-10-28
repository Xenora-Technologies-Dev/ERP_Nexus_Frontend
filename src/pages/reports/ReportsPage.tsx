import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Tabs, Tab, Grid, TextField, MenuItem, Button, Autocomplete,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Typography, Alert,
  CircularProgress, Chip, FormControlLabel, Checkbox, Stack,
} from '@mui/material';
import { FileDownload, Search } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { brandColors } from '../../theme';
import { formatDateDDMMYYYY, todayISO } from '../../utils/date';

type ReportKey = 'customer-statement' | 'customer-payments' | 'sales';
const TABS: { key: ReportKey; label: string; subtitle: string }[] = [
  { key: 'customer-statement', label: 'Customer Statement', subtitle: 'Statement of account with opening, running and closing balance' },
  { key: 'customer-payments', label: 'Customer Payments', subtitle: 'Receipts collected from customers, by method and customer' },
  { key: 'sales', label: 'Sales Report', subtitle: 'Sales invoices with VAT, collections and balance; by customer and product' },
];
const PAYMENT_METHODS = ['CASH', 'CHEQUE', 'BANK_TRANSFER'];
const INVOICE_STATUSES = ['CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'DRAFT', 'CANCELLED'];

interface Opt { id: string; code?: string; sku?: string; name: string }

function asOptions(body: unknown): Opt[] {
  const list = Array.isArray(body)
    ? body
    : (body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)
      ? (body as { data: unknown[] }).data
      : []);
  return list.filter((o): o is Opt => !!o && typeof o === 'object' && typeof (o as Opt).id === 'string');
}

function optionLabel(o?: { name?: string; code?: string; sku?: string } | null, extra?: 'code' | 'sku') {
  if (!o) return '';
  const suffix = extra === 'sku' ? o.sku : o.code;
  return `${o.name ?? ''}${suffix ? ` (${suffix})` : ''}`;
}

const money = (n?: number | null) =>
  n === null || n === undefined ? '' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const firstOfMonth = () => `${todayISO().slice(0, 8)}01`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function SimpleTable({ columns, rows, totals, lead, maxHeight = 520 }: {
  columns: { key: string; label: string; money?: boolean; date?: boolean }[];
  rows: any[]; totals?: any[]; lead?: any[]; maxHeight?: number;
}) {
  const render = (c: { key: string; money?: boolean; date?: boolean }, r: any) => {
    const v = r[c.key];
    if (v === undefined || v === null || v === '') return '';
    if (c.money) return money(v);
    if (c.date) return formatDateDDMMYYYY(v);
    return String(v);
  };
  return (
    <TableContainer sx={{ maxHeight, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((c) => (
              <TableCell key={c.key} align={c.money ? 'right' : 'left'}
                sx={{ bgcolor: brandColors.darkGreen, color: 'white', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {(lead ?? []).map((r, i) => (
            <TableRow key={`l${i}`}>{columns.map((c) => <TableCell key={c.key} align={c.money ? 'right' : 'left'} sx={{ fontStyle: 'italic' }}>{render(c, r)}</TableCell>)}</TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={columns.length} align="center" sx={{ color: 'text.secondary', py: 3 }}>No records for the selected filters</TableCell></TableRow>
          )}
          {rows.map((r, i) => (
            <TableRow key={r.id ?? i} hover sx={r.status === 'CANCELLED' ? { opacity: 0.5 } : undefined}>
              {columns.map((c) => <TableCell key={c.key} align={c.money ? 'right' : 'left'} sx={{ whiteSpace: c.money || c.date ? 'nowrap' : undefined }}>{render(c, r)}</TableCell>)}
            </TableRow>
          ))}
          {(totals ?? []).map((r, i) => (
            <TableRow key={`t${i}`} sx={{ bgcolor: brandColors.lightGreen }}>
              {columns.map((c) => <TableCell key={c.key} align={c.money ? 'right' : 'left'} sx={{ fontWeight: 700 }}>{render(c, r)}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 160 }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" fontWeight={700}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const { report } = useParams();
  const navigate = useNavigate();
  const tab: ReportKey = (TABS.find((t) => t.key === report)?.key) ?? 'customer-statement';

  const [customers, setCustomers] = useState<Opt[]>([]);
  const [products, setProducts] = useState<Opt[]>([]);
  const [accounts, setAccounts] = useState<Opt[]>([]);
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayISO());
  const [customer, setCustomer] = useState<Opt | null>(null);
  const [product, setProduct] = useState<Opt | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [salesView, setSalesView] = useState<'invoices' | 'customers' | 'products'>('invoices');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const tabRef = useRef(tab);
  tabRef.current = tab;
  // Drop the previous report before paint. Clearing in an effect is too late:
  // the new tab would render the old payload and crash on a missing field.
  const [dataTab, setDataTab] = useState(tab);
  if (dataTab !== tab) {
    setDataTab(tab);
    setData(null);
    setError('');
    setLoading(false);
    setExporting(false);
  }

  useEffect(() => {
    api.get('/customers', { params: { active: true } }).then((r) => setCustomers(asOptions(r.data))).catch(() => {});
    api.get('/inventory/products').then((r) => setProducts(asOptions(r.data))).catch(() => {});
    api.get('/accounts/fund-accounts').then((r) => setAccounts(asOptions(r.data))).catch(() => {});
  }, []);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (from) p.from = from;
    if (to) p.to = to;
    if (customer) p.customerId = customer.id;
    if (tab === 'customer-payments') {
      if (paymentMethod) p.paymentMethod = paymentMethod;
      if (paymentAccountId) p.paymentAccountId = paymentAccountId;
      if (includeCancelled) p.includeCancelled = 'true';
    }
    if (tab === 'sales') {
      if (statuses.length) p.status = statuses.join(',');
      if (product) p.productId = product.id;
    }
    return p;
  }, [tab, from, to, customer, paymentMethod, paymentAccountId, includeCancelled, statuses, product]);

  const needsCustomer = tab === 'customer-statement' && !customer;

  const run = async () => {
    if (needsCustomer) { setError('Select a customer to generate the statement'); return; }
    const requested = tab;
    setLoading(true); setError('');
    try {
      const res = await api.get(`/reports/${requested}`, { params });
      if (tabRef.current !== requested) return;
      const payload = res.data;
      const mismatch = requested === 'customer-statement'
        ? !payload?.customer || !Array.isArray(payload?.lines)
        : requested === 'customer-payments'
          ? !Array.isArray(payload?.rows) || !Array.isArray(payload?.byMethod)
          : !Array.isArray(payload?.rows) || !Array.isArray(payload?.byProduct);
      if (!payload || typeof payload !== 'object' || mismatch) {
        setError('The report response was incomplete. Try again.');
        setData(null);
        return;
      }
      setData(payload);
    } catch (e: any) {
      if (tabRef.current !== requested) return;
      setError(e?.response?.data?.error || 'Failed to load report');
      setData(null);
    } finally { if (tabRef.current === requested) setLoading(false); }
  };

  const exportXlsx = async () => {
    if (needsCustomer) { setError('Select a customer to export the statement'); return; }
    setExporting(true); setError('');
    try {
      const res = await api.get(`/reports/${tab}`, { params: { ...params, format: 'xlsx' }, responseType: 'blob' });
      const cd = String(res.headers['content-disposition'] || '');
      const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || `${tab}_${todayISO()}.xlsx`;
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e: any) {
      let msg = 'Export failed';
      try { const t = await (e?.response?.data as Blob)?.text(); msg = JSON.parse(t).error || msg; } catch { /* ignore */ }
      setError(msg);
    } finally { setExporting(false); }
  };

  const meta = TABS.find((t) => t.key === tab)!;

  return (
    <Box>
      <PageHeader title="Reports" subtitle={meta.subtitle}>
        <Button variant="contained" color="success" startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <FileDownload />}
          onClick={exportXlsx} disabled={exporting}>
          Export Excel
        </Button>
      </PageHeader>

      <Tabs value={tab} onChange={(_, v) => navigate(`/reports/${v}`)} sx={{ mb: 2 }} variant="scrollable">
        {TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
      </Tabs>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={6} sm={3} md={2}>
              <TextField fullWidth size="small" type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField fullWidth size="small" type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete size="small" options={customers} value={customer} onChange={(_, v) => setCustomer(v)}
                getOptionLabel={(o) => optionLabel(o, 'code')} isOptionEqualToValue={(a, b) => a?.id === b?.id}
                renderInput={(p) => <TextField {...p} label={tab === 'customer-statement' ? 'Customer *' : 'Customer (all)'} />} />
            </Grid>
            {tab === 'customer-payments' && (
              <>
                <Grid item xs={6} sm={3} md={2}>
                  <TextField fullWidth select size="small" label="Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <MenuItem value="">All methods</MenuItem>
                    {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m.replace('_', ' ')}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={3} md={2}>
                  <TextField fullWidth select size="small" label="Received Into" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                    <MenuItem value="">All accounts</MenuItem>
                    {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControlLabel control={<Checkbox checked={includeCancelled} onChange={(e) => setIncludeCancelled(e.target.checked)} />} label="Show cancelled" />
                </Grid>
              </>
            )}
            {tab === 'sales' && (
              <>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField fullWidth select size="small" label="Status" value={statuses}
                    SelectProps={{ multiple: true, renderValue: (s) => ((s as string[]).length ? (s as string[]).join(', ') : 'Posted') }}
                    onChange={(e) => setStatuses(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]))}>
                    {INVOICE_STATUSES.map((s) => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete size="small" options={products} value={product} onChange={(_, v) => setProduct(v)}
                    getOptionLabel={(o) => optionLabel(o, 'sku')} isOptionEqualToValue={(a, b) => a?.id === b?.id}
                    renderInput={(p) => <TextField {...p} label="Product (all)" />} />
                </Grid>
              </>
            )}
            <Grid item xs={12} sm="auto">
              <Button variant="contained" startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Search />} onClick={run} disabled={loading}>
                Generate
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!data && !error && !loading && (
        <Alert severity="info">Choose filters and click Generate to preview, or Export Excel to download.</Alert>
      )}

      {data?.customer && Array.isArray(data.lines) && tab === 'customer-statement' && (
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>{data.customer.name} ({data.customer.code})</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Period: {data.period?.label} · Credit terms {data.customer.creditDays ?? '-'} days · Limit {money(data.customer.creditLimit)}
          </Typography>
          <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mb: 2 }}>
            <Stat label="Opening Balance" value={money(data.openingBalance)} />
            <Stat label="Invoiced" value={money(data.totals?.invoiced)} />
            <Stat label="Credit Notes" value={money(data.totals?.credited)} />
            <Stat label="Received" value={money(data.totals?.received)} />
            <Stat label="Closing Balance" value={money(data.closingBalance)} />
          </Stack>
          <SimpleTable
            columns={[
              { key: 'date', label: 'Date', date: true }, { key: 'type', label: 'Type' },
              { key: 'documentNumber', label: 'Document No.' }, { key: 'reference', label: 'Reference' },
              { key: 'description', label: 'Description' }, { key: 'dueDate', label: 'Due Date', date: true },
              { key: 'debit', label: 'Debit', money: true }, { key: 'credit', label: 'Credit', money: true },
              { key: 'balance', label: 'Balance', money: true },
            ]}
            lead={[{ date: data.period?.from, description: 'Opening Balance', balance: data.openingBalance }]}
            rows={data.lines}
            totals={[
              { description: 'Period Totals', debit: data.totals?.debit, credit: data.totals?.credit },
              { description: 'Closing Balance', balance: data.closingBalance },
            ]}
          />
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Outstanding ageing (open invoices up to {formatDateDDMMYYYY(data.ageingAsOf)})</Typography>
          <SimpleTable maxHeight={200}
            columns={[
              { key: 'current', label: '0-30 Days', money: true }, { key: 'days31to60', label: '31-60 Days', money: true },
              { key: 'days61to90', label: '61-90 Days', money: true }, { key: 'over90', label: 'Over 90 Days', money: true },
              { key: 'total', label: 'Total Outstanding', money: true },
            ]}
            rows={[data.ageing ?? {}]}
          />
        </Box>
      )}

      {Array.isArray(data?.rows) && Array.isArray(data?.byMethod) && tab === 'customer-payments' && (
        <Box>
          <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mb: 2 }}>
            <Stat label="Receipts" value={String(data.totals?.count ?? 0)} />
            <Stat label="Total Collected" value={money(data.totals?.amount)} />
            {data.byMethod.map((m: any) => <Stat key={m.label} label={String(m.label ?? '').replace('_', ' ')} value={money(m.amount)} />)}
          </Stack>
          <SimpleTable
            columns={[
              { key: 'date', label: 'Date', date: true }, { key: 'documentNumber', label: 'Receipt No.' },
              { key: 'customerName', label: 'Customer' }, { key: 'invoiceNumber', label: 'Against Invoice' },
              { key: 'paymentMethod', label: 'Method' }, { key: 'account', label: 'Received Into' },
              { key: 'referenceNumber', label: 'Reference' }, { key: 'status', label: 'Status' },
              { key: 'amount', label: 'Amount', money: true },
            ]}
            rows={data.rows}
            totals={[{ customerName: `Total (${data.totals?.count ?? 0} receipts)`, amount: data.totals?.amount }]}
          />
        </Box>
      )}

      {Array.isArray(data?.rows) && Array.isArray(data?.byProduct) && tab === 'sales' && (
        <Box>
          <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mb: 2 }}>
            <Stat label="Invoices" value={String(data.totals?.count ?? 0)} />
            <Stat label="Net Sales" value={money(data.totals?.subtotal)} />
            <Stat label="VAT" value={money(data.totals?.vatAmount)} />
            <Stat label="Gross Sales" value={money(data.totals?.total)} />
            <Stat label="Balance Due" value={money(data.totals?.balance)} />
          </Stack>
          <Stack direction="row" gap={1} sx={{ mb: 1 }}>
            {(['invoices', 'customers', 'products'] as const).map((v) => (
              <Chip key={v} label={v === 'invoices' ? 'By Invoice' : v === 'customers' ? 'By Customer' : 'By Product'}
                color={salesView === v ? 'primary' : 'default'} onClick={() => setSalesView(v)} />
            ))}
          </Stack>
          {salesView === 'invoices' && (
            <SimpleTable
              columns={[
                { key: 'date', label: 'Date', date: true }, { key: 'documentNumber', label: 'Invoice No.' },
                { key: 'customerName', label: 'Customer' }, { key: 'status', label: 'Status' },
                { key: 'subtotal', label: 'Subtotal', money: true }, { key: 'vatAmount', label: 'VAT', money: true },
                { key: 'total', label: 'Total', money: true }, { key: 'paidAmount', label: 'Received', money: true },
                { key: 'creditedAmount', label: 'Credited', money: true }, { key: 'balance', label: 'Balance', money: true },
              ]}
              rows={data.rows}
              totals={[{ customerName: `Total (${data.totals?.count ?? 0} invoices)`, ...data.totals }]}
            />
          )}
          {salesView === 'customers' && (
            <SimpleTable
              columns={[
                { key: 'customerCode', label: 'Code' }, { key: 'customerName', label: 'Customer' }, { key: 'count', label: 'Invoices' },
                { key: 'subtotal', label: 'Net Sales', money: true }, { key: 'vatAmount', label: 'VAT', money: true },
                { key: 'total', label: 'Total', money: true }, { key: 'paidAmount', label: 'Received', money: true },
                { key: 'balance', label: 'Balance', money: true },
              ]}
              rows={Array.isArray(data.byCustomer) ? data.byCustomer : []}
              totals={[{ customerName: 'Total', count: data.totals?.count, subtotal: data.totals?.subtotal, vatAmount: data.totals?.vatAmount, total: data.totals?.total, paidAmount: data.totals?.paidAmount, balance: data.totals?.balance }]}
            />
          )}
          {salesView === 'products' && (
            <SimpleTable
              columns={[
                { key: 'sku', label: 'SKU' }, { key: 'productName', label: 'Product' }, { key: 'unit', label: 'Unit' },
                { key: 'quantity', label: 'Qty Sold' }, { key: 'avgPrice', label: 'Avg. Net Price', money: true },
                { key: 'netAmount', label: 'Net Amount', money: true }, { key: 'vatAmount', label: 'VAT', money: true },
                { key: 'total', label: 'Total', money: true },
              ]}
              rows={data.byProduct}
            />
          )}
        </Box>
      )}
    </Box>
  );
}
