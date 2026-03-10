import { useState } from "react";
import { CategoryManager } from "./components/CategoryManager";
import { VendorManager } from "./components/VendorManager";

export default function VendorsAdminPage() {
  const [tenantId, setTenantId] = useState("");
  const [organizationId, setOrganizationId] = useState("");

  return (
    <section>
      <h2>Vendors and Categories Admin</h2>
      <p>
        Vendors are scoped by vendor group and categories are scoped by category group based on the selected
        organization.
      </p>

      <section style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Organization Context</h3>
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

      <VendorManager tenantId={tenantId} organizationId={organizationId} />
      <CategoryManager tenantId={tenantId} organizationId={organizationId} />
    </section>
  );
}
