import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../contexts/UserContext";
import { api } from "../workflow/api";
import BulkImportModal from "../components/admin/BulkImportModal";
// ─── helpers ────────────────────────────────────────────────────────────────
const fmtDate = (val) => {
    if (!val)
        return "—";
    if (typeof val === "object" && val.seconds) {
        return new Date(val.seconds * 1000).toLocaleDateString("en-US");
    }
    try {
        return new Date(val).toLocaleDateString("en-US");
    }
    catch {
        return String(val);
    }
};
const fmtCurrency = (amount) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
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
let toastCounter = 0;
function useToasts() {
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((type, message) => {
        const id = ++toastCounter;
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);
    return { toasts, addToast };
}
// ─── Reusable sub-components ─────────────────────────────────────────────────
function ToastArea({ toasts }) {
    if (toasts.length === 0)
        return null;
    return (_jsx("div", { className: "toast toast-top toast-end z-50", children: toasts.map(t => (_jsx("div", { className: `alert ${t.type === "success" ? "alert-success" : "alert-error"} shadow-lg`, children: _jsx("span", { className: "text-sm", children: t.message }) }, t.id))) }));
}
function ActiveBadge({ active }) {
    const cls = active ? "badge-success" : "badge-ghost";
    return _jsx("span", { className: `badge badge-sm ${cls}`, children: active ? "Active" : "Inactive" });
}
function SortIcon({ field, sort }) {
    if (sort.field !== field)
        return _jsx("span", { className: "ml-1 text-base-content/30", children: "\u2195" });
    return _jsx("span", { className: "ml-1", children: sort.dir === "asc" ? "↑" : "↓" });
}
function SkeletonRows({ cols }) {
    return (_jsx(_Fragment, { children: [1, 2, 3].map(i => (_jsx("tr", { children: Array.from({ length: cols }).map((_, j) => (_jsx("td", { children: _jsx("div", { className: "skeleton h-4 w-full" }) }, j))) }, i))) }));
}
function Pagination({ page, totalPages, onPrev, onNext, }) {
    if (totalPages <= 1)
        return null;
    return (_jsxs("div", { className: "flex justify-between items-center px-4 py-2 border-t border-base-200", children: [_jsxs("span", { className: "text-xs text-base-content/60", children: ["Page ", page, " of ", totalPages] }), _jsxs("div", { className: "join", children: [_jsx("button", { className: "join-item btn btn-xs", disabled: page === 1, onClick: onPrev, children: "\u00AB" }), _jsx("button", { className: "join-item btn btn-xs", disabled: page === totalPages, onClick: onNext, children: "\u00BB" })] })] }));
}
function TableToolbar({ search, onSearch, statusFilter, onStatusFilter, onAdd, onBulkImport, onRefresh, loading, addLabel, }) {
    return (_jsxs("div", { className: "flex flex-wrap gap-2 mb-4 items-center", children: [_jsx("input", { type: "text", className: "input input-bordered input-sm w-48", placeholder: "Search...", value: search, onChange: e => onSearch(e.target.value) }), _jsxs("select", { className: "select select-bordered select-sm", value: statusFilter, onChange: e => onStatusFilter(e.target.value), children: [_jsx("option", { value: "", children: "All" }), _jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "inactive", children: "Inactive" })] }), _jsx("div", { className: "flex-1" }), _jsx("button", { className: "btn btn-ghost btn-sm", onClick: onRefresh, disabled: loading, title: "Refresh", children: loading ? _jsx("span", { className: "loading loading-spinner loading-xs" }) : "↻" }), _jsx("button", { className: "btn btn-outline btn-sm", onClick: onBulkImport, children: "Bulk Import" }), _jsx("button", { className: "btn btn-primary btn-sm", onClick: onAdd, children: addLabel ?? "+ Add New" })] }));
}
// ─── Modal wrapper ────────────────────────────────────────────────────────────
function EditModal({ isOpen, title, onClose, onSave, busy, children, }) {
    if (!isOpen)
        return null;
    return (_jsxs("dialog", { className: "modal modal-open", children: [_jsxs("div", { className: "modal-box w-11/12 max-w-lg", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "font-bold text-lg", children: title }), _jsx("button", { className: "btn btn-sm btn-circle btn-ghost", onClick: onClose, children: "\u2715" })] }), _jsxs("form", { onSubmit: onSave, className: "space-y-4", children: [children, _jsxs("div", { className: "modal-action mt-2", children: [_jsx("button", { type: "button", className: "btn btn-ghost", onClick: onClose, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: busy, children: busy ? _jsx("span", { className: "loading loading-spinner loading-sm" }) : "Save" })] })] })] }), _jsx("div", { className: "modal-backdrop", onClick: onClose })] }));
}
function FormField({ label, required, children, }) {
    return (_jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsxs("span", { className: "label-text font-semibold", children: [label, required && _jsx("span", { className: "text-error ml-1", children: "*" })] }) }), children] }));
}
// ─── useSortPaginate ──────────────────────────────────────────────────────────
const PAGE_SIZE = 10;
function useSortPaginate(items) {
    const [sort, setSort] = useState({ field: "", dir: "asc" });
    const [page, setPage] = useState(1);
    const toggleSort = (field) => {
        setSort(prev => prev.field === field
            ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
            : { field, dir: "asc" });
        setPage(1);
    };
    const sorted = [...items].sort((a, b) => {
        if (!sort.field)
            return 0;
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
function DepartmentsTab({ orgId, addToast, }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [editing, setEditing] = useState(null);
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
            const res = await api.adminListDepartments({ orgId });
            setItems(res?.departments || res || []);
        }
        catch {
            addToast("error", "Failed to load departments.");
        }
        finally {
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
    const openEdit = (item) => {
        setEditing(item);
        setFMinistryDept(item.ministryDepartment);
        setFApproverEmail(item.approverEmail);
        setFApproverName(item.approverName || "");
        setFActive(item.active !== false);
        setIsModalOpen(true);
    };
    const closeModal = () => { setIsModalOpen(false); setEditing(null); };
    const handleSave = async (e) => {
        e.preventDefault();
        if (!fMinistryDept.trim()) {
            addToast("error", "Ministry department name is required.");
            return;
        }
        if (!fApproverEmail.trim()) {
            addToast("error", "Approver email is required.");
            return;
        }
        setBusy(true);
        try {
            await api.adminUpsertDepartment({
                orgId,
                dept: {
                    id: editing?.id,
                    ministryDepartment: fMinistryDept,
                    approverEmail: fApproverEmail,
                    approverName: fApproverName,
                    approverId: editing?.approverId || "",
                    active: fActive,
                },
            });
            addToast("success", `Department "${fMinistryDept}" saved.`);
            closeModal();
            await load();
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to save.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleToggleActive = async (item) => {
        const nextActive = item.active === false ? true : false;
        const fn = nextActive ? api.adminReactivateDepartment : api.adminDeactivateDepartment;
        setBusy(true);
        try {
            await fn({ orgId, departmentId: item.id });
            addToast("success", `Department ${nextActive ? "reactivated" : "deactivated"}.`);
            await load();
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to update status.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleBulkImport = async (rows) => {
        const res = await api.adminBulkImportDepartments({ orgId, rows });
        await load();
        return res;
    };
    const thCls = "cursor-pointer select-none hover:bg-base-200";
    return (_jsxs("div", { children: [_jsx(TableToolbar, { search: search, onSearch: v => { setSearch(v); setPage(1); }, statusFilter: statusFilter, onStatusFilter: v => { setStatusFilter(v); setPage(1); }, onAdd: openAdd, onBulkImport: () => setBulkOpen(true), onRefresh: load, loading: loading, addLabel: "+ Add Department" }), _jsx("div", { className: "card bg-base-100 shadow", children: _jsxs("div", { className: "card-body p-0", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "table table-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsxs("th", { className: thCls, onClick: () => toggleSort("ministryDepartment"), children: ["Ministry Department ", _jsx(SortIcon, { field: "ministryDepartment", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("approverEmail"), children: ["Approver Email ", _jsx(SortIcon, { field: "approverEmail", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("approverName"), children: ["Approver Name ", _jsx(SortIcon, { field: "approverName", sort: sort })] }), _jsx("th", { children: "Active" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: loading ? (_jsx(SkeletonRows, { cols: 5 })) : paged.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "text-center py-8 text-base-content/50 text-sm", children: "No departments found." }) })) : (paged.map((item, i) => (_jsxs("tr", { className: "hover", children: [_jsx("td", { className: "font-medium", children: item.ministryDepartment }), _jsx("td", { className: "text-sm", children: item.approverEmail }), _jsx("td", { className: "text-sm", children: item.approverName || "—" }), _jsx("td", { children: _jsx(ActiveBadge, { active: item.active !== false }) }), _jsx("td", { children: _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { className: "btn btn-xs btn-outline", onClick: () => openEdit(item), children: "Edit" }), _jsx("button", { className: `btn btn-xs ${item.active !== false ? "btn-warning" : "btn-success"} btn-outline`, disabled: busy, onClick: () => handleToggleActive(item), children: item.active !== false ? "Deactivate" : "Reactivate" })] }) })] }, item.id || i)))) })] }) }), _jsx(Pagination, { page: page, totalPages: totalPages, onPrev: () => setPage(p => p - 1), onNext: () => setPage(p => p + 1) })] }) }), _jsxs(EditModal, { isOpen: isModalOpen, title: editing ? "Edit Department" : "New Department", onClose: closeModal, onSave: handleSave, busy: busy, children: [_jsx(FormField, { label: "Ministry Department", required: true, children: _jsx("input", { className: "input input-bordered w-full", value: fMinistryDept, onChange: e => setFMinistryDept(e.target.value), required: true, placeholder: "e.g. Youth Ministry" }) }), _jsx(FormField, { label: "Approver Email", required: true, children: _jsx("input", { type: "email", className: "input input-bordered w-full", value: fApproverEmail, onChange: e => setFApproverEmail(e.target.value), required: true, placeholder: "approver@church.org" }) }), _jsx(FormField, { label: "Approver Name", children: _jsx("input", { className: "input input-bordered w-full", value: fApproverName, onChange: e => setFApproverName(e.target.value), placeholder: "Full name" }) }), _jsx(FormField, { label: "Active", children: _jsxs("label", { className: "flex items-center gap-2 cursor-pointer mt-1", children: [_jsx("input", { type: "checkbox", className: "checkbox checkbox-primary", checked: fActive, onChange: e => setFActive(e.target.checked) }), _jsx("span", { className: "label-text", children: fActive ? "Active" : "Inactive" })] }) })] }), _jsx(BulkImportModal, { isOpen: bulkOpen, onClose: () => setBulkOpen(false), onImport: handleBulkImport, title: "Bulk Import Departments", templateHeaders: ["ministryDepartment", "approverEmail", "approverName", "active"], templateExampleRows: [{ ministryDepartment: "Youth Ministry", approverEmail: "james@citylightmn.com", approverName: "James Wilson", active: "true" }], requiredFields: ["ministryDepartment", "approverEmail"] })] }));
}
// ─── Categories Tab ───────────────────────────────────────────────────────────
function CategoriesTab({ orgId, addToast, }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [editing, setEditing] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [fCategoryId, setFCategoryId] = useState("");
    const [fCategoryName, setFCategoryName] = useState("");
    const [fActive, setFActive] = useState(true);
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.adminListCategories({ orgId });
            setItems(res?.categories || res || []);
        }
        catch {
            addToast("error", "Failed to load categories.");
        }
        finally {
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
    const openEdit = (item) => {
        setEditing(item);
        setFCategoryId(item.categoryId || "");
        setFCategoryName(item.categoryName);
        setFActive(item.active !== false);
        setIsModalOpen(true);
    };
    const closeModal = () => { setIsModalOpen(false); setEditing(null); };
    const handleSave = async (e) => {
        e.preventDefault();
        if (!fCategoryName.trim()) {
            addToast("error", "Category name is required.");
            return;
        }
        if (!editing && !fCategoryId.trim()) {
            addToast("error", "Category ID is required.");
            return;
        }
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
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to save.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleToggleActive = async (item) => {
        const nextActive = item.active === false ? true : false;
        setBusy(true);
        try {
            await api.adminSetCategoryStatus({ orgId, categoryId: item.id, active: nextActive });
            addToast("success", `Category ${nextActive ? "reactivated" : "deactivated"}.`);
            await load();
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to update status.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleBulkImport = async (rows) => {
        const res = await api.adminBulkImportCategories({ orgId, rows });
        await load();
        return res;
    };
    const thCls = "cursor-pointer select-none hover:bg-base-200";
    return (_jsxs("div", { children: [_jsx(TableToolbar, { search: search, onSearch: v => { setSearch(v); setPage(1); }, statusFilter: statusFilter, onStatusFilter: v => { setStatusFilter(v); setPage(1); }, onAdd: openAdd, onBulkImport: () => setBulkOpen(true), onRefresh: load, loading: loading, addLabel: "+ Add Category" }), _jsx("div", { className: "card bg-base-100 shadow", children: _jsxs("div", { className: "card-body p-0", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "table table-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsxs("th", { className: thCls, onClick: () => toggleSort("categoryId"), children: ["Category ID ", _jsx(SortIcon, { field: "categoryId", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("categoryName"), children: ["Category Name ", _jsx(SortIcon, { field: "categoryName", sort: sort })] }), _jsx("th", { children: "Active" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: loading ? _jsx(SkeletonRows, { cols: 4 }) : paged.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "text-center py-8 text-base-content/50 text-sm", children: "No categories found." }) })) : paged.map((item, i) => (_jsxs("tr", { className: "hover", children: [_jsx("td", { className: "text-sm font-mono", children: item.categoryId || "—" }), _jsx("td", { className: "font-medium", children: item.categoryName }), _jsx("td", { children: _jsx(ActiveBadge, { active: item.active !== false }) }), _jsx("td", { children: _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { className: "btn btn-xs btn-outline", onClick: () => openEdit(item), children: "Edit" }), _jsx("button", { className: `btn btn-xs ${item.active !== false ? "btn-warning" : "btn-success"} btn-outline`, disabled: busy, onClick: () => handleToggleActive(item), children: item.active !== false ? "Deactivate" : "Reactivate" })] }) })] }, item.id || i))) })] }) }), _jsx(Pagination, { page: page, totalPages: totalPages, onPrev: () => setPage(p => p - 1), onNext: () => setPage(p => p + 1) })] }) }), _jsxs(EditModal, { isOpen: isModalOpen, title: editing ? "Edit Category" : "New Category", onClose: closeModal, onSave: handleSave, busy: busy, children: [_jsx(FormField, { label: "Category ID", required: true, children: _jsx("input", { className: "input input-bordered w-full", value: fCategoryId, onChange: e => setFCategoryId(e.target.value), required: !editing, placeholder: "e.g. CAT-001" }) }), _jsx(FormField, { label: "Category Name", required: true, children: _jsx("input", { className: "input input-bordered w-full", value: fCategoryName, onChange: e => setFCategoryName(e.target.value), required: true, placeholder: "e.g. Food & Beverages" }) }), _jsx(FormField, { label: "Active", children: _jsxs("label", { className: "flex items-center gap-2 cursor-pointer mt-1", children: [_jsx("input", { type: "checkbox", className: "checkbox checkbox-primary", checked: fActive, onChange: e => setFActive(e.target.checked) }), _jsx("span", { className: "label-text", children: fActive ? "Active" : "Inactive" })] }) })] }), _jsx(BulkImportModal, { isOpen: bulkOpen, onClose: () => setBulkOpen(false), onImport: handleBulkImport, title: "Bulk Import Categories", templateHeaders: ["categoryId", "categoryName", "active"], templateExampleRows: [{ categoryId: "CAT-001", categoryName: "Food & Beverages", active: "true" }], requiredFields: ["categoryId", "categoryName"] })] }));
}
// ─── Vendors Tab ──────────────────────────────────────────────────────────────
function VendorsTab({ orgId, addToast, }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [editing, setEditing] = useState(null);
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
            const res = await api.adminListVendors({ orgId });
            setItems(res?.vendors || res || []);
        }
        catch {
            addToast("error", "Failed to load vendors.");
        }
        finally {
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
    const openEdit = (item) => {
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
    const handleSave = async (e) => {
        e.preventDefault();
        if (!fVendorName.trim()) {
            addToast("error", "Vendor name is required.");
            return;
        }
        if (!editing && !fVendorId.trim()) {
            addToast("error", "Vendor ID is required.");
            return;
        }
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
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to save.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleToggleActive = async (item) => {
        const nextActive = item.active === false ? true : false;
        setBusy(true);
        try {
            await api.adminSetVendorStatus({ orgId, vendorId: item.id, active: nextActive });
            addToast("success", `Vendor ${nextActive ? "reactivated" : "deactivated"}.`);
            await load();
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to update status.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleBulkImport = async (rows) => {
        const res = await api.adminBulkImportVendors({ orgId, rows });
        await load();
        return res;
    };
    const thCls = "cursor-pointer select-none hover:bg-base-200";
    const showLlcTreatment = fW9TaxClassification.toLowerCase().includes("llc");
    return (_jsxs("div", { children: [_jsx(TableToolbar, { search: search, onSearch: v => { setSearch(v); setPage(1); }, statusFilter: statusFilter, onStatusFilter: v => { setStatusFilter(v); setPage(1); }, onAdd: openAdd, onBulkImport: () => setBulkOpen(true), onRefresh: load, loading: loading, addLabel: "+ Add Vendor" }), _jsx("div", { className: "card bg-base-100 shadow", children: _jsxs("div", { className: "card-body p-0", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "table table-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsxs("th", { className: thCls, onClick: () => toggleSort("vendorId"), children: ["Vendor ID ", _jsx(SortIcon, { field: "vendorId", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("vendorName"), children: ["Vendor Name ", _jsx(SortIcon, { field: "vendorName", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("vendorEmail"), children: ["Email ", _jsx(SortIcon, { field: "vendorEmail", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("vendorType"), children: ["Type ", _jsx(SortIcon, { field: "vendorType", sort: sort })] }), _jsx("th", { children: "W9" }), _jsx("th", { children: "1099" }), _jsx("th", { children: "Active" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: loading ? _jsx(SkeletonRows, { cols: 8 }) : paged.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "text-center py-8 text-base-content/50 text-sm", children: "No vendors found." }) })) : paged.map((item, i) => (_jsxs("tr", { className: "hover", children: [_jsx("td", { className: "text-sm font-mono", children: item.vendorId || "—" }), _jsx("td", { className: "font-medium", children: item.vendorName }), _jsx("td", { className: "text-sm", children: item.vendorEmail || "—" }), _jsx("td", { className: "text-sm", children: item.vendorType || "—" }), _jsx("td", { className: "text-sm", children: item.w9OnFile ? "Yes" : "No" }), _jsx("td", { className: "text-sm", children: item.is1099Required ? "Yes" : "No" }), _jsx("td", { children: _jsx(ActiveBadge, { active: item.active !== false }) }), _jsx("td", { children: _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { className: "btn btn-xs btn-outline", onClick: () => openEdit(item), children: "Edit" }), _jsx("button", { className: `btn btn-xs ${item.active !== false ? "btn-warning" : "btn-success"} btn-outline`, disabled: busy, onClick: () => handleToggleActive(item), children: item.active !== false ? "Deactivate" : "Reactivate" })] }) })] }, item.id || i))) })] }) }), _jsx(Pagination, { page: page, totalPages: totalPages, onPrev: () => setPage(p => p - 1), onNext: () => setPage(p => p + 1) })] }) }), _jsxs(EditModal, { isOpen: isModalOpen, title: editing ? "Edit Vendor" : "New Vendor", onClose: closeModal, onSave: handleSave, busy: busy, children: [_jsx(FormField, { label: "Vendor ID", required: true, children: _jsx("input", { className: "input input-bordered w-full", value: fVendorId, onChange: e => setFVendorId(e.target.value), required: !editing, placeholder: "e.g. VND-001" }) }), _jsx(FormField, { label: "Vendor Name", required: true, children: _jsx("input", { className: "input input-bordered w-full", value: fVendorName, onChange: e => setFVendorName(e.target.value), required: true, placeholder: "e.g. Amazon Business" }) }), _jsx(FormField, { label: "Email", children: _jsx("input", { type: "email", className: "input input-bordered w-full", value: fVendorEmail, onChange: e => setFVendorEmail(e.target.value), placeholder: "vendor@example.com" }) }), _jsx(FormField, { label: "Vendor Type", children: _jsx("select", { className: "select select-bordered w-full", value: fVendorType, onChange: e => setFVendorType(e.target.value), children: VENDOR_TYPES.map(t => _jsx("option", { value: t, children: t }, t)) }) }), _jsx(FormField, { label: "W9 Tax Classification", children: _jsxs("select", { className: "select select-bordered w-full", value: fW9TaxClassification, onChange: e => setFW9TaxClassification(e.target.value), children: [_jsx("option", { value: "", children: "Select classification\u2026" }), W9_TAX_CLASSIFICATIONS.map(t => _jsx("option", { value: t, children: t }, t))] }) }), showLlcTreatment && (_jsx(FormField, { label: "LLC Tax Treatment (S / C / P)", children: _jsx("input", { className: "input input-bordered w-full", value: fLlcTaxTreatment, onChange: e => setFLlcTaxTreatment(e.target.value), placeholder: "S, C, or P" }) })), _jsx(FormField, { label: "W9 On File", children: _jsxs("label", { className: "flex items-center gap-2 cursor-pointer mt-1", children: [_jsx("input", { type: "checkbox", className: "checkbox checkbox-primary", checked: fW9OnFile, onChange: e => setFW9OnFile(e.target.checked) }), _jsx("span", { className: "label-text", children: "W9 on file" })] }) }), _jsx(FormField, { label: "1099 Required", children: _jsxs("label", { className: "flex items-center gap-2 cursor-pointer mt-1", children: [_jsx("input", { type: "checkbox", className: "checkbox checkbox-primary", checked: fIs1099Required, onChange: e => setFIs1099Required(e.target.checked) }), _jsx("span", { className: "label-text", children: "1099 required" })] }) }), _jsx(FormField, { label: "Active", children: _jsxs("label", { className: "flex items-center gap-2 cursor-pointer mt-1", children: [_jsx("input", { type: "checkbox", className: "checkbox checkbox-primary", checked: fActive, onChange: e => setFActive(e.target.checked) }), _jsx("span", { className: "label-text", children: fActive ? "Active" : "Inactive" })] }) })] }), _jsx(BulkImportModal, { isOpen: bulkOpen, onClose: () => setBulkOpen(false), onImport: handleBulkImport, title: "Bulk Import Vendors", templateHeaders: ["vendorId", "vendorName", "vendorEmail", "vendorType", "w9OnFile", "w9TaxClassification", "llcTaxTreatment", "is1099Required", "active"], templateExampleRows: [{ vendorId: "VND-001", vendorName: "Amazon Business", vendorEmail: "business@amazon.com", vendorType: "Business", w9OnFile: "false", w9TaxClassification: "C Corporation", llcTaxTreatment: "", is1099Required: "false", active: "true" }], requiredFields: ["vendorName"] })] }));
}
// ─── Vendor Requests Tab ──────────────────────────────────────────────────────
function VendorRequestsTab({ orgId, addToast, }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.getPendingVendorSetupRequests({ orgId });
            setItems(res?.requests || res || []);
        }
        catch {
            addToast("error", "Failed to load vendor requests.");
        }
        finally {
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
    const handleApprove = async (req) => {
        setBusy(true);
        try {
            await api.approveVendorSetup({ orgId, vendorSetupId: req.id });
            addToast("success", `Vendor "${req.vendorName}" approved.`);
            await load();
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to approve.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleReject = async (req) => {
        const reason = prompt("Rejection reason:");
        if (!reason)
            return;
        setBusy(true);
        try {
            await api.rejectVendorSetup({ orgId, vendorSetupId: req.id, reason });
            addToast("success", "Vendor request rejected.");
            await load();
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to reject.");
        }
        finally {
            setBusy(false);
        }
    };
    const thCls = "cursor-pointer select-none hover:bg-base-200";
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex flex-wrap gap-2 mb-4 items-center", children: [_jsx("input", { type: "text", className: "input input-bordered input-sm w-48", placeholder: "Search...", value: search, onChange: e => { setSearch(e.target.value); setPage(1); } }), _jsxs("select", { className: "select select-bordered select-sm", value: statusFilter, onChange: e => { setStatusFilter(e.target.value); setPage(1); }, children: [_jsx("option", { value: "", children: "All Statuses" }), _jsx("option", { value: "PENDING", children: "Pending" }), _jsx("option", { value: "APPROVED", children: "Approved" }), _jsx("option", { value: "REJECTED", children: "Rejected" })] }), _jsx("div", { className: "flex-1" }), _jsx("button", { className: "btn btn-ghost btn-sm", onClick: load, disabled: loading, title: "Refresh", children: loading ? _jsx("span", { className: "loading loading-spinner loading-xs" }) : "↻" })] }), _jsx("div", { className: "card bg-base-100 shadow", children: _jsxs("div", { className: "card-body p-0", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "table table-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsxs("th", { className: thCls, onClick: () => toggleSort("vendorName"), children: ["Vendor Name ", _jsx(SortIcon, { field: "vendorName", sort: sort })] }), _jsx("th", { children: "Email" }), _jsx("th", { children: "Contact" }), _jsx("th", { children: "Requestor" }), _jsxs("th", { className: thCls, onClick: () => toggleSort("status"), children: ["Status ", _jsx(SortIcon, { field: "status", sort: sort })] }), _jsx("th", { children: "Date" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: loading ? _jsx(SkeletonRows, { cols: 7 }) : paged.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "text-center py-8 text-base-content/50 text-sm", children: "No vendor requests found." }) })) : paged.map((req, i) => (_jsxs("tr", { className: "hover", children: [_jsx("td", { className: "font-medium", children: req.vendorName }), _jsx("td", { className: "text-sm", children: req.vendorEmail || "—" }), _jsx("td", { className: "text-sm", children: req.contactName || "—" }), _jsx("td", { className: "text-sm text-base-content/70", children: req.requestorEmail || "—" }), _jsx("td", { children: _jsx("span", { className: `badge badge-sm ${req.status === "PENDING" ? "badge-warning" : req.status === "APPROVED" ? "badge-success" : "badge-error"}`, children: req.status }) }), _jsx("td", { className: "text-xs text-base-content/60", children: fmtDate(req.createdAt) }), _jsx("td", { children: req.status === "PENDING" && (_jsxs("div", { className: "flex gap-1", children: [_jsx("button", { className: "btn btn-xs btn-success", disabled: busy, onClick: () => handleApprove(req), children: "Approve" }), _jsx("button", { className: "btn btn-xs btn-error", disabled: busy, onClick: () => handleReject(req), children: "Reject" })] })) })] }, req.id || i))) })] }) }), _jsx(Pagination, { page: page, totalPages: totalPages, onPrev: () => setPage(p => p - 1), onNext: () => setPage(p => p + 1) })] }) })] }));
}
// ─── Category Budgets Tab ─────────────────────────────────────────────────────
function CategoryBudgetsTab({ orgId, addToast, }) {
    const currentYear = new Date().getFullYear();
    const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [yearFilter, setYearFilter] = useState(String(currentYear));
    const [editing, setEditing] = useState(null);
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
            const res = await api.adminListCategoryBudgets({ orgId });
            setItems(res?.budgets || res || []);
        }
        catch {
            addToast("error", "Failed to load category budgets.");
        }
        finally {
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
    const openEdit = (item) => {
        setEditing(item);
        setFMinistryDept(item.ministryDepartment || "");
        setFFundName(item.fundName || "");
        setFFundType(item.fundType || "Unrestricted");
        setFYear(item.year || currentYear);
        setFBudgetAmount(String(item.approvedAnnualBudget ?? ""));
        setIsModalOpen(true);
    };
    const closeModal = () => { setIsModalOpen(false); setEditing(null); };
    const handleSave = async (e) => {
        e.preventDefault();
        if (!fBudgetAmount || isNaN(Number(fBudgetAmount))) {
            addToast("error", "Valid budget amount is required.");
            return;
        }
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
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to save.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleBulkImport = async (rows) => {
        const res = await api.adminBulkImportCategoryBudgets({ orgId, rows });
        await load();
        return res;
    };
    const thCls = "cursor-pointer select-none hover:bg-base-200";
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex flex-wrap gap-2 mb-4 items-center", children: [_jsx("input", { type: "text", className: "input input-bordered input-sm w-48", placeholder: "Search...", value: search, onChange: e => { setSearch(e.target.value); setPage(1); } }), _jsxs("select", { className: "select select-bordered select-sm", value: yearFilter, onChange: e => { setYearFilter(e.target.value); setPage(1); }, children: [_jsx("option", { value: "", children: "All Years" }), yearOptions.map(y => _jsx("option", { value: String(y), children: y }, y))] }), _jsx("div", { className: "flex-1" }), _jsx("button", { className: "btn btn-ghost btn-sm", onClick: load, disabled: loading, title: "Refresh", children: loading ? _jsx("span", { className: "loading loading-spinner loading-xs" }) : "↻" }), _jsx("button", { className: "btn btn-outline btn-sm", onClick: () => setBulkOpen(true), children: "Bulk Import" }), _jsx("button", { className: "btn btn-primary btn-sm", onClick: openAdd, children: "+ Add Budget" })] }), _jsx("div", { className: "card bg-base-100 shadow", children: _jsxs("div", { className: "card-body p-0", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "table table-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsxs("th", { className: thCls, onClick: () => toggleSort("ministryDepartment"), children: ["Dept ", _jsx(SortIcon, { field: "ministryDepartment", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("fundName"), children: ["Fund Name ", _jsx(SortIcon, { field: "fundName", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("fundType"), children: ["Fund Type ", _jsx(SortIcon, { field: "fundType", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("year"), children: ["Year ", _jsx(SortIcon, { field: "year", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("approvedAnnualBudget"), children: ["Budget ", _jsx(SortIcon, { field: "approvedAnnualBudget", sort: sort })] }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: loading ? _jsx(SkeletonRows, { cols: 6 }) : paged.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "text-center py-8 text-base-content/50 text-sm", children: "No budgets found." }) })) : paged.map((item, i) => (_jsxs("tr", { className: "hover", children: [_jsx("td", { className: "font-medium", children: item.ministryDepartment || "—" }), _jsx("td", { className: "text-sm", children: item.fundName || "—" }), _jsx("td", { className: "text-sm", children: item.fundType || "—" }), _jsx("td", { children: item.year }), _jsx("td", { children: fmtCurrency(item.approvedAnnualBudget ?? 0) }), _jsx("td", { children: _jsx("div", { className: "flex gap-1", children: _jsx("button", { className: "btn btn-xs btn-outline", onClick: () => openEdit(item), children: "Edit" }) }) })] }, item.id || i))) })] }) }), _jsx(Pagination, { page: page, totalPages: totalPages, onPrev: () => setPage(p => p - 1), onNext: () => setPage(p => p + 1) })] }) }), _jsxs(EditModal, { isOpen: isModalOpen, title: editing ? "Edit Category Budget" : "New Category Budget", onClose: closeModal, onSave: handleSave, busy: busy, children: [_jsx(FormField, { label: "Ministry Department", required: true, children: _jsx("input", { className: "input input-bordered w-full", value: fMinistryDept, onChange: e => setFMinistryDept(e.target.value), required: true, placeholder: "e.g. Youth Ministry" }) }), _jsx(FormField, { label: "Fund Name", required: true, children: _jsx("input", { className: "input input-bordered w-full", value: fFundName, onChange: e => setFFundName(e.target.value), required: true, placeholder: "e.g. General Fund" }) }), _jsx(FormField, { label: "Fund Type", children: _jsx("select", { className: "select select-bordered w-full", value: fFundType, onChange: e => setFFundType(e.target.value), children: FUND_TYPES.map(t => _jsx("option", { value: t, children: t }, t)) }) }), _jsx(FormField, { label: "Year", required: true, children: _jsx("select", { className: "select select-bordered w-full", value: fYear, onChange: e => setFYear(Number(e.target.value)), children: yearOptions.map(y => _jsx("option", { value: y, children: y }, y)) }) }), _jsx(FormField, { label: "Approved Annual Budget ($)", required: true, children: _jsx("input", { type: "number", step: "0.01", min: "0", className: "input input-bordered w-full", value: fBudgetAmount, onChange: e => setFBudgetAmount(e.target.value), required: true, placeholder: "5000.00" }) })] }), _jsx(BulkImportModal, { isOpen: bulkOpen, onClose: () => setBulkOpen(false), onImport: handleBulkImport, title: "Bulk Import Category Budgets", templateHeaders: ["organizationId", "year", "ministryDepartment", "fundName", "fundType", "approvedAnnualBudget"], templateExampleRows: [{ organizationId: "org_citylight", year: "2026", ministryDepartment: "Youth Ministry", fundName: "General Fund", fundType: "Unrestricted", approvedAnnualBudget: "5000" }], requiredFields: ["ministryDepartment", "year", "approvedAnnualBudget"] })] }));
}
// ─── Workflow Settings Tab ────────────────────────────────────────────────────
function WorkflowSettingsTab({ orgId, addToast, }) {
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [approvalLevels, setApprovalLevels] = useState(2);
    const [receiptThreshold, setReceiptThreshold] = useState("");
    const [approvalThreshold, setApprovalThreshold] = useState("");
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.adminGetWorkflowSettings({ orgId });
            const s = res?.settings || res || {};
            setApprovalLevels(s.approvalLevels || 2);
            setReceiptThreshold(String(s.receiptRequiredThreshold ?? ""));
            setApprovalThreshold(String(s.expenseApprovalThreshold ?? ""));
        }
        catch {
            addToast("error", "Failed to load workflow settings.");
        }
        finally {
            setLoading(false);
        }
    }, [orgId, addToast]);
    useEffect(() => { load(); }, [load]);
    const handleSave = async (e) => {
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
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to save.");
        }
        finally {
            setBusy(false);
        }
    };
    if (loading) {
        return (_jsxs("div", { className: "space-y-4 max-w-md", children: [_jsx("div", { className: "skeleton h-10 w-full" }), _jsx("div", { className: "skeleton h-10 w-full" }), _jsx("div", { className: "skeleton h-10 w-full" })] }));
    }
    return (_jsx("div", { className: "max-w-md", children: _jsxs("form", { onSubmit: handleSave, className: "space-y-4", children: [_jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Approval Levels (1\u20135)" }) }), _jsx("input", { type: "number", min: 1, max: 5, className: "input input-bordered w-full", value: approvalLevels, onChange: e => setApprovalLevels(Number(e.target.value)) })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Receipt Required Threshold ($)" }) }), _jsx("input", { type: "number", min: 0, step: "0.01", className: "input input-bordered w-full", value: receiptThreshold, onChange: e => setReceiptThreshold(e.target.value), placeholder: "e.g. 25.00" }), _jsx("label", { className: "label", children: _jsx("span", { className: "label-text-alt text-base-content/60", children: "Receipts required for expenses above this amount" }) })] }), _jsxs("div", { className: "form-control", children: [_jsx("label", { className: "label", children: _jsx("span", { className: "label-text font-semibold", children: "Expense Approval Threshold ($)" }) }), _jsx("input", { type: "number", min: 0, step: "0.01", className: "input input-bordered w-full", value: approvalThreshold, onChange: e => setApprovalThreshold(e.target.value), placeholder: "e.g. 500.00" }), _jsx("label", { className: "label", children: _jsx("span", { className: "label-text-alt text-base-content/60", children: "Expenses above this amount require additional approval" }) })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", className: "btn btn-ghost", onClick: load, disabled: busy, title: "Refresh", children: "\u21BB Refresh" }), _jsxs("button", { type: "submit", className: "btn btn-primary", disabled: busy, children: [busy ? _jsx("span", { className: "loading loading-spinner loading-sm" }) : null, busy ? "Saving..." : "Save Settings"] })] })] }) }));
}
// ─── Escalation Rules Tab ─────────────────────────────────────────────────────
function EscalationRulesTab({ orgId, addToast, }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [editing, setEditing] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [fStep, setFStep] = useState(1);
    const [fRole, setFRole] = useState("ADMIN");
    const [fThreshold, setFThreshold] = useState("");
    const [fBuffer, setFBuffer] = useState("");
    const [fStatus, setFStatus] = useState("active");
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.adminListEscalationRules({ orgId });
            setItems(res?.rules || res || []);
        }
        catch {
            addToast("error", "Failed to load escalation rules.");
        }
        finally {
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
        setEditing(null);
        setFStep(1);
        setFRole("ADMIN");
        setFThreshold("");
        setFBuffer("");
        setFStatus("active");
        setIsModalOpen(true);
    };
    const openEdit = (item) => {
        setEditing(item);
        setFStep(item.step);
        setFRole(item.role);
        setFThreshold(String(item.threshold));
        setFBuffer(item.bufferAmount ? String(item.bufferAmount) : "");
        setFStatus(item.status);
        setIsModalOpen(true);
    };
    const closeModal = () => { setIsModalOpen(false); setEditing(null); };
    const handleSave = async (e) => {
        e.preventDefault();
        if (!fThreshold || isNaN(Number(fThreshold))) {
            addToast("error", "Valid threshold is required.");
            return;
        }
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
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to save.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleToggleStatus = async (item) => {
        const next = item.status === "active" ? "inactive" : "active";
        setBusy(true);
        try {
            await api.adminSetEscalationRuleStatus({ orgId, ruleId: item.id, status: next });
            addToast("success", `Rule ${next === "inactive" ? "deactivated" : "reactivated"}.`);
            await load();
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to update status.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleBulkImport = async (rows) => {
        const res = await api.adminBulkImportEscalationRules({ orgId, rows });
        await load();
        return res;
    };
    const thCls = "cursor-pointer select-none hover:bg-base-200";
    return (_jsxs("div", { children: [_jsx(TableToolbar, { search: search, onSearch: v => { setSearch(v); setPage(1); }, statusFilter: statusFilter, onStatusFilter: v => { setStatusFilter(v); setPage(1); }, onAdd: openAdd, onBulkImport: () => setBulkOpen(true), onRefresh: load, loading: loading, addLabel: "+ Add Rule" }), _jsx("div", { className: "card bg-base-100 shadow", children: _jsxs("div", { className: "card-body p-0", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "table table-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsxs("th", { className: thCls, onClick: () => toggleSort("step"), children: ["Step ", _jsx(SortIcon, { field: "step", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("role"), children: ["Role ", _jsx(SortIcon, { field: "role", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("threshold"), children: ["Threshold ($) ", _jsx(SortIcon, { field: "threshold", sort: sort })] }), _jsx("th", { children: "Buffer Amount ($)" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: loading ? _jsx(SkeletonRows, { cols: 6 }) : paged.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "text-center py-8 text-base-content/50 text-sm", children: "No escalation rules found." }) })) : paged.map((item, i) => (_jsxs("tr", { className: "hover", children: [_jsx("td", { children: item.step }), _jsx("td", { className: "font-mono text-sm", children: item.role }), _jsx("td", { children: fmtCurrency(item.threshold) }), _jsx("td", { children: item.bufferAmount ? fmtCurrency(item.bufferAmount) : "—" }), _jsx("td", { children: _jsx("span", { className: `badge badge-sm ${item.status === "active" ? "badge-success" : "badge-ghost"}`, children: item.status }) }), _jsx("td", { children: _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { className: "btn btn-xs btn-outline", onClick: () => openEdit(item), children: "Edit" }), _jsx("button", { className: `btn btn-xs ${item.status === "active" ? "btn-warning" : "btn-success"} btn-outline`, disabled: busy, onClick: () => handleToggleStatus(item), children: item.status === "active" ? "Deactivate" : "Reactivate" })] }) })] }, item.id || i))) })] }) }), _jsx(Pagination, { page: page, totalPages: totalPages, onPrev: () => setPage(p => p - 1), onNext: () => setPage(p => p + 1) })] }) }), _jsxs(EditModal, { isOpen: isModalOpen, title: editing ? "Edit Escalation Rule" : "New Escalation Rule", onClose: closeModal, onSave: handleSave, busy: busy, children: [_jsx(FormField, { label: "Step", required: true, children: _jsx("select", { className: "select select-bordered w-full", value: fStep, onChange: e => setFStep(Number(e.target.value)), children: [1, 2, 3, 4, 5, 6, 7, 8].map(s => _jsxs("option", { value: s, children: ["Step ", s] }, s)) }) }), _jsx(FormField, { label: "Role", required: true, children: _jsx("select", { className: "select select-bordered w-full", value: fRole, onChange: e => setFRole(e.target.value), children: ROLES.map(r => _jsx("option", { value: r, children: r }, r)) }) }), _jsx(FormField, { label: "Threshold ($)", required: true, children: _jsx("input", { type: "number", min: 0, step: "0.01", className: "input input-bordered w-full", value: fThreshold, onChange: e => setFThreshold(e.target.value), required: true, placeholder: "500.00" }) }), _jsx(FormField, { label: "Buffer Amount ($)", children: _jsx("input", { type: "number", min: 0, step: "0.01", className: "input input-bordered w-full", value: fBuffer, onChange: e => setFBuffer(e.target.value), placeholder: "50.00" }) }), _jsx(FormField, { label: "Status", children: _jsxs("select", { className: "select select-bordered w-full", value: fStatus, onChange: e => setFStatus(e.target.value), children: [_jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "inactive", children: "Inactive" })] }) })] }), _jsx(BulkImportModal, { isOpen: bulkOpen, onClose: () => setBulkOpen(false), onImport: handleBulkImport, title: "Bulk Import Escalation Rules", templateHeaders: ["step", "role", "threshold", "bufferAmount", "status"], templateExampleRows: [{ step: "2", role: "ADMIN", threshold: "500", bufferAmount: "50", status: "active" }], requiredFields: ["step", "role", "threshold"] })] }));
}
// ─── QB Accounts Tab ──────────────────────────────────────────────────────────
function QBAccountsTab({ orgId, addToast, }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [editing, setEditing] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [fName, setFName] = useState("");
    const [fAccountNumber, setFAccountNumber] = useState("");
    const [fAccountType, setFAccountType] = useState("Checking");
    const [fStatus, setFStatus] = useState("active");
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.adminListQBAccounts({ orgId });
            setItems(res?.accounts || res || []);
        }
        catch {
            addToast("error", "Failed to load QB accounts.");
        }
        finally {
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
    const openEdit = (item) => {
        setEditing(item);
        setFName(item.name);
        setFAccountNumber(item.accountNumber || "");
        setFAccountType(item.accountType || "Checking");
        setFStatus(item.status);
        setIsModalOpen(true);
    };
    const closeModal = () => { setIsModalOpen(false); setEditing(null); };
    const handleSave = async (e) => {
        e.preventDefault();
        if (!fName.trim()) {
            addToast("error", "Account name is required.");
            return;
        }
        setBusy(true);
        try {
            await api.adminUpsertQBAccount({ orgId, accountId: editing?.id, name: fName, accountNumber: fAccountNumber, accountType: fAccountType, status: fStatus });
            addToast("success", `QB Account "${fName}" saved.`);
            closeModal();
            await load();
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to save.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleToggleStatus = async (item) => {
        const next = item.status === "active" ? "inactive" : "active";
        setBusy(true);
        try {
            await api.adminSetQBAccountStatus({ orgId, accountId: item.id, status: next });
            addToast("success", `Account ${next === "inactive" ? "deactivated" : "reactivated"}.`);
            await load();
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to update status.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleBulkImport = async (rows) => {
        const res = await api.adminBulkImportQBAccounts({ orgId, rows });
        await load();
        return res;
    };
    const thCls = "cursor-pointer select-none hover:bg-base-200";
    return (_jsxs("div", { children: [_jsx(TableToolbar, { search: search, onSearch: v => { setSearch(v); setPage(1); }, statusFilter: statusFilter, onStatusFilter: v => { setStatusFilter(v); setPage(1); }, onAdd: openAdd, onBulkImport: () => setBulkOpen(true), onRefresh: load, loading: loading, addLabel: "+ Add Account" }), _jsx("div", { className: "card bg-base-100 shadow", children: _jsxs("div", { className: "card-body p-0", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "table table-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsxs("th", { className: thCls, onClick: () => toggleSort("name"), children: ["Account Name ", _jsx(SortIcon, { field: "name", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("accountNumber"), children: ["Account Number ", _jsx(SortIcon, { field: "accountNumber", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("accountType"), children: ["Type ", _jsx(SortIcon, { field: "accountType", sort: sort })] }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: loading ? _jsx(SkeletonRows, { cols: 5 }) : paged.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "text-center py-8 text-base-content/50 text-sm", children: "No QB accounts found." }) })) : paged.map((item, i) => (_jsxs("tr", { className: "hover", children: [_jsx("td", { className: "font-medium", children: item.name }), _jsx("td", { className: "text-sm font-mono", children: item.accountNumber || "—" }), _jsx("td", { className: "text-sm", children: item.accountType || "—" }), _jsx("td", { children: _jsx("span", { className: `badge badge-sm ${item.status === "active" ? "badge-success" : "badge-ghost"}`, children: item.status }) }), _jsx("td", { children: _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { className: "btn btn-xs btn-outline", onClick: () => openEdit(item), children: "Edit" }), _jsx("button", { className: `btn btn-xs ${item.status === "active" ? "btn-warning" : "btn-success"} btn-outline`, disabled: busy, onClick: () => handleToggleStatus(item), children: item.status === "active" ? "Deactivate" : "Reactivate" })] }) })] }, item.id || i))) })] }) }), _jsx(Pagination, { page: page, totalPages: totalPages, onPrev: () => setPage(p => p - 1), onNext: () => setPage(p => p + 1) })] }) }), _jsxs(EditModal, { isOpen: isModalOpen, title: editing ? "Edit QB Account" : "New QB Account", onClose: closeModal, onSave: handleSave, busy: busy, children: [_jsx(FormField, { label: "Account Name", required: true, children: _jsx("input", { className: "input input-bordered w-full", value: fName, onChange: e => setFName(e.target.value), required: true, placeholder: "e.g. General Checking" }) }), _jsx(FormField, { label: "Account Number", children: _jsx("input", { className: "input input-bordered w-full", value: fAccountNumber, onChange: e => setFAccountNumber(e.target.value), placeholder: "Account number (optional)" }) }), _jsx(FormField, { label: "Account Type", children: _jsx("select", { className: "select select-bordered w-full", value: fAccountType, onChange: e => setFAccountType(e.target.value), children: QB_ACCOUNT_TYPES.map(t => _jsx("option", { value: t, children: t }, t)) }) }), _jsx(FormField, { label: "Status", children: _jsxs("select", { className: "select select-bordered w-full", value: fStatus, onChange: e => setFStatus(e.target.value), children: [_jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "inactive", children: "Inactive" })] }) })] }), _jsx(BulkImportModal, { isOpen: bulkOpen, onClose: () => setBulkOpen(false), onImport: handleBulkImport, title: "Bulk Import QB Accounts", templateHeaders: ["accountName", "accountNumber", "accountType", "status"], templateExampleRows: [{ accountName: "General Checking", accountNumber: "", accountType: "Checking", status: "active" }], requiredFields: ["accountName"] })] }));
}
// ─── Users Tab ────────────────────────────────────────────────────────────────
const ROLE_LABELS = {
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
function UsersTab({ orgId, addToast, }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [editing, setEditing] = useState(null);
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
            const res = await api.adminListUsers({ orgId });
            setItems(res?.users || res || []);
        }
        catch {
            addToast("error", "Failed to load users.");
        }
        finally {
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
    const [sort, setSort] = useState({ field: "name", dir: "asc" });
    const [page, setPage] = useState(1);
    const toggleSort = (field) => {
        setSort(prev => prev.field === field
            ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
            : { field, dir: "asc" });
        setPage(1);
    };
    const sorted = [...filtered].sort((a, b) => {
        const av = a[sort.field] ?? "";
        const bv = b[sort.field] ?? "";
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
    const openEdit = (item) => {
        setEditing(item);
        setFName(item.name);
        setFEmail(item.email);
        setFRole(item.role || "ADMIN");
        setFMinistryDept(item.ministryDepartment || "");
        setFActive(item.active !== false);
        setIsModalOpen(true);
    };
    const closeModal = () => { setIsModalOpen(false); setEditing(null); };
    const handleSave = async (e) => {
        e.preventDefault();
        if (!fName.trim()) {
            addToast("error", "Name is required.");
            return;
        }
        if (!fEmail.trim()) {
            addToast("error", "Email is required.");
            return;
        }
        if (!fRole.trim()) {
            addToast("error", "Role is required.");
            return;
        }
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
            }
            else {
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
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to save.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleSetStatus = async (user, active) => {
        setBusy(true);
        try {
            await api.adminSetUserStatus({ orgId, userId: user.userId, active });
            addToast("success", `User ${active ? "reactivated" : "deactivated"}.`);
            await load();
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to update status.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleResendWelcome = async (user) => {
        setBusy(true);
        try {
            await api.adminResendWelcomeEmail({ orgId, userId: user.userId });
            addToast("success", `Welcome email resent to ${user.email}.`);
        }
        catch (err) {
            addToast("error", err instanceof Error ? err.message : "Failed to resend welcome email.");
        }
        finally {
            setBusy(false);
        }
    };
    const handleBulkImport = async (rows) => {
        const res = await api.adminBulkImportUsers({ orgId, rows });
        await load();
        return res;
    };
    const thCls = "cursor-pointer select-none hover:bg-base-200";
    return (_jsxs("div", { children: [_jsx(TableToolbar, { search: search, onSearch: v => { setSearch(v); setPage(1); }, statusFilter: statusFilter, onStatusFilter: v => { setStatusFilter(v); setPage(1); }, onAdd: openAdd, onBulkImport: () => setBulkOpen(true), onRefresh: load, loading: loading, addLabel: "+ Add User" }), _jsx("div", { className: "card bg-base-100 shadow", children: _jsxs("div", { className: "card-body p-0", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "table table-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsxs("th", { className: thCls, onClick: () => toggleSort("name"), children: ["Name ", _jsx(SortIcon, { field: "name", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("email"), children: ["Email ", _jsx(SortIcon, { field: "email", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("role"), children: ["Role ", _jsx(SortIcon, { field: "role", sort: sort })] }), _jsxs("th", { className: thCls, onClick: () => toggleSort("ministryDepartment"), children: ["Ministry Dept ", _jsx(SortIcon, { field: "ministryDepartment", sort: sort })] }), _jsx("th", { children: "Active" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: loading ? (_jsx(SkeletonRows, { cols: 6 })) : paged.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "text-center py-8 text-base-content/50 text-sm", children: "No users found." }) })) : (paged.map((user, i) => (_jsxs("tr", { className: "hover", children: [_jsx("td", { className: "font-medium", children: user.name }), _jsx("td", { className: "text-sm", children: user.email }), _jsx("td", { className: "text-sm", children: ROLE_LABELS[user.role] || user.role || "—" }), _jsx("td", { className: "text-sm", children: user.ministryDepartment || "—" }), _jsx("td", { children: _jsx(ActiveBadge, { active: user.active !== false }) }), _jsx("td", { children: _jsxs("div", { className: "flex gap-1 flex-wrap", children: [_jsx("button", { className: "btn btn-xs btn-outline", onClick: () => openEdit(user), children: "Edit" }), _jsx("button", { className: "btn btn-xs btn-secondary btn-outline", disabled: busy, onClick: () => handleResendWelcome(user), children: "Resend Welcome" }), _jsx("button", { className: `btn btn-xs ${user.active !== false ? "btn-warning" : "btn-success"} btn-outline`, disabled: busy, onClick: () => handleSetStatus(user, user.active === false), children: user.active !== false ? "Deactivate" : "Reactivate" })] }) })] }, user.userId || i)))) })] }) }), _jsx(Pagination, { page: safePage, totalPages: totalPages, onPrev: () => setPage(p => p - 1), onNext: () => setPage(p => p + 1) })] }) }), _jsxs(EditModal, { isOpen: isModalOpen, title: editing ? "Edit User" : "New User", onClose: closeModal, onSave: handleSave, busy: busy, children: [_jsx(FormField, { label: "Name", required: true, children: _jsx("input", { className: "input input-bordered w-full", value: fName, onChange: e => setFName(e.target.value), required: true, placeholder: "Full name" }) }), _jsx(FormField, { label: "Email", required: true, children: _jsx("input", { type: "email", className: "input input-bordered w-full", value: fEmail, onChange: e => setFEmail(e.target.value), required: true, placeholder: "user@church.org", readOnly: !!editing, disabled: !!editing }) }), _jsx(FormField, { label: "Role", required: true, children: _jsx("select", { className: "select select-bordered w-full", value: fRole, onChange: e => setFRole(e.target.value), children: USER_ROLES.map(r => _jsx("option", { value: r, children: ROLE_LABELS[r] || r }, r)) }) }), _jsx(FormField, { label: "Ministry Department", children: _jsx("input", { className: "input input-bordered w-full", value: fMinistryDept, onChange: e => setFMinistryDept(e.target.value), placeholder: "e.g. Youth Ministry" }) }), editing && (_jsx(FormField, { label: "Active", children: _jsxs("label", { className: "flex items-center gap-2 cursor-pointer mt-1", children: [_jsx("input", { type: "checkbox", className: "checkbox checkbox-primary", checked: fActive, onChange: e => setFActive(e.target.checked) }), _jsx("span", { className: "label-text", children: fActive ? "Active" : "Inactive" })] }) }))] }), _jsx(BulkImportModal, { isOpen: bulkOpen, onClose: () => setBulkOpen(false), onImport: handleBulkImport, title: "Bulk Import Users", templateHeaders: ["name", "email", "role", "ministryDepartment", "active"], templateExampleRows: [
                    { name: "James Wilson", email: "james@citylightmn.com", role: "REQUESTOR", ministryDepartment: "Worship", active: "true" },
                    { name: "Sarah Lee", email: "sarah@citylightmn.com", role: "ADMIN", ministryDepartment: "", active: "true" },
                ], requiredFields: ["name", "email", "role"] })] }));
}
// ─── Main AdminPage ───────────────────────────────────────────────────────────
const TABS = [
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
        if (!isAdmin)
            navigate("/");
    }, [isAdmin, navigate]);
    const [tab, setTab] = useState("departments");
    if (!isAdmin)
        return null;
    return (_jsxs("div", { className: "p-6 max-w-6xl mx-auto", children: [_jsx(ToastArea, { toasts: toasts }), _jsxs("div", { className: "mb-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Admin Setup" }), _jsx("p", { className: "text-sm text-base-content/60 mt-1", children: activeOrgName })] }), _jsx("div", { className: "overflow-x-auto mb-6", children: _jsx("div", { className: "tabs tabs-boxed flex-nowrap inline-flex min-w-max", children: TABS.map(t => (_jsx("button", { className: `tab whitespace-nowrap ${tab === t.id ? "tab-active" : ""}`, onClick: () => setTab(t.id), children: t.label }, t.id))) }) }), tab === "departments" && _jsx(DepartmentsTab, { orgId: activeOrgId, addToast: addToast }), tab === "categories" && _jsx(CategoriesTab, { orgId: activeOrgId, addToast: addToast }), tab === "vendors" && _jsx(VendorsTab, { orgId: activeOrgId, addToast: addToast }), tab === "vendorRequests" && _jsx(VendorRequestsTab, { orgId: activeOrgId, addToast: addToast }), tab === "categoryBudgets" && _jsx(CategoryBudgetsTab, { orgId: activeOrgId, addToast: addToast }), tab === "workflowSettings" && _jsx(WorkflowSettingsTab, { orgId: activeOrgId, addToast: addToast }), tab === "escalationRules" && _jsx(EscalationRulesTab, { orgId: activeOrgId, addToast: addToast }), tab === "qbAccounts" && _jsx(QBAccountsTab, { orgId: activeOrgId, addToast: addToast }), tab === "users" && _jsx(UsersTab, { orgId: activeOrgId, addToast: addToast })] }));
}
