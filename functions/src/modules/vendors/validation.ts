import { z } from "zod";

export const vendorOrgScopeSchema = z.object({
  tenantId: z.string().min(1),
  organizationId: z.string().min(1)
});

export const createVendorSchema = vendorOrgScopeSchema.extend({
  name: z.string().min(1),
  paymentMethods: z.array(z.string().min(1)).default([]),
  active: z.boolean().optional()
});

export const updateVendorSchema = vendorOrgScopeSchema.extend({
  vendorId: z.string().min(1),
  name: z.string().min(1).optional(),
  paymentMethods: z.array(z.string().min(1)).optional(),
  active: z.boolean().optional()
});

export const deleteVendorSchema = vendorOrgScopeSchema.extend({
  vendorId: z.string().min(1)
});

export const createCategorySchema = vendorOrgScopeSchema.extend({
  name: z.string().min(1),
  active: z.boolean().optional()
});

export const updateCategorySchema = vendorOrgScopeSchema.extend({
  categoryId: z.string().min(1),
  name: z.string().min(1).optional(),
  active: z.boolean().optional()
});

export const deleteCategorySchema = vendorOrgScopeSchema.extend({
  categoryId: z.string().min(1)
});
