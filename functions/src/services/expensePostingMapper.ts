import { FieldPath } from "firebase-admin/firestore";
import { COLLECTIONS } from "../config/collections";
import {
  AccountPostingRole,
  Category,
  ChartOfAccount,
  ExpenseLineItem,
  ExpenseReport,
  Fund,
  PurchaseRequest
} from "../models";
import { AppError } from "../utils/errors";
import { db } from "../utils/firestore";
import { JournalEntryLineInput } from "./journalEntryService";

export interface ExpensePostingMappingInput {
  tenantId: string;
  organizationId: string;
  reportId: string;
}

export interface ExpensePostingMappingResult {
  tenantId: string;
  organizationId: string;
  date: string;
  reference: string;
  sourceModule: "expenses";
  sourceId: string;
  memo: string;
  lines: JournalEntryLineInput[];
  metadata: {
    requestId: string;
    reportStatus: string;
    fundId: string;
    fundType: string;
    lineItemCount: number;
    totalAmount: number;
  };
}

interface PostingRoleAccount {
  id: string;
  role: AccountPostingRole;
  account: ChartOfAccount;
}

const isEventOrSpecialProjectFund = (fundType: string): boolean =>
  fundType === "Events" || fundType === "Special Projects";

const chunkIds = (ids: string[], size: number): string[][] => {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
};

const fetchByIds = async <T extends object>(collection: string, ids: string[]): Promise<Map<string, T>> => {
  const out = new Map<string, T>();
  const distinct = Array.from(new Set(ids.filter((value) => String(value || "").trim().length > 0)));
  if (distinct.length === 0) {
    return out;
  }

  for (const idChunk of chunkIds(distinct, 30)) {
    const snap = await db.collection(collection).where(FieldPath.documentId(), "in", idChunk).get();
    snap.docs.forEach((doc) => {
      out.set(doc.id, doc.data() as T);
    });
  }

  return out;
};

const assertTenantOrg = (
  entity: Record<string, unknown>,
  tenantId: string,
  organizationId: string,
  entityName: string
): void => {
  if (String(entity.tenantId || "") !== tenantId || String(entity.organizationId || "") !== organizationId) {
    throw new AppError(`${entityName} does not belong to tenant/organization.`, `${entityName}/forbidden`, 403);
  }
};

const getExpenseReportOrThrow = async (
  tenantId: string,
  organizationId: string,
  reportId: string
): Promise<ExpenseReport> => {
  const snap = await db.collection(COLLECTIONS.expenseReports).doc(reportId).get();
  if (!snap.exists) {
    throw new AppError("Expense report not found.", "expense-report/not-found", 404);
  }

  const report = snap.data() as ExpenseReport;
  assertTenantOrg(report as unknown as Record<string, unknown>, tenantId, organizationId, "expense-report");
  return report;
};

const getPurchaseRequestOrThrow = async (
  tenantId: string,
  organizationId: string,
  requestId: string
): Promise<PurchaseRequest> => {
  const snap = await db.collection(COLLECTIONS.purchaseRequests).doc(requestId).get();
  if (!snap.exists) {
    throw new AppError("Purchase request not found.", "purchase-request/not-found", 404);
  }

  const request = snap.data() as PurchaseRequest;
  assertTenantOrg(request as unknown as Record<string, unknown>, tenantId, organizationId, "purchase-request");
  return request;
};

const listExpenseLineItems = async (
  tenantId: string,
  organizationId: string,
  reportId: string
): Promise<Array<{ id: string; data: ExpenseLineItem }>> => {
  const snap = await db
    .collection(COLLECTIONS.expenseLineItems)
    .where("tenantId", "==", tenantId)
    .where("organizationId", "==", organizationId)
    .where("reportId", "==", reportId)
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as ExpenseLineItem
  }));
};

const findPostingRoleAccounts = async (
  tenantId: string,
  organizationId: string
): Promise<Map<AccountPostingRole, PostingRoleAccount>> => {
  const snap = await db
    .collection(COLLECTIONS.chartOfAccounts)
    .where("tenantId", "==", tenantId)
    .where("organizationId", "==", organizationId)
    .where("active", "==", true)
    .get();

  const out = new Map<AccountPostingRole, PostingRoleAccount>();
  snap.docs.forEach((doc) => {
    const account = doc.data() as ChartOfAccount;
    const role = account.postingRole;
    if (!role) {
      return;
    }

    const existing = out.get(role);
    if (!existing || String(account.accountNumber || "") < String(existing.account.accountNumber || "")) {
      out.set(role, {
        id: doc.id,
        role,
        account
      });
    }
  });

  return out;
};

