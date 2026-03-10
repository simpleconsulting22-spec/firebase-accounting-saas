import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { expensesApi } from "../services";
export function ExpenseReportForm({ tenantId, organizationId, defaultRequestId, onReportReady }) {
    const [requestId, setRequestId] = useState(defaultRequestId || "");
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [error, setError] = useState("");
    useEffect(() => {
        setRequestId(defaultRequestId || "");
    }, [defaultRequestId]);
    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setFeedback("");
        setError("");
        try {
            if (!tenantId || !organizationId || !requestId) {
                throw new Error("tenantId, organizationId, and requestId are required.");
            }
            const result = await expensesApi.createExpenseReport({
                tenantId,
                organizationId,
                requestId
            });
            onReportReady(result.reportId);
            const flag = result.existed ? "Existing report returned." : "New report created.";
            setFeedback(`${flag} Report ID: ${result.reportId} (${result.status}).`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create expense report.";
            setError(message);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("form", { onSubmit: submit, style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h4", { style: { marginTop: 0 }, children: "Create Expense Report" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Request ID", _jsx("input", { style: { display: "block", width: "100%" }, value: requestId, onChange: (event) => setRequestId(event.target.value), required: true })] }), _jsx("button", { type: "submit", disabled: busy, children: busy ? "Creating..." : "Create Expense Report" }), feedback ? _jsx("p", { style: { color: "#1a7f37" }, children: feedback }) : null, error ? _jsx("p", { style: { color: "#cf222e" }, children: error }) : null] }));
}
