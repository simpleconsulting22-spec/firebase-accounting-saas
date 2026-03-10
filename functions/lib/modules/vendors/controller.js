"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorsController = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const moduleAccess_1 = require("../../middleware/moduleAccess");
const tenantOrgAccess_1 = require("../../middleware/tenantOrgAccess");
const errors_1 = require("../../utils/errors");
const vendorService_1 = require("../../services/vendorService");
const validation_1 = require("./validation");
const mapAppError = (error) => {
    if (error.status === 400) {
        return new https_1.HttpsError("invalid-argument", error.message);
    }
    if (error.status === 403) {
        return new https_1.HttpsError("permission-denied", error.message);
    }
    if (error.status === 404) {
        return new https_1.HttpsError("not-found", error.message);
    }
    if (error.status === 409) {
        return new https_1.HttpsError("already-exists", error.message);
    }
    return new https_1.HttpsError("internal", error.message);
};
const normalizeError = (error) => {
    if (error instanceof https_1.HttpsError) {
        return error;
    }
    if (error instanceof zod_1.ZodError) {
        return new https_1.HttpsError("invalid-argument", error.issues.map((issue) => issue.message).join("; "));
    }
    if (error instanceof errors_1.AppError) {
        return mapAppError(error);
    }
    return new https_1.HttpsError("internal", "Unexpected vendors module error.");
};
const assertVendorCategoryManagePermission = (orgRoles, organizationId) => {
    const wildcardRoles = orgRoles["*"] || [];
    const scopedRoles = orgRoles[organizationId] || [];
    const allowed = wildcardRoles.length > 0 || scopedRoles.includes("admin") || scopedRoles.includes("finance");
    if (!allowed) {
        throw new https_1.HttpsError("permission-denied", "Vendor/category management requires admin or finance role in the organization.");
    }
};
exports.vendorsController = {
    async listVendors(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.vendorOrgScopeSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return vendorService_1.vendorService.listVendorsForOrganization(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async createVendor(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.createVendorSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertVendorCategoryManagePermission(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return vendorService_1.vendorService.createVendor(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async updateVendor(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.updateVendorSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertVendorCategoryManagePermission(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return vendorService_1.vendorService.updateVendor(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async deleteVendor(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.deleteVendorSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertVendorCategoryManagePermission(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return vendorService_1.vendorService.deleteVendor(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async listCategories(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.vendorOrgScopeSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return vendorService_1.vendorService.listCategoriesForOrganization(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async createCategory(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.createCategorySchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertVendorCategoryManagePermission(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return vendorService_1.vendorService.createCategory(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async updateCategory(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.updateCategorySchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertVendorCategoryManagePermission(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return vendorService_1.vendorService.updateCategory(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async deleteCategory(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.deleteCategorySchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertVendorCategoryManagePermission(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return vendorService_1.vendorService.deleteCategory(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    }
};
