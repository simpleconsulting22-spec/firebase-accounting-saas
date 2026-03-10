import { onCall } from "firebase-functions/v2/https";
import { expensesController } from "./controller";

export const applyPurchaseRequestApprovalAction = onCall(async (request) => {
  return expensesController.applyPurchaseRequestApprovalAction(request);
});
