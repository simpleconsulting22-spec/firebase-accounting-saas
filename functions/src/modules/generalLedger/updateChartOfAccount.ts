import { onCall } from "firebase-functions/v2/https";
import { generalLedgerController } from "./controller";

export const updateChartOfAccount = onCall(async (request) => {
  return generalLedgerController.updateChartOfAccount(request);
});
