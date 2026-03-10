import { ModuleKey } from "../config/collections";
import { moduleAccessService } from "../services/moduleAccessService";

export const assertModuleAccess = async (tenantId: string, moduleKey: ModuleKey): Promise<void> => {
  await moduleAccessService.assertEnabled(tenantId, moduleKey);
};
