import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { expensesApi } from "../services";
export function ApprovalActionsPanel({ tenantId, organizationId, defaultRequestId, defaultReportId }) {
    const [requestId, setRequestId] = useState(defaultRequestId || "");
    const [reportId, setReportId] = useState(defaultReportId || "");
    const [prAction, setPrAction] = useState("APPROVE");
    const [prComments, setPrComments] = useState("");
    const [erAction, setErAction] = useState("SUBMIT");
    const [erComments, setErComments] = useState("");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState("");
    const [error, setError] = useState("");
    useEffect(() => {
        setRequestId(defaultRequestId || "");
    }, [defaultRequestId]);
    useEffect(() => {
        setReportId(defaultReportId || "");
    }, [defaultReportId]);
    const ensureScope = () => {
        if (!tenantId || !organizationId) {
            throw new Error("tenantId and organizationId are required.");
        }
    };
    const submitPrAction = async (event) => {
        event.preventDefault();
        setBusy(true);
        setResult("");
        setError("");
        try {
            ensureScope();
            const response = await expensesApi.applyPurchaseRequestApprovalAction({
                tenantId,
                organizationId,
                requestId,
                action: prAction,
                comments: prComments || undefined
            });
            setResult(`Purchase request ${response.requestId} moved to ${response.status}.`);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to apply purchase request action.");
        }
        finally {
            setBusy(false);
        }
    };
    const submitErAction = async (event) => {
        event.preventDefault();
        setBusy(true);
        setResult("");
        setError("");
        try {
            ensureScope();
            const response = await expensesApi.applyExpenseReportApprovalAction({
                tenantId,
                organizationId,
                requestId,
                reportId,
                action: erAction,
                comments: erComments || undefined
            });
            setResult(`Expense report ${response.reportId} is ${response.reportStatus}; request ${response.requestId} is ${response.requestStatus}.`);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to apply expense report action.");
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("section", { style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h4", { style: { marginTop: 0 }, children: "Approval Actions" }), _jsx("p", { style: { marginTop: 0 }, children: "Roles: approver/admin for PR actions, requestor/admin for ER submit, finance/admin for ER review/payment." }), _jsxs("form", { onSubmit: submitPrAction, style: { marginBottom: 16 }, children: [_jsx("h5", { style: { marginBottom: 8 }, children: "Purchase Request Approval" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Request ID", _jsx("input", { style: { display: "block", width: "100%" }, value: requestId, onChange: (event) => setRequestId(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Action", _jsxs("select", { style: { display: "block", width: "100%" }, value: prAction, onChange: (event) => setPrAction(event.target.value), children: [_jsx("option", { value: "APPROVE", children: "Approve" }), _jsx("option", { value: "REJECT", children: "Reject" }), _jsx("option", { value: "REQUEST_REVISIONS", children: "Request Revisions" })] })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Comments (optional)", _jsx("input", { style: { display: "block", width: "100%" }, value: prComments, onChange: (event) => setPrComments(event.target.value) })] }), _jsx("button", { type: "submit", disabled: busy, children: busy ? "Applying..." : "Apply PR Action" })] }), _jsxs("form", { onSubmit: submitErAction, children: [_jsx("h5", { style: { marginBottom: 8 }, children: "Expense Report Action" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Request ID", _jsx("input", { style: { display: "block", width: "100%" }, value: requestId, onChange: (event) => setRequestId(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Report ID", _jsx("input", { style: { display: "block", width: "100%" }, value: reportId, onChange: (event) => setReportId(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Action", _jsxs("select", { style: { display: "block", width: "100%" }, value: erAction, onChange: (event) => setErAction(event.target.value), children: [_jsx("option", { value: "SUBMIT", children: "Submit (Requestor/Admin)" }), _jsx("option", { value: "APPROVE", children: "Approve (Finance/Admin)" }), _jsx("option", { value: "REJECT", children: "Reject (Finance/Admin)" }), _jsx("option", { value: "REQUEST_REVISIONS", children: "Request Revisions (Finance/Admin)" }), _jsx("option", { value: "MARK_PAID", children: "Mark Paid (Finance/Admin)" })] })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Comments (optional)", _jsx("input", { style: { display: "block", width: "100%" }, value: erComments, onChange: (event) => setErComments(event.target.value) })] }), _jsx("button", { type: "submit", disabled: busy, children: busy ? "Applying..." : "Apply ER Action" })] }), result ? _jsx("p", { style: { color: "#1a7f37" }, children: result }) : null, error ? _jsx("p", { style: { color: "#cf222e" }, children: error }) : null] }));
}
