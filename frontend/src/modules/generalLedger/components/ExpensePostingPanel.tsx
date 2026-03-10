import { FormEvent, useState } from "react";
import { generalLedgerApi } from "../services";
import { PostExpenseReportToLedgerResult } from "../types";

interface ExpensePostingPanelProps {
  tenantId: string;
  organizationId: string;
}

export function ExpensePostingPanel({ tenantId, organizationId }: ExpensePostingPanelProps) {
  const [reportId, setReportId] = useState("");
  const [date, setDate] = useState("");
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PostExpenseReportToLedgerResult | null>(null);

  const canRun = Boolean(tenantId && organizationId);

  const onSubmit = async (event: FormEvent) => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post expense report to ledger.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <section style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Expense Posting to Ledger</h3>
      <p>Posts an expense report to immutable journal entries with idempotent source-based protection.</p>
      <form onSubmit={onSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 8 }}>
          <label>
            Expense Report ID
            <input
              style={{ display: "block", width: "100%" }}
              value={reportId}
              onChange={(event) => setReportId(event.target.value)}
              placeholder="expense report document id"
              required
            />
          </label>
          <label>
            Override Date (optional)
            <input
              style={{ display: "block", width: "100%" }}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label>
            Override Reference (optional)
            <input
              style={{ display: "block", width: "100%" }}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="ER-REQ-2026-001"
            />
          </label>
          <label>
            Override Memo (optional)
            <input
              style={{ display: "block", width: "100%" }}
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="Expense posting entry"
            />
          </label>
        </div>
        <button type="submit" disabled={!canRun || posting} style={{ marginTop: 8 }}>
          Post Expense Report
        </button>
      </form>

      {error ? <p style={{ color: "#cf222e" }}>{error}</p> : null}
      {result ? (
        <p style={{ color: "#1a7f37" }}>
          Posted report {result.reportId} to journal entry {result.journalEntryId} (period {result.periodKey}).{" "}
          {result.existed ? "Existing posted entry reused." : "New entry created."}
        </p>
      ) : null}
    </section>
  );
}
