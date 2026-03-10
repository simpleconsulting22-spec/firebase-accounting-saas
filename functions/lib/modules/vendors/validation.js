"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategorySchema = exports.updateCategorySchema = exports.createCategorySchema = exports.deleteVendorSchema = exports.updateVendorSchema = exports.createVendorSchema = exports.vendorOrgScopeSchema = void 0;
const zod_1 = require("zod");
exports.vendorOrgScopeSchema = zod_1.z.object({
    tenantId: zod_1.z.string().min(1),
    organizationId: zod_1.z.string().min(1)
});
exports.createVendorSchema = exports.vendorOrgScopeSchema.extend({
    name: zod_1.z.string().min(1),
    paymentMethods: zod_1.z.array(zod_1.z.string().min(1)).default([]),
    active: zod_1.z.boolean().optional()
});
exports.updateVendorSchema = exports.vendorOrgScopeSchema.extend({
    vendorId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1).optional(),
    paymentMethods: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    active: zod_1.z.boolean().optional()
});
exports.deleteVendorSchema = exports.vendorOrgScopeSchema.extend({
    vendorId: zod_1.z.string().min(1)
});
exports.createCategorySchema = exports.vendorOrgScopeSchema.extend({
    name: zod_1.z.string().min(1),
    active: zod_1.z.boolean().optional()
});
exports.updateCategorySchema = exports.vendorOrgScopeSchema.extend({
    categoryId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1).optional(),
    active: zod_1.z.boolean().optional()
});
exports.deleteCategorySchema = exports.vendorOrgScopeSchema.extend({
    categoryId: zod_1.z.string().min(1)
});
