import { onCall } from "firebase-functions/v2/https";
import { expensesController } from "./controller";

export const submitPurchaseRequest = onCall(async (request) => {
  return expensesController.submitPurchaseRequest(request);
});
