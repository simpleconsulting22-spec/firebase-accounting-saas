"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expensePostingMapper = void 0;
const firestore_1 = require("firebase-admin/firestore");
const collections_1 = require("../config/collections");
const errors_1 = require("../utils/errors");
const firestore_2 = require("../utils/firestore");
const isEventOrSpecialProjectFund = (fundType) => fundType === "Events" || fundType === "Special Projects";
const chunkIds = (ids, size) => {
    const chunks = [];
    for (let index = 0; index < ids.length; index += size) {
        chunks.push(ids.slice(index, index + size));
    }
    return chunks;
};
const fetchByIds = async (collection, ids) => {
    const out = new Map();
    const distinct = Array.from(new Set(ids.filter((value) => String(value || "").trim().length > 0)));
    if (distinct.length === 0) {
        return out;
    }
    for (const idChunk of chunkIds(distinct, 30)) {
        const snap = await firestore_2.db.collection(collection).where(firestore_1.FieldPath.documentId(), "in", idChunk).get();
        snap.docs.forEach((doc) => {
            out.set(doc.id, doc.data());
        });
    }
    return out;
};
const assertTenantOrg = (entity, tenantId, organizationId, entityName) => {
    if (String(entity.tenantId || "") !== tenantId || String(entity.organizationId || "") !== organizationId) {
        throw new errors_1.AppError(`${entityName} does not belong to tenant/organization.`, `${entityName}/forbidden`, 403);
    }
};
const getExpenseReportOrThrow = async (tenantId, organizationId, reportId) => {
    const snap = await firestore_2.db.collection(collections_1.COLLECTIONS.expenseReports).doc(reportId).get();
    if (!snap.exists) {
        throw new errors_1.AppError("Expense report not found.", "expense-report/not-found", 404);
    }
    const report = snap.data();
    assertTenantOrg(report, tenantId, organizationId, "expense-report");
    return report;
};
const getPurchaseRequestOrThrow = async (tenantId, organizationId, requestId) => {
    const snap = await firestore_2.db.collection(collections_1.COLLECTIONS.purchaseRequests).doc(requestId).get();
    if (!snap.exists) {
        throw new errors_1.AppError("Purchase request not found.", "purchase-request/not-found", 404);
    }
    const request = snap.data();
    assertTenantOrg(request, tenantId, organizationId, "purchase-request");
    return request;
};
const listExpenseLineItems = async (tenantId, organizationId, reportId) => {
    const snap = await firestore_2.db
        .collection(collections_1.COLLECTIONS.expenseLineItems)
        .where("tenantId", "==", tenantId)
        .where("organizationId", "==", organizationId)
        .where("reportId", "==", reportId)
        .get();
    return snap.docs.map((doc) => ({
        id: doc.id,
        data: doc.data()
    }));
};
const findPostingRoleAccounts = async (tenantId, organizationId) => {
    const snap = await firestore_2.db
        .collection(collections_1.COLLECTIONS.chartOfAccounts)
        .where("tenantId", "==", tenantId)
        .where("organizationId", "==", organizationId)
        .where("active", "==", true)
        .get();
    const out = new Map();
    snap.docs.forEach((doc) => {
        const account = doc.data();
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
const resolveCreditAccount = (roleAccountMap, reportStatus) => {
    if (reportStatus === "PAID") {
        return (roleAccountMap.get("cash_default") ||
            roleAccountMap.get("payable_default") ||
            (() => {
                throw new errors_1.AppError("No cash/payable posting account configured in chart of accounts.", "general-ledger/missing-credit-account", 412);
            })());
    }
    return (roleAccountMap.get("payable_default") ||
        roleAccountMap.get("cash_default") ||
        (() => {
            throw new errors_1.AppError("No payable/cash posting account configured in chart of accounts.", "general-ledger/missing-credit-account", 412);
        })());
};
const resolveTagName = (fund) => {
    if (!fund) {
        return "";
    }
    return isEventOrSpecialProjectFund(String(fund.fundType || "")) ? String(fund.fundName || "") : "";
};
const timestampToDate = (value) => {
    if (!value) {
        return new Date().toISOString().slice(0, 10);
    }
    return value.toDate().toISOString().slice(0, 10);
};
exports.expensePostingMapper = {
    async mapExpenseReportToJournal(input) {
        const report = await getExpenseReportOrThrow(input.tenantId, input.organizationId, input.reportId);
        if (report.status !== "APPROVED" && report.status !== "PAID") {
            throw new errors_1.AppError("Expense report must be APPROVED or PAID before posting.", "expense-report/not-postable", 412);
        }
        const request = await getPurchaseRequestOrThrow(input.tenantId, input.organizationId, report.requestId);
        const lineItems = await listExpenseLineItems(input.tenantId, input.organizationId, input.reportId);
        if (lineItems.length === 0) {
            throw new errors_1.AppError("Expense report has no line items to post.", "expense-report/no-line-items", 412);
        }
        const categoryMap = await fetchByIds(collections_1.COLLECTIONS.categories, lineItems.map((item) => item.data.categoryId));
        let fund = null;
        if (request.fundId) {
            const fundSnap = await firestore_2.db.collection(collections_1.COLLECTIONS.funds).doc(request.fundId).get();
            if (fundSnap.exists) {
                const fundData = fundSnap.data();
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
        const lines = [];
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
                throw new errors_1.AppError(`Missing expense account mapping for category '${lineItem.data.categoryId}'.`, "general-ledger/missing-expense-account", 412);
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
            throw new errors_1.AppError("Expense report has no positive line item amounts to post.", "expense-report/no-positive-amounts", 412);
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
