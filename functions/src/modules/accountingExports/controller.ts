import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { ZodError } from "zod";
import { requireAuth } from "../../middleware/auth";
import { assertModuleAccess } from "../../middleware/moduleAccess";
import { assertTenantAndOrganizationAccess } from "../../middleware/tenantOrgAccess";
import { accountingExportService } from "../../services/accountingExportService";
import { AppError } from "../../utils/errors";
import {
  generateQuickbooksExpenseExportSchema,
  listAccountingExportsSchema
} from "./validation";

const mapAppError = (error: AppError): HttpsError => {
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
    return new HttpsError("invalid-argument", error.issues.map((issue) => issue.message).join("; "));
  }
  if (error instanceof AppError) {
    return mapAppError(error);
  }
  return new HttpsError("internal", "Unexpected accounting exports module error.");
};

const assertAdminFinanceRole = (orgRoles: Record<string, string[]>, organizationId: string): void => {
  if (Object.prototype.hasOwnProperty.call(orgRoles, "*")) {
    return;
  }
  const scoped = orgRoles[organizationId] || [];
  if (!scoped.includes("admin") && !scoped.includes("finance")) {
    throw new HttpsError(
      "permission-denied",
      "Only admin or finance role can generate/list accounting exports."
    );
  }
};

export const accountingExportsController = {
  async generateQuickbooksExpenseExport(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = generateQuickbooksExpenseExportSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "financialReports");

      return accountingExportService.generateQuickbooksExpenseExport({
        ...payload,
        generatedBy: authReq.userContext.uid
      });
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async listAccountingExports(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = listAccountingExportsSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "financialReports");

      return accountingExportService.listAccountingExports(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  }
};
