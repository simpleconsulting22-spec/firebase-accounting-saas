"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalLedgerController = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const moduleAccess_1 = require("../../middleware/moduleAccess");
const tenantOrgAccess_1 = require("../../middleware/tenantOrgAccess");
const errors_1 = require("../../utils/errors");
const service_1 = require("./service");
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
    return new https_1.HttpsError("internal", "Unexpected general ledger module error.");
};
const assertAdminFinanceRole = (orgRoles, organizationId) => {
    if (Object.prototype.hasOwnProperty.call(orgRoles, "*")) {
        return;
    }
    const roles = orgRoles[organizationId] || [];
    if (!roles.includes("admin") && !roles.includes("finance")) {
        throw new https_1.HttpsError("permission-denied", "General ledger actions require admin or finance role.");
    }
};
exports.generalLedgerController = {
    async listChartOfAccounts(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.listChartOfAccountsSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "generalLedger");
            return service_1.generalLedgerModuleService.listChartOfAccounts(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async createChartOfAccount(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.createChartOfAccountSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "generalLedger");
            return service_1.generalLedgerModuleService.createChartOfAccount(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async updateChartOfAccount(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.updateChartOfAccountSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "generalLedger");
            return service_1.generalLedgerModuleService.updateChartOfAccount(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async deleteChartOfAccount(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.deleteChartOfAccountSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "generalLedger");
            return service_1.generalLedgerModuleService.deleteChartOfAccount(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async createJournalEntry(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.createJournalEntrySchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "generalLedger");
            return service_1.generalLedgerModuleService.createJournalEntry({
                ...payload,
                createdBy: authReq.userContext.uid
            });
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async listJournalEntries(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.listJournalEntriesSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "generalLedger");
            return service_1.generalLedgerModuleService.listJournalEntries(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async getJournalEntryDetail(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.getJournalEntryDetailSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "generalLedger");
            return service_1.generalLedgerModuleService.getJournalEntryDetail(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async postExpenseReportToLedger(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.postExpenseReportToLedgerSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "generalLedger");
            return service_1.generalLedgerModuleService.postExpenseReportToLedger({
                ...payload,
                postedBy: authReq.userContext.uid
            });
        }
        catch (error) {
            throw normalizeError(error);
        }
    }
};
