import { onCall } from "firebase-functions/v2/https";
import { expensesController } from "./controller";

export const createPurchaseRequest = onCall(async (request) => {
  return expensesController.createPurchaseRequest(request);
});
