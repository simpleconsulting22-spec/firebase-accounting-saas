import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { expensesApi } from "../services";
export function PurchaseRequestForm({ mode, tenantId, organizationId, defaultRequestId, onRequestSaved }) {
    const [requestId, setRequestId] = useState(defaultRequestId || "");
    const [fundId, setFundId] = useState("");
    const [ministryDepartment, setMinistryDepartment] = useState("");
    const [approverId, setApproverId] = useState("");
    const [estimatedAmount, setEstimatedAmount] = useState("0");
    const [plannedPaymentMethod, setPlannedPaymentMethod] = useState("");
    const [purpose, setPurpose] = useState("");
    const [description, setDescription] = useState("");
    const [requestedExpenseDate, setRequestedExpenseDate] = useState("");
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
            if (!tenantId || !organizationId) {
                throw new Error("tenantId and organizationId are required.");
            }
            const basePayload = {
                tenantId,
                organizationId,
                fundId,
                ministryDepartment,
                approverId,
                estimatedAmount: Number(estimatedAmount),
                plannedPaymentMethod,
                purpose,
                description,
                requestedExpenseDate
            };
            const result = mode === "create"
                ? await expensesApi.createPurchaseRequest(basePayload)
                : await expensesApi.updateDraftPurchaseRequest({
                    ...basePayload,
                    requestId
                });
            onRequestSaved(result.requestId);
            setFeedback(`Saved request ${result.requestId} (${result.status}).`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save purchase request.";
            setError(message);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("form", { onSubmit: submit, style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h4", { style: { marginTop: 0 }, children: mode === "create" ? "Create Purchase Request (Draft)" : "Update Draft Purchase Request" }), mode === "update" ? (_jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Request ID", _jsx("input", { style: { display: "block", width: "100%" }, value: requestId, onChange: (event) => setRequestId(event.target.value), required: true })] })) : null, _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Fund ID", _jsx("input", { style: { display: "block", width: "100%" }, value: fundId, onChange: (event) => setFundId(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Ministry Department", _jsx("input", { style: { display: "block", width: "100%" }, value: ministryDepartment, onChange: (event) => setMinistryDepartment(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Approver User ID", _jsx("input", { style: { display: "block", width: "100%" }, value: approverId, onChange: (event) => setApproverId(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Estimated Amount", _jsx("input", { type: "number", min: "0", step: "0.01", style: { display: "block", width: "100%" }, value: estimatedAmount, onChange: (event) => setEstimatedAmount(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Planned Payment Method", _jsx("input", { style: { display: "block", width: "100%" }, value: plannedPaymentMethod, onChange: (event) => setPlannedPaymentMethod(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Purpose", _jsx("input", { style: { display: "block", width: "100%" }, value: purpose, onChange: (event) => setPurpose(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Description", _jsx("textarea", { style: { display: "block", width: "100%" }, value: description, onChange: (event) => setDescription(event.target.value) })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Requested Expense Date", _jsx("input", { type: "date", style: { display: "block", width: "100%" }, value: requestedExpenseDate, onChange: (event) => setRequestedExpenseDate(event.target.value), required: true })] }), _jsx("button", { type: "submit", disabled: busy, children: busy ? "Saving..." : mode === "create" ? "Create Draft" : "Update Draft" }), feedback ? _jsx("p", { style: { color: "#1a7f37" }, children: feedback }) : null, error ? _jsx("p", { style: { color: "#cf222e" }, children: error }) : null] }));
}
