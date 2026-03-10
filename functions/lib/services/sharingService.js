"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharingService = void 0;
exports.sharingService = {
    canOrganizationUseVendor(vendor, organization) {
        return (vendor.tenantId === organization.tenantId &&
            vendor.vendorGroupId === organization.vendorGroupId);
    },
    canOrganizationUseCategory(category, organization) {
        return (category.tenantId === organization.tenantId &&
            category.categoryGroupId === organization.categoryGroupId);
    }
};
