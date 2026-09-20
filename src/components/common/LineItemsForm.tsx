import { useState, useEffect, useCallback } from 'react';
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  IconButton, TextField, Autocomplete, Button, FormControlLabel, Checkbox, Paper, Typography,
} from '@mui/material';
import { Delete, Add } from '@mui/icons-material';

export interface LineItem {
  id?: string;
  productId: string;
  productName?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  unit?: string;
  costPrice?: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  costPrice?: number;
  vatRate: number;
  unit?: string;
  countryOfOrigin?: string | null;
}

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  width?: number;
  min?: number;
}

export function NumberField({ value, onChange, width = 80, min }: NumberFieldProps) {
  const [local, setLocal] = useState(value === 0 ? '' : String(value));

  useEffect(() => {
    setLocal(value === 0 ? '' : String(value));
  }, [value]);

  return (
    <TextField
      size="small"
      value={local}
      onChange={(e) => {
        const raw = e.target.value;
        setLocal(raw);
        if (raw === '' || raw === '-') return;
        const parsed = parseFloat(raw);
        if (!isNaN(parsed)) onChange(parsed);
      }}
      onBlur={() => {
        if (local === '' || local === '-') {
          onChange(0);
          setLocal('');
        } else {
          const parsed = parseFloat(local);
          if (!isNaN(parsed)) {
            onChange(parsed);
            setLocal(parsed === 0 ? '' : String(parsed));
          }
        }
      }}
      sx={{ width }}
      inputProps={{ min, step: 0.01 }}
    />
  );
}

function productLabel(p: Product) {
  const base = `${p.sku} - ${p.name}`;
  return p.countryOfOrigin ? `${base} (${p.countryOfOrigin})` : base;
}

interface Props {
  products: Product[];
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  vatApplicable: boolean;
  onVatChange: (v: boolean) => void;
  priceField?: 'sellingPrice' | 'costPrice';
  showCost?: boolean;
  showDiscount?: boolean;
  discount?: number;
  onDiscountChange?: (v: number) => void;
}

export default function LineItemsForm({
  products, items, onChange, vatApplicable, onVatChange,
  priceField = 'sellingPrice', showCost = false,
  showDiscount = false, discount = 0, onDiscountChange,
}: Props) {
  const addItem = () => {
    onChange([...items, { productId: '', quantity: 1, unitPrice: 0, vatRate: 5 }]);
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const selectProduct = (index: number, product: Product | null) => {
    if (!product) return;
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      productId: product.id,
      productName: product.name,
      unit: product.unit || 'PCS',
      unitPrice: Number(product[priceField] ?? 0),
      costPrice: Number(product.costPrice ?? 0),
      vatRate: Number(product.vatRate),
    };
    onChange(updated);
  };

  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));

  const calcLine = useCallback((item: LineItem) => {
    const sub = item.quantity * item.unitPrice;
    const vat = vatApplicable ? sub * (item.vatRate / 100) : 0;
    return { sub, vat, total: sub + vat };
  }, [vatApplicable]);

  const lineTotals = items.reduce(
    (acc, item) => {
      const c = calcLine(item);
      return { sub: acc.sub + c.sub, vat: acc.vat + c.vat, total: acc.total + c.total };
    },
    { sub: 0, vat: 0, total: 0 }
  );

  const grandTotal = Math.max(0, lineTotals.total - (showDiscount ? discount : 0));

  return (
    <Box>
      <FormControlLabel
        control={<Checkbox checked={vatApplicable} onChange={(e) => onVatChange(e.target.checked)} />}
        label="VAT Applicable (Tax Invoice)"
        sx={{ mb: 1 }}
      />
      {!vatApplicable && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
          This invoice is outside the VAT system and will not appear in VAT reports.
        </Typography>
      )}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell align="center">UOM</TableCell>
              <TableCell align="right">Qty</TableCell>
              {showCost && <TableCell align="right">Purchase Cost</TableCell>}
              <TableCell align="right">Unit Price</TableCell>
              {vatApplicable && <TableCell align="right">VAT %</TableCell>}
              {vatApplicable && <TableCell align="right">VAT Amt</TableCell>}
              <TableCell align="right">Total</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, i) => {
              const calc = calcLine(item);
              const product = products.find((p) => p.id === item.productId);
              return (
                <TableRow key={i}>
                  <TableCell sx={{ minWidth: 220 }}>
                    <Autocomplete
                      size="small"
                      options={products}
                      getOptionLabel={productLabel}
                      value={product || null}
                      onChange={(_, v) => selectProduct(i, v)}
                      renderInput={(params) => <TextField {...params} placeholder="Select product" />}
                    />
                  </TableCell>
                  <TableCell align="center">{product?.unit || item.unit || '-'}</TableCell>
                  <TableCell align="right">
                    <NumberField value={item.quantity} onChange={(v) => updateItem(i, 'quantity', v)} />
                  </TableCell>
                  {showCost && (
                    <TableCell align="right">
                      {(item.costPrice ?? product?.costPrice ?? 0).toFixed(2)}
                    </TableCell>
                  )}
                  <TableCell align="right">
                    <NumberField value={item.unitPrice} onChange={(v) => updateItem(i, 'unitPrice', v)} width={100} />
                  </TableCell>
                  {vatApplicable && (
                    <TableCell align="right">{item.vatRate}%</TableCell>
                  )}
                  {vatApplicable && (
                    <TableCell align="right">{calc.vat.toFixed(2)}</TableCell>
                  )}
                  <TableCell align="right">{calc.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => removeItem(i)} color="error"><Delete /></IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, alignItems: 'flex-end' }}>
        <Button startIcon={<Add />} onClick={addItem} size="small">Add Line</Button>
        <Box sx={{ textAlign: 'right' }}>
          <div>Subtotal: {lineTotals.sub.toFixed(2)}</div>
          {vatApplicable && <div>VAT: {lineTotals.vat.toFixed(2)}</div>}
          {showDiscount && onDiscountChange && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, my: 0.5 }}>
              <span>Discount:</span>
              <NumberField value={discount} onChange={onDiscountChange} width={100} />
            </Box>
          )}
          <strong>Total: {grandTotal.toFixed(2)}</strong>
        </Box>
      </Box>
    </Box>
  );
}
