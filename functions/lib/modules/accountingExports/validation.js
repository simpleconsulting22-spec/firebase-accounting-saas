"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAccountingExportsSchema = exports.generateQuickbooksExpenseExportSchema = exports.accountingExportTenantOrgSchema = void 0;
const zod_1 = require("zod");
exports.accountingExportTenantOrgSchema = zod_1.z.object({
    tenantId: zod_1.z.string().min(1),
    organizationId: zod_1.z.string().min(1)
});
exports.generateQuickbooksExpenseExportSchema = exports.accountingExportTenantOrgSchema.extend({
    dateFrom: zod_1.z.string().min(1),
    dateTo: zod_1.z.string().min(1)
});
exports.listAccountingExportsSchema = exports.accountingExportTenantOrgSchema.extend({
    limit: zod_1.z.number().int().positive().max(100).optional()
});
