import { FormEvent, useState } from "react";
import { expensesApi } from "../services";

interface BudgetSnapshotFormProps {
  tenantId: string;
  organizationId: string;
}

export function BudgetSnapshotForm({ tenantId, organizationId }: BudgetSnapshotFormProps) {
  const [fundId, setFundId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);

  const load = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSnapshot(null);

    try {
      if (!tenantId || !organizationId || !fundId) {
        throw new Error("tenantId, organizationId, and fundId are required.");
      }

      const result = await expensesApi.getBudgetSnapshot({
        tenantId,
        organizationId,
        fundId
      });
      setSnapshot(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load budget snapshot.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={load} style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <h4 style={{ marginTop: 0 }}>Get Budget Snapshot by Fund</h4>
      <label style={{ display: "block", marginBottom: 8 }}>
        Fund ID
        <input
          style={{ display: "block", width: "100%" }}
          value={fundId}
          onChange={(event) => setFundId(event.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? "Loading..." : "Load Budget Snapshot"}
      </button>
      {error ? <p style={{ color: "#cf222e" }}>{error}</p> : null}
      {snapshot ? <pre style={{ overflowX: "auto" }}>{JSON.stringify(snapshot, null, 2)}</pre> : null}
    </form>
  );
}
