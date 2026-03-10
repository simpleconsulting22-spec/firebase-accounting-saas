import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AppLayout } from "./layouts/AppLayout";
import ExpensesModule from "./modules/expenses";
import AccountingExportsModule from "./modules/accountingExports";
import VendorsModule from "./modules/vendors";
import BudgetsModule from "./modules/budgets";
import GeneralLedgerModule from "./modules/generalLedger";
import FixedAssetsModule from "./modules/fixedAssets";
import ReportsModule from "./modules/reports";
export default function App() {
    return (_jsxs(AppLayout, { children: [_jsx("h1", { children: "Accounting SaaS - Phase 6 General Ledger Foundation" }), _jsx(ExpensesModule, {}), _jsx(AccountingExportsModule, {}), _jsx(VendorsModule, {}), _jsx(BudgetsModule, {}), _jsx(GeneralLedgerModule, {}), _jsx(FixedAssetsModule, {}), _jsx(ReportsModule, {})] }));
}
