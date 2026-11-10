import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, Autocomplete, MenuItem, IconButton,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Visibility, PictureAsPdf } from '@mui/icons-material';
import { api, displayDocumentNumber, pdfFilename } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';
import DocumentDateField from '../../components/common/DocumentDateField';
import DocumentViewDialog from '../../components/common/DocumentViewDialog';
import InvoiceAllocationPicker from '../../components/common/InvoiceAllocationPicker';
import { todayISO, formatDateDDMMYYYY } from '../../utils/date';
import {
  AllocationLine, allocationTotal, roundMoney, validateAllocations, voucherInvoiceLabel, voucherViewItems,
} from '../../utils/voucherAllocations';

interface Vendor {
  id: string; name: string; code: string;
  address?: string | null; vatNumber?: string | null;
  phone?: string | null; email?: string | null;
}
interface PurchaseInvoice {
  id: string; documentNumber: string; vendorId: string; total: number; paidAmount: number; debitedAmount?: number;
  status?: string;
}
interface Payment {
  id: string; documentNumber: string; date: string; amount: number;
  paymentMethod: string; referenceNumber?: string | null; notes?: string | null;
  preparedBy?: string | null; approvedBy?: string | null; status?: string;
  paymentAccountId?: string | null;
  paymentAccount?: { id: string; code: string; name: string } | null;
  vendor: Vendor;
  purchaseInvoice?: { documentNumber: string } | null;
  allocations?: { amount: number | string; purchaseInvoice?: { documentNumber: string } | null }[];
}

interface FundAccount { id: string; code: string; name: string; }

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD'];

async function fetchPaymentPdfBlob(id: string) {
  const res = await api.get(`/purchase/payments/${id}/pdf`, { responseType: 'blob' });
  return new Blob([res.data], { type: 'application/pdf' });
}

