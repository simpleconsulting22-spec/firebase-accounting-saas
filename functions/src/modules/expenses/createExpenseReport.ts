import { onCall } from "firebase-functions/v2/https";
import { expensesController } from "./controller";

export const createExpenseReport = onCall(async (request) => {
  return expensesController.createExpenseReport(request);
});
