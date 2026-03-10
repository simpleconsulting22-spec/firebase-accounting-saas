import { onCall } from "firebase-functions/v2/https";
import { expensesController } from "./controller";

export const applyExpenseReportApprovalAction = onCall(async (request) => {
  return expensesController.applyExpenseReportApprovalAction(request);
});
