import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Collapse, Box, Typography, Divider, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Dashboard, Settings, People, Store, Inventory, PointOfSale,
  ShoppingCart, AccountBalance, CreditScore, Description, Notifications,
  ExpandLess, ExpandMore, Receipt, LocalShipping, RequestQuote, Assessment,
} from '@mui/icons-material';
import { useState } from 'react';
import { brandColors, APP_VERSION, APP_NAME } from '../../theme';

const DRAWER_WIDTH = 260;

interface NavItem {
  title: string;
  path?: string;
  icon: React.ReactNode;
  children?: { title: string; path: string }[];
}

const navItems: NavItem[] = [
  { title: 'Dashboard', path: '/', icon: <Dashboard /> },
  { title: 'Customers', path: '/customers', icon: <People /> },
  { title: 'Vendors', path: '/vendors', icon: <Store /> },
  {
    title: 'Inventory', icon: <Inventory />,
    children: [
      { title: 'Inventory Management', path: '/inventory' },
      { title: 'Inventory Movements', path: '/inventory/movements' },
    ],
  },
  {
    title: 'Sales', icon: <PointOfSale />,
    children: [
      { title: 'Quotations', path: '/sales/quotations' },
      { title: 'Sales Orders', path: '/sales/orders' },
      { title: 'Delivery Notes', path: '/sales/delivery-notes' },
      { title: 'Sales Invoices', path: '/sales/invoices' },
      { title: 'Sales Returns', path: '/sales/returns' },
      { title: 'Credit Notes', path: '/sales/credit-notes' },
      { title: 'Receipts', path: '/sales/receipts' },
    ],
  },
  {
    title: 'Purchase', icon: <ShoppingCart />,
    children: [
      { title: 'RFQs', path: '/purchase/rfqs' },
      { title: 'Purchase Orders', path: '/purchase/orders' },
      { title: 'GRN', path: '/purchase/grns' },
      { title: 'Purchase Invoices', path: '/purchase/invoices' },
      { title: 'Purchase Returns', path: '/purchase/returns' },
      { title: 'Debit Notes', path: '/purchase/debit-notes' },
      { title: 'Payments', path: '/purchase/payments' },
    ],
  },
  {
    title: 'Accounts', icon: <AccountBalance />,
    children: [
      { title: 'Chart of Accounts', path: '/accounts/chart' },
      { title: 'Journal Entries', path: '/accounts/journal' },
      { title: 'Trial Balance', path: '/accounts/trial-balance' },
      { title: 'Financial Statements', path: '/accounts/financial-statements' },
      { title: 'VAT Return', path: '/accounts/vat-return' },
      { title: 'Bank Reconciliation', path: '/accounts/bank-reconciliation' },
      { title: 'Recurring Journals', path: '/accounts/recurring-journals' },
      { title: 'Accounting Periods', path: '/accounts/periods' },
      { title: 'Expenses', path: '/accounts/expenses' },
      { title: 'Fixed Assets', path: '/accounts/fixed-assets' },
      { title: 'Accounting Reports', path: '/accounts/reports' },
      { title: 'Ledgers', path: '/accounts/ledgers' },
      { title: 'Receipts', path: '/accounts/receipts' },
      { title: 'Payments', path: '/accounts/payments' },
    ],
  },
  { title: 'Credit Control', path: '/credit-control', icon: <CreditScore /> },
  {
    title: 'Reports', icon: <Assessment />,
    children: [
      { title: 'Customer Statement', path: '/reports/customer-statement' },
      { title: 'Customer Payments', path: '/reports/customer-payments' },
      { title: 'Sales Report', path: '/reports/sales' },
    ],
  },
  {
    title: 'Settings', icon: <Settings />,
    children: [
      { title: 'Company Settings', path: '/settings/company' },
      { title: 'Startup Capital Setup', path: '/settings/startup-setup' },
      { title: 'Document Templates', path: '/settings/templates' },
      { title: 'Document Notes', path: '/settings/notes' },
      { title: 'Terms & Conditions', path: '/settings/terms' },
      { title: 'Audit Trail', path: '/settings/audit-trail' },
    ],
  },
  { title: 'Notifications', path: '/notifications', icon: <Notifications /> },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Inventory: true, Sales: true, Purchase: true, Accounts: true, Reports: true, Settings: true });

  const handleNav = (path: string) => {
    navigate(path);
    if (isMobile) onClose();
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, textAlign: 'center', bgcolor: brandColors.darkGreen }}>
        <img src="/default-logo.png" alt="Logo" style={{ maxWidth: 140, maxHeight: 60, marginBottom: 4 }} />
        <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>{APP_NAME}</Typography>
        <Typography variant="caption" sx={{ color: brandColors.goldenTan }}>Version {APP_VERSION}</Typography>
      </Box>
      <List sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        {navItems.map((item) => (
          <Box key={item.title}>
            {item.children ? (
              <>
                <ListItemButton onClick={() => setExpanded((e) => ({ ...e, [item.title]: !e[item.title] }))}>
                  <ListItemIcon sx={{ color: brandColors.darkGreen, minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.title} primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
                  {expanded[item.title] ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse in={expanded[item.title]}>
                  <List component="div" disablePadding>
                    {item.children.map((child) => (
                      <ListItemButton
                        key={child.path}
                        sx={{ pl: 4, bgcolor: location.pathname === child.path ? brandColors.lightGreen : 'transparent' }}
                        onClick={() => handleNav(child.path)}
                      >
                        <ListItemText primary={child.title} primaryTypographyProps={{ fontSize: 13 }} />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </>
            ) : (
              <ListItemButton
                sx={{ bgcolor: location.pathname === item.path ? brandColors.lightGreen : 'transparent' }}
                onClick={() => item.path && handleNav(item.path)}
              >
                <ListItemIcon sx={{ color: brandColors.darkGreen, minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.title} primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
              </ListItemButton>
            )}
          </Box>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">{APP_NAME} v{APP_VERSION}</Typography>
      </Box>
    </Box>
  );

  return isMobile ? (
    <Drawer variant="temporary" open={open} onClose={onClose} ModalProps={{ keepMounted: true }}
      sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}>{drawer}</Drawer>
  ) : (
    <Drawer variant="permanent" sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}>
      {drawer}
    </Drawer>
  );
}

export { DRAWER_WIDTH };
