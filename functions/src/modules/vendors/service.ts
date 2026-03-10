import { vendorService } from "../../services/vendorService";

export const vendorsModuleService = {
  listVendorsForOrganization: vendorService.listVendorsForOrganization,
  createVendor: vendorService.createVendor,
  updateVendor: vendorService.updateVendor,
  deleteVendor: vendorService.deleteVendor,
  listCategoriesForOrganization: vendorService.listCategoriesForOrganization,
  createCategory: vendorService.createCategory,
  updateCategory: vendorService.updateCategory,
  deleteCategory: vendorService.deleteCategory
};
