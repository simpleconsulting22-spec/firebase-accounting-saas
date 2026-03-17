import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUserContext } from "../contexts/UserContext";
import { api } from "../workflow/api";
import { FUNDS, PAYMENT_METHODS, ORG_NAMES } from "../workflow/constants";
import { AdminDept, Category, Vendor } from "../workflow/types";

// ─── Vendor Setup Request Modal ───────────────────────────────────────────────

interface VendorSetupModalProps {
  orgId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

function VendorSetupModal({ orgId, onClose, onSuccess }: VendorSetupModalProps) {
  const [vendorName, setVendorName] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) { setError("Vendor name is required."); return; }
    if (!vendorEmail.trim()) { setError("Vendor email is required."); return; }
    setBusy(true);
    setError("");
    try {
      await api.submitVendorSetupRequest({ orgId, vendorName, vendorEmail, contactName, notes });
      onSuccess(`Vendor setup request submitted for "${vendorName}". An admin will review it.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit vendor request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg mb-4">Request New Vendor</h3>
        {error && <div className="alert alert-error mb-3"><span>{error}</span></div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Vendor Name *</span></label>
            <input
              className="input input-bordered"
              value={vendorName}
              onChange={e => setVendorName(e.target.value)}
              placeholder="e.g. Office Depot"
              required
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Vendor Email *</span></label>
            <input
              type="email"
              className="input input-bordered"
              value={vendorEmail}
              onChange={e => setVendorEmail(e.target.value)}
              placeholder="vendor@example.com"
              required
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Contact Name</span></label>
            <input
              className="input input-bordered"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Primary contact at vendor"
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Description</span></label>
            <textarea
              className="textarea textarea-bordered"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Why is this vendor needed?"
              rows={3}
            />
          </div>
          <div className="modal-action">
            <button type="button" onClick={onClose} className="btn btn-ghost" disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <span className="loading loading-spinner loading-sm" /> : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}

// ─── Create Request Page ──────────────────────────────────────────────────────

export default function CreateRequestPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const { profile, activeOrgId } = useUserContext();

  const [departments, setDepartments] = useState<AdminDept[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
    if (!activeOrgId) return;
    setLoadingData(true);
    try {
      const [depts, vends, cats] = await Promise.all([
        api.adminListDepartments({ orgId: activeOrgId }),
        api.getActiveVendors({ orgId: activeOrgId }),
        api.adminListCategories({ orgId: activeOrgId }),
      ]);
      setDepartments((depts as any)?.departments || []);
      setVendors((vends as any)?.vendors || []);
      setCategories((cats as any)?.categories || []);

      if (isEdit && editId) {
        const result: any = await api.getRequestDetail({ requestId: editId, orgId: activeOrgId });
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  }, [activeOrgId, isEdit, editId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setOrgId(activeOrgId); }, [activeOrgId]);

  const handleDeptChange = async (deptName: string) => {
    setMinistryDepartment(deptName);
    setApproverId("");
    setApproverEmail("");
    setApproverName("");
    if (!deptName || !activeOrgId) return;
    // Auto-fill approver from local departments list first for speed
    const dept = departments.find(d => d.ministryDepartment === deptName);
    if (dept) {
      setApproverId(dept.approverId || "");
      setApproverEmail(dept.approverEmail || "");
      setApproverName(dept.approverName || "");
      return;
    }
    try {
      const result: any = await api.getApproverMapping({ orgId: activeOrgId, departmentName: deptName });
      if (result) {
        setApproverId(result.approverId || "");
        setApproverEmail(result.approverEmail || "");
        setApproverName(result.approverName || "");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVendorChange = (value: string) => {
    if (value === "__new__") {
      setShowVendorModal(true);
    } else {
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

  const handleSaveDraft = async (e: FormEvent) => {
    e.preventDefault();
    if (!purpose.trim()) { setError("Purpose is required."); return; }
    if (!estimatedAmount || parseFloat(estimatedAmount) <= 0) { setError("Valid estimated amount is required."); return; }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result: any = await api.savePurchaseRequestDraft(buildPayload());
      const newId = result?.requestId || result?.id;
      setSuccess(`Draft saved. Request ID: ${newId}`);
      if (!isEdit && newId) navigate(`/requests/${newId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ministryDepartment) { setError("Ministry department is required."); return; }
    if (!vendorId) { setError("Vendor is required."); return; }
    if (!categoryId) { setError("Category is required."); return; }
    if (!estimatedAmount || parseFloat(estimatedAmount) <= 0) { setError("Valid estimated amount is required."); return; }
    if (!paymentMethod) { setError("Payment method is required."); return; }
    if (!requestedExpenseDate) { setError("Expense date is required."); return; }
    if (!purpose.trim()) { setError("Purpose is required."); return; }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result: any = await api.submitPreApproval(buildPayload());
      const newId = result?.requestId || result?.id || editId;
      setSuccess(`Request submitted for pre-approval! ID: ${newId}`);
      if (newId) navigate(`/requests/${newId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setBusy(false);
    }
  };

  if (loadingData) {
    return (
      <div className="p-6">
        <div className="skeleton h-8 w-64 mb-4" />
        <div className="skeleton h-96 w-full rounded-box" />
      </div>
    );
  }

  const orgOptions = profile?.orgIds || [activeOrgId];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {showVendorModal && (
        <VendorSetupModal
          orgId={orgId}
          onClose={() => setShowVendorModal(false)}
          onSuccess={(msg) => setSuccess(msg)}
        />
      )}

      <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm mb-4">
        ← Back
      </button>
      <h1 className="text-2xl font-bold mb-1">{isEdit ? "Edit Request" : "New Purchase Request"}</h1>
      <p className="text-sm text-base-content/60 mb-6">{ORG_NAMES[activeOrgId] || activeOrgId}</p>

      {success && <div className="alert alert-success mb-4"><span>{success}</span></div>}
      {error && <div className="alert alert-error mb-4"><span>{error}</span></div>}

      <form className="card bg-base-100 shadow">
        <div className="card-body space-y-4">

          {/* Org selector (multi-org users) */}
          {orgOptions.length > 1 && (
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Organization *</span></label>
              <select
                className="select select-bordered"
                value={orgId}
                onChange={e => setOrgId(e.target.value)}
              >
                {orgOptions.map(id => (
                  <option key={id} value={id}>{ORG_NAMES[id] || id}</option>
                ))}
              </select>
            </div>
          )}

          {/* Ministry Department */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Ministry / Department *</span></label>
            {departments.length > 0 ? (
              <select
                className="select select-bordered"
                value={ministryDepartment}
                onChange={e => handleDeptChange(e.target.value)}
                required
              >
                <option value="">Select department…</option>
                {departments.map((d, i) => (
                  <option key={d.id || i} value={d.ministryDepartment}>{d.ministryDepartment}</option>
                ))}
              </select>
            ) : (
              <input
                className="input input-bordered"
                value={ministryDepartment}
                onChange={e => setMinistryDepartment(e.target.value)}
                placeholder="e.g. Youth Ministry"
                required
              />
            )}
          </div>

          {/* Approver info (auto-filled) */}
          {approverEmail && (
            <div className="alert alert-info py-2">
              <span className="text-sm">
                Approver: <strong>{approverName || approverEmail}</strong> ({approverEmail})
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fund */}
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Fund</span></label>
              <select
                className="select select-bordered"
                value={fundId}
                onChange={e => setFundId(e.target.value)}
              >
                <option value="">Select fund…</option>
                {FUNDS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Category */}
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Category *</span></label>
              {categories.length > 0 ? (
                <select
                  className="select select-bordered"
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  required
                >
                  <option value="">Select category…</option>
                  {categories.filter(c => c.active !== false).map(c => (
                    <option key={c.id || c.categoryId} value={c.categoryId}>{c.categoryName}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="input input-bordered"
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  placeholder="e.g. Office Supplies"
                  required
                />
              )}
            </div>
          </div>

          {/* Vendor */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Vendor *</span></label>
            <select
              className="select select-bordered"
              value={vendorId}
              onChange={e => handleVendorChange(e.target.value)}
              required
            >
              <option value="">Select vendor…</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.vendorName}</option>
              ))}
              <option value="__new__">+ Request New Vendor</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Estimated Amount */}
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Estimated Amount ($) *</span></label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="input input-bordered"
                value={estimatedAmount}
                onChange={e => setEstimatedAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            {/* Payment Method */}
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Payment Method *</span></label>
              <select
                className="select select-bordered"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                required
              >
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Requested Expense Date */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Requested Expense Date *</span></label>
            <input
              type="date"
              className="input input-bordered"
              value={requestedExpenseDate}
              onChange={e => setRequestedExpenseDate(e.target.value)}
              required
            />
          </div>

          {/* Purpose */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Purpose *</span></label>
            <input
              className="input input-bordered"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder="Brief description of the expense"
              required
            />
          </div>

          {/* Description */}
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Description</span></label>
            <textarea
              className="textarea textarea-bordered"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Additional details (optional)"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={busy}
              className="btn btn-outline"
            >
              {busy ? <span className="loading loading-spinner loading-sm" /> : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="btn btn-primary"
            >
              {busy ? <span className="loading loading-spinner loading-sm" /> : "Submit for Pre-Approval"}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="btn btn-ghost">
              Cancel
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}
