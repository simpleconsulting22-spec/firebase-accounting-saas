"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chartOfAccountsService = void 0;
const firestore_1 = require("firebase-admin/firestore");
const collections_1 = require("../config/collections");
const errors_1 = require("../utils/errors");
const firestore_2 = require("../utils/firestore");
const normalizeRequired = (value, fieldName) => {
    const normalized = String(value || "").trim();
    if (!normalized) {
        throw new errors_1.AppError(`'${fieldName}' is required.`, `${fieldName}/required`, 400);
    }
    return normalized;
};
const normalizeOptional = (value) => String(value || "").trim();
const assertTenantOrganizationOwnership = (account, tenantId, organizationId) => {
    if (account.tenantId !== tenantId || account.organizationId !== organizationId) {
        throw new errors_1.AppError("Chart of account does not belong to tenant/organization.", "chart-of-accounts/forbidden", 403);
    }
};
const getAccountOrThrow = async (tenantId, organizationId, accountId) => {
    const accountSnap = await firestore_2.db.collection(collections_1.COLLECTIONS.chartOfAccounts).doc(accountId).get();
    if (!accountSnap.exists) {
        throw new errors_1.AppError("Chart of account not found.", "chart-of-accounts/not-found", 404);
    }
    const account = accountSnap.data();
    assertTenantOrganizationOwnership(account, tenantId, organizationId);
    return { id: accountSnap.id, data: account };
};
const assertUniqueAccountNumber = async (tenantId, organizationId, accountNumber, excludeAccountId) => {
    const snap = await firestore_2.db
        .collection(collections_1.COLLECTIONS.chartOfAccounts)
        .where("tenantId", "==", tenantId)
        .where("organizationId", "==", organizationId)
        .where("accountNumber", "==", accountNumber)
        .limit(2)
        .get();
    const conflict = snap.docs.find((doc) => doc.id !== excludeAccountId);
    if (conflict) {
        throw new errors_1.AppError("Account number must be unique within the organization.", "chart-of-accounts/account-number-conflict", 409);
    }
};
const assertUniqueActiveAccountName = async (tenantId, organizationId, accountName, excludeAccountId) => {
    const snap = await firestore_2.db
        .collection(collections_1.COLLECTIONS.chartOfAccounts)
        .where("tenantId", "==", tenantId)
        .where("organizationId", "==", organizationId)
        .where("accountName", "==", accountName)
        .get();
    const conflict = snap.docs.find((doc) => {
        if (doc.id === excludeAccountId) {
            return false;
        }
        const account = doc.data();
        return Boolean(account.active);
    });
    if (conflict) {
        throw new errors_1.AppError("Active account name must be unique within the organization.", "chart-of-accounts/account-name-conflict", 409);
    }
};
const assertValidParentAccount = async (tenantId, organizationId, parentAccountId, currentAccountId) => {
    if (currentAccountId && parentAccountId === currentAccountId) {
        throw new errors_1.AppError("Account cannot be its own parent.", "chart-of-accounts/invalid-parent", 400);
    }
    const parent = await getAccountOrThrow(tenantId, organizationId, parentAccountId);
    if (!parent.data.active) {
        throw new errors_1.AppError("Parent account must be active.", "chart-of-accounts/inactive-parent", 400);
    }
};
const listAccountsBaseQuery = (tenantId, organizationId) => firestore_2.db
    .collection(collections_1.COLLECTIONS.chartOfAccounts)
    .where("tenantId", "==", tenantId)
    .where("organizationId", "==", organizationId);
