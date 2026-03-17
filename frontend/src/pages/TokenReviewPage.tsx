import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../workflow/api";
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

type TokenType = 'preApproval' | 'receiptsReview' | string;

export default function TokenReviewPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);
  const [tokenType, setTokenType] = useState<TokenType>("");
  const [tokenError, setTokenError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Pre-approval form
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | "NEEDS_EDITS">("APPROVE");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // Receipts review form
  const [rrDecision, setRrDecision] = useState<"APPROVE" | "REJECT" | "SEND_BACK">("APPROVE");
  const [rrNotes, setRrNotes] = useState("");
  const [rrRejectionReason, setRrRejectionReason] = useState("");

  useEffect(() => {
    if (!token) {
      setTokenError("No token provided in URL.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const result: any = await api.validateTokenAndGetRequest({ token });
        setRequest(result.request || result);
        setTokenType(result.tokenType || "preApproval");
        // Pre-fill approved amount with estimated
        const req = result.request || result;
        if (req?.estimatedAmount) {
          setApprovedAmount(String(req.estimatedAmount));
        }
      } catch (err: any) {
        const msg = err?.message || "Invalid or expired token.";
        if (msg.includes("expired") || msg.includes("used") || msg.includes("invalid")) {
          setTokenError(msg);
        } else {
          setTokenError("This review link is invalid or has already been used.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handlePreApproval = async (e: FormEvent) => {
    e.preventDefault();
    if (decision === "REJECT" && !rejectionReason.trim()) {
      setError("Rejection reason is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.submitApproverDecision({
        token,
        decision,
        notes: decision === "REJECT" ? rejectionReason : notes,
        approvedAmount: decision === "APPROVE" ? parseFloat(approvedAmount) : undefined,
      });
      setSuccess(
        decision === "APPROVE"
          ? "Request approved successfully! The requestor has been notified."
          : decision === "REJECT"
          ? "Request rejected. The requestor has been notified."
          : "Request sent back for edits. The requestor has been notified."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleReceiptsReview = async (e: FormEvent) => {
    e.preventDefault();
    if (rrDecision === "REJECT" && !rrRejectionReason.trim()) {
      setError("Rejection reason is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (rrDecision === "APPROVE") {
        await api.approveReceiptsReview({ token, notes: rrNotes });
      } else if (rrDecision === "REJECT") {
        await api.rejectReceiptsReview({ token, reason: rrRejectionReason });
      } else {
        await api.sendBackForEdits({ token, notes: rrNotes });
      }
      setSuccess(
        rrDecision === "APPROVE"
          ? "Receipts approved! The request has been moved to final approval."
          : rrDecision === "REJECT"
          ? "Request rejected. The requestor has been notified."
          : "Request sent back for edits."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg" />
          <p className="mt-3 text-base-content/60">Loading review...</p>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="card-title justify-center text-error">Link Unavailable</h2>
            <p className="text-base-content/70">{tokenError}</p>
            <p className="text-sm text-base-content/50 mt-2">
              If you believe this is an error, please contact the person who sent you this link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="card-title justify-center text-success">Done!</h2>
            <p className="text-base-content/70">{success}</p>
            <p className="text-sm text-base-content/50 mt-2">You may close this window.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">
            {tokenType === "receiptsReview" ? "Receipts Review" : "Expense Pre-Approval"}
          </h1>
          <p className="text-base-content/60 text-sm mt-1">
            {tokenType === "receiptsReview"
              ? "Review the submitted receipts and expense report"
              : "Review and approve or decline this purchase request"}
          </p>
        </div>

        {error && <div className="alert alert-error"><span>{error}</span></div>}

        {/* Request Details */}
        {request && (
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="card-title text-base">{request.purpose || "(No purpose)"}</h2>
                <StatusBadge status={request.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-base-content/50 uppercase font-semibold">Requestor</div>
                  <div>{request.requestorName || request.requestorEmail || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-base-content/50 uppercase font-semibold">Ministry / Dept</div>
                  <div>{request.ministryDepartment || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-base-content/50 uppercase font-semibold">Vendor</div>
                  <div>{request.vendorName || request.vendorId || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-base-content/50 uppercase font-semibold">Category</div>
                  <div>{request.category || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-base-content/50 uppercase font-semibold">Estimated Amount</div>
                  <div className="font-semibold">{fmtCurrency(request.estimatedAmount)}</div>
                </div>
                {request.approvedAmount > 0 && (
                  <div>
                    <div className="text-xs text-base-content/50 uppercase font-semibold">Approved Amount</div>
                    <div className="font-semibold">{fmtCurrency(request.approvedAmount)}</div>
                  </div>
                )}
                {request.actualAmount > 0 && (
                  <div>
                    <div className="text-xs text-base-content/50 uppercase font-semibold">Actual Amount</div>
                    <div className="font-semibold">{fmtCurrency(request.actualAmount)}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-base-content/50 uppercase font-semibold">Payment Method</div>
                  <div>{request.paymentMethod || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-base-content/50 uppercase font-semibold">Requested Date</div>
                  <div>{fmtDate(request.requestedExpenseDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-base-content/50 uppercase font-semibold">Fund</div>
                  <div>{request.fundId || "—"}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-base-content/50 uppercase font-semibold">Description</div>
                  <div className="whitespace-pre-wrap">{request.description || "—"}</div>
                </div>
                {request.preApprovalNotes && (
                  <div className="col-span-2">
                    <div className="text-xs text-base-content/50 uppercase font-semibold">Pre-Approval Notes</div>
                    <div>{request.preApprovalNotes}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pre-Approval Action */}
        {tokenType === "preApproval" && (
          <div className="card bg-base-100 shadow border-t-4 border-primary">
            <div className="card-body">
              <h2 className="card-title text-base">Your Decision</h2>
              <form onSubmit={handlePreApproval} className="space-y-4">
                <div className="form-control">
                  <label className="label"><span className="label-text font-semibold">Decision *</span></label>
                  <div className="flex flex-wrap gap-3">
                    {(["APPROVE", "REJECT", "NEEDS_EDITS"] as const).map(d => (
                      <label key={d} className="label cursor-pointer gap-2">
                        <input
                          type="radio"
                          name="decision"
                          className="radio radio-primary"
                          value={d}
                          checked={decision === d}
                          onChange={() => setDecision(d)}
                        />
                        <span className="label-text">
                          {d === "APPROVE" ? "Approve" : d === "REJECT" ? "Reject" : "Needs Edits"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {decision === "APPROVE" && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-semibold">Approved Amount *</span>
                      <span className="label-text-alt text-base-content/50">Can differ from estimated</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="input input-bordered"
                      value={approvedAmount}
                      onChange={e => setApprovedAmount(e.target.value)}
                      required
                    />
                  </div>
                )}

                {decision === "REJECT" && (
                  <div className="form-control">
                    <label className="label"><span className="label-text font-semibold">Rejection Reason *</span></label>
                    <textarea
                      className="textarea textarea-bordered"
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      placeholder="Please explain why this request is being rejected"
                      rows={3}
                      required
                    />
                  </div>
                )}

                {decision !== "REJECT" && (
                  <div className="form-control">
                    <label className="label"><span className="label-text font-semibold">Notes (optional)</span></label>
                    <textarea
                      className="textarea textarea-bordered"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder={decision === "NEEDS_EDITS" ? "Describe what needs to be changed" : "Any additional comments"}
                      rows={3}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className={`btn w-full ${decision === "APPROVE" ? "btn-success" : decision === "REJECT" ? "btn-error" : "btn-warning"}`}
                >
                  {busy ? <span className="loading loading-spinner loading-sm" /> : (
                    decision === "APPROVE" ? "Approve Request"
                    : decision === "REJECT" ? "Reject Request"
                    : "Send Back for Edits"
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Receipts Review Action */}
        {tokenType === "receiptsReview" && (
          <div className="card bg-base-100 shadow border-t-4 border-secondary">
            <div className="card-body">
              <h2 className="card-title text-base">Receipts Review Decision</h2>
              <form onSubmit={handleReceiptsReview} className="space-y-4">
                <div className="form-control">
                  <label className="label"><span className="label-text font-semibold">Decision *</span></label>
                  <div className="flex flex-wrap gap-3">
                    {(["APPROVE", "REJECT", "SEND_BACK"] as const).map(d => (
                      <label key={d} className="label cursor-pointer gap-2">
                        <input
                          type="radio"
                          name="rr-decision"
                          className="radio radio-secondary"
                          value={d}
                          checked={rrDecision === d}
                          onChange={() => setRrDecision(d)}
                        />
                        <span className="label-text">
                          {d === "APPROVE" ? "Approve Receipts" : d === "REJECT" ? "Reject" : "Send Back for Edits"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {rrDecision === "REJECT" && (
                  <div className="form-control">
                    <label className="label"><span className="label-text font-semibold">Rejection Reason *</span></label>
                    <textarea
                      className="textarea textarea-bordered"
                      value={rrRejectionReason}
                      onChange={e => setRrRejectionReason(e.target.value)}
                      placeholder="Please explain why this is being rejected"
                      rows={3}
                      required
                    />
                  </div>
                )}

                {rrDecision !== "REJECT" && (
                  <div className="form-control">
                    <label className="label"><span className="label-text font-semibold">Notes (optional)</span></label>
                    <textarea
                      className="textarea textarea-bordered"
                      value={rrNotes}
                      onChange={e => setRrNotes(e.target.value)}
                      placeholder={rrDecision === "SEND_BACK" ? "What needs to be corrected?" : "Any comments"}
                      rows={3}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className={`btn w-full ${rrDecision === "APPROVE" ? "btn-success" : rrDecision === "REJECT" ? "btn-error" : "btn-warning"}`}
                >
                  {busy ? <span className="loading loading-spinner loading-sm" /> : (
                    rrDecision === "APPROVE" ? "Approve Receipts"
                    : rrDecision === "REJECT" ? "Reject"
                    : "Send Back for Edits"
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
