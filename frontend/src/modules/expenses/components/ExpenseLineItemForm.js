import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { expensesApi } from "../services";
export function ExpenseLineItemForm({ tenantId, organizationId, defaultRequestId, defaultReportId }) {
    const [requestId, setRequestId] = useState(defaultRequestId || "");
    const [reportId, setReportId] = useState(defaultReportId || "");
    const [lineItemId, setLineItemId] = useState("");
    const [vendorId, setVendorId] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [amount, setAmount] = useState("0");
    const [expenseDate, setExpenseDate] = useState("");
    const [description, setDescription] = useState("");
    const [receiptUrl, setReceiptUrl] = useState("");
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [error, setError] = useState("");
    useEffect(() => {
        setRequestId(defaultRequestId || "");
    }, [defaultRequestId]);
    useEffect(() => {
        setReportId(defaultReportId || "");
    }, [defaultReportId]);
    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setFeedback("");
        setError("");
        try {
            if (!tenantId || !organizationId || !requestId || !reportId) {
                throw new Error("tenantId, organizationId, requestId, and reportId are required.");
            }
            const result = await expensesApi.upsertExpenseLineItem({
                tenantId,
                organizationId,
                requestId,
                reportId,
                lineItemId: lineItemId || undefined,
                vendorId,
                categoryId,
                amount: Number(amount),
                expenseDate,
                description,
                receiptUrl: receiptUrl || undefined
            });
            setFeedback(`${lineItemId ? "Updated" : "Added"} line item ${result.lineItemId}. Actual request amount: ${result.actualAmount}.`);
            setLineItemId(result.lineItemId);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to add/update line item.";
            setError(message);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("form", { onSubmit: submit, style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h4", { style: { marginTop: 0 }, children: "Add / Update Expense Line Item" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Request ID", _jsx("input", { style: { display: "block", width: "100%" }, value: requestId, onChange: (event) => setRequestId(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Report ID", _jsx("input", { style: { display: "block", width: "100%" }, value: reportId, onChange: (event) => setReportId(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Line Item ID (optional for update)", _jsx("input", { style: { display: "block", width: "100%" }, value: lineItemId, onChange: (event) => setLineItemId(event.target.value) })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Vendor ID", _jsx("input", { style: { display: "block", width: "100%" }, value: vendorId, onChange: (event) => setVendorId(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Category ID", _jsx("input", { style: { display: "block", width: "100%" }, value: categoryId, onChange: (event) => setCategoryId(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Amount", _jsx("input", { type: "number", min: "0.01", step: "0.01", style: { display: "block", width: "100%" }, value: amount, onChange: (event) => setAmount(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Expense Date", _jsx("input", { type: "date", style: { display: "block", width: "100%" }, value: expenseDate, onChange: (event) => setExpenseDate(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Description", _jsx("textarea", { style: { display: "block", width: "100%" }, value: description, onChange: (event) => setDescription(event.target.value) })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Receipt URL (optional)", _jsx("input", { style: { display: "block", width: "100%" }, value: receiptUrl, onChange: (event) => setReceiptUrl(event.target.value) })] }), _jsx("button", { type: "submit", disabled: busy, children: busy ? "Saving..." : lineItemId ? "Update Line Item" : "Add Line Item" }), feedback ? _jsx("p", { style: { color: "#1a7f37" }, children: feedback }) : null, error ? _jsx("p", { style: { color: "#cf222e" }, children: error }) : null] }));
}
