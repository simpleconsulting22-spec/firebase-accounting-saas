export const frontendSharingService = {
    canSeeVendor(org, vendor) {
        return org.tenantId === vendor.tenantId && org.vendorGroupId === vendor.vendorGroupId;
    },
    canSeeCategory(org, category) {
        return org.tenantId === category.tenantId && org.categoryGroupId === category.categoryGroupId;
    }
};
