import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../workflow/api";

type TaxClassification =
  | "Sole Proprietor"
  | "Single-Member LLC"
  | "Multi-Member LLC"
  | "C Corporation"
  | "S Corporation"
  | "Partnership"
  | "Trust/Estate"
  | "Other";

type AccountType = "Checking" | "Savings";

interface IntakeFormValues {
  legalName: string;
  dbaName: string;
  address: string;
  taxId: string;
  taxClassification: TaxClassification | "";
  is1099: boolean;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  bankName: string;
  accountType: AccountType | "";
  routingNumber: string;
  accountNumber: string;
  signatureDate: string;
}

type FieldErrors = Partial<Record<keyof IntakeFormValues, string>>;

interface VendorSetupRequest {
  vendorName: string;
  orgId: string;
  status: string;
}

function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function validate(values: IntakeFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.legalName.trim()) errors.legalName = "Legal Business Name is required.";
  if (!values.address.trim()) errors.address = "Business Address is required.";
  if (!values.taxId.trim()) errors.taxId = "Tax ID is required.";
  if (!values.taxClassification) errors.taxClassification = "Tax Classification is required.";
  if (!values.contactName.trim()) errors.contactName = "Primary Contact Name is required.";
  if (!values.contactEmail.trim()) {
    errors.contactEmail = "Contact Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail)) {
    errors.contactEmail = "Please enter a valid email address.";
  }
  if (!values.contactPhone.trim()) errors.contactPhone = "Contact Phone is required.";

  const hasBankingInfo =
    values.bankName.trim() ||
    values.accountType ||
    values.routingNumber.trim() ||
    values.accountNumber.trim();

  if (hasBankingInfo) {
    if (!values.bankName.trim()) errors.bankName = "Bank Name is required when providing banking information.";
    if (!values.accountType) errors.accountType = "Account Type is required when providing banking information.";
    if (!values.routingNumber.trim()) {
      errors.routingNumber = "Routing Number is required when providing banking information.";
    } else if (!/^\d{9}$/.test(values.routingNumber.trim())) {
      errors.routingNumber = "Routing Number must be exactly 9 digits.";
    }
    if (!values.accountNumber.trim()) errors.accountNumber = "Account Number is required when providing banking information.";
  }

  if (!values.signatureDate) errors.signatureDate = "Signature Date is required.";

  return errors;
}

