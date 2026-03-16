import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs, orderBy, } from "firebase/firestore";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "../firebase";
import { expensesApi } from "../modules/expenses/services";
import { useUserContext } from "../contexts/UserContext";
import { StatusBadge } from "./Dashboard";
// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (val) => {
    if (!val)
        return "—";
    // Firestore Timestamp arrives as { seconds, nanoseconds }
    if (typeof val === "object" && "seconds" in val) {
        return new Date(val.seconds * 1000).toLocaleDateString();
    }
    return String(val);
};
const fmtMoney = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const row = (label, value) => (_jsxs("tr", { children: [_jsx("td", { style: { padding: "8px 0", fontSize: 12, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", width: 160, verticalAlign: "top" }, children: label }), _jsx("td", { style: { padding: "8px 0 8px 16px", fontSize: 14, color: "#111827" }, children: value })] }, label));
// ─── Main Component ───────────────────────────────────────────────────────────
export default function RequestDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { profile, activeOrgId, canApprove, canRequestExpense, canFinanceReview } = useUserContext();
    const [request, setRequest] = useState(null);
    const [expenseReport, setExpenseReport] = useState(null);
    const [lineItems, setLineItems] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionBusy, setActionBusy] = useState(false);
    const [actionError, setActionError] = useState("");
    const [actionSuccess, setActionSuccess] = useState("");
    // Line item form state
    const [showLineItemForm, setShowLineItemForm] = useState(false);
    const [liVendorId, setLiVendorId] = useState("");
    const [liCategoryId, setLiCategoryId] = useState("");
    const [liAmount, setLiAmount] = useState("");
    const [liDate, setLiDate] = useState("");
    const [liDescription, setLiDescription] = useState("");
    const [liBusy, setLiBusy] = useState(false);
    const [liError, setLiError] = useState("");
    // Approval action state
    const [prAction, setPrAction] = useState("APPROVE");
    const [erAction, setErAction] = useState("APPROVE");
    const [comments, setComments] = useState("");
    const load = useCallback(async () => {
        if (!id || !profile || !activeOrgId)
            return;
        setLoading(true);
        try {
            const snap = await getDoc(doc(db, "purchaseRequests", id));
            if (!snap.exists()) {
                navigate("/requests");
                return;
            }
            const d = snap.data();
            setRequest({
                id: snap.id,
                purpose: String(d.purpose || ""),
                description: String(d.description || ""),
                status: String(d.status || ""),
                estimatedAmount: Number(d.estimatedAmount || 0),
                approvedAmount: Number(d.approvedAmount || 0),
                actualAmount: Number(d.actualAmount || 0),
                fundId: String(d.fundId || ""),
                ministryDepartment: String(d.ministryDepartment || ""),
                requestorId: String(d.requestorId || ""),
                approverId: String(d.approverId || ""),
                plannedPaymentMethod: String(d.plannedPaymentMethod || ""),
                requestedExpenseDate: fmtDate(d.requestedExpenseDate),
                createdAt: fmtDate(d.createdAt),
                updatedAt: fmtDate(d.updatedAt),
            });
            const base = [
                where("tenantId", "==", profile.tenantId),
                where("organizationId", "==", activeOrgId),
                where("requestId", "==", id),
            ];
            const [erSnap, liSnap, appSnap] = await Promise.all([
                getDocs(query(collection(db, "expenseReports"), ...base, orderBy("createdAt", "desc"))),
                getDocs(query(collection(db, "expenseLineItems"), ...base, orderBy("expenseDate", "asc"))),
                getDocs(query(collection(db, "approvals"), ...base, orderBy("createdAt", "asc"))),
            ]);
            setExpenseReport(erSnap.empty ? null : {
                id: erSnap.docs[0].id,
                status: String(erSnap.docs[0].data().status || ""),
            });
            setLineItems(liSnap.docs.map((x) => ({
                id: x.id,
                vendorId: String(x.data().vendorId || ""),
                categoryId: String(x.data().categoryId || ""),
                amount: Number(x.data().amount || 0),
                expenseDate: fmtDate(x.data().expenseDate),
                description: String(x.data().description || ""),
            })));
            setApprovals(appSnap.docs.map((x) => ({
                id: x.id,
                step: String(x.data().step || ""),
                decision: String(x.data().decision || ""),
                approvedBy: String(x.data().approvedBy || ""),
                comments: String(x.data().comments || ""),
                createdAt: fmtDate(x.data().createdAt),
            })));
        }
        catch (err) {
            console.error(err);
        }
        finally {
            setLoading(false);
        }
    }, [id, profile, activeOrgId, navigate]);
    useEffect(() => { load(); }, [load]);
    const withAction = async (fn) => {
        setActionBusy(true);
        setActionError("");
        setActionSuccess("");
        try {
            await fn();
            await load();
            setActionSuccess("Action completed.");
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : "Action failed.");
        }
        finally {
            setActionBusy(false);
        }
    };
    const doSubmitPR = () => withAction(async () => {
        await expensesApi.submitPurchaseRequest({ tenantId: profile.tenantId, organizationId: activeOrgId, requestId: id });
    });
    const doApprovePR = (e) => {
        e.preventDefault();
        withAction(async () => {
            await expensesApi.applyPurchaseRequestApprovalAction({ tenantId: profile.tenantId, organizationId: activeOrgId, requestId: id, action: prAction, comments });
            setComments("");
        });
    };
    const doCreateExpenseReport = () => withAction(async () => {
        await expensesApi.createExpenseReport({ tenantId: profile.tenantId, organizationId: activeOrgId, requestId: id });
    });
    const doSubmitExpenseReport = () => withAction(async () => {
        if (!expenseReport)
            return;
        await expensesApi.applyExpenseReportApprovalAction({ tenantId: profile.tenantId, organizationId: activeOrgId, requestId: id, reportId: expenseReport.id, action: "SUBMIT" });
    });
    const doERAction = (e) => {
        e.preventDefault();
        withAction(async () => {
            if (!expenseReport)
                return;
            await expensesApi.applyExpenseReportApprovalAction({ tenantId: profile.tenantId, organizationId: activeOrgId, requestId: id, reportId: expenseReport.id, action: erAction, comments });
            setComments("");
        });
    };
    const doAddLineItem = async (e) => {
        e.preventDefault();
        if (!expenseReport)
            return;
        setLiBusy(true);
        setLiError("");
        try {
            await expensesApi.upsertExpenseLineItem({
                tenantId: profile.tenantId,
                organizationId: activeOrgId,
                requestId: id,
                reportId: expenseReport.id,
                vendorId: liVendorId,
                categoryId: liCategoryId,
                amount: parseFloat(liAmount),
                expenseDate: liDate,
                description: liDescription,
            });
            setLiVendorId("");
            setLiCategoryId("");
            setLiAmount("");
            setLiDate("");
            setLiDescription("");
            setShowLineItemForm(false);
            await load();
        }
        catch (err) {
            setLiError(err instanceof Error ? err.message : "Failed to add line item.");
        }
        finally {
            setLiBusy(false);
        }
    };
    if (loading) {
        return _jsx("div", { style: { padding: 24, color: "#9ca3af" }, children: "Loading request..." });
    }
    if (!request) {
        return _jsxs("div", { style: { padding: 24 }, children: ["Request not found. ", _jsx(Link, { to: "/requests", children: "Back" })] });
    }
    const status = request.status;
    const isMyRequest = request.requestorId === profile?.uid;
    const isEditable = (status === "DRAFT" || status === "REQUEST_REVISIONS_NEEDED") && isMyRequest && canRequestExpense;
    const canSubmitPR = isEditable;
    const canDoPRApproval = status === "AWAITING_PREAPPROVAL" && canApprove;
    const canCreateER = status === "APPROVE" && isMyRequest && canRequestExpense;
    const canAddLineItems = status === "EXPENSE_DRAFT" && isMyRequest && canRequestExpense && !!expenseReport;
    const canSubmitER = status === "EXPENSE_DRAFT" && isMyRequest && canRequestExpense && !!expenseReport;
    const canDoERApproval = status === "AWAITING_FINANCE_REVIEW" && canFinanceReview;
    return (_jsxs("div", { style: { padding: 24, maxWidth: 900 }, children: [_jsxs("div", { style: { marginBottom: 20 }, children: [_jsx("button", { onClick: () => navigate("/requests"), style: { background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 10 }, children: "\u2190 Back to Requests" }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 14 }, children: [_jsx("h1", { style: { margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }, children: request.purpose || "(No purpose)" }), _jsx(StatusBadge, { status: status })] }), _jsxs("div", { style: { fontSize: 12, color: "#9ca3af", marginTop: 6 }, children: ["ID: ", id, " \u00B7 Updated ", request.updatedAt] })] }), actionSuccess && _jsx("div", { style: { background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 14, color: "#15803d" }, children: actionSuccess }), actionError && _jsx("div", { style: { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 14, color: "#dc2626" }, children: actionError }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }, children: [_jsxs("div", { style: { background: "white", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", gridColumn: "1 / -1" }, children: [_jsx("h2", { style: { margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }, children: "Request Details" }), _jsx("table", { style: { width: "100%", borderCollapse: "collapse" }, children: _jsxs("tbody", { children: [row("Fund", request.fundId), row("Department", request.ministryDepartment), row("Requestor", request.requestorId), row("Approver", request.approverId), row("Estimated", fmtMoney(request.estimatedAmount)), row("Approved", fmtMoney(request.approvedAmount)), row("Actual", fmtMoney(request.actualAmount)), row("Payment Method", request.plannedPaymentMethod), row("Expense Date", request.requestedExpenseDate), row("Description", request.description || "—"), row("Created", request.createdAt)] }) })] }), canSubmitPR && (_jsxs(ActionCard, { title: "Submit for Approval", children: [_jsx("p", { style: { margin: "0 0 14px", fontSize: 13, color: "#6b7280" }, children: "Submit this draft purchase request to your approver." }), _jsx(ActionBtn, { onClick: doSubmitPR, busy: actionBusy, children: "Submit Request" }), _jsx(SecondaryBtn, { onClick: () => navigate(`/requests/new?edit=${id}`), children: "Edit Draft" })] })), canDoPRApproval && (_jsx(ActionCard, { title: "Purchase Request Approval", children: _jsxs("form", { onSubmit: doApprovePR, style: { display: "flex", flexDirection: "column", gap: 10 }, children: [_jsxs("select", { value: prAction, onChange: (e) => setPrAction(e.target.value), style: selStyle, children: [_jsx("option", { value: "APPROVE", children: "Approve" }), _jsx("option", { value: "REJECT", children: "Reject" }), _jsx("option", { value: "REQUEST_REVISIONS", children: "Request Revisions" })] }), _jsx("textarea", { value: comments, onChange: (e) => setComments(e.target.value), placeholder: "Comments (optional)", style: { ...selStyle, height: 60, resize: "vertical" } }), _jsx(ActionBtn, { busy: actionBusy, children: "Apply" })] }) })), canCreateER && (_jsxs(ActionCard, { title: "Expense Report", children: [_jsx("p", { style: { margin: "0 0 14px", fontSize: 13, color: "#6b7280" }, children: "Your purchase request was approved. Create an expense report to record actual expenses." }), _jsx(ActionBtn, { onClick: doCreateExpenseReport, busy: actionBusy, children: "Create Expense Report" })] })), canSubmitER && expenseReport && (_jsxs(ActionCard, { title: "Submit Expense Report", children: [_jsxs("p", { style: { margin: "0 0 14px", fontSize: 13, color: "#6b7280" }, children: ["Report status: ", _jsx(StatusBadge, { status: expenseReport.status })] }), _jsxs("p", { style: { margin: "0 0 14px", fontSize: 13, color: "#6b7280" }, children: [lineItems.length, " line item(s) \u2014 total: ", fmtMoney(lineItems.reduce((s, i) => s + i.amount, 0))] }), _jsx(ActionBtn, { onClick: doSubmitExpenseReport, busy: actionBusy, children: "Submit for Finance Review" })] })), canDoERApproval && expenseReport && (_jsx(ActionCard, { title: "Finance Review", children: _jsxs("form", { onSubmit: doERAction, style: { display: "flex", flexDirection: "column", gap: 10 }, children: [_jsxs("select", { value: erAction, onChange: (e) => setErAction(e.target.value), style: selStyle, children: [_jsx("option", { value: "APPROVE", children: "Approve Expense Report" }), _jsx("option", { value: "REJECT", children: "Reject" }), _jsx("option", { value: "REQUEST_REVISIONS", children: "Request Revisions" }), _jsx("option", { value: "MARK_PAY", children: "Mark as Paid" })] }), _jsx("textarea", { value: comments, onChange: (e) => setComments(e.target.value), placeholder: "Comments (optional)", style: { ...selStyle, height: 60, resize: "vertical" } }), _jsx(ActionBtn, { busy: actionBusy, children: "Apply" })] }) }))] }), (expenseReport || lineItems.length > 0) && (_jsxs("div", { style: { background: "white", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", marginTop: 16 }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }, children: [_jsx("h2", { style: { margin: 0, fontSize: 14, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }, children: "Expense Line Items" }), canAddLineItems && (_jsx("button", { onClick: () => setShowLineItemForm((v) => !v), style: { padding: "5px 12px", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }, children: showLineItemForm ? "Cancel" : "+ Add Line Item" }))] }), showLineItemForm && (_jsxs("form", { onSubmit: doAddLineItem, style: { background: "#f9fafb", borderRadius: 8, padding: 16, marginBottom: 16 }, children: [_jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }, children: [_jsxs("div", { children: [_jsx("label", { style: miniLabel, children: "Vendor ID *" }), _jsx("input", { value: liVendorId, onChange: (e) => setLiVendorId(e.target.value), required: true, style: miniInput })] }), _jsxs("div", { children: [_jsx("label", { style: miniLabel, children: "Category ID *" }), _jsx("input", { value: liCategoryId, onChange: (e) => setLiCategoryId(e.target.value), required: true, style: miniInput })] }), _jsxs("div", { children: [_jsx("label", { style: miniLabel, children: "Amount ($) *" }), _jsx("input", { type: "number", min: "0.01", step: "0.01", value: liAmount, onChange: (e) => setLiAmount(e.target.value), required: true, style: miniInput })] }), _jsxs("div", { children: [_jsx("label", { style: miniLabel, children: "Expense Date *" }), _jsx("input", { type: "date", value: liDate, onChange: (e) => setLiDate(e.target.value), required: true, style: miniInput })] }), _jsxs("div", { style: { gridColumn: "2 / -1" }, children: [_jsx("label", { style: miniLabel, children: "Description" }), _jsx("input", { value: liDescription, onChange: (e) => setLiDescription(e.target.value), style: miniInput })] })] }), liError && _jsx("p", { style: { color: "#dc2626", fontSize: 12, margin: "8px 0 0" }, children: liError }), _jsx("button", { type: "submit", disabled: liBusy, style: { marginTop: 12, padding: "7px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }, children: liBusy ? "Adding..." : "Add Line Item" })] })), lineItems.length === 0 ? (_jsx("div", { style: { color: "#9ca3af", fontSize: 13 }, children: "No line items yet." })) : (_jsxs("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [_jsx("thead", { children: _jsx("tr", { children: ["Vendor", "Category", "Amount", "Date", "Description"].map((h) => (_jsx("th", { style: { textAlign: "left", fontSize: 11, color: "#9ca3af", fontWeight: 600, padding: "6px 10px", borderBottom: "1px solid #f3f4f6", textTransform: "uppercase", letterSpacing: "0.04em" }, children: h }, h))) }) }), _jsxs("tbody", { children: [lineItems.map((li) => (_jsxs("tr", { style: { borderBottom: "1px solid #f9fafb" }, children: [_jsx("td", { style: { padding: "10px", fontSize: 13, color: "#374151" }, children: li.vendorId }), _jsx("td", { style: { padding: "10px", fontSize: 13, color: "#374151" }, children: li.categoryId }), _jsx("td", { style: { padding: "10px", fontSize: 13, color: "#374151" }, children: fmtMoney(li.amount) }), _jsx("td", { style: { padding: "10px", fontSize: 13, color: "#374151" }, children: li.expenseDate }), _jsx("td", { style: { padding: "10px", fontSize: 13, color: "#374151" }, children: li.description || "—" })] }, li.id))), _jsxs("tr", { children: [_jsx("td", { colSpan: 2, style: { padding: "10px", fontSize: 13, fontWeight: 700, color: "#111827" }, children: "Total" }), _jsx("td", { style: { padding: "10px", fontSize: 13, fontWeight: 700, color: "#111827" }, children: fmtMoney(lineItems.reduce((s, i) => s + i.amount, 0)) }), _jsx("td", { colSpan: 2 })] })] })] }))] })), approvals.length > 0 && (_jsxs("div", { style: { background: "white", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", marginTop: 16 }, children: [_jsx("h2", { style: { margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }, children: "Approval History" }), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: approvals.map((a) => (_jsxs("div", { style: { display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }, children: [_jsx("div", { style: { width: 8, height: 8, borderRadius: "50%", background: decisionColor(a.decision), marginTop: 5, flexShrink: 0 } }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { fontSize: 13, color: "#374151", fontWeight: 500 }, children: [_jsx("span", { style: { color: "#9ca3af", marginRight: 6 }, children: a.step }), a.decision] }), a.comments && _jsxs("div", { style: { fontSize: 12, color: "#6b7280", marginTop: 2 }, children: ["\"", a.comments, "\""] }), _jsxs("div", { style: { fontSize: 11, color: "#9ca3af", marginTop: 2 }, children: ["by ", a.approvedBy, " \u00B7 ", a.createdAt] })] })] }, a.id))) })] }))] }));
}
// ─── Sub-components ───────────────────────────────────────────────────────────
function ActionCard({ title, children }) {
    return (_jsxs("div", { style: { background: "white", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", borderTop: "3px solid #2563eb" }, children: [_jsx("h2", { style: { margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }, children: title }), children] }));
}
function ActionBtn({ children, onClick, busy }) {
    return (_jsx("button", { type: onClick ? "button" : "submit", onClick: onClick, disabled: busy, style: { padding: "9px 20px", background: "#2563eb", color: "white", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1, display: "block", width: "100%" }, children: busy ? "Processing..." : children }));
}
function SecondaryBtn({ children, onClick }) {
    return (_jsx("button", { type: "button", onClick: onClick, style: { marginTop: 8, padding: "9px 20px", background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, cursor: "pointer", display: "block", width: "100%" }, children: children }));
}
const selStyle = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #e5e7eb",
    borderRadius: 7,
    fontSize: 13,
    color: "#111827",
    background: "white",
    boxSizing: "border-box",
};
const miniLabel = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#6b7280",
    marginBottom: 4,
};
const miniInput = {
    width: "100%",
    padding: "7px 10px",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 13,
    boxSizing: "border-box",
};
function decisionColor(decision) {
    if (["APPROVE", "SUBMIT", "UPDATED", "CREATED", "ADDED", "MARK_PAY"].includes(decision))
        return "#10b981";
    if (["REJECT"].includes(decision))
        return "#ef4444";
    if (["REQUEST_REVISIONS"].includes(decision))
        return "#f97316";
    return "#9ca3af";
}
