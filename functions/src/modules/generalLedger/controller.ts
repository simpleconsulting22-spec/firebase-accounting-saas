import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { ZodError } from "zod";
import { requireAuth } from "../../middleware/auth";
import { assertModuleAccess } from "../../middleware/moduleAccess";
import { assertTenantAndOrganizationAccess } from "../../middleware/tenantOrgAccess";
import { AppError } from "../../utils/errors";
import { generalLedgerModuleService } from "./service";
import {
  createChartOfAccountSchema,
  createJournalEntrySchema,
  deleteChartOfAccountSchema,
  getJournalEntryDetailSchema,
  listChartOfAccountsSchema,
  listJournalEntriesSchema,
  postExpenseReportToLedgerSchema,
  updateChartOfAccountSchema
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
  return new HttpsError("internal", "Unexpected general ledger module error.");
};

const assertAdminFinanceRole = (orgRoles: Record<string, string[]>, organizationId: string): void => {
  if (Object.prototype.hasOwnProperty.call(orgRoles, "*")) {
    return;
  }

  const roles = orgRoles[organizationId] || [];
  if (!roles.includes("admin") && !roles.includes("finance")) {
    throw new HttpsError("permission-denied", "General ledger actions require admin or finance role.");
  }
};

export const generalLedgerController = {
  async listChartOfAccounts(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = listChartOfAccountsSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "generalLedger");

      return generalLedgerModuleService.listChartOfAccounts(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async createChartOfAccount(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = createChartOfAccountSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "generalLedger");

      return generalLedgerModuleService.createChartOfAccount(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async updateChartOfAccount(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = updateChartOfAccountSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "generalLedger");

      return generalLedgerModuleService.updateChartOfAccount(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async deleteChartOfAccount(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = deleteChartOfAccountSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "generalLedger");

      return generalLedgerModuleService.deleteChartOfAccount(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async createJournalEntry(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = createJournalEntrySchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "generalLedger");

      return generalLedgerModuleService.createJournalEntry({
        ...payload,
        createdBy: authReq.userContext.uid
      });
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async listJournalEntries(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = listJournalEntriesSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "generalLedger");

      return generalLedgerModuleService.listJournalEntries(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async getJournalEntryDetail(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = getJournalEntryDetailSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "generalLedger");

      return generalLedgerModuleService.getJournalEntryDetail(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async postExpenseReportToLedger(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = postExpenseReportToLedgerSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertAdminFinanceRole(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "generalLedger");

      return generalLedgerModuleService.postExpenseReportToLedger({
        ...payload,
        postedBy: authReq.userContext.uid
      });
    } catch (error) {
      throw normalizeError(error);
    }
  }
};
