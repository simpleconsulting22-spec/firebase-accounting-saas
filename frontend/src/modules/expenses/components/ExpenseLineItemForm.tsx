import { FormEvent, useEffect, useState } from "react";
import { expensesApi } from "../services";

interface ExpenseLineItemFormProps {
  tenantId: string;
  organizationId: string;
  defaultRequestId?: string;
  defaultReportId?: string;
}

export function ExpenseLineItemForm({
  tenantId,
  organizationId,
  defaultRequestId,
  defaultReportId
}: ExpenseLineItemFormProps) {
  const [requestId, setRequestId] = useState(defaultRequestId || "");
  const [reportId, setReportId] = useState(defaultReportId || "");
  const [lineItemId, setLineItemId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("0");
  const [expenseDate, setExpenseDate] = useState("");
  const [description, setDescription] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setRequestId(defaultRequestId || "");
  }, [defaultRequestId]);

  useEffect(() => {
    setReportId(defaultReportId || "");
  }, [defaultReportId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    setError("");

    try {
      if (!tenantId || !organizationId || !requestId || !reportId) {
        throw new Error("tenantId, organizationId, requestId, and reportId are required.");
      }

      const result = await expensesApi.upsertExpenseLineItem({
        tenantId,
        organizationId,
        requestId,
        reportId,
        lineItemId: lineItemId || undefined,
        vendorId,
        categoryId,
        amount: Number(amount),
        expenseDate,
        description,
        receiptUrl: receiptUrl || undefined
      });

      setFeedback(
        `${lineItemId ? "Updated" : "Added"} line item ${result.lineItemId}. Actual request amount: ${result.actualAmount}.`
      );
      setLineItemId(result.lineItemId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add/update line item.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <h4 style={{ marginTop: 0 }}>Add / Update Expense Line Item</h4>
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
        Line Item ID (optional for update)
        <input
          style={{ display: "block", width: "100%" }}
          value={lineItemId}
          onChange={(event) => setLineItemId(event.target.value)}
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Vendor ID
        <input
          style={{ display: "block", width: "100%" }}
          value={vendorId}
          onChange={(event) => setVendorId(event.target.value)}
          required
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Category ID
        <input
          style={{ display: "block", width: "100%" }}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          required
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Amount
        <input
          type="number"
          min="0.01"
          step="0.01"
          style={{ display: "block", width: "100%" }}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Expense Date
        <input
          type="date"
          style={{ display: "block", width: "100%" }}
          value={expenseDate}
          onChange={(event) => setExpenseDate(event.target.value)}
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
        Receipt URL (optional)
        <input
          style={{ display: "block", width: "100%" }}
          value={receiptUrl}
          onChange={(event) => setReceiptUrl(event.target.value)}
        />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? "Saving..." : lineItemId ? "Update Line Item" : "Add Line Item"}
      </button>
      {feedback ? <p style={{ color: "#1a7f37" }}>{feedback}</p> : null}
      {error ? <p style={{ color: "#cf222e" }}>{error}</p> : null}
    </form>
  );
}