exports.chartOfAccountsService = {
    async listChartOfAccounts(input) {
        let query = listAccountsBaseQuery(input.tenantId, input.organizationId);
        if (!input.includeInactive) {
            query = query.where("active", "==", true);
        }
        const snap = await query.orderBy("accountNumber", "asc").get();
        return snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));
    },
    async createChartOfAccount(input) {
        const accountNumber = normalizeRequired(input.accountNumber, "accountNumber");
        const accountName = normalizeRequired(input.accountName, "accountName");
        const parentAccountId = normalizeOptional(input.parentAccountId);
        const active = typeof input.active === "boolean" ? input.active : true;
        await assertUniqueAccountNumber(input.tenantId, input.organizationId, accountNumber);
        if (active) {
            await assertUniqueActiveAccountName(input.tenantId, input.organizationId, accountName);
        }
        if (parentAccountId) {
            await assertValidParentAccount(input.tenantId, input.organizationId, parentAccountId);
        }
        const now = firestore_1.Timestamp.now();
        const account = {
            tenantId: input.tenantId,
            organizationId: input.organizationId,
            accountNumber,
            accountName,
            accountType: input.accountType,
            parentAccountId: parentAccountId || undefined,
            postingRole: input.postingRole || undefined,
            active,
            createdAt: now,
            updatedAt: now
        };
        const ref = await firestore_2.db.collection(collections_1.COLLECTIONS.chartOfAccounts).add(account);
        return { accountId: ref.id };
    },
    async updateChartOfAccount(input) {
        const existing = await getAccountOrThrow(input.tenantId, input.organizationId, input.accountId);
        const updates = {};
        let hasBusinessUpdate = false;
        const nextAccountNumber = typeof input.accountNumber === "string"
            ? normalizeRequired(input.accountNumber, "accountNumber")
            : existing.data.accountNumber;
        const nextAccountName = typeof input.accountName === "string"
            ? normalizeRequired(input.accountName, "accountName")
            : existing.data.accountName;
        const nextActive = typeof input.active === "boolean" ? input.active : Boolean(existing.data.active);
        if (typeof input.accountNumber === "string" && nextAccountNumber !== existing.data.accountNumber) {
            await assertUniqueAccountNumber(input.tenantId, input.organizationId, nextAccountNumber, input.accountId);
            updates.accountNumber = nextAccountNumber;
            hasBusinessUpdate = true;
        }
        if (typeof input.accountName === "string" && nextAccountName !== existing.data.accountName) {
            updates.accountName = nextAccountName;
            hasBusinessUpdate = true;
        }
        if (typeof input.active === "boolean" && input.active !== Boolean(existing.data.active)) {
            updates.active = input.active;
            hasBusinessUpdate = true;
        }
        if (nextActive) {
            await assertUniqueActiveAccountName(input.tenantId, input.organizationId, nextAccountName, input.accountId);
        }
        if (typeof input.accountType === "string" && input.accountType !== existing.data.accountType) {
            updates.accountType = input.accountType;
            hasBusinessUpdate = true;
        }
        if (Object.prototype.hasOwnProperty.call(input, "parentAccountId")) {
            const parentAccountId = normalizeOptional(input.parentAccountId);
            if (parentAccountId) {
                await assertValidParentAccount(input.tenantId, input.organizationId, parentAccountId, input.accountId);
                updates.parentAccountId = parentAccountId;
            }
            else {
                updates.parentAccountId = null;
            }
            hasBusinessUpdate = true;
        }
        if (Object.prototype.hasOwnProperty.call(input, "postingRole")) {
            updates.postingRole = input.postingRole || null;
            hasBusinessUpdate = true;
        }
        if (!hasBusinessUpdate) {
            throw new errors_1.AppError("No chart of account fields provided for update.", "chart-of-accounts/no-updates", 400);
        }
        updates.updatedAt = firestore_1.Timestamp.now();
        await firestore_2.db.collection(collections_1.COLLECTIONS.chartOfAccounts).doc(input.accountId).update(updates);
        return { accountId: input.accountId };
    },
    async deleteChartOfAccount(input) {
        await getAccountOrThrow(input.tenantId, input.organizationId, input.accountId);
        const childSnap = await firestore_2.db
            .collection(collections_1.COLLECTIONS.chartOfAccounts)
            .where("tenantId", "==", input.tenantId)
            .where("organizationId", "==", input.organizationId)
            .where("parentAccountId", "==", input.accountId)
            .limit(1)
            .get();
        if (!childSnap.empty) {
            throw new errors_1.AppError("Cannot delete an account that has child accounts.", "chart-of-accounts/has-children", 409);
        }
        await firestore_2.db.collection(collections_1.COLLECTIONS.chartOfAccounts).doc(input.accountId).delete();
        return { accountId: input.accountId };
    }
};
