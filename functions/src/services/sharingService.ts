import { Category, Organization, Vendor } from "../models";

export const sharingService = {
  canOrganizationUseVendor(vendor: Vendor, organization: Organization): boolean {
    return (
      vendor.tenantId === organization.tenantId &&
      vendor.vendorGroupId === organization.vendorGroupId
    );
  },

  canOrganizationUseCategory(category: Category, organization: Organization): boolean {
    return (
      category.tenantId === organization.tenantId &&
      category.categoryGroupId === organization.categoryGroupId
    );
  }
};
