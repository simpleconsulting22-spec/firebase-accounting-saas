import { FormEvent, useEffect, useState } from "react";
import { expensesApi } from "../services";
import { PurchaseRequestDetailResponse } from "../types";

interface PurchaseRequestDetailProps {
  tenantId: string;
  organizationId: string;
  defaultRequestId?: string;
}

export function PurchaseRequestDetail({ tenantId, organizationId, defaultRequestId }: PurchaseRequestDetailProps) {
  const [requestId, setRequestId] = useState(defaultRequestId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<PurchaseRequestDetailResponse | null>(null);

  useEffect(() => {
    setRequestId(defaultRequestId || "");
  }, [defaultRequestId]);

  const load = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setDetail(null);

    try {
      if (!tenantId || !organizationId || !requestId) {
        throw new Error("tenantId, organizationId, and requestId are required.");
      }

      const result = await expensesApi.getPurchaseRequestDetail({
        tenantId,
        organizationId,
        requestId
      });
      setDetail(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load request detail.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12 }}>
      <h4 style={{ marginTop: 0 }}>Get Purchase Request Detail</h4>
      <form onSubmit={load}>
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
          {busy ? "Loading..." : "Load Detail"}
        </button>
      </form>
      {error ? <p style={{ color: "#cf222e" }}>{error}</p> : null}
      {detail ? (
        <div style={{ marginTop: 12 }}>
          <h5>Budget Snapshot</h5>
          <pre style={{ overflowX: "auto" }}>{JSON.stringify(detail.budgetSnapshot, null, 2)}</pre>
          <h5>Request</h5>
          <pre style={{ overflowX: "auto" }}>{JSON.stringify(detail.request, null, 2)}</pre>
          <h5>Expense Report</h5>
          <pre style={{ overflowX: "auto" }}>{JSON.stringify(detail.expenseReport, null, 2)}</pre>
          <h5>Line Items</h5>
          <pre style={{ overflowX: "auto" }}>{JSON.stringify(detail.lineItems, null, 2)}</pre>
          <h5>Approval History</h5>
          <pre style={{ overflowX: "auto" }}>{JSON.stringify(detail.approvals, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}
