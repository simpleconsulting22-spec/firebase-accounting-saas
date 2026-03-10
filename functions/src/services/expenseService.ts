import { Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS } from "../config/collections";
import { Approval, ExpenseLineItem, ExpenseReport, PurchaseRequest } from "../models";
import { AppError } from "../utils/errors";
import { db } from "../utils/firestore";
import { FundBudgetSnapshot, budgetService } from "./budgetService";

export interface CreatePurchaseRequestInput {
  tenantId: string;
  organizationId: string;
  fundId: string;
  ministryDepartment: string;
  requestorId: string;
  approverId: string;
  estimatedAmount: number;
  plannedPaymentMethod: string;
  purpose: string;
  description?: string;
  requestedExpenseDate: string;
}

export interface UpdateDraftPurchaseRequestInput {
  tenantId: string;
  organizationId: string;
  requestId: string;
  fundId: string;
  ministryDepartment: string;
  approverId: string;
  estimatedAmount: number;
  plannedPaymentMethod: string;
  purpose: string;
  description?: string;
  requestedExpenseDate: string;
}

export interface SubmitPurchaseRequestInput {
  tenantId: string;
  organizationId: string;
  requestId: string;
  submittedBy: string;
}

export interface CreateExpenseReportInput {
  tenantId: string;
  organizationId: string;
  requestId: string;
  createdBy: string;
}

export type PurchaseRequestApprovalAction = "APPROVE" | "REJECT" | "REQUEST_REVISIONS";
export type ExpenseReportApprovalAction = "SUBMIT" | "APPROVE" | "REJECT" | "REQUEST_REVISIONS" | "MARK_PAY";

export interface ApprovePurchaseRequestInput {
  tenantId: string;
  organizationId: string;
  requestId: string;
  action: PurchaseRequestApprovalAction;
  comments?: string;
  actedBy: string;
}

export interface ApproveExpenseReportInput {
  tenantId: string;
  organizationId: string;
  requestId: string;
  reportId: string;
  action: ExpenseReportApprovalAction;
  comments?: string;
  actedBy: string;
}

export interface UpsertExpenseLineItemInput {
  tenantId: string;
  organizationId: string;
  requestId: string;
  reportId: string;
  lineItemId?: string;
  vendorId: string;
  categoryId: string;
  amount: number;
  expenseDate: string;
  description?: string;
  receiptUrl?: string;
  updatedBy: string;
}

export interface PurchaseRequestDetailInput {
  tenantId: string;
  organizationId: string;
  requestId: string;
}

export interface PurchaseRequestDetailResponse {
  request: Record<string, unknown> & { id: string };
  expenseReport: (Record<string, unknown> & { id: string }) | null;
  lineItems: Array<Record<string, unknown> & { id: string }>;
  approvals: Array<Record<string, unknown> & { id: string }>;
  budgetSnapshot: FundBudgetSnapshot | null;
}

