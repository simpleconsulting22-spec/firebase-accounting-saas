import { onCall } from "firebase-functions/v2/https";
import { expensesController } from "./controller";

export const getPurchaseRequestDetail = onCall(async (request) => {
  return expensesController.getPurchaseRequestDetail(request);
});
