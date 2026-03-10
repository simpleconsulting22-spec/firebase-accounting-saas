export interface OrgScopedPayload {
  tenantId: string;
  organizationId: string;
}

export interface VendorRecord {
  id: string;
  tenantId: string;
  vendorGroupId: string;
  name: string;
  paymentMethods: string[];
  active: boolean;
  createdAt: string;
}

export interface CategoryRecord {
  id: string;
  tenantId: string;
  categoryGroupId: string;
  organizationId?: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface CreateVendorPayload extends OrgScopedPayload {
  name: string;
  paymentMethods: string[];
  active?: boolean;
}

export interface UpdateVendorPayload extends OrgScopedPayload {
  vendorId: string;
  name?: string;
  paymentMethods?: string[];
  active?: boolean;
}

export interface DeleteVendorPayload extends OrgScopedPayload {
  vendorId: string;
}

export interface CreateCategoryPayload extends OrgScopedPayload {
  name: string;
  active?: boolean;
}

export interface UpdateCategoryPayload extends OrgScopedPayload {
  categoryId: string;
  name?: string;
  active?: boolean;
}

export interface DeleteCategoryPayload extends OrgScopedPayload {
  categoryId: string;
}