const parseTimestampField = (value: string, fieldName: string): Timestamp => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid date value for '${fieldName}'.`, "validation/invalid-date", 400);
  }
  return Timestamp.fromDate(parsed);
};

const assertTenantOrgRecord = (
  data: Record<string, unknown>,
  tenantId: string,
  organizationId: string,
  entityName: string
): void => {
  if (String(data.tenantId || "") !== tenantId || String(data.organizationId || "") !== organizationId) {
    throw new AppError(`${entityName} does not belong to tenant/organization.`, `${entityName}/forbidden`, 403);
  }
};

const assertFundOwnership = async (tenantId: string, organizationId: string, fundId: string): Promise<void> => {
  const fundSnap = await db.collection(COLLECTIONS.funds).doc(fundId).get();
  if (!fundSnap.exists) {
    throw new AppError("Fund not found.", "fund/not-found", 404);
  }

  const fund = fundSnap.data() as Record<string, unknown>;
  assertTenantOrgRecord(fund, tenantId, organizationId, "fund");
};

const appendApprovalEntry = async (input: {
  tenantId: string;
  organizationId: string;
  requestId: string;
  reportId?: string;
  step: string;
  decision: string;
  approvedBy: string;
  comments?: string;
}): Promise<void> => {
  const now = Timestamp.now();
  const entry: Approval = {
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    requestId: input.requestId,
    reportId: input.reportId,
    step: input.step,
    decision: input.decision,
    approvedBy: input.approvedBy,
    approvedAt: now,
    comments: input.comments,
    createdAt: now
  };

  await db.collection(COLLECTIONS.approvals).add(entry);
};

const serializeValue = (value: unknown): unknown => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeValue(entry));
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      out[key] = serializeValue(item);
    });
    return out;
  }

  return value;
};

const getRequestOrThrow = async (
  tenantId: string,
  organizationId: string,
  requestId: string
): Promise<{ data: PurchaseRequest; id: string }> => {
  const snap = await db.collection(COLLECTIONS.purchaseRequests).doc(requestId).get();
  if (!snap.exists) {
    throw new AppError("Purchase request not found.", "request/not-found", 404);
  }

  const data = snap.data() as PurchaseRequest;
  assertTenantOrgRecord(data as unknown as Record<string, unknown>, tenantId, organizationId, "request");
  return { data, id: snap.id };
};

const getExpenseReportOrThrow = async (
  tenantId: string,
  organizationId: string,
  reportId: string
): Promise<{ data: ExpenseReport; id: string }> => {
  const snap = await db.collection(COLLECTIONS.expenseReports).doc(reportId).get();
  if (!snap.exists) {
    throw new AppError("Expense report not found.", "expense-report/not-found", 404);
  }

  const data = snap.data() as ExpenseReport;
  assertTenantOrgRecord(data as unknown as Record<string, unknown>, tenantId, organizationId, "report");
  return { data, id: snap.id };
};

const sumActualAmountByRequest = async (
  tenantId: string,
  organizationId: string,
  requestId: string
): Promise<number> => {
  const lineItemsSnap = await db
    .collection(COLLECTIONS.expenseLineItems)
    .where("tenantId", "==", tenantId)
    .where("organizationId", "==", organizationId)
    .where("requestId", "==", requestId)
    .get();

  return lineItemsSnap.docs.reduce((sum, doc) => {
    const value = Number((doc.data() as Record<string, unknown>).amount || 0);
    return sum + value;
  }, 0);
};

const PR_EDITABLE_STATUSES = new Set(["DRAFT", "REQUEST_REVISIONS_NEEDED"]);
const ER_EDITABLE_STATUSES = new Set(["DRAFT", "REQUEST_REVISIONS_NEEDED"]);

export const expenseService = {
  async createPurchaseRequest(input: CreatePurchaseRequestInput): Promise<{ requestId: string; status: string }> {
    await assertFundOwnership(input.tenantId, input.organizationId, input.fundId);

    const now = Timestamp.now();
    const requestRef = db.collection(COLLECTIONS.purchaseRequests).doc();
    const request: PurchaseRequest = {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      fundId: input.fundId,
      ministryDepartment: input.ministryDepartment,
      requestorId: input.requestorId,
      approverId: input.approverId,
      estimatedAmount: Number(input.estimatedAmount || 0),
      approvedAmount: 0,
      actualAmount: 0,
      status: "DRAFT",
      plannedPaymentMethod: input.plannedPaymentMethod,
      purpose: input.purpose,
      description: input.description || "",
      requestedExpenseDate: parseTimestampField(input.requestedExpenseDate, "requestedExpenseDate"),
      createdAt: now,
      updatedAt: now
    };

    await requestRef.set(request);
    await appendApprovalEntry({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      requestId: requestRef.id,
      step: "PR_DRAFT",
      decision: "CREATED",
      approvedBy: input.requestorId
    });

    return { requestId: requestRef.id, status: request.status };
  },

  async updateDraftPurchaseRequest(input: UpdateDraftPurchaseRequestInput): Promise<{ requestId: string; status: string }> {
    await assertFundOwnership(input.tenantId, input.organizationId, input.fundId);
    const existing = await getRequestOrThrow(input.tenantId, input.organizationId, input.requestId);
    if (!PR_EDITABLE_STATUSES.has(existing.data.status)) {
      throw new AppError(
        "Only draft or revision-needed requests can be edited.",
        "request/invalid-status",
        412
      );
    }

    const now = Timestamp.now();
    await db.collection(COLLECTIONS.purchaseRequests).doc(input.requestId).update({
      fundId: input.fundId,
      ministryDepartment: input.ministryDepartment,
      approverId: input.approverId,
      estimatedAmount: Number(input.estimatedAmount || 0),
      plannedPaymentMethod: input.plannedPaymentMethod,
      purpose: input.purpose,
      description: input.description || "",
      requestedExpenseDate: parseTimestampField(input.requestedExpenseDate, "requestedExpenseDate"),
      updatedAt: now
    });

    await appendApprovalEntry({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      requestId: input.requestId,
      step: "PR_DRAFT",
      decision: "UPDATED",
      approvedBy: existing.data.requestorId
    });

    return { requestId: input.requestId, status: existing.data.status };
  },

  async submitPurchaseRequest(input: SubmitPurchaseRequestInput): Promise<{ requestId: string; status: string }> {
    const existing = await getRequestOrThrow(input.tenantId, input.organizationId, input.requestId);
    if (!PR_EDITABLE_STATUSES.has(existing.data.status)) {
      throw new AppError(
        "Request cannot be submitted from its current status.",
        "request/invalid-status",
        412
      );
    }

    const nextStatus = "AWAITING_PREAPPROVAL";
    const now = Timestamp.now();
    await db.collection(COLLECTIONS.purchaseRequests).doc(input.requestId).update({
      status: nextStatus,
      updatedAt: now
    });

    await appendApprovalEntry({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      requestId: input.requestId,
      step: "PR_SUBMIT",
      decision: "SUBMIT",
      approvedBy: input.submittedBy
    });

    return { requestId: input.requestId, status: nextStatus };
  },

  async createExpenseReport(input: CreateExpenseReportInput): Promise<{ reportId: string; status: string; existed: boolean }> {
    const requestDoc = await getRequestOrThrow(input.tenantId, input.organizationId, input.requestId);

    const existingReportSnap = await db
      .collection(COLLECTIONS.expenseReports)
      .where("tenantId", "==", input.tenantId)
      .where("organizationId", "==", input.organizationId)
      .where("requestId", "==", input.requestId)
      .limit(1)
      .get();

    if (!existingReportSnap.empty) {
      const existingDoc = existingReportSnap.docs[0];
      const existingData = existingDoc.data() as ExpenseReport;
      return {
        reportId: existingDoc.id,
        status: existingData.status,
        existed: true
      };
    }

    if (requestDoc.data.status !== "APPROVE" && requestDoc.data.status !== "REQUEST_REVISIONS_NEEDED") {
      throw new AppError(
        "Expense report can only be created after pre-approval or when revisions are requested.",
        "expense-report/invalid-request-status",
        412
      );
    }

    const now = Timestamp.now();
    const report: ExpenseReport = {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      requestId: input.requestId,
      status: "DRAFT",
      postingStatus: "NOT_POSTED",
      createdAt: now,
      updatedAt: now
    };

    const reportRef = await db.collection(COLLECTIONS.expenseReports).add(report);
    await db.collection(COLLECTIONS.purchaseRequests).doc(input.requestId).update({
      status: "EXPENSE_DRAFT",
      updatedAt: now
    });
    await appendApprovalEntry({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      requestId: input.requestId,
      reportId: reportRef.id,
      step: "ER_DRAFT",
      decision: "CREATED",
      approvedBy: input.createdBy
    });

    return { reportId: reportRef.id, status: report.status, existed: false };
  },

  async upsertExpenseLineItem(input: UpsertExpenseLineItemInput): Promise<{ lineItemId: string; actualAmount: number }> {
    await getRequestOrThrow(input.tenantId, input.organizationId, input.requestId);
    const reportDoc = await getExpenseReportOrThrow(input.tenantId, input.organizationId, input.reportId);
    const reportData = reportDoc.data;
    if (reportData.requestId !== input.requestId) {
      throw new AppError("Report is not linked to this request.", "expense-report/request-mismatch", 403);
    }
    if (!ER_EDITABLE_STATUSES.has(reportData.status)) {
      throw new AppError(
        "Expense report line items can only be edited in draft or revision-needed status.",
        "expense-report/invalid-status",
        412
      );
    }

    const expenseDate = parseTimestampField(input.expenseDate, "expenseDate");
    const now = Timestamp.now();
    let lineItemId = input.lineItemId || "";

    if (input.lineItemId) {
      const lineItemRef = db.collection(COLLECTIONS.expenseLineItems).doc(input.lineItemId);
      const lineItemSnap = await lineItemRef.get();
      if (!lineItemSnap.exists) {
        throw new AppError("Expense line item not found.", "expense-line-item/not-found", 404);
      }

      const existingLine = lineItemSnap.data() as ExpenseLineItem;
      assertTenantOrgRecord(
        existingLine as unknown as Record<string, unknown>,
        input.tenantId,
        input.organizationId,
        "expense-line-item"
      );
      if (existingLine.requestId !== input.requestId || existingLine.reportId !== input.reportId) {
        throw new AppError("Line item does not match request/report.", "expense-line-item/mismatch", 403);
      }

      await lineItemRef.update({
        vendorId: input.vendorId,
        categoryId: input.categoryId,
        amount: Number(input.amount),
        expenseDate,
        description: input.description || "",
        receiptUrl: input.receiptUrl || null,
        updatedAt: now
      });

      lineItemId = lineItemRef.id;
    } else {
      const lineItem: ExpenseLineItem = {
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        reportId: input.reportId,
        requestId: input.requestId,
        vendorId: input.vendorId,
        categoryId: input.categoryId,
        amount: Number(input.amount),
        expenseDate,
        description: input.description || "",
        receiptUrl: input.receiptUrl,
        createdAt: now,
        updatedAt: now
      };

      const lineItemRef = await db.collection(COLLECTIONS.expenseLineItems).add(lineItem);
      lineItemId = lineItemRef.id;
    }

    const actualAmount = await sumActualAmountByRequest(input.tenantId, input.organizationId, input.requestId);
    await db.collection(COLLECTIONS.purchaseRequests).doc(input.requestId).update({
      actualAmount,
      updatedAt: now
    });
    await db.collection(COLLECTIONS.expenseReports).doc(input.reportId).update({ updatedAt: now });

    await appendApprovalEntry({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      requestId: input.requestId,
      reportId: input.reportId,
      step: "ER_LINE_ITEM",
      decision: input.lineItemId ? "UPDATED" : "ADDED",
      approvedBy: input.updatedBy
    });

    return { lineItemId, actualAmount };
  },

  async applyPurchaseRequestApprovalAction(
    input: ApprovePurchaseRequestInput
  ): Promise<{ requestId: string; status: string }> {
    const requestDoc = await getRequestOrThrow(input.tenantId, input.organizationId, input.requestId);
    if (requestDoc.data.status !== "AWAITING_PREAPPROVAL") {
      throw new AppError(
        "Purchase request approval action is only allowed in AWAITING_PREAPPROVAL status.",
        "request/invalid-status",
        412
      );
    }

    let nextStatus = requestDoc.data.status;
    let decision = input.action;
    let step = "PR_REVIEW";
    const updates: Record<string, unknown> = {
      updatedAt: Timestamp.now()
    };

    if (input.action === "APPROVE") {
      nextStatus = "APPROVE";
      updates.status = nextStatus;
      updates.approvedAmount = requestDoc.data.estimatedAmount;
      decision = "APPROVE";
    } else if (input.action === "REJECT") {
      nextStatus = "REJECT";
      updates.status = nextStatus;
      decision = "REJECT";
    } else if (input.action === "REQUEST_REVISIONS") {
      nextStatus = "REQUEST_REVISIONS_NEEDED";
      updates.status = nextStatus;
      decision = "REQUEST_REVISIONS";
    } else {
      throw new AppError("Unsupported purchase request action.", "request/invalid-action", 400);
    }

    await db.collection(COLLECTIONS.purchaseRequests).doc(input.requestId).update(updates);
    await appendApprovalEntry({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      requestId: input.requestId,
      step,
      decision,
      approvedBy: input.actedBy,
      comments: input.comments
    });

    return {
      requestId: input.requestId,
      status: nextStatus
    };
  },

  async applyExpenseReportApprovalAction(
    input: ApproveExpenseReportInput
  ): Promise<{ requestId: string; reportId: string; requestStatus: string; reportStatus: string }> {
    const requestDoc = await getRequestOrThrow(input.tenantId, input.organizationId, input.requestId);
    const reportDoc = await getExpenseReportOrThrow(input.tenantId, input.organizationId, input.reportId);
    if (reportDoc.data.requestId !== input.requestId) {
      throw new AppError("Expense report does not belong to the request.", "expense-report/request-mismatch", 403);
    }

    let nextRequestStatus = requestDoc.data.status;
    let nextReportStatus = reportDoc.data.status;
    let step = "ER_REVIEW";
    let decision = input.action;
    const now = Timestamp.now();

    if (input.action === "SUBMIT") {
      if (!ER_EDITABLE_STATUSES.has(reportDoc.data.status)) {
        throw new AppError(
          "Expense report can only be submitted from draft or revision-needed status.",
          "expense-report/invalid-status",
          412
        );
      }
      if (
        requestDoc.data.status !== "APPROVE" &&
        requestDoc.data.status !== "REQUEST_REVISIONS_NEEDED" &&
        requestDoc.data.status !== "EXPENSE_DRAFT"
      ) {
        throw new AppError(
          "Request is not ready for expense report submission.",
          "request/invalid-status",
          412
        );
      }

      nextReportStatus = "SUBMIT";
      nextRequestStatus = "AWAITING_FINANCE_REVIEW";
      step = "ER_SUBMIT";
      decision = "SUBMIT";

      await db.collection(COLLECTIONS.expenseReports).doc(input.reportId).update({
        status: nextReportStatus,
        submittedAt: now,
        updatedAt: now
      });
      await db.collection(COLLECTIONS.purchaseRequests).doc(input.requestId).update({
        status: nextRequestStatus,
        updatedAt: now
      });
    } else if (input.action === "APPROVE") {
      if (reportDoc.data.status !== "SUBMIT") {
        throw new AppError(
          "Expense report approval is only allowed in SUBMIT status.",
          "expense-report/invalid-status",
          412
        );
      }
      nextReportStatus = "APPROVE";
      nextRequestStatus = "EXPENSE_APPROVE";
      decision = "APPROVE";

      await db.collection(COLLECTIONS.expenseReports).doc(input.reportId).update({
        status: nextReportStatus,
        updatedAt: now
      });
      await db.collection(COLLECTIONS.purchaseRequests).doc(input.requestId).update({
        status: nextRequestStatus,
        updatedAt: now
      });
    } else if (input.action === "REJECT") {
      if (reportDoc.data.status !== "SUBMIT") {
        throw new AppError(
          "Expense report rejection is only allowed in SUBMIT status.",
          "expense-report/invalid-status",
          412
        );
      }
      nextReportStatus = "REJECT";
      nextRequestStatus = "REJECT";
      decision = "REJECT";

      await db.collection(COLLECTIONS.expenseReports).doc(input.reportId).update({
        status: nextReportStatus,
        updatedAt: now
      });
      await db.collection(COLLECTIONS.purchaseRequests).doc(input.requestId).update({
        status: nextRequestStatus,
        updatedAt: now
      });
    } else if (input.action === "REQUEST_REVISIONS") {
      if (reportDoc.data.status !== "SUBMIT") {
        throw new AppError(
          "Revision request is only allowed in SUBMIT status.",
          "expense-report/invalid-status",
          412
        );
      }
      nextReportStatus = "REQUEST_REVISIONS_NEEDED";
      nextRequestStatus = "REQUEST_REVISIONS_NEEDED";
      decision = "REQUEST_REVISIONS";

      await db.collection(COLLECTIONS.expenseReports).doc(input.reportId).update({
        status: nextReportStatus,
        updatedAt: now
      });
      await db.collection(COLLECTIONS.purchaseRequests).doc(input.requestId).update({
        status: nextRequestStatus,
        updatedAt: now
      });
    } else if (input.action === "MARK_PAY") {
      if (reportDoc.data.status !== "APPROVE") {
        throw new AppError(
          "Mark paid is only allowed after expense report approval.",
          "expense-report/invalid-status",
          412
        );
      }
      nextReportStatus = "MARK_PAY";
      nextRequestStatus = "MARK_PAY";
      step = "ER_PAYMENT";
      decision = "MARK_PAY";

      await db.collection(COLLECTIONS.expenseReports).doc(input.reportId).update({
        status: nextReportStatus,
        updatedAt: now
      });
      await db.collection(COLLECTIONS.purchaseRequests).doc(input.requestId).update({
        status: nextRequestStatus,
        updatedAt: now
      });
    } else {
      throw new AppError("Unsupported expense report action.", "expense-report/invalid-action", 400);
    }

    await appendApprovalEntry({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      requestId: input.requestId,
      reportId: input.reportId,
      step,
      decision,
      approvedBy: input.actedBy,
      comments: input.comments
    });

    return {
      requestId: input.requestId,
      reportId: input.reportId,
      requestStatus: nextRequestStatus,
      reportStatus: nextReportStatus
    };
  },

  async getPurchaseRequestDetail(input: PurchaseRequestDetailInput): Promise<PurchaseRequestDetailResponse> {
    const requestDoc = await getRequestOrThrow(input.tenantId, input.organizationId, input.requestId);

    const reportSnap = await db
      .collection(COLLECTIONS.expenseReports)
      .where("tenantId", "==", input.tenantId)
      .where("organizationId", "==", input.organizationId)
      .where("requestId", "==", input.requestId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    const lineItemsSnap = await db
      .collection(COLLECTIONS.expenseLineItems)
      .where("tenantId", "==", input.tenantId)
      .where("organizationId", "==", input.organizationId)
      .where("requestId", "==", input.requestId)
      .orderBy("expenseDate", "asc")
      .get();

    const approvalsSnap = await db
      .collection(COLLECTIONS.approvals)
      .where("tenantId", "==", input.tenantId)
      .where("organizationId", "==", input.organizationId)
      .where("requestId", "==", input.requestId)
      .orderBy("createdAt", "asc")
      .get();

    let budgetSnapshot: FundBudgetSnapshot | null = null;
    if (requestDoc.data.fundId) {
      budgetSnapshot = await budgetService.getFundBudgetSnapshot({
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        fundId: requestDoc.data.fundId
      });
    }

    const reportDoc = reportSnap.empty ? null : reportSnap.docs[0];
    return {
      request: {
        id: requestDoc.id,
        ...(serializeValue(requestDoc.data) as Record<string, unknown>)
      },
      expenseReport: reportDoc
        ? {
            id: reportDoc.id,
            ...(serializeValue(reportDoc.data()) as Record<string, unknown>)
          }
        : null,
      lineItems: lineItemsSnap.docs.map((doc) => ({
        id: doc.id,
        ...(serializeValue(doc.data()) as Record<string, unknown>)
      })),
      approvals: approvalsSnap.docs.map((doc) => ({
        id: doc.id,
        ...(serializeValue(doc.data()) as Record<string, unknown>)
      })),
      budgetSnapshot
    };
  }
};
