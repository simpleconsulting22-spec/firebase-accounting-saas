import { HttpsError } from "firebase-functions/v2/https";
import { AuthUserContext } from "../services/authService";

export const assertTenantAndOrganizationAccess = (
  user: AuthUserContext,
  tenantId: string,
  organizationId: string
): void => {
  if (user.tenantId !== tenantId) {
    throw new HttpsError("permission-denied", "Tenant mismatch.");
  }

  const hasWildcard = Boolean(user.orgRoles["*"]);
  const hasOrg = Boolean(user.orgRoles[organizationId]);
  if (!hasWildcard && !hasOrg) {
    throw new HttpsError("permission-denied", "Organization access denied.");
  }
};
