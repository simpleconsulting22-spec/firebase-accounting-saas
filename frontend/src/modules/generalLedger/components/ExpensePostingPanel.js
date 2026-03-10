import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { generalLedgerApi } from "../services";
export function ExpensePostingPanel({ tenantId, organizationId }) {
    const [reportId, setReportId] = useState("");
    const [date, setDate] = useState("");
    const [reference, setReference] = useState("");
    const [memo, setMemo] = useState("");
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const canRun = Boolean(tenantId && organizationId);
    const onSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setResult(null);
        if (!canRun) {
            setError("tenantId and organizationId are required.");
            return;
        }
        setPosting(true);
        try {
            const response = await generalLedgerApi.postExpenseReportToLedger({
                tenantId,
                organizationId,
                reportId: reportId.trim(),
                date: date || undefined,
                reference: reference.trim() || undefined,
                memo: memo.trim() || undefined
            });
            setResult(response);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to post expense report to ledger.");
        }
        finally {
            setPosting(false);
        }
    };
    return (_jsxs("section", { style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { style: { marginTop: 0 }, children: "Expense Posting to Ledger" }), _jsx("p", { children: "Posts an expense report to immutable journal entries with idempotent source-based protection." }), _jsxs("form", { onSubmit: onSubmit, children: [_jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 8 }, children: [_jsxs("label", { children: ["Expense Report ID", _jsx("input", { style: { display: "block", width: "100%" }, value: reportId, onChange: (event) => setReportId(event.target.value), placeholder: "expense report document id", required: true })] }), _jsxs("label", { children: ["Override Date (optional)", _jsx("input", { style: { display: "block", width: "100%" }, type: "date", value: date, onChange: (event) => setDate(event.target.value) })] }), _jsxs("label", { children: ["Override Reference (optional)", _jsx("input", { style: { display: "block", width: "100%" }, value: reference, onChange: (event) => setReference(event.target.value), placeholder: "ER-REQ-2026-001" })] }), _jsxs("label", { children: ["Override Memo (optional)", _jsx("input", { style: { display: "block", width: "100%" }, value: memo, onChange: (event) => setMemo(event.target.value), placeholder: "Expense posting entry" })] })] }), _jsx("button", { type: "submit", disabled: !canRun || posting, style: { marginTop: 8 }, children: "Post Expense Report" })] }), error ? _jsx("p", { style: { color: "#cf222e" }, children: error }) : null, result ? (_jsxs("p", { style: { color: "#1a7f37" }, children: ["Posted report ", result.reportId, " to journal entry ", result.journalEntryId, " (period ", result.periodKey, ").", " ", result.existed ? "Existing posted entry reused." : "New entry created."] })) : null] }));
}
