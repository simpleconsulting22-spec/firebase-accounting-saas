import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { useUserContext } from "../contexts/UserContext";
import { api } from "../workflow/api";
const fmtDate = (val) => {
    if (!val)
        return "—";
    if (typeof val === "object" && val.seconds) {
        return new Date(val.seconds * 1000).toLocaleDateString('en-US');
    }
    try {
        return new Date(val).toLocaleDateString('en-US');
    }
    catch {
        return String(val);
    }
};
export default function VendorPage() {
    const { profile, activeOrgId, activeOrgName } = useUserContext();
    const [vendors, setVendors] = useState([]);
    const [myRequests, setMyRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [busy, setBusy] = useState(false);
    // Form
    const [showForm, setShowForm] = useState(false);
    const [vendorName, setVendorName] = useState("");
    const [vendorEmail, setVendorEmail] = useState("");
    const [contactName, setContactName] = useState("");
    const [notes, setNotes] = useState("");
    const loadData = useCallback(async () => {
        if (!profile || !activeOrgId)
            return;
        setLoading(true);
        setError("");
        try {
            const [vendorResult, requestsResult] = await Promise.all([
                api.getActiveVendors({ orgId: activeOrgId }),
                api.getVendorDashboards({ orgId: activeOrgId }),
            ]);
            setVendors(vendorResult?.vendors || vendorResult || []);
            setMyRequests(requestsResult?.requests || requestsResult || []);
        }
        catch (err) {
            setError("Failed to load vendor data.");
        }
        finally {
            setLoading(false);
        }
    }, [profile, activeOrgId]);
    useEffect(() => { loadData(); }, [loadData]);
    const resetForm = () => {
        setVendorName("");
        setVendorEmail("");
        setContactName("");
        setNotes("");
        setShowForm(false);
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!vendorName.trim()) {
            setError("Vendor name is required.");
            return;
        }
        setBusy(true);
        setError("");
        setSuccess("");
        try {
            await api.submitVendorSetupRequest({
                orgId: activeOrgId,
                vendorName,
                vendorEmail,
                contactName,
                notes,
            });
            setSuccess(`Vendor setup request for "${vendorName}" submitted successfully!`);
            resetForm();
            await loadData();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit vendor request.");
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "p-6 max-w-5xl mx-auto", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Vendors" }), _jsx("button", { onClick: () => setShowForm(v => !v), className: "btn btn-primary btn-sm", children: showForm ? "Cancel" : "+ Request New Vendor" })] }), _jsx("p", { className: "text-sm text-base-content/60 mb-6", children: activeOrgName }), error && _jsx("div", { className: "alert alert-error mb-4", children: _jsx("span", { children: error }) }), success && _jsx("div", { className: "alert alert-success mb-4", children: _jsx("span", { children: success }) }), showForm && (_jsx("div", { className: "card bg-base-100 shadow border-t-4 border-primary mb-6", children: _jsxs("div", { className: "card-body", children: [_jsx("h2", { className: "card-title text-base", children: "Request New Vendor Setup" }), _jsxs("form", { onSubmit: handleSubmit, className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "form-control md:col-span-2", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Vendor Name *" }) }), _jsx("input", { className: "input input-bordered", value: vendorName, onChange: e => setVendorName(e.target.value), placeholder: "Business or individual name", required: true })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Vendor Email" }) }), _jsx("input", { type: "email", className: "input input-bordered", value: vendorEmail, onChange: e => setVendorEmail(e.target.value), placeholder: "vendor@example.com" })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Contact Name" }) }), _jsx("input", { className: "input input-bordered", value: contactName, onChange: e => setContactName(e.target.value), placeholder: "Primary contact person" })] }), _jsxs("div", { className: "form-control md:col-span-2", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Notes" }) }), _jsx("textarea", { className: "textarea textarea-bordered", value: notes, onChange: e => setNotes(e.target.value), placeholder: "Additional details about this vendor", rows: 2 })] }), _jsxs("div", { className: "md:col-span-2 flex gap-3", children: [_jsx("button", { type: "submit", disabled: busy, className: "btn btn-primary", children: busy ? _jsx("span", { className: "loading loading-spinner loading-sm" }) : "Submit Request" }), _jsx("button", { type: "button", onClick: resetForm, className: "btn btn-ghost", children: "Cancel" })] })] })] }) })), loading ? (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "skeleton h-10 w-full rounded" }), _jsx("div", { className: "skeleton h-10 w-full rounded" }), _jsx("div", { className: "skeleton h-10 w-full rounded" })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "card bg-base-100 shadow mb-6", children: _jsxs("div", { className: "card-body", children: [_jsx("h2", { className: "card-title text-base mb-2", children: "Active Vendors" }), vendors.length === 0 ? (_jsx("div", { className: "py-6 text-center text-base-content/50 text-sm", children: "No active vendors yet." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "table table-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Name" }), _jsx("th", { children: "Email" }), _jsx("th", { children: "Contact" }), _jsx("th", { children: "Status" })] }) }), _jsx("tbody", { children: vendors.map((v) => (_jsxs("tr", { className: "hover", children: [_jsx("td", { className: "font-medium", children: v.vendorName || v.name }), _jsx("td", { className: "text-sm text-base-content/70", children: v.vendorEmail || v.email || "—" }), _jsx("td", { className: "text-sm", children: v.contactName || "—" }), _jsx("td", { children: _jsx("span", { className: `badge badge-sm ${v.active === true || v.status === "ACTIVE" ? "badge-success" : "badge-ghost"}`, children: v.active === true ? "Active" : v.active === false ? "Inactive" : v.status || "Active" }) })] }, v.id))) })] }) }))] }) }), _jsx("div", { className: "card bg-base-100 shadow", children: _jsxs("div", { className: "card-body", children: [_jsx("h2", { className: "card-title text-base mb-2", children: "My Vendor Setup Requests" }), myRequests.length === 0 ? (_jsx("div", { className: "py-6 text-center text-base-content/50 text-sm", children: "You haven't submitted any vendor setup requests yet." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "table table-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Vendor Name" }), _jsx("th", { children: "Email" }), _jsx("th", { children: "Contact" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Notes" }), _jsx("th", { children: "Submitted" })] }) }), _jsx("tbody", { children: myRequests.map((req, i) => (_jsxs("tr", { className: "hover", children: [_jsx("td", { className: "font-medium", children: req.vendorName }), _jsx("td", { className: "text-sm text-base-content/70", children: req.vendorEmail || "—" }), _jsx("td", { className: "text-sm", children: req.contactName || "—" }), _jsx("td", { children: _jsx("span", { className: `badge badge-sm ${req.status === "APPROVED" ? "badge-success" :
                                                                    req.status === "REJECTED" ? "badge-error" :
                                                                        "badge-warning"}`, children: req.status || "PENDING" }) }), _jsx("td", { className: "text-sm text-base-content/60 max-w-xs truncate", children: req.notes || "—" }), _jsx("td", { className: "text-xs text-base-content/60", children: fmtDate(req.createdAt) })] }, req.id || i))) })] }) }))] }) })] }))] }));
}
