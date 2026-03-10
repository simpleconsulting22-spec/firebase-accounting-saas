import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { generalLedgerApi } from "../services";
const getTodayDate = () => new Date().toISOString().slice(0, 10);
const SAMPLE_LINES = JSON.stringify([
    { accountId: "", debit: 0, credit: 0, memo: "", className: "", tagName: "" },
    { accountId: "", debit: 0, credit: 0, memo: "", className: "", tagName: "" }
], null, 2);
export function JournalEntriesPanel({ tenantId, organizationId }) {
    const [rows, setRows] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [date, setDate] = useState(getTodayDate());
    const [reference, setReference] = useState("");
    const [sourceModule, setSourceModule] = useState("manual");
    const [sourceId, setSourceId] = useState("");
    const [memo, setMemo] = useState("");
    const [linesJson, setLinesJson] = useState(SAMPLE_LINES);
    const [statusFilter, setStatusFilter] = useState("");
    const canRun = Boolean(tenantId && organizationId);
    const refresh = async () => {
        setError("");
        setMessage("");
        if (!canRun) {
            setRows([]);
            setSelected(null);
            return;
        }
        setLoading(true);
        try {
            const data = await generalLedgerApi.listJournalEntries({
                tenantId,
                organizationId,
                status: statusFilter ? statusFilter : undefined,
                limit: 100
            });
            setRows(data);
            if (selected && !data.some((row) => row.id === selected.id)) {
                setSelected(null);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load journal entries.");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void refresh();
    }, [tenantId, organizationId, statusFilter]);
    const loadDetail = async (journalEntryId) => {
        if (!canRun) {
            return;
        }
        setDetailLoading(true);
        setError("");
        try {
            const detail = await generalLedgerApi.getJournalEntryDetail({
                tenantId,
                organizationId,
                journalEntryId
            });
            setSelected(detail);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load journal entry detail.");
        }
        finally {
            setDetailLoading(false);
        }
    };
    const submitManualEntry = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        if (!canRun) {
            setError("tenantId and organizationId are required.");
            return;
        }
        let lines = [];
        try {
            const parsed = JSON.parse(linesJson);
            if (!Array.isArray(parsed)) {
                throw new Error("Lines JSON must be an array.");
            }
            lines = parsed.map((line) => ({
                accountId: String(line.accountId || ""),
                debit: Number(line.debit || 0),
                credit: Number(line.credit || 0),
                memo: String(line.memo || ""),
                className: String(line.className || ""),
                tagName: String(line.tagName || "")
            }));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Invalid lines JSON.");
            return;
        }
        setSubmitting(true);
        try {
            const sourceIdValue = sourceId.trim() || `manual-${Date.now()}`;
            const result = await generalLedgerApi.createJournalEntry({
                tenantId,
                organizationId,
                date,
                reference,
                sourceModule,
                sourceId: sourceIdValue,
                memo,
                status: "POSTED",
                lines
            });
            setMessage(`Journal entry created: ${result.journalEntryId}`);
            setSourceId(sourceIdValue);
            await refresh();
            await loadDetail(result.journalEntryId);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create journal entry.");
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsxs("section", { style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { style: { marginTop: 0 }, children: "Journal Entries" }), _jsxs("form", { onSubmit: submitManualEntry, style: { marginBottom: 12 }, children: [_jsx("h4", { style: { marginTop: 0 }, children: "Create Manual Journal Entry" }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 8 }, children: [_jsxs("label", { children: ["Date", _jsx("input", { style: { display: "block", width: "100%" }, type: "date", value: date, onChange: (event) => setDate(event.target.value), required: true })] }), _jsxs("label", { children: ["Reference", _jsx("input", { style: { display: "block", width: "100%" }, value: reference, onChange: (event) => setReference(event.target.value), placeholder: "INV-1004", required: true })] }), _jsxs("label", { children: ["Source Module", _jsx("input", { style: { display: "block", width: "100%" }, value: sourceModule, onChange: (event) => setSourceModule(event.target.value), placeholder: "manual", required: true })] }), _jsxs("label", { children: ["Source ID", _jsx("input", { style: { display: "block", width: "100%" }, value: sourceId, onChange: (event) => setSourceId(event.target.value), placeholder: "manual-2026-03-09-1" })] })] }), _jsxs("label", { style: { display: "block", marginTop: 8 }, children: ["Memo", _jsx("input", { style: { display: "block", width: "100%" }, value: memo, onChange: (event) => setMemo(event.target.value), placeholder: "Manual adjusting entry" })] }), _jsxs("label", { style: { display: "block", marginTop: 8 }, children: ["Lines JSON", _jsx("textarea", { style: { display: "block", width: "100%", minHeight: 140 }, value: linesJson, onChange: (event) => setLinesJson(event.target.value) })] }), _jsxs("div", { style: { display: "flex", gap: 8, marginTop: 8 }, children: [_jsx("button", { type: "submit", disabled: !canRun || submitting, children: "Create Journal Entry" }), _jsx("button", { type: "button", onClick: refresh, disabled: !canRun || loading, children: "Refresh List" }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: 6 }, children: ["Status Filter", _jsxs("select", { value: statusFilter, onChange: (event) => setStatusFilter(event.target.value), children: [_jsx("option", { value: "", children: "All" }), _jsx("option", { value: "POSTED", children: "POSTED" }), _jsx("option", { value: "DRAFT", children: "DRAFT" })] })] })] })] }), error ? _jsx("p", { style: { color: "#cf222e" }, children: error }) : null, message ? _jsx("p", { style: { color: "#1a7f37" }, children: message }) : null, loading ? _jsx("p", { children: "Loading journal entries..." }) : null, !loading && rows.length > 0 ? (_jsxs("table", { style: { width: "100%", borderCollapse: "collapse", marginBottom: 10 }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { align: "left", children: "Date" }), _jsx("th", { align: "left", children: "Reference" }), _jsx("th", { align: "left", children: "Source" }), _jsx("th", { align: "left", children: "Debit" }), _jsx("th", { align: "left", children: "Credit" }), _jsx("th", { align: "left", children: "Status" }), _jsx("th", { align: "left", children: "Actions" })] }) }), _jsx("tbody", { children: rows.map((row) => (_jsxs("tr", { children: [_jsx("td", { children: row.date }), _jsx("td", { children: row.reference }), _jsxs("td", { children: [row.sourceModule, ":", row.sourceId] }), _jsx("td", { children: row.totalDebit.toFixed(2) }), _jsx("td", { children: row.totalCredit.toFixed(2) }), _jsx("td", { children: row.status }), _jsx("td", { children: _jsx("button", { type: "button", onClick: () => loadDetail(row.id), disabled: detailLoading, children: "View Detail" }) })] }, row.id))) })] })) : null, detailLoading ? _jsx("p", { children: "Loading detail..." }) : null, !detailLoading && selected ? (_jsxs("section", { style: { borderTop: "1px solid #d0d7de", paddingTop: 10 }, children: [_jsx("h4", { style: { marginTop: 0 }, children: "Journal Entry Detail" }), _jsxs("p", { children: [_jsx("strong", { children: selected.reference }), " (", selected.status, ") | ", selected.date, " | ", selected.sourceModule, ":", selected.sourceId] }), _jsxs("p", { children: ["Total Debit: ", selected.totalDebit.toFixed(2), " | Total Credit: ", selected.totalCredit.toFixed(2), " | Period:", " ", selected.periodKey] }), _jsxs("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { align: "left", children: "Account" }), _jsx("th", { align: "left", children: "Debit" }), _jsx("th", { align: "left", children: "Credit" }), _jsx("th", { align: "left", children: "Class" }), _jsx("th", { align: "left", children: "Tag" }), _jsx("th", { align: "left", children: "Memo" })] }) }), _jsx("tbody", { children: selected.lines.map((line, index) => (_jsxs("tr", { children: [_jsxs("td", { children: [line.accountNumber, " ", line.accountName] }), _jsx("td", { children: line.debit.toFixed(2) }), _jsx("td", { children: line.credit.toFixed(2) }), _jsx("td", { children: line.className }), _jsx("td", { children: line.tagName }), _jsx("td", { children: line.memo })] }, `${line.accountId}-${index}`))) })] })] })) : null] }));
}
