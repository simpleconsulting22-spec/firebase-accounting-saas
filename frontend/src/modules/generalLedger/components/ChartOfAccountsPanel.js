import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { generalLedgerApi } from "../services";
const DEFAULT_FORM = {
    accountNumber: "",
    accountName: "",
    accountType: "expense",
    parentAccountId: "",
    postingRole: "",
    active: true
};
export function ChartOfAccountsPanel({ tenantId, organizationId }) {
    const [includeInactive, setIncludeInactive] = useState(false);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [editingId, setEditingId] = useState("");
    const [form, setForm] = useState(DEFAULT_FORM);
    const canRun = Boolean(tenantId && organizationId);
    const sortedRows = useMemo(() => [...rows].sort((a, b) => {
        const byNumber = String(a.accountNumber || "").localeCompare(String(b.accountNumber || ""));
        if (byNumber !== 0) {
            return byNumber;
        }
        return String(a.accountName || "").localeCompare(String(b.accountName || ""));
    }), [rows]);
    const refresh = async () => {
        setError("");
        setMessage("");
        if (!canRun) {
            setRows([]);
            return;
        }
        setLoading(true);
        try {
            const data = await generalLedgerApi.listChartOfAccounts({
                tenantId,
                organizationId,
                includeInactive
            });
            setRows(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load chart of accounts.");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void refresh();
    }, [tenantId, organizationId, includeInactive]);
    const onSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        if (!canRun) {
            setError("tenantId and organizationId are required.");
            return;
        }
        setSaving(true);
        try {
            const accountNumber = form.accountNumber.trim();
            const accountName = form.accountName.trim();
            const parentAccountId = form.parentAccountId.trim();
            const postingRole = form.postingRole.trim();
            if (editingId) {
                await generalLedgerApi.updateChartOfAccount({
                    tenantId,
                    organizationId,
                    accountId: editingId,
                    accountNumber,
                    accountName,
                    accountType: form.accountType,
                    parentAccountId: parentAccountId || null,
                    postingRole: postingRole ? postingRole : null,
                    active: form.active
                });
                setMessage("Account updated.");
            }
            else {
                await generalLedgerApi.createChartOfAccount({
                    tenantId,
                    organizationId,
                    accountNumber,
                    accountName,
                    accountType: form.accountType,
                    parentAccountId: parentAccountId || undefined,
                    postingRole: postingRole ? postingRole : undefined,
                    active: form.active
                });
                setMessage("Account created.");
            }
            setEditingId("");
            setForm(DEFAULT_FORM);
            await refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save chart of account.");
        }
        finally {
            setSaving(false);
        }
    };
    const startEdit = (row) => {
        setEditingId(row.id);
        setForm({
            accountNumber: row.accountNumber || "",
            accountName: row.accountName || "",
            accountType: row.accountType || "expense",
            parentAccountId: String(row.parentAccountId || ""),
            postingRole: String(row.postingRole || ""),
            active: Boolean(row.active)
        });
        setMessage("");
        setError("");
    };
    const cancelEdit = () => {
        setEditingId("");
        setForm(DEFAULT_FORM);
        setMessage("");
        setError("");
    };
    const removeAccount = async (accountId) => {
        if (!canRun) {
            return;
        }
        const confirmed = window.confirm("Delete this account?");
        if (!confirmed) {
            return;
        }
        setError("");
        setMessage("");
        setSaving(true);
        try {
            await generalLedgerApi.deleteChartOfAccount({
                tenantId,
                organizationId,
                accountId
            });
            setMessage("Account deleted.");
            await refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete account.");
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs("section", { style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { style: { marginTop: 0 }, children: "Chart of Accounts" }), _jsxs("form", { onSubmit: onSubmit, style: { marginBottom: 12 }, children: [_jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 8 }, children: [_jsxs("label", { children: ["Account Number", _jsx("input", { style: { display: "block", width: "100%" }, value: form.accountNumber, onChange: (event) => setForm((prev) => ({ ...prev, accountNumber: event.target.value })), placeholder: "6000", required: true })] }), _jsxs("label", { children: ["Account Name", _jsx("input", { style: { display: "block", width: "100%" }, value: form.accountName, onChange: (event) => setForm((prev) => ({ ...prev, accountName: event.target.value })), placeholder: "Ministry Expenses", required: true })] }), _jsxs("label", { children: ["Account Type", _jsxs("select", { style: { display: "block", width: "100%" }, value: form.accountType, onChange: (event) => setForm((prev) => ({ ...prev, accountType: event.target.value })), children: [_jsx("option", { value: "asset", children: "asset" }), _jsx("option", { value: "liability", children: "liability" }), _jsx("option", { value: "equity", children: "equity" }), _jsx("option", { value: "income", children: "income" }), _jsx("option", { value: "expense", children: "expense" })] })] }), _jsxs("label", { children: ["Parent Account ID (optional)", _jsx("input", { style: { display: "block", width: "100%" }, value: form.parentAccountId, onChange: (event) => setForm((prev) => ({ ...prev, parentAccountId: event.target.value })), placeholder: "parent account document id" })] }), _jsxs("label", { children: ["Posting Role (optional)", _jsxs("select", { style: { display: "block", width: "100%" }, value: form.postingRole, onChange: (event) => setForm((prev) => ({ ...prev, postingRole: event.target.value })), children: [_jsx("option", { value: "", children: "none" }), _jsx("option", { value: "expense_default", children: "expense_default" }), _jsx("option", { value: "cash_default", children: "cash_default" }), _jsx("option", { value: "payable_default", children: "payable_default" })] })] }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 20 }, children: [_jsx("input", { type: "checkbox", checked: form.active, onChange: (event) => setForm((prev) => ({ ...prev, active: event.target.checked })) }), "Active"] })] }), _jsxs("div", { style: { display: "flex", gap: 8, marginTop: 10 }, children: [_jsx("button", { type: "submit", disabled: !canRun || saving, children: editingId ? "Update Account" : "Create Account" }), editingId ? (_jsx("button", { type: "button", onClick: cancelEdit, disabled: saving, children: "Cancel Edit" })) : null, _jsx("button", { type: "button", onClick: refresh, disabled: !canRun || loading, children: "Refresh List" }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [_jsx("input", { type: "checkbox", checked: includeInactive, onChange: (event) => setIncludeInactive(event.target.checked) }), "Include Inactive"] })] })] }), error ? _jsx("p", { style: { color: "#cf222e" }, children: error }) : null, message ? _jsx("p", { style: { color: "#1a7f37" }, children: message }) : null, loading ? _jsx("p", { children: "Loading accounts..." }) : null, !loading && sortedRows.length === 0 ? _jsx("p", { children: "No accounts found for this organization." }) : null, !loading && sortedRows.length > 0 ? (_jsxs("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { align: "left", children: "Number" }), _jsx("th", { align: "left", children: "Name" }), _jsx("th", { align: "left", children: "Type" }), _jsx("th", { align: "left", children: "Posting Role" }), _jsx("th", { align: "left", children: "Parent" }), _jsx("th", { align: "left", children: "Active" }), _jsx("th", { align: "left", children: "Actions" })] }) }), _jsx("tbody", { children: sortedRows.map((row) => (_jsxs("tr", { children: [_jsx("td", { children: row.accountNumber }), _jsx("td", { children: row.accountName }), _jsx("td", { children: row.accountType }), _jsx("td", { children: row.postingRole || "" }), _jsx("td", { children: row.parentAccountId || "" }), _jsx("td", { children: row.active ? "Yes" : "No" }), _jsxs("td", { children: [_jsx("button", { type: "button", onClick: () => startEdit(row), disabled: saving, children: "Edit" }), " ", _jsx("button", { type: "button", onClick: () => removeAccount(row.id), disabled: saving, children: "Delete" })] })] }, row.id))) })] })) : null] }));
}