const resolveCreditAccount = (
  roleAccountMap: Map<AccountPostingRole, PostingRoleAccount>,
  reportStatus: string
): PostingRoleAccount => {
  if (reportStatus === "PAID") {
    return (
      roleAccountMap.get("cash_default") ||
      roleAccountMap.get("payable_default") ||
      (() => {
        throw new AppError(
          "No cash/payable posting account configured in chart of accounts.",
          "general-ledger/missing-credit-account",
          412
        );
      })()
    );
  }

  return (
    roleAccountMap.get("payable_default") ||
    roleAccountMap.get("cash_default") ||
    (() => {
      throw new AppError(
        "No payable/cash posting account configured in chart of accounts.",
        "general-ledger/missing-credit-account",
        412
      );
    })()
  );
};

const resolveTagName = (fund: Fund | null): string => {
  if (!fund) {
    return "";
  }
  return isEventOrSpecialProjectFund(String(fund.fundType || "")) ? String(fund.fundName || "") : "";
};

const timestampToDate = (value?: { toDate: () => Date }): string => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  return value.toDate().toISOString().slice(0, 10);
};

export const expensePostingMapper = {
  async mapExpenseReportToJournal(input: ExpensePostingMappingInput): Promise<ExpensePostingMappingResult> {
    const report = await getExpenseReportOrThrow(input.tenantId, input.organizationId, input.reportId);
    if (report.status !== "APPROVED" && report.status !== "PAID") {
      throw new AppError(
        "Expense report must be APPROVED or PAID before posting.",
        "expense-report/not-postable",
        412
      );
    }

    const request = await getPurchaseRequestOrThrow(input.tenantId, input.organizationId, report.requestId);
    const lineItems = await listExpenseLineItems(input.tenantId, input.organizationId, input.reportId);
    if (lineItems.length === 0) {
      throw new AppError(
        "Expense report has no line items to post.",
        "expense-report/no-line-items",
        412
      );
    }

    const categoryMap = await fetchByIds<Category>(
      COLLECTIONS.categories,
      lineItems.map((item) => item.data.categoryId)
    );

    let fund: Fund | null = null;
    if (request.fundId) {
      const fundSnap = await db.collection(COLLECTIONS.funds).doc(request.fundId).get();
      if (fundSnap.exists) {
        const fundData = fundSnap.data() as Fund;
        if (fundData.tenantId === input.tenantId && fundData.organizationId === input.organizationId) {
          fund = fundData;
        }
      }
    }

    const postingRoleAccounts = await findPostingRoleAccounts(input.tenantId, input.organizationId);
    const defaultExpenseAccount = postingRoleAccounts.get("expense_default") || null;
    const creditAccount = resolveCreditAccount(postingRoleAccounts, report.status);

    const className = String(request.ministryDepartment || "").trim();
    const tagName = resolveTagName(fund);

    const lines: JournalEntryLineInput[] = [];
    let totalAmount = 0;

    lineItems.forEach((lineItem) => {
      const amount = Number(lineItem.data.amount || 0);
      if (amount <= 0) {
        return;
      }

      const category = categoryMap.get(lineItem.data.categoryId) || null;
      const categoryAccountId = String(category?.expenseAccountId || "").trim();
      const debitAccountId = categoryAccountId || defaultExpenseAccount?.id || "";
      if (!debitAccountId) {
        throw new AppError(
          `Missing expense account mapping for category '${lineItem.data.categoryId}'.`,
          "general-ledger/missing-expense-account",
          412
        );
      }

      lines.push({
        accountId: debitAccountId,
        debit: amount,
        credit: 0,
        memo: String(lineItem.data.description || "").trim() || "Expense line item",
        className,
        tagName
      });
      totalAmount += amount;
    });

    totalAmount = Math.round((totalAmount + Number.EPSILON) * 100) / 100;
    if (totalAmount <= 0) {
      throw new AppError(
        "Expense report has no positive line item amounts to post.",
        "expense-report/no-positive-amounts",
        412
      );
    }

    lines.push({
      accountId: creditAccount.id,
      debit: 0,
      credit: totalAmount,
      memo: `Credit for expense report ${input.reportId}`,
      className,
      tagName
    });

    const effectiveDate = timestampToDate(report.submittedAt || report.updatedAt || report.createdAt);

    return {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      date: effectiveDate,
      reference: `ER-${input.reportId}`,
      sourceModule: "expenses",
      sourceId: input.reportId,
      memo: `Expense report posting for ${input.reportId}`,
      lines,
      metadata: {
        requestId: report.requestId,
        reportStatus: report.status,
        fundId: request.fundId || "",
        fundType: String(fund?.fundType || ""),
        lineItemCount: lineItems.length,
        totalAmount
      }
    };
  }
};
