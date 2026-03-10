import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { ExportGeneratorForm } from "./components/ExportGeneratorForm";
import { ExportHistoryTable } from "./components/ExportHistoryTable";
import { accountingExportsApi } from "./services";
export default function AccountingExportsPage() {
    const [tenantId, setTenantId] = useState("");
    const [organizationId, setOrganizationId] = useState("");
    const [history, setHistory] = useState([]);
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load export history.");
        }
        finally {
            setHistoryLoading(false);
        }
    };
    return (_jsxs("section", { children: [_jsx("h2", { children: "Accounting Exports Module - Phase 5" }), _jsx("p", { children: "Generate QuickBooks-ready expense exports through a reusable accounting bridge designed for future GL and reporting integrations." }), _jsxs("section", { style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { style: { marginTop: 0 }, children: "Scope" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Tenant ID", _jsx("input", { style: { display: "block", width: "100%" }, value: tenantId, onChange: (event) => setTenantId(event.target.value), placeholder: "tenant_citylight_group" })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Organization ID", _jsx("input", { style: { display: "block", width: "100%" }, value: organizationId, onChange: (event) => setOrganizationId(event.target.value), placeholder: "org_citylight" })] })] }), _jsx(ExportGeneratorForm, { tenantId: tenantId, organizationId: organizationId, onGenerated: refreshHistory }), _jsx(ExportHistoryTable, { rows: history, loading: historyLoading, onRefresh: refreshHistory }), error ? _jsx("p", { style: { color: "#cf222e" }, children: error }) : null] }));
}
