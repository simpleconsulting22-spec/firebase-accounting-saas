import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, limit, QueryConstraint } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { useUserContext } from "../contexts/UserContext";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#f59e0b",
  AWAITING_PREAPPROVAL: "#3b82f6",
  REQUEST_REVISIONS_NEEDED: "#f97316",
  APPROVE: "#10b981",
  REJECT: "#ef4444",
  EXPENSE_DRAFT: "#8b5cf6",
  AWAITING_FINANCE_REVIEW: "#3b82f6",
  EXPENSE_APPROVE: "#10b981",
  MARK_PAY: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  AWAITING_PREAPPROVAL: "Awaiting Approval",
  REQUEST_REVISIONS_NEEDED: "Revisions Needed",
  APPROVE: "Pre-Approved",
  REJECT: "Rejected",
  EXPENSE_DRAFT: "Expense Draft",
  AWAITING_FINANCE_REVIEW: "Finance Review",
  EXPENSE_APPROVE: "Expense Approved",
  MARK_PAY: "Paid",
};

interface RecentRow {
  id: string;
  purpose: string;
  status: string;
  estimatedAmount: number;
}

interface Counts {
  myDrafts: number;
  awaitingApproval: number;
  awaitingFinance: number;
  revisionsNeeded: number;
}

export default function Dashboard() {
  const { profile, activeOrgId, canApprove, canFinanceReview } = useUserContext();
  const [counts, setCounts] = useState<Counts>({ myDrafts: 0, awaitingApproval: 0, awaitingFinance: 0, revisionsNeeded: 0 });
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !activeOrgId) return;
    const { tenantId, uid } = profile;
    const base: QueryConstraint[] = [
      where("tenantId", "==", tenantId),
      where("organizationId", "==", activeOrgId),
    ];

    setLoading(true);
    Promise.all([
      getDocs(query(collection(db, "purchaseRequests"), ...base, where("requestorId", "==", uid), where("status", "in", ["DRAFT", "REQUEST_REVISIONS_NEEDED"]))),
      getDocs(query(collection(db, "purchaseRequests"), ...base, where("status", "==", "AWAITING_PREAPPROVAL"))),
      getDocs(query(collection(db, "purchaseRequests"), ...base, where("status", "==", "AWAITING_FINANCE_REVIEW"))),
      getDocs(query(collection(db, "purchaseRequests"), ...base, where("requestorId", "==", uid), where("status", "==", "REQUEST_REVISIONS_NEEDED"))),
      getDocs(query(collection(db, "purchaseRequests"), ...base, orderBy("createdAt", "desc"), limit(6))),
    ]).then(([draftsSnap, awaitApprSnap, awaitFinSnap, revSnap, recentSnap]) => {
      setCounts({
        myDrafts: draftsSnap.size,
        awaitingApproval: awaitApprSnap.size,
        awaitingFinance: awaitFinSnap.size,
        revisionsNeeded: revSnap.size,
      });
      setRecent(recentSnap.docs.map((d) => ({
        id: d.id,
        purpose: String(d.data().purpose || ""),
        status: String(d.data().status || ""),
        estimatedAmount: Number(d.data().estimatedAmount || 0),
      })));
    }).catch(console.error).finally(() => setLoading(false));
  }, [profile, activeOrgId]);

  if (!profile) return null;

  const cards = [
    { label: "My Drafts", count: counts.myDrafts, color: "#f59e0b", link: "/requests?status=DRAFT&mine=true", show: true },
    { label: "Revisions Needed", count: counts.revisionsNeeded, color: "#f97316", link: "/requests?status=REQUEST_REVISIONS_NEEDED&mine=true", show: true },
    { label: "Awaiting Approval", count: counts.awaitingApproval, color: "#3b82f6", link: "/requests?status=AWAITING_PREAPPROVAL", show: canApprove },
    { label: "Awaiting Finance", count: counts.awaitingFinance, color: "#8b5cf6", link: "/requests?status=AWAITING_FINANCE_REVIEW", show: canFinanceReview },
  ].filter((c) => c.show);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>Dashboard</h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>{activeOrgId}</p>
        </div>
        <Link
          to="/requests/new"
          style={{ padding: "9px 18px", background: "#2563eb", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 13 }}
        >
          + New Request
        </Link>
      </div>

      {loading ? (
        <div style={{ color: "#9ca3af", fontSize: 14 }}>Loading...</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
            {cards.map((c) => (
              <Link key={c.label} to={c.link} style={{ textDecoration: "none" }}>
                <div style={{ background: "white", borderRadius: 10, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", borderLeft: `4px solid ${c.color}` }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: c.color, lineHeight: 1 }}>{c.count}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>{c.label}</div>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ background: "white", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>Recent Requests</h2>
              <Link to="/requests" style={{ fontSize: 12, color: "#2563eb", textDecoration: "none" }}>View all →</Link>
            </div>
            {recent.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                No requests yet.{" "}
                <Link to="/requests/new" style={{ color: "#2563eb" }}>Create your first request →</Link>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Purpose", "Amount", "Status", ""].map((h) => (
                      <th key={h} style={{ textAlign: "left", fontSize: 11, color: "#9ca3af", fontWeight: 600, padding: "10px 16px", borderBottom: "1px solid #f3f4f6", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#111827" }}>{r.purpose || "(no purpose)"}</td>
                      <td style={{ padding: "12px 16px", fontSize: 14, color: "#374151", whiteSpace: "nowrap" }}>
                        ${r.estimatedAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusBadge status={r.status} />
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <Link to={`/requests/${r.id}`} style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>View →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || "#6b7280";
  const label = STATUS_LABELS[status] || status;
  return (
    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: color + "20", color, fontWeight: 600, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}
