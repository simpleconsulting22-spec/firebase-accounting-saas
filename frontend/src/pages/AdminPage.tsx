import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../contexts/UserContext";
import { api } from "../workflow/api";
import {
  AdminDept,
  AppUser,
  Category,
  CategoryBudget,
  EscalationRule,
  QBAccount,
  VendorSetupRequest,
  Vendor,
  WorkflowSettings,
  BulkImportResult,
} from "../workflow/types";
import BulkImportModal from "../components/admin/BulkImportModal";

// ─── helpers ────────────────────────────────────────────────────────────────

const fmtDate = (val: any): string => {
  if (!val) return "—";
  if (typeof val === "object" && val.seconds) {
    return new Date(val.seconds * 1000).toLocaleDateString("en-US");
  }
  try {
    return new Date(val).toLocaleDateString("en-US");
  } catch {
    return String(val);
  }
};

const fmtCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

const ROLES = [
  "ADMIN",
  "FINANCE_PAYOR",
  "FINANCE_NOTIFY",
  "FINANCE_RECEIPTS_REVIEWER",
  "FINANCE_QB_ENTRY",
];

const QB_ACCOUNT_TYPES = ["Checking", "Savings", "Credit Card", "Other"];

const VENDOR_TYPES = ["Individual", "Business", "Church", "Other"];

const W9_TAX_CLASSIFICATIONS = [
  "Sole Proprietor",
  "Single-Member LLC",
  "Multi-Member LLC",
  "C Corporation",
  "S Corporation",
  "Partnership",
  "Trust",
  "Other",
];

const FUND_TYPES = ["Restricted", "Unrestricted"];

type TabId =
  | "departments"
  | "categories"
  | "vendors"
  | "vendorRequests"
  | "categoryBudgets"
  | "workflowSettings"
  | "escalationRules"
  | "qbAccounts"
  | "users";

type SortDir = "asc" | "desc";

interface SortState {
  field: string;
  dir: SortDir;
}

// ─── Toast ───────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

let toastCounter = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  return { toasts, addToast };
}

// ─── Reusable sub-components ─────────────────────────────────────────────────

