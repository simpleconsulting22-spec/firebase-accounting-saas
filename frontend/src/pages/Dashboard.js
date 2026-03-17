import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUserContext } from "../contexts/UserContext";
import { api } from "../workflow/api";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "../workflow/constants";
const fmtCurrency = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const fmtDate = (val) => {
    if (!val)
        return "—";
    if (typeof val === "object" && val.seconds) {
        return new Date(val.seconds * 1000).toLocaleDateString('en-US');
    }
    try {
        return new Date(val).toLocaleDateString('en-US');
    }
    catch {
        return String(val);
    }
};
export function StatusBadge({ status }) {
    const label = STATUS_LABELS[status] || status;
    const cls = STATUS_BADGE_CLASS[status] || 'badge-ghost';
    return _jsx("span", { className: `badge ${cls} badge-sm`, children: label });
}
function RequestsTable({ requests, emptyMsg }) {
    if (requests.length === 0) {
        return _jsx("div", { className: "py-10 text-center text-base-content/50 text-sm", children: emptyMsg });
    }
    return (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "table table-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "ID" }), _jsx("th", { children: "Dept" }), _jsx("th", { children: "Vendor" }), _jsx("th", { children: "Amount" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Date" }), _jsx("th", {})] }) }), _jsx("tbody", { children: requests.map((r) => (_jsxs("tr", { className: "hover", children: [_jsxs("td", { className: "font-mono text-xs text-base-content/60", children: [r.id.slice(0, 8), "\u2026"] }), _jsx("td", { className: "text-sm", children: r.ministryDepartment || "—" }), _jsx("td", { className: "text-sm", children: r.vendorName || "—" }), _jsx("td", { className: "text-sm font-medium", children: fmtCurrency(r.estimatedAmount || 0) }), _jsx("td", { children: _jsx(StatusBadge, { status: r.status }) }), _jsx("td", { className: "text-xs text-base-content/60", children: fmtDate(r.createdAt) }), _jsx("td", { children: _jsx(Link, { to: `/requests/${r.id}`, className: "btn btn-xs btn-outline", children: "View" }) })] }, r.id))) })] }) }));
}
function SkeletonTable() {
    return (_jsx("div", { className: "space-y-2 p-4", children: [1, 2, 3].map(i => (_jsx("div", { className: "skeleton h-8 w-full rounded" }, i))) }));
}
export default function Dashboard() {
    const { profile, activeOrgId, activeOrgName, isAdmin, canApprove, isFinancePayor, isReceiptsReviewer, isQBEntry } = useUserContext();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [tab, setTab] = useState("my");
    const load = useCallback(async () => {
        if (!profile || !activeOrgId)
            return;
        setLoading(true);
        setError("");
        try {
            const result = await api.getMyDashboards({ orgId: activeOrgId });
            setData(result);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load dashboard.");
        }
        finally {
            setLoading(false);
        }
    }, [profile, activeOrgId]);
    useEffect(() => { load(); }, [load]);
    const showApprovals = isAdmin || canApprove;
    const showFinance = isAdmin || isFinancePayor || isReceiptsReviewer || isQBEntry;
    const financeQueue = (() => {
        if (!data)
            return [];
        const queue = data.financeQueue || [];
        if (isAdmin)
            return queue;
        const allowed = [];
        if (isReceiptsReviewer)
            allowed.push("SUBMITTED_RECEIPT_REVIEW", "EXCEEDS_APPROVED_AMOUNT");
        if (isFinancePayor)
            allowed.push("FINAL_APPROVED");
        if (isQBEntry)
            allowed.push("PAID", "QB_SENT");
        return queue.filter(r => allowed.includes(r.status));
    })();
    return (_jsxs("div", { className: "p-6 max-w-6xl mx-auto", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Dashboard" }), _jsx("p", { className: "text-sm text-base-content/60 mt-1", children: activeOrgName })] }), _jsx(Link, { to: "/requests/new", className: "btn btn-primary btn-sm", children: "+ New Request" })] }), error && (_jsx("div", { className: "alert alert-error mb-4", children: _jsx("span", { children: error }) })), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 mb-6", children: [_jsxs("div", { className: "stat bg-base-100 rounded-box shadow", children: [_jsx("div", { className: "stat-title text-xs", children: "My Requests" }), _jsx("div", { className: "stat-value text-2xl", children: loading ? "—" : (data?.myRequests?.length ?? 0) })] }), showApprovals && (_jsxs("div", { className: "stat bg-base-100 rounded-box shadow", children: [_jsx("div", { className: "stat-title text-xs", children: "Pending Approvals" }), _jsx("div", { className: "stat-value text-2xl text-warning", children: loading ? "—" : (data?.pendingApprovals?.length ?? 0) })] })), showFinance && (_jsxs("div", { className: "stat bg-base-100 rounded-box shadow", children: [_jsx("div", { className: "stat-title text-xs", children: "Finance Queue" }), _jsx("div", { className: "stat-value text-2xl text-info", children: loading ? "—" : financeQueue.length })] }))] }), _jsxs("div", { className: "tabs tabs-boxed mb-4", children: [_jsx("button", { className: `tab ${tab === "my" ? "tab-active" : ""}`, onClick: () => setTab("my"), children: "My Requests" }), showApprovals && (_jsxs("button", { className: `tab ${tab === "approvals" ? "tab-active" : ""}`, onClick: () => setTab("approvals"), children: ["Pending Approvals", (data?.pendingApprovals?.length ?? 0) > 0 && (_jsx("span", { className: "badge badge-warning badge-xs ml-2", children: data.pendingApprovals.length }))] })), showFinance && (_jsxs("button", { className: `tab ${tab === "finance" ? "tab-active" : ""}`, onClick: () => setTab("finance"), children: ["Finance Queue", financeQueue.length > 0 && (_jsx("span", { className: "badge badge-info badge-xs ml-2", children: financeQueue.length }))] }))] }), _jsx("div", { className: "card bg-base-100 shadow", children: _jsx("div", { className: "card-body p-0", children: loading ? (_jsx(SkeletonTable, {})) : (_jsxs(_Fragment, { children: [tab === "my" && (_jsx(RequestsTable, { requests: data?.myRequests ?? [], emptyMsg: "No requests yet. Create your first request!" })), tab === "approvals" && showApprovals && (_jsx("div", { className: "overflow-x-auto", children: (data?.pendingApprovals ?? []).length === 0 ? (_jsx("div", { className: "py-10 text-center text-base-content/50 text-sm", children: "No pending approvals." })) : (_jsxs("table", { className: "table table-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "ID" }), _jsx("th", { children: "Requestor" }), _jsx("th", { children: "Dept" }), _jsx("th", { children: "Vendor" }), _jsx("th", { children: "Amount" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Date" }), _jsx("th", {})] }) }), _jsx("tbody", { children: (data?.pendingApprovals ?? []).map((r) => (_jsxs("tr", { className: "hover", children: [_jsxs("td", { className: "font-mono text-xs text-base-content/60", children: [r.id.slice(0, 8), "\u2026"] }), _jsx("td", { className: "text-sm", children: r.requestorName || r.requestorEmail || "—" }), _jsx("td", { className: "text-sm", children: r.ministryDepartment || "—" }), _jsx("td", { className: "text-sm", children: r.vendorName || "—" }), _jsx("td", { className: "text-sm font-medium", children: fmtCurrency(r.estimatedAmount || 0) }), _jsx("td", { children: _jsx(StatusBadge, { status: r.status }) }), _jsx("td", { className: "text-xs text-base-content/60", children: fmtDate(r.createdAt) }), _jsx("td", { children: r.preApprovalToken ? (_jsx(Link, { to: `/review?token=${r.preApprovalToken}`, className: "btn btn-xs btn-warning", children: "Review" })) : (_jsx(Link, { to: `/requests/${r.id}`, className: "btn btn-xs btn-outline", children: "View" })) })] }, r.id))) })] })) })), tab === "finance" && showFinance && (_jsx("div", { className: "overflow-x-auto", children: financeQueue.length === 0 ? (_jsx("div", { className: "py-10 text-center text-base-content/50 text-sm", children: "Finance queue is empty." })) : (_jsxs("table", { className: "table table-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "ID" }), _jsx("th", { children: "Requestor" }), _jsx("th", { children: "Vendor" }), _jsx("th", { children: "Amount" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Dept" }), _jsx("th", { children: "Date" }), _jsx("th", {})] }) }), _jsx("tbody", { children: financeQueue.map((r) => (_jsxs("tr", { className: "hover", children: [_jsxs("td", { className: "font-mono text-xs text-base-content/60", children: [r.id.slice(0, 8), "\u2026"] }), _jsx("td", { className: "text-sm", children: r.requestorName || r.requestorEmail || "—" }), _jsx("td", { className: "text-sm", children: r.vendorName || "—" }), _jsx("td", { className: "text-sm font-medium", children: fmtCurrency(r.actualAmount || r.estimatedAmount || 0) }), _jsx("td", { children: _jsx(StatusBadge, { status: r.status }) }), _jsx("td", { className: "text-sm", children: r.ministryDepartment || "—" }), _jsx("td", { className: "text-xs text-base-content/60", children: fmtDate(r.createdAt) }), _jsx("td", { children: _jsx(Link, { to: `/requests/${r.id}`, className: "btn btn-xs btn-outline", children: "View" }) })] }, r.id))) })] })) }))] })) }) })] }));
}
