import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { ApprovalActionsPanel } from "./components/ApprovalActionsPanel";
import { BudgetSnapshotForm } from "./components/BudgetSnapshotForm";
import { ExpenseLineItemForm } from "./components/ExpenseLineItemForm";
import { ExpenseReportForm } from "./components/ExpenseReportForm";
import { PurchaseRequestDetail } from "./components/PurchaseRequestDetail";
import { PurchaseRequestForm } from "./components/PurchaseRequestForm";
import { SubmitPurchaseRequestForm } from "./components/SubmitPurchaseRequestForm";
export default function ExpensesPage() {
    const [tenantId, setTenantId] = useState("");
    const [organizationId, setOrganizationId] = useState("");
    const [lastRequestId, setLastRequestId] = useState("");
    const [lastReportId, setLastReportId] = useState("");
    return (_jsxs("section", { children: [_jsx("h2", { children: "Expenses Module - Phase 4" }), _jsx("p", { children: "Create, submit, approve, and track purchase requests and expense reports with role-based workflow guards." }), _jsxs("section", { style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h4", { style: { marginTop: 0 }, children: "Tenant and Organization Context" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Tenant ID", _jsx("input", { style: { display: "block", width: "100%" }, value: tenantId, onChange: (event) => setTenantId(event.target.value), placeholder: "tenant_citylight_group" })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Organization ID", _jsx("input", { style: { display: "block", width: "100%" }, value: organizationId, onChange: (event) => setOrganizationId(event.target.value), placeholder: "org_citylight" })] })] }), _jsx(PurchaseRequestForm, { mode: "create", tenantId: tenantId, organizationId: organizationId, onRequestSaved: (requestId) => setLastRequestId(requestId) }), _jsx(PurchaseRequestForm, { mode: "update", tenantId: tenantId, organizationId: organizationId, defaultRequestId: lastRequestId, onRequestSaved: (requestId) => setLastRequestId(requestId) }), _jsx(SubmitPurchaseRequestForm, { tenantId: tenantId, organizationId: organizationId, defaultRequestId: lastRequestId }), _jsx(ExpenseReportForm, { tenantId: tenantId, organizationId: organizationId, defaultRequestId: lastRequestId, onReportReady: (reportId) => setLastReportId(reportId) }), _jsx(ExpenseLineItemForm, { tenantId: tenantId, organizationId: organizationId, defaultRequestId: lastRequestId, defaultReportId: lastReportId }), _jsx(ApprovalActionsPanel, { tenantId: tenantId, organizationId: organizationId, defaultRequestId: lastRequestId, defaultReportId: lastReportId }), _jsx(BudgetSnapshotForm, { tenantId: tenantId, organizationId: organizationId }), _jsx(PurchaseRequestDetail, { tenantId: tenantId, organizationId: organizationId, defaultRequestId: lastRequestId })] }));
}
