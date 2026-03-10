import { z } from "zod";

export const tenantOrgSchema = z.object({
  tenantId: z.string().min(1),
  organizationId: z.string().min(1)
});

export const createPurchaseRequestSchema = tenantOrgSchema.extend({
  fundId: z.string().min(1),
  ministryDepartment: z.string().min(1),
  approverId: z.string().min(1),
  estimatedAmount: z.number().nonnegative(),
  plannedPaymentMethod: z.string().min(1),
  purpose: z.string().min(1),
  description: z.string().optional().default(""),
  requestedExpenseDate: z.string().min(1)
});

export const updateDraftPurchaseRequestSchema = createPurchaseRequestSchema.extend({
  requestId: z.string().min(1)
});

export const requestActionSchema = tenantOrgSchema.extend({
  requestId: z.string().min(1)
});

export const createExpenseReportSchema = requestActionSchema;

export const upsertExpenseLineItemSchema = tenantOrgSchema.extend({
  requestId: z.string().min(1),
  reportId: z.string().min(1),
  lineItemId: z.string().min(1).optional(),
  vendorId: z.string().min(1),
  categoryId: z.string().min(1),
  amount: z.number().positive(),
  expenseDate: z.string().min(1),
  description: z.string().optional().default(""),
  receiptUrl: z.string().url().optional()
});

export const getBudgetSnapshotSchema = tenantOrgSchema.extend({
  fundId: z.string().min(1)
});

export const purchaseRequestApprovalActionSchema = tenantOrgSchema.extend({
  requestId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT", "REQUEST_REVISIONS"]),
  comments: z.string().optional().default("")
});

export const expenseReportApprovalActionSchema = tenantOrgSchema.extend({
  requestId: z.string().min(1),
  reportId: z.string().min(1),
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "REQUEST_REVISIONS", "MARK_PAY"]),
  comments: z.string().optional().default("")
});
