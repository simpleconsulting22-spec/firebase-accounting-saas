import { FormEvent, useEffect, useMemo, useState } from "react";
import { generalLedgerApi } from "../services";
import { AccountPostingRole, AccountType, ChartOfAccountRecord } from "../types";

interface ChartOfAccountsPanelProps {
  tenantId: string;
  organizationId: string;
}

interface AccountFormState {
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  parentAccountId: string;
  postingRole: string;
  active: boolean;
}

const DEFAULT_FORM: AccountFormState = {
  accountNumber: "",
  accountName: "",
  accountType: "expense",
  parentAccountId: "",
  postingRole: "",
  active: true
};

export function ChartOfAccountsPanel({ tenantId, organizationId }: ChartOfAccountsPanelProps) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [rows, setRows] = useState<ChartOfAccountRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<AccountFormState>(DEFAULT_FORM);

  const canRun = Boolean(tenantId && organizationId);
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const byNumber = String(a.accountNumber || "").localeCompare(String(b.accountNumber || ""));
        if (byNumber !== 0) {
          return byNumber;
        }
        return String(a.accountName || "").localeCompare(String(b.accountName || ""));
      }),
    [rows]
  );

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chart of accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [tenantId, organizationId, includeInactive]);

  const onSubmit = async (event: FormEvent) => {
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
          postingRole: postingRole ? (postingRole as AccountPostingRole) : null,
          active: form.active
        });
        setMessage("Account updated.");
      } else {
        await generalLedgerApi.createChartOfAccount({
          tenantId,
          organizationId,
          accountNumber,
          accountName,
          accountType: form.accountType,
          parentAccountId: parentAccountId || undefined,
          postingRole: postingRole ? (postingRole as AccountPostingRole) : undefined,
          active: form.active
        });
        setMessage("Account created.");
      }

      setEditingId("");
      setForm(DEFAULT_FORM);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save chart of account.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: ChartOfAccountRecord) => {
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

  const removeAccount = async (accountId: string) => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Chart of Accounts</h3>

      <form onSubmit={onSubmit} style={{ marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 8 }}>
          <label>
            Account Number
            <input
              style={{ display: "block", width: "100%" }}
              value={form.accountNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, accountNumber: event.target.value }))}
              placeholder="6000"
              required
            />
          </label>

          <label>
            Account Name
            <input
              style={{ display: "block", width: "100%" }}
              value={form.accountName}
              onChange={(event) => setForm((prev) => ({ ...prev, accountName: event.target.value }))}
              placeholder="Ministry Expenses"
              required
            />
          </label>

          <label>
            Account Type
            <select
              style={{ display: "block", width: "100%" }}
              value={form.accountType}
              onChange={(event) => setForm((prev) => ({ ...prev, accountType: event.target.value as AccountType }))}
            >
              <option value="asset">asset</option>
              <option value="liability">liability</option>
              <option value="equity">equity</option>
              <option value="income">income</option>
              <option value="expense">expense</option>
            </select>
          </label>

          <label>
            Parent Account ID (optional)
            <input
              style={{ display: "block", width: "100%" }}
              value={form.parentAccountId}
              onChange={(event) => setForm((prev) => ({ ...prev, parentAccountId: event.target.value }))}
              placeholder="parent account document id"
            />
          </label>

          <label>
            Posting Role (optional)
            <select
              style={{ display: "block", width: "100%" }}
              value={form.postingRole}
              onChange={(event) => setForm((prev) => ({ ...prev, postingRole: event.target.value }))}
            >
              <option value="">none</option>
              <option value="expense_default">expense_default</option>
              <option value="cash_default">cash_default</option>
              <option value="payable_default">payable_default</option>
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
            />
            Active
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="submit" disabled={!canRun || saving}>
            {editingId ? "Update Account" : "Create Account"}
          </button>
          {editingId ? (
            <button type="button" onClick={cancelEdit} disabled={saving}>
              Cancel Edit
            </button>
          ) : null}
          <button type="button" onClick={refresh} disabled={!canRun || loading}>
            Refresh List
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Include Inactive
          </label>
        </div>
      </form>

      {error ? <p style={{ color: "#cf222e" }}>{error}</p> : null}
      {message ? <p style={{ color: "#1a7f37" }}>{message}</p> : null}

      {loading ? <p>Loading accounts...</p> : null}
      {!loading && sortedRows.length === 0 ? <p>No accounts found for this organization.</p> : null}

      {!loading && sortedRows.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Number</th>
              <th align="left">Name</th>
              <th align="left">Type</th>
              <th align="left">Posting Role</th>
              <th align="left">Parent</th>
              <th align="left">Active</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.id}>
                <td>{row.accountNumber}</td>
                <td>{row.accountName}</td>
                <td>{row.accountType}</td>
                <td>{row.postingRole || ""}</td>
                <td>{row.parentAccountId || ""}</td>
                <td>{row.active ? "Yes" : "No"}</td>
                <td>
                  <button type="button" onClick={() => startEdit(row)} disabled={saving}>
                    Edit
                  </button>{" "}
                  <button type="button" onClick={() => removeAccount(row.id)} disabled={saving}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
