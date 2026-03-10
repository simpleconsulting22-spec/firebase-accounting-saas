import { onCall } from "firebase-functions/v2/https";
import { expensesController } from "./controller";

export const updateDraftPurchaseRequest = onCall(async (request) => {
  return expensesController.updateDraftPurchaseRequest(request);
});
