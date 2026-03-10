interface OrganizationScope {
  tenantId: string;
  vendorGroupId: string;
  categoryGroupId: string;
}

interface VendorScope {
  tenantId: string;
  vendorGroupId: string;
}

interface CategoryScope {
  tenantId: string;
  categoryGroupId: string;
}

export const frontendSharingService = {
  canSeeVendor(org: OrganizationScope, vendor: VendorScope): boolean {
    return org.tenantId === vendor.tenantId && org.vendorGroupId === vendor.vendorGroupId;
  },

  canSeeCategory(org: OrganizationScope, category: CategoryScope): boolean {
    return org.tenantId === category.tenantId && org.categoryGroupId === category.categoryGroupId;
  }
};
