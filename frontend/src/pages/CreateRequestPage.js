import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUserContext } from "../contexts/UserContext";
import { api } from "../workflow/api";
import { FUNDS, PAYMENT_METHODS, ORG_NAMES } from "../workflow/constants";
function VendorSetupModal({ orgId, onClose, onSuccess }) {
    const [vendorName, setVendorName] = useState("");
    const [vendorEmail, setVendorEmail] = useState("");
    const [contactName, setContactName] = useState("");
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!vendorName.trim()) {
            setError("Vendor name is required.");
            return;
        }
        if (!vendorEmail.trim()) {
            setError("Vendor email is required.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            await api.submitVendorSetupRequest({ orgId, vendorName, vendorEmail, contactName, notes });
            onSuccess(`Vendor setup request submitted for "${vendorName}". An admin will review it.`);
            onClose();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit vendor request.");
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "modal modal-open", children: [_jsxs("div", { className: "modal-box max-w-md", children: [_jsx("h3", { className: "font-bold text-lg mb-4", children: "Request New Vendor" }), error && _jsx("div", { className: "alert alert-error mb-3", children: _jsx("span", { children: error }) }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Vendor Name *" }) }), _jsx("input", { className: "input input-bordered", value: vendorName, onChange: e => setVendorName(e.target.value), placeholder: "e.g. Office Depot", required: true })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Vendor Email *" }) }), _jsx("input", { type: "email", className: "input input-bordered", value: vendorEmail, onChange: e => setVendorEmail(e.target.value), placeholder: "vendor@example.com", required: true })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Contact Name" }) }), _jsx("input", { className: "input input-bordered", value: contactName, onChange: e => setContactName(e.target.value), placeholder: "Primary contact at vendor" })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Description" }) }), _jsx("textarea", { className: "textarea textarea-bordered", value: notes, onChange: e => setNotes(e.target.value), placeholder: "Why is this vendor needed?", rows: 3 })] }), _jsxs("div", { className: "modal-action", children: [_jsx("button", { type: "button", onClick: onClose, className: "btn btn-ghost", disabled: busy, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: busy, children: busy ? _jsx("span", { className: "loading loading-spinner loading-sm" }) : "Submit Request" })] })] })] }), _jsx("div", { className: "modal-backdrop", onClick: onClose })] }));
}
// ─── Create Request Page ──────────────────────────────────────────────────────
export default function CreateRequestPage() {
    const navigate = useNavigate();
    const { id: editId } = useParams();
    const isEdit = !!editId;
    const { profile, activeOrgId } = useUserContext();
    const [departments, setDepartments] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showVendorModal, setShowVendorModal] = useState(false);
    // Form fields
    const [orgId, setOrgId] = useState(activeOrgId);
    const [ministryDepartment, setMinistryDepartment] = useState("");
    const [approverId, setApproverId] = useState("");
    const [approverEmail, setApproverEmail] = useState("");
    const [approverName, setApproverName] = useState("");
    const [fundId, setFundId] = useState("");
    const [vendorId, setVendorId] = useState("");
    const [vendorName, setVendorName] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [estimatedAmount, setEstimatedAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("Check");
    const [purpose, setPurpose] = useState("");
    const [description, setDescription] = useState("");
    const [requestedExpenseDate, setRequestedExpenseDate] = useState("");
    const loadData = useCallback(async () => {
        if (!activeOrgId)
            return;
        setLoadingData(true);
        try {
            const [depts, vends, cats] = await Promise.all([
                api.adminListDepartments({ orgId: activeOrgId }),
                api.getActiveVendors({ orgId: activeOrgId }),
                api.adminListCategories({ orgId: activeOrgId }),
            ]);
            setDepartments(depts?.departments || []);
            setVendors(vends?.vendors || []);
            setCategories(cats?.categories || []);
            if (isEdit && editId) {
                const result = await api.getRequestDetail({ requestId: editId, orgId: activeOrgId });
                const req = result.request || result;
                setMinistryDepartment(req.ministryDepartment || "");
                setApproverId(req.approverId || "");
                setApproverEmail(req.approverEmail || "");
                setApproverName(req.approverName || "");
                setFundId(req.fundId || "");
                setVendorId(req.vendorId || "");
                setVendorName(req.vendorName || "");
                setCategoryId(req.category || "");
                setEstimatedAmount(req.estimatedAmount ? String(req.estimatedAmount) : "");
                setPaymentMethod(req.paymentMethod || "Check");
                setPurpose(req.purpose || "");
                setDescription(req.description || "");
                setRequestedExpenseDate(req.requestedExpenseDate || "");
            }
        }
        catch (err) {
            console.error(err);
        }
        finally {
            setLoadingData(false);
        }
    }, [activeOrgId, isEdit, editId]);
    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => { setOrgId(activeOrgId); }, [activeOrgId]);
    const handleDeptChange = async (deptName) => {
        setMinistryDepartment(deptName);
        setApproverId("");
        setApproverEmail("");
        setApproverName("");
        if (!deptName || !activeOrgId)
            return;
        // Auto-fill approver from local departments list first for speed
        const dept = departments.find(d => d.ministryDepartment === deptName);
        if (dept) {
            setApproverId(dept.approverId || "");
            setApproverEmail(dept.approverEmail || "");
            setApproverName(dept.approverName || "");
            return;
        }
        try {
            const result = await api.getApproverMapping({ orgId: activeOrgId, departmentName: deptName });
            if (result) {
                setApproverId(result.approverId || "");
                setApproverEmail(result.approverEmail || "");
                setApproverName(result.approverName || "");
            }
        }
        catch (err) {
            console.error(err);
        }
    };
    const handleVendorChange = (value) => {
        if (value === "__new__") {
            setShowVendorModal(true);
        }
        else {
            setVendorId(value);
            const v = vendors.find(v => v.id === value);
            setVendorName(v?.vendorName || "");
        }
    };
    const buildPayload = () => ({
        orgId,
        ministryDepartment,
        approverId,
        approverEmail,
        approverName,
        fundId,
        vendorId,
        vendorName: vendors.find(v => v.id === vendorId)?.vendorName || vendorName,
        category: categoryId,
        estimatedAmount: parseFloat(estimatedAmount),
        paymentMethod,
        purpose,
        description,
        requestedExpenseDate,
        ...(isEdit ? { requestId: editId } : {}),
    });
    const handleSaveDraft = async (e) => {
        e.preventDefault();
        if (!purpose.trim()) {
            setError("Purpose is required.");
            return;
        }
        if (!estimatedAmount || parseFloat(estimatedAmount) <= 0) {
            setError("Valid estimated amount is required.");
            return;
        }
        setBusy(true);
        setError("");
        setSuccess("");
        try {
            const result = await api.savePurchaseRequestDraft(buildPayload());
            const newId = result?.requestId || result?.id;
            setSuccess(`Draft saved. Request ID: ${newId}`);
            if (!isEdit && newId)
                navigate(`/requests/${newId}`);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save draft.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!ministryDepartment) {
            setError("Ministry department is required.");
            return;
        }
        if (!vendorId) {
            setError("Vendor is required.");
            return;
        }
        if (!categoryId) {
            setError("Category is required.");
            return;
        }
        if (!estimatedAmount || parseFloat(estimatedAmount) <= 0) {
            setError("Valid estimated amount is required.");
            return;
        }
        if (!paymentMethod) {
            setError("Payment method is required.");
            return;
        }
        if (!requestedExpenseDate) {
            setError("Expense date is required.");
            return;
        }
        if (!purpose.trim()) {
            setError("Purpose is required.");
            return;
        }
        setBusy(true);
        setError("");
        setSuccess("");
        try {
            const result = await api.submitPreApproval(buildPayload());
            const newId = result?.requestId || result?.id || editId;
            setSuccess(`Request submitted for pre-approval! ID: ${newId}`);
            if (newId)
                navigate(`/requests/${newId}`);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit request.");
        }
        finally {
            setBusy(false);
        }
    };
    if (loadingData) {
        return (_jsxs("div", { className: "p-6", children: [_jsx("div", { className: "skeleton h-8 w-64 mb-4" }), _jsx("div", { className: "skeleton h-96 w-full rounded-box" })] }));
    }
    const orgOptions = profile?.orgIds || [activeOrgId];
    return (_jsxs("div", { className: "p-6 max-w-2xl mx-auto", children: [showVendorModal && (_jsx(VendorSetupModal, { orgId: orgId, onClose: () => setShowVendorModal(false), onSuccess: (msg) => setSuccess(msg) })), _jsx("button", { onClick: () => navigate(-1), className: "btn btn-ghost btn-sm mb-4", children: "\u2190 Back" }), _jsx("h1", { className: "text-2xl font-bold mb-1", children: isEdit ? "Edit Request" : "New Purchase Request" }), _jsx("p", { className: "text-sm text-base-content/60 mb-6", children: ORG_NAMES[activeOrgId] || activeOrgId }), success && _jsx("div", { className: "alert alert-success mb-4", children: _jsx("span", { children: success }) }), error && _jsx("div", { className: "alert alert-error mb-4", children: _jsx("span", { children: error }) }), _jsx("form", { className: "card bg-base-100 shadow", children: _jsxs("div", { className: "card-body space-y-4", children: [orgOptions.length > 1 && (_jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Organization *" }) }), _jsx("select", { className: "select select-bordered", value: orgId, onChange: e => setOrgId(e.target.value), children: orgOptions.map(id => (_jsx("option", { value: id, children: ORG_NAMES[id] || id }, id))) })] })), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Ministry / Department *" }) }), departments.length > 0 ? (_jsxs("select", { className: "select select-bordered", value: ministryDepartment, onChange: e => handleDeptChange(e.target.value), required: true, children: [_jsx("option", { value: "", children: "Select department\u2026" }), departments.map((d, i) => (_jsx("option", { value: d.ministryDepartment, children: d.ministryDepartment }, d.id || i)))] })) : (_jsx("input", { className: "input input-bordered", value: ministryDepartment, onChange: e => setMinistryDepartment(e.target.value), placeholder: "e.g. Youth Ministry", required: true }))] }), approverEmail && (_jsx("div", { className: "alert alert-info py-2", children: _jsxs("span", { className: "text-sm", children: ["Approver: ", _jsx("strong", { children: approverName || approverEmail }), " (", approverEmail, ")"] }) })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Fund" }) }), _jsxs("select", { className: "select select-bordered", value: fundId, onChange: e => setFundId(e.target.value), children: [_jsx("option", { value: "", children: "Select fund\u2026" }), FUNDS.map(f => _jsx("option", { value: f, children: f }, f))] })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Category *" }) }), categories.length > 0 ? (_jsxs("select", { className: "select select-bordered", value: categoryId, onChange: e => setCategoryId(e.target.value), required: true, children: [_jsx("option", { value: "", children: "Select category\u2026" }), categories.filter(c => c.active !== false).map(c => (_jsx("option", { value: c.categoryId, children: c.categoryName }, c.id || c.categoryId)))] })) : (_jsx("input", { className: "input input-bordered", value: categoryId, onChange: e => setCategoryId(e.target.value), placeholder: "e.g. Office Supplies", required: true }))] })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Vendor *" }) }), _jsxs("select", { className: "select select-bordered", value: vendorId, onChange: e => handleVendorChange(e.target.value), required: true, children: [_jsx("option", { value: "", children: "Select vendor\u2026" }), vendors.map(v => (_jsx("option", { value: v.id, children: v.vendorName }, v.id))), _jsx("option", { value: "__new__", children: "+ Request New Vendor" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Estimated Amount ($) *" }) }), _jsx("input", { type: "number", min: "0.01", step: "0.01", className: "input input-bordered", value: estimatedAmount, onChange: e => setEstimatedAmount(e.target.value), placeholder: "0.00", required: true })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Payment Method *" }) }), _jsx("select", { className: "select select-bordered", value: paymentMethod, onChange: e => setPaymentMethod(e.target.value), required: true, children: PAYMENT_METHODS.map(m => _jsx("option", { value: m, children: m }, m)) })] })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Requested Expense Date *" }) }), _jsx("input", { type: "date", className: "input input-bordered", value: requestedExpenseDate, onChange: e => setRequestedExpenseDate(e.target.value), required: true })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Purpose *" }) }), _jsx("input", { className: "input input-bordered", value: purpose, onChange: e => setPurpose(e.target.value), placeholder: "Brief description of the expense", required: true })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Description" }) }), _jsx("textarea", { className: "textarea textarea-bordered", value: description, onChange: e => setDescription(e.target.value), placeholder: "Additional details (optional)", rows: 3 })] }), _jsxs("div", { className: "flex flex-wrap gap-3 pt-2", children: [_jsx("button", { type: "button", onClick: handleSaveDraft, disabled: busy, className: "btn btn-outline", children: busy ? _jsx("span", { className: "loading loading-spinner loading-sm" }) : "Save Draft" }), _jsx("button", { type: "button", onClick: handleSubmit, disabled: busy, className: "btn btn-primary", children: busy ? _jsx("span", { className: "loading loading-spinner loading-sm" }) : "Submit for Pre-Approval" }), _jsx("button", { type: "button", onClick: () => navigate(-1), className: "btn btn-ghost", children: "Cancel" })] })] }) })] }));
}
