import { Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS } from "../config/collections";
import { AccountPostingRole, AccountType, ChartOfAccount } from "../models";
import { AppError } from "../utils/errors";
import { db } from "../utils/firestore";

export interface ChartOfAccountsScopeInput {
  tenantId: string;
  organizationId: string;
}

export interface ListChartOfAccountsInput extends ChartOfAccountsScopeInput {
  includeInactive?: boolean;
}

export interface CreateChartOfAccountInput extends ChartOfAccountsScopeInput {
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  parentAccountId?: string;
  postingRole?: AccountPostingRole;
  active?: boolean;
}

export interface UpdateChartOfAccountInput extends ChartOfAccountsScopeInput {
  accountId: string;
  accountNumber?: string;
  accountName?: string;
  accountType?: AccountType;
  parentAccountId?: string | null;
  postingRole?: AccountPostingRole | null;
  active?: boolean;
}

export interface DeleteChartOfAccountInput extends ChartOfAccountsScopeInput {
  accountId: string;
}

export interface ChartOfAccountRecord extends ChartOfAccount {
  id: string;
}

const normalizeRequired = (value: string, fieldName: string): string => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new AppError(`'${fieldName}' is required.`, `${fieldName}/required`, 400);
  }
  return normalized;
};

const normalizeOptional = (value: string | null | undefined): string => String(value || "").trim();

const assertTenantOrganizationOwnership = (
  account: ChartOfAccount,
  tenantId: string,
  organizationId: string
): void => {
  if (account.tenantId !== tenantId || account.organizationId !== organizationId) {
    throw new AppError(
      "Chart of account does not belong to tenant/organization.",
      "chart-of-accounts/forbidden",
      403
    );
  }
};

const getAccountOrThrow = async (
  tenantId: string,
  organizationId: string,
  accountId: string
): Promise<{ id: string; data: ChartOfAccount }> => {
  const accountSnap = await db.collection(COLLECTIONS.chartOfAccounts).doc(accountId).get();
  if (!accountSnap.exists) {
    throw new AppError("Chart of account not found.", "chart-of-accounts/not-found", 404);
  }

  const account = accountSnap.data() as ChartOfAccount;
  assertTenantOrganizationOwnership(account, tenantId, organizationId);
  return { id: accountSnap.id, data: account };
};

const assertUniqueAccountNumber = async (
  tenantId: string,
  organizationId: string,
  accountNumber: string,
  excludeAccountId?: string
): Promise<void> => {
  const snap = await db
    .collection(COLLECTIONS.chartOfAccounts)
    .where("tenantId", "==", tenantId)
    .where("organizationId", "==", organizationId)
    .where("accountNumber", "==", accountNumber)
    .limit(2)
    .get();

  const conflict = snap.docs.find((doc) => doc.id !== excludeAccountId);
  if (conflict) {
    throw new AppError(
      "Account number must be unique within the organization.",
      "chart-of-accounts/account-number-conflict",
      409
    );
  }
};

const assertUniqueActiveAccountName = async (
  tenantId: string,
  organizationId: string,
  accountName: string,
  excludeAccountId?: string
): Promise<void> => {
  const snap = await db
    .collection(COLLECTIONS.chartOfAccounts)
    .where("tenantId", "==", tenantId)
    .where("organizationId", "==", organizationId)
    .where("accountName", "==", accountName)
    .get();

  const conflict = snap.docs.find((doc) => {
    if (doc.id === excludeAccountId) {
      return false;
    }
    const account = doc.data() as ChartOfAccount;
    return Boolean(account.active);
  });

  if (conflict) {
    throw new AppError(
      "Active account name must be unique within the organization.",
      "chart-of-accounts/account-name-conflict",
      409
    );
  }
};

const assertValidParentAccount = async (
  tenantId: string,
  organizationId: string,
  parentAccountId: string,
  currentAccountId?: string
): Promise<void> => {
  if (currentAccountId && parentAccountId === currentAccountId) {
    throw new AppError(
      "Account cannot be its own parent.",
      "chart-of-accounts/invalid-parent",
      400
    );
  }

  const parent = await getAccountOrThrow(tenantId, organizationId, parentAccountId);
  if (!parent.data.active) {
    throw new AppError(
      "Parent account must be active.",
      "chart-of-accounts/inactive-parent",
      400
    );
  }
};

