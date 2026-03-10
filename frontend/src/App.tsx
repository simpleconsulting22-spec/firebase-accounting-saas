import { AppLayout } from "./layouts/AppLayout";
import ExpensesModule from "./modules/expenses";
import AccountingExportsModule from "./modules/accountingExports";
import VendorsModule from "./modules/vendors";
import BudgetsModule from "./modules/budgets";
import GeneralLedgerModule from "./modules/generalLedger";
import FixedAssetsModule from "./modules/fixedAssets";
import ReportsModule from "./modules/reports";

export default function App() {
  return (
    <AppLayout>
      <h1>Accounting SaaS - Phase 6 General Ledger Foundation</h1>

      <ExpensesModule />
      <AccountingExportsModule />
      <VendorsModule />
      <BudgetsModule />
      <GeneralLedgerModule />
      <FixedAssetsModule />
      <ReportsModule />

    </AppLayout>
  );
}