export default function VendorIntakePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [pageState, setPageState] = useState<"loading" | "invalid" | "already_submitted" | "form" | "success">("loading");
  const [vendorRequest, setVendorRequest] = useState<VendorSetupRequest | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const [values, setValues] = useState<IntakeFormValues>({
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
      .then((result: any) => {
        if (result?.error || !result?.vendorSetupRequest) {
          setPageState("invalid");
          return;
        }
        const req = result.vendorSetupRequest as VendorSetupRequest;
        setVendorRequest(req);
        if (req.status === "submitted" || req.status === "approved") {
          setPageState("already_submitted");
        } else {
          setPageState("form");
        }
      })
      .catch(() => {
        setPageState("invalid");
      });
  }, [token]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    const newValue = type === "checkbox" ? target.checked : value;
    setValues((prev) => ({ ...prev, [name]: newValue }));
    if (fieldErrors[name as keyof IntakeFormValues]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
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
    } catch (err: any) {
      const message =
        err?.message ?? "An unexpected error occurred. Please try again.";
      setServerError(message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  if (pageState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (pageState === "invalid") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200 px-4">
        <div className="card bg-base-100 shadow-lg max-w-md w-full">
          <div className="card-body text-center gap-4">
            <div className="text-5xl">⚠️</div>
            <h2 className="card-title justify-center text-xl">Link Invalid or Expired</h2>
            <p className="text-base-content/70">
              This link is invalid or has expired. Please contact the person who submitted your vendor request.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === "already_submitted") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200 px-4">
        <div className="card bg-base-100 shadow-lg max-w-md w-full">
          <div className="card-body text-center gap-4">
            <div className="text-5xl">✅</div>
            <h2 className="card-title justify-center text-xl">Already Submitted</h2>
            <p className="text-base-content/70">
              Thank you! Your vendor information has been received.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200 px-4">
        <div className="card bg-base-100 shadow-lg max-w-lg w-full">
          <div className="card-body text-center gap-4">
            <div className="text-5xl">✅</div>
            <h2 className="card-title justify-center text-xl">Submission Received</h2>
            <p className="text-base-content/70">
              Thank you! Your vendor information has been submitted successfully. You will receive a confirmation email once your account has been set up.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-base-content">Vendor Information Form</h1>
          <p className="mt-2 text-base-content/60">
            Please complete the form below to set up your vendor account.
          </p>
          {vendorRequest?.vendorName && (
            <p className="mt-1 text-sm text-base-content/50">
              Setting up account for: <span className="font-medium text-base-content/70">{vendorRequest.vendorName}</span>
            </p>
          )}
        </div>

        {/* Server error alert */}
        {serverError && (
          <div className="alert alert-error mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* ── Section: Business Information ── */}
          <div className="card bg-base-100 shadow mb-6">
            <div className="card-body gap-5">
              <h2 className="text-lg font-semibold border-b border-base-300 pb-2">Business Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Legal Name */}
                <div className="form-control md:col-span-2" id="field-legalName">
                  <label className="label" htmlFor="legalName">
                    <span className="label-text font-medium">Legal Business Name <span className="text-error">*</span></span>
                  </label>
                  <input
                    id="legalName"
                    name="legalName"
                    type="text"
                    className={`input input-bordered w-full ${fieldErrors.legalName ? "input-error" : ""}`}
                    value={values.legalName}
                    onChange={handleChange}
                    placeholder="Acme Corporation"
                  />
                  {fieldErrors.legalName && (
                    <label className="label">
                      <span className="label-text-alt text-error">{fieldErrors.legalName}</span>
                    </label>
                  )}
                </div>

                {/* DBA Name */}
                <div className="form-control md:col-span-2" id="field-dbaName">
                  <label className="label" htmlFor="dbaName">
                    <span className="label-text font-medium">DBA / Trade Name <span className="text-base-content/40 font-normal">(optional)</span></span>
                  </label>
                  <input
                    id="dbaName"
                    name="dbaName"
                    type="text"
                    className="input input-bordered w-full"
                    value={values.dbaName}
                    onChange={handleChange}
                    placeholder="Trading as..."
                  />
                </div>

                {/* Address */}
                <div className="form-control md:col-span-2" id="field-address">
                  <label className="label" htmlFor="address">
                    <span className="label-text font-medium">Business Address <span className="text-error">*</span></span>
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    className={`textarea textarea-bordered w-full ${fieldErrors.address ? "textarea-error" : ""}`}
                    value={values.address}
                    onChange={handleChange}
                    placeholder={"123 Main St\nCity, State 12345"}
                    rows={3}
                  />
                  {fieldErrors.address && (
                    <label className="label">
                      <span className="label-text-alt text-error">{fieldErrors.address}</span>
                    </label>
                  )}
                </div>

                {/* Tax ID */}
                <div className="form-control" id="field-taxId">
                  <label className="label" htmlFor="taxId">
                    <span className="label-text font-medium">EIN or SSN (Tax ID) <span className="text-error">*</span></span>
                  </label>
                  <input
                    id="taxId"
                    name="taxId"
                    type="text"
                    className={`input input-bordered w-full ${fieldErrors.taxId ? "input-error" : ""}`}
                    value={values.taxId}
                    onChange={handleChange}
                    placeholder="XX-XXXXXXX"
                  />
                  {fieldErrors.taxId && (
                    <label className="label">
                      <span className="label-text-alt text-error">{fieldErrors.taxId}</span>
                    </label>
                  )}
                </div>

                {/* Tax Classification */}
                <div className="form-control" id="field-taxClassification">
                  <label className="label" htmlFor="taxClassification">
                    <span className="label-text font-medium">Tax Classification <span className="text-error">*</span></span>
                  </label>
                  <select
                    id="taxClassification"
                    name="taxClassification"
                    className={`select select-bordered w-full ${fieldErrors.taxClassification ? "select-error" : ""}`}
                    value={values.taxClassification}
                    onChange={handleChange}
                  >
                    <option value="">Select classification...</option>
                    <option value="Sole Proprietor">Sole Proprietor</option>
                    <option value="Single-Member LLC">Single-Member LLC</option>
                    <option value="Multi-Member LLC">Multi-Member LLC</option>
                    <option value="C Corporation">C Corporation</option>
                    <option value="S Corporation">S Corporation</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Trust/Estate">Trust/Estate</option>
                    <option value="Other">Other</option>
                  </select>
                  {fieldErrors.taxClassification && (
                    <label className="label">
                      <span className="label-text-alt text-error">{fieldErrors.taxClassification}</span>
                    </label>
                  )}
                </div>

                {/* 1099 checkbox */}
                <div className="form-control md:col-span-2" id="field-is1099">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      id="is1099"
                      name="is1099"
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={values.is1099}
                      onChange={handleChange}
                    />
                    <span className="label-text">This vendor requires a 1099</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section: Contact Information ── */}
          <div className="card bg-base-100 shadow mb-6">
            <div className="card-body gap-5">
              <h2 className="text-lg font-semibold border-b border-base-300 pb-2">Contact Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contact Name */}
                <div className="form-control md:col-span-2" id="field-contactName">
                  <label className="label" htmlFor="contactName">
                    <span className="label-text font-medium">Primary Contact Name <span className="text-error">*</span></span>
                  </label>
                  <input
                    id="contactName"
                    name="contactName"
                    type="text"
                    className={`input input-bordered w-full ${fieldErrors.contactName ? "input-error" : ""}`}
                    value={values.contactName}
                    onChange={handleChange}
                    placeholder="Jane Smith"
                  />
                  {fieldErrors.contactName && (
                    <label className="label">
                      <span className="label-text-alt text-error">{fieldErrors.contactName}</span>
                    </label>
                  )}
                </div>

                {/* Contact Email */}
                <div className="form-control" id="field-contactEmail">
                  <label className="label" htmlFor="contactEmail">
                    <span className="label-text font-medium">Contact Email <span className="text-error">*</span></span>
                  </label>
                  <input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    className={`input input-bordered w-full ${fieldErrors.contactEmail ? "input-error" : ""}`}
                    value={values.contactEmail}
                    onChange={handleChange}
                    placeholder="jane@example.com"
                  />
                  {fieldErrors.contactEmail && (
                    <label className="label">
                      <span className="label-text-alt text-error">{fieldErrors.contactEmail}</span>
                    </label>
                  )}
                </div>

                {/* Contact Phone */}
                <div className="form-control" id="field-contactPhone">
                  <label className="label" htmlFor="contactPhone">
                    <span className="label-text font-medium">Contact Phone <span className="text-error">*</span></span>
                  </label>
                  <input
                    id="contactPhone"
                    name="contactPhone"
                    type="text"
                    className={`input input-bordered w-full ${fieldErrors.contactPhone ? "input-error" : ""}`}
                    value={values.contactPhone}
                    onChange={handleChange}
                    placeholder="(555) 555-5555"
                  />
                  {fieldErrors.contactPhone && (
                    <label className="label">
                      <span className="label-text-alt text-error">{fieldErrors.contactPhone}</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section: Banking / Payment Information ── */}
          <div className="card bg-base-100 shadow mb-6">
            <div className="card-body gap-5">
              <div>
                <h2 className="text-lg font-semibold border-b border-base-300 pb-2">Banking / Payment Information</h2>
                <p className="text-sm text-base-content/50 mt-1">Leave blank if you prefer to receive a check.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bank Name */}
                <div className="form-control" id="field-bankName">
                  <label className="label" htmlFor="bankName">
                    <span className="label-text font-medium">Bank Name</span>
                  </label>
                  <input
                    id="bankName"
                    name="bankName"
                    type="text"
                    className={`input input-bordered w-full ${fieldErrors.bankName ? "input-error" : ""}`}
                    value={values.bankName}
                    onChange={handleChange}
                    placeholder="First National Bank"
                  />
                  {fieldErrors.bankName && (
                    <label className="label">
                      <span className="label-text-alt text-error">{fieldErrors.bankName}</span>
                    </label>
                  )}
                </div>

                {/* Account Type */}
                <div className="form-control" id="field-accountType">
                  <label className="label" htmlFor="accountType">
                    <span className="label-text font-medium">Account Type</span>
                  </label>
                  <select
                    id="accountType"
                    name="accountType"
                    className={`select select-bordered w-full ${fieldErrors.accountType ? "select-error" : ""}`}
                    value={values.accountType}
                    onChange={handleChange}
                  >
                    <option value="">Select account type...</option>
                    <option value="Checking">Checking</option>
                    <option value="Savings">Savings</option>
                  </select>
                  {fieldErrors.accountType && (
                    <label className="label">
                      <span className="label-text-alt text-error">{fieldErrors.accountType}</span>
                    </label>
                  )}
                </div>

                {/* Routing Number */}
                <div className="form-control" id="field-routingNumber">
                  <label className="label" htmlFor="routingNumber">
                    <span className="label-text font-medium">Routing Number <span className="text-base-content/40 font-normal">(9 digits)</span></span>
                  </label>
                  <input
                    id="routingNumber"
                    name="routingNumber"
                    type="text"
                    className={`input input-bordered w-full ${fieldErrors.routingNumber ? "input-error" : ""}`}
                    value={values.routingNumber}
                    onChange={handleChange}
                    placeholder="123456789"
                    maxLength={9}
                  />
                  {fieldErrors.routingNumber && (
                    <label className="label">
                      <span className="label-text-alt text-error">{fieldErrors.routingNumber}</span>
                    </label>
                  )}
                </div>

                {/* Account Number */}
                <div className="form-control" id="field-accountNumber">
                  <label className="label" htmlFor="accountNumber">
                    <span className="label-text font-medium">Account Number</span>
                  </label>
                  <input
                    id="accountNumber"
                    name="accountNumber"
                    type="text"
                    className={`input input-bordered w-full ${fieldErrors.accountNumber ? "input-error" : ""}`}
                    value={values.accountNumber}
                    onChange={handleChange}
                    placeholder="XXXXXXXXXXXX"
                  />
                  {fieldErrors.accountNumber && (
                    <label className="label">
                      <span className="label-text-alt text-error">{fieldErrors.accountNumber}</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section: Signature ── */}
          <div className="card bg-base-100 shadow mb-8">
            <div className="card-body gap-5">
              <h2 className="text-lg font-semibold border-b border-base-300 pb-2">Signature</h2>

              <div className="form-control max-w-xs" id="field-signatureDate">
                <label className="label" htmlFor="signatureDate">
                  <span className="label-text font-medium">Date <span className="text-error">*</span></span>
                </label>
                <input
                  id="signatureDate"
                  name="signatureDate"
                  type="date"
                  className={`input input-bordered w-full ${fieldErrors.signatureDate ? "input-error" : ""}`}
                  value={values.signatureDate}
                  onChange={handleChange}
                />
                {fieldErrors.signatureDate && (
                  <label className="label">
                    <span className="label-text-alt text-error">{fieldErrors.signatureDate}</span>
                  </label>
                )}
              </div>

              <p className="text-sm text-base-content/60 border border-base-300 rounded-lg p-4 bg-base-200">
                By submitting this form, I certify that the information provided is accurate and complete.
              </p>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    Submitting...
                  </>
                ) : (
                  "Submit Vendor Information"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
