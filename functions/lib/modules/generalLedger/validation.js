"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postExpenseReportToLedgerSchema = exports.getJournalEntryDetailSchema = exports.listJournalEntriesSchema = exports.createJournalEntrySchema = exports.deleteChartOfAccountSchema = exports.updateChartOfAccountSchema = exports.createChartOfAccountSchema = exports.listChartOfAccountsSchema = void 0;
const zod_1 = require("zod");
const tenantOrgSchema = zod_1.z.object({
    tenantId: zod_1.z.string().min(1),
    organizationId: zod_1.z.string().min(1)
});
const accountTypeSchema = zod_1.z.enum(["asset", "liability", "equity", "income", "expense"]);
const postingRoleSchema = zod_1.z.enum(["expense_default", "cash_default", "payable_default"]);
const journalStatusSchema = zod_1.z.enum(["DRAFT", "POSTED"]);
exports.listChartOfAccountsSchema = tenantOrgSchema.extend({
    includeInactive: zod_1.z.boolean().optional()
});
exports.createChartOfAccountSchema = tenantOrgSchema.extend({
    accountNumber: zod_1.z.string().min(1),
    accountName: zod_1.z.string().min(1),
    accountType: accountTypeSchema,
    parentAccountId: zod_1.z.string().min(1).optional(),
    postingRole: postingRoleSchema.optional(),
    active: zod_1.z.boolean().optional()
});
exports.updateChartOfAccountSchema = tenantOrgSchema.extend({
    accountId: zod_1.z.string().min(1),
    accountNumber: zod_1.z.string().min(1).optional(),
    accountName: zod_1.z.string().min(1).optional(),
    accountType: accountTypeSchema.optional(),
    parentAccountId: zod_1.z.union([zod_1.z.string().min(1), zod_1.z.null()]).optional(),
    postingRole: zod_1.z.union([postingRoleSchema, zod_1.z.null()]).optional(),
    active: zod_1.z.boolean().optional()
});
exports.deleteChartOfAccountSchema = tenantOrgSchema.extend({
    accountId: zod_1.z.string().min(1)
});
const journalLineSchema = zod_1.z.object({
    accountId: zod_1.z.string().min(1),
    debit: zod_1.z.number().nonnegative(),
    credit: zod_1.z.number().nonnegative(),
    memo: zod_1.z.string().optional(),
    className: zod_1.z.string().optional(),
    tagName: zod_1.z.string().optional()
});
exports.createJournalEntrySchema = tenantOrgSchema.extend({
    date: zod_1.z.string().min(1),
    reference: zod_1.z.string().min(1),
    sourceModule: zod_1.z.string().min(1),
    sourceId: zod_1.z.string().min(1),
    memo: zod_1.z.string().optional(),
    lines: zod_1.z.array(journalLineSchema).min(1),
    status: journalStatusSchema.optional()
});
exports.listJournalEntriesSchema = tenantOrgSchema.extend({
    status: journalStatusSchema.optional(),
    limit: zod_1.z.number().int().positive().max(200).optional()
});
exports.getJournalEntryDetailSchema = tenantOrgSchema.extend({
    journalEntryId: zod_1.z.string().min(1)
});
exports.postExpenseReportToLedgerSchema = tenantOrgSchema.extend({
    reportId: zod_1.z.string().min(1),
    date: zod_1.z.string().optional(),
    reference: zod_1.z.string().optional(),
    memo: zod_1.z.string().optional()
});
