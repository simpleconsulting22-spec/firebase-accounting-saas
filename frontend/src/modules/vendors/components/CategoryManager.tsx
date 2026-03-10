import { FormEvent, useState } from "react";
import { vendorsApi } from "../services";
import { CategoryRecord } from "../types";

interface CategoryManagerProps {
  tenantId: string;
  organizationId: string;
}

export function CategoryManager({ tenantId, organizationId }: CategoryManagerProps) {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
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
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to load categories.";
      setError(text);
    } finally {
      setListBusy(false);
    }
  };

  const createCategory = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      ensureScope();
      const result = await vendorsApi.createCategory({ tenantId, organizationId, name, active });
      setMessage(`Category created: ${result.categoryId}`);
      setName("");
      await loadCategories();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to create category.";
      setError(text);
    }
  };

  const updateCategory = async (event: FormEvent) => {
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
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to update category.";
      setError(text);
    }
  };

  const deleteCategory = async (event: FormEvent) => {
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
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to delete category.";
      setError(text);
    }
  };

  return (
    <section style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Categories (Shared by Category Group)</h3>
      <button type="button" onClick={loadCategories} disabled={listBusy}>
        {listBusy ? "Loading Categories..." : "Refresh Categories"}
      </button>
      <pre style={{ overflowX: "auto" }}>{JSON.stringify(categories, null, 2)}</pre>

      <form onSubmit={createCategory} style={{ marginBottom: 12 }}>
        <h4>Create Category</h4>
        <label style={{ display: "block", marginBottom: 8 }}>
          Name
          <input
            style={{ display: "block", width: "100%" }}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />{" "}
          Active
        </label>
        <button type="submit">Create Category</button>
      </form>

      <form onSubmit={updateCategory} style={{ marginBottom: 12 }}>
        <h4>Update Category</h4>
        <label style={{ display: "block", marginBottom: 8 }}>
          Category ID
          <input
            style={{ display: "block", width: "100%" }}
            value={updateCategoryId}
            onChange={(event) => setUpdateCategoryId(event.target.value)}
            required
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Name (optional)
          <input
            style={{ display: "block", width: "100%" }}
            value={updateName}
            onChange={(event) => setUpdateName(event.target.value)}
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={updateActive}
            onChange={(event) => setUpdateActive(event.target.checked)}
          />{" "}
          Active
        </label>
        <button type="submit">Update Category</button>
      </form>

      <form onSubmit={deleteCategory}>
        <h4>Delete Category</h4>
        <label style={{ display: "block", marginBottom: 8 }}>
          Category ID
          <input
            style={{ display: "block", width: "100%" }}
            value={deleteCategoryId}
            onChange={(event) => setDeleteCategoryId(event.target.value)}
            required
          />
        </label>
        <button type="submit">Delete Category</button>
      </form>

      {message ? <p style={{ color: "#1a7f37" }}>{message}</p> : null}
      {error ? <p style={{ color: "#cf222e" }}>{error}</p> : null}
    </section>
  );
}
