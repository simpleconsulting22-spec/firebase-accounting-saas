import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  doc, getDoc,
  collection, query, where, getDocs, orderBy,
} from "firebase/firestore";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "../firebase";
import { expensesApi } from "../modules/expenses/services";
import { useUserContext } from "../contexts/UserContext";
import { StatusBadge } from "./Dashboard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PRDoc {
  id: string;
  purpose: string;
  description: string;
  status: string;
  estimatedAmount: number;
  approvedAmount: number;
  actualAmount: number;
  fundId: string;
  ministryDepartment: string;
  requestorId: string;
  approverId: string;
  plannedPaymentMethod: string;
  requestedExpenseDate: string;
  createdAt: string;
  updatedAt: string;
}

interface ERDoc {
  id: string;
  status: string;
}

interface LineItemDoc {
  id: string;
  vendorId: string;
  categoryId: string;
  amount: number;
  expenseDate: string;
  description: string;
}

interface ApprovalDoc {
  id: string;
  step: string;
  decision: string;
  approvedBy: string;
  comments: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (val: unknown): string => {
  if (!val) return "—";
  // Firestore Timestamp arrives as { seconds, nanoseconds }
  if (typeof val === "object" && "seconds" in (val as object)) {
    return new Date((val as { seconds: number }).seconds * 1000).toLocaleDateString();
  }
  return String(val);
};

const fmtMoney = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const row = (label: string, value: React.ReactNode) => (
  <tr key={label}>
    <td style={{ padding: "8px 0", fontSize: 12, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", width: 160, verticalAlign: "top" }}>
      {label}
    </td>
    <td style={{ padding: "8px 0 8px 16px", fontSize: 14, color: "#111827" }}>{value}</td>
  </tr>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, activeOrgId, canApprove, canRequestExpense, canFinanceReview } = useUserContext();

  const [request, setRequest] = useState<PRDoc | null>(null);
  const [expenseReport, setExpenseReport] = useState<ERDoc | null>(null);
  const [lineItems, setLineItems] = useState<LineItemDoc[]>([]);
  const [approvals, setApprovals] = useState<ApprovalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Line item form state
  const [showLineItemForm, setShowLineItemForm] = useState(false);
  const [liVendorId, setLiVendorId] = useState("");
  const [liCategoryId, setLiCategoryId] = useState("");
  const [liAmount, setLiAmount] = useState("");
  const [liDate, setLiDate] = useState("");
  const [liDescription, setLiDescription] = useState("");
  const [liBusy, setLiBusy] = useState(false);
  const [liError, setLiError] = useState("");

  // Approval action state
  const [prAction, setPrAction] = useState<"APPROVE" | "REJECT" | "REQUEST_REVISIONS">("APPROVE");
  const [erAction, setErAction] = useState<"APPROVE" | "REJECT" | "REQUEST_REVISIONS" | "MARK_PAY">("APPROVE");
  const [comments, setComments] = useState("");

  const load = useCallback(async () => {
    if (!id || !profile || !activeOrgId) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "purchaseRequests", id));
      if (!snap.exists()) { navigate("/requests"); return; }

      const d = snap.data() as Record<string, unknown>;
      setRequest({
        id: snap.id,
        purpose: String(d.purpose || ""),
        description: String(d.description || ""),
        status: String(d.status || ""),
        estimatedAmount: Number(d.estimatedAmount || 0),
        approvedAmount: Number(d.approvedAmount || 0),
        actualAmount: Number(d.actualAmount || 0),
        fundId: String(d.fundId || ""),
        ministryDepartment: String(d.ministryDepartment || ""),
        requestorId: String(d.requestorId || ""),
        approverId: String(d.approverId || ""),
        plannedPaymentMethod: String(d.plannedPaymentMethod || ""),
        requestedExpenseDate: fmtDate(d.requestedExpenseDate),
        createdAt: fmtDate(d.createdAt),
        updatedAt: fmtDate(d.updatedAt),
      });

      const base = [
        where("tenantId", "==", profile.tenantId),
        where("organizationId", "==", activeOrgId),
        where("requestId", "==", id),
      ];

      const [erSnap, liSnap, appSnap] = await Promise.all([
        getDocs(query(collection(db, "expenseReports"), ...base, orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "expenseLineItems"), ...base, orderBy("expenseDate", "asc"))),
        getDocs(query(collection(db, "approvals"), ...base, orderBy("createdAt", "asc"))),
      ]);

      setExpenseReport(erSnap.empty ? null : {
        id: erSnap.docs[0].id,
        status: String(erSnap.docs[0].data().status || ""),
      });
      setLineItems(liSnap.docs.map((x) => ({
        id: x.id,
        vendorId: String(x.data().vendorId || ""),
        categoryId: String(x.data().categoryId || ""),
        amount: Number(x.data().amount || 0),
        expenseDate: fmtDate(x.data().expenseDate),
        description: String(x.data().description || ""),
      })));
      setApprovals(appSnap.docs.map((x) => ({
        id: x.id,
        step: String(x.data().step || ""),
        decision: String(x.data().decision || ""),
        approvedBy: String(x.data().approvedBy || ""),
        comments: String(x.data().comments || ""),
        createdAt: fmtDate(x.data().createdAt),
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, profile, activeOrgId, navigate]);

  useEffect(() => { load(); }, [load]);

  const withAction = async (fn: () => Promise<void>) => {
    setActionBusy(true);
    setActionError("");
    setActionSuccess("");
    try {
      await fn();
      await load();
      setActionSuccess("Action completed.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionBusy(false);
    }
  };

  const doSubmitPR = () => withAction(async () => {
    await expensesApi.submitPurchaseRequest({ tenantId: profile!.tenantId, organizationId: activeOrgId, requestId: id! });
  });

  const doApprovePR = (e: FormEvent) => {
    e.preventDefault();
    withAction(async () => {
      await expensesApi.applyPurchaseRequestApprovalAction({ tenantId: profile!.tenantId, organizationId: activeOrgId, requestId: id!, action: prAction, comments });
      setComments("");
    });
  };

  const doCreateExpenseReport = () => withAction(async () => {
    await expensesApi.createExpenseReport({ tenantId: profile!.tenantId, organizationId: activeOrgId, requestId: id! });
  });

  const doSubmitExpenseReport = () => withAction(async () => {
    if (!expenseReport) return;
    await expensesApi.applyExpenseReportApprovalAction({ tenantId: profile!.tenantId, organizationId: activeOrgId, requestId: id!, reportId: expenseReport.id, action: "SUBMIT" });
  });

  const doERAction = (e: FormEvent) => {
    e.preventDefault();
    withAction(async () => {
      if (!expenseReport) return;
      await expensesApi.applyExpenseReportApprovalAction({ tenantId: profile!.tenantId, organizationId: activeOrgId, requestId: id!, reportId: expenseReport.id, action: erAction, comments });
      setComments("");
    });
  };

  const doAddLineItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!expenseReport) return;
    setLiBusy(true);
    setLiError("");
    try {
      await expensesApi.upsertExpenseLineItem({
        tenantId: profile!.tenantId,
        organizationId: activeOrgId,
        requestId: id!,
        reportId: expenseReport.id,
        vendorId: liVendorId,
        categoryId: liCategoryId,
        amount: parseFloat(liAmount),
        expenseDate: liDate,
        description: liDescription,
      });
      setLiVendorId(""); setLiCategoryId(""); setLiAmount(""); setLiDate(""); setLiDescription("");
      setShowLineItemForm(false);
      await load();
    } catch (err) {
      setLiError(err instanceof Error ? err.message : "Failed to add line item.");
    } finally {
      setLiBusy(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: "#9ca3af" }}>Loading request...</div>;
  }
  if (!request) {
    return <div style={{ padding: 24 }}>Request not found. <Link to="/requests">Back</Link></div>;
  }

  const status = request.status;
  const isMyRequest = request.requestorId === profile?.uid;
  const isEditable = (status === "DRAFT" || status === "REQUEST_REVISIONS_NEEDED") && isMyRequest && canRequestExpense;
  const canSubmitPR = isEditable;
  const canDoPRApproval = status === "AWAITING_PREAPPROVAL" && canApprove;
  const canCreateER = status === "APPROVE" && isMyRequest && canRequestExpense;
  const canAddLineItems = status === "EXPENSE_DRAFT" && isMyRequest && canRequestExpense && !!expenseReport;
  const canSubmitER = status === "EXPENSE_DRAFT" && isMyRequest && canRequestExpense && !!expenseReport;
  const canDoERApproval = status === "AWAITING_FINANCE_REVIEW" && canFinanceReview;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate("/requests")} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 10 }}>
          ← Back to Requests
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>{request.purpose || "(No purpose)"}</h1>
          <StatusBadge status={status} />
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>ID: {id} · Updated {request.updatedAt}</div>
      </div>

      {/* Action feedback */}
      {actionSuccess && <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 14, color: "#15803d" }}>{actionSuccess}</div>}
      {actionError && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 14, color: "#dc2626" }}>{actionError}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Request details */}
        <div style={{ background: "white", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", gridColumn: "1 / -1" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>Request Details</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {row("Fund", request.fundId)}
              {row("Department", request.ministryDepartment)}
              {row("Requestor", request.requestorId)}
              {row("Approver", request.approverId)}
              {row("Estimated", fmtMoney(request.estimatedAmount))}
              {row("Approved", fmtMoney(request.approvedAmount))}
              {row("Actual", fmtMoney(request.actualAmount))}
              {row("Payment Method", request.plannedPaymentMethod)}
              {row("Expense Date", request.requestedExpenseDate)}
              {row("Description", request.description || "—")}
              {row("Created", request.createdAt)}
            </tbody>
          </table>
        </div>

        {/* ── Action: Submit PR (Requestor) ── */}
        {canSubmitPR && (
          <ActionCard title="Submit for Approval">
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>
              Submit this draft purchase request to your approver.
            </p>
            <ActionBtn onClick={doSubmitPR} busy={actionBusy}>Submit Request</ActionBtn>
            <SecondaryBtn onClick={() => navigate(`/requests/new?edit=${id}`)}>Edit Draft</SecondaryBtn>
          </ActionCard>
        )}

        {/* ── Action: PR Approval ── */}
        {canDoPRApproval && (
          <ActionCard title="Purchase Request Approval">
            <form onSubmit={doApprovePR} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select value={prAction} onChange={(e) => setPrAction(e.target.value as typeof prAction)} style={selStyle}>
                <option value="APPROVE">Approve</option>
                <option value="REJECT">Reject</option>
                <option value="REQUEST_REVISIONS">Request Revisions</option>
              </select>
              <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Comments (optional)" style={{ ...selStyle, height: 60, resize: "vertical" } as React.CSSProperties} />
              <ActionBtn busy={actionBusy}>Apply</ActionBtn>
            </form>
          </ActionCard>
        )}

        {/* ── Action: Create Expense Report ── */}
        {canCreateER && (
          <ActionCard title="Expense Report">
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>
              Your purchase request was approved. Create an expense report to record actual expenses.
            </p>
            <ActionBtn onClick={doCreateExpenseReport} busy={actionBusy}>Create Expense Report</ActionBtn>
          </ActionCard>
        )}

        {/* ── Action: Submit Expense Report ── */}
        {canSubmitER && expenseReport && (
          <ActionCard title="Submit Expense Report">
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>
              Report status: <StatusBadge status={expenseReport.status} />
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>
              {lineItems.length} line item(s) — total: {fmtMoney(lineItems.reduce((s, i) => s + i.amount, 0))}
            </p>
            <ActionBtn onClick={doSubmitExpenseReport} busy={actionBusy}>Submit for Finance Review</ActionBtn>
          </ActionCard>
        )}

        {/* ── Action: ER Finance Approval ── */}
        {canDoERApproval && expenseReport && (
          <ActionCard title="Finance Review">
            <form onSubmit={doERAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select value={erAction} onChange={(e) => setErAction(e.target.value as typeof erAction)} style={selStyle}>
                <option value="APPROVE">Approve Expense Report</option>
                <option value="REJECT">Reject</option>
                <option value="REQUEST_REVISIONS">Request Revisions</option>
                <option value="MARK_PAY">Mark as Paid</option>
              </select>
              <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Comments (optional)" style={{ ...selStyle, height: 60, resize: "vertical" } as React.CSSProperties} />
              <ActionBtn busy={actionBusy}>Apply</ActionBtn>
            </form>
          </ActionCard>
        )}
      </div>

      {/* ── Line Items ── */}
      {(expenseReport || lineItems.length > 0) && (
        <div style={{ background: "white", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Expense Line Items
            </h2>
            {canAddLineItems && (
              <button
                onClick={() => setShowLineItemForm((v) => !v)}
                style={{ padding: "5px 12px", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
              >
                {showLineItemForm ? "Cancel" : "+ Add Line Item"}
              </button>
            )}
          </div>

          {showLineItemForm && (
            <form onSubmit={doAddLineItem} style={{ background: "#f9fafb", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={miniLabel}>Vendor ID *</label>
                  <input value={liVendorId} onChange={(e) => setLiVendorId(e.target.value)} required style={miniInput} />
                </div>
                <div>
                  <label style={miniLabel}>Category ID *</label>
                  <input value={liCategoryId} onChange={(e) => setLiCategoryId(e.target.value)} required style={miniInput} />
                </div>
                <div>
                  <label style={miniLabel}>Amount ($) *</label>
                  <input type="number" min="0.01" step="0.01" value={liAmount} onChange={(e) => setLiAmount(e.target.value)} required style={miniInput} />
                </div>
                <div>
                  <label style={miniLabel}>Expense Date *</label>
                  <input type="date" value={liDate} onChange={(e) => setLiDate(e.target.value)} required style={miniInput} />
                </div>
                <div style={{ gridColumn: "2 / -1" }}>
                  <label style={miniLabel}>Description</label>
                  <input value={liDescription} onChange={(e) => setLiDescription(e.target.value)} style={miniInput} />
                </div>
              </div>
              {liError && <p style={{ color: "#dc2626", fontSize: 12, margin: "8px 0 0" }}>{liError}</p>}
              <button type="submit" disabled={liBusy} style={{ marginTop: 12, padding: "7px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                {liBusy ? "Adding..." : "Add Line Item"}
              </button>
            </form>
          )}

          {lineItems.length === 0 ? (
            <div style={{ color: "#9ca3af", fontSize: 13 }}>No line items yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Vendor", "Category", "Amount", "Date", "Description"].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 11, color: "#9ca3af", fontWeight: 600, padding: "6px 10px", borderBottom: "1px solid #f3f4f6", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li) => (
                  <tr key={li.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                    <td style={{ padding: "10px", fontSize: 13, color: "#374151" }}>{li.vendorId}</td>
                    <td style={{ padding: "10px", fontSize: 13, color: "#374151" }}>{li.categoryId}</td>
                    <td style={{ padding: "10px", fontSize: 13, color: "#374151" }}>{fmtMoney(li.amount)}</td>
                    <td style={{ padding: "10px", fontSize: 13, color: "#374151" }}>{li.expenseDate}</td>
                    <td style={{ padding: "10px", fontSize: 13, color: "#374151" }}>{li.description || "—"}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ padding: "10px", fontSize: 13, fontWeight: 700, color: "#111827" }}>Total</td>
                  <td style={{ padding: "10px", fontSize: 13, fontWeight: 700, color: "#111827" }}>{fmtMoney(lineItems.reduce((s, i) => s + i.amount, 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Approval History ── */}
      {approvals.length > 0 && (
        <div style={{ background: "white", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", marginTop: 16 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>Approval History</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {approvals.map((a) => (
              <div key={a.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: decisionColor(a.decision), marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
                    <span style={{ color: "#9ca3af", marginRight: 6 }}>{a.step}</span>
                    {a.decision}
                  </div>
                  {a.comments && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>"{a.comments}"</div>}
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>by {a.approvedBy} · {a.createdAt}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", borderTop: "3px solid #2563eb" }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</h2>
      {children}
    </div>
  );
}

function ActionBtn({ children, onClick, busy }: { children: React.ReactNode; onClick?: () => void; busy?: boolean }) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={busy}
      style={{ padding: "9px 20px", background: "#2563eb", color: "white", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1, display: "block", width: "100%" }}
    >
      {busy ? "Processing..." : children}
    </button>
  );
}

function SecondaryBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ marginTop: 8, padding: "9px 20px", background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, cursor: "pointer", display: "block", width: "100%" }}
    >
      {children}
    </button>
  );
}

const selStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 7,
  fontSize: 13,
  color: "#111827",
  background: "white",
  boxSizing: "border-box",
};

const miniLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#6b7280",
  marginBottom: 4,
};

const miniInput: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  fontSize: 13,
  boxSizing: "border-box",
};

function decisionColor(decision: string): string {
  if (["APPROVE", "SUBMIT", "UPDATED", "CREATED", "ADDED", "MARK_PAY"].includes(decision)) return "#10b981";
  if (["REJECT"].includes(decision)) return "#ef4444";
  if (["REQUEST_REVISIONS"].includes(decision)) return "#f97316";
  return "#9ca3af";
}
