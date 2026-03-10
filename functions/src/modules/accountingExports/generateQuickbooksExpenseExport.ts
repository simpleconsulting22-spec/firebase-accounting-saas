import { onCall } from "firebase-functions/v2/https";
import { accountingExportsController } from "./controller";

export const generateQuickbooksExpenseExport = onCall(async (request) => {
  return accountingExportsController.generateQuickbooksExpenseExport(request);
});
