import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, IconButton, Switch, FormControlLabel,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Edit, Delete } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';

interface Customer {
  id: string;
  code: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  vatNumber?: string;
  creditLimit: number;
  creditDays: number;
  isActive: boolean;
}

const emptyForm = {
  code: '', name: '', contactPerson: '', email: '', phone: '', address: '',
  city: '', state: '', country: '', postalCode: '', vatNumber: '',
  creditLimit: 0, creditDays: 30, isActive: true,
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchCustomers = () => {
    setLoading(true);
    api.get<Customer[]>('/customers', { params: { search: search || undefined } })
      .then((res) => setCustomers(res.data))
      .catch(() => setError('Failed to load customers'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCustomers(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setForm({
      code: customer.code, name: customer.name, contactPerson: customer.contactPerson || '',
      email: customer.email || '', phone: customer.phone || '', address: customer.address || '',
      city: customer.city || '', state: customer.state || '', country: customer.country || '',
      postalCode: customer.postalCode || '', vatNumber: customer.vatNumber || '',
      creditLimit: Number(customer.creditLimit), creditDays: customer.creditDays, isActive: customer.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        code: editing ? form.code : (form.code.trim() || undefined),
      };
      if (editing) {
        await api.put(`/customers/${editing.id}`, payload);
      } else {
        await api.post('/customers', payload);
      }
      setDialogOpen(false);
      fetchCustomers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this customer?')) return;
    try {
      await api.delete(`/customers/${id}`);
      fetchCustomers();
    } catch {
      setError('Failed to deactivate customer');
    }
  };

  const columns: GridColDef[] = [
    { field: 'code', headerName: 'Code', width: 100 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 150 },
    { field: 'phone', headerName: 'Phone', width: 130 },
    { field: 'creditLimit', headerName: 'Credit Limit', width: 120, type: 'number' },
    { field: 'creditDays', headerName: 'Credit Days', width: 110, type: 'number' },
    {
      field: 'isActive', headerName: 'Active', width: 80,
      renderCell: ({ value }) => (value ? 'Yes' : 'No'),
    },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: ({ row }) => (
        <Box>
          <IconButton size="small" onClick={() => openEdit(row as Customer)}><Edit fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><Delete fontSize="small" /></IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader title="Customers" subtitle="Manage customer accounts" actionLabel="Add Customer" onAction={openCreate} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField size="small" label="Search" value={search}
          onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 200 }} />
        <Button variant="outlined" onClick={fetchCustomers}>Search</Button>
      </Box>

      <DocumentTable rows={customers} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSave}>
          <DialogTitle>{editing ? 'Edit Customer' : 'New Customer'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Code"
                  value={editing ? form.code : form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required={!!editing}
                  disabled={!!editing}
                  placeholder={editing ? undefined : 'Leave blank to auto-generate'}
                  helperText={editing ? 'Customer ID' : 'Auto-generated as CUST-YYYY-MM001 (e.g. CUST-2026-07001) if left blank'}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="Name" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Contact Person" value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Email" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Phone" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="VAT Number" value={form.vatNumber}
                  onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Address" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="City" value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="State" value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Country" value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Postal Code" value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Credit Limit" type="number" value={form.creditLimit}
                  onChange={(e) => setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Credit Days" type="number" value={form.creditDays}
                  onChange={(e) => setForm({ ...form, creditDays: parseInt(e.target.value) || 0 })} />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
                  label="Active"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
