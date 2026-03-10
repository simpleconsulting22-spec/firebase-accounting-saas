import { FormEvent, useEffect, useState } from "react";
import { expensesApi } from "../services";

interface SubmitPurchaseRequestFormProps {
  tenantId: string;
  organizationId: string;
  defaultRequestId?: string;
}

export function SubmitPurchaseRequestForm({
  tenantId,
  organizationId,
  defaultRequestId
}: SubmitPurchaseRequestFormProps) {
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

      const result = await expensesApi.submitPurchaseRequest({
        tenantId,
        organizationId,
        requestId
      });
      setFeedback(`Submitted request ${result.requestId}. New status: ${result.status}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit purchase request.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <h4 style={{ marginTop: 0 }}>Submit Purchase Request</h4>
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
        {busy ? "Submitting..." : "Submit Request"}
      </button>
      {feedback ? <p style={{ color: "#1a7f37" }}>{feedback}</p> : null}
      {error ? <p style={{ color: "#cf222e" }}>{error}</p> : null}
    </form>
  );
}
