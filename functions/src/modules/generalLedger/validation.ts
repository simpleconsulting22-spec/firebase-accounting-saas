import { z } from "zod";

const tenantOrgSchema = z.object({
  tenantId: z.string().min(1),
  organizationId: z.string().min(1)
});

const accountTypeSchema = z.enum(["asset", "liability", "equity", "income", "expense"]);
const postingRoleSchema = z.enum(["expense_default", "cash_default", "payable_default"]);
const journalStatusSchema = z.enum(["DRAFT", "POSTED"]);

export const listChartOfAccountsSchema = tenantOrgSchema.extend({
  includeInactive: z.boolean().optional()
});

export const createChartOfAccountSchema = tenantOrgSchema.extend({
  accountNumber: z.string().min(1),
  accountName: z.string().min(1),
  accountType: accountTypeSchema,
  parentAccountId: z.string().min(1).optional(),
  postingRole: postingRoleSchema.optional(),
  active: z.boolean().optional()
});

export const updateChartOfAccountSchema = tenantOrgSchema.extend({
  accountId: z.string().min(1),
  accountNumber: z.string().min(1).optional(),
  accountName: z.string().min(1).optional(),
  accountType: accountTypeSchema.optional(),
  parentAccountId: z.union([z.string().min(1), z.null()]).optional(),
  postingRole: z.union([postingRoleSchema, z.null()]).optional(),
  active: z.boolean().optional()
});

export const deleteChartOfAccountSchema = tenantOrgSchema.extend({
  accountId: z.string().min(1)
});

const journalLineSchema = z.object({
  accountId: z.string().min(1),
  debit: z.number().nonnegative(),
  credit: z.number().nonnegative(),
  memo: z.string().optional(),
  className: z.string().optional(),
  tagName: z.string().optional()
});

export const createJournalEntrySchema = tenantOrgSchema.extend({
  date: z.string().min(1),
  reference: z.string().min(1),
  sourceModule: z.string().min(1),
  sourceId: z.string().min(1),
  memo: z.string().optional(),
  lines: z.array(journalLineSchema).min(1),
  status: journalStatusSchema.optional()
});

export const listJournalEntriesSchema = tenantOrgSchema.extend({
  status: journalStatusSchema.optional(),
  limit: z.number().int().positive().max(200).optional()
});

export const getJournalEntryDetailSchema = tenantOrgSchema.extend({
  journalEntryId: z.string().min(1)
});

export const postExpenseReportToLedgerSchema = tenantOrgSchema.extend({
  reportId: z.string().min(1),
  date: z.string().optional(),
  reference: z.string().optional(),
  memo: z.string().optional()
});
