import { FormEvent, useEffect, useState } from "react";
import { expensesApi } from "../services";
import { ExpenseReportApprovalAction, PurchaseRequestApprovalAction } from "../types";

interface ApprovalActionsPanelProps {
  tenantId: string;
  organizationId: string;
  defaultRequestId?: string;
  defaultReportId?: string;
}

export function ApprovalActionsPanel({
  tenantId,
  organizationId,
  defaultRequestId,
  defaultReportId
}: ApprovalActionsPanelProps) {
  const [requestId, setRequestId] = useState(defaultRequestId || "");
  const [reportId, setReportId] = useState(defaultReportId || "");
  const [prAction, setPrAction] = useState<PurchaseRequestApprovalAction>("APPROVE");
  const [prComments, setPrComments] = useState("");
  const [erAction, setErAction] = useState<ExpenseReportApprovalAction>("SUBMIT");
  const [erComments, setErComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setRequestId(defaultRequestId || "");
  }, [defaultRequestId]);

  useEffect(() => {
    setReportId(defaultReportId || "");
  }, [defaultReportId]);

  const ensureScope = () => {
    if (!tenantId || !organizationId) {
      throw new Error("tenantId and organizationId are required.");
    }
  };

  const submitPrAction = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setResult("");
    setError("");

    try {
      ensureScope();
      const response = await expensesApi.applyPurchaseRequestApprovalAction({
        tenantId,
        organizationId,
        requestId,
        action: prAction,
        comments: prComments || undefined
      });
      setResult(`Purchase request ${response.requestId} moved to ${response.status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply purchase request action.");
    } finally {
      setBusy(false);
    }
  };

  const submitErAction = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setResult("");
    setError("");

    try {
      ensureScope();
      const response = await expensesApi.applyExpenseReportApprovalAction({
        tenantId,
        organizationId,
        requestId,
        reportId,
        action: erAction,
        comments: erComments || undefined
      });
      setResult(
        `Expense report ${response.reportId} is ${response.reportStatus}; request ${response.requestId} is ${response.requestStatus}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply expense report action.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <h4 style={{ marginTop: 0 }}>Approval Actions</h4>
      <p style={{ marginTop: 0 }}>
        Roles: approver/admin for PR actions, requestor/admin for ER submit, finance/admin for ER review/payment.
      </p>

      <form onSubmit={submitPrAction} style={{ marginBottom: 16 }}>
        <h5 style={{ marginBottom: 8 }}>Purchase Request Approval</h5>
        <label style={{ display: "block", marginBottom: 8 }}>
          Request ID
          <input
            style={{ display: "block", width: "100%" }}
            value={requestId}
            onChange={(event) => setRequestId(event.target.value)}
            required
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Action
          <select
            style={{ display: "block", width: "100%" }}
            value={prAction}
            onChange={(event) => setPrAction(event.target.value as PurchaseRequestApprovalAction)}
          >
            <option value="APPROVE">Approve</option>
            <option value="REJECT">Reject</option>
            <option value="REQUEST_REVISIONS">Request Revisions</option>
          </select>
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Comments (optional)
          <input
            style={{ display: "block", width: "100%" }}
            value={prComments}
            onChange={(event) => setPrComments(event.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Applying..." : "Apply PR Action"}
        </button>
      </form>

      <form onSubmit={submitErAction}>
        <h5 style={{ marginBottom: 8 }}>Expense Report Action</h5>
        <label style={{ display: "block", marginBottom: 8 }}>
          Request ID
          <input
            style={{ display: "block", width: "100%" }}
            value={requestId}
            onChange={(event) => setRequestId(event.target.value)}
            required
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Report ID
          <input
            style={{ display: "block", width: "100%" }}
            value={reportId}
            onChange={(event) => setReportId(event.target.value)}
            required
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Action
          <select
            style={{ display: "block", width: "100%" }}
            value={erAction}
            onChange={(event) => setErAction(event.target.value as ExpenseReportApprovalAction)}
          >
            <option value="SUBMIT">Submit (Requestor/Admin)</option>
            <option value="APPROVE">Approve (Finance/Admin)</option>
            <option value="REJECT">Reject (Finance/Admin)</option>
            <option value="REQUEST_REVISIONS">Request Revisions (Finance/Admin)</option>
            <option value="MARK_PAID">Mark Paid (Finance/Admin)</option>
          </select>
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Comments (optional)
          <input
            style={{ display: "block", width: "100%" }}
            value={erComments}
            onChange={(event) => setErComments(event.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Applying..." : "Apply ER Action"}
        </button>
      </form>

      {result ? <p style={{ color: "#1a7f37" }}>{result}</p> : null}
      {error ? <p style={{ color: "#cf222e" }}>{error}</p> : null}
    </section>
  );
}
