import { FormEvent, useState } from "react";
import { accountingExportsApi } from "../services";

interface ExportGeneratorFormProps {
  tenantId: string;
  organizationId: string;
  onGenerated: () => void;
}

export function ExportGeneratorForm({ tenantId, organizationId, onGenerated }: ExportGeneratorFormProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
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
      setMessage(
        `Export ${result.exportId} completed with ${result.rowCount} rows. Type: ${result.exportType}.`
      );
      onGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate export.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Generate QuickBooks Expense Export</h3>
      <p style={{ marginTop: 0 }}>
        Export type: <code>quickbooks_expense_export</code>
      </p>
      <label style={{ display: "block", marginBottom: 8 }}>
        Date From
        <input
          type="date"
          style={{ display: "block", width: "100%" }}
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          required
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Date To
        <input
          type="date"
          style={{ display: "block", width: "100%" }}
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? "Generating..." : "Generate Export"}
      </button>
      {message ? <p style={{ color: "#1a7f37" }}>{message}</p> : null}
      {error ? <p style={{ color: "#cf222e" }}>{error}</p> : null}
    </form>
  );
}
