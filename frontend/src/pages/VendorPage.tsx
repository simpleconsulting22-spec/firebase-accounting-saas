import { FormEvent, useCallback, useEffect, useState } from "react";
import { useUserContext } from "../contexts/UserContext";
import { api } from "../workflow/api";
import { Vendor, VendorSetupRequest } from "../workflow/types";

const fmtDate = (val: any): string => {
  if (!val) return "—";
  if (typeof val === "object" && val.seconds) {
    return new Date(val.seconds * 1000).toLocaleDateString('en-US');
  }
  try { return new Date(val).toLocaleDateString('en-US'); } catch { return String(val); }
};

export default function VendorPage() {
  const { profile, activeOrgId, activeOrgName } = useUserContext();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [myRequests, setMyRequests] = useState<VendorSetupRequest[]>([]);
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
    if (!profile || !activeOrgId) return;
    setLoading(true);
    setError("");
    try {
      const [vendorResult, requestsResult] = await Promise.all([
        api.getActiveVendors({ orgId: activeOrgId }),
        api.getVendorDashboards({ orgId: activeOrgId }),
      ]);
      setVendors((vendorResult as any)?.vendors || (vendorResult as any) || []);
      setMyRequests((requestsResult as any)?.requests || (requestsResult as any) || []);
    } catch (err) {
      setError("Failed to load vendor data.");
    } finally {
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) { setError("Vendor name is required."); return; }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit vendor request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Vendors</h1>
        <button
          onClick={() => setShowForm(v => !v)}
          className="btn btn-primary btn-sm"
        >
          {showForm ? "Cancel" : "+ Request New Vendor"}
        </button>
      </div>
      <p className="text-sm text-base-content/60 mb-6">{activeOrgName}</p>

      {error && <div className="alert alert-error mb-4"><span>{error}</span></div>}
      {success && <div className="alert alert-success mb-4"><span>{success}</span></div>}

      {/* New Vendor Request Form */}
      {showForm && (
        <div className="card bg-base-100 shadow border-t-4 border-primary mb-6">
          <div className="card-body">
            <h2 className="card-title text-base">Request New Vendor Setup</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control md:col-span-2">
                <label className="label"><span className="label-text font-semibold">Vendor Name *</span></label>
                <input
                  className="input input-bordered"
                  value={vendorName}
                  onChange={e => setVendorName(e.target.value)}
                  placeholder="Business or individual name"
                  required
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">Vendor Email</span></label>
                <input
                  type="email"
                  className="input input-bordered"
                  value={vendorEmail}
                  onChange={e => setVendorEmail(e.target.value)}
                  placeholder="vendor@example.com"
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">Contact Name</span></label>
                <input
                  className="input input-bordered"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="Primary contact person"
                />
              </div>
              <div className="form-control md:col-span-2">
                <label className="label"><span className="label-text font-semibold">Notes</span></label>
                <textarea
                  className="textarea textarea-bordered"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Additional details about this vendor"
                  rows={2}
                />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" disabled={busy} className="btn btn-primary">
                  {busy ? <span className="loading loading-spinner loading-sm" /> : "Submit Request"}
                </button>
                <button type="button" onClick={resetForm} className="btn btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-10 w-full rounded" />
          <div className="skeleton h-10 w-full rounded" />
          <div className="skeleton h-10 w-full rounded" />
        </div>
      ) : (
        <>
          {/* Active Vendors */}
          <div className="card bg-base-100 shadow mb-6">
            <div className="card-body">
              <h2 className="card-title text-base mb-2">Active Vendors</h2>
              {vendors.length === 0 ? (
                <div className="py-6 text-center text-base-content/50 text-sm">
                  No active vendors yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Contact</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendors.map((v) => (
                        <tr key={v.id} className="hover">
                          <td className="font-medium">{v.vendorName || (v as any).name}</td>
                          <td className="text-sm text-base-content/70">{v.vendorEmail || (v as any).email || "—"}</td>
                          <td className="text-sm">{(v as any).contactName || "—"}</td>
                          <td>
                            <span className={`badge badge-sm ${v.active === true || (v as any).status === "ACTIVE" ? "badge-success" : "badge-ghost"}`}>
                              {v.active === true ? "Active" : v.active === false ? "Inactive" : (v as any).status || "Active"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* My Vendor Setup Requests */}
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-base mb-2">My Vendor Setup Requests</h2>
              {myRequests.length === 0 ? (
                <div className="py-6 text-center text-base-content/50 text-sm">
                  You haven't submitted any vendor setup requests yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Vendor Name</th>
                        <th>Email</th>
                        <th>Contact</th>
                        <th>Status</th>
                        <th>Notes</th>
                        <th>Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myRequests.map((req, i) => (
                        <tr key={req.id || i} className="hover">
                          <td className="font-medium">{req.vendorName}</td>
                          <td className="text-sm text-base-content/70">{req.vendorEmail || "—"}</td>
                          <td className="text-sm">{req.contactName || "—"}</td>
                          <td>
                            <span className={`badge badge-sm ${
                              req.status === "APPROVED" ? "badge-success" :
                              req.status === "REJECTED" ? "badge-error" :
                              "badge-warning"
                            }`}>
                              {req.status || "PENDING"}
                            </span>
                          </td>
                          <td className="text-sm text-base-content/60 max-w-xs truncate">{req.notes || "—"}</td>
                          <td className="text-xs text-base-content/60">{fmtDate(req.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
