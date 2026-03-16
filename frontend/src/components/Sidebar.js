import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useUserContext } from "../contexts/UserContext";
const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: "📊" },
    { path: "/requests", label: "Purchase Requests", icon: "📋" },
    { path: "/requests/new", label: "New Request", icon: "➕" },
    { divider: true },
    { path: "/expenses", label: "Expenses", icon: "💰" },
    { path: "/vendors", label: "Vendors", icon: "🏪" },
    { path: "/categories", label: "Categories", icon: "🏷️" },
    { divider: true },
    { path: "/chart-of-accounts", label: "Chart of Accounts", icon: "📑" },
    { path: "/journal-entries", label: "Journal Entries", icon: "📒" },
    { path: "/general-ledger", label: "General Ledger", icon: "📚" },
    { path: "/export", label: "Export", icon: "📤" },
];
export default function Sidebar() {
    const location = useLocation();
    const { profile, activeOrgId, setActiveOrgId } = useUserContext();
    const isActive = (path) => {
        if (path === "/requests/new")
            return location.pathname === "/requests/new";
        if (path === "/requests")
            return location.pathname.startsWith("/requests") && location.pathname !== "/requests/new";
        return location.pathname === path || location.pathname.startsWith(path + "/");
    };
    return (_jsxs("div", { style: { width: 220, background: "#1e293b", color: "white", display: "flex", flexDirection: "column", height: "100vh", flexShrink: 0, overflow: "hidden" }, children: [_jsxs("div", { style: { padding: "20px 16px 16px", borderBottom: "1px solid #334155" }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.01em" }, children: "Expense Workflow" }), profile && (_jsx("div", { style: { fontSize: 11, color: "#64748b", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: profile.email }))] }), profile && profile.orgIds.length > 1 && (_jsx("div", { style: { padding: "10px 12px", borderBottom: "1px solid #334155" }, children: _jsx("select", { value: activeOrgId, onChange: (e) => setActiveOrgId(e.target.value), style: { width: "100%", background: "#334155", color: "#e2e8f0", border: "none", borderRadius: 6, padding: "6px 8px", fontSize: 12, cursor: "pointer" }, children: profile.orgIds.map((id) => (_jsx("option", { value: id, children: id }, id))) }) })), _jsx("nav", { style: { flex: 1, padding: "10px 8px", overflowY: "auto" }, children: navItems.map((item, i) => {
                    if ("divider" in item) {
                        return _jsx("div", { style: { height: 1, background: "#334155", margin: "8px 8px" } }, i);
                    }
                    const active = isActive(item.path);
                    return (_jsxs(Link, { to: item.path, style: {
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "7px 10px",
                            marginBottom: 2,
                            borderRadius: 6,
                            color: active ? "#f8fafc" : "#94a3b8",
                            background: active ? "#334155" : "transparent",
                            textDecoration: "none",
                            fontSize: 13,
                            fontWeight: active ? 600 : 400,
                            transition: "background 0.1s, color 0.1s",
                        }, children: [_jsx("span", { style: { fontSize: 14 }, children: item.icon }), item.label] }, item.path));
                }) }), _jsxs("div", { style: { padding: "12px", borderTop: "1px solid #334155" }, children: [profile && (_jsx("div", { style: { fontSize: 11, color: "#475569", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: activeOrgId })), _jsx("button", { onClick: () => signOut(auth), style: { width: "100%", padding: "8px", background: "#334155", color: "#94a3b8", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 500 }, children: "Sign Out" })] })] }));
}
