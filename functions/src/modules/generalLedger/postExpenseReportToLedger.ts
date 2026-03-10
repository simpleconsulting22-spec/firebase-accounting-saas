import { onCall } from "firebase-functions/v2/https";
import { generalLedgerController } from "./controller";

export const postExpenseReportToLedger = onCall(async (request) => {
  return generalLedgerController.postExpenseReportToLedger(request);
});
