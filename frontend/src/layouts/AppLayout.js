import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route, Navigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useUserContext } from "../contexts/UserContext";
import Sidebar from "../components/Sidebar";
import Dashboard from "../pages/Dashboard";
import CreateRequestPage from "../pages/CreateRequestPage";
import RequestDetailPage from "../pages/RequestDetailPage";
import ExpenseReportPage from "../pages/ExpenseReportPage";
import AdminPage from "../pages/AdminPage";
import VendorPage from "../pages/VendorPage";
import Expenses from "../pages/Expenses";
import Categories from "../pages/Categories";
import ChartOfAccounts from "../pages/ChartOfAccounts";
import JournalEntries from "../pages/JournalEntries";
import GeneralLedger from "../pages/GeneralLedger";
import Export from "../pages/Export";
export default function AppLayout() {
    const { loading, error, profile } = useUserContext();
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center h-screen", children: _jsx("span", { className: "loading loading-spinner loading-lg" }) }));
    }
    if (error || !profile) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center h-screen gap-4", children: [_jsx("p", { className: "text-error text-base", children: error || "Profile not found." }), _jsx("button", { onClick: () => signOut(auth), className: "btn btn-neutral btn-sm", children: "Sign Out" })] }));
    }
    return (_jsxs("div", { className: "flex h-screen font-sans", children: [_jsx(Sidebar, {}), _jsx("main", { className: "flex-1 overflow-y-auto bg-base-200", children: _jsxs(Routes, { children: [_jsx(Route, { index: true, element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "dashboard", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "requests/new", element: _jsx(CreateRequestPage, {}) }), _jsx(Route, { path: "requests/:id/edit", element: _jsx(CreateRequestPage, {}) }), _jsx(Route, { path: "requests/:id/expense", element: _jsx(ExpenseReportPage, {}) }), _jsx(Route, { path: "requests/:id", element: _jsx(RequestDetailPage, {}) }), _jsx(Route, { path: "requests", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "admin", element: _jsx(AdminPage, {}) }), _jsx(Route, { path: "vendors", element: _jsx(VendorPage, {}) }), _jsx(Route, { path: "expenses", element: _jsx(Expenses, {}) }), _jsx(Route, { path: "categories", element: _jsx(Categories, {}) }), _jsx(Route, { path: "chart-of-accounts", element: _jsx(ChartOfAccounts, {}) }), _jsx(Route, { path: "journal-entries", element: _jsx(JournalEntries, {}) }), _jsx(Route, { path: "general-ledger", element: _jsx(GeneralLedger, {}) }), _jsx(Route, { path: "export", element: _jsx(Export, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) })] }));
}
