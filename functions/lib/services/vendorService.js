"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorService = void 0;
const firestore_1 = require("firebase-admin/firestore");
const collections_1 = require("../config/collections");
const errors_1 = require("../utils/errors");
const firestore_2 = require("../utils/firestore");
const assertTenant = (tenantId, data, entityName) => {
    if (String(data.tenantId || "") !== tenantId) {
        throw new errors_1.AppError(`${entityName} does not belong to this tenant.`, `${entityName}/forbidden`, 403);
    }
};
const getOrganizationOrThrow = async (tenantId, organizationId) => {
    const orgSnap = await firestore_2.db.collection(collections_1.COLLECTIONS.organizations).doc(organizationId).get();
    if (!orgSnap.exists) {
        throw new errors_1.AppError("Organization not found.", "organization/not-found", 404);
    }
    const organization = orgSnap.data();
    assertTenant(tenantId, organization, "organization");
    return { id: orgSnap.id, data: organization };
};
const getVendorOrThrow = async (vendorId) => {
    const vendorSnap = await firestore_2.db.collection(collections_1.COLLECTIONS.vendors).doc(vendorId).get();
    if (!vendorSnap.exists) {
        throw new errors_1.AppError("Vendor not found.", "vendor/not-found", 404);
    }
    return { id: vendorSnap.id, data: vendorSnap.data() };
};
const getCategoryOrThrow = async (categoryId) => {
    const categorySnap = await firestore_2.db.collection(collections_1.COLLECTIONS.categories).doc(categoryId).get();
    if (!categorySnap.exists) {
        throw new errors_1.AppError("Category not found.", "category/not-found", 404);
    }
    return { id: categorySnap.id, data: categorySnap.data() };
};
const assertVendorGroupAccess = (vendor, organization, tenantId) => {
    assertTenant(tenantId, vendor, "vendor");
    if (vendor.vendorGroupId !== organization.vendorGroupId) {
        throw new errors_1.AppError("Vendor is outside the organization's vendor group.", "vendor/group-forbidden", 403);
    }
};
const assertCategoryGroupAccess = (category, organization, tenantId) => {
    assertTenant(tenantId, category, "category");
    if (category.categoryGroupId !== organization.categoryGroupId) {
        throw new errors_1.AppError("Category is outside the organization's category group.", "category/group-forbidden", 403);
    }
};
exports.vendorService = {
    async listVendorsForOrganization(input) {
        const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
        const vendorSnap = await firestore_2.db
            .collection(collections_1.COLLECTIONS.vendors)
            .where("tenantId", "==", input.tenantId)
            .where("vendorGroupId", "==", organization.data.vendorGroupId)
            .get();
        return vendorSnap.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => a.name.localeCompare(b.name));
    },
    async createVendor(input) {
        const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
        const vendor = {
            tenantId: input.tenantId,
            vendorGroupId: organization.data.vendorGroupId,
            name: input.name,
            paymentMethods: input.paymentMethods,
            createdAt: firestore_1.Timestamp.now(),
            active: input.active ?? true
        };
        const ref = await firestore_2.db.collection(collections_1.COLLECTIONS.vendors).add(vendor);
        return { vendorId: ref.id };
    },
    async updateVendor(input) {
        const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
        const existing = await getVendorOrThrow(input.vendorId);
        assertVendorGroupAccess(existing.data, organization.data, input.tenantId);
        const updates = {};
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
            throw new errors_1.AppError("No vendor fields provided for update.", "vendor/no-updates", 400);
        }
        await firestore_2.db.collection(collections_1.COLLECTIONS.vendors).doc(input.vendorId).update(updates);
        return { vendorId: input.vendorId };
    },
    async deleteVendor(input) {
        const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
        const existing = await getVendorOrThrow(input.vendorId);
        assertVendorGroupAccess(existing.data, organization.data, input.tenantId);
        await firestore_2.db.collection(collections_1.COLLECTIONS.vendors).doc(input.vendorId).delete();
        return { vendorId: input.vendorId };
    },
    async listCategoriesForOrganization(input) {
        const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
        const categorySnap = await firestore_2.db
            .collection(collections_1.COLLECTIONS.categories)
            .where("tenantId", "==", input.tenantId)
            .where("categoryGroupId", "==", organization.data.categoryGroupId)
            .get();
        return categorySnap.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => a.name.localeCompare(b.name));
    },
    async createCategory(input) {
        const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
        const category = {
            tenantId: input.tenantId,
            categoryGroupId: organization.data.categoryGroupId,
            organizationId: input.organizationId,
            name: input.name,
            active: input.active ?? true,
            createdAt: firestore_1.Timestamp.now()
        };
        const ref = await firestore_2.db.collection(collections_1.COLLECTIONS.categories).add(category);
        return { categoryId: ref.id };
    },
    async updateCategory(input) {
        const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
        const existing = await getCategoryOrThrow(input.categoryId);
        assertCategoryGroupAccess(existing.data, organization.data, input.tenantId);
        const updates = {};
        if (typeof input.name === "string") {
            updates.name = input.name;
        }
        if (typeof input.active === "boolean") {
            updates.active = input.active;
        }
        if (Object.keys(updates).length === 0) {
            throw new errors_1.AppError("No category fields provided for update.", "category/no-updates", 400);
        }
        await firestore_2.db.collection(collections_1.COLLECTIONS.categories).doc(input.categoryId).update(updates);
        return { categoryId: input.categoryId };
    },
    async deleteCategory(input) {
        const organization = await getOrganizationOrThrow(input.tenantId, input.organizationId);
        const existing = await getCategoryOrThrow(input.categoryId);
        assertCategoryGroupAccess(existing.data, organization.data, input.tenantId);
        await firestore_2.db.collection(collections_1.COLLECTIONS.categories).doc(input.categoryId).delete();
        return { categoryId: input.categoryId };
    }
};
