import { COLLECTIONS } from "../config/collections";
import { db } from "../utils/firestore";
import { AppError } from "../utils/errors";

export interface FundBudgetSnapshotInput {
  tenantId: string;
  organizationId: string;
  fundId: string;
}

export interface FundBudgetSnapshot {
  fundId: string;
  fundName: string;
  fundType: string;
  annualBudget: number;
  used: number;
  remaining: number;
  ministryDepartment: string;
}

export const budgetService = {
  async getFundBudgetSnapshot(input: FundBudgetSnapshotInput): Promise<FundBudgetSnapshot> {
    const fundSnap = await db.collection(COLLECTIONS.funds).doc(input.fundId).get();
    if (!fundSnap.exists) {
      throw new AppError("Fund not found", "fund/not-found", 404);
    }

    const fund = fundSnap.data() as any;
    if (fund.tenantId !== input.tenantId || fund.organizationId !== input.organizationId) {
      throw new AppError("Fund does not belong to tenant/organization", "fund/forbidden", 403);
    }

    const requestSnap = await db
      .collection(COLLECTIONS.purchaseRequests)
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
        const linesSnap = await db
          .collection(COLLECTIONS.expenseLineItems)
          .where("tenantId", "==", input.tenantId)
          .where("organizationId", "==", input.organizationId)
          .where("requestId", "in", ids)
          .get();

        linesSnap.forEach((doc) => {
          used += Number((doc.data() as any).amount || 0);
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
