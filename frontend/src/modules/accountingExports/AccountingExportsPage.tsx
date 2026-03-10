import { useState } from "react";
import { ExportGeneratorForm } from "./components/ExportGeneratorForm";
import { ExportHistoryTable } from "./components/ExportHistoryTable";
import { accountingExportsApi } from "./services";
import { AccountingExportHistoryItem } from "./types";

export default function AccountingExportsPage() {
  const [tenantId, setTenantId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [history, setHistory] = useState<AccountingExportHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshHistory = async () => {
    setHistoryLoading(true);
    setError("");
    try {
      if (!tenantId || !organizationId) {
        throw new Error("tenantId and organizationId are required.");
      }
      const rows = await accountingExportsApi.listAccountingExports({
        tenantId,
        organizationId,
        limit: 25
      });
      setHistory(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load export history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <section>
      <h2>Accounting Exports Module - Phase 5</h2>
      <p>
        Generate QuickBooks-ready expense exports through a reusable accounting bridge designed for future GL and
        reporting integrations.
      </p>

      <section style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Scope</h3>
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

      <ExportGeneratorForm tenantId={tenantId} organizationId={organizationId} onGenerated={refreshHistory} />
      <ExportHistoryTable rows={history} loading={historyLoading} onRefresh={refreshHistory} />
      {error ? <p style={{ color: "#cf222e" }}>{error}</p> : null}
    </section>
  );
}
