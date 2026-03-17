import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useUserContext } from "../contexts/UserContext";
import { api } from "../workflow/api";
import { Request, LineItem, FileRecord } from "../workflow/types";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "../workflow/constants";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const fmtDate = (val: any): string => {
  if (!val) return "—";
  if (typeof val === "object" && val.seconds) {
    return new Date(val.seconds * 1000).toLocaleDateString('en-US');
  }
  try { return new Date(val).toLocaleDateString('en-US'); } catch { return String(val); }
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  const cls = STATUS_BADGE_CLASS[status] || 'badge-ghost';
  return <span className={`badge ${cls}`}>{label}</span>;
}

const STEPS = [
  { n: 1, label: "Draft" },
  { n: 2, label: "Pre-Approval" },
  { n: 3, label: "Pre-Approved" },
  { n: 4, label: "Expense Report" },
  { n: 5, label: "Receipt Review" },
  { n: 6, label: "Final Approved" },
  { n: 7, label: "Paid" },
  { n: 8, label: "QB" },
];

const STATUS_TO_STEP: Record<string, number> = {
  DRAFT: 1,
  NEEDS_EDITS_STEP1: 1,
  SUBMITTED_PREAPPROVAL: 2,
  PREAPPROVED: 3,
  DRAFT_EXPENSE: 4,
  NEEDS_EDITS_STEP3: 4,
  EXCEEDS_APPROVED_AMOUNT: 5,
  SUBMITTED_RECEIPT_REVIEW: 5,
  FINAL_APPROVED: 6,
  PAID: 7,
  QB_SENT: 8,
  QB_ENTERED: 8,
  REJECTED: 1,
};

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, activeOrgId, isAdmin, isFinancePayor, isQBEntry, isReceiptsReviewer } = useUserContext();

  const [request, setRequest] = useState<Request | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Action form state
  const [paymentRef, setPaymentRef] = useState("");
  const [qbNotes, setQbNotes] = useState("");
  const [overageAmount, setOverageAmount] = useState("");
  const [adminReceiptsNotes, setAdminReceiptsNotes] = useState("");

  const load = useCallback(async () => {
    if (!id || !profile || !activeOrgId) return;
    setLoading(true);
    try {
      const result: any = await api.getRequestDetail({ requestId: id, orgId: activeOrgId });
      setRequest(result.request || result);
      setLineItems(result.lineItems || []);
      setFiles(result.files || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, profile, activeOrgId]);

  useEffect(() => { load(); }, [load]);

  const withAction = async (fn: () => Promise<void>) => {
    setActionBusy(true);
    setActionError("");
    setActionSuccess("");
    try {
      await fn();
      await load();
      setActionSuccess("Action completed successfully.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionBusy(false);
    }
  };

  const doMarkPaid = (e: FormEvent) => {
    e.preventDefault();
    if (!paymentRef.trim()) { setActionError("Payment reference is required."); return; }
    withAction(() => api.markAsPaid({ requestId: id, orgId: activeOrgId, paymentReference: paymentRef }));
  };

  const doSendToQB = () => {
    withAction(() => api.sendToQuickBooks({ requestId: id, orgId: activeOrgId }));
  };

  const doConfirmQB = (e: FormEvent) => {
    e.preventDefault();
    withAction(() => api.confirmQBEntry({ requestId: id, orgId: activeOrgId, notes: qbNotes }));
  };

  const doOverrideAmount = (e: FormEvent) => {
    e.preventDefault();
    if (!overageAmount || parseFloat(overageAmount) <= 0) { setActionError("Valid amount required."); return; }
    withAction(() => api.applyOverageApproval({ requestId: id, orgId: activeOrgId, approvedAmount: parseFloat(overageAmount) }));
  };

  const doAdminApproveReceipts = (e: FormEvent) => {
    e.preventDefault();
    withAction(() => api.adminApproveReceiptsReview({ requestId: id, orgId: activeOrgId, notes: adminReceiptsNotes }));
  };

  const doSubmitPreApproval = () => {
    withAction(() => api.submitPreApproval({ requestId: id, orgId: activeOrgId }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="skeleton h-8 w-64 mb-4" />
        <div className="skeleton h-48 w-full rounded-box" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6">
        <div className="alert alert-error">Request not found.</div>
        <Link to="/" className="btn btn-sm mt-4">Back to Dashboard</Link>
      </div>
    );
  }

  const status = request.status;
  const isMyRequest = profile?.uid === request.requestorId;
  const currentStep = STATUS_TO_STEP[status] || 1;

  const canEditRequest = isMyRequest && (status === "DRAFT" || status === "NEEDS_EDITS_STEP1");
  const canSubmitPreApproval = isMyRequest && (status === "DRAFT" || status === "NEEDS_EDITS_STEP1");
  const canCompleteExpense = isMyRequest && (status === "PREAPPROVED" || status === "DRAFT_EXPENSE" || status === "NEEDS_EDITS_STEP3");
  const canMarkPaid = isFinancePayor && status === "FINAL_APPROVED";
  const canSendQB = isQBEntry && status === "PAID";
  const canConfirmQB = isQBEntry && status === "QB_SENT";
  const canOverrideAmount = isAdmin && status === "EXCEEDS_APPROVED_AMOUNT";
  const canAdminApproveReceipts = isAdmin && status === "SUBMITTED_RECEIPT_REVIEW";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button onClick={() => navigate("/")} className="btn btn-ghost btn-sm mb-4">
        ← Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold">{request.purpose || "(No purpose)"}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-base-content/60 mt-1">
            ID: <span className="font-mono">{id}</span> · Updated {fmtDate(request.updatedAt)}
          </p>
        </div>
      </div>

      {/* Step progress */}
      <div className="card bg-base-100 shadow mb-4">
        <div className="card-body py-4">
          <ul className="steps steps-horizontal w-full text-xs">
            {STEPS.map(s => (
              <li
                key={s.n}
                className={`step ${s.n <= currentStep ? "step-primary" : ""}`}
              >
                {s.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action feedback */}
      {actionSuccess && (
        <div className="alert alert-success mb-4"><span>{actionSuccess}</span></div>
      )}
      {actionError && (
        <div className="alert alert-error mb-4"><span>{actionError}</span></div>
      )}

      {/* Request details card */}
      <div className="card bg-base-100 shadow mb-4">
        <div className="card-body">
          <h2 className="card-title text-sm uppercase tracking-wider text-base-content/60 mb-2">Request Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            <div>
              <div className="text-xs text-base-content/50 uppercase font-semibold">Organization</div>
              <div className="text-sm">{request.orgId}</div>
            </div>
            <div>
              <div className="text-xs text-base-content/50 uppercase font-semibold">Ministry / Dept</div>
              <div className="text-sm">{request.ministryDepartment || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-base-content/50 uppercase font-semibold">Requestor</div>
              <div className="text-sm">{request.requestorName || request.requestorEmail || request.requestorId || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-base-content/50 uppercase font-semibold">Approver</div>
              <div className="text-sm">{request.approverName || request.approverEmail || request.approverId || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-base-content/50 uppercase font-semibold">Fund</div>
              <div className="text-sm">{request.fundId || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-base-content/50 uppercase font-semibold">Vendor</div>
              <div className="text-sm">{request.vendorName || request.vendorId || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-base-content/50 uppercase font-semibold">Category</div>
              <div className="text-sm">{request.category || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-base-content/50 uppercase font-semibold">Payment Method</div>
              <div className="text-sm">{request.paymentMethod || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-base-content/50 uppercase font-semibold">Estimated Amount</div>
              <div className="text-sm font-semibold">{fmtCurrency(request.estimatedAmount)}</div>
            </div>
            <div>
              <div className="text-xs text-base-content/50 uppercase font-semibold">Approved Amount</div>
              <div className="text-sm font-semibold">{request.approvedAmount ? fmtCurrency(request.approvedAmount) : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-base-content/50 uppercase font-semibold">Actual Amount</div>
              <div className="text-sm font-semibold">{request.actualAmount ? fmtCurrency(request.actualAmount) : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-base-content/50 uppercase font-semibold">Requested Expense Date</div>
              <div className="text-sm">{request.requestedExpenseDate ? fmtDate(request.requestedExpenseDate) : "—"}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs text-base-content/50 uppercase font-semibold">Purpose</div>
              <div className="text-sm">{request.purpose || "—"}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs text-base-content/50 uppercase font-semibold">Description</div>
              <div className="text-sm whitespace-pre-wrap">{request.description || "—"}</div>
            </div>
            {request.preApprovalNotes && (
              <div className="md:col-span-2">
                <div className="text-xs text-base-content/50 uppercase font-semibold">Pre-Approval Notes</div>
                <div className="text-sm">{request.preApprovalNotes}</div>
              </div>
            )}
            {request.receiptsReviewNotes && (
              <div className="md:col-span-2">
                <div className="text-xs text-base-content/50 uppercase font-semibold">Receipts Review Notes</div>
                <div className="text-sm">{request.receiptsReviewNotes}</div>
              </div>
            )}
            {request.rejectionReason && (
              <div className="md:col-span-2">
                <div className="text-xs text-error uppercase font-semibold">Rejection Reason</div>
                <div className="text-sm text-error">{request.rejectionReason}</div>
              </div>
            )}
            {request.paymentReference && (
              <div>
                <div className="text-xs text-base-content/50 uppercase font-semibold">Payment Reference</div>
                <div className="text-sm">{request.paymentReference}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Items */}
      {lineItems.length > 0 && (
        <div className="card bg-base-100 shadow mb-4">
          <div className="card-body">
            <h2 className="card-title text-sm uppercase tracking-wider text-base-content/60">Line Items</h2>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li, i) => (
                    <tr key={li.id || i}>
                      <td>{li.description || "—"}</td>
                      <td>{li.vendorName || "—"}</td>
                      <td>{li.category || "—"}</td>
                      <td>{li.receiptDate ? fmtDate(li.receiptDate) : "—"}</td>
                      <td className="font-medium">{fmtCurrency(li.amount)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan={4}>Total</td>
                    <td>{fmtCurrency(lineItems.reduce((s, li) => s + (li.amount || 0), 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Files */}
      {files.length > 0 && (
        <div className="card bg-base-100 shadow mb-4">
          <div className="card-body">
            <h2 className="card-title text-sm uppercase tracking-wider text-base-content/60">Attached Files</h2>
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li key={f.id || i} className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <a href={f.fileUrl} target="_blank" rel="noreferrer" className="link link-primary text-sm">
                    {f.fileName}
                  </a>
                  <span className="text-xs text-base-content/40">{f.mimeType}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Action Panels */}

      {/* Requestor actions */}
      {(canEditRequest || canSubmitPreApproval || canCompleteExpense) && (
        <div className="card bg-base-100 shadow border-t-4 border-primary mb-4">
          <div className="card-body">
            <h2 className="card-title text-sm uppercase tracking-wider">Your Actions</h2>
            <div className="flex flex-wrap gap-2">
              {canEditRequest && (
                <Link to={`/requests/${id}/edit`} className="btn btn-outline btn-sm">
                  Edit Request
                </Link>
              )}
              {canSubmitPreApproval && (
                <button
                  onClick={doSubmitPreApproval}
                  disabled={actionBusy}
                  className="btn btn-primary btn-sm"
                >
                  {actionBusy ? <span className="loading loading-spinner loading-xs" /> : "Submit for Pre-Approval"}
                </button>
              )}
              {canCompleteExpense && (
                <Link to={`/requests/${id}/expense`} className="btn btn-success btn-sm">
                  Complete Expense Report
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mark as Paid */}
      {canMarkPaid && (
        <div className="card bg-base-100 shadow border-t-4 border-success mb-4">
          <div className="card-body">
            <h2 className="card-title text-sm uppercase tracking-wider">Mark as Paid</h2>
            <form onSubmit={doMarkPaid} className="flex items-end gap-3">
              <div className="form-control flex-1">
                <label className="label py-1">
                  <span className="label-text text-xs">Payment Reference *</span>
                </label>
                <input
                  className="input input-bordered input-sm"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder="Check #, ACH ref, etc."
                  required
                />
              </div>
              <button type="submit" disabled={actionBusy} className="btn btn-success btn-sm">
                {actionBusy ? <span className="loading loading-spinner loading-xs" /> : "Mark Paid"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Send to QuickBooks */}
      {canSendQB && (
        <div className="card bg-base-100 shadow border-t-4 border-info mb-4">
          <div className="card-body">
            <h2 className="card-title text-sm uppercase tracking-wider">Send to QuickBooks</h2>
            <p className="text-sm text-base-content/60">Export this expense to QuickBooks.</p>
            <button onClick={doSendToQB} disabled={actionBusy} className="btn btn-info btn-sm w-fit">
              {actionBusy ? <span className="loading loading-spinner loading-xs" /> : "Send to QuickBooks"}
            </button>
          </div>
        </div>
      )}

      {/* Confirm QB Entry */}
      {canConfirmQB && (
        <div className="card bg-base-100 shadow border-t-4 border-info mb-4">
          <div className="card-body">
            <h2 className="card-title text-sm uppercase tracking-wider">Confirm QuickBooks Entry</h2>
            <form onSubmit={doConfirmQB} className="space-y-3">
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-xs">Notes (optional)</span>
                </label>
                <textarea
                  className="textarea textarea-bordered textarea-sm"
                  value={qbNotes}
                  onChange={e => setQbNotes(e.target.value)}
                  placeholder="QB entry reference or notes"
                  rows={2}
                />
              </div>
              <button type="submit" disabled={actionBusy} className="btn btn-info btn-sm">
                {actionBusy ? <span className="loading loading-spinner loading-xs" /> : "Confirm QB Entry"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Override Approved Amount */}
      {canOverrideAmount && (
        <div className="card bg-base-100 shadow border-t-4 border-warning mb-4">
          <div className="card-body">
            <h2 className="card-title text-sm uppercase tracking-wider">Override Approved Amount</h2>
            <p className="text-sm text-base-content/60">
              Actual: {fmtCurrency(request.actualAmount)} / Approved: {fmtCurrency(request.approvedAmount)}
            </p>
            <form onSubmit={doOverrideAmount} className="flex items-end gap-3">
              <div className="form-control flex-1">
                <label className="label py-1">
                  <span className="label-text text-xs">New Approved Amount *</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input input-bordered input-sm"
                  value={overageAmount}
                  onChange={e => setOverageAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <button type="submit" disabled={actionBusy} className="btn btn-warning btn-sm">
                {actionBusy ? <span className="loading loading-spinner loading-xs" /> : "Override Amount"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Approve Receipts */}
      {canAdminApproveReceipts && (
        <div className="card bg-base-100 shadow border-t-4 border-secondary mb-4">
          <div className="card-body">
            <h2 className="card-title text-sm uppercase tracking-wider">Admin: Approve Receipts</h2>
            <form onSubmit={doAdminApproveReceipts} className="space-y-3">
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-xs">Notes (optional)</span>
                </label>
                <textarea
                  className="textarea textarea-bordered textarea-sm"
                  value={adminReceiptsNotes}
                  onChange={e => setAdminReceiptsNotes(e.target.value)}
                  placeholder="Approval notes"
                  rows={2}
                />
              </div>
              <button type="submit" disabled={actionBusy} className="btn btn-secondary btn-sm">
                {actionBusy ? <span className="loading loading-spinner loading-xs" /> : "Approve Receipts"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
