import { FormEvent, useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { expensesApi } from "../modules/expenses/services";
import { useUserContext } from "../contexts/UserContext";

interface Fund {
  id: string;
  fundName: string;
  ministryDepartment: string;
  annualBudget: number;
}

interface Approver {
  id: string;
  email: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #e5e7eb",
  borderRadius: 7,
  fontSize: 14,
  color: "#111827",
  background: "white",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export default function CreateRequestPage() {
  const navigate = useNavigate();
  const { profile, activeOrgId } = useUserContext();

  const [funds, setFunds] = useState<Fund[]>([]);
  const [approvers, setApprovers] = useState<Approver[]>([]);

  const [fundId, setFundId] = useState("");
  const [ministryDepartment, setMinistryDepartment] = useState("");
  const [approverId, setApproverId] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [plannedPaymentMethod, setPlannedPaymentMethod] = useState("Check");
  const [purpose, setPurpose] = useState("");
  const [description, setDescription] = useState("");
  const [requestedExpenseDate, setRequestedExpenseDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile || !activeOrgId) return;

    const load = async () => {
      const [fundsSnap, usersSnap] = await Promise.all([
        getDocs(query(
          collection(db, "funds"),
          where("tenantId", "==", profile.tenantId),
          where("organizationId", "==", activeOrgId),
          where("active", "==", true)
        )),
        getDocs(query(
          collection(db, "users"),
          where("tenantId", "==", profile.tenantId)
        )),
      ]);

      setFunds(fundsSnap.docs.map((d) => ({
        id: d.id,
        fundName: String(d.data().fundName || ""),
        ministryDepartment: String(d.data().ministryDepartment || ""),
        annualBudget: Number(d.data().annualBudget || 0),
      })));

      setApprovers(
        usersSnap.docs
          .filter((d) => {
            const orgRoles = (d.data().orgRoles || {}) as Record<string, string[]>;
            const roles = [...(orgRoles[activeOrgId] || []), ...(orgRoles["*"] || [])];
            return roles.includes("approver") || roles.includes("admin");
          })
          .map((d) => ({ id: d.id, email: String(d.data().email || d.id) }))
      );
    };

    load().catch(console.error);
  }, [profile, activeOrgId]);

  const handleFundChange = (id: string) => {
    setFundId(id);
    const fund = funds.find((f) => f.id === id);
    if (fund) setMinistryDepartment(fund.ministryDepartment);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !activeOrgId) return;
    setBusy(true);
    setError("");
    try {
      const result = await expensesApi.createPurchaseRequest({
        tenantId: profile.tenantId,
        organizationId: activeOrgId,
        fundId,
        ministryDepartment,
        approverId,
        estimatedAmount: parseFloat(estimatedAmount),
        plannedPaymentMethod,
        purpose,
        description,
        requestedExpenseDate,
      });
      navigate(`/requests/${result.requestId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request.");
      setBusy(false);
    }
  };

  if (!profile) return null;

  return (
    <div style={{ padding: 24, maxWidth: 740 }}>
      <button
        onClick={() => navigate("/requests")}
        style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 16 }}
      >
        ← Back to Requests
      </button>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "#111827" }}>New Purchase Request</h1>
      <p style={{ margin: "0 0 24px", color: "#6b7280", fontSize: 13 }}>{activeOrgId}</p>

      <form onSubmit={submit} style={{ background: "white", borderRadius: 10, padding: "28px 32px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 24px" }}>
          {/* Fund */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Fund *</label>
            {funds.length > 0 ? (
              <select value={fundId} onChange={(e) => handleFundChange(e.target.value)} required style={inputStyle}>
                <option value="">Select a fund...</option>
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.fundName} — {f.ministryDepartment}
                  </option>
                ))}
              </select>
            ) : (
              <input value={fundId} onChange={(e) => setFundId(e.target.value)} required style={inputStyle} placeholder="Fund ID" />
            )}
          </div>

          {/* Ministry */}
          <div>
            <label style={labelStyle}>Ministry / Department *</label>
            <input value={ministryDepartment} onChange={(e) => setMinistryDepartment(e.target.value)} required style={inputStyle} placeholder="e.g. Youth Ministry" />
          </div>

          {/* Approver */}
          <div>
            <label style={labelStyle}>Approver *</label>
            {approvers.length > 0 ? (
              <select value={approverId} onChange={(e) => setApproverId(e.target.value)} required style={inputStyle}>
                <option value="">Select approver...</option>
                {approvers.map((a) => (
                  <option key={a.id} value={a.id}>{a.email}</option>
                ))}
              </select>
            ) : (
              <input value={approverId} onChange={(e) => setApproverId(e.target.value)} required style={inputStyle} placeholder="Approver user ID" />
            )}
          </div>

          {/* Amount */}
          <div>
            <label style={labelStyle}>Estimated Amount ($) *</label>
            <input type="number" min="0.01" step="0.01" value={estimatedAmount} onChange={(e) => setEstimatedAmount(e.target.value)} required style={inputStyle} placeholder="0.00" />
          </div>

          {/* Payment method */}
          <div>
            <label style={labelStyle}>Payment Method *</label>
            <select value={plannedPaymentMethod} onChange={(e) => setPlannedPaymentMethod(e.target.value)} required style={inputStyle}>
              <option>Check</option>
              <option>Credit Card</option>
              <option>ACH / Wire</option>
              <option>Cash</option>
              <option>Zelle</option>
              <option>Reimbursement</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <label style={labelStyle}>Requested Expense Date *</label>
            <input type="date" value={requestedExpenseDate} onChange={(e) => setRequestedExpenseDate(e.target.value)} required style={inputStyle} />
          </div>

          {/* Purpose */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Purpose *</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} required style={inputStyle} placeholder="Brief description of the expense" />
          </div>

          {/* Description */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, height: 80, resize: "vertical" } as React.CSSProperties} placeholder="Additional details (optional)" />
          </div>
        </div>

        {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 14 }}>{error}</p>}

        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <button
            type="submit"
            disabled={busy}
            style={{ padding: "10px 28px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}
          >
            {busy ? "Creating..." : "Create Draft"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/requests")}
            style={{ padding: "10px 20px", background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
