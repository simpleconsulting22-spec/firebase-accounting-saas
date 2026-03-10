import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { expensesApi } from "../services";
export function BudgetSnapshotForm({ tenantId, organizationId }) {
    const [fundId, setFundId] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [snapshot, setSnapshot] = useState(null);
    const load = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setSnapshot(null);
        try {
            if (!tenantId || !organizationId || !fundId) {
                throw new Error("tenantId, organizationId, and fundId are required.");
            }
            const result = await expensesApi.getBudgetSnapshot({
                tenantId,
                organizationId,
                fundId
            });
            setSnapshot(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load budget snapshot.";
            setError(message);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("form", { onSubmit: load, style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h4", { style: { marginTop: 0 }, children: "Get Budget Snapshot by Fund" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Fund ID", _jsx("input", { style: { display: "block", width: "100%" }, value: fundId, onChange: (event) => setFundId(event.target.value), required: true })] }), _jsx("button", { type: "submit", disabled: busy, children: busy ? "Loading..." : "Load Budget Snapshot" }), error ? _jsx("p", { style: { color: "#cf222e" }, children: error }) : null, snapshot ? _jsx("pre", { style: { overflowX: "auto" }, children: JSON.stringify(snapshot, null, 2) }) : null] }));
}
