import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
export default function TokenReviewPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token") || "";
    const [loading, setLoading] = useState(true);
    const [request, setRequest] = useState(null);
    const [tokenType, setTokenType] = useState("");
    const [tokenError, setTokenError] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    // Pre-approval form
    const [decision, setDecision] = useState("APPROVE");
    const [approvedAmount, setApprovedAmount] = useState("");
    const [notes, setNotes] = useState("");
    const [rejectionReason, setRejectionReason] = useState("");
    // Receipts review form
    const [rrDecision, setRrDecision] = useState("APPROVE");
    const [rrNotes, setRrNotes] = useState("");
    const [rrRejectionReason, setRrRejectionReason] = useState("");
    useEffect(() => {
        if (!token) {
            setTokenError("No token provided in URL.");
            setLoading(false);
            return;
        }
        (async () => {
            try {
                const result = await api.validateTokenAndGetRequest({ token });
                setRequest(result.request || result);
                setTokenType(result.tokenType || "preApproval");
                // Pre-fill approved amount with estimated
                const req = result.request || result;
                if (req?.estimatedAmount) {
                    setApprovedAmount(String(req.estimatedAmount));
                }
            }
            catch (err) {
                const msg = err?.message || "Invalid or expired token.";
                if (msg.includes("expired") || msg.includes("used") || msg.includes("invalid")) {
                    setTokenError(msg);
                }
                else {
                    setTokenError("This review link is invalid or has already been used.");
                }
            }
            finally {
                setLoading(false);
            }
        })();
    }, [token]);
    const handlePreApproval = async (e) => {
        e.preventDefault();
        if (decision === "REJECT" && !rejectionReason.trim()) {
            setError("Rejection reason is required.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            await api.submitApproverDecision({
                token,
                decision,
                notes: decision === "REJECT" ? rejectionReason : notes,
                approvedAmount: decision === "APPROVE" ? parseFloat(approvedAmount) : undefined,
            });
            setSuccess(decision === "APPROVE"
                ? "Request approved successfully! The requestor has been notified."
                : decision === "REJECT"
                    ? "Request rejected. The requestor has been notified."
                    : "Request sent back for edits. The requestor has been notified.");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Action failed.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleReceiptsReview = async (e) => {
        e.preventDefault();
        if (rrDecision === "REJECT" && !rrRejectionReason.trim()) {
            setError("Rejection reason is required.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            if (rrDecision === "APPROVE") {
                await api.approveReceiptsReview({ token, notes: rrNotes });
            }
            else if (rrDecision === "REJECT") {
                await api.rejectReceiptsReview({ token, reason: rrRejectionReason });
            }
            else {
                await api.sendBackForEdits({ token, notes: rrNotes });
            }
            setSuccess(rrDecision === "APPROVE"
                ? "Receipts approved! The request has been moved to final approval."
                : rrDecision === "REJECT"
                    ? "Request rejected. The requestor has been notified."
                    : "Request sent back for edits.");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Action failed.");
        }
        finally {
            setBusy(false);
        }
    };
    if (loading) {
        return (_jsx("div", { className: "min-h-screen bg-base-200 flex items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx("span", { className: "loading loading-spinner loading-lg" }), _jsx("p", { className: "mt-3 text-base-content/60", children: "Loading review..." })] }) }));
    }
    if (tokenError) {
        return (_jsx("div", { className: "min-h-screen bg-base-200 flex items-center justify-center p-4", children: _jsx("div", { className: "card bg-base-100 shadow-xl w-full max-w-md", children: _jsxs("div", { className: "card-body text-center", children: [_jsx("div", { className: "text-6xl mb-4", children: "\uD83D\uDD12" }), _jsx("h2", { className: "card-title justify-center text-error", children: "Link Unavailable" }), _jsx("p", { className: "text-base-content/70", children: tokenError }), _jsx("p", { className: "text-sm text-base-content/50 mt-2", children: "If you believe this is an error, please contact the person who sent you this link." })] }) }) }));
    }
    if (success) {
        return (_jsx("div", { className: "min-h-screen bg-base-200 flex items-center justify-center p-4", children: _jsx("div", { className: "card bg-base-100 shadow-xl w-full max-w-md", children: _jsxs("div", { className: "card-body text-center", children: [_jsx("div", { className: "text-6xl mb-4", children: "\u2705" }), _jsx("h2", { className: "card-title justify-center text-success", children: "Done!" }), _jsx("p", { className: "text-base-content/70", children: success }), _jsx("p", { className: "text-sm text-base-content/50 mt-2", children: "You may close this window." })] }) }) }));
    }
    return (_jsx("div", { className: "min-h-screen bg-base-200 py-8 px-4", children: _jsxs("div", { className: "max-w-2xl mx-auto space-y-4", children: [_jsxs("div", { className: "text-center mb-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: tokenType === "receiptsReview" ? "Receipts Review" : "Expense Pre-Approval" }), _jsx("p", { className: "text-base-content/60 text-sm mt-1", children: tokenType === "receiptsReview"
                                ? "Review the submitted receipts and expense report"
                                : "Review and approve or decline this purchase request" })] }), error && _jsx("div", { className: "alert alert-error", children: _jsx("span", { children: error }) }), request && (_jsx("div", { className: "card bg-base-100 shadow", children: _jsxs("div", { className: "card-body", children: [_jsxs("div", { className: "flex items-center gap-3 mb-4", children: [_jsx("h2", { className: "card-title text-base", children: request.purpose || "(No purpose)" }), _jsx(StatusBadge, { status: request.status })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3 text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Requestor" }), _jsx("div", { children: request.requestorName || request.requestorEmail || "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Ministry / Dept" }), _jsx("div", { children: request.ministryDepartment || "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Vendor" }), _jsx("div", { children: request.vendorName || request.vendorId || "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Category" }), _jsx("div", { children: request.category || "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Estimated Amount" }), _jsx("div", { className: "font-semibold", children: fmtCurrency(request.estimatedAmount) })] }), request.approvedAmount > 0 && (_jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Approved Amount" }), _jsx("div", { className: "font-semibold", children: fmtCurrency(request.approvedAmount) })] })), request.actualAmount > 0 && (_jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Actual Amount" }), _jsx("div", { className: "font-semibold", children: fmtCurrency(request.actualAmount) })] })), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Payment Method" }), _jsx("div", { children: request.paymentMethod || "—" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Requested Date" }), _jsx("div", { children: fmtDate(request.requestedExpenseDate) })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Fund" }), _jsx("div", { children: request.fundId || "—" })] }), _jsxs("div", { className: "col-span-2", children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Description" }), _jsx("div", { className: "whitespace-pre-wrap", children: request.description || "—" })] }), request.preApprovalNotes && (_jsxs("div", { className: "col-span-2", children: [_jsx("div", { className: "text-xs text-base-content/50 uppercase font-semibold", children: "Pre-Approval Notes" }), _jsx("div", { children: request.preApprovalNotes })] }))] })] }) })), tokenType === "preApproval" && (_jsx("div", { className: "card bg-base-100 shadow border-t-4 border-primary", children: _jsxs("div", { className: "card-body", children: [_jsx("h2", { className: "card-title text-base", children: "Your Decision" }), _jsxs("form", { onSubmit: handlePreApproval, className: "space-y-4", children: [_jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Decision *" }) }), _jsx("div", { className: "flex flex-wrap gap-3", children: ["APPROVE", "REJECT", "NEEDS_EDITS"].map(d => (_jsxs("label", { className: "label cursor-pointer gap-2", children: [_jsx("input", { type: "radio", name: "decision", className: "radio radio-primary", value: d, checked: decision === d, onChange: () => setDecision(d) }), _jsx("span", { className: "label-text", children: d === "APPROVE" ? "Approve" : d === "REJECT" ? "Reject" : "Needs Edits" })] }, d))) })] }), decision === "APPROVE" && (_jsxs("div", { className: "form-control", children: [_jsxs("label", { className: "label", children: [_jsx("span", { className: "label-text font-semibold", children: "Approved Amount *" }), _jsx("span", { className: "label-text-alt text-base-content/50", children: "Can differ from estimated" })] }), _jsx("input", { type: "number", step: "0.01", min: "0.01", className: "input input-bordered", value: approvedAmount, onChange: e => setApprovedAmount(e.target.value), required: true })] })), decision === "REJECT" && (_jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Rejection Reason *" }) }), _jsx("textarea", { className: "textarea textarea-bordered", value: rejectionReason, onChange: e => setRejectionReason(e.target.value), placeholder: "Please explain why this request is being rejected", rows: 3, required: true })] })), decision !== "REJECT" && (_jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Notes (optional)" }) }), _jsx("textarea", { className: "textarea textarea-bordered", value: notes, onChange: e => setNotes(e.target.value), placeholder: decision === "NEEDS_EDITS" ? "Describe what needs to be changed" : "Any additional comments", rows: 3 })] })), _jsx("button", { type: "submit", disabled: busy, className: `btn w-full ${decision === "APPROVE" ? "btn-success" : decision === "REJECT" ? "btn-error" : "btn-warning"}`, children: busy ? _jsx("span", { className: "loading loading-spinner loading-sm" }) : (decision === "APPROVE" ? "Approve Request"
                                            : decision === "REJECT" ? "Reject Request"
                                                : "Send Back for Edits") })] })] }) })), tokenType === "receiptsReview" && (_jsx("div", { className: "card bg-base-100 shadow border-t-4 border-secondary", children: _jsxs("div", { className: "card-body", children: [_jsx("h2", { className: "card-title text-base", children: "Receipts Review Decision" }), _jsxs("form", { onSubmit: handleReceiptsReview, className: "space-y-4", children: [_jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Decision *" }) }), _jsx("div", { className: "flex flex-wrap gap-3", children: ["APPROVE", "REJECT", "SEND_BACK"].map(d => (_jsxs("label", { className: "label cursor-pointer gap-2", children: [_jsx("input", { type: "radio", name: "rr-decision", className: "radio radio-secondary", value: d, checked: rrDecision === d, onChange: () => setRrDecision(d) }), _jsx("span", { className: "label-text", children: d === "APPROVE" ? "Approve Receipts" : d === "REJECT" ? "Reject" : "Send Back for Edits" })] }, d))) })] }), rrDecision === "REJECT" && (_jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Rejection Reason *" }) }), _jsx("textarea", { className: "textarea textarea-bordered", value: rrRejectionReason, onChange: e => setRrRejectionReason(e.target.value), placeholder: "Please explain why this is being rejected", rows: 3, required: true })] })), rrDecision !== "REJECT" && (_jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Notes (optional)" }) }), _jsx("textarea", { className: "textarea textarea-bordered", value: rrNotes, onChange: e => setRrNotes(e.target.value), placeholder: rrDecision === "SEND_BACK" ? "What needs to be corrected?" : "Any comments", rows: 3 })] })), _jsx("button", { type: "submit", disabled: busy, className: `btn w-full ${rrDecision === "APPROVE" ? "btn-success" : rrDecision === "REJECT" ? "btn-error" : "btn-warning"}`, children: busy ? _jsx("span", { className: "loading loading-spinner loading-sm" }) : (rrDecision === "APPROVE" ? "Approve Receipts"
                                            : rrDecision === "REJECT" ? "Reject"
                                                : "Send Back for Edits") })] })] }) }))] }) }));
}
