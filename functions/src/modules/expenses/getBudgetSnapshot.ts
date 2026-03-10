import { onCall } from "firebase-functions/v2/https";
import { expensesController } from "./controller";

export const getBudgetSnapshot = onCall(async (request) => {
  return expensesController.getBudgetSnapshot(request);
});
