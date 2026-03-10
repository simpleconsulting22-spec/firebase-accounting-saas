"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertTenantAndOrganizationAccess = void 0;
const https_1 = require("firebase-functions/v2/https");
const assertTenantAndOrganizationAccess = (user, tenantId, organizationId) => {
    if (user.tenantId !== tenantId) {
        throw new https_1.HttpsError("permission-denied", "Tenant mismatch.");
    }
    const hasWildcard = Boolean(user.orgRoles["*"]);
    const hasOrg = Boolean(user.orgRoles[organizationId]);
    if (!hasWildcard && !hasOrg) {
        throw new https_1.HttpsError("permission-denied", "Organization access denied.");
    }
};
exports.assertTenantAndOrganizationAccess = assertTenantAndOrganizationAccess;
