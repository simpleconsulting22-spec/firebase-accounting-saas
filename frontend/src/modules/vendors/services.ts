import { apiClient } from "../../services/apiClient";
import {
  CategoryRecord,
  CreateCategoryPayload,
  CreateVendorPayload,
  DeleteCategoryPayload,
  DeleteVendorPayload,
  OrgScopedPayload,
  UpdateCategoryPayload,
  UpdateVendorPayload,
  VendorRecord
} from "./types";

export const vendorsApi = {
  listVendors(payload: OrgScopedPayload): Promise<VendorRecord[]> {
    return apiClient.call<OrgScopedPayload, VendorRecord[]>("listVendors", payload);
  },

  createVendor(payload: CreateVendorPayload): Promise<{ vendorId: string }> {
    return apiClient.call<CreateVendorPayload, { vendorId: string }>("createVendor", payload);
  },

  updateVendor(payload: UpdateVendorPayload): Promise<{ vendorId: string }> {
    return apiClient.call<UpdateVendorPayload, { vendorId: string }>("updateVendor", payload);
  },

  deleteVendor(payload: DeleteVendorPayload): Promise<{ vendorId: string }> {
    return apiClient.call<DeleteVendorPayload, { vendorId: string }>("deleteVendor", payload);
  },

  listCategories(payload: OrgScopedPayload): Promise<CategoryRecord[]> {
    return apiClient.call<OrgScopedPayload, CategoryRecord[]>("listCategories", payload);
  },

  createCategory(payload: CreateCategoryPayload): Promise<{ categoryId: string }> {
    return apiClient.call<CreateCategoryPayload, { categoryId: string }>("createCategory", payload);
  },

  updateCategory(payload: UpdateCategoryPayload): Promise<{ categoryId: string }> {
    return apiClient.call<UpdateCategoryPayload, { categoryId: string }>("updateCategory", payload);
  },

  deleteCategory(payload: DeleteCategoryPayload): Promise<{ categoryId: string }> {
    return apiClient.call<DeleteCategoryPayload, { categoryId: string }>("deleteCategory", payload);
  }
};
