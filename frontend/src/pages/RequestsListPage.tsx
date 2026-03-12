import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, QueryConstraint } from "firebase/firestore";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { useUserContext } from "../contexts/UserContext";
import { StatusBadge } from "./Dashboard";

const ALL_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "AWAITING_PREAPPROVAL", label: "Awaiting Approval" },
  { value: "REQUEST_REVISIONS_NEEDED", label: "Revisions Needed" },
  { value: "APPROVE", label: "Pre-Approved" },
  { value: "EXPENSE_DRAFT", label: "Expense Draft" },
  { value: "AWAITING_FINANCE_REVIEW", label: "Finance Review" },
  { value: "EXPENSE_APPROVE", label: "Expense Approved" },
  { value: "MARK_PAY", label: "Paid" },
  { value: "REJECT", label: "Rejected" },
];

interface RequestRow {
  id: string;
  purpose: string;
  status: string;
  estimatedAmount: number;
  ministryDepartment: string;
  fundId: string;
  requestorId: string;
}

export default function RequestsListPage() {
  const { profile, activeOrgId } = useUserContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const statusFilter = searchParams.get("status") || "";
  const mineOnly = searchParams.get("mine") === "true";

  useEffect(() => {
    if (!profile || !activeOrgId) return;
    setLoading(true);
    setError("");

    const constraints: QueryConstraint[] = [
      where("tenantId", "==", profile.tenantId),
      where("organizationId", "==", activeOrgId),
      orderBy("createdAt", "desc"),
    ];
    if (statusFilter) constraints.push(where("status", "==", statusFilter));
    if (mineOnly) constraints.push(where("requestorId", "==", profile.uid));

    getDocs(query(collection(db, "purchaseRequests"), ...constraints))
      .then((snap) =>
        setRows(snap.docs.map((d) => ({
          id: d.id,
          purpose: String(d.data().purpose || ""),
          status: String(d.data().status || ""),
          estimatedAmount: Number(d.data().estimatedAmount || 0),
          ministryDepartment: String(d.data().ministryDepartment || ""),
          fundId: String(d.data().fundId || ""),
          requestorId: String(d.data().requestorId || ""),
        })))
      )
      .catch(() => setError("Failed to load requests."))
      .finally(() => setLoading(false));
  }, [profile, activeOrgId, statusFilter, mineOnly]);

  const setFilter = (status: string) => {
    const next: Record<string, string> = {};
    if (status) next.status = status;
    if (mineOnly) next.mine = "true";
    setSearchParams(next);
  };

  const toggleMine = () => {
    const next: Record<string, string> = {};
    if (statusFilter) next.status = statusFilter;
    if (!mineOnly) next.mine = "true";
    setSearchParams(next);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>Purchase Requests</h1>
        <Link
          to="/requests/new"
          style={{ padding: "9px 18px", background: "#2563eb", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 13 }}
        >
          + New Request
        </Link>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <FilterBtn active={!statusFilter} onClick={() => setFilter("")}>All</FilterBtn>
        {ALL_STATUSES.map((s) => (
          <FilterBtn key={s.value} active={statusFilter === s.value} onClick={() => setFilter(s.value)}>
            {s.label}
          </FilterBtn>
        ))}
        <label style={{ marginLeft: "auto", fontSize: 13, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={mineOnly} onChange={toggleMine} />
          Mine only
        </label>
      </div>

      {loading ? (
        <div style={{ color: "#9ca3af", fontSize: 14 }}>Loading...</div>
      ) : error ? (
        <div style={{ color: "#dc2626", fontSize: 14 }}>{error}</div>
      ) : rows.length === 0 ? (
        <div style={{ background: "white", borderRadius: 10, padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          No requests found.{" "}
          <Link to="/requests/new" style={{ color: "#2563eb" }}>Create one →</Link>
        </div>
      ) : (
        <div style={{ background: "white", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Purpose", "Fund / Dept", "Amount", "Status", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 11, color: "#9ca3af", fontWeight: 600, padding: "10px 16px", borderBottom: "1px solid #f3f4f6", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                  <td style={{ padding: "13px 16px", fontSize: 14, color: "#111827", fontWeight: 500 }}>{r.purpose || "(no purpose)"}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ fontSize: 13, color: "#374151" }}>{r.fundId}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{r.ministryDepartment}</div>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 14, color: "#374151", whiteSpace: "nowrap" }}>
                    ${r.estimatedAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <StatusBadge status={r.status} />
                  </td>
                  <td style={{ padding: "13px 16px", textAlign: "right" }}>
                    <Link to={`/requests/${r.id}`} style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 12px",
        borderRadius: 6,
        border: "1px solid #e5e7eb",
        background: active ? "#1e293b" : "white",
        color: active ? "white" : "#374151",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}
