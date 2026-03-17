import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useUserContext } from "../contexts/UserContext";
import { api } from "../workflow/api";
import { storage } from "../firebase";
import { CATEGORIES } from "../workflow/constants";
import { LineItem, Request } from "../workflow/types";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

interface LineItemDraft extends Omit<LineItem, 'requestId' | 'orgId'> {
  localId: string;
  fileUploading?: boolean;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

function newLineItem(): LineItemDraft {
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
  const { id: requestId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, activeOrgId } = useUserContext();

  const [request, setRequest] = useState<Request | null>(null);
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([newLineItem()]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    if (!requestId || !profile || !activeOrgId) return;
    setLoading(true);
    try {
      const result: any = await api.getRequestDetail({ requestId, orgId: activeOrgId });
      const req = result.request || result;
      setRequest(req);
      // Pre-populate line items if existing
      const existingItems: any[] = result.lineItems || [];
      if (existingItems.length > 0) {
        setLineItems(existingItems.map((li: any) => ({
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
    } catch (err) {
      setError("Failed to load request.");
    } finally {
      setLoading(false);
    }
  }, [requestId, profile, activeOrgId]);

  useEffect(() => { load(); }, [load]);

  const totalActual = lineItems.reduce((s, li) => s + (parseFloat(String(li.amount)) || 0), 0);
  const approvedAmount = request?.approvedAmount || 0;
  const hasOverage = approvedAmount > 0 && totalActual > approvedAmount;

  const updateLineItem = (localId: string, updates: Partial<LineItemDraft>) => {
    setLineItems(prev => prev.map(li => li.localId === localId ? { ...li, ...updates } : li));
  };

  const removeLineItem = (localId: string) => {
    setLineItems(prev => prev.filter(li => li.localId !== localId));
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, newLineItem()]);
  };

  const handleFileUpload = async (localId: string, file: File) => {
    if (!requestId || !activeOrgId) return;
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
    } catch (err) {
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

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (lineItems.some(li => li.fileUploading)) { setError("Please wait for file uploads to finish."); return; }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api.saveExpenseReport(buildSavePayload());
      setSuccess("Expense report saved as draft.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (lineItems.length === 0) { setError("At least one line item is required."); return; }
    if (lineItems.some(li => !li.description || !li.amount)) { setError("All line items must have description and amount."); return; }
    if (lineItems.some(li => li.fileUploading)) { setError("Please wait for file uploads to finish."); return; }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      // Save first, then submit
      await api.saveExpenseReport(buildSavePayload());
      await api.submitExpenseReport({ requestId, orgId: activeOrgId });
      setSuccess("Expense report submitted for review!");
      setTimeout(() => navigate(`/requests/${requestId}`), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="skeleton h-8 w-64 mb-4" />
        <div className="skeleton h-64 w-full rounded-box" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6">
        <div className="alert alert-error">Request not found.</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => navigate(`/requests/${requestId}`)} className="btn btn-ghost btn-sm mb-4">
        ← Back to Request
      </button>
      <h1 className="text-2xl font-bold mb-1">Expense Report</h1>
      <p className="text-sm text-base-content/60 mb-4">
        Request ID: <span className="font-mono">{requestId}</span>
      </p>

      {/* Request summary */}
      <div className="card bg-base-100 shadow mb-4">
        <div className="card-body py-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-base-content/50 uppercase text-xs font-semibold block">Purpose</span>
              <span>{request.purpose}</span>
            </div>
            <div>
              <span className="text-base-content/50 uppercase text-xs font-semibold block">Vendor</span>
              <span>{request.vendorName || request.vendorId || "—"}</span>
            </div>
            <div>
              <span className="text-base-content/50 uppercase text-xs font-semibold block">Approved Amount</span>
              <span className="font-semibold">{fmtCurrency(request.approvedAmount)}</span>
            </div>
            <div>
              <span className="text-base-content/50 uppercase text-xs font-semibold block">Running Total</span>
              <span className={`font-semibold ${hasOverage ? "text-error" : "text-success"}`}>
                {fmtCurrency(totalActual)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {hasOverage && (
        <div className="alert alert-warning mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>
            <strong>Overage:</strong> Actual total ({fmtCurrency(totalActual)}) exceeds approved amount ({fmtCurrency(approvedAmount)}).
            This will require additional approval.
          </span>
        </div>
      )}

      {error && <div className="alert alert-error mb-4"><span>{error}</span></div>}
      {success && <div className="alert alert-success mb-4"><span>{success}</span></div>}

      {/* Line Items */}
      <div className="card bg-base-100 shadow mb-4">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title text-base">Line Items</h2>
            <button type="button" onClick={addLineItem} className="btn btn-outline btn-sm">
              + Add Line Item
            </button>
          </div>

          {lineItems.length === 0 && (
            <div className="text-center py-8 text-base-content/50 text-sm">
              No line items. Click "Add Line Item" to start.
            </div>
          )}

          <div className="space-y-6">
            {lineItems.map((li, idx) => (
              <div key={li.localId} className="border border-base-300 rounded-box p-4 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm">Item {idx + 1}</span>
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(li.localId)}
                      className="btn btn-ghost btn-xs text-error"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="form-control md:col-span-2">
                    <label className="label py-1"><span className="label-text text-xs font-semibold">Description *</span></label>
                    <input
                      className="input input-bordered input-sm"
                      value={li.description}
                      onChange={e => updateLineItem(li.localId, { description: e.target.value })}
                      placeholder="What was purchased?"
                      required
                    />
                  </div>
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-xs font-semibold">Amount ($) *</span></label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="input input-bordered input-sm"
                      value={li.amount || ""}
                      onChange={e => updateLineItem(li.localId, { amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-xs font-semibold">Receipt Date *</span></label>
                    <input
                      type="date"
                      className="input input-bordered input-sm"
                      value={li.receiptDate}
                      onChange={e => updateLineItem(li.localId, { receiptDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-xs font-semibold">Category</span></label>
                    <select
                      className="select select-bordered select-sm"
                      value={li.category}
                      onChange={e => updateLineItem(li.localId, { category: e.target.value })}
                    >
                      <option value="">Select category…</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-xs font-semibold">Vendor Name</span></label>
                    <input
                      className="input input-bordered input-sm"
                      value={li.vendorName}
                      onChange={e => updateLineItem(li.localId, { vendorName: e.target.value })}
                      placeholder="Vendor for this item"
                    />
                  </div>
                  <div className="form-control md:col-span-2">
                    <label className="label py-1"><span className="label-text text-xs font-semibold">Notes</span></label>
                    <input
                      className="input input-bordered input-sm"
                      value={li.notes}
                      onChange={e => updateLineItem(li.localId, { notes: e.target.value })}
                      placeholder="Additional notes (optional)"
                    />
                  </div>
                  <div className="form-control md:col-span-2">
                    <label className="label py-1"><span className="label-text text-xs font-semibold">Receipt File</span></label>
                    {li.fileUrl ? (
                      <div className="flex items-center gap-2">
                        <a href={li.fileUrl} target="_blank" rel="noreferrer" className="link link-primary text-sm">
                          {li.fileName || "View File"}
                        </a>
                        <button
                          type="button"
                          onClick={() => updateLineItem(li.localId, { fileUrl: undefined, fileName: undefined })}
                          className="btn btn-ghost btn-xs text-error"
                        >
                          Remove
                        </button>
                      </div>
                    ) : li.fileUploading ? (
                      <div className="flex items-center gap-2 text-sm text-base-content/60">
                        <span className="loading loading-spinner loading-sm" />
                        Uploading…
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="file-input file-input-bordered file-input-sm"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(li.localId, file);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          {lineItems.length > 0 && (
            <div className="mt-4 flex justify-end">
              <div className="text-right">
                <span className="text-sm text-base-content/60 mr-4">Total Actual:</span>
                <span className={`text-lg font-bold ${hasOverage ? "text-error" : ""}`}>
                  {fmtCurrency(totalActual)}
                </span>
                {approvedAmount > 0 && (
                  <div className="text-xs text-base-content/50 mt-1">
                    Approved: {fmtCurrency(approvedAmount)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="btn btn-outline"
        >
          {busy ? <span className="loading loading-spinner loading-sm" /> : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || lineItems.length === 0}
          className="btn btn-primary"
        >
          {busy ? <span className="loading loading-spinner loading-sm" /> : "Submit Expense Report"}
        </button>
        <button type="button" onClick={() => navigate(`/requests/${requestId}`)} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  );
}
