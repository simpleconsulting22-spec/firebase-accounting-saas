import { Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS } from "../config/collections";
import { Category, Organization, Vendor } from "../models";
import { AppError } from "../utils/errors";
import { db } from "../utils/firestore";

export interface OrgScopedInput {
  tenantId: string;
  organizationId: string;
}

export interface CreateVendorInput extends OrgScopedInput {
  name: string;
  paymentMethods: string[];
  active?: boolean;
}

export interface UpdateVendorInput extends OrgScopedInput {
  vendorId: string;
  name?: string;
  paymentMethods?: string[];
  active?: boolean;
}

export interface DeleteVendorInput extends OrgScopedInput {
  vendorId: string;
}

export interface CreateCategoryInput extends OrgScopedInput {
  name: string;
  active?: boolean;
}

export interface UpdateCategoryInput extends OrgScopedInput {
  categoryId: string;
  name?: string;
  active?: boolean;
}

export interface DeleteCategoryInput extends OrgScopedInput {
  categoryId: string;
}

const assertTenant = (tenantId: string, data: Record<string, unknown>, entityName: string): void => {
  if (String(data.tenantId || "") !== tenantId) {
    throw new AppError(`${entityName} does not belong to this tenant.`, `${entityName}/forbidden`, 403);
  }
};

const getOrganizationOrThrow = async (
  tenantId: string,
  organizationId: string
): Promise<{ id: string; data: Organization }> => {
  const orgSnap = await db.collection(COLLECTIONS.organizations).doc(organizationId).get();
  if (!orgSnap.exists) {
    throw new AppError("Organization not found.", "organization/not-found", 404);
  }

  const organization = orgSnap.data() as Organization;
  assertTenant(tenantId, organization as unknown as Record<string, unknown>, "organization");
  return { id: orgSnap.id, data: organization };
};

const getVendorOrThrow = async (vendorId: string): Promise<{ id: string; data: Vendor }> => {
  const vendorSnap = await db.collection(COLLECTIONS.vendors).doc(vendorId).get();
  if (!vendorSnap.exists) {
    throw new AppError("Vendor not found.", "vendor/not-found", 404);
  }
  return { id: vendorSnap.id, data: vendorSnap.data() as Vendor };
};

const getCategoryOrThrow = async (categoryId: string): Promise<{ id: string; data: Category }> => {
  const categorySnap = await db.collection(COLLECTIONS.categories).doc(categoryId).get();
  if (!categorySnap.exists) {
    throw new AppError("Category not found.", "category/not-found", 404);
  }
  return { id: categorySnap.id, data: categorySnap.data() as Category };
};

const assertVendorGroupAccess = (
  vendor: Vendor,
  organization: Organization,
  tenantId: string
): void => {
  assertTenant(tenantId, vendor as unknown as Record<string, unknown>, "vendor");
  if (vendor.vendorGroupId !== organization.vendorGroupId) {
    throw new AppError(
      "Vendor is outside the organization's vendor group.",
      "vendor/group-forbidden",
      403
    );
  }
};

const assertCategoryGroupAccess = (
  category: Category,
  organization: Organization,
  tenantId: string
): void => {
  assertTenant(tenantId, category as unknown as Record<string, unknown>, "category");
  if (category.categoryGroupId !== organization.categoryGroupId) {
    throw new AppError(
      "Category is outside the organization's category group.",
      "category/group-forbidden",
      403
    );
  }
};

export const vendorService = {
  async listVendorsForOrganization(input: OrgScopedInput): Promise<Array<{ id: string } & Vendor>> {
    const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
    const vendorSnap = await db
      .collection(COLLECTIONS.vendors)
      .where("tenantId", "==", input.tenantId)
      .where("vendorGroupId", "==", organization.data.vendorGroupId)
      .get();

    return vendorSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Vendor) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async createVendor(input: CreateVendorInput): Promise<{ vendorId: string }> {
    const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
    const vendor: Vendor = {
      tenantId: input.tenantId,
      vendorGroupId: organization.data.vendorGroupId,
      name: input.name,
      paymentMethods: input.paymentMethods,
      createdAt: Timestamp.now(),
      active: input.active ?? true
    };

    const ref = await db.collection(COLLECTIONS.vendors).add(vendor);
    return { vendorId: ref.id };
  },

  async updateVendor(input: UpdateVendorInput): Promise<{ vendorId: string }> {
    const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
    const existing = await getVendorOrThrow(input.vendorId);
    assertVendorGroupAccess(existing.data, organization.data, input.tenantId);

    const updates: Partial<Vendor> = {};
    if (typeof input.name === "string") {
      updates.name = input.name;
    }
    if (Array.isArray(input.paymentMethods)) {
      updates.paymentMethods = input.paymentMethods;
    }
    if (typeof input.active === "boolean") {
      updates.active = input.active;
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError("No vendor fields provided for update.", "vendor/no-updates", 400);
    }

    await db.collection(COLLECTIONS.vendors).doc(input.vendorId).update(updates);
    return { vendorId: input.vendorId };
  },

  async deleteVendor(input: DeleteVendorInput): Promise<{ vendorId: string }> {
    const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
    const existing = await getVendorOrThrow(input.vendorId);
    assertVendorGroupAccess(existing.data, organization.data, input.tenantId);

    await db.collection(COLLECTIONS.vendors).doc(input.vendorId).delete();
    return { vendorId: input.vendorId };
  },

  async listCategoriesForOrganization(input: OrgScopedInput): Promise<Array<{ id: string } & Category>> {
    const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
    const categorySnap = await db
      .collection(COLLECTIONS.categories)
      .where("tenantId", "==", input.tenantId)
      .where("categoryGroupId", "==", organization.data.categoryGroupId)
      .get();

    return categorySnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Category) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async createCategory(input: CreateCategoryInput): Promise<{ categoryId: string }> {
    const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
    const category: Category = {
      tenantId: input.tenantId,
      categoryGroupId: organization.data.categoryGroupId,
      organizationId: input.organizationId,
      name: input.name,
      active: input.active ?? true,
      createdAt: Timestamp.now()
    };

    const ref = await db.collection(COLLECTIONS.categories).add(category);
    return { categoryId: ref.id };
  },

  async updateCategory(input: UpdateCategoryInput): Promise<{ categoryId: string }> {
    const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
    const existing = await getCategoryOrThrow(input.categoryId);
    assertCategoryGroupAccess(existing.data, organization.data, input.tenantId);

    const updates: Partial<Category> = {};
    if (typeof input.name === "string") {
      updates.name = input.name;
    }
    if (typeof input.active === "boolean") {
      updates.active = input.active;
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError("No category fields provided for update.", "category/no-updates", 400);
    }

    await db.collection(COLLECTIONS.categories).doc(input.categoryId).update(updates);
    return { categoryId: input.categoryId };
  },

  async deleteCategory(input: DeleteCategoryInput): Promise<{ categoryId: string }> {
    const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
    const existing = await getCategoryOrThrow(input.categoryId);
    assertCategoryGroupAccess(existing.data, organization.data, input.tenantId);

    await db.collection(COLLECTIONS.categories).doc(input.categoryId).delete();
    return { categoryId: input.categoryId };
  }
};
