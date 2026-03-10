"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expenseService = void 0;
const firestore_1 = require("firebase-admin/firestore");
const collections_1 = require("../config/collections");
const errors_1 = require("../utils/errors");
const firestore_2 = require("../utils/firestore");
const budgetService_1 = require("./budgetService");
const parseTimestampField = (value, fieldName) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new errors_1.AppError(`Invalid date value for '${fieldName}'.`, "validation/invalid-date", 400);
    }
    return firestore_1.Timestamp.fromDate(parsed);
};
const assertTenantOrgRecord = (data, tenantId, organizationId, entityName) => {
    if (String(data.tenantId || "") !== tenantId || String(data.organizationId || "") !== organizationId) {
        throw new errors_1.AppError(`${entityName} does not belong to tenant/organization.`, `${entityName}/forbidden`, 403);
    }
};
const assertFundOwnership = async (tenantId, organizationId, fundId) => {
    const fundSnap = await firestore_2.db.collection(collections_1.COLLECTIONS.funds).doc(fundId).get();
    if (!fundSnap.exists) {
        throw new errors_1.AppError("Fund not found.", "fund/not-found", 404);
    }
    const fund = fundSnap.data();
    assertTenantOrgRecord(fund, tenantId, organizationId, "fund");
};
const appendApprovalEntry = async (input) => {
    const now = firestore_1.Timestamp.now();
    const entry = {
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
    await firestore_2.db.collection(collections_1.COLLECTIONS.approvals).add(entry);
};
const serializeValue = (value) => {
    if (value instanceof firestore_1.Timestamp) {
        return value.toDate().toISOString();
    }
    if (Array.isArray(value)) {
        return value.map((entry) => serializeValue(entry));
    }
    if (value && typeof value === "object") {
        const out = {};
        Object.entries(value).forEach(([key, item]) => {
            out[key] = serializeValue(item);
        });
        return out;
    }
    return value;
};
const getRequestOrThrow = async (tenantId, organizationId, requestId) => {
    const snap = await firestore_2.db.collection(collections_1.COLLECTIONS.purchaseRequests).doc(requestId).get();
    if (!snap.exists) {
        throw new errors_1.AppError("Purchase request not found.", "request/not-found", 404);
    }
    const data = snap.data();
    assertTenantOrgRecord(data, tenantId, organizationId, "request");
    return { data, id: snap.id };
};
const getExpenseReportOrThrow = async (tenantId, organizationId, reportId) => {
    const snap = await firestore_2.db.collection(collections_1.COLLECTIONS.expenseReports).doc(reportId).get();
    if (!snap.exists) {
        throw new errors_1.AppError("Expense report not found.", "expense-report/not-found", 404);
    }
    const data = snap.data();
    assertTenantOrgRecord(data, tenantId, organizationId, "report");
    return { data, id: snap.id };
};
const sumActualAmountByRequest = async (tenantId, organizationId, requestId) => {
    const lineItemsSnap = await firestore_2.db
        .collection(collections_1.COLLECTIONS.expenseLineItems)
        .where("tenantId", "==", tenantId)
        .where("organizationId", "==", organizationId)
        .where("requestId", "==", requestId)
        .get();
    return lineItemsSnap.docs.reduce((sum, doc) => {
        const value = Number(doc.data().amount || 0);
        return sum + value;
    }, 0);
};
const PR_EDITABLE_STATUSES = new Set(["DRAFT", "REQUEST_REVISIONS_NEEDED"]);
const ER_EDITABLE_STATUSES = new Set(["DRAFT", "REQUEST_REVISIONS_NEEDED"]);
exports.expenseService = {
    async createPurchaseRequest(input) {
        await assertFundOwnership(input.tenantId, input.organizationId, input.fundId);
        const now = firestore_1.Timestamp.now();
        const requestRef = firestore_2.db.collection(collections_1.COLLECTIONS.purchaseRequests).doc();
        const request = {
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
    async updateDraftPurchaseRequest(input) {
        await assertFundOwnership(input.tenantId, input.organizationId, input.fundId);
        const existing = await getRequestOrThrow(input.tenantId, input.organizationId, input.requestId);
        if (!PR_EDITABLE_STATUSES.has(existing.data.status)) {
            throw new errors_1.AppError("Only draft or revision-needed requests can be edited.", "request/invalid-status", 412);
        }
        const now = firestore_1.Timestamp.now();
        await firestore_2.db.collection(collections_1.COLLECTIONS.purchaseRequests).doc(input.requestId).update({
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
    async submitPurchaseRequest(input) {
        const existing = await getRequestOrThrow(input.tenantId, input.organizationId, input.requestId);
        if (!PR_EDITABLE_STATUSES.has(existing.data.status)) {
            throw new errors_1.AppError("Request cannot be submitted from its current status.", "request/invalid-status", 412);
        }
        const nextStatus = "AWAITING_PREAPPROVAL";
        const now = firestore_1.Timestamp.now();
        await firestore_2.db.collection(collections_1.COLLECTIONS.purchaseRequests).doc(input.requestId).update({
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
    async createExpenseReport(input) {
        const requestDoc = await getRequestOrThrow(input.tenantId, input.organizationId, input.requestId);
        const existingReportSnap = await firestore_2.db
            .collection(collections_1.COLLECTIONS.expenseReports)
            .where("tenantId", "==", input.tenantId)
            .where("organizationId", "==", input.organizationId)
            .where("requestId", "==", input.requestId)
            .limit(1)
            .get();
        if (!existingReportSnap.empty) {
            const existingDoc = existingReportSnap.docs[0];
            const existingData = existingDoc.data();
            return {
                reportId: existingDoc.id,
                status: existingData.status,
                existed: true
            };
        }
        if (requestDoc.data.status !== "APPROVE" && requestDoc.data.status !== "REQUEST_REVISIONS_NEEDED") {
            throw new errors_1.AppError("Expense report can only be created after pre-approval or when revisions are requested.", "expense-report/invalid-request-status", 412);
        }
        const now = firestore_1.Timestamp.now();
        const report = {
            tenantId: input.tenantId,
            organizationId: input.organizationId,
            requestId: input.requestId,
            status: "DRAFT",
            postingStatus: "NOT_POSTED",
            createdAt: now,
            updatedAt: now
        };
        const reportRef = await firestore_2.db.collection(collections_1.COLLECTIONS.expenseReports).add(report);
        await firestore_2.db.collection(collections_1.COLLECTIONS.purchaseRequests).doc(input.requestId).update({
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
    async upsertExpenseLineItem(input) {
        await getRequestOrThrow(input.tenantId, input.organizationId, input.requestId);
        const reportDoc = await getExpenseReportOrThrow(input.tenantId, input.organizationId, input.reportId);
        const reportData = reportDoc.data;
        if (reportData.requestId !== input.requestId) {
            throw new errors_1.AppError("Report is not linked to this request.", "expense-report/request-mismatch", 403);
        }
        if (!ER_EDITABLE_STATUSES.has(reportData.status)) {
            throw new errors_1.AppError("Expense report line items can only be edited in draft or revision-needed status.", "expense-report/invalid-status", 412);
        }
        const expenseDate = parseTimestampField(input.expenseDate, "expenseDate");
        const now = firestore_1.Timestamp.now();
        let lineItemId = input.lineItemId || "";
        if (input.lineItemId) {
            const lineItemRef = firestore_2.db.collection(collections_1.COLLECTIONS.expenseLineItems).doc(input.lineItemId);
            const lineItemSnap = await lineItemRef.get();
            if (!lineItemSnap.exists) {
                throw new errors_1.AppError("Expense line item not found.", "expense-line-item/not-found", 404);
            }
            const existingLine = lineItemSnap.data();
            assertTenantOrgRecord(existingLine, input.tenantId, input.organizationId, "expense-line-item");
            if (existingLine.requestId !== input.requestId || existingLine.reportId !== input.reportId) {
                throw new errors_1.AppError("Line item does not match request/report.", "expense-line-item/mismatch", 403);
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
        }
        else {
            const lineItem = {
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
            const lineItemRef = await firestore_2.db.collection(collections_1.COLLECTIONS.expenseLineItems).add(lineItem);
            lineItemId = lineItemRef.id;
        }
        const actualAmount = await sumActualAmountByRequest(input.tenantId, input.organizationId, input.requestId);
        await firestore_2.db.collection(collections_1.COLLECTIONS.purchaseRequests).doc(input.requestId).update({
            actualAmount,
            updatedAt: now
        });
        await firestore_2.db.collection(collections_1.COLLECTIONS.expenseReports).doc(input.reportId).update({ updatedAt: now });
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
    async applyPurchaseRequestApprovalAction(input) {
        const requestDoc = await getRequestOrThrow(input.tenantId, input.organizationId, input.requestId);
        if (requestDoc.data.status !== "AWAITING_PREAPPROVAL") {
            throw new errors_1.AppError("Purchase request approval action is only allowed in AWAITING_PREAPPROVAL status.", "request/invalid-status", 412);
        }
        let nextStatus = requestDoc.data.status;
        let decision = input.action;
        let step = "PR_REVIEW";
        const updates = {
            updatedAt: firestore_1.Timestamp.now()
        };
        if (input.action === "APPROVE") {
            nextStatus = "APPROVE";
            updates.status = nextStatus;
            updates.approvedAmount = requestDoc.data.estimatedAmount;
            decision = "APPROVE";
        }
        else if (input.action === "REJECT") {
            nextStatus = "REJECT";
            updates.status = nextStatus;
            decision = "REJECT";
        }
        else if (input.action === "REQUEST_REVISIONS") {
            nextStatus = "REQUEST_REVISIONS_NEEDED";
            updates.status = nextStatus;
            decision = "REQUEST_REVISIONS";
        }
        else {
            throw new errors_1.AppError("Unsupported purchase request action.", "request/invalid-action", 400);
        }
        await firestore_2.db.collection(collections_1.COLLECTIONS.purchaseRequests).doc(input.requestId).update(updates);
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
    async applyExpenseReportApprovalAction(input) {
        const requestDoc = await getRequestOrThrow(input.tenantId, input.organizationId, input.requestId);
        const reportDoc = await getExpenseReportOrThrow(input.tenantId, input.organizationId, input.reportId);
        if (reportDoc.data.requestId !== input.requestId) {
            throw new errors_1.AppError("Expense report does not belong to the request.", "expense-report/request-mismatch", 403);
        }
        let nextRequestStatus = requestDoc.data.status;
        let nextReportStatus = reportDoc.data.status;
        let step = "ER_REVIEW";
        let decision = input.action;
        const now = firestore_1.Timestamp.now();
        if (input.action === "SUBMIT") {
            if (!ER_EDITABLE_STATUSES.has(reportDoc.data.status)) {
                throw new errors_1.AppError("Expense report can only be submitted from draft or revision-needed status.", "expense-report/invalid-status", 412);
            }
            if (requestDoc.data.status !== "APPROVE" &&
                requestDoc.data.status !== "REQUEST_REVISIONS_NEEDED" &&
                requestDoc.data.status !== "EXPENSE_DRAFT") {
                throw new errors_1.AppError("Request is not ready for expense report submission.", "request/invalid-status", 412);
            }
            nextReportStatus = "SUBMIT";
            nextRequestStatus = "AWAITING_FINANCE_REVIEW";
            step = "ER_SUBMIT";
            decision = "SUBMIT";
            await firestore_2.db.collection(collections_1.COLLECTIONS.expenseReports).doc(input.reportId).update({
                status: nextReportStatus,
                submittedAt: now,
                updatedAt: now
            });
            await firestore_2.db.collection(collections_1.COLLECTIONS.purchaseRequests).doc(input.requestId).update({
                status: nextRequestStatus,
                updatedAt: now
            });
        }
        else if (input.action === "APPROVE") {
            if (reportDoc.data.status !== "SUBMIT") {
                throw new errors_1.AppError("Expense report approval is only allowed in SUBMIT status.", "expense-report/invalid-status", 412);
            }
            nextReportStatus = "APPROVE";
            nextRequestStatus = "EXPENSE_APPROVE";
            decision = "APPROVE";
            await firestore_2.db.collection(collections_1.COLLECTIONS.expenseReports).doc(input.reportId).update({
                status: nextReportStatus,
                updatedAt: now
            });
            await firestore_2.db.collection(collections_1.COLLECTIONS.purchaseRequests).doc(input.requestId).update({
                status: nextRequestStatus,
                updatedAt: now
            });
        }
        else if (input.action === "REJECT") {
            if (reportDoc.data.status !== "SUBMIT") {
                throw new errors_1.AppError("Expense report rejection is only allowed in SUBMIT status.", "expense-report/invalid-status", 412);
            }
            nextReportStatus = "REJECT";
            nextRequestStatus = "REJECT";
            decision = "REJECT";
            await firestore_2.db.collection(collections_1.COLLECTIONS.expenseReports).doc(input.reportId).update({
                status: nextReportStatus,
                updatedAt: now
            });
            await firestore_2.db.collection(collections_1.COLLECTIONS.purchaseRequests).doc(input.requestId).update({
                status: nextRequestStatus,
                updatedAt: now
            });
        }
        else if (input.action === "REQUEST_REVISIONS") {
            if (reportDoc.data.status !== "SUBMIT") {
                throw new errors_1.AppError("Revision request is only allowed in SUBMIT status.", "expense-report/invalid-status", 412);
            }
            nextReportStatus = "REQUEST_REVISIONS_NEEDED";
            nextRequestStatus = "REQUEST_REVISIONS_NEEDED";
            decision = "REQUEST_REVISIONS";
            await firestore_2.db.collection(collections_1.COLLECTIONS.expenseReports).doc(input.reportId).update({
                status: nextReportStatus,
                updatedAt: now
            });
            await firestore_2.db.collection(collections_1.COLLECTIONS.purchaseRequests).doc(input.requestId).update({
                status: nextRequestStatus,
                updatedAt: now
            });
        }
        else if (input.action === "MARK_PAY") {
            if (reportDoc.data.status !== "APPROVE") {
                throw new errors_1.AppError("Mark paid is only allowed after expense report approval.", "expense-report/invalid-status", 412);
            }
            nextReportStatus = "MARK_PAY";
            nextRequestStatus = "MARK_PAY";
            step = "ER_PAYMENT";
            decision = "MARK_PAY";
            await firestore_2.db.collection(collections_1.COLLECTIONS.expenseReports).doc(input.reportId).update({
                status: nextReportStatus,
                updatedAt: now
            });
            await firestore_2.db.collection(collections_1.COLLECTIONS.purchaseRequests).doc(input.requestId).update({
                status: nextRequestStatus,
                updatedAt: now
            });
        }
        else {
            throw new errors_1.AppError("Unsupported expense report action.", "expense-report/invalid-action", 400);
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
    async getPurchaseRequestDetail(input) {
        const requestDoc = await getRequestOrThrow(input.tenantId, input.organizationId, input.requestId);
        const reportSnap = await firestore_2.db
            .collection(collections_1.COLLECTIONS.expenseReports)
            .where("tenantId", "==", input.tenantId)
            .where("organizationId", "==", input.organizationId)
            .where("requestId", "==", input.requestId)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();
        const lineItemsSnap = await firestore_2.db
            .collection(collections_1.COLLECTIONS.expenseLineItems)
            .where("tenantId", "==", input.tenantId)
            .where("organizationId", "==", input.organizationId)
            .where("requestId", "==", input.requestId)
            .orderBy("expenseDate", "asc")
            .get();
        const approvalsSnap = await firestore_2.db
            .collection(collections_1.COLLECTIONS.approvals)
            .where("tenantId", "==", input.tenantId)
            .where("organizationId", "==", input.organizationId)
            .where("requestId", "==", input.requestId)
            .orderBy("createdAt", "asc")
            .get();
        let budgetSnapshot = null;
        if (requestDoc.data.fundId) {
            budgetSnapshot = await budgetService_1.budgetService.getFundBudgetSnapshot({
                tenantId: input.tenantId,
                organizationId: input.organizationId,
                fundId: requestDoc.data.fundId
            });
        }
        const reportDoc = reportSnap.empty ? null : reportSnap.docs[0];
        return {
            request: {
                id: requestDoc.id,
                ...serializeValue(requestDoc.data)
            },
            expenseReport: reportDoc
                ? {
                    id: reportDoc.id,
                    ...serializeValue(reportDoc.data())
                }
                : null,
            lineItems: lineItemsSnap.docs.map((doc) => ({
                id: doc.id,
                ...serializeValue(doc.data())
            })),
            approvals: approvalsSnap.docs.map((doc) => ({
                id: doc.id,
                ...serializeValue(doc.data())
            })),
            budgetSnapshot
        };
    }
};
