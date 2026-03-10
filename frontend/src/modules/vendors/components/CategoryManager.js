import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { vendorsApi } from "../services";
export function CategoryManager({ tenantId, organizationId }) {
    const [categories, setCategories] = useState([]);
    const [listBusy, setListBusy] = useState(false);
    const [name, setName] = useState("");
    const [active, setActive] = useState(true);
    const [updateCategoryId, setUpdateCategoryId] = useState("");
    const [updateName, setUpdateName] = useState("");
    const [updateActive, setUpdateActive] = useState(true);
    const [deleteCategoryId, setDeleteCategoryId] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const ensureScope = () => {
        if (!tenantId || !organizationId) {
            throw new Error("tenantId and organizationId are required.");
        }
    };
    const loadCategories = async () => {
        setListBusy(true);
        setError("");
        try {
            ensureScope();
            const rows = await vendorsApi.listCategories({ tenantId, organizationId });
            setCategories(rows);
        }
        catch (err) {
            const text = err instanceof Error ? err.message : "Failed to load categories.";
            setError(text);
        }
        finally {
            setListBusy(false);
        }
    };
    const createCategory = async (event) => {
        event.preventDefault();
        setMessage("");
        setError("");
        try {
            ensureScope();
            const result = await vendorsApi.createCategory({ tenantId, organizationId, name, active });
            setMessage(`Category created: ${result.categoryId}`);
            setName("");
            await loadCategories();
        }
        catch (err) {
            const text = err instanceof Error ? err.message : "Failed to create category.";
            setError(text);
        }
    };
    const updateCategory = async (event) => {
        event.preventDefault();
        setMessage("");
        setError("");
        try {
            ensureScope();
            await vendorsApi.updateCategory({
                tenantId,
                organizationId,
                categoryId: updateCategoryId,
                name: updateName || undefined,
                active: updateActive
            });
            setMessage(`Category updated: ${updateCategoryId}`);
            await loadCategories();
        }
        catch (err) {
            const text = err instanceof Error ? err.message : "Failed to update category.";
            setError(text);
        }
    };
    const deleteCategory = async (event) => {
        event.preventDefault();
        setMessage("");
        setError("");
        try {
            ensureScope();
            await vendorsApi.deleteCategory({
                tenantId,
                organizationId,
                categoryId: deleteCategoryId
            });
            setMessage(`Category deleted: ${deleteCategoryId}`);
            setDeleteCategoryId("");
            await loadCategories();
        }
        catch (err) {
            const text = err instanceof Error ? err.message : "Failed to delete category.";
            setError(text);
        }
    };
    return (_jsxs("section", { style: { border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { style: { marginTop: 0 }, children: "Categories (Shared by Category Group)" }), _jsx("button", { type: "button", onClick: loadCategories, disabled: listBusy, children: listBusy ? "Loading Categories..." : "Refresh Categories" }), _jsx("pre", { style: { overflowX: "auto" }, children: JSON.stringify(categories, null, 2) }), _jsxs("form", { onSubmit: createCategory, style: { marginBottom: 12 }, children: [_jsx("h4", { children: "Create Category" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Name", _jsx("input", { style: { display: "block", width: "100%" }, value: name, onChange: (event) => setName(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: [_jsx("input", { type: "checkbox", checked: active, onChange: (event) => setActive(event.target.checked) }), " ", "Active"] }), _jsx("button", { type: "submit", children: "Create Category" })] }), _jsxs("form", { onSubmit: updateCategory, style: { marginBottom: 12 }, children: [_jsx("h4", { children: "Update Category" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Category ID", _jsx("input", { style: { display: "block", width: "100%" }, value: updateCategoryId, onChange: (event) => setUpdateCategoryId(event.target.value), required: true })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Name (optional)", _jsx("input", { style: { display: "block", width: "100%" }, value: updateName, onChange: (event) => setUpdateName(event.target.value) })] }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: [_jsx("input", { type: "checkbox", checked: updateActive, onChange: (event) => setUpdateActive(event.target.checked) }), " ", "Active"] }), _jsx("button", { type: "submit", children: "Update Category" })] }), _jsxs("form", { onSubmit: deleteCategory, children: [_jsx("h4", { children: "Delete Category" }), _jsxs("label", { style: { display: "block", marginBottom: 8 }, children: ["Category ID", _jsx("input", { style: { display: "block", width: "100%" }, value: deleteCategoryId, onChange: (event) => setDeleteCategoryId(event.target.value), required: true })] }), _jsx("button", { type: "submit", children: "Delete Category" })] }), message ? _jsx("p", { style: { color: "#1a7f37" }, children: message }) : null, error ? _jsx("p", { style: { color: "#cf222e" }, children: error }) : null] }));
}
