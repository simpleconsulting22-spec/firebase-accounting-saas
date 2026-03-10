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

  return (
    <section>
      <h2>Expenses Module - Phase 4</h2>
      <p>Create, submit, approve, and track purchase requests and expense reports with role-based workflow guards.</p>

      <section style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h4 style={{ marginTop: 0 }}>Tenant and Organization Context</h4>
        <label style={{ display: "block", marginBottom: 8 }}>
          Tenant ID
          <input
            style={{ display: "block", width: "100%" }}
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            placeholder="tenant_citylight_group"
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Organization ID
          <input
            style={{ display: "block", width: "100%" }}
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            placeholder="org_citylight"
          />
        </label>
      </section>

      <PurchaseRequestForm
        mode="create"
        tenantId={tenantId}
        organizationId={organizationId}
        onRequestSaved={(requestId) => setLastRequestId(requestId)}
      />

      <PurchaseRequestForm
        mode="update"
        tenantId={tenantId}
        organizationId={organizationId}
        defaultRequestId={lastRequestId}
        onRequestSaved={(requestId) => setLastRequestId(requestId)}
      />

      <SubmitPurchaseRequestForm
        tenantId={tenantId}
        organizationId={organizationId}
        defaultRequestId={lastRequestId}
      />

      <ExpenseReportForm
        tenantId={tenantId}
        organizationId={organizationId}
        defaultRequestId={lastRequestId}
        onReportReady={(reportId) => setLastReportId(reportId)}
      />

      <ExpenseLineItemForm
        tenantId={tenantId}
        organizationId={organizationId}
        defaultRequestId={lastRequestId}
        defaultReportId={lastReportId}
      />

      <ApprovalActionsPanel
        tenantId={tenantId}
        organizationId={organizationId}
        defaultRequestId={lastRequestId}
        defaultReportId={lastReportId}
      />

      <BudgetSnapshotForm tenantId={tenantId} organizationId={organizationId} />

      <PurchaseRequestDetail
        tenantId={tenantId}
        organizationId={organizationId}
        defaultRequestId={lastRequestId}
      />
    </section>
  );
}
