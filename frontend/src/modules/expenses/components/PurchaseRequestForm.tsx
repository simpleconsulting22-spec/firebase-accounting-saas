import { FormEvent, useEffect, useState } from "react";
import { expensesApi } from "../services";

interface PurchaseRequestFormProps {
  mode: "create" | "update";
  tenantId: string;
  organizationId: string;
  defaultRequestId?: string;
  onRequestSaved: (requestId: string) => void;
}

export function PurchaseRequestForm({
  mode,
  tenantId,
  organizationId,
  defaultRequestId,
  onRequestSaved
}: PurchaseRequestFormProps) {
  const [requestId, setRequestId] = useState(defaultRequestId || "");
  const [fundId, setFundId] = useState("");
  const [ministryDepartment, setMinistryDepartment] = useState("");
  const [approverId, setApproverId] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("0");
  const [plannedPaymentMethod, setPlannedPaymentMethod] = useState("");
  const [purpose, setPurpose] = useState("");
  const [description, setDescription] = useState("");
  const [requestedExpenseDate, setRequestedExpenseDate] = useState("");
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
      if (!tenantId || !organizationId) {
        throw new Error("tenantId and organizationId are required.");
      }

      const basePayload = {
        tenantId,
        organizationId,
        fundId,
        ministryDepartment,
        approverId,
        estimatedAmount: Number(estimatedAmount),
        plannedPaymentMethod,
        purpose,
        description,
        requestedExpenseDate
      };

      const result =
        mode === "create"
          ? await expensesApi.createPurchaseRequest(basePayload)
          : await expensesApi.updateDraftPurchaseRequest({
              ...basePayload,
              requestId
            });

      onRequestSaved(result.requestId);
      setFeedback(`Saved request ${result.requestId} (${result.status}).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save purchase request.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <h4 style={{ marginTop: 0 }}>
        {mode === "create" ? "Create Purchase Request (Draft)" : "Update Draft Purchase Request"}
      </h4>
      {mode === "update" ? (
        <label style={{ display: "block", marginBottom: 8 }}>
          Request ID
          <input
            style={{ display: "block", width: "100%" }}
            value={requestId}
            onChange={(event) => setRequestId(event.target.value)}
            required
          />
        </label>
      ) : null}
      <label style={{ display: "block", marginBottom: 8 }}>
        Fund ID
        <input
          style={{ display: "block", width: "100%" }}
          value={fundId}
          onChange={(event) => setFundId(event.target.value)}
          required
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Ministry Department
        <input
          style={{ display: "block", width: "100%" }}
          value={ministryDepartment}
          onChange={(event) => setMinistryDepartment(event.target.value)}
          required
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Approver User ID
        <input
          style={{ display: "block", width: "100%" }}
          value={approverId}
          onChange={(event) => setApproverId(event.target.value)}
          required
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Estimated Amount
        <input
          type="number"
          min="0"
          step="0.01"
          style={{ display: "block", width: "100%" }}
          value={estimatedAmount}
          onChange={(event) => setEstimatedAmount(event.target.value)}
          required
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Planned Payment Method
        <input
          style={{ display: "block", width: "100%" }}
          value={plannedPaymentMethod}
          onChange={(event) => setPlannedPaymentMethod(event.target.value)}
          required
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Purpose
        <input
          style={{ display: "block", width: "100%" }}
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          required
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Description
        <textarea
          style={{ display: "block", width: "100%" }}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Requested Expense Date
        <input
          type="date"
          style={{ display: "block", width: "100%" }}
          value={requestedExpenseDate}
          onChange={(event) => setRequestedExpenseDate(event.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? "Saving..." : mode === "create" ? "Create Draft" : "Update Draft"}
      </button>
      {feedback ? <p style={{ color: "#1a7f37" }}>{feedback}</p> : null}
      {error ? <p style={{ color: "#cf222e" }}>{error}</p> : null}
    </form>
  );
}
