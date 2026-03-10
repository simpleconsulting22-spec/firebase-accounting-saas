import { z } from "zod";

export const accountingExportTenantOrgSchema = z.object({
  tenantId: z.string().min(1),
  organizationId: z.string().min(1)
});

export const generateQuickbooksExpenseExportSchema = accountingExportTenantOrgSchema.extend({
  dateFrom: z.string().min(1),
  dateTo: z.string().min(1)
});

export const listAccountingExportsSchema = accountingExportTenantOrgSchema.extend({
  limit: z.number().int().positive().max(100).optional()
});
