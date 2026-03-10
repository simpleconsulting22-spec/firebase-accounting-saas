import { db } from "../utils/firestore";
import { COLLECTIONS, ModuleKey } from "../config/collections";
import { AppError } from "../utils/errors";

export const moduleAccessService = {
  async assertEnabled(tenantId: string, moduleKey: ModuleKey): Promise<void> {
    const tenant = await db.collection(COLLECTIONS.tenants).doc(tenantId).get();
    if (!tenant.exists) {
      throw new AppError("Tenant not found", "tenant/not-found", 404);
    }

    const modulesEnabled = (tenant.data() as any).modulesEnabled || {};
    if (!modulesEnabled[moduleKey]) {
      throw new AppError(`Module '${moduleKey}' is disabled for tenant`, "module/disabled", 403);
    }
  }
};
