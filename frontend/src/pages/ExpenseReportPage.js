import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useUserContext } from "../contexts/UserContext";
import { api } from "../workflow/api";
import { storage } from "../firebase";
import { CATEGORIES } from "../workflow/constants";
const fmtCurrency = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
function newLineItem() {
    return {
        localId: Math.random().toString(36).slice(2),
        description: "",
        amount: 0,
        category: "",
        vendorName: "",
        receiptDate: "",
        notes: "",
    };
}
export default function ExpenseReportPage() {
    const { id: requestId } = useParams();
    const navigate = useNavigate();
    const { profile, activeOrgId } = useUserContext();
    const [request, setRequest] = useState(null);
    const [lineItems, setLineItems] = useState([newLineItem()]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const load = useCallback(async () => {
        if (!requestId || !profile || !activeOrgId)
            return;
        setLoading(true);
        try {
            const result = await api.getRequestDetail({ requestId, orgId: activeOrgId });
            const req = result.request || result;
            setRequest(req);
            // Pre-populate line items if existing
            const existingItems = result.lineItems || [];
            if (existingItems.length > 0) {
                setLineItems(existingItems.map((li) => ({
                    localId: li.id || Math.random().toString(36).slice(2),
                    id: li.id,
                    description: li.description || "",
                    amount: li.amount || 0,
                    category: li.category || "",
                    vendorName: li.vendorName || "",
                    receiptDate: li.receiptDate || "",
                    notes: li.notes || "",
                    fileUrl: li.fileUrl,
                    fileName: li.fileName,
                })));
            }
        }
        catch (err) {
            setError("Failed to load request.");
        }
        finally {
            setLoading(false);
        }
    }, [requestId, profile, activeOrgId]);
    useEffect(() => { load(); }, [load]);
    const totalActual = lineItems.reduce((s, li) => s + (parseFloat(String(li.amount)) || 0), 0);
    const approvedAmount = request?.approvedAmount || 0;
    const hasOverage = approvedAmount > 0 && totalActual > approvedAmount;
    const updateLineItem = (localId, updates) => {
        setLineItems(prev => prev.map(li => li.localId === localId ? { ...li, ...updates } : li));
    };
    const removeLineItem = (localId) => {
        setLineItems(prev => prev.filter(li => li.localId !== localId));
    };
    const addLineItem = () => {
        setLineItems(prev => [...prev, newLineItem()]);
    };
    const handleFileUpload = async (localId, file) => {
        if (!requestId || !activeOrgId)
            return;
        updateLineItem(localId, { fileUploading: true });
        try {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileRef = ref(storage, `receipts/${activeOrgId}/${requestId}/${Date.now()}_${safeName}`);
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);
            updateLineItem(localId, {
                fileUploading: false,
                fileUrl: url,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
            });
        }
        catch (err) {
            updateLineItem(localId, { fileUploading: false });
            setError("File upload failed: " + (err instanceof Error ? err.message : "Unknown error"));
        }
    };
    const buildSavePayload = () => ({
        requestId,
        orgId: activeOrgId,
        lineItems: lineItems.map(li => ({
            ...(li.id ? { id: li.id } : {}),
            description: li.description,
            amount: parseFloat(String(li.amount)) || 0,
            category: li.category,
            vendorName: li.vendorName,
            receiptDate: li.receiptDate,
            notes: li.notes,
            ...(li.fileUrl ? {
                fileUrl: li.fileUrl,
                fileName: li.fileName,
                fileSize: li.fileSize,
                mimeType: li.mimeType,
            } : {}),
        })),
        actualAmount: totalActual,
    });
    const handleSave = async (e) => {
        e.preventDefault();
        if (lineItems.some(li => li.fileUploading)) {
            setError("Please wait for file uploads to finish.");
            return;
        }
        setBusy(true);
        setError("");
        setSuccess("");
        try {
            await api.saveExpenseReport(buildSavePayload());
            setSuccess("Expense report saved as draft.");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleSubmit = async () => {
        if (lineItems.length === 0) {
            setError("At least one line item is required.");
            return;
        }
        if (lineItems.some(li => !li.description || !li.amount)) {
            setError("All line items must have description and amount.");
            return;
        }
        if (lineItems.some(li => li.fileUploading)) {
            setError("Please wait for file uploads to finish.");
            return;
        }
        setBusy(true);
        setError("");
        setSuccess("");
        try {
            // Save first, then submit
            await api.saveExpenseReport(buildSavePayload());
            await api.submitExpenseReport({ requestId, orgId: activeOrgId });
            setSuccess("Expense report submitted for review!");
            setTimeout(() => navigate(`/requests/${requestId}`), 1500);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit.");
        }
        finally {
            setBusy(false);
        }
    };
    if (loading) {
        return (_jsxs("div", { className: "p-6", children: [_jsx("div", { className: "skeleton h-8 w-64 mb-4" }), _jsx("div", { className: "skeleton h-64 w-full rounded-box" })] }));
    }
    if (!request) {
        return (_jsx("div", { className: "p-6", children: _jsx("div", { className: "alert alert-error", children: "Request not found." }) }));
    }
    return (_jsxs("div", { className: "p-6 max-w-3xl mx-auto", children: [_jsx("button", { onClick: () => navigate(`/requests/${requestId}`), className: "btn btn-ghost btn-sm mb-4", children: "\u2190 Back to Request" }), _jsx("h1", { className: "text-2xl font-bold mb-1", children: "Expense Report" }), _jsxs("p", { className: "text-sm text-base-content/60 mb-4", children: ["Request ID: ", _jsx("span", { className: "font-mono", children: requestId })] }), _jsx("div", { className: "card bg-base-100 shadow mb-4", children: _jsx("div", { className: "card-body py-4", children: _jsxs("div", { className: "flex flex-wrap gap-6 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-base-content/50 uppercase text-xs font-semibold block", children: "Purpose" }), _jsx("span", { children: request.purpose })] }), _jsxs("div", { children: [_jsx("span", { className: "text-base-content/50 uppercase text-xs font-semibold block", children: "Vendor" }), _jsx("span", { children: request.vendorName || request.vendorId || "—" })] }), _jsxs("div", { children: [_jsx("span", { className: "text-base-content/50 uppercase text-xs font-semibold block", children: "Approved Amount" }), _jsx("span", { className: "font-semibold", children: fmtCurrency(request.approvedAmount) })] }), _jsxs("div", { children: [_jsx("span", { className: "text-base-content/50 uppercase text-xs font-semibold block", children: "Running Total" }), _jsx("span", { className: `font-semibold ${hasOverage ? "text-error" : "text-success"}`, children: fmtCurrency(totalActual) })] })] }) }) }), hasOverage && (_jsxs("div", { className: "alert alert-warning mb-4", children: [_jsx("svg", { xmlns: "http://www.w3.org/2000/svg", className: "stroke-current shrink-0 h-5 w-5", fill: "none", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }), _jsxs("span", { children: [_jsx("strong", { children: "Overage:" }), " Actual total (", fmtCurrency(totalActual), ") exceeds approved amount (", fmtCurrency(approvedAmount), "). This will require additional approval."] })] })), error && _jsx("div", { className: "alert alert-error mb-4", children: _jsx("span", { children: error }) }), success && _jsx("div", { className: "alert alert-success mb-4", children: _jsx("span", { children: success }) }), _jsx("div", { className: "card bg-base-100 shadow mb-4", children: _jsxs("div", { className: "card-body", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "card-title text-base", children: "Line Items" }), _jsx("button", { type: "button", onClick: addLineItem, className: "btn btn-outline btn-sm", children: "+ Add Line Item" })] }), lineItems.length === 0 && (_jsx("div", { className: "text-center py-8 text-base-content/50 text-sm", children: "No line items. Click \"Add Line Item\" to start." })), _jsx("div", { className: "space-y-6", children: lineItems.map((li, idx) => (_jsxs("div", { className: "border border-base-300 rounded-box p-4 relative", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("span", { className: "font-semibold text-sm", children: ["Item ", idx + 1] }), lineItems.length > 1 && (_jsx("button", { type: "button", onClick: () => removeLineItem(li.localId), className: "btn btn-ghost btn-xs text-error", children: "Remove" }))] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [_jsxs("div", { className: "form-control md:col-span-2", children: [_jsx("label", { className: "label py-1", children: _jsx("span", { className: "label-text text-xs font-semibold", children: "Description *" }) }), _jsx("input", { className: "input input-bordered input-sm", value: li.description, onChange: e => updateLineItem(li.localId, { description: e.target.value }), placeholder: "What was purchased?", required: true })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label py-1", children: _jsx("span", { className: "label-text text-xs font-semibold", children: "Amount ($) *" }) }), _jsx("input", { type: "number", step: "0.01", min: "0.01", className: "input input-bordered input-sm", value: li.amount || "", onChange: e => updateLineItem(li.localId, { amount: parseFloat(e.target.value) || 0 }), placeholder: "0.00", required: true })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label py-1", children: _jsx("span", { className: "label-text text-xs font-semibold", children: "Receipt Date *" }) }), _jsx("input", { type: "date", className: "input input-bordered input-sm", value: li.receiptDate, onChange: e => updateLineItem(li.localId, { receiptDate: e.target.value }), required: true })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label py-1", children: _jsx("span", { className: "label-text text-xs font-semibold", children: "Category" }) }), _jsxs("select", { className: "select select-bordered select-sm", value: li.category, onChange: e => updateLineItem(li.localId, { category: e.target.value }), children: [_jsx("option", { value: "", children: "Select category\u2026" }), CATEGORIES.map(c => _jsx("option", { value: c, children: c }, c))] })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label py-1", children: _jsx("span", { className: "label-text text-xs font-semibold", children: "Vendor Name" }) }), _jsx("input", { className: "input input-bordered input-sm", value: li.vendorName, onChange: e => updateLineItem(li.localId, { vendorName: e.target.value }), placeholder: "Vendor for this item" })] }), _jsxs("div", { className: "form-control md:col-span-2", children: [_jsx("label", { className: "label py-1", children: _jsx("span", { className: "label-text text-xs font-semibold", children: "Notes" }) }), _jsx("input", { className: "input input-bordered input-sm", value: li.notes, onChange: e => updateLineItem(li.localId, { notes: e.target.value }), placeholder: "Additional notes (optional)" })] }), _jsxs("div", { className: "form-control md:col-span-2", children: [_jsx("label", { className: "label py-1", children: _jsx("span", { className: "label-text text-xs font-semibold", children: "Receipt File" }) }), li.fileUrl ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("a", { href: li.fileUrl, target: "_blank", rel: "noreferrer", className: "link link-primary text-sm", children: li.fileName || "View File" }), _jsx("button", { type: "button", onClick: () => updateLineItem(li.localId, { fileUrl: undefined, fileName: undefined }), className: "btn btn-ghost btn-xs text-error", children: "Remove" })] })) : li.fileUploading ? (_jsxs("div", { className: "flex items-center gap-2 text-sm text-base-content/60", children: [_jsx("span", { className: "loading loading-spinner loading-sm" }), "Uploading\u2026"] })) : (_jsx("input", { type: "file", accept: "image/*,.pdf", className: "file-input file-input-bordered file-input-sm", onChange: e => {
                                                            const file = e.target.files?.[0];
                                                            if (file)
                                                                handleFileUpload(li.localId, file);
                                                        } }))] })] })] }, li.localId))) }), lineItems.length > 0 && (_jsx("div", { className: "mt-4 flex justify-end", children: _jsxs("div", { className: "text-right", children: [_jsx("span", { className: "text-sm text-base-content/60 mr-4", children: "Total Actual:" }), _jsx("span", { className: `text-lg font-bold ${hasOverage ? "text-error" : ""}`, children: fmtCurrency(totalActual) }), approvedAmount > 0 && (_jsxs("div", { className: "text-xs text-base-content/50 mt-1", children: ["Approved: ", fmtCurrency(approvedAmount)] }))] }) }))] }) }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx("button", { type: "button", onClick: handleSave, disabled: busy, className: "btn btn-outline", children: busy ? _jsx("span", { className: "loading loading-spinner loading-sm" }) : "Save Draft" }), _jsx("button", { type: "button", onClick: handleSubmit, disabled: busy || lineItems.length === 0, className: "btn btn-primary", children: busy ? _jsx("span", { className: "loading loading-spinner loading-sm" }) : "Submit Expense Report" }), _jsx("button", { type: "button", onClick: () => navigate(`/requests/${requestId}`), className: "btn btn-ghost", children: "Cancel" })] })] }));
}
