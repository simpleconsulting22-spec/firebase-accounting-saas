import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { CategoryManager } from "./components/CategoryManager";
import { VendorManager } from "./components/VendorManager";
export default function VendorsAdminPage() {
    const [tenantId, setTenantId] = useState("");
    const [organizationId, setOrganizationId] = useState("");
    return (_jsxs("section", { children: [_jsx("h2", { children: "Vendors and Categories Admin" }), _jsx("p", { children: "Vendors are scoped by vendor group and categories are scoped by category group based on the selected organization." }), _jsxs("section", { style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { style: { marginTop: 0 }, children: "Organization Context" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Tenant ID", _jsx("input", { style: { display: "block", width: "100%" }, value: tenantId, onChange: (event) => setTenantId(event.target.value), placeholder: "tenant_citylight_group" })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Organization ID", _jsx("input", { style: { display: "block", width: "100%" }, value: organizationId, onChange: (event) => setOrganizationId(event.target.value), placeholder: "org_citylight" })] })] }), _jsx(VendorManager, { tenantId: tenantId, organizationId: organizationId }), _jsx(CategoryManager, { tenantId: tenantId, organizationId: organizationId })] }));
}
