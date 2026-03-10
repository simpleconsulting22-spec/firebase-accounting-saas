"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertModuleAccess = void 0;
const moduleAccessService_1 = require("../services/moduleAccessService");
const assertModuleAccess = async (tenantId, moduleKey) => {
    await moduleAccessService_1.moduleAccessService.assertEnabled(tenantId, moduleKey);
};
exports.assertModuleAccess = assertModuleAccess;
