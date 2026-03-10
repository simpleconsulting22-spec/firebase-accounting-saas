import { FormEvent, useEffect, useState } from "react";
import { generalLedgerApi } from "../services";
import { JournalEntryDetail, JournalEntryLinePayload, JournalEntryListItem } from "../types";

interface JournalEntriesPanelProps {
  tenantId: string;
  organizationId: string;
}

const getTodayDate = (): string => new Date().toISOString().slice(0, 10);

const SAMPLE_LINES = JSON.stringify(
  [
    { accountId: "", debit: 0, credit: 0, memo: "", className: "", tagName: "" },
    { accountId: "", debit: 0, credit: 0, memo: "", className: "", tagName: "" }
  ],
  null,
  2
);

export function JournalEntriesPanel({ tenantId, organizationId }: JournalEntriesPanelProps) {
  const [rows, setRows] = useState<JournalEntryListItem[]>([]);
  const [selected, setSelected] = useState<JournalEntryDetail | null>(null);
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
        status: statusFilter ? (statusFilter as "DRAFT" | "POSTED") : undefined,
        limit: 100
      });
      setRows(data);
      if (selected && !data.some((row) => row.id === selected.id)) {
        setSelected(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load journal entries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [tenantId, organizationId, statusFilter]);

  const loadDetail = async (journalEntryId: string) => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load journal entry detail.");
    } finally {
      setDetailLoading(false);
    }
  };

  const submitManualEntry = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!canRun) {
      setError("tenantId and organizationId are required.");
      return;
    }

    let lines: JournalEntryLinePayload[] = [];
    try {
      const parsed = JSON.parse(linesJson) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error("Lines JSON must be an array.");
      }
      lines = parsed.map((line) => ({
        accountId: String((line as Record<string, unknown>).accountId || ""),
        debit: Number((line as Record<string, unknown>).debit || 0),
        credit: Number((line as Record<string, unknown>).credit || 0),
        memo: String((line as Record<string, unknown>).memo || ""),
        className: String((line as Record<string, unknown>).className || ""),
        tagName: String((line as Record<string, unknown>).tagName || "")
      }));
    } catch (err) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create journal entry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Journal Entries</h3>

      <form onSubmit={submitManualEntry} style={{ marginBottom: 12 }}>
        <h4 style={{ marginTop: 0 }}>Create Manual Journal Entry</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 8 }}>
          <label>
            Date
            <input
              style={{ display: "block", width: "100%" }}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <label>
            Reference
            <input
              style={{ display: "block", width: "100%" }}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="INV-1004"
              required
            />
          </label>
          <label>
            Source Module
            <input
              style={{ display: "block", width: "100%" }}
              value={sourceModule}
              onChange={(event) => setSourceModule(event.target.value)}
              placeholder="manual"
              required
            />
          </label>
          <label>
            Source ID
            <input
              style={{ display: "block", width: "100%" }}
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              placeholder="manual-2026-03-09-1"
            />
          </label>
        </div>

        <label style={{ display: "block", marginTop: 8 }}>
          Memo
          <input
            style={{ display: "block", width: "100%" }}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="Manual adjusting entry"
          />
        </label>

        <label style={{ display: "block", marginTop: 8 }}>
          Lines JSON
          <textarea
            style={{ display: "block", width: "100%", minHeight: 140 }}
            value={linesJson}
            onChange={(event) => setLinesJson(event.target.value)}
          />
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="submit" disabled={!canRun || submitting}>
            Create Journal Entry
          </button>
          <button type="button" onClick={refresh} disabled={!canRun || loading}>
            Refresh List
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Status Filter
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All</option>
              <option value="POSTED">POSTED</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </label>
        </div>
      </form>

      {error ? <p style={{ color: "#cf222e" }}>{error}</p> : null}
      {message ? <p style={{ color: "#1a7f37" }}>{message}</p> : null}
      {loading ? <p>Loading journal entries...</p> : null}

      {!loading && rows.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
          <thead>
            <tr>
              <th align="left">Date</th>
              <th align="left">Reference</th>
              <th align="left">Source</th>
              <th align="left">Debit</th>
              <th align="left">Credit</th>
              <th align="left">Status</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.date}</td>
                <td>{row.reference}</td>
                <td>
                  {row.sourceModule}:{row.sourceId}
                </td>
                <td>{row.totalDebit.toFixed(2)}</td>
                <td>{row.totalCredit.toFixed(2)}</td>
                <td>{row.status}</td>
                <td>
                  <button type="button" onClick={() => loadDetail(row.id)} disabled={detailLoading}>
                    View Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {detailLoading ? <p>Loading detail...</p> : null}
      {!detailLoading && selected ? (
        <section style={{ borderTop: "1px solid #d0d7de", paddingTop: 10 }}>
          <h4 style={{ marginTop: 0 }}>Journal Entry Detail</h4>
          <p>
            <strong>{selected.reference}</strong> ({selected.status}) | {selected.date} | {selected.sourceModule}:
            {selected.sourceId}
          </p>
          <p>
            Total Debit: {selected.totalDebit.toFixed(2)} | Total Credit: {selected.totalCredit.toFixed(2)} | Period:{" "}
            {selected.periodKey}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Account</th>
                <th align="left">Debit</th>
                <th align="left">Credit</th>
                <th align="left">Class</th>
                <th align="left">Tag</th>
                <th align="left">Memo</th>
              </tr>
            </thead>
            <tbody>
              {selected.lines.map((line, index) => (
                <tr key={`${line.accountId}-${index}`}>
                  <td>
                    {line.accountNumber} {line.accountName}
                  </td>
                  <td>{line.debit.toFixed(2)}</td>
                  <td>{line.credit.toFixed(2)}</td>
                  <td>{line.className}</td>
                  <td>{line.tagName}</td>
                  <td>{line.memo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </section>
  );
}
