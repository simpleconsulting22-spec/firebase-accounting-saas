"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moduleAccessService = void 0;
const firestore_1 = require("../utils/firestore");
const collections_1 = require("../config/collections");
const errors_1 = require("../utils/errors");
exports.moduleAccessService = {
    async assertEnabled(tenantId, moduleKey) {
        const tenant = await firestore_1.db.collection(collections_1.COLLECTIONS.tenants).doc(tenantId).get();
        if (!tenant.exists) {
            throw new errors_1.AppError("Tenant not found", "tenant/not-found", 404);
        }
        const modulesEnabled = tenant.data().modulesEnabled || {};
        if (!modulesEnabled[moduleKey]) {
            throw new errors_1.AppError(`Module '${moduleKey}' is disabled for tenant`, "module/disabled", 403);
        }
    }
};
