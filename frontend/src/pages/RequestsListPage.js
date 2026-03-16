import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { useUserContext } from "../contexts/UserContext";
import { StatusBadge } from "./Dashboard";
const ALL_STATUSES = [
    { value: "DRAFT", label: "Draft" },
    { value: "AWAITING_PREAPPROVAL", label: "Awaiting Approval" },
    { value: "REQUEST_REVISIONS_NEEDED", label: "Revisions Needed" },
    { value: "APPROVE", label: "Pre-Approved" },
    { value: "EXPENSE_DRAFT", label: "Expense Draft" },
    { value: "AWAITING_FINANCE_REVIEW", label: "Finance Review" },
    { value: "EXPENSE_APPROVE", label: "Expense Approved" },
    { value: "MARK_PAY", label: "Paid" },
    { value: "REJECT", label: "Rejected" },
];
export default function RequestsListPage() {
    const { profile, activeOrgId } = useUserContext();
    const [searchParams, setSearchParams] = useSearchParams();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const statusFilter = searchParams.get("status") || "";
    const mineOnly = searchParams.get("mine") === "true";
    useEffect(() => {
        if (!profile || !activeOrgId)
            return;
        setLoading(true);
        setError("");
        const constraints = [
            where("tenantId", "==", profile.tenantId),
            where("organizationId", "==", activeOrgId),
            orderBy("createdAt", "desc"),
        ];
        if (statusFilter)
            constraints.push(where("status", "==", statusFilter));
        if (mineOnly)
            constraints.push(where("requestorId", "==", profile.uid));
        getDocs(query(collection(db, "purchaseRequests"), ...constraints))
            .then((snap) => setRows(snap.docs.map((d) => ({
            id: d.id,
            purpose: String(d.data().purpose || ""),
            status: String(d.data().status || ""),
            estimatedAmount: Number(d.data().estimatedAmount || 0),
            ministryDepartment: String(d.data().ministryDepartment || ""),
            fundId: String(d.data().fundId || ""),
            requestorId: String(d.data().requestorId || ""),
        }))))
            .catch(() => setError("Failed to load requests."))
            .finally(() => setLoading(false));
    }, [profile, activeOrgId, statusFilter, mineOnly]);
    const setFilter = (status) => {
        const next = {};
        if (status)
            next.status = status;
        if (mineOnly)
            next.mine = "true";
        setSearchParams(next);
    };
    const toggleMine = () => {
        const next = {};
        if (statusFilter)
            next.status = statusFilter;
        if (!mineOnly)
            next.mine = "true";
        setSearchParams(next);
    };
    return (_jsxs("div", { style: { padding: 24 }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }, children: [_jsx("h1", { style: { margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }, children: "Purchase Requests" }), _jsx(Link, { to: "/requests/new", style: { padding: "9px 18px", background: "#2563eb", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 13 }, children: "+ New Request" })] }), _jsxs("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }, children: [_jsx(FilterBtn, { active: !statusFilter, onClick: () => setFilter(""), children: "All" }), ALL_STATUSES.map((s) => (_jsx(FilterBtn, { active: statusFilter === s.value, onClick: () => setFilter(s.value), children: s.label }, s.value))), _jsxs("label", { style: { marginLeft: "auto", fontSize: 13, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }, children: [_jsx("input", { type: "checkbox", checked: mineOnly, onChange: toggleMine }), "Mine only"] })] }), loading ? (_jsx("div", { style: { color: "#9ca3af", fontSize: 14 }, children: "Loading..." })) : error ? (_jsx("div", { style: { color: "#dc2626", fontSize: 14 }, children: error })) : rows.length === 0 ? (_jsxs("div", { style: { background: "white", borderRadius: 10, padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }, children: ["No requests found.", " ", _jsx(Link, { to: "/requests/new", style: { color: "#2563eb" }, children: "Create one \u2192" })] })) : (_jsx("div", { style: { background: "white", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }, children: _jsxs("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [_jsx("thead", { children: _jsx("tr", { children: ["Purpose", "Fund / Dept", "Amount", "Status", ""].map((h) => (_jsx("th", { style: { textAlign: "left", fontSize: 11, color: "#9ca3af", fontWeight: 600, padding: "10px 16px", borderBottom: "1px solid #f3f4f6", textTransform: "uppercase", letterSpacing: "0.05em" }, children: h }, h))) }) }), _jsx("tbody", { children: rows.map((r) => (_jsxs("tr", { style: { borderBottom: "1px solid #f9fafb" }, children: [_jsx("td", { style: { padding: "13px 16px", fontSize: 14, color: "#111827", fontWeight: 500 }, children: r.purpose || "(no purpose)" }), _jsxs("td", { style: { padding: "13px 16px" }, children: [_jsx("div", { style: { fontSize: 13, color: "#374151" }, children: r.fundId }), _jsx("div", { style: { fontSize: 11, color: "#9ca3af", marginTop: 2 }, children: r.ministryDepartment })] }), _jsxs("td", { style: { padding: "13px 16px", fontSize: 14, color: "#374151", whiteSpace: "nowrap" }, children: ["$", r.estimatedAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })] }), _jsx("td", { style: { padding: "13px 16px" }, children: _jsx(StatusBadge, { status: r.status }) }), _jsx("td", { style: { padding: "13px 16px", textAlign: "right" }, children: _jsx(Link, { to: `/requests/${r.id}`, style: { fontSize: 12, color: "#2563eb", textDecoration: "none", fontWeight: 500 }, children: "View \u2192" }) })] }, r.id))) })] }) }))] }));
}
function FilterBtn({ active, onClick, children }) {
    return (_jsx("button", { onClick: onClick, style: {
            padding: "5px 12px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: active ? "#1e293b" : "white",
            color: active ? "white" : "#374151",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: active ? 600 : 400,
        }, children: children }));
}
