import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { ZodError } from "zod";
import { requireAuth } from "../../middleware/auth";
import { assertModuleAccess } from "../../middleware/moduleAccess";
import { assertTenantAndOrganizationAccess } from "../../middleware/tenantOrgAccess";
import { AppError } from "../../utils/errors";
import { vendorService } from "../../services/vendorService";
import {
  createCategorySchema,
  createVendorSchema,
  deleteCategorySchema,
  deleteVendorSchema,
  updateCategorySchema,
  updateVendorSchema,
  vendorOrgScopeSchema
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
  return new HttpsError("internal", "Unexpected vendors module error.");
};

const assertVendorCategoryManagePermission = (orgRoles: Record<string, string[]>, organizationId: string): void => {
  const wildcardRoles = orgRoles["*"] || [];
  const scopedRoles = orgRoles[organizationId] || [];
  const allowed = wildcardRoles.length > 0 || scopedRoles.includes("admin") || scopedRoles.includes("finance");
  if (!allowed) {
    throw new HttpsError(
      "permission-denied",
      "Vendor/category management requires admin or finance role in the organization."
    );
  }
};

export const vendorsController = {
  async listVendors(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = vendorOrgScopeSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "expenses");
      return vendorService.listVendorsForOrganization(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async createVendor(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = createVendorSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertVendorCategoryManagePermission(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "expenses");
      return vendorService.createVendor(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async updateVendor(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = updateVendorSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertVendorCategoryManagePermission(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "expenses");
      return vendorService.updateVendor(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async deleteVendor(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = deleteVendorSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertVendorCategoryManagePermission(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "expenses");
      return vendorService.deleteVendor(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async listCategories(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = vendorOrgScopeSchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "expenses");
      return vendorService.listCategoriesForOrganization(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async createCategory(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = createCategorySchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertVendorCategoryManagePermission(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "expenses");
      return vendorService.createCategory(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async updateCategory(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = updateCategorySchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertVendorCategoryManagePermission(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "expenses");
      return vendorService.updateCategory(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  },

  async deleteCategory(request: CallableRequest<unknown>) {
    const authReq = await requireAuth(request);

    try {
      const payload = deleteCategorySchema.parse(request.data || {});
      assertTenantAndOrganizationAccess(authReq.userContext, payload.tenantId, payload.organizationId);
      assertVendorCategoryManagePermission(authReq.userContext.orgRoles, payload.organizationId);
      await assertModuleAccess(payload.tenantId, "expenses");
      return vendorService.deleteCategory(payload);
    } catch (error) {
      throw normalizeError(error);
    }
  }
};