const downloadPdf = async (id: string, docNumber: string, partyName: string) => {
  const blob = await fetchPaymentPdfBlob(id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFilename(partyName, docNumber);
  a.click();
  URL.revokeObjectURL(url);
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [fundAccounts, setFundAccounts] = useState<FundAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewPayment, setViewPayment] = useState<Payment | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const emptyForm = () => ({
    vendorId: '', date: todayISO(),
    amount: 0, paymentMethod: 'BANK_TRANSFER', paymentAccountId: '', referenceNumber: '', notes: '',
    allocations: [] as AllocationLine[],
  });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [p, v, inv, funds] = await Promise.all([
        api.get<Payment[]>('/purchase/payments'),
        api.get<Vendor[]>('/vendors', { params: { active: true } }),
        api.get<PurchaseInvoice[]>('/purchase/invoices'),
        api.get<FundAccount[]>('/accounts/fund-accounts'),
      ]);
      setPayments(p.data);
      setVendors(v.data);
      setInvoices(inv.data);
      setFundAccounts(funds.data);
    } catch {
      setError('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openView = async (payment: Payment) => {
    setActionId(payment.id);
    try {
      const res = await api.get<Payment>(`/purchase/payments/${payment.id}`);
      setViewPayment(res.data);
      setViewOpen(true);
    } catch {
      setError('Failed to load payment');
    } finally {
      setActionId(null);
    }
  };

  const handlePdf = async (payment: Payment) => {
    setActionId(payment.id);
    try {
      await downloadPdf(payment.id, payment.documentNumber, payment.vendor?.name || 'Vendor');
    } catch {
      setError('Failed to download PDF');
    } finally {
      setActionId(null);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!form.vendorId) {
        setError('Vendor is required');
        return;
      }
      const open = vendorInvoices.map((invoice) => ({
        id: invoice.id,
        documentNumber: invoice.documentNumber,
        balance: invoiceBalance(invoice),
      }));
      const allocationError = validateAllocations(form.allocations, open);
      if (allocationError) {
        setError(allocationError);
        setSaving(false);
        return;
      }
      const amount = form.allocations.length
        ? allocationTotal(form.allocations)
        : roundMoney(Number(form.amount));
      if (!(amount > 0)) {
        setError('Amount must be greater than zero');
        setSaving(false);
        return;
      }
      await api.post('/purchase/payments', {
        vendorId: form.vendorId,
        date: form.date,
        amount,
        paymentMethod: form.paymentMethod,
        paymentAccountId: form.paymentAccountId || undefined,
        referenceNumber: form.referenceNumber,
        notes: form.notes,
        allocations: form.allocations.length
          ? form.allocations.map((line) => ({ purchaseInvoiceId: line.invoiceId, amount: roundMoney(line.amount) }))
          : undefined,
      });
      setDialogOpen(false);
      setSuccess('Payment created');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create payment');
    } finally {
      setSaving(false);
    }
  };

  const invoiceBalance = (invoice: PurchaseInvoice) => roundMoney(
    Number(invoice.total) - Number(invoice.paidAmount) - Number(invoice.debitedAmount ?? 0),
  );

  const vendorInvoices = invoices.filter((invoice) => {
    if (invoice.vendorId !== form.vendorId) return false;
    if (invoice.status && !['CONFIRMED', 'PARTIALLY_PAID'].includes(invoice.status)) return false;
    return invoiceBalance(invoice) > 0.001;
  }).sort((a, b) => a.documentNumber.localeCompare(b.documentNumber));

  const columns: GridColDef[] = [
    {
      field: 'documentNumber', headerName: 'Number', width: 140,
      valueGetter: (_, row) => displayDocumentNumber((row as Payment).documentNumber),
    },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'vendor', headerName: 'Vendor', flex: 1, valueGetter: (_, row) => (row as Payment).vendor?.name },
    {
      field: 'invoice', headerName: 'Invoices', width: 220,
      valueGetter: (_, row) => {
        const payment = row as Payment;
        const allocations = (payment.allocations || []).map((line) => ({
          documentNumber: line.purchaseInvoice?.documentNumber,
        }));
        return voucherInvoiceLabel(allocations, payment.purchaseInvoice?.documentNumber);
      },
    },
    { field: 'amount', headerName: 'Amount', width: 110, type: 'number' },
    { field: 'paymentMethod', headerName: 'Method', width: 120 },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: ({ row }) => {
        const payment = row as Payment;
        const busy = actionId === payment.id;
        return (
          <Box>
            <IconButton size="small" title="View" disabled={busy} onClick={() => openView(payment)}>
              {busy ? <CircularProgress size={16} /> : <Visibility fontSize="small" />}
            </IconButton>
            <IconButton size="small" title="Download PDF" disabled={busy} onClick={() => handlePdf(payment)}>
              <PictureAsPdf fontSize="small" color="error" />
            </IconButton>
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader title="Payments" subtitle="Vendor payments" actionLabel="New Payment"
        onAction={() => {
          setError('');
          setForm(emptyForm());
          setDialogOpen(true);
        }} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={payments} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleCreate}>
          <DialogTitle>New Payment</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <Autocomplete options={vendors} getOptionLabel={(v) => `${v.code} - ${v.name}`}
                  value={vendors.find((v) => v.id === form.vendorId) || null}
                  onChange={(_, val) => setForm({
                    ...form,
                    vendorId: val?.id || '',
                    allocations: [],
                    amount: form.allocations.length ? 0 : form.amount,
                  })}
                  renderInput={(params) => <TextField {...params} required label="Vendor" />} />
              </Grid>
              <Grid item xs={12}>
                <InvoiceAllocationPicker
                  label="Purchase Invoices"
                  partyNoun="vendor"
                  partySelected={Boolean(form.vendorId)}
                  invoices={vendorInvoices.map((invoice) => ({
                    id: invoice.id,
                    documentNumber: invoice.documentNumber,
                    balance: invoiceBalance(invoice),
                  }))}
                  value={form.allocations}
                  onChange={(allocations) => setForm({
                    ...form,
                    allocations,
                    amount: allocations.length ? allocationTotal(allocations) : form.amount,
                  })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="Amount" type="number" value={form.allocations.length ? allocationTotal(form.allocations) : form.amount}
                  onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                  InputProps={{ readOnly: form.allocations.length > 0 }}
                  helperText={form.allocations.length ? 'Total of the selected invoice allocations' : 'Used when no invoice is selected'} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Payment Method" value={form.paymentMethod}
                  onChange={(e) => {
                    const method = e.target.value;
                    const preferCash = method === 'CASH';
                    const match = fundAccounts.find((a) => preferCash ? a.code === '1000' : a.code === '1010')
                      || fundAccounts[0];
                    setForm({
                      ...form,
                      paymentMethod: method,
                      paymentAccountId: match?.id || '',
                    });
                  }}>
                  {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Paid From (Cash / Bank)" value={form.paymentAccountId}
                  onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}
                  helperText="Add more banks in Chart of Accounts (e.g. 1011 Emirates NBD)">
                  <MenuItem value="">Default by method</MenuItem>
                  {fundAccounts.map((a) => (
                    <MenuItem key={a.id} value={a.id}>{a.code} — {a.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <DocumentDateField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Reference Number" value={form.referenceNumber}
                  onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Remarks" value={form.notes} multiline minRows={2}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving || Boolean(validateAllocations(form.allocations, vendorInvoices.map((invoice) => ({
              id: invoice.id,
              documentNumber: invoice.documentNumber,
              balance: invoiceBalance(invoice),
            }))))}>{saving ? <CircularProgress size={20} /> : 'Create'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <DocumentViewDialog
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewPayment(null); }}
        title="Payment Voucher"
        variant="voucher"
        document={viewPayment ? {
          documentNumber: displayDocumentNumber(viewPayment.documentNumber),
          date: viewPayment.date,
          status: viewPayment.status || 'CONFIRMED',
          partyName: viewPayment.vendor?.name,
          partyLabel: 'Supplier',
          partyAddress: viewPayment.vendor?.address,
          partyVatNumber: viewPayment.vendor?.vatNumber,
          partyPhone: viewPayment.vendor?.phone,
          partyEmail: viewPayment.vendor?.email,
          remarks: viewPayment.notes,
          vatApplicable: false,
          total: Number(viewPayment.amount),
          items: voucherViewItems(
            Number(viewPayment.amount),
            (viewPayment.allocations || []).map((line) => ({
              amount: line.amount,
              documentNumber: line.purchaseInvoice?.documentNumber,
            })),
            viewPayment.purchaseInvoice?.documentNumber,
            'payment',
          ),
        } : null}
        extraFields={viewPayment ? [
          { label: 'Payment Method', value: viewPayment.paymentMethod },
          ...(viewPayment.paymentAccount
            ? [{ label: 'Paid From', value: `${viewPayment.paymentAccount.code} — ${viewPayment.paymentAccount.name}` }]
            : []),
          ...(viewPayment.referenceNumber ? [{ label: 'Reference', value: viewPayment.referenceNumber }] : []),
          ...(() => {
            const label = voucherInvoiceLabel(
              (viewPayment.allocations || []).map((line) => ({ documentNumber: line.purchaseInvoice?.documentNumber })),
              viewPayment.purchaseInvoice?.documentNumber,
            );
            return label === '-' ? [] : [{ label: (viewPayment.allocations?.length || 0) > 1 ? 'Invoices' : 'Invoice Ref', value: label }];
          })(),
        ] : undefined}
        onDownload={viewPayment
          ? () => downloadPdf(viewPayment.id, viewPayment.documentNumber, viewPayment.vendor?.name || 'Vendor')
          : undefined}
        busy={!!actionId}
      />
    </Box>
  );
}
