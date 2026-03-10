import { onCall } from "firebase-functions/v2/https";
import { generalLedgerController } from "./controller";

export const createChartOfAccount = onCall(async (request) => {
  return generalLedgerController.createChartOfAccount(request);
});
