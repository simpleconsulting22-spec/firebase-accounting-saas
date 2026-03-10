"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountingExportsController = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const moduleAccess_1 = require("../../middleware/moduleAccess");
const tenantOrgAccess_1 = require("../../middleware/tenantOrgAccess");
const accountingExportService_1 = require("../../services/accountingExportService");
const errors_1 = require("../../utils/errors");
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
    if (error.status === 412) {
        return new https_1.HttpsError("failed-precondition", error.message);
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
    return new https_1.HttpsError("internal", "Unexpected accounting exports module error.");
};
const assertAdminFinanceRole = (orgRoles, organizationId) => {
    if (Object.prototype.hasOwnProperty.call(orgRoles, "*")) {
        return;
    }
    const scoped = orgRoles[organizationId] || [];
    if (!scoped.includes("admin") && !scoped.includes("finance")) {
        throw new https_1.HttpsError("permission-denied", "Only admin or finance role can generate/list accounting exports.");
    }
};
exports.accountingExportsController = {
    async generateQuickbooksExpenseExport(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.generateQuickbooksExpenseExportSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "financialReports");
            return accountingExportService_1.accountingExportService.generateQuickbooksExpenseExport({
                ...payload,
                generatedBy: authReq.userContext.uid
            });
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async listAccountingExports(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.listAccountingExportsSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "financialReports");
            return accountingExportService_1.accountingExportService.listAccountingExports(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    }
};
