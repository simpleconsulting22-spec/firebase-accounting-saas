import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route, Navigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useUserContext } from "../contexts/UserContext";
import Sidebar from "../components/Sidebar";
import Dashboard from "../pages/Dashboard";
import RequestsListPage from "../pages/RequestsListPage";
import CreateRequestPage from "../pages/CreateRequestPage";
import RequestDetailPage from "../pages/RequestDetailPage";
import Expenses from "../pages/Expenses";
import Vendors from "../pages/Vendors";
import Categories from "../pages/Categories";
import ChartOfAccounts from "../pages/ChartOfAccounts";
import JournalEntries from "../pages/JournalEntries";
import GeneralLedger from "../pages/GeneralLedger";
import Export from "../pages/Export";
export default function AppLayout() {
    const { loading, error, profile } = useUserContext();
    if (loading) {
        return (_jsx("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif" }, children: "Loading profile..." }));
    }
    if (error || !profile) {
        return (_jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 16, fontFamily: "sans-serif" }, children: [_jsx("p", { style: { color: "#dc2626", fontSize: 16 }, children: error || "Profile not found." }), _jsx("button", { onClick: () => signOut(auth), style: { padding: "8px 20px", background: "#374151", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }, children: "Sign Out" })] }));
    }
    return (_jsxs("div", { style: { display: "flex", height: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }, children: [_jsx(Sidebar, {}), _jsx("main", { style: { flex: 1, overflowY: "auto", background: "#f9fafb" }, children: _jsxs(Routes, { children: [_jsx(Route, { index: true, element: _jsx(Navigate, { to: "/dashboard", replace: true }) }), _jsx(Route, { path: "dashboard", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "requests", element: _jsx(RequestsListPage, {}) }), _jsx(Route, { path: "requests/new", element: _jsx(CreateRequestPage, {}) }), _jsx(Route, { path: "requests/:id", element: _jsx(RequestDetailPage, {}) }), _jsx(Route, { path: "expenses", element: _jsx(Expenses, {}) }), _jsx(Route, { path: "vendors", element: _jsx(Vendors, {}) }), _jsx(Route, { path: "categories", element: _jsx(Categories, {}) }), _jsx(Route, { path: "chart-of-accounts", element: _jsx(ChartOfAccounts, {}) }), _jsx(Route, { path: "journal-entries", element: _jsx(JournalEntries, {}) }), _jsx(Route, { path: "general-ledger", element: _jsx(GeneralLedger, {}) }), _jsx(Route, { path: "export", element: _jsx(Export, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/dashboard", replace: true }) })] }) })] }));
}
