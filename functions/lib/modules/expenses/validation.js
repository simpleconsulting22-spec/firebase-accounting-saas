"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expenseReportApprovalActionSchema = exports.purchaseRequestApprovalActionSchema = exports.getBudgetSnapshotSchema = exports.upsertExpenseLineItemSchema = exports.createExpenseReportSchema = exports.requestActionSchema = exports.updateDraftPurchaseRequestSchema = exports.createPurchaseRequestSchema = exports.tenantOrgSchema = void 0;
const zod_1 = require("zod");
exports.tenantOrgSchema = zod_1.z.object({
    tenantId: zod_1.z.string().min(1),
    organizationId: zod_1.z.string().min(1)
});
exports.createPurchaseRequestSchema = exports.tenantOrgSchema.extend({
    fundId: zod_1.z.string().min(1),
    ministryDepartment: zod_1.z.string().min(1),
    approverId: zod_1.z.string().min(1),
    estimatedAmount: zod_1.z.number().nonnegative(),
    plannedPaymentMethod: zod_1.z.string().min(1),
    purpose: zod_1.z.string().min(1),
    description: zod_1.z.string().optional().default(""),
    requestedExpenseDate: zod_1.z.string().min(1)
});
exports.updateDraftPurchaseRequestSchema = exports.createPurchaseRequestSchema.extend({
    requestId: zod_1.z.string().min(1)
});
exports.requestActionSchema = exports.tenantOrgSchema.extend({
    requestId: zod_1.z.string().min(1)
});
exports.createExpenseReportSchema = exports.requestActionSchema;
exports.upsertExpenseLineItemSchema = exports.tenantOrgSchema.extend({
    requestId: zod_1.z.string().min(1),
    reportId: zod_1.z.string().min(1),
    lineItemId: zod_1.z.string().min(1).optional(),
    vendorId: zod_1.z.string().min(1),
    categoryId: zod_1.z.string().min(1),
    amount: zod_1.z.number().positive(),
    expenseDate: zod_1.z.string().min(1),
    description: zod_1.z.string().optional().default(""),
    receiptUrl: zod_1.z.string().url().optional()
});
exports.getBudgetSnapshotSchema = exports.tenantOrgSchema.extend({
    fundId: zod_1.z.string().min(1)
});
exports.purchaseRequestApprovalActionSchema = exports.tenantOrgSchema.extend({
    requestId: zod_1.z.string().min(1),
    action: zod_1.z.enum(["APPROVE", "REJECT", "REQUEST_REVISIONS"]),
    comments: zod_1.z.string().optional().default("")
});
exports.expenseReportApprovalActionSchema = exports.tenantOrgSchema.extend({
    requestId: zod_1.z.string().min(1),
    reportId: zod_1.z.string().min(1),
    action: zod_1.z.enum(["SUBMIT", "APPROVE", "REJECT", "REQUEST_REVISIONS", "MARK_PAY"]),
    comments: zod_1.z.string().optional().default("")
});
