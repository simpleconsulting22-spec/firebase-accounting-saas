"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.budgetService = void 0;
const collections_1 = require("../config/collections");
const firestore_1 = require("../utils/firestore");
const errors_1 = require("../utils/errors");
exports.budgetService = {
    async getFundBudgetSnapshot(input) {
        const fundSnap = await firestore_1.db.collection(collections_1.COLLECTIONS.funds).doc(input.fundId).get();
        if (!fundSnap.exists) {
            throw new errors_1.AppError("Fund not found", "fund/not-found", 404);
        }
        const fund = fundSnap.data();
        if (fund.tenantId !== input.tenantId || fund.organizationId !== input.organizationId) {
            throw new errors_1.AppError("Fund does not belong to tenant/organization", "fund/forbidden", 403);
        }
        const requestSnap = await firestore_1.db
            .collection(collections_1.COLLECTIONS.purchaseRequests)
            .where("tenantId", "==", input.tenantId)
            .where("organizationId", "==", input.organizationId)
            .where("fundId", "==", input.fundId)
            .get();
        const requestIds = requestSnap.docs.map((d) => d.id);
        let used = 0;
        if (requestIds.length > 0) {
            const chunkSize = 30;
            for (let i = 0; i < requestIds.length; i += chunkSize) {
                const ids = requestIds.slice(i, i + chunkSize);
                const linesSnap = await firestore_1.db
                    .collection(collections_1.COLLECTIONS.expenseLineItems)
                    .where("tenantId", "==", input.tenantId)
                    .where("organizationId", "==", input.organizationId)
                    .where("requestId", "in", ids)
                    .get();
                linesSnap.forEach((doc) => {
                    used += Number(doc.data().amount || 0);
                });
            }
        }
        const annualBudget = Number(fund.annualBudget || 0);
        return {
            fundId: input.fundId,
            fundName: String(fund.fundName || ""),
            fundType: String(fund.fundType || ""),
            annualBudget,
            used,
            remaining: annualBudget - used,
            ministryDepartment: String(fund.ministryDepartment || "")
        };
    }
};