function ToastArea({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast toast-top toast-end z-50">
      {toasts.map(t => (
        <div key={t.id} className={`alert ${t.type === "success" ? "alert-success" : "alert-error"} shadow-lg`}>
          <span className="text-sm">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  const cls = active ? "badge-success" : "badge-ghost";
  return <span className={`badge badge-sm ${cls}`}>{active ? "Active" : "Inactive"}</span>;
}

function SortIcon({ field, sort }: { field: string; sort: SortState }) {
  if (sort.field !== field) return <span className="ml-1 text-base-content/30">↕</span>;
  return <span className="ml-1">{sort.dir === "asc" ? "↑" : "↓"}</span>;
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {[1, 2, 3].map(i => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j}><div className="skeleton h-4 w-full" /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex justify-between items-center px-4 py-2 border-t border-base-200">
      <span className="text-xs text-base-content/60">
        Page {page} of {totalPages}
      </span>
      <div className="join">
        <button className="join-item btn btn-xs" disabled={page === 1} onClick={onPrev}>«</button>
        <button className="join-item btn btn-xs" disabled={page === totalPages} onClick={onNext}>»</button>
      </div>
    </div>
  );
}

function TableToolbar({
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  onAdd,
  onBulkImport,
  onRefresh,
  loading,
  addLabel,
}: {
  search: string;
  onSearch: (v: string) => void;
  statusFilter: string;
  onStatusFilter: (v: string) => void;
  onAdd: () => void;
  onBulkImport: () => void;
  onRefresh: () => void;
  loading?: boolean;
  addLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4 items-center">
      <input
        type="text"
        className="input input-bordered input-sm w-48"
        placeholder="Search..."
        value={search}
        onChange={e => onSearch(e.target.value)}
      />
      <select
        className="select select-bordered select-sm"
        value={statusFilter}
        onChange={e => onStatusFilter(e.target.value)}
      >
        <option value="">All</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <div className="flex-1" />
      <button className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={loading} title="Refresh">
        {loading ? <span className="loading loading-spinner loading-xs" /> : "↻"}
      </button>
      <button className="btn btn-outline btn-sm" onClick={onBulkImport}>Bulk Import</button>
      <button className="btn btn-primary btn-sm" onClick={onAdd}>{addLabel ?? "+ Add New"}</button>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function EditModal({
  isOpen,
  title,
  onClose,
  onSave,
  busy,
  children,
}: {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSave: (e: FormEvent) => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-11/12 max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">{title}</h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={onSave} className="space-y-4">
          {children}
          <div className="modal-action mt-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <span className="loading loading-spinner loading-sm" /> : "Save"}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text font-semibold">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </span>
      </label>
      {children}
    </div>
  );
}

// ─── useSortPaginate ──────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

function useSortPaginate<T extends Record<string, any>>(items: T[]) {
  const [sort, setSort] = useState<SortState>({ field: "", dir: "asc" });
  const [page, setPage] = useState(1);

  const toggleSort = (field: string) => {
    setSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    );
    setPage(1);
  };

  const sorted = [...items].sort((a, b) => {
    if (!sort.field) return 0;
    const av = a[sort.field] ?? "";
    const bv = b[sort.field] ?? "";
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return { sort, toggleSort, page: safePage, setPage, totalPages, paged };
}

// ─── Departments Tab ─────────────────────────────────────────────────────────

function DepartmentsTab({
  orgId,
  addToast,
}: {
  orgId: string;
  addToast: (type: Toast["type"], msg: string) => void;
}) {
  const [items, setItems] = useState<AdminDept[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<AdminDept | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // form state
  const [fMinistryDept, setFMinistryDept] = useState("");
  const [fApproverEmail, setFApproverEmail] = useState("");
  const [fApproverName, setFApproverName] = useState("");
  const [fActive, setFActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.adminListDepartments({ orgId });
      setItems(res?.departments || res || []);
    } catch {
      addToast("error", "Failed to load departments.");
    } finally {
      setLoading(false);
    }
  }, [orgId, addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(d => {
    const matchSearch = !search || (d.ministryDepartment || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter ||
      (statusFilter === "active" ? d.active === true : d.active === false);
    return matchSearch && matchStatus;
  });

  const { sort, toggleSort, page, setPage, totalPages, paged } = useSortPaginate(filtered);

  const openAdd = () => {
    setEditing(null);
    setFMinistryDept("");
    setFApproverEmail("");
    setFApproverName("");
    setFActive(true);
    setIsModalOpen(true);
  };

  const openEdit = (item: AdminDept) => {
    setEditing(item);
    setFMinistryDept(item.ministryDepartment);
    setFApproverEmail(item.approverEmail);
    setFApproverName(item.approverName || "");
    setFActive(item.active !== false);
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!fMinistryDept.trim()) { addToast("error", "Ministry department name is required."); return; }
    if (!fApproverEmail.trim()) { addToast("error", "Approver email is required."); return; }
    setBusy(true);
    try {
      await api.adminUpsertDepartment({
        orgId,
        dept: {
          id: editing?.id,
          ministryDepartment: fMinistryDept,
          approverEmail: fApproverEmail,
          approverName: fApproverName,
          approverId: (editing as any)?.approverId || "",
          active: fActive,
        },
      });
      addToast("success", `Department "${fMinistryDept}" saved.`);
      closeModal();
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (item: AdminDept) => {
    const nextActive = item.active === false ? true : false;
    const fn = nextActive ? api.adminReactivateDepartment : api.adminDeactivateDepartment;
    setBusy(true);
    try {
      await fn({ orgId, departmentId: item.id });
      addToast("success", `Department ${nextActive ? "reactivated" : "deactivated"}.`);
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setBusy(false);
    }
  };

  const handleBulkImport = async (rows: Record<string, string>[]): Promise<BulkImportResult> => {
    const res: any = await api.adminBulkImportDepartments({ orgId, rows });
    await load();
    return res;
  };

  const thCls = "cursor-pointer select-none hover:bg-base-200";

  return (
    <div>
      <TableToolbar
        search={search}
        onSearch={v => { setSearch(v); setPage(1); }}
        statusFilter={statusFilter}
        onStatusFilter={v => { setStatusFilter(v); setPage(1); }}
        onAdd={openAdd}
        onBulkImport={() => setBulkOpen(true)}
        onRefresh={load}
        loading={loading}
        addLabel="+ Add Department"
      />

      <div className="card bg-base-100 shadow">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className={thCls} onClick={() => toggleSort("ministryDepartment")}>
                    Ministry Department <SortIcon field="ministryDepartment" sort={sort} />
                  </th>
                  <th className={thCls} onClick={() => toggleSort("approverEmail")}>
                    Approver Email <SortIcon field="approverEmail" sort={sort} />
                  </th>
                  <th className={thCls} onClick={() => toggleSort("approverName")}>
                    Approver Name <SortIcon field="approverName" sort={sort} />
                  </th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={5} />
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-base-content/50 text-sm">
                      No departments found.
                    </td>
                  </tr>
                ) : (
                  paged.map((item, i) => (
                    <tr key={item.id || i} className="hover">
                      <td className="font-medium">{item.ministryDepartment}</td>
                      <td className="text-sm">{item.approverEmail}</td>
                      <td className="text-sm">{item.approverName || "—"}</td>
                      <td><ActiveBadge active={item.active !== false} /></td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-xs btn-outline" onClick={() => openEdit(item)}>Edit</button>
                          <button
                            className={`btn btn-xs ${item.active !== false ? "btn-warning" : "btn-success"} btn-outline`}
                            disabled={busy}
                            onClick={() => handleToggleActive(item)}
                          >
                            {item.active !== false ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </div>
      </div>

      <EditModal
        isOpen={isModalOpen}
        title={editing ? "Edit Department" : "New Department"}
        onClose={closeModal}
        onSave={handleSave}
        busy={busy}
      >
        <FormField label="Ministry Department" required>
          <input className="input input-bordered w-full" value={fMinistryDept} onChange={e => setFMinistryDept(e.target.value)} required placeholder="e.g. Youth Ministry" />
        </FormField>
        <FormField label="Approver Email" required>
          <input type="email" className="input input-bordered w-full" value={fApproverEmail} onChange={e => setFApproverEmail(e.target.value)} required placeholder="approver@church.org" />
        </FormField>
        <FormField label="Approver Name">
          <input className="input input-bordered w-full" value={fApproverName} onChange={e => setFApproverName(e.target.value)} placeholder="Full name" />
        </FormField>
        <FormField label="Active">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" className="checkbox checkbox-primary" checked={fActive} onChange={e => setFActive(e.target.checked)} />
            <span className="label-text">{fActive ? "Active" : "Inactive"}</span>
          </label>
        </FormField>
      </EditModal>

      <BulkImportModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImport={handleBulkImport}
        title="Bulk Import Departments"
        templateHeaders={["ministryDepartment", "approverEmail", "approverName", "active"]}
        templateExampleRows={[{ ministryDepartment: "Youth Ministry", approverEmail: "james@citylightmn.com", approverName: "James Wilson", active: "true" }]}
        requiredFields={["ministryDepartment", "approverEmail"]}
      />
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab({
  orgId,
  addToast,
}: {
  orgId: string;
  addToast: (type: Toast["type"], msg: string) => void;
}) {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [fCategoryId, setFCategoryId] = useState("");
  const [fCategoryName, setFCategoryName] = useState("");
  const [fActive, setFActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.adminListCategories({ orgId });
      setItems(res?.categories || res || []);
    } catch {
      addToast("error", "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, [orgId, addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(d => {
    const matchSearch = !search || (d.categoryName || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter ||
      (statusFilter === "active" ? d.active === true : d.active === false);
    return matchSearch && matchStatus;
  });

  const { sort, toggleSort, page, setPage, totalPages, paged } = useSortPaginate(filtered);

  const openAdd = () => {
    setEditing(null);
    setFCategoryId("");
    setFCategoryName("");
    setFActive(true);
    setIsModalOpen(true);
  };
  const openEdit = (item: Category) => {
    setEditing(item);
    setFCategoryId(item.categoryId || "");
    setFCategoryName(item.categoryName);
    setFActive(item.active !== false);
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!fCategoryName.trim()) { addToast("error", "Category name is required."); return; }
    if (!editing && !fCategoryId.trim()) { addToast("error", "Category ID is required."); return; }
    setBusy(true);
    try {
      await api.adminUpsertCategory({
        orgId,
        category: {
          id: editing?.id,
          categoryId: fCategoryId,
          categoryName: fCategoryName,
          active: fActive,
        },
      });
      addToast("success", `Category "${fCategoryName}" saved.`);
      closeModal();
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (item: Category) => {
    const nextActive = item.active === false ? true : false;
    setBusy(true);
    try {
      await api.adminSetCategoryStatus({ orgId, categoryId: item.id, active: nextActive });
      addToast("success", `Category ${nextActive ? "reactivated" : "deactivated"}.`);
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setBusy(false);
    }
  };

  const handleBulkImport = async (rows: Record<string, string>[]): Promise<BulkImportResult> => {
    const res: any = await api.adminBulkImportCategories({ orgId, rows });
    await load();
    return res;
  };

  const thCls = "cursor-pointer select-none hover:bg-base-200";

  return (
    <div>
      <TableToolbar search={search} onSearch={v => { setSearch(v); setPage(1); }} statusFilter={statusFilter} onStatusFilter={v => { setStatusFilter(v); setPage(1); }} onAdd={openAdd} onBulkImport={() => setBulkOpen(true)} onRefresh={load} loading={loading} addLabel="+ Add Category" />
      <div className="card bg-base-100 shadow">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className={thCls} onClick={() => toggleSort("categoryId")}>Category ID <SortIcon field="categoryId" sort={sort} /></th>
                  <th className={thCls} onClick={() => toggleSort("categoryName")}>Category Name <SortIcon field="categoryName" sort={sort} /></th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <SkeletonRows cols={4} /> : paged.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-base-content/50 text-sm">No categories found.</td></tr>
                ) : paged.map((item, i) => (
                  <tr key={item.id || i} className="hover">
                    <td className="text-sm font-mono">{item.categoryId || "—"}</td>
                    <td className="font-medium">{item.categoryName}</td>
                    <td><ActiveBadge active={item.active !== false} /></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-xs btn-outline" onClick={() => openEdit(item)}>Edit</button>
                        <button className={`btn btn-xs ${item.active !== false ? "btn-warning" : "btn-success"} btn-outline`} disabled={busy} onClick={() => handleToggleActive(item)}>
                          {item.active !== false ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </div>
      </div>

      <EditModal isOpen={isModalOpen} title={editing ? "Edit Category" : "New Category"} onClose={closeModal} onSave={handleSave} busy={busy}>
        <FormField label="Category ID" required>
          <input className="input input-bordered w-full" value={fCategoryId} onChange={e => setFCategoryId(e.target.value)} required={!editing} placeholder="e.g. CAT-001" />
        </FormField>
        <FormField label="Category Name" required>
          <input className="input input-bordered w-full" value={fCategoryName} onChange={e => setFCategoryName(e.target.value)} required placeholder="e.g. Food & Beverages" />
        </FormField>
        <FormField label="Active">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" className="checkbox checkbox-primary" checked={fActive} onChange={e => setFActive(e.target.checked)} />
            <span className="label-text">{fActive ? "Active" : "Inactive"}</span>
          </label>
        </FormField>
      </EditModal>

      <BulkImportModal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} onImport={handleBulkImport} title="Bulk Import Categories"
        templateHeaders={["categoryId", "categoryName", "active"]}
        templateExampleRows={[{ categoryId: "CAT-001", categoryName: "Food & Beverages", active: "true" }]}
        requiredFields={["categoryId", "categoryName"]} />
    </div>
  );
}

// ─── Vendors Tab ──────────────────────────────────────────────────────────────

function VendorsTab({
  orgId,
  addToast,
}: {
  orgId: string;
  addToast: (type: Toast["type"], msg: string) => void;
}) {
  const [items, setItems] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [fVendorId, setFVendorId] = useState("");
  const [fVendorName, setFVendorName] = useState("");
  const [fVendorEmail, setFVendorEmail] = useState("");
  const [fVendorType, setFVendorType] = useState("Individual");
  const [fW9OnFile, setFW9OnFile] = useState(false);
  const [fW9TaxClassification, setFW9TaxClassification] = useState("");
  const [fLlcTaxTreatment, setFLlcTaxTreatment] = useState("");
  const [fIs1099Required, setFIs1099Required] = useState(false);
  const [fActive, setFActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.adminListVendors({ orgId });
      setItems(res?.vendors || res || []);
    } catch {
      addToast("error", "Failed to load vendors.");
    } finally {
      setLoading(false);
    }
  }, [orgId, addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(d => {
    const name = d.vendorName || "";
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter ||
      (statusFilter === "active" ? d.active === true : d.active === false);
    return matchSearch && matchStatus;
  });

  const { sort, toggleSort, page, setPage, totalPages, paged } = useSortPaginate(filtered);

  const openAdd = () => {
    setEditing(null);
    setFVendorId("");
    setFVendorName("");
    setFVendorEmail("");
    setFVendorType("Individual");
    setFW9OnFile(false);
    setFW9TaxClassification("");
    setFLlcTaxTreatment("");
    setFIs1099Required(false);
    setFActive(true);
    setIsModalOpen(true);
  };
  const openEdit = (item: Vendor) => {
    setEditing(item);
    setFVendorId(item.vendorId || "");
    setFVendorName(item.vendorName || "");
    setFVendorEmail(item.vendorEmail || "");
    setFVendorType(item.vendorType || "Individual");
    setFW9OnFile(item.w9OnFile === true);
    setFW9TaxClassification(item.w9TaxClassification || "");
    setFLlcTaxTreatment(item.llcTaxTreatment || "");
    setFIs1099Required(item.is1099Required === true);
    setFActive(item.active !== false);
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!fVendorName.trim()) { addToast("error", "Vendor name is required."); return; }
    if (!editing && !fVendorId.trim()) { addToast("error", "Vendor ID is required."); return; }
    setBusy(true);
    try {
      await api.adminUpsertVendor({
        orgId,
        vendor: {
          id: editing?.id,
          vendorId: fVendorId,
          vendorName: fVendorName,
          vendorEmail: fVendorEmail,
          vendorType: fVendorType,
          w9OnFile: fW9OnFile,
          w9TaxClassification: fW9TaxClassification,
          llcTaxTreatment: fLlcTaxTreatment,
          is1099Required: fIs1099Required,
          active: fActive,
        },
      });
      addToast("success", `Vendor "${fVendorName}" saved.`);
      closeModal();
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (item: Vendor) => {
    const nextActive = item.active === false ? true : false;
    setBusy(true);
    try {
      await api.adminSetVendorStatus({ orgId, vendorId: item.id, active: nextActive });
      addToast("success", `Vendor ${nextActive ? "reactivated" : "deactivated"}.`);
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setBusy(false);
    }
  };

  const handleBulkImport = async (rows: Record<string, string>[]): Promise<BulkImportResult> => {
    const res: any = await api.adminBulkImportVendors({ orgId, rows });
    await load();
    return res;
  };

  const thCls = "cursor-pointer select-none hover:bg-base-200";
  const showLlcTreatment = fW9TaxClassification.toLowerCase().includes("llc");

  return (
    <div>
      <TableToolbar search={search} onSearch={v => { setSearch(v); setPage(1); }} statusFilter={statusFilter} onStatusFilter={v => { setStatusFilter(v); setPage(1); }} onAdd={openAdd} onBulkImport={() => setBulkOpen(true)} onRefresh={load} loading={loading} addLabel="+ Add Vendor" />
      <div className="card bg-base-100 shadow">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className={thCls} onClick={() => toggleSort("vendorId")}>Vendor ID <SortIcon field="vendorId" sort={sort} /></th>
                  <th className={thCls} onClick={() => toggleSort("vendorName")}>Vendor Name <SortIcon field="vendorName" sort={sort} /></th>
                  <th className={thCls} onClick={() => toggleSort("vendorEmail")}>Email <SortIcon field="vendorEmail" sort={sort} /></th>
                  <th className={thCls} onClick={() => toggleSort("vendorType")}>Type <SortIcon field="vendorType" sort={sort} /></th>
                  <th>W9</th>
                  <th>1099</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <SkeletonRows cols={8} /> : paged.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-base-content/50 text-sm">No vendors found.</td></tr>
                ) : paged.map((item, i) => (
                  <tr key={item.id || i} className="hover">
                    <td className="text-sm font-mono">{item.vendorId || "—"}</td>
                    <td className="font-medium">{item.vendorName}</td>
                    <td className="text-sm">{item.vendorEmail || "—"}</td>
                    <td className="text-sm">{item.vendorType || "—"}</td>
                    <td className="text-sm">{item.w9OnFile ? "Yes" : "No"}</td>
                    <td className="text-sm">{item.is1099Required ? "Yes" : "No"}</td>
                    <td><ActiveBadge active={item.active !== false} /></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-xs btn-outline" onClick={() => openEdit(item)}>Edit</button>
                        <button className={`btn btn-xs ${item.active !== false ? "btn-warning" : "btn-success"} btn-outline`} disabled={busy} onClick={() => handleToggleActive(item)}>
                          {item.active !== false ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </div>
      </div>

      <EditModal isOpen={isModalOpen} title={editing ? "Edit Vendor" : "New Vendor"} onClose={closeModal} onSave={handleSave} busy={busy}>
        <FormField label="Vendor ID" required>
          <input className="input input-bordered w-full" value={fVendorId} onChange={e => setFVendorId(e.target.value)} required={!editing} placeholder="e.g. VND-001" />
        </FormField>
        <FormField label="Vendor Name" required>
          <input className="input input-bordered w-full" value={fVendorName} onChange={e => setFVendorName(e.target.value)} required placeholder="e.g. Amazon Business" />
        </FormField>
        <FormField label="Email">
          <input type="email" className="input input-bordered w-full" value={fVendorEmail} onChange={e => setFVendorEmail(e.target.value)} placeholder="vendor@example.com" />
        </FormField>
        <FormField label="Vendor Type">
          <select className="select select-bordered w-full" value={fVendorType} onChange={e => setFVendorType(e.target.value)}>
            {VENDOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="W9 Tax Classification">
          <select className="select select-bordered w-full" value={fW9TaxClassification} onChange={e => setFW9TaxClassification(e.target.value)}>
            <option value="">Select classification…</option>
            {W9_TAX_CLASSIFICATIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>
        {showLlcTreatment && (
          <FormField label="LLC Tax Treatment (S / C / P)">
            <input className="input input-bordered w-full" value={fLlcTaxTreatment} onChange={e => setFLlcTaxTreatment(e.target.value)} placeholder="S, C, or P" />
          </FormField>
        )}
        <FormField label="W9 On File">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" className="checkbox checkbox-primary" checked={fW9OnFile} onChange={e => setFW9OnFile(e.target.checked)} />
            <span className="label-text">W9 on file</span>
          </label>
        </FormField>
        <FormField label="1099 Required">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" className="checkbox checkbox-primary" checked={fIs1099Required} onChange={e => setFIs1099Required(e.target.checked)} />
            <span className="label-text">1099 required</span>
          </label>
        </FormField>
        <FormField label="Active">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" className="checkbox checkbox-primary" checked={fActive} onChange={e => setFActive(e.target.checked)} />
            <span className="label-text">{fActive ? "Active" : "Inactive"}</span>
          </label>
        </FormField>
      </EditModal>

      <BulkImportModal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} onImport={handleBulkImport} title="Bulk Import Vendors"
        templateHeaders={["vendorId", "vendorName", "vendorEmail", "vendorType", "w9OnFile", "w9TaxClassification", "llcTaxTreatment", "is1099Required", "active"]}
        templateExampleRows={[{ vendorId: "VND-001", vendorName: "Amazon Business", vendorEmail: "business@amazon.com", vendorType: "Business", w9OnFile: "false", w9TaxClassification: "C Corporation", llcTaxTreatment: "", is1099Required: "false", active: "true" }]}
        requiredFields={["vendorName"]} />
    </div>
  );
}

// ─── Vendor Requests Tab ──────────────────────────────────────────────────────

function VendorRequestsTab({
  orgId,
  addToast,
}: {
  orgId: string;
  addToast: (type: Toast["type"], msg: string) => void;
}) {
  const [items, setItems] = useState<VendorSetupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.getPendingVendorSetupRequests({ orgId });
      setItems(res?.requests || res || []);
    } catch {
      addToast("error", "Failed to load vendor requests.");
    } finally {
      setLoading(false);
    }
  }, [orgId, addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(d => {
    const matchSearch = !search || (d.vendorName || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const { sort, toggleSort, page, setPage, totalPages, paged } = useSortPaginate(filtered);

  const handleApprove = async (req: VendorSetupRequest) => {
    setBusy(true);
    try {
      await api.approveVendorSetup({ orgId, vendorSetupId: req.id });
      addToast("success", `Vendor "${req.vendorName}" approved.`);
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to approve.");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (req: VendorSetupRequest) => {
    const reason = prompt("Rejection reason:");
    if (!reason) return;
    setBusy(true);
    try {
      await api.rejectVendorSetup({ orgId, vendorSetupId: req.id, reason });
      addToast("success", "Vendor request rejected.");
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to reject.");
    } finally {
      setBusy(false);
    }
  };

  const thCls = "cursor-pointer select-none hover:bg-base-200";

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input type="text" className="input input-bordered input-sm w-48" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="select select-bordered select-sm" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading} title="Refresh">
          {loading ? <span className="loading loading-spinner loading-xs" /> : "↻"}
        </button>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className={thCls} onClick={() => toggleSort("vendorName")}>Vendor Name <SortIcon field="vendorName" sort={sort} /></th>
                  <th>Email</th>
                  <th>Contact</th>
                  <th>Requestor</th>
                  <th className={thCls} onClick={() => toggleSort("status")}>Status <SortIcon field="status" sort={sort} /></th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <SkeletonRows cols={7} /> : paged.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-base-content/50 text-sm">No vendor requests found.</td></tr>
                ) : paged.map((req, i) => (
                  <tr key={req.id || i} className="hover">
                    <td className="font-medium">{req.vendorName}</td>
                    <td className="text-sm">{req.vendorEmail || "—"}</td>
                    <td className="text-sm">{req.contactName || "—"}</td>
                    <td className="text-sm text-base-content/70">{req.requestorEmail || "—"}</td>
                    <td>
                      <span className={`badge badge-sm ${req.status === "PENDING" ? "badge-warning" : req.status === "APPROVED" ? "badge-success" : "badge-error"}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="text-xs text-base-content/60">{fmtDate(req.createdAt)}</td>
                    <td>
                      {req.status === "PENDING" && (
                        <div className="flex gap-1">
                          <button className="btn btn-xs btn-success" disabled={busy} onClick={() => handleApprove(req)}>Approve</button>
                          <button className="btn btn-xs btn-error" disabled={busy} onClick={() => handleReject(req)}>Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </div>
      </div>
    </div>
  );
}

// ─── Category Budgets Tab ─────────────────────────────────────────────────────

function CategoryBudgetsTab({
  orgId,
  addToast,
}: {
  orgId: string;
  addToast: (type: Toast["type"], msg: string) => void;
}) {
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const [items, setItems] = useState<CategoryBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>(String(currentYear));
  const [editing, setEditing] = useState<CategoryBudget | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [fMinistryDept, setFMinistryDept] = useState("");
  const [fFundName, setFFundName] = useState("");
  const [fFundType, setFFundType] = useState("Unrestricted");
  const [fYear, setFYear] = useState(currentYear);
  const [fBudgetAmount, setFBudgetAmount] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.adminListCategoryBudgets({ orgId });
      setItems(res?.budgets || res || []);
    } catch {
      addToast("error", "Failed to load category budgets.");
    } finally {
      setLoading(false);
    }
  }, [orgId, addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(d => {
    const matchSearch = !search ||
      (d.ministryDepartment || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.fundName || "").toLowerCase().includes(search.toLowerCase());
    const matchYear = !yearFilter || String(d.year) === yearFilter;
    return matchSearch && matchYear;
  });

  const { sort, toggleSort, page, setPage, totalPages, paged } = useSortPaginate(filtered);

  const openAdd = () => {
    setEditing(null);
    setFMinistryDept("");
    setFFundName("");
    setFFundType("Unrestricted");
    setFYear(currentYear);
    setFBudgetAmount("");
    setIsModalOpen(true);
  };
  const openEdit = (item: CategoryBudget) => {
    setEditing(item);
    setFMinistryDept(item.ministryDepartment || "");
    setFFundName(item.fundName || "");
    setFFundType(item.fundType || "Unrestricted");
    setFYear(item.year || currentYear);
    setFBudgetAmount(String(item.approvedAnnualBudget ?? ""));
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!fBudgetAmount || isNaN(Number(fBudgetAmount))) { addToast("error", "Valid budget amount is required."); return; }
    setBusy(true);
    try {
      await api.adminUpsertCategoryBudget({
        orgId,
        budget: {
          id: editing?.id,
          organizationId: orgId,
          ministryDepartment: fMinistryDept,
          fundName: fFundName,
          fundType: fFundType,
          year: fYear,
          approvedAnnualBudget: parseFloat(fBudgetAmount),
        },
      });
      addToast("success", "Category budget saved.");
      closeModal();
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  const handleBulkImport = async (rows: Record<string, string>[]): Promise<BulkImportResult> => {
    const res: any = await api.adminBulkImportCategoryBudgets({ orgId, rows });
    await load();
    return res;
  };

  const thCls = "cursor-pointer select-none hover:bg-base-200";

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input type="text" className="input input-bordered input-sm w-48" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="select select-bordered select-sm" value={yearFilter} onChange={e => { setYearFilter(e.target.value); setPage(1); }}>
          <option value="">All Years</option>
          {yearOptions.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading} title="Refresh">
          {loading ? <span className="loading loading-spinner loading-xs" /> : "↻"}
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => setBulkOpen(true)}>Bulk Import</button>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Budget</button>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className={thCls} onClick={() => toggleSort("ministryDepartment")}>Dept <SortIcon field="ministryDepartment" sort={sort} /></th>
                  <th className={thCls} onClick={() => toggleSort("fundName")}>Fund Name <SortIcon field="fundName" sort={sort} /></th>
                  <th className={thCls} onClick={() => toggleSort("fundType")}>Fund Type <SortIcon field="fundType" sort={sort} /></th>
                  <th className={thCls} onClick={() => toggleSort("year")}>Year <SortIcon field="year" sort={sort} /></th>
                  <th className={thCls} onClick={() => toggleSort("approvedAnnualBudget")}>Budget <SortIcon field="approvedAnnualBudget" sort={sort} /></th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <SkeletonRows cols={6} /> : paged.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-base-content/50 text-sm">No budgets found.</td></tr>
                ) : paged.map((item, i) => (
                  <tr key={item.id || i} className="hover">
                    <td className="font-medium">{item.ministryDepartment || "—"}</td>
                    <td className="text-sm">{item.fundName || "—"}</td>
                    <td className="text-sm">{item.fundType || "—"}</td>
                    <td>{item.year}</td>
                    <td>{fmtCurrency(item.approvedAnnualBudget ?? 0)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-xs btn-outline" onClick={() => openEdit(item)}>Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </div>
      </div>

      <EditModal isOpen={isModalOpen} title={editing ? "Edit Category Budget" : "New Category Budget"} onClose={closeModal} onSave={handleSave} busy={busy}>
        <FormField label="Ministry Department" required>
          <input className="input input-bordered w-full" value={fMinistryDept} onChange={e => setFMinistryDept(e.target.value)} required placeholder="e.g. Youth Ministry" />
        </FormField>
        <FormField label="Fund Name" required>
          <input className="input input-bordered w-full" value={fFundName} onChange={e => setFFundName(e.target.value)} required placeholder="e.g. General Fund" />
        </FormField>
        <FormField label="Fund Type">
          <select className="select select-bordered w-full" value={fFundType} onChange={e => setFFundType(e.target.value)}>
            {FUND_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="Year" required>
          <select className="select select-bordered w-full" value={fYear} onChange={e => setFYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </FormField>
        <FormField label="Approved Annual Budget ($)" required>
          <input type="number" step="0.01" min="0" className="input input-bordered w-full" value={fBudgetAmount} onChange={e => setFBudgetAmount(e.target.value)} required placeholder="5000.00" />
        </FormField>
      </EditModal>

      <BulkImportModal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} onImport={handleBulkImport} title="Bulk Import Category Budgets"
        templateHeaders={["organizationId", "year", "ministryDepartment", "fundName", "fundType", "approvedAnnualBudget"]}
        templateExampleRows={[{ organizationId: "org_citylight", year: "2026", ministryDepartment: "Youth Ministry", fundName: "General Fund", fundType: "Unrestricted", approvedAnnualBudget: "5000" }]}
        requiredFields={["ministryDepartment", "year", "approvedAnnualBudget"]} />
    </div>
  );
}

// ─── Workflow Settings Tab ────────────────────────────────────────────────────

function WorkflowSettingsTab({
  orgId,
  addToast,
}: {
  orgId: string;
  addToast: (type: Toast["type"], msg: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [approvalLevels, setApprovalLevels] = useState(2);
  const [receiptThreshold, setReceiptThreshold] = useState("");
  const [approvalThreshold, setApprovalThreshold] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.adminGetWorkflowSettings({ orgId });
      const s: WorkflowSettings = res?.settings || res || {};
      setApprovalLevels(s.approvalLevels || 2);
      setReceiptThreshold(String(s.receiptRequiredThreshold ?? ""));
      setApprovalThreshold(String(s.expenseApprovalThreshold ?? ""));
    } catch {
      addToast("error", "Failed to load workflow settings.");
    } finally {
      setLoading(false);
    }
  }, [orgId, addToast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.adminSaveWorkflowSettings({
        orgId,
        settings: {
          approvalLevels,
          receiptRequiredThreshold: parseFloat(receiptThreshold) || 0,
          expenseApprovalThreshold: parseFloat(approvalThreshold) || 0,
        },
      });
      addToast("success", "Workflow settings saved.");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-md">
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="form-control">
          <label className="label"><span className="label-text font-semibold">Approval Levels (1–5)</span></label>
          <input
            type="number"
            min={1}
            max={5}
            className="input input-bordered w-full"
            value={approvalLevels}
            onChange={e => setApprovalLevels(Number(e.target.value))}
          />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text font-semibold">Receipt Required Threshold ($)</span></label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="input input-bordered w-full"
            value={receiptThreshold}
            onChange={e => setReceiptThreshold(e.target.value)}
            placeholder="e.g. 25.00"
          />
          <label className="label"><span className="label-text-alt text-base-content/60">Receipts required for expenses above this amount</span></label>
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text font-semibold">Expense Approval Threshold ($)</span></label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="input input-bordered w-full"
            value={approvalThreshold}
            onChange={e => setApprovalThreshold(e.target.value)}
            placeholder="e.g. 500.00"
          />
          <label className="label"><span className="label-text-alt text-base-content/60">Expenses above this amount require additional approval</span></label>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={load} disabled={busy} title="Refresh">
            ↻ Refresh
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-sm" /> : null}
            {busy ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Escalation Rules Tab ─────────────────────────────────────────────────────

function EscalationRulesTab({
  orgId,
  addToast,
}: {
  orgId: string;
  addToast: (type: Toast["type"], msg: string) => void;
}) {
  const [items, setItems] = useState<EscalationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<EscalationRule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [fStep, setFStep] = useState(1);
  const [fRole, setFRole] = useState("ADMIN");
  const [fThreshold, setFThreshold] = useState("");
  const [fBuffer, setFBuffer] = useState("");
  const [fStatus, setFStatus] = useState<"active" | "inactive">("active");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.adminListEscalationRules({ orgId });
      setItems(res?.rules || res || []);
    } catch {
      addToast("error", "Failed to load escalation rules.");
    } finally {
      setLoading(false);
    }
  }, [orgId, addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(d => {
    const matchSearch = !search || d.role.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const { sort, toggleSort, page, setPage, totalPages, paged } = useSortPaginate(filtered);

  const openAdd = () => {
    setEditing(null); setFStep(1); setFRole("ADMIN"); setFThreshold(""); setFBuffer(""); setFStatus("active"); setIsModalOpen(true);
  };
  const openEdit = (item: EscalationRule) => {
    setEditing(item); setFStep(item.step); setFRole(item.role); setFThreshold(String(item.threshold)); setFBuffer(item.bufferAmount ? String(item.bufferAmount) : ""); setFStatus(item.status); setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!fThreshold || isNaN(Number(fThreshold))) { addToast("error", "Valid threshold is required."); return; }
    setBusy(true);
    try {
      await api.adminUpsertEscalationRule({
        orgId,
        ruleId: editing?.id,
        step: fStep,
        role: fRole,
        threshold: parseFloat(fThreshold),
        bufferAmount: fBuffer ? parseFloat(fBuffer) : undefined,
        status: fStatus,
      });
      addToast("success", "Escalation rule saved.");
      closeModal();
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleStatus = async (item: EscalationRule) => {
    const next: "active" | "inactive" = item.status === "active" ? "inactive" : "active";
    setBusy(true);
    try {
      await api.adminSetEscalationRuleStatus({ orgId, ruleId: item.id, status: next });
      addToast("success", `Rule ${next === "inactive" ? "deactivated" : "reactivated"}.`);
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setBusy(false);
    }
  };

  const handleBulkImport = async (rows: Record<string, string>[]): Promise<BulkImportResult> => {
    const res: any = await api.adminBulkImportEscalationRules({ orgId, rows });
    await load();
    return res;
  };

  const thCls = "cursor-pointer select-none hover:bg-base-200";

  return (
    <div>
      <TableToolbar search={search} onSearch={v => { setSearch(v); setPage(1); }} statusFilter={statusFilter} onStatusFilter={v => { setStatusFilter(v); setPage(1); }} onAdd={openAdd} onBulkImport={() => setBulkOpen(true)} onRefresh={load} loading={loading} addLabel="+ Add Rule" />
      <div className="card bg-base-100 shadow">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className={thCls} onClick={() => toggleSort("step")}>Step <SortIcon field="step" sort={sort} /></th>
                  <th className={thCls} onClick={() => toggleSort("role")}>Role <SortIcon field="role" sort={sort} /></th>
                  <th className={thCls} onClick={() => toggleSort("threshold")}>Threshold ($) <SortIcon field="threshold" sort={sort} /></th>
                  <th>Buffer Amount ($)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <SkeletonRows cols={6} /> : paged.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-base-content/50 text-sm">No escalation rules found.</td></tr>
                ) : paged.map((item, i) => (
                  <tr key={item.id || i} className="hover">
                    <td>{item.step}</td>
                    <td className="font-mono text-sm">{item.role}</td>
                    <td>{fmtCurrency(item.threshold)}</td>
                    <td>{item.bufferAmount ? fmtCurrency(item.bufferAmount) : "—"}</td>
                    <td><span className={`badge badge-sm ${item.status === "active" ? "badge-success" : "badge-ghost"}`}>{item.status}</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-xs btn-outline" onClick={() => openEdit(item)}>Edit</button>
                        <button className={`btn btn-xs ${item.status === "active" ? "btn-warning" : "btn-success"} btn-outline`} disabled={busy} onClick={() => handleToggleStatus(item)}>
                          {item.status === "active" ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </div>
      </div>

      <EditModal isOpen={isModalOpen} title={editing ? "Edit Escalation Rule" : "New Escalation Rule"} onClose={closeModal} onSave={handleSave} busy={busy}>
        <FormField label="Step" required>
          <select className="select select-bordered w-full" value={fStep} onChange={e => setFStep(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Step {s}</option>)}
          </select>
        </FormField>
        <FormField label="Role" required>
          <select className="select select-bordered w-full" value={fRole} onChange={e => setFRole(e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FormField>
        <FormField label="Threshold ($)" required>
          <input type="number" min={0} step="0.01" className="input input-bordered w-full" value={fThreshold} onChange={e => setFThreshold(e.target.value)} required placeholder="500.00" />
        </FormField>
        <FormField label="Buffer Amount ($)">
          <input type="number" min={0} step="0.01" className="input input-bordered w-full" value={fBuffer} onChange={e => setFBuffer(e.target.value)} placeholder="50.00" />
        </FormField>
        <FormField label="Status">
          <select className="select select-bordered w-full" value={fStatus} onChange={e => setFStatus(e.target.value as "active" | "inactive")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FormField>
      </EditModal>

      <BulkImportModal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} onImport={handleBulkImport} title="Bulk Import Escalation Rules"
        templateHeaders={["step", "role", "threshold", "bufferAmount", "status"]}
        templateExampleRows={[{ step: "2", role: "ADMIN", threshold: "500", bufferAmount: "50", status: "active" }]}
        requiredFields={["step", "role", "threshold"]} />
    </div>
  );
}

// ─── QB Accounts Tab ──────────────────────────────────────────────────────────

function QBAccountsTab({
  orgId,
  addToast,
}: {
  orgId: string;
  addToast: (type: Toast["type"], msg: string) => void;
}) {
  const [items, setItems] = useState<QBAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<QBAccount | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [fName, setFName] = useState("");
  const [fAccountNumber, setFAccountNumber] = useState("");
  const [fAccountType, setFAccountType] = useState("Checking");
  const [fStatus, setFStatus] = useState<"active" | "inactive">("active");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.adminListQBAccounts({ orgId });
      setItems(res?.accounts || res || []);
    } catch {
      addToast("error", "Failed to load QB accounts.");
    } finally {
      setLoading(false);
    }
  }, [orgId, addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(d => {
    const matchSearch = !search || (d.name || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const { sort, toggleSort, page, setPage, totalPages, paged } = useSortPaginate(filtered);

  const openAdd = () => { setEditing(null); setFName(""); setFAccountNumber(""); setFAccountType("Checking"); setFStatus("active"); setIsModalOpen(true); };
  const openEdit = (item: QBAccount) => {
    setEditing(item); setFName(item.name); setFAccountNumber(item.accountNumber || ""); setFAccountType(item.accountType || "Checking"); setFStatus(item.status); setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!fName.trim()) { addToast("error", "Account name is required."); return; }
    setBusy(true);
    try {
      await api.adminUpsertQBAccount({ orgId, accountId: editing?.id, name: fName, accountNumber: fAccountNumber, accountType: fAccountType, status: fStatus });
      addToast("success", `QB Account "${fName}" saved.`);
      closeModal();
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleStatus = async (item: QBAccount) => {
    const next: "active" | "inactive" = item.status === "active" ? "inactive" : "active";
    setBusy(true);
    try {
      await api.adminSetQBAccountStatus({ orgId, accountId: item.id, status: next });
      addToast("success", `Account ${next === "inactive" ? "deactivated" : "reactivated"}.`);
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setBusy(false);
    }
  };

  const handleBulkImport = async (rows: Record<string, string>[]): Promise<BulkImportResult> => {
    const res: any = await api.adminBulkImportQBAccounts({ orgId, rows });
    await load();
    return res;
  };

  const thCls = "cursor-pointer select-none hover:bg-base-200";

  return (
    <div>
      <TableToolbar search={search} onSearch={v => { setSearch(v); setPage(1); }} statusFilter={statusFilter} onStatusFilter={v => { setStatusFilter(v); setPage(1); }} onAdd={openAdd} onBulkImport={() => setBulkOpen(true)} onRefresh={load} loading={loading} addLabel="+ Add Account" />
      <div className="card bg-base-100 shadow">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className={thCls} onClick={() => toggleSort("name")}>Account Name <SortIcon field="name" sort={sort} /></th>
                  <th className={thCls} onClick={() => toggleSort("accountNumber")}>Account Number <SortIcon field="accountNumber" sort={sort} /></th>
                  <th className={thCls} onClick={() => toggleSort("accountType")}>Type <SortIcon field="accountType" sort={sort} /></th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <SkeletonRows cols={5} /> : paged.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-base-content/50 text-sm">No QB accounts found.</td></tr>
                ) : paged.map((item, i) => (
                  <tr key={item.id || i} className="hover">
                    <td className="font-medium">{item.name}</td>
                    <td className="text-sm font-mono">{item.accountNumber || "—"}</td>
                    <td className="text-sm">{item.accountType || "—"}</td>
                    <td><span className={`badge badge-sm ${item.status === "active" ? "badge-success" : "badge-ghost"}`}>{item.status}</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-xs btn-outline" onClick={() => openEdit(item)}>Edit</button>
                        <button className={`btn btn-xs ${item.status === "active" ? "btn-warning" : "btn-success"} btn-outline`} disabled={busy} onClick={() => handleToggleStatus(item)}>
                          {item.status === "active" ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </div>
      </div>

      <EditModal isOpen={isModalOpen} title={editing ? "Edit QB Account" : "New QB Account"} onClose={closeModal} onSave={handleSave} busy={busy}>
        <FormField label="Account Name" required>
          <input className="input input-bordered w-full" value={fName} onChange={e => setFName(e.target.value)} required placeholder="e.g. General Checking" />
        </FormField>
        <FormField label="Account Number">
          <input className="input input-bordered w-full" value={fAccountNumber} onChange={e => setFAccountNumber(e.target.value)} placeholder="Account number (optional)" />
        </FormField>
        <FormField label="Account Type">
          <select className="select select-bordered w-full" value={fAccountType} onChange={e => setFAccountType(e.target.value)}>
            {QB_ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="Status">
          <select className="select select-bordered w-full" value={fStatus} onChange={e => setFStatus(e.target.value as "active" | "inactive")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FormField>
      </EditModal>

      <BulkImportModal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} onImport={handleBulkImport} title="Bulk Import QB Accounts"
        templateHeaders={["accountName", "accountNumber", "accountType", "status"]}
        templateExampleRows={[{ accountName: "General Checking", accountNumber: "", accountType: "Checking", status: "active" }]}
        requiredFields={["accountName"]} />
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  REQUESTOR: "Requestor",
  FINANCE_PAYOR: "Finance Payor",
  FINANCE_NOTIFY: "Finance Notify",
  FINANCE_RECEIPTS_REVIEWER: "Receipts Reviewer",
  FINANCE_QB_ENTRY: "QB Entry",
};

const USER_ROLES = [
  "ADMIN",
  "REQUESTOR",
  "FINANCE_PAYOR",
  "FINANCE_NOTIFY",
  "FINANCE_RECEIPTS_REVIEWER",
  "FINANCE_QB_ENTRY",
];

function UsersTab({
  orgId,
  addToast,
}: {
  orgId: string;
  addToast: (type: Toast["type"], msg: string) => void;
}) {
  const [items, setItems] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // form state
  const [fName, setFName] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fRole, setFRole] = useState("ADMIN");
  const [fMinistryDept, setFMinistryDept] = useState("");
  const [fActive, setFActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.adminListUsers({ orgId });
      setItems(res?.users || res || []);
    } catch {
      addToast("error", "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [orgId, addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(u => {
    const matchSearch = !search ||
      (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter ||
      (statusFilter === "active" ? u.active === true : u.active === false);
    return matchSearch && matchStatus;
  });

  // Default sort by name asc
  const [sort, setSort] = useState<SortState>({ field: "name", dir: "asc" });
  const [page, setPage] = useState(1);

  const toggleSort = (field: string) => {
    setSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    );
    setPage(1);
  };

  const sorted = [...filtered].sort((a, b) => {
    const av = (a as any)[sort.field] ?? "";
    const bv = (b as any)[sort.field] ?? "";
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openAdd = () => {
    setEditing(null);
    setFName("");
    setFEmail("");
    setFRole("ADMIN");
    setFMinistryDept("");
    setFActive(true);
    setIsModalOpen(true);
  };

  const openEdit = (item: AppUser) => {
    setEditing(item);
    setFName(item.name);
    setFEmail(item.email);
    setFRole(item.role || "ADMIN");
    setFMinistryDept(item.ministryDepartment || "");
    setFActive(item.active !== false);
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!fName.trim()) { addToast("error", "Name is required."); return; }
    if (!fEmail.trim()) { addToast("error", "Email is required."); return; }
    if (!fRole.trim()) { addToast("error", "Role is required."); return; }
    setBusy(true);
    try {
      if (editing) {
        await api.adminUpdateUser({
          orgId,
          userId: editing.userId,
          name: fName,
          role: fRole,
          ministryDepartment: fMinistryDept,
          active: fActive,
        });
        addToast("success", `User "${fName}" updated.`);
      } else {
        await api.adminCreateUser({
          orgId,
          name: fName,
          email: fEmail,
          role: fRole,
          ministryDepartment: fMinistryDept,
        });
        addToast("success", `User created. A welcome email has been sent to ${fEmail}.`);
      }
      closeModal();
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  const handleSetStatus = async (user: AppUser, active: boolean) => {
    setBusy(true);
    try {
      await api.adminSetUserStatus({ orgId, userId: user.userId, active });
      addToast("success", `User ${active ? "reactivated" : "deactivated"}.`);
      await load();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setBusy(false);
    }
  };

  const handleResendWelcome = async (user: AppUser) => {
    setBusy(true);
    try {
      await api.adminResendWelcomeEmail({ orgId, userId: user.userId });
      addToast("success", `Welcome email resent to ${user.email}.`);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to resend welcome email.");
    } finally {
      setBusy(false);
    }
  };

  const handleBulkImport = async (rows: Record<string, string>[]): Promise<BulkImportResult> => {
    const res: any = await api.adminBulkImportUsers({ orgId, rows });
    await load();
    return res;
  };

  const thCls = "cursor-pointer select-none hover:bg-base-200";

  return (
    <div>
      <TableToolbar
        search={search}
        onSearch={v => { setSearch(v); setPage(1); }}
        statusFilter={statusFilter}
        onStatusFilter={v => { setStatusFilter(v); setPage(1); }}
        onAdd={openAdd}
        onBulkImport={() => setBulkOpen(true)}
        onRefresh={load}
        loading={loading}
        addLabel="+ Add User"
      />

      <div className="card bg-base-100 shadow">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className={thCls} onClick={() => toggleSort("name")}>
                    Name <SortIcon field="name" sort={sort} />
                  </th>
                  <th className={thCls} onClick={() => toggleSort("email")}>
                    Email <SortIcon field="email" sort={sort} />
                  </th>
                  <th className={thCls} onClick={() => toggleSort("role")}>
                    Role <SortIcon field="role" sort={sort} />
                  </th>
                  <th className={thCls} onClick={() => toggleSort("ministryDepartment")}>
                    Ministry Dept <SortIcon field="ministryDepartment" sort={sort} />
                  </th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={6} />
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-base-content/50 text-sm">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  paged.map((user, i) => (
                    <tr key={user.userId || i} className="hover">
                      <td className="font-medium">{user.name}</td>
                      <td className="text-sm">{user.email}</td>
                      <td className="text-sm">{ROLE_LABELS[user.role] || user.role || "—"}</td>
                      <td className="text-sm">{user.ministryDepartment || "—"}</td>
                      <td><ActiveBadge active={user.active !== false} /></td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          <button className="btn btn-xs btn-outline" onClick={() => openEdit(user)}>Edit</button>
                          <button
                            className="btn btn-xs btn-secondary btn-outline"
                            disabled={busy}
                            onClick={() => handleResendWelcome(user)}
                          >
                            Resend Welcome
                          </button>
                          <button
                            className={`btn btn-xs ${user.active !== false ? "btn-warning" : "btn-success"} btn-outline`}
                            disabled={busy}
                            onClick={() => handleSetStatus(user, user.active === false)}
                          >
                            {user.active !== false ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={safePage} totalPages={totalPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
        </div>
      </div>

      <EditModal
        isOpen={isModalOpen}
        title={editing ? "Edit User" : "New User"}
        onClose={closeModal}
        onSave={handleSave}
        busy={busy}
      >
        <FormField label="Name" required>
          <input className="input input-bordered w-full" value={fName} onChange={e => setFName(e.target.value)} required placeholder="Full name" />
        </FormField>
        <FormField label="Email" required>
          <input
            type="email"
            className="input input-bordered w-full"
            value={fEmail}
            onChange={e => setFEmail(e.target.value)}
            required
            placeholder="user@church.org"
            readOnly={!!editing}
            disabled={!!editing}
          />
        </FormField>
        <FormField label="Role" required>
          <select className="select select-bordered w-full" value={fRole} onChange={e => setFRole(e.target.value)}>
            {USER_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
          </select>
        </FormField>
        <FormField label="Ministry Department">
          <input className="input input-bordered w-full" value={fMinistryDept} onChange={e => setFMinistryDept(e.target.value)} placeholder="e.g. Youth Ministry" />
        </FormField>
        {editing && (
          <FormField label="Active">
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" className="checkbox checkbox-primary" checked={fActive} onChange={e => setFActive(e.target.checked)} />
              <span className="label-text">{fActive ? "Active" : "Inactive"}</span>
            </label>
          </FormField>
        )}
      </EditModal>

      <BulkImportModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImport={handleBulkImport}
        title="Bulk Import Users"
        templateHeaders={["name", "email", "role", "ministryDepartment", "active"]}
        templateExampleRows={[
          { name: "James Wilson", email: "james@citylightmn.com", role: "REQUESTOR", ministryDepartment: "Worship", active: "true" },
          { name: "Sarah Lee", email: "sarah@citylightmn.com", role: "ADMIN", ministryDepartment: "", active: "true" },
        ]}
        requiredFields={["name", "email", "role"]}
      />
    </div>
  );
}

// ─── Main AdminPage ───────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: "departments", label: "Departments" },
  { id: "categories", label: "Categories" },
  { id: "vendors", label: "Vendors" },
  { id: "vendorRequests", label: "Vendor Requests" },
  { id: "categoryBudgets", label: "Category Budgets" },
  { id: "workflowSettings", label: "Workflow Settings" },
  { id: "escalationRules", label: "Escalation Rules" },
  { id: "qbAccounts", label: "QB Payment Accounts" },
  { id: "users", label: "Users" },
];

export default function AdminPage() {
  const navigate = useNavigate();
  const { activeOrgId, activeOrgName, isAdmin } = useUserContext();
  const { toasts, addToast } = useToasts();

  useEffect(() => {
    if (!isAdmin) navigate("/");
  }, [isAdmin, navigate]);

  const [tab, setTab] = useState<TabId>("departments");

  if (!isAdmin) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <ToastArea toasts={toasts} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Setup</h1>
        <p className="text-sm text-base-content/60 mt-1">{activeOrgName}</p>
      </div>

      {/* Tab navigation — scrollable on small screens */}
      <div className="overflow-x-auto mb-6">
        <div className="tabs tabs-boxed flex-nowrap inline-flex min-w-max">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab whitespace-nowrap ${tab === t.id ? "tab-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "departments" && <DepartmentsTab orgId={activeOrgId} addToast={addToast} />}
      {tab === "categories" && <CategoriesTab orgId={activeOrgId} addToast={addToast} />}
      {tab === "vendors" && <VendorsTab orgId={activeOrgId} addToast={addToast} />}
      {tab === "vendorRequests" && <VendorRequestsTab orgId={activeOrgId} addToast={addToast} />}
      {tab === "categoryBudgets" && <CategoryBudgetsTab orgId={activeOrgId} addToast={addToast} />}
      {tab === "workflowSettings" && <WorkflowSettingsTab orgId={activeOrgId} addToast={addToast} />}
      {tab === "escalationRules" && <EscalationRulesTab orgId={activeOrgId} addToast={addToast} />}
      {tab === "qbAccounts" && <QBAccountsTab orgId={activeOrgId} addToast={addToast} />}
      {tab === "users" && <UsersTab orgId={activeOrgId} addToast={addToast} />}
    </div>
  );
}