const listAccountsBaseQuery = (tenantId: string, organizationId: string) =>
  db
    .collection(COLLECTIONS.chartOfAccounts)
    .where("tenantId", "==", tenantId)
    .where("organizationId", "==", organizationId);

export const chartOfAccountsService = {
  async listChartOfAccounts(input: ListChartOfAccountsInput): Promise<ChartOfAccountRecord[]> {
    let query = listAccountsBaseQuery(input.tenantId, input.organizationId);
    if (!input.includeInactive) {
      query = query.where("active", "==", true);
    }

    const snap = await query.orderBy("accountNumber", "asc").get();
    return snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as ChartOfAccount)
    }));
  },

  async createChartOfAccount(input: CreateChartOfAccountInput): Promise<{ accountId: string }> {
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

    const now = Timestamp.now();
    const account: ChartOfAccount = {
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

    const ref = await db.collection(COLLECTIONS.chartOfAccounts).add(account);
    return { accountId: ref.id };
  },

  async updateChartOfAccount(input: UpdateChartOfAccountInput): Promise<{ accountId: string }> {
    const existing = await getAccountOrThrow(input.tenantId, input.organizationId, input.accountId);
    const updates: Record<string, unknown> = {};
    let hasBusinessUpdate = false;

    const nextAccountNumber =
      typeof input.accountNumber === "string"
        ? normalizeRequired(input.accountNumber, "accountNumber")
        : existing.data.accountNumber;
    const nextAccountName =
      typeof input.accountName === "string"
        ? normalizeRequired(input.accountName, "accountName")
        : existing.data.accountName;
    const nextActive = typeof input.active === "boolean" ? input.active : Boolean(existing.data.active);

    if (typeof input.accountNumber === "string" && nextAccountNumber !== existing.data.accountNumber) {
      await assertUniqueAccountNumber(
        input.tenantId,
        input.organizationId,
        nextAccountNumber,
        input.accountId
      );
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
      await assertUniqueActiveAccountName(
        input.tenantId,
        input.organizationId,
        nextAccountName,
        input.accountId
      );
    }

    if (typeof input.accountType === "string" && input.accountType !== existing.data.accountType) {
      updates.accountType = input.accountType;
      hasBusinessUpdate = true;
    }

    if (Object.prototype.hasOwnProperty.call(input, "parentAccountId")) {
      const parentAccountId = normalizeOptional(input.parentAccountId);
      if (parentAccountId) {
        await assertValidParentAccount(
          input.tenantId,
          input.organizationId,
          parentAccountId,
          input.accountId
        );
        updates.parentAccountId = parentAccountId;
      } else {
        updates.parentAccountId = null;
      }
      hasBusinessUpdate = true;
    }

    if (Object.prototype.hasOwnProperty.call(input, "postingRole")) {
      updates.postingRole = input.postingRole || null;
      hasBusinessUpdate = true;
    }

    if (!hasBusinessUpdate) {
      throw new AppError("No chart of account fields provided for update.", "chart-of-accounts/no-updates", 400);
    }

    updates.updatedAt = Timestamp.now();
    await db.collection(COLLECTIONS.chartOfAccounts).doc(input.accountId).update(updates);
    return { accountId: input.accountId };
  },

  async deleteChartOfAccount(input: DeleteChartOfAccountInput): Promise<{ accountId: string }> {
    await getAccountOrThrow(input.tenantId, input.organizationId, input.accountId);

    const childSnap = await db
      .collection(COLLECTIONS.chartOfAccounts)
      .where("tenantId", "==", input.tenantId)
      .where("organizationId", "==", input.organizationId)
      .where("parentAccountId", "==", input.accountId)
      .limit(1)
      .get();

    if (!childSnap.empty) {
      throw new AppError(
        "Cannot delete an account that has child accounts.",
        "chart-of-accounts/has-children",
        409
      );
    }

    await db.collection(COLLECTIONS.chartOfAccounts).doc(input.accountId).delete();
    return { accountId: input.accountId };
  }
};
