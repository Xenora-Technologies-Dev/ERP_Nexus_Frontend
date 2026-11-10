import { displayDocumentNumber } from '../api/client';

export interface AllocationLine {
  invoiceId: string;
  amount: number;
}

export interface OpenInvoiceOption {
  id: string;
  documentNumber: string;
  balance: number;
}

export function roundMoney(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function allocationTotal(lines: AllocationLine[]): number {
  return roundMoney(lines.reduce((sum, line) => sum + roundMoney(line.amount), 0));
}

/** Returns a message when the selection cannot be posted. A single invoice may be overpaid. */
export function validateAllocations(lines: AllocationLine[], invoices: OpenInvoiceOption[]): string | null {
  if (!lines.length) return null;
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.invoiceId)) return 'The same invoice is selected more than once';
    seen.add(line.invoiceId);
    const invoice = invoices.find((row) => row.id === line.invoiceId);
    if (!invoice) return 'A selected invoice is no longer open. Close the form and try again';
    const amount = roundMoney(line.amount);
    if (!(amount > 0)) {
      return `Enter an amount for ${displayDocumentNumber(invoice.documentNumber)}`;
    }
    if (lines.length > 1 && amount - invoice.balance > 0.009) {
      return `Allocation of ${amount.toFixed(2)} exceeds the balance of ${invoice.balance.toFixed(2)} on ${displayDocumentNumber(invoice.documentNumber)}`;
    }
  }
  return null;
}

export interface VoucherLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export function voucherViewItems(
  amount: number,
  allocations: { amount: number | string; documentNumber?: string | null }[],
  legacyNumber: string | null | undefined,
  kind: 'receipt' | 'payment',
): VoucherLine[] {
  const total = roundMoney(amount);
  const verb = kind === 'receipt' ? 'receipt' : 'payment';
  const plain = kind === 'receipt' ? 'Being receipt from customer' : 'Being payment to vendor';
  const onAccount = kind === 'receipt' ? 'Being receipt on account' : 'Being payment on account';
  const fromAllocations = allocations
    .map((row) => ({
      documentNumber: row.documentNumber || '',
      amount: roundMoney(Number(row.amount)),
    }))
    .filter((row) => row.documentNumber && row.amount > 0);
  const rows = fromAllocations.length
    ? fromAllocations
    : legacyNumber
      ? [{ documentNumber: legacyNumber, amount: total }]
      : [];

  if (!rows.length) {
    return [{ description: plain, quantity: 1, unitPrice: total, total }];
  }

  const items = rows.map((row) => ({
    description: `Being ${verb} against ${displayDocumentNumber(row.documentNumber)}`,
    quantity: 1,
    unitPrice: row.amount,
    total: row.amount,
  }));
  const allocated = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const remainder = roundMoney(total - allocated);
  if (remainder > 0.009) {
    items.push({ description: onAccount, quantity: 1, unitPrice: remainder, total: remainder });
  }
  return items;
}

export function voucherInvoiceLabel(
  allocations: { documentNumber?: string | null }[],
  legacyNumber?: string | null,
): string {
  const nums = allocations.map((row) => row.documentNumber).filter((value): value is string => Boolean(value));
  if (nums.length) return nums.map((num) => displayDocumentNumber(num)).join(', ');
  return legacyNumber ? displayDocumentNumber(legacyNumber) : '-';
}
