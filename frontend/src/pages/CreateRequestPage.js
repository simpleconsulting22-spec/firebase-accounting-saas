import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { expensesApi } from "../modules/expenses/services";
import { useUserContext } from "../contexts/UserContext";
const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 7,
    fontSize: 14,
    color: "#111827",
    background: "white",
    boxSizing: "border-box",
};
const labelStyle = {
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
    const [funds, setFunds] = useState([]);
    const [approvers, setApprovers] = useState([]);
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
        if (!profile || !activeOrgId)
            return;
        const load = async () => {
            const [fundsSnap, usersSnap] = await Promise.all([
                getDocs(query(collection(db, "funds"), where("tenantId", "==", profile.tenantId), where("organizationId", "==", activeOrgId), where("active", "==", true))),
                getDocs(query(collection(db, "users"), where("tenantId", "==", profile.tenantId))),
            ]);
            setFunds(fundsSnap.docs.map((d) => ({
                id: d.id,
                fundName: String(d.data().fundName || ""),
                ministryDepartment: String(d.data().ministryDepartment || ""),
                annualBudget: Number(d.data().annualBudget || 0),
            })));
            setApprovers(usersSnap.docs
                .filter((d) => {
                const orgRoles = (d.data().orgRoles || {});
                const roles = [...(orgRoles[activeOrgId] || []), ...(orgRoles["*"] || [])];
                return roles.includes("approver") || roles.includes("admin");
            })
                .map((d) => ({ id: d.id, email: String(d.data().email || d.id) })));
        };
        load().catch(console.error);
    }, [profile, activeOrgId]);
    const handleFundChange = (id) => {
        setFundId(id);
        const fund = funds.find((f) => f.id === id);
        if (fund)
            setMinistryDepartment(fund.ministryDepartment);
    };
    const submit = async (e) => {
        e.preventDefault();
        if (!profile || !activeOrgId)
            return;
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create request.");
            setBusy(false);
        }
    };
    if (!profile)
        return null;
    return (_jsxs("div", { style: { padding: 24, maxWidth: 740 }, children: [_jsx("button", { onClick: () => navigate("/requests"), style: { background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 16 }, children: "\u2190 Back to Requests" }), _jsx("h1", { style: { margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "#111827" }, children: "New Purchase Request" }), _jsx("p", { style: { margin: "0 0 24px", color: "#6b7280", fontSize: 13 }, children: activeOrgId }), _jsxs("form", { onSubmit: submit, style: { background: "white", borderRadius: 10, padding: "28px 32px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }, children: [_jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 24px" }, children: [_jsxs("div", { style: { gridColumn: "1 / -1" }, children: [_jsx("label", { style: labelStyle, children: "Fund *" }), funds.length > 0 ? (_jsxs("select", { value: fundId, onChange: (e) => handleFundChange(e.target.value), required: true, style: inputStyle, children: [_jsx("option", { value: "", children: "Select a fund..." }), funds.map((f) => (_jsxs("option", { value: f.id, children: [f.fundName, " \u2014 ", f.ministryDepartment] }, f.id)))] })) : (_jsx("input", { value: fundId, onChange: (e) => setFundId(e.target.value), required: true, style: inputStyle, placeholder: "Fund ID" }))] }), _jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "Ministry / Department *" }), _jsx("input", { value: ministryDepartment, onChange: (e) => setMinistryDepartment(e.target.value), required: true, style: inputStyle, placeholder: "e.g. Youth Ministry" })] }), _jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "Approver *" }), approvers.length > 0 ? (_jsxs("select", { value: approverId, onChange: (e) => setApproverId(e.target.value), required: true, style: inputStyle, children: [_jsx("option", { value: "", children: "Select approver..." }), approvers.map((a) => (_jsx("option", { value: a.id, children: a.email }, a.id)))] })) : (_jsx("input", { value: approverId, onChange: (e) => setApproverId(e.target.value), required: true, style: inputStyle, placeholder: "Approver user ID" }))] }), _jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "Estimated Amount ($) *" }), _jsx("input", { type: "number", min: "0.01", step: "0.01", value: estimatedAmount, onChange: (e) => setEstimatedAmount(e.target.value), required: true, style: inputStyle, placeholder: "0.00" })] }), _jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "Payment Method *" }), _jsxs("select", { value: plannedPaymentMethod, onChange: (e) => setPlannedPaymentMethod(e.target.value), required: true, style: inputStyle, children: [_jsx("option", { children: "Check" }), _jsx("option", { children: "Credit Card" }), _jsx("option", { children: "ACH / Wire" }), _jsx("option", { children: "Cash" }), _jsx("option", { children: "Zelle" }), _jsx("option", { children: "Reimbursement" })] })] }), _jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "Requested Expense Date *" }), _jsx("input", { type: "date", value: requestedExpenseDate, onChange: (e) => setRequestedExpenseDate(e.target.value), required: true, style: inputStyle })] }), _jsxs("div", { style: { gridColumn: "1 / -1" }, children: [_jsx("label", { style: labelStyle, children: "Purpose *" }), _jsx("input", { value: purpose, onChange: (e) => setPurpose(e.target.value), required: true, style: inputStyle, placeholder: "Brief description of the expense" })] }), _jsxs("div", { style: { gridColumn: "1 / -1" }, children: [_jsx("label", { style: labelStyle, children: "Description" }), _jsx("textarea", { value: description, onChange: (e) => setDescription(e.target.value), style: { ...inputStyle, height: 80, resize: "vertical" }, placeholder: "Additional details (optional)" })] })] }), error && _jsx("p", { style: { color: "#dc2626", fontSize: 13, marginTop: 14 }, children: error }), _jsxs("div", { style: { marginTop: 24, display: "flex", gap: 10 }, children: [_jsx("button", { type: "submit", disabled: busy, style: { padding: "10px 28px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }, children: busy ? "Creating..." : "Create Draft" }), _jsx("button", { type: "button", onClick: () => navigate("/requests"), style: { padding: "10px 20px", background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, cursor: "pointer" }, children: "Cancel" })] })] })] }));
}
