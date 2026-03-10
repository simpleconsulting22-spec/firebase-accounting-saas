import { FormEvent, useState } from "react";
import { vendorsApi } from "../services";
import { VendorRecord } from "../types";

interface VendorManagerProps {
  tenantId: string;
  organizationId: string;
}

const parseMethods = (text: string): string[] =>
  text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export function VendorManager({ tenantId, organizationId }: VendorManagerProps) {
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [name, setName] = useState("");
  const [paymentMethods, setPaymentMethods] = useState("");
  const [active, setActive] = useState(true);
  const [updateVendorId, setUpdateVendorId] = useState("");
  const [updateName, setUpdateName] = useState("");
  const [updatePaymentMethods, setUpdatePaymentMethods] = useState("");
  const [updateActive, setUpdateActive] = useState(true);
  const [deleteVendorId, setDeleteVendorId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const ensureScope = () => {
    if (!tenantId || !organizationId) {
      throw new Error("tenantId and organizationId are required.");
    }
  };

  const loadVendors = async () => {
    setListBusy(true);
    setError("");
    try {
      ensureScope();
      const rows = await vendorsApi.listVendors({ tenantId, organizationId });
      setVendors(rows);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to load vendors.";
      setError(text);
    } finally {
      setListBusy(false);
    }
  };

  const createVendor = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      ensureScope();
      const result = await vendorsApi.createVendor({
        tenantId,
        organizationId,
        name,
        paymentMethods: parseMethods(paymentMethods),
        active
      });
      setMessage(`Vendor created: ${result.vendorId}`);
      setName("");
      setPaymentMethods("");
      await loadVendors();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to create vendor.";
      setError(text);
    }
  };

  const updateVendor = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      ensureScope();
      await vendorsApi.updateVendor({
        tenantId,
        organizationId,
        vendorId: updateVendorId,
        name: updateName || undefined,
        paymentMethods: updatePaymentMethods ? parseMethods(updatePaymentMethods) : undefined,
        active: updateActive
      });
      setMessage(`Vendor updated: ${updateVendorId}`);
      await loadVendors();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to update vendor.";
      setError(text);
    }
  };

  const deleteVendor = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      ensureScope();
      await vendorsApi.deleteVendor({ tenantId, organizationId, vendorId: deleteVendorId });
      setMessage(`Vendor deleted: ${deleteVendorId}`);
      setDeleteVendorId("");
      await loadVendors();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to delete vendor.";
      setError(text);
    }
  };

  return (
    <section style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Vendors (Shared by Vendor Group)</h3>
      <button type="button" onClick={loadVendors} disabled={listBusy}>
        {listBusy ? "Loading Vendors..." : "Refresh Vendors"}
      </button>
      <pre style={{ overflowX: "auto" }}>{JSON.stringify(vendors, null, 2)}</pre>

      <form onSubmit={createVendor} style={{ marginBottom: 12 }}>
        <h4>Create Vendor</h4>
        <label style={{ display: "block", marginBottom: 8 }}>
          Name
          <input
            style={{ display: "block", width: "100%" }}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Payment Methods (comma-separated)
          <input
            style={{ display: "block", width: "100%" }}
            value={paymentMethods}
            onChange={(event) => setPaymentMethods(event.target.value)}
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />{" "}
          Active
        </label>
        <button type="submit">Create Vendor</button>
      </form>

      <form onSubmit={updateVendor} style={{ marginBottom: 12 }}>
        <h4>Update Vendor</h4>
        <label style={{ display: "block", marginBottom: 8 }}>
          Vendor ID
          <input
            style={{ display: "block", width: "100%" }}
            value={updateVendorId}
            onChange={(event) => setUpdateVendorId(event.target.value)}
            required
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Name (optional)
          <input
            style={{ display: "block", width: "100%" }}
            value={updateName}
            onChange={(event) => setUpdateName(event.target.value)}
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Payment Methods (optional, comma-separated)
          <input
            style={{ display: "block", width: "100%" }}
            value={updatePaymentMethods}
            onChange={(event) => setUpdatePaymentMethods(event.target.value)}
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={updateActive}
            onChange={(event) => setUpdateActive(event.target.checked)}
          />{" "}
          Active
        </label>
        <button type="submit">Update Vendor</button>
      </form>

      <form onSubmit={deleteVendor}>
        <h4>Delete Vendor</h4>
        <label style={{ display: "block", marginBottom: 8 }}>
          Vendor ID
          <input
            style={{ display: "block", width: "100%" }}
            value={deleteVendorId}
            onChange={(event) => setDeleteVendorId(event.target.value)}
            required
          />
        </label>
        <button type="submit">Delete Vendor</button>
      </form>

      {message ? <p style={{ color: "#1a7f37" }}>{message}</p> : null}
      {error ? <p style={{ color: "#cf222e" }}>{error}</p> : null}
    </section>
  );
}
