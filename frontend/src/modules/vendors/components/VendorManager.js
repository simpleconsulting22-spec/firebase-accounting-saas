import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { vendorsApi } from "../services";
const parseMethods = (text) => text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
export function VendorManager({ tenantId, organizationId }) {
    const [vendors, setVendors] = useState([]);
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
        }
        catch (err) {
            const text = err instanceof Error ? err.message : "Failed to load vendors.";
            setError(text);
        }
        finally {
            setListBusy(false);
        }
    };
    const createVendor = async (event) => {
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
        }
        catch (err) {
            const text = err instanceof Error ? err.message : "Failed to create vendor.";
            setError(text);
        }
    };
    const updateVendor = async (event) => {
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
        }
        catch (err) {
            const text = err instanceof Error ? err.message : "Failed to update vendor.";
            setError(text);
        }
    };
    const deleteVendor = async (event) => {
        event.preventDefault();
        setMessage("");
        setError("");
        try {
            ensureScope();
            await vendorsApi.deleteVendor({ tenantId, organizationId, vendorId: deleteVendorId });
            setMessage(`Vendor deleted: ${deleteVendorId}`);
            setDeleteVendorId("");
            await loadVendors();
        }
        catch (err) {
            const text = err instanceof Error ? err.message : "Failed to delete vendor.";
            setError(text);
        }
    };
    return (_jsxs("section", { style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { style: { marginTop: 0 }, children: "Vendors (Shared by Vendor Group)" }), _jsx("button", { type: "button", onClick: loadVendors, disabled: listBusy, children: listBusy ? "Loading Vendors..." : "Refresh Vendors" }), _jsx("pre", { style: { overflowX: "auto" }, children: JSON.stringify(vendors, null, 2) }), _jsxs("form", { onSubmit: createVendor, style: { marginBottom: 12 }, children: [_jsx("h4", { children: "Create Vendor" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Name", _jsx("input", { style: { display: "block", width: "100%" }, value: name, onChange: (event) => setName(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Payment Methods (comma-separated)", _jsx("input", { style: { display: "block", width: "100%" }, value: paymentMethods, onChange: (event) => setPaymentMethods(event.target.value) })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: [_jsx("input", { type: "checkbox", checked: active, onChange: (event) => setActive(event.target.checked) }), " ", "Active"] }), _jsx("button", { type: "submit", children: "Create Vendor" })] }), _jsxs("form", { onSubmit: updateVendor, style: { marginBottom: 12 }, children: [_jsx("h4", { children: "Update Vendor" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Vendor ID", _jsx("input", { style: { display: "block", width: "100%" }, value: updateVendorId, onChange: (event) => setUpdateVendorId(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Name (optional)", _jsx("input", { style: { display: "block", width: "100%" }, value: updateName, onChange: (event) => setUpdateName(event.target.value) })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Payment Methods (optional, comma-separated)", _jsx("input", { style: { display: "block", width: "100%" }, value: updatePaymentMethods, onChange: (event) => setUpdatePaymentMethods(event.target.value) })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: [_jsx("input", { type: "checkbox", checked: updateActive, onChange: (event) => setUpdateActive(event.target.checked) }), " ", "Active"] }), _jsx("button", { type: "submit", children: "Update Vendor" })] }), _jsxs("form", { onSubmit: deleteVendor, children: [_jsx("h4", { children: "Delete Vendor" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Vendor ID", _jsx("input", { style: { display: "block", width: "100%" }, value: deleteVendorId, onChange: (event) => setDeleteVendorId(event.target.value), required: true })] }), _jsx("button", { type: "submit", children: "Delete Vendor" })] }), message ? _jsx("p", { style: { color: "#1a7f37" }, children: message }) : null, error ? _jsx("p", { style: { color: "#cf222e" }, children: error }) : null] }));
}
