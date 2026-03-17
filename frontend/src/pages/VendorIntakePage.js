import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../workflow/api";
function getTodayISO() {
    return new Date().toISOString().split("T")[0];
}
function validate(values) {
    const errors = {};
    if (!values.legalName.trim())
        errors.legalName = "Legal Business Name is required.";
    if (!values.address.trim())
        errors.address = "Business Address is required.";
    if (!values.taxId.trim())
        errors.taxId = "Tax ID is required.";
    if (!values.taxClassification)
        errors.taxClassification = "Tax Classification is required.";
    if (!values.contactName.trim())
        errors.contactName = "Primary Contact Name is required.";
    if (!values.contactEmail.trim()) {
        errors.contactEmail = "Contact Email is required.";
    }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail)) {
        errors.contactEmail = "Please enter a valid email address.";
    }
    if (!values.contactPhone.trim())
        errors.contactPhone = "Contact Phone is required.";
    const hasBankingInfo = values.bankName.trim() ||
        values.accountType ||
        values.routingNumber.trim() ||
        values.accountNumber.trim();
    if (hasBankingInfo) {
        if (!values.bankName.trim())
            errors.bankName = "Bank Name is required when providing banking information.";
        if (!values.accountType)
            errors.accountType = "Account Type is required when providing banking information.";
        if (!values.routingNumber.trim()) {
            errors.routingNumber = "Routing Number is required when providing banking information.";
        }
        else if (!/^\d{9}$/.test(values.routingNumber.trim())) {
            errors.routingNumber = "Routing Number must be exactly 9 digits.";
        }
        if (!values.accountNumber.trim())
            errors.accountNumber = "Account Number is required when providing banking information.";
    }
    if (!values.signatureDate)
        errors.signatureDate = "Signature Date is required.";
    return errors;
}
export default function VendorIntakePage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token") ?? "";
    const [pageState, setPageState] = useState("loading");
    const [vendorRequest, setVendorRequest] = useState(null);
    const [serverError, setServerError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [values, setValues] = useState({
        legalName: "",
        dbaName: "",
        address: "",
        taxId: "",
        taxClassification: "",
        is1099: false,
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        bankName: "",
        accountType: "",
        routingNumber: "",
        accountNumber: "",
        signatureDate: getTodayISO(),
    });
    useEffect(() => {
        if (!token) {
            setPageState("invalid");
            return;
        }
        api
            .getVendorIntakeByToken({ token })
            .then((result) => {
            if (result?.error || !result?.vendorSetupRequest) {
                setPageState("invalid");
                return;
            }
            const req = result.vendorSetupRequest;
            setVendorRequest(req);
            if (req.status === "submitted" || req.status === "approved") {
                setPageState("already_submitted");
            }
            else {
                setPageState("form");
            }
        })
            .catch(() => {
            setPageState("invalid");
        });
    }, [token]);
    function handleChange(e) {
        const target = e.target;
        const { name, value, type } = target;
        const newValue = type === "checkbox" ? target.checked : value;
        setValues((prev) => ({ ...prev, [name]: newValue }));
        if (fieldErrors[name]) {
            setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setServerError(null);
        const errors = validate(values);
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            const firstErrorKey = Object.keys(errors)[0];
            const el = document.getElementById(`field-${firstErrorKey}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
        setSubmitting(true);
        try {
            await api.submitVendorIntake({ token, intakeData: { ...values } });
            setPageState("success");
        }
        catch (err) {
            const message = err?.message ?? "An unexpected error occurred. Please try again.";
            setServerError(message);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
        finally {
            setSubmitting(false);
        }
    }
    if (pageState === "loading") {
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-base-200", children: _jsx("span", { className: "loading loading-spinner loading-lg text-primary" }) }));
    }
    if (pageState === "invalid") {
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-base-200 px-4", children: _jsx("div", { className: "card bg-base-100 shadow-lg max-w-md w-full", children: _jsxs("div", { className: "card-body text-center gap-4", children: [_jsx("div", { className: "text-5xl", children: "\u26A0\uFE0F" }), _jsx("h2", { className: "card-title justify-center text-xl", children: "Link Invalid or Expired" }), _jsx("p", { className: "text-base-content/70", children: "This link is invalid or has expired. Please contact the person who submitted your vendor request." })] }) }) }));
    }
    if (pageState === "already_submitted") {
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-base-200 px-4", children: _jsx("div", { className: "card bg-base-100 shadow-lg max-w-md w-full", children: _jsxs("div", { className: "card-body text-center gap-4", children: [_jsx("div", { className: "text-5xl", children: "\u2705" }), _jsx("h2", { className: "card-title justify-center text-xl", children: "Already Submitted" }), _jsx("p", { className: "text-base-content/70", children: "Thank you! Your vendor information has been received." })] }) }) }));
    }
    if (pageState === "success") {
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen bg-base-200 px-4", children: _jsx("div", { className: "card bg-base-100 shadow-lg max-w-lg w-full", children: _jsxs("div", { className: "card-body text-center gap-4", children: [_jsx("div", { className: "text-5xl", children: "\u2705" }), _jsx("h2", { className: "card-title justify-center text-xl", children: "Submission Received" }), _jsx("p", { className: "text-base-content/70", children: "Thank you! Your vendor information has been submitted successfully. You will receive a confirmation email once your account has been set up." })] }) }) }));
    }
    return (_jsx("div", { className: "min-h-screen bg-base-200 py-10 px-4", children: _jsxs("div", { className: "max-w-3xl mx-auto", children: [_jsxs("div", { className: "mb-8 text-center", children: [_jsx("h1", { className: "text-3xl font-bold text-base-content", children: "Vendor Information Form" }), _jsx("p", { className: "mt-2 text-base-content/60", children: "Please complete the form below to set up your vendor account." }), vendorRequest?.vendorName && (_jsxs("p", { className: "mt-1 text-sm text-base-content/50", children: ["Setting up account for: ", _jsx("span", { className: "font-medium text-base-content/70", children: vendorRequest.vendorName })] }))] }), serverError && (_jsxs("div", { className: "alert alert-error mb-6", children: [_jsx("svg", { xmlns: "http://www.w3.org/2000/svg", className: "stroke-current shrink-0 h-6 w-6", fill: "none", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" }) }), _jsx("span", { children: serverError })] })), _jsxs("form", { onSubmit: handleSubmit, noValidate: true, children: [_jsx("div", { className: "card bg-base-100 shadow mb-6", children: _jsxs("div", { className: "card-body gap-5", children: [_jsx("h2", { className: "text-lg font-semibold border-b border-base-300 pb-2", children: "Business Information" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "form-control md:col-span-2", id: "field-legalName", children: [_jsx("label", { className: "label", htmlFor: "legalName", children: _jsxs("span", { className: "label-text font-medium", children: ["Legal Business Name ", _jsx("span", { className: "text-error", children: "*" })] }) }), _jsx("input", { id: "legalName", name: "legalName", type: "text", className: `input input-bordered w-full ${fieldErrors.legalName ? "input-error" : ""}`, value: values.legalName, onChange: handleChange, placeholder: "Acme Corporation" }), fieldErrors.legalName && (_jsx("label", { className: "label", children: _jsx("span", { className: "label-text-alt text-error", children: fieldErrors.legalName }) }))] }), _jsxs("div", { className: "form-control md:col-span-2", id: "field-dbaName", children: [_jsx("label", { className: "label", htmlFor: "dbaName", children: _jsxs("span", { className: "label-text font-medium", children: ["DBA / Trade Name ", _jsx("span", { className: "text-base-content/40 font-normal", children: "(optional)" })] }) }), _jsx("input", { id: "dbaName", name: "dbaName", type: "text", className: "input input-bordered w-full", value: values.dbaName, onChange: handleChange, placeholder: "Trading as..." })] }), _jsxs("div", { className: "form-control md:col-span-2", id: "field-address", children: [_jsx("label", { className: "label", htmlFor: "address", children: _jsxs("span", { className: "label-text font-medium", children: ["Business Address ", _jsx("span", { className: "text-error", children: "*" })] }) }), _jsx("textarea", { id: "address", name: "address", className: `textarea textarea-bordered w-full ${fieldErrors.address ? "textarea-error" : ""}`, value: values.address, onChange: handleChange, placeholder: "123 Main St\nCity, State 12345", rows: 3 }), fieldErrors.address && (_jsx("label", { className: "label", children: _jsx("span", { className: "label-text-alt text-error", children: fieldErrors.address }) }))] }), _jsxs("div", { className: "form-control", id: "field-taxId", children: [_jsx("label", { className: "label", htmlFor: "taxId", children: _jsxs("span", { className: "label-text font-medium", children: ["EIN or SSN (Tax ID) ", _jsx("span", { className: "text-error", children: "*" })] }) }), _jsx("input", { id: "taxId", name: "taxId", type: "text", className: `input input-bordered w-full ${fieldErrors.taxId ? "input-error" : ""}`, value: values.taxId, onChange: handleChange, placeholder: "XX-XXXXXXX" }), fieldErrors.taxId && (_jsx("label", { className: "label", children: _jsx("span", { className: "label-text-alt text-error", children: fieldErrors.taxId }) }))] }), _jsxs("div", { className: "form-control", id: "field-taxClassification", children: [_jsx("label", { className: "label", htmlFor: "taxClassification", children: _jsxs("span", { className: "label-text font-medium", children: ["Tax Classification ", _jsx("span", { className: "text-error", children: "*" })] }) }), _jsxs("select", { id: "taxClassification", name: "taxClassification", className: `select select-bordered w-full ${fieldErrors.taxClassification ? "select-error" : ""}`, value: values.taxClassification, onChange: handleChange, children: [_jsx("option", { value: "", children: "Select classification..." }), _jsx("option", { value: "Sole Proprietor", children: "Sole Proprietor" }), _jsx("option", { value: "Single-Member LLC", children: "Single-Member LLC" }), _jsx("option", { value: "Multi-Member LLC", children: "Multi-Member LLC" }), _jsx("option", { value: "C Corporation", children: "C Corporation" }), _jsx("option", { value: "S Corporation", children: "S Corporation" }), _jsx("option", { value: "Partnership", children: "Partnership" }), _jsx("option", { value: "Trust/Estate", children: "Trust/Estate" }), _jsx("option", { value: "Other", children: "Other" })] }), fieldErrors.taxClassification && (_jsx("label", { className: "label", children: _jsx("span", { className: "label-text-alt text-error", children: fieldErrors.taxClassification }) }))] }), _jsx("div", { className: "form-control md:col-span-2", id: "field-is1099", children: _jsxs("label", { className: "label cursor-pointer justify-start gap-3", children: [_jsx("input", { id: "is1099", name: "is1099", type: "checkbox", className: "checkbox checkbox-primary", checked: values.is1099, onChange: handleChange }), _jsx("span", { className: "label-text", children: "This vendor requires a 1099" })] }) })] })] }) }), _jsx("div", { className: "card bg-base-100 shadow mb-6", children: _jsxs("div", { className: "card-body gap-5", children: [_jsx("h2", { className: "text-lg font-semibold border-b border-base-300 pb-2", children: "Contact Information" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "form-control md:col-span-2", id: "field-contactName", children: [_jsx("label", { className: "label", htmlFor: "contactName", children: _jsxs("span", { className: "label-text font-medium", children: ["Primary Contact Name ", _jsx("span", { className: "text-error", children: "*" })] }) }), _jsx("input", { id: "contactName", name: "contactName", type: "text", className: `input input-bordered w-full ${fieldErrors.contactName ? "input-error" : ""}`, value: values.contactName, onChange: handleChange, placeholder: "Jane Smith" }), fieldErrors.contactName && (_jsx("label", { className: "label", children: _jsx("span", { className: "label-text-alt text-error", children: fieldErrors.contactName }) }))] }), _jsxs("div", { className: "form-control", id: "field-contactEmail", children: [_jsx("label", { className: "label", htmlFor: "contactEmail", children: _jsxs("span", { className: "label-text font-medium", children: ["Contact Email ", _jsx("span", { className: "text-error", children: "*" })] }) }), _jsx("input", { id: "contactEmail", name: "contactEmail", type: "email", className: `input input-bordered w-full ${fieldErrors.contactEmail ? "input-error" : ""}`, value: values.contactEmail, onChange: handleChange, placeholder: "jane@example.com" }), fieldErrors.contactEmail && (_jsx("label", { className: "label", children: _jsx("span", { className: "label-text-alt text-error", children: fieldErrors.contactEmail }) }))] }), _jsxs("div", { className: "form-control", id: "field-contactPhone", children: [_jsx("label", { className: "label", htmlFor: "contactPhone", children: _jsxs("span", { className: "label-text font-medium", children: ["Contact Phone ", _jsx("span", { className: "text-error", children: "*" })] }) }), _jsx("input", { id: "contactPhone", name: "contactPhone", type: "text", className: `input input-bordered w-full ${fieldErrors.contactPhone ? "input-error" : ""}`, value: values.contactPhone, onChange: handleChange, placeholder: "(555) 555-5555" }), fieldErrors.contactPhone && (_jsx("label", { className: "label", children: _jsx("span", { className: "label-text-alt text-error", children: fieldErrors.contactPhone }) }))] })] })] }) }), _jsx("div", { className: "card bg-base-100 shadow mb-6", children: _jsxs("div", { className: "card-body gap-5", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold border-b border-base-300 pb-2", children: "Banking / Payment Information" }), _jsx("p", { className: "text-sm text-base-content/50 mt-1", children: "Leave blank if you prefer to receive a check." })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "form-control", id: "field-bankName", children: [_jsx("label", { className: "label", htmlFor: "bankName", children: _jsx("span", { className: "label-text font-medium", children: "Bank Name" }) }), _jsx("input", { id: "bankName", name: "bankName", type: "text", className: `input input-bordered w-full ${fieldErrors.bankName ? "input-error" : ""}`, value: values.bankName, onChange: handleChange, placeholder: "First National Bank" }), fieldErrors.bankName && (_jsx("label", { className: "label", children: _jsx("span", { className: "label-text-alt text-error", children: fieldErrors.bankName }) }))] }), _jsxs("div", { className: "form-control", id: "field-accountType", children: [_jsx("label", { className: "label", htmlFor: "accountType", children: _jsx("span", { className: "label-text font-medium", children: "Account Type" }) }), _jsxs("select", { id: "accountType", name: "accountType", className: `select select-bordered w-full ${fieldErrors.accountType ? "select-error" : ""}`, value: values.accountType, onChange: handleChange, children: [_jsx("option", { value: "", children: "Select account type..." }), _jsx("option", { value: "Checking", children: "Checking" }), _jsx("option", { value: "Savings", children: "Savings" })] }), fieldErrors.accountType && (_jsx("label", { className: "label", children: _jsx("span", { className: "label-text-alt text-error", children: fieldErrors.accountType }) }))] }), _jsxs("div", { className: "form-control", id: "field-routingNumber", children: [_jsx("label", { className: "label", htmlFor: "routingNumber", children: _jsxs("span", { className: "label-text font-medium", children: ["Routing Number ", _jsx("span", { className: "text-base-content/40 font-normal", children: "(9 digits)" })] }) }), _jsx("input", { id: "routingNumber", name: "routingNumber", type: "text", className: `input input-bordered w-full ${fieldErrors.routingNumber ? "input-error" : ""}`, value: values.routingNumber, onChange: handleChange, placeholder: "123456789", maxLength: 9 }), fieldErrors.routingNumber && (_jsx("label", { className: "label", children: _jsx("span", { className: "label-text-alt text-error", children: fieldErrors.routingNumber }) }))] }), _jsxs("div", { className: "form-control", id: "field-accountNumber", children: [_jsx("label", { className: "label", htmlFor: "accountNumber", children: _jsx("span", { className: "label-text font-medium", children: "Account Number" }) }), _jsx("input", { id: "accountNumber", name: "accountNumber", type: "text", className: `input input-bordered w-full ${fieldErrors.accountNumber ? "input-error" : ""}`, value: values.accountNumber, onChange: handleChange, placeholder: "XXXXXXXXXXXX" }), fieldErrors.accountNumber && (_jsx("label", { className: "label", children: _jsx("span", { className: "label-text-alt text-error", children: fieldErrors.accountNumber }) }))] })] })] }) }), _jsx("div", { className: "card bg-base-100 shadow mb-8", children: _jsxs("div", { className: "card-body gap-5", children: [_jsx("h2", { className: "text-lg font-semibold border-b border-base-300 pb-2", children: "Signature" }), _jsxs("div", { className: "form-control max-w-xs", id: "field-signatureDate", children: [_jsx("label", { className: "label", htmlFor: "signatureDate", children: _jsxs("span", { className: "label-text font-medium", children: ["Date ", _jsx("span", { className: "text-error", children: "*" })] }) }), _jsx("input", { id: "signatureDate", name: "signatureDate", type: "date", className: `input input-bordered w-full ${fieldErrors.signatureDate ? "input-error" : ""}`, value: values.signatureDate, onChange: handleChange }), fieldErrors.signatureDate && (_jsx("label", { className: "label", children: _jsx("span", { className: "label-text-alt text-error", children: fieldErrors.signatureDate }) }))] }), _jsx("p", { className: "text-sm text-base-content/60 border border-base-300 rounded-lg p-4 bg-base-200", children: "By submitting this form, I certify that the information provided is accurate and complete." }), _jsx("button", { type: "submit", className: "btn btn-primary w-full", disabled: submitting, children: submitting ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "loading loading-spinner loading-sm" }), "Submitting..."] })) : ("Submit Vendor Information") })] }) })] })] }) }));
}
