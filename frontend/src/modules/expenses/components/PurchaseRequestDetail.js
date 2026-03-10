import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { expensesApi } from "../services";
export function PurchaseRequestDetail({ tenantId, organizationId, defaultRequestId }) {
    const [requestId, setRequestId] = useState(defaultRequestId || "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [detail, setDetail] = useState(null);
    useEffect(() => {
        setRequestId(defaultRequestId || "");
    }, [defaultRequestId]);
    const load = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setDetail(null);
        try {
            if (!tenantId || !organizationId || !requestId) {
                throw new Error("tenantId, organizationId, and requestId are required.");
            }
            const result = await expensesApi.getPurchaseRequestDetail({
                tenantId,
                organizationId,
                requestId
            });
            setDetail(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load request detail.";
            setError(message);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("section", { style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12 }, children: [_jsx("h4", { style: { marginTop: 0 }, children: "Get Purchase Request Detail" }), _jsxs("form", { onSubmit: load, children: [_jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Request ID", _jsx("input", { style: { display: "block", width: "100%" }, value: requestId, onChange: (event) => setRequestId(event.target.value), required: true })] }), _jsx("button", { type: "submit", disabled: busy, children: busy ? "Loading..." : "Load Detail" })] }), error ? _jsx("p", { style: { color: "#cf222e" }, children: error }) : null, detail ? (_jsxs("div", { style: { marginTop: 12 }, children: [_jsx("h5", { children: "Budget Snapshot" }), _jsx("pre", { style: { overflowX: "auto" }, children: JSON.stringify(detail.budgetSnapshot, null, 2) }), _jsx("h5", { children: "Request" }), _jsx("pre", { style: { overflowX: "auto" }, children: JSON.stringify(detail.request, null, 2) }), _jsx("h5", { children: "Expense Report" }), _jsx("pre", { style: { overflowX: "auto" }, children: JSON.stringify(detail.expenseReport, null, 2) }), _jsx("h5", { children: "Line Items" }), _jsx("pre", { style: { overflowX: "auto" }, children: JSON.stringify(detail.lineItems, null, 2) }), _jsx("h5", { children: "Approval History" }), _jsx("pre", { style: { overflowX: "auto" }, children: JSON.stringify(detail.approvals, null, 2) })] })) : null] }));
}
