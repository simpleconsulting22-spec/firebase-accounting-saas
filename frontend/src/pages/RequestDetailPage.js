import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useUserContext } from "../contexts/UserContext";
import { api } from "../workflow/api";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "../workflow/constants";
const fmtCurrency = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
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
function StatusBadge({ status }) {
    const label = STATUS_LABELS[status] || status;
    const cls = STATUS_BADGE_CLASS[status] || 'badge-ghost';
    return _jsx("span", { className: `badge ${cls}`, children: label });
}
const STEPS = [
    { n: 1, label: "Draft" },
    { n: 2, label: "Pre-Approval" },
    { n: 3, label: "Pre-Approved" },
    { n: 4, label: "Expense Report" },
    { n: 5, label: "Receipt Review" },
    { n: 6, label: "Final Approved" },
    { n: 7, label: "Paid" },
    { n: 8, label: "QB" },
];
const STATUS_TO_STEP = {
    DRAFT: 1,
    NEEDS_EDITS_STEP1: 1,
    SUBMITTED_PREAPPROVAL: 2,
    PREAPPROVED: 3,
    DRAFT_EXPENSE: 4,
    NEEDS_EDITS_STEP3: 4,
    EXCEEDS_APPROVED_AMOUNT: 5,
    SUBMITTED_RECEIPT_REVIEW: 5,
    FINAL_APPROVED: 6,
    PAID: 7,
    QB_SENT: 8,
    QB_ENTERED: 8,
    REJECTED: 1,
};
export default function RequestDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { profile, activeOrgId, isAdmin, isFinancePayor, isQBEntry, isReceiptsReviewer } = useUserContext();
    const [request, setRequest] = useState(null);
    const [lineItems, setLineItems] = useState([]);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionBusy, setActionBusy] = useState(false);
    const [actionError, setActionError] = useState("");
    const [actionSuccess, setActionSuccess] = useState("");
    // Action form state
    const [paymentRef, setPaymentRef] = useState("");
    const [qbNotes, setQbNotes] = useState("");
    const [overageAmount, setOverageAmount] = useState("");
    const [adminReceiptsNotes, setAdminReceiptsNotes] = useState("");
    const load = useCallback(async () => {
        if (!id || !profile || !activeOrgId)
            return;
        setLoading(true);
        try {
            const result = await api.getRequestDetail({ requestId: id, orgId: activeOrgId });
            setRequest(result.request || result);
            setLineItems(result.lineItems || []);
            setFiles(result.files || []);
        }
        catch (err) {
            console.error(err);
        }
        finally {
            setLoading(false);
        }
    }, [id, profile, activeOrgId]);
    useEffect(() => { load(); }, [load]);
    const withAction = async (fn) => {
        setActionBusy(true);
        setActionError("");
        setActionSuccess("");
        try {
            await fn();
            await load();
            setActionSuccess("Action completed successfully.");
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : "Action failed.");
        }
        finally {
            setActionBusy(false);
        }
    };
    const doMarkPaid = (e) => {
        e.preventDefault();
        if (!paymentRef.trim()) {
            setActionError("Payment reference is required.");
            return;
        }
        withAction(() => api.markAsPaid({ requestId: id, orgId: activeOrgId, paymentReference: paymentRef }));
    };
    const doSendToQB = () => {
        withAction(() => api.sendToQuickBooks({ requestId: id, orgId: activeOrgId }));
    };
    const doConfirmQB = (e) => {
        e.preventDefault();
        withAction(() => api.confirmQBEntry({ requestId: id, orgId: activeOrgId, notes: qbNotes }));
    };
    const doOverrideAmount = (e) => {
        e.preventDefault();
        if (!overageAmount || parseFloat(overageAmount) <= 0) {
            setActionError("Valid amount required.");
            return;
        }
        withAction(() => api.applyOverageApproval({ requestId: id, orgId: activeOrgId, approvedAmount: parseFloat(overageAmount) }));
    };
    const doAdminApproveReceipts = (e) => {
        e.preventDefault();
        withAction(() => api.adminApproveReceiptsReview({ requestId: id, orgId: activeOrgId, notes: adminReceiptsNotes }));
    };
    const doSubmitPreApproval = () => {
        withAction(() => api.submitPreApproval({ requestId: id, orgId: activeOrgId }));
    };
    if (loading) {
        return (_jsxs("div", { className: "p-6", children: [_jsx("div", { className: "skeleton h-8 w-64 mb-4" }), _jsx("div", { className: "skeleton h-48 w-full rounded-box" })] }));
    }
    if (!request) {
        return (_jsxs("div", { className: "p-6", children: [_jsx("div", { className: "alert alert-error", children: "Request not found." }), _jsx(Link, { to: "/", className: "btn btn-sm mt-4", children: "Back to Dashboard" })] }));
    }
    const status = request.status;
    const isMyRequest = profile?.uid === request.requestorId;
    const currentStep = STATUS_TO_STEP[status] || 1;
    const canEditRequest = isMyRequest && (status === "DRAFT" || status === "NEEDS_EDITS_STEP1");
    const canSubmitPreApproval = isMyRequest && (status === "DRAFT" || status === "NEEDS_EDITS_STEP1");
    const canCompleteExpense = isMyRequest && (status === "PREAPPROVED" || status === "DRAFT_EXPENSE" || status === "NEEDS_EDITS_STEP3");
    const canMarkPaid = isFinancePayor && status === "FINAL_APPROVED";
    const canSendQB = isQBEntry && status === "PAID";
    const canConfirmQB = isQBEntry && status === "QB_SENT";
    const canOverrideAmount = isAdmin && status === "EXCEEDS_APPROVED_AMOUNT";
    const canAdminApproveReceipts = isAdmin && status === "SUBMITTED_RECEIPT_REVIEW";
    return (_jsxs("div", { className: "p-6 max-w-4xl mx-auto", children: [_jsx("button", { onClick: () => navigate("/"), className: "btn btn-ghost btn-sm mb-4", children: "\u2190 Back to Dashboard" }), _jsx("div", { className: "flex items-start justify-between mb-4", children: _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsx("h1", { className: "text-xl font-bold", children: request.purpose || "(No purpose)" }), _jsx(StatusBadge, { status: status })] }), _jsxs("p", { className: "text-sm text-base-content/60 mt-1", children: ["ID: ", _jsx("span", { className: "font-mono", children: id }), " \u00B7 Updated ", fmtDate(request.updatedAt)] })] }) }), _jsx("div", { className: "card bg-base-100 shadow mb-4", children: _jsx("div", { className: "card-body py-4", children: _jsx("ul", { className: "steps steps-horizontal w-full text-xs", children: STEPS.map(s => (_jsx("li", { className: `step ${s.n <= currentStep ? "step-primary" : ""}`, children: s.label }, s.n))) }) }) }), actionSuccess && (_jsx("div", { className: "alert alert-success mb-4", children: _jsx("span", { children: actionSuccess }) })), actionError && (_jsx("div", { className: "alert alert-error mb-4", children: _jsx("span", { children: actionError }) })), _jsx("div", { className: "card bg-base-100 shadow mb-4", children: _jsxs("div", { className: "card-body", children: [_jsx("h2", { className: "card-title text-sm uppercase tracking-wider text-base-content/60 mb-2", children: "Request Details" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Organization" }), _jsx("div", { className: "text-sm", children: request.orgId })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Ministry / Dept" }), _jsx("div", { className: "text-sm", children: request.ministryDepartment || "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Requestor" }), _jsx("div", { className: "text-sm", children: request.requestorName || request.requestorEmail || request.requestorId || "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Approver" }), _jsx("div", { className: "text-sm", children: request.approverName || request.approverEmail || request.approverId || "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Fund" }), _jsx("div", { className: "text-sm", children: request.fundId || "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Vendor" }), _jsx("div", { className: "text-sm", children: request.vendorName || request.vendorId || "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Category" }), _jsx("div", { className: "text-sm", children: request.category || "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Payment Method" }), _jsx("div", { className: "text-sm", children: request.paymentMethod || "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Estimated Amount" }), _jsx("div", { className: "text-sm font-semibold", children: fmtCurrency(request.estimatedAmount) })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Approved Amount" }), _jsx("div", { className: "text-sm font-semibold", children: request.approvedAmount ? fmtCurrency(request.approvedAmount) : "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Actual Amount" }), _jsx("div", { className: "text-sm font-semibold", children: request.actualAmount ? fmtCurrency(request.actualAmount) : "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Requested Expense Date" }), _jsx("div", { className: "text-sm", children: request.requestedExpenseDate ? fmtDate(request.requestedExpenseDate) : "—" })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Purpose" }), _jsx("div", { className: "text-sm", children: request.purpose || "—" })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Description" }), _jsx("div", { className: "text-sm whitespace-pre-wrap", children: request.description || "—" })] }), request.preApprovalNotes && (_jsxs("div", { className: "md:col-span-2", children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Pre-Approval Notes" }), _jsx("div", { className: "text-sm", children: request.preApprovalNotes })] })), request.receiptsReviewNotes && (_jsxs("div", { className: "md:col-span-2", children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Receipts Review Notes" }), _jsx("div", { className: "text-sm", children: request.receiptsReviewNotes })] })), request.rejectionReason && (_jsxs("div", { className: "md:col-span-2", children: [_jsx("div", { className: "text-xs text-error uppercase font-semibold", children: "Rejection Reason" }), _jsx("div", { className: "text-sm text-error", children: request.rejectionReason })] })), request.paymentReference && (_jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Payment Reference" }), _jsx("div", { className: "text-sm", children: request.paymentReference })] }))] })] }) }), lineItems.length > 0 && (_jsx("div", { className: "card bg-base-100 shadow mb-4", children: _jsxs("div", { className: "card-body", children: [_jsx("h2", { className: "card-title text-sm uppercase tracking-wider text-base-content/60", children: "Line Items" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "table table-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Description" }), _jsx("th", { children: "Vendor" }), _jsx("th", { children: "Category" }), _jsx("th", { children: "Date" }), _jsx("th", { children: "Amount" })] }) }), _jsxs("tbody", { children: [lineItems.map((li, i) => (_jsxs("tr", { children: [_jsx("td", { children: li.description || "—" }), _jsx("td", { children: li.vendorName || "—" }), _jsx("td", { children: li.category || "—" }), _jsx("td", { children: li.receiptDate ? fmtDate(li.receiptDate) : "—" }), _jsx("td", { className: "font-medium", children: fmtCurrency(li.amount) })] }, li.id || i))), _jsxs("tr", { className: "font-bold", children: [_jsx("td", { colSpan: 4, children: "Total" }), _jsx("td", { children: fmtCurrency(lineItems.reduce((s, li) => s + (li.amount || 0), 0)) })] })] })] }) })] }) })), files.length > 0 && (_jsx("div", { className: "card bg-base-100 shadow mb-4", children: _jsxs("div", { className: "card-body", children: [_jsx("h2", { className: "card-title text-sm uppercase tracking-wider text-base-content/60", children: "Attached Files" }), _jsx("ul", { className: "space-y-2", children: files.map((f, i) => (_jsxs("li", { className: "flex items-center gap-3", children: [_jsx("svg", { xmlns: "http://www.w3.org/2000/svg", className: "h-4 w-4 text-base-content/50", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" }) }), _jsx("a", { href: f.fileUrl, target: "_blank", rel: "noreferrer", className: "link link-primary text-sm", children: f.fileName }), _jsx("span", { className: "text-xs text-base-content/40", children: f.mimeType })] }, f.id || i))) })] }) })), (canEditRequest || canSubmitPreApproval || canCompleteExpense) && (_jsx("div", { className: "card bg-base-100 shadow border-t-4 border-primary mb-4", children: _jsxs("div", { className: "card-body", children: [_jsx("h2", { className: "card-title text-sm uppercase tracking-wider", children: "Your Actions" }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [canEditRequest && (_jsx(Link, { to: `/requests/${id}/edit`, className: "btn btn-outline btn-sm", children: "Edit Request" })), canSubmitPreApproval && (_jsx("button", { onClick: doSubmitPreApproval, disabled: actionBusy, className: "btn btn-primary btn-sm", children: actionBusy ? _jsx("span", { className: "loading loading-spinner loading-xs" }) : "Submit for Pre-Approval" })), canCompleteExpense && (_jsx(Link, { to: `/requests/${id}/expense`, className: "btn btn-success btn-sm", children: "Complete Expense Report" }))] })] }) })), canMarkPaid && (_jsx("div", { className: "card bg-base-100 shadow border-t-4 border-success mb-4", children: _jsxs("div", { className: "card-body", children: [_jsx("h2", { className: "card-title text-sm uppercase tracking-wider", children: "Mark as Paid" }), _jsxs("form", { onSubmit: doMarkPaid, className: "flex items-end gap-3", children: [_jsxs("div", { className: "form-control flex-1", children: [_jsx("label", { className: "label py-1", children: _jsx("span", { className: "label-text text-xs", children: "Payment Reference *" }) }), _jsx("input", { className: "input input-bordered input-sm", value: paymentRef, onChange: e => setPaymentRef(e.target.value), placeholder: "Check #, ACH ref, etc.", required: true })] }), _jsx("button", { type: "submit", disabled: actionBusy, className: "btn btn-success btn-sm", children: actionBusy ? _jsx("span", { className: "loading loading-spinner loading-xs" }) : "Mark Paid" })] })] }) })), canSendQB && (_jsx("div", { className: "card bg-base-100 shadow border-t-4 border-info mb-4", children: _jsxs("div", { className: "card-body", children: [_jsx("h2", { className: "card-title text-sm uppercase tracking-wider", children: "Send to QuickBooks" }), _jsx("p", { className: "text-sm text-base-content/60", children: "Export this expense to QuickBooks." }), _jsx("button", { onClick: doSendToQB, disabled: actionBusy, className: "btn btn-info btn-sm w-fit", children: actionBusy ? _jsx("span", { className: "loading loading-spinner loading-xs" }) : "Send to QuickBooks" })] }) })), canConfirmQB && (_jsx("div", { className: "card bg-base-100 shadow border-t-4 border-info mb-4", children: _jsxs("div", { className: "card-body", children: [_jsx("h2", { className: "card-title text-sm uppercase tracking-wider", children: "Confirm QuickBooks Entry" }), _jsxs("form", { onSubmit: doConfirmQB, className: "space-y-3", children: [_jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label py-1", children: _jsx("span", { className: "label-text text-xs", children: "Notes (optional)" }) }), _jsx("textarea", { className: "textarea textarea-bordered textarea-sm", value: qbNotes, onChange: e => setQbNotes(e.target.value), placeholder: "QB entry reference or notes", rows: 2 })] }), _jsx("button", { type: "submit", disabled: actionBusy, className: "btn btn-info btn-sm", children: actionBusy ? _jsx("span", { className: "loading loading-spinner loading-xs" }) : "Confirm QB Entry" })] })] }) })), canOverrideAmount && (_jsx("div", { className: "card bg-base-100 shadow border-t-4 border-warning mb-4", children: _jsxs("div", { className: "card-body", children: [_jsx("h2", { className: "card-title text-sm uppercase tracking-wider", children: "Override Approved Amount" }), _jsxs("p", { className: "text-sm text-base-content/60", children: ["Actual: ", fmtCurrency(request.actualAmount), " / Approved: ", fmtCurrency(request.approvedAmount)] }), _jsxs("form", { onSubmit: doOverrideAmount, className: "flex items-end gap-3", children: [_jsxs("div", { className: "form-control flex-1", children: [_jsx("label", { className: "label py-1", children: _jsx("span", { className: "label-text text-xs", children: "New Approved Amount *" }) }), _jsx("input", { type: "number", step: "0.01", min: "0.01", className: "input input-bordered input-sm", value: overageAmount, onChange: e => setOverageAmount(e.target.value), placeholder: "0.00", required: true })] }), _jsx("button", { type: "submit", disabled: actionBusy, className: "btn btn-warning btn-sm", children: actionBusy ? _jsx("span", { className: "loading loading-spinner loading-xs" }) : "Override Amount" })] })] }) })), canAdminApproveReceipts && (_jsx("div", { className: "card bg-base-100 shadow border-t-4 border-secondary mb-4", children: _jsxs("div", { className: "card-body", children: [_jsx("h2", { className: "card-title text-sm uppercase tracking-wider", children: "Admin: Approve Receipts" }), _jsxs("form", { onSubmit: doAdminApproveReceipts, className: "space-y-3", children: [_jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label py-1", children: _jsx("span", { className: "label-text text-xs", children: "Notes (optional)" }) }), _jsx("textarea", { className: "textarea textarea-bordered textarea-sm", value: adminReceiptsNotes, onChange: e => setAdminReceiptsNotes(e.target.value), placeholder: "Approval notes", rows: 2 })] }), _jsx("button", { type: "submit", disabled: actionBusy, className: "btn btn-secondary btn-sm", children: actionBusy ? _jsx("span", { className: "loading loading-spinner loading-xs" }) : "Approve Receipts" })] })] }) }))] }));
}
