import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
export default function Sidebar() {
    return (_jsxs("div", { style: {
            width: "220px",
            background: "#1f2937",
            color: "white",
            height: "100vh",
            padding: "20px"
        }, children: [_jsx("h3", { children: "Accounting" }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "10px" }, children: [_jsx(Link, { to: "/dashboard", children: "Dashboard" }), _jsx(Link, { to: "/expenses", children: "Expenses" }), _jsx(Link, { to: "/vendors", children: "Vendors" }), _jsx(Link, { to: "/categories", children: "Categories" }), _jsx(Link, { to: "/chart-of-accounts", children: "Chart of Accounts" }), _jsx(Link, { to: "/journal-entries", children: "Journal Entries" }), _jsx(Link, { to: "/general-ledger", children: "General Ledger" }), _jsx(Link, { to: "/export", children: "Export" })] })] }));
}
