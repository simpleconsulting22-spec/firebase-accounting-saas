"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expensesController = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const tenantOrgAccess_1 = require("../../middleware/tenantOrgAccess");
const moduleAccess_1 = require("../../middleware/moduleAccess");
const budgetService_1 = require("../../services/budgetService");
const expenseService_1 = require("../../services/expenseService");
const errors_1 = require("../../utils/errors");
const validation_1 = require("./validation");
const appErrorToHttps = (error) => {
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
        return new https_1.HttpsError("invalid-argument", error.issues.map((item) => item.message).join("; "));
    }
    if (error instanceof errors_1.AppError) {
        return appErrorToHttps(error);
    }
    return new https_1.HttpsError("internal", "Unexpected expenses module error.");
};
const hasAnyRole = (orgRoles, organizationId, allowedRoles) => {
    if (Object.prototype.hasOwnProperty.call(orgRoles, "*")) {
        return true;
    }
    const roles = orgRoles[organizationId] || [];
    return roles.some((role) => allowedRoles.includes(role));
};
const assertRole = (orgRoles, organizationId, allowedRoles, message) => {
    if (!hasAnyRole(orgRoles, organizationId, allowedRoles)) {
        throw new https_1.HttpsError("permission-denied", message);
    }
};
exports.expensesController = {
    async createPurchaseRequest(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.createPurchaseRequestSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertRole(authReq.userContext.orgRoles, payload.organizationId, ["requestor", "admin"], "Only requestor or admin can create purchase requests.");
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return expenseService_1.expenseService.createPurchaseRequest({
                ...payload,
                requestorId: authReq.userContext.uid
            });
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async updateDraftPurchaseRequest(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.updateDraftPurchaseRequestSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertRole(authReq.userContext.orgRoles, payload.organizationId, ["requestor", "admin"], "Only requestor or admin can update draft purchase requests.");
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return expenseService_1.expenseService.updateDraftPurchaseRequest(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async submitPurchaseRequest(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.requestActionSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertRole(authReq.userContext.orgRoles, payload.organizationId, ["requestor", "admin"], "Only requestor or admin can submit purchase requests.");
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return expenseService_1.expenseService.submitPurchaseRequest({
                ...payload,
                submittedBy: authReq.userContext.uid
            });
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async getPurchaseRequestDetail(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.requestActionSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return expenseService_1.expenseService.getPurchaseRequestDetail(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async createExpenseReport(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.createExpenseReportSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertRole(authReq.userContext.orgRoles, payload.organizationId, ["requestor", "admin"], "Only requestor or admin can create expense reports.");
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return expenseService_1.expenseService.createExpenseReport({
                ...payload,
                createdBy: authReq.userContext.uid
            });
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async upsertExpenseLineItem(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.upsertExpenseLineItemSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertRole(authReq.userContext.orgRoles, payload.organizationId, ["requestor", "admin"], "Only requestor or admin can edit expense line items.");
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return expenseService_1.expenseService.upsertExpenseLineItem({
                ...payload,
                updatedBy: authReq.userContext.uid
            });
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async applyPurchaseRequestApprovalAction(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.purchaseRequestApprovalActionSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            assertRole(authReq.userContext.orgRoles, payload.organizationId, ["approver", "admin"], "Only approver or admin can perform purchase request approval actions.");
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return expenseService_1.expenseService.applyPurchaseRequestApprovalAction({
                ...payload,
                actedBy: authReq.userContext.uid
            });
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async applyExpenseReportApprovalAction(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.expenseReportApprovalActionSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            if (payload.action === "SUBMIT") {
                assertRole(authReq.userContext.orgRoles, payload.organizationId, ["requestor", "admin"], "Only requestor or admin can submit expense reports.");
            }
            else {
                assertRole(authReq.userContext.orgRoles, payload.organizationId, ["finance", "admin"], "Only finance or admin can perform expense report approval actions.");
            }
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return expenseService_1.expenseService.applyExpenseReportApprovalAction({
                ...payload,
                actedBy: authReq.userContext.uid
            });
        }
        catch (error) {
            throw normalizeError(error);
        }
    },
    async getBudgetSnapshot(request) {
        const authReq = await (0, auth_1.requireAuth)(request);
        try {
            const payload = validation_1.getBudgetSnapshotSchema.parse(request.data || {});
            (0, tenantOrgAccess_1.assertTenantAndOrganizationAccess)(authReq.userContext, payload.tenantId, payload.organizationId);
            await (0, moduleAccess_1.assertModuleAccess)(payload.tenantId, "expenses");
            return budgetService_1.budgetService.getFundBudgetSnapshot(payload);
        }
        catch (error) {
            throw normalizeError(error);
        }
    }
};
