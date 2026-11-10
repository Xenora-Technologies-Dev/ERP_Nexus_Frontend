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

interface Customer {
  id: string; name: string; code: string;
  address?: string | null; vatNumber?: string | null;
  phone?: string | null; email?: string | null;
}
interface SalesInvoice {
  id: string; documentNumber: string; customerId: string; total: number; paidAmount: number; creditedAmount?: number;
  status?: string;
}
interface Receipt {
  id: string; documentNumber: string; date: string; amount: number;
  paymentMethod: string; referenceNumber?: string | null; notes?: string | null;
  preparedBy?: string | null; approvedBy?: string | null; status?: string;
  paymentAccountId?: string | null;
  paymentAccount?: { id: string; code: string; name: string } | null;
  customer: Customer;
  salesInvoice?: { documentNumber: string } | null;
  allocations?: { amount: number | string; salesInvoice?: { documentNumber: string } | null }[];
}

interface FundAccount { id: string; code: string; name: string; }

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD'];

async function fetchReceiptPdfBlob(id: string) {
  const res = await api.get(`/sales/receipts/${id}/pdf`, { responseType: 'blob' });
  return new Blob([res.data], { type: 'application/pdf' });
}

const downloadPdf = async (id: string, docNumber: string, partyName: string) => {
  const blob = await fetchReceiptPdfBlob(id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFilename(partyName, docNumber);
  a.click();
  URL.revokeObjectURL(url);
};

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [fundAccounts, setFundAccounts] = useState<FundAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const emptyForm = () => ({
    customerId: '', date: todayISO(),
    amount: 0, paymentMethod: 'CASH', paymentAccountId: '', referenceNumber: '', notes: '', preparedBy: '', approvedBy: '',
    allocations: [] as AllocationLine[],
  });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [r, c, inv, funds] = await Promise.all([
        api.get<Receipt[]>('/sales/receipts'),
        api.get<Customer[]>('/customers', { params: { active: true } }),
        api.get<SalesInvoice[]>('/sales/invoices'),
        api.get<FundAccount[]>('/accounts/fund-accounts'),
      ]);
      setReceipts(r.data);
      setCustomers(c.data);
      setInvoices(inv.data);
      setFundAccounts(funds.data);
    } catch {
      setError('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openView = async (receipt: Receipt) => {
    setActionId(receipt.id);
    try {
      const res = await api.get<Receipt>(`/sales/receipts/${receipt.id}`);
      setViewReceipt(res.data);
      setViewOpen(true);
    } catch {
      setError('Failed to load receipt');
    } finally {
      setActionId(null);
    }
  };

  const handlePdf = async (receipt: Receipt) => {
    setActionId(receipt.id);
    try {
      await downloadPdf(receipt.id, receipt.documentNumber, receipt.customer?.name || 'Customer');
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
      if (!form.customerId) {
        setError('Customer is required');
        return;
      }
      const open = customerInvoices.map((invoice) => ({
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
      await api.post('/sales/receipts', {
        customerId: form.customerId,
        date: form.date,
        amount,
        paymentMethod: form.paymentMethod,
        paymentAccountId: form.paymentAccountId || undefined,
        referenceNumber: form.referenceNumber,
        notes: form.notes,
        preparedBy: form.preparedBy,
        approvedBy: form.approvedBy,
        allocations: form.allocations.length
          ? form.allocations.map((line) => ({ salesInvoiceId: line.invoiceId, amount: roundMoney(line.amount) }))
          : undefined,
      });
      setDialogOpen(false);
      setSuccess('Receipt created');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create receipt');
    } finally {
      setSaving(false);
    }
  };

  const invoiceBalance = (invoice: SalesInvoice) => roundMoney(
    Number(invoice.total) - Number(invoice.paidAmount) - Number(invoice.creditedAmount ?? 0),
  );

  const customerInvoices = invoices.filter((invoice) => {
    if (invoice.customerId !== form.customerId) return false;
    if (invoice.status && !['CONFIRMED', 'PARTIALLY_PAID'].includes(invoice.status)) return false;
    return invoiceBalance(invoice) > 0.001;
  }).sort((a, b) => a.documentNumber.localeCompare(b.documentNumber));

  const columns: GridColDef[] = [
    {
      field: 'documentNumber', headerName: 'Number', width: 140,
      valueGetter: (_, row) => displayDocumentNumber((row as Receipt).documentNumber),
    },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'customer', headerName: 'Customer', flex: 1, valueGetter: (_, row) => (row as Receipt).customer?.name },
    {
      field: 'invoice', headerName: 'Invoices', width: 220,
      valueGetter: (_, row) => {
        const receipt = row as Receipt;
        const allocations = (receipt.allocations || []).map((line) => ({
          documentNumber: line.salesInvoice?.documentNumber,
        }));
        return voucherInvoiceLabel(allocations, receipt.salesInvoice?.documentNumber);
      },
    },
    { field: 'amount', headerName: 'Amount', width: 110, type: 'number' },
    { field: 'paymentMethod', headerName: 'Method', width: 120 },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: ({ row }) => {
        const receipt = row as Receipt;
        const busy = actionId === receipt.id;
        return (
          <Box>
            <IconButton size="small" title="View" disabled={busy} onClick={() => openView(receipt)}>
              {busy ? <CircularProgress size={16} /> : <Visibility fontSize="small" />}
            </IconButton>
            <IconButton size="small" title="Download PDF" disabled={busy} onClick={() => handlePdf(receipt)}>
              <PictureAsPdf fontSize="small" color="error" />
            </IconButton>
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader title="Receipts" subtitle="Customer payment receipts" actionLabel="New Receipt"
        onAction={() => {
          setError('');
          setForm(emptyForm());
          setDialogOpen(true);
        }} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={receipts} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleCreate}>
          <DialogTitle>New Receipt</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <Autocomplete options={customers} getOptionLabel={(c) => `${c.code} - ${c.name}`}
                  value={customers.find((c) => c.id === form.customerId) || null}
                  onChange={(_, v) => setForm({
                    ...form,
                    customerId: v?.id || '',
                    allocations: [],
                    amount: form.allocations.length ? 0 : form.amount,
                  })}
                  renderInput={(params) => <TextField {...params} required label="Customer" />} />
              </Grid>
              <Grid item xs={12}>
                <InvoiceAllocationPicker
                  label="Sales Invoices"
                  partyNoun="customer"
                  partySelected={Boolean(form.customerId)}
                  invoices={customerInvoices.map((invoice) => ({
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
                <TextField fullWidth select label="Received Into (Cash / Bank)" value={form.paymentAccountId}
                  onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}
                  helperText="Add more banks in Chart of Accounts (e.g. 1011 ADCB)">
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
            <Button type="submit" variant="contained" disabled={saving || Boolean(validateAllocations(form.allocations, customerInvoices.map((invoice) => ({
              id: invoice.id,
              documentNumber: invoice.documentNumber,
              balance: invoiceBalance(invoice),
            }))))}>{saving ? <CircularProgress size={20} /> : 'Create'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <DocumentViewDialog
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewReceipt(null); }}
        title="Receipt Voucher"
        variant="voucher"
        document={viewReceipt ? {
          documentNumber: displayDocumentNumber(viewReceipt.documentNumber),
          date: viewReceipt.date,
          status: viewReceipt.status || 'CONFIRMED',
          partyName: viewReceipt.customer?.name,
          partyLabel: 'Customer',
          partyAddress: viewReceipt.customer?.address,
          partyVatNumber: viewReceipt.customer?.vatNumber,
          partyPhone: viewReceipt.customer?.phone,
          partyEmail: viewReceipt.customer?.email,
          remarks: viewReceipt.notes,
          vatApplicable: false,
          total: Number(viewReceipt.amount),
          items: voucherViewItems(
            Number(viewReceipt.amount),
            (viewReceipt.allocations || []).map((line) => ({
              amount: line.amount,
              documentNumber: line.salesInvoice?.documentNumber,
            })),
            viewReceipt.salesInvoice?.documentNumber,
            'receipt',
          ),
        } : null}
        extraFields={viewReceipt ? [
          { label: 'Payment Method', value: viewReceipt.paymentMethod },
          ...(viewReceipt.paymentAccount
            ? [{ label: 'Received Into', value: `${viewReceipt.paymentAccount.code} — ${viewReceipt.paymentAccount.name}` }]
            : []),
          ...(viewReceipt.referenceNumber ? [{ label: 'Reference', value: viewReceipt.referenceNumber }] : []),
          ...(() => {
            const label = voucherInvoiceLabel(
              (viewReceipt.allocations || []).map((line) => ({ documentNumber: line.salesInvoice?.documentNumber })),
              viewReceipt.salesInvoice?.documentNumber,
            );
            return label === '-' ? [] : [{ label: (viewReceipt.allocations?.length || 0) > 1 ? 'Invoices' : 'Invoice Ref', value: label }];
          })(),
        ] : undefined}
        onDownload={viewReceipt
          ? () => downloadPdf(viewReceipt.id, viewReceipt.documentNumber, viewReceipt.customer?.name || 'Customer')
          : undefined}
        busy={!!actionId}
      />
    </Box>
  );
}
