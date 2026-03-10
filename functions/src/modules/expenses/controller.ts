import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { ZodError } from "zod";
import { requireAuth } from "../../middleware/auth";
import { assertTenantAndOrganizationAccess } from "../../middleware/tenantOrgAccess";
import { assertModuleAccess } from "../../middleware/moduleAccess";
import { budgetService } from "../../services/budgetService";
import { expenseService } from "../../services/expenseService";
import { AppError } from "../../utils/errors";
import {
  createExpenseReportSchema,
  createPurchaseRequestSchema,
  expenseReportApprovalActionSchema,
  getBudgetSnapshotSchema,
  purchaseRequestApprovalActionSchema,
  requestActionSchema,
  updateDraftPurchaseRequestSchema,
  upsertExpenseLineItemSchema
} from "./validation";

const appErrorToHttps = (error: AppError): HttpsError => {
  if (error.status === 400) {
    return new HttpsError("invalid-argument", error.message);
  }
  if (error.status === 403) {
    return new HttpsError("permission-denied", error.message);
  }
  if (error.status === 404) {
    return new HttpsError("not-found", error.message);
  }
  if (error.status === 409) {
    return new HttpsError("already-exists", error.message);
  }
  if (error.status === 412) {
    return new HttpsError("failed-precondition", error.message);
  }
  return new HttpsError("internal", error.message);
};

const normalizeError = (error: unknown): HttpsError => {
  if (error instanceof HttpsError) {
    return error;
  }
  if (error instanceof ZodError) {
    return new HttpsError("invalid-argument", error.issues.map((item) => item.message).join("; "));
  }
  if (error instanceof AppError) {
    return appErrorToHttps(error);
  }
  return new HttpsError("internal", "Unexpected expenses module error.");
};

const hasAnyRole = (
  orgRoles: Record<string, string[]>,
  organizationId: string,
  allowedRoles: string[]
): boolean => {
  if (Object.prototype.hasOwnProperty.call(orgRoles, "*")) {
    return true;
  }
  const roles = orgRoles[organizationId] || [];
  return roles.some((role) => allowedRoles.includes(role));
};

const assertRole = (
  orgRoles: Record<string, string[]>,
  organizationId: string,
  allowedRoles: string[],
  message: string
): void => {
  if (!hasAnyRole(orgRoles, organizationId, allowedRoles)) {
    throw new HttpsError("permission-denied", message);
  }
};

export const expensesController = {
  async createPurchaseRequest(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = createPurchaseRequestSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertRole(
        authReq.userContext.orgRoles,
        payload.organizationId,
        ["requestor", "admin"],
        "Only requestor or admin can create purchase requests."
      );
      await assertModuleAccess(payload.tenantId, "expenses");

      return expenseService.createPurchaseRequest({
        ...payload,
        requestorId: authReq.userContext.uid
      });
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async updateDraftPurchaseRequest(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = updateDraftPurchaseRequestSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertRole(
        authReq.userContext.orgRoles,
        payload.organizationId,
        ["requestor", "admin"],
        "Only requestor or admin can update draft purchase requests."
      );
      await assertModuleAccess(payload.tenantId, "expenses");

      return expenseService.updateDraftPurchaseRequest(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async submitPurchaseRequest(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = requestActionSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertRole(
        authReq.userContext.orgRoles,
        payload.organizationId,
        ["requestor", "admin"],
        "Only requestor or admin can submit purchase requests."
      );
      await assertModuleAccess(payload.tenantId, "expenses");

      return expenseService.submitPurchaseRequest({
        ...payload,
        submittedBy: authReq.userContext.uid
      });
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async getPurchaseRequestDetail(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = requestActionSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "expenses");

      return expenseService.getPurchaseRequestDetail(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async createExpenseReport(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = createExpenseReportSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertRole(
        authReq.userContext.orgRoles,
        payload.organizationId,
        ["requestor", "admin"],
        "Only requestor or admin can create expense reports."
      );
      await assertModuleAccess(payload.tenantId, "expenses");

      return expenseService.createExpenseReport({
        ...payload,
        createdBy: authReq.userContext.uid
      });
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async upsertExpenseLineItem(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = upsertExpenseLineItemSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertRole(
        authReq.userContext.orgRoles,
        payload.organizationId,
        ["requestor", "admin"],
        "Only requestor or admin can edit expense line items."
      );
      await assertModuleAccess(payload.tenantId, "expenses");

      return expenseService.upsertExpenseLineItem({
        ...payload,
        updatedBy: authReq.userContext.uid
      });
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async applyPurchaseRequestApprovalAction(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = purchaseRequestApprovalActionSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertRole(
        authReq.userContext.orgRoles,
        payload.organizationId,
        ["approver", "admin"],
        "Only approver or admin can perform purchase request approval actions."
      );
      await assertModuleAccess(payload.tenantId, "expenses");

      return expenseService.applyPurchaseRequestApprovalAction({
        ...payload,
        actedBy: authReq.userContext.uid
      });
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async applyExpenseReportApprovalAction(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = expenseReportApprovalActionSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      if (payload.action === "SUBMIT") {
        assertRole(
          authReq.userContext.orgRoles,
          payload.organizationId,
          ["requestor", "admin"],
          "Only requestor or admin can submit expense reports."
        );
      } else {
        assertRole(
          authReq.userContext.orgRoles,
          payload.organizationId,
          ["finance", "admin"],
          "Only finance or admin can perform expense report approval actions."
        );
      }
      await assertModuleAccess(payload.tenantId, "expenses");

      return expenseService.applyExpenseReportApprovalAction({
        ...payload,
        actedBy: authReq.userContext.uid
      });
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async getBudgetSnapshot(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = getBudgetSnapshotSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "expenses");

      return budgetService.getFundBudgetSnapshot(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  }
};
