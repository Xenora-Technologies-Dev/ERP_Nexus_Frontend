import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/customers/CustomersPage';
import VendorsPage from './pages/vendors/VendorsPage';
import InventoryPage from './pages/inventory/InventoryPage';
import InventoryMovementsPage from './pages/inventory/InventoryMovementsPage';
import QuotationsPage from './pages/sales/QuotationsPage';
import SalesOrdersPage from './pages/sales/SalesOrdersPage';
import DeliveryNotesPage from './pages/sales/DeliveryNotesPage';
import SalesInvoicesPage from './pages/sales/SalesInvoicesPage';
import SalesReturnsPage from './pages/sales/SalesReturnsPage';
import CreditNotesPage from './pages/sales/CreditNotesPage';
import SalesReceiptsPage from './pages/sales/ReceiptsPage';
import RFQsPage from './pages/purchase/RFQsPage';
import PurchaseOrdersPage from './pages/purchase/PurchaseOrdersPage';
import GRNsPage from './pages/purchase/GRNsPage';
import PurchaseInvoicesPage from './pages/purchase/PurchaseInvoicesPage';
import PurchaseReturnsPage from './pages/purchase/PurchaseReturnsPage';
import DebitNotesPage from './pages/purchase/DebitNotesPage';
import PurchasePaymentsPage from './pages/purchase/PaymentsPage';
import ChartOfAccountsPage from './pages/accounts/ChartOfAccountsPage';
import JournalPage from './pages/accounts/JournalPage';
import TrialBalancePage from './pages/accounts/TrialBalancePage';
import AccountsReceiptsPage from './pages/accounts/ReceiptsPage';
import AccountsPaymentsPage from './pages/accounts/PaymentsPage';
import ExpensesPage from './pages/accounts/ExpensesPage';
import LedgersPage from './pages/accounts/LedgersPage';
import FinancialStatements from './pages/accounts/FinancialStatements';
import AccountingPeriodsPage from './pages/accounts/AccountingPeriodsPage';
import BankReconciliationPage from './pages/accounts/BankReconciliationPage';
import VatReturnPage from './pages/accounts/VatReturnPage';
import RecurringJournalsPage from './pages/accounts/RecurringJournalsPage';
import AccountLedgerPage from './pages/accounts/AccountLedgerPage';
import AccountReportsPage from './pages/accounts/AccountReportsPage';
import FixedAssetsPage from './pages/accounts/FixedAssetsPage';
import StartupCapitalSetupPage from './pages/settings/StartupCapitalSetupPage';
import AuditTrailPage from './pages/settings/AuditTrailPage';
import CreditControlPage from './pages/credit-control/CreditControlPage';
import CompanySettingsPage from './pages/settings/CompanySettingsPage';
import DocumentTemplatesPage from './pages/settings/DocumentTemplatesPage';
import DocumentNotesPage from './pages/settings/DocumentNotesPage';
import TermsPage from './pages/settings/TermsPage';
import NotificationsPage from './pages/notifications/NotificationsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inventory/movements" element={<InventoryMovementsPage />} />
        <Route path="sales/quotations" element={<QuotationsPage />} />
        <Route path="sales/orders" element={<SalesOrdersPage />} />
        <Route path="sales/delivery-notes" element={<DeliveryNotesPage />} />
        <Route path="sales/invoices" element={<SalesInvoicesPage />} />
        <Route path="sales/returns" element={<SalesReturnsPage />} />
        <Route path="sales/credit-notes" element={<CreditNotesPage />} />
        <Route path="sales/receipts" element={<SalesReceiptsPage />} />
        <Route path="purchase/rfqs" element={<RFQsPage />} />
        <Route path="purchase/orders" element={<PurchaseOrdersPage />} />
        <Route path="purchase/grns" element={<GRNsPage />} />
        <Route path="purchase/invoices" element={<PurchaseInvoicesPage />} />
        <Route path="purchase/returns" element={<PurchaseReturnsPage />} />
        <Route path="purchase/debit-notes" element={<DebitNotesPage />} />
        <Route path="purchase/payments" element={<PurchasePaymentsPage />} />
        <Route path="accounts/chart" element={<ChartOfAccountsPage />} />
        <Route path="accounts/journal" element={<JournalPage />} />
        <Route path="accounts/trial-balance" element={<TrialBalancePage />} />
        <Route path="accounts/financial-statements" element={<FinancialStatements />} />
        <Route path="accounts/periods" element={<AccountingPeriodsPage />} />
        <Route path="accounts/bank-reconciliation" element={<BankReconciliationPage />} />
        <Route path="accounts/vat-return" element={<VatReturnPage />} />
        <Route path="accounts/recurring-journals" element={<RecurringJournalsPage />} />
        <Route path="accounts/ledger/:accountId" element={<AccountLedgerPage />} />
        <Route path="accounts/receipts" element={<AccountsReceiptsPage />} />
        <Route path="accounts/payments" element={<AccountsPaymentsPage />} />
        <Route path="accounts/expenses" element={<ExpensesPage />} />
        <Route path="accounts/fixed-assets" element={<FixedAssetsPage />} />
        <Route path="accounts/reports" element={<AccountReportsPage />} />
        <Route path="accounts/ledgers" element={<LedgersPage />} />
        <Route path="credit-control" element={<CreditControlPage />} />
        <Route path="settings/company" element={<CompanySettingsPage />} />
        <Route path="settings/templates" element={<DocumentTemplatesPage />} />
        <Route path="settings/notes" element={<DocumentNotesPage />} />
        <Route path="settings/terms" element={<TermsPage />} />
        <Route path="settings/startup-setup" element={<StartupCapitalSetupPage />} />
        <Route path="settings/audit-trail" element={<AuditTrailPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
