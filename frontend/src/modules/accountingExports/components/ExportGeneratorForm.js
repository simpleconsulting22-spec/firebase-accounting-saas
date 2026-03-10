import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { accountingExportsApi } from "../services";
export function ExportGeneratorForm({ tenantId, organizationId, onGenerated }) {
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        setError("");
        try {
            if (!tenantId || !organizationId) {
                throw new Error("tenantId and organizationId are required.");
            }
            const result = await accountingExportsApi.generateQuickbooksExpenseExport({
                tenantId,
                organizationId,
                dateFrom,
                dateTo
            });
            setMessage(`Export ${result.exportId} completed with ${result.rowCount} rows. Type: ${result.exportType}.`);
            onGenerated();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate export.");
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("form", { onSubmit: submit, style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { style: { marginTop: 0 }, children: "Generate QuickBooks Expense Export" }), _jsxs("p", { style: { marginTop: 0 }, children: ["Export type: ", _jsx("code", { children: "quickbooks_expense_export" })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Date From", _jsx("input", { type: "date", style: { display: "block", width: "100%" }, value: dateFrom, onChange: (event) => setDateFrom(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Date To", _jsx("input", { type: "date", style: { display: "block", width: "100%" }, value: dateTo, onChange: (event) => setDateTo(event.target.value), required: true })] }), _jsx("button", { type: "submit", disabled: busy, children: busy ? "Generating..." : "Generate Export" }), message ? _jsx("p", { style: { color: "#1a7f37" }, children: message }) : null, error ? _jsx("p", { style: { color: "#cf222e" }, children: error }) : null] }));
}
