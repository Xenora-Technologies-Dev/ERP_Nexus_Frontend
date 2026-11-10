import {
  Box, Button, Checkbox, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { displayDocumentNumber } from '../../api/client';
import {
  AllocationLine, OpenInvoiceOption, allocationTotal, roundMoney, validateAllocations,
} from '../../utils/voucherAllocations';

interface Props {
  label: string;
  partySelected: boolean;
  partyNoun: string;
  invoices: OpenInvoiceOption[];
  value: AllocationLine[];
  onChange: (lines: AllocationLine[]) => void;
}

export default function InvoiceAllocationPicker({
  label, partySelected, partyNoun, invoices, value, onChange,
}: Props) {
  const selected = new Map(value.map((line) => [line.invoiceId, line]));
  const problem = partySelected ? validateAllocations(value, invoices) : null;
  const singleOverpay = value.length === 1
    ? invoices.find((invoice) => invoice.id === value[0].invoiceId && roundMoney(value[0].amount) - invoice.balance > 0.009)
    : undefined;

  const toggle = (invoice: OpenInvoiceOption, checked: boolean) => {
    if (checked) {
      onChange([...value, { invoiceId: invoice.id, amount: roundMoney(invoice.balance) }]);
      return;
    }
    onChange(value.filter((line) => line.invoiceId !== invoice.id));
  };

  const setAmount = (invoiceId: string, raw: string) => {
    const parsed = raw.trim() === '' ? 0 : Number(raw);
    onChange(value.map((line) => (
      line.invoiceId === invoiceId
        ? { ...line, amount: Number.isFinite(parsed) ? parsed : 0 }
        : line
    )));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" fontWeight={600}>{label}</Typography>
        {partySelected && invoices.length > 0 && (
          <Box>
            <Button size="small" onClick={() => onChange(invoices.map((invoice) => ({
              invoiceId: invoice.id,
              amount: roundMoney(invoice.balance),
            })))}>
              Select all
            </Button>
            <Button size="small" disabled={value.length === 0} onClick={() => onChange([])}>Clear</Button>
          </Box>
        )}
      </Box>

      {!partySelected && (
        <Typography variant="body2" color="text.secondary">
          Select a {partyNoun} to see open invoices.
        </Typography>
      )}

      {partySelected && invoices.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No open invoices for this {partyNoun}. The voucher is posted on account.
        </Typography>
      )}

      {partySelected && invoices.length > 0 && (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: 260, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Invoice</TableCell>
                <TableCell align="right">Balance</TableCell>
                <TableCell align="right" sx={{ width: 150 }}>Allocate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice) => {
                const line = selected.get(invoice.id);
                const checked = Boolean(line);
                const over = checked && roundMoney(line!.amount) - invoice.balance > 0.009;
                const showError = over && value.length > 1;
                return (
                  <TableRow key={invoice.id} hover selected={checked}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={checked}
                        onChange={(event) => toggle(invoice, event.target.checked)}
                        inputProps={{ 'aria-label': `Allocate ${displayDocumentNumber(invoice.documentNumber)}` }}
                      />
                    </TableCell>
                    <TableCell>{displayDocumentNumber(invoice.documentNumber)}</TableCell>
                    <TableCell align="right">{invoice.balance.toFixed(2)}</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        disabled={!checked}
                        value={checked ? line!.amount : ''}
                        onChange={(event) => setAmount(invoice.id, event.target.value)}
                        error={showError || (checked && !(roundMoney(line!.amount) > 0))}
                        inputProps={{ min: 0, step: '0.01', style: { textAlign: 'right' } }}
                        sx={{ width: 130 }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      {partySelected && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {value.length
            ? `Allocated ${allocationTotal(value).toFixed(2)}. Adjust a line to pay part of an invoice.`
            : 'Leave every invoice unchecked to allocate this amount to the oldest open invoices.'}
        </Typography>
      )}
      {problem && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>{problem}</Typography>
      )}
      {!problem && singleOverpay && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
          This amount is above the invoice balance and will be posted as an overpayment.
        </Typography>
      )}
    </Box>
  );
}
