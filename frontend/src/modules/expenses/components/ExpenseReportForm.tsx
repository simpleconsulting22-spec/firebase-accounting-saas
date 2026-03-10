import { FormEvent, useEffect, useState } from "react";
import { expensesApi } from "../services";

interface ExpenseReportFormProps {
  tenantId: string;
  organizationId: string;
  defaultRequestId?: string;
  onReportReady: (reportId: string) => void;
}

export function ExpenseReportForm({
  tenantId,
  organizationId,
  defaultRequestId,
  onReportReady
}: ExpenseReportFormProps) {
  const [requestId, setRequestId] = useState(defaultRequestId || "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setRequestId(defaultRequestId || "");
  }, [defaultRequestId]);

  const submit = async (event: FormEvent) => {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create expense report.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <h4 style={{ marginTop: 0 }}>Create Expense Report</h4>
      <label style={{ display: "block", marginBottom: 8 }}>
        Request ID
        <input
          style={{ display: "block", width: "100%" }}
          value={requestId}
          onChange={(event) => setRequestId(event.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? "Creating..." : "Create Expense Report"}
      </button>
      {feedback ? <p style={{ color: "#1a7f37" }}>{feedback}</p> : null}
      {error ? <p style={{ color: "#cf222e" }}>{error}</p> : null}
    </form>
  );
}
