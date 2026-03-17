import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUserContext } from "../contexts/UserContext";
import { api } from "../workflow/api";
import { DashboardData, Request } from "../workflow/types";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "../workflow/constants";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtDate = (val: any): string => {
  if (!val) return "—";
  if (typeof val === "object" && val.seconds) {
    return new Date(val.seconds * 1000).toLocaleDateString('en-US');
  }
  try { return new Date(val).toLocaleDateString('en-US'); } catch { return String(val); }
};

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  const cls = STATUS_BADGE_CLASS[status] || 'badge-ghost';
  return <span className={`badge ${cls} badge-sm`}>{label}</span>;
}

function RequestsTable({ requests, emptyMsg }: { requests: Request[]; emptyMsg: string }) {
  if (requests.length === 0) {
    return <div className="py-10 text-center text-base-content/50 text-sm">{emptyMsg}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>ID</th>
            <th>Dept</th>
            <th>Vendor</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="hover">
              <td className="font-mono text-xs text-base-content/60">{r.id.slice(0, 8)}…</td>
              <td className="text-sm">{r.ministryDepartment || "—"}</td>
              <td className="text-sm">{r.vendorName || "—"}</td>
              <td className="text-sm font-medium">{fmtCurrency(r.estimatedAmount || 0)}</td>
              <td><StatusBadge status={r.status} /></td>
              <td className="text-xs text-base-content/60">{fmtDate(r.createdAt)}</td>
              <td>
                <Link to={`/requests/${r.id}`} className="btn btn-xs btn-outline">View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton h-8 w-full rounded" />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { profile, activeOrgId, activeOrgName, isAdmin, canApprove, isFinancePayor, isReceiptsReviewer, isQBEntry } = useUserContext();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"my" | "approvals" | "finance">("my");

  const load = useCallback(async () => {
    if (!profile || !activeOrgId) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.getMyDashboards({ orgId: activeOrgId });
      setData(result as DashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [profile, activeOrgId]);

  useEffect(() => { load(); }, [load]);

  const showApprovals = isAdmin || canApprove;
  const showFinance = isAdmin || isFinancePayor || isReceiptsReviewer || isQBEntry;

  const financeQueue = (() => {
    if (!data) return [];
    const queue = data.financeQueue || [];
    if (isAdmin) return queue;
    const allowed: string[] = [];
    if (isReceiptsReviewer) allowed.push("SUBMITTED_RECEIPT_REVIEW", "EXCEEDS_APPROVED_AMOUNT");
    if (isFinancePayor) allowed.push("FINAL_APPROVED");
    if (isQBEntry) allowed.push("PAID", "QB_SENT");
    return queue.filter(r => allowed.includes(r.status));
  })();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-base-content/60 mt-1">{activeOrgName}</p>
        </div>
        <Link to="/requests/new" className="btn btn-primary btn-sm">
          + New Request
        </Link>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title text-xs">My Requests</div>
          <div className="stat-value text-2xl">{loading ? "—" : (data?.myRequests?.length ?? 0)}</div>
        </div>
        {showApprovals && (
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title text-xs">Pending Approvals</div>
            <div className="stat-value text-2xl text-warning">{loading ? "—" : (data?.pendingApprovals?.length ?? 0)}</div>
          </div>
        )}
        {showFinance && (
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title text-xs">Finance Queue</div>
            <div className="stat-value text-2xl text-info">{loading ? "—" : financeQueue.length}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs tabs-boxed mb-4">
        <button
          className={`tab ${tab === "my" ? "tab-active" : ""}`}
          onClick={() => setTab("my")}
        >
          My Requests
        </button>
        {showApprovals && (
          <button
            className={`tab ${tab === "approvals" ? "tab-active" : ""}`}
            onClick={() => setTab("approvals")}
          >
            Pending Approvals
            {(data?.pendingApprovals?.length ?? 0) > 0 && (
              <span className="badge badge-warning badge-xs ml-2">{data!.pendingApprovals.length}</span>
            )}
          </button>
        )}
        {showFinance && (
          <button
            className={`tab ${tab === "finance" ? "tab-active" : ""}`}
            onClick={() => setTab("finance")}
          >
            Finance Queue
            {financeQueue.length > 0 && (
              <span className="badge badge-info badge-xs ml-2">{financeQueue.length}</span>
            )}
          </button>
        )}
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body p-0">
          {loading ? (
            <SkeletonTable />
          ) : (
            <>
              {tab === "my" && (
                <RequestsTable
                  requests={data?.myRequests ?? []}
                  emptyMsg="No requests yet. Create your first request!"
                />
              )}
              {tab === "approvals" && showApprovals && (
                <div className="overflow-x-auto">
                  {(data?.pendingApprovals ?? []).length === 0 ? (
                    <div className="py-10 text-center text-base-content/50 text-sm">No pending approvals.</div>
                  ) : (
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Requestor</th>
                          <th>Dept</th>
                          <th>Vendor</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.pendingApprovals ?? []).map((r) => (
                          <tr key={r.id} className="hover">
                            <td className="font-mono text-xs text-base-content/60">{r.id.slice(0, 8)}…</td>
                            <td className="text-sm">{r.requestorName || r.requestorEmail || "—"}</td>
                            <td className="text-sm">{r.ministryDepartment || "—"}</td>
                            <td className="text-sm">{r.vendorName || "—"}</td>
                            <td className="text-sm font-medium">{fmtCurrency(r.estimatedAmount || 0)}</td>
                            <td><StatusBadge status={r.status} /></td>
                            <td className="text-xs text-base-content/60">{fmtDate(r.createdAt)}</td>
                            <td>
                              {r.preApprovalToken ? (
                                <Link to={`/review?token=${r.preApprovalToken}`} className="btn btn-xs btn-warning">Review</Link>
                              ) : (
                                <Link to={`/requests/${r.id}`} className="btn btn-xs btn-outline">View</Link>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              {tab === "finance" && showFinance && (
                <div className="overflow-x-auto">
                  {financeQueue.length === 0 ? (
                    <div className="py-10 text-center text-base-content/50 text-sm">Finance queue is empty.</div>
                  ) : (
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Requestor</th>
                          <th>Vendor</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Dept</th>
                          <th>Date</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {financeQueue.map((r) => (
                          <tr key={r.id} className="hover">
                            <td className="font-mono text-xs text-base-content/60">{r.id.slice(0, 8)}…</td>
                            <td className="text-sm">{r.requestorName || r.requestorEmail || "—"}</td>
                            <td className="text-sm">{r.vendorName || "—"}</td>
                            <td className="text-sm font-medium">{fmtCurrency(r.actualAmount || r.estimatedAmount || 0)}</td>
                            <td><StatusBadge status={r.status} /></td>
                            <td className="text-sm">{r.ministryDepartment || "—"}</td>
                            <td className="text-xs text-base-content/60">{fmtDate(r.createdAt)}</td>
                            <td>
                              <Link to={`/requests/${r.id}`} className="btn btn-xs btn-outline">View</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
