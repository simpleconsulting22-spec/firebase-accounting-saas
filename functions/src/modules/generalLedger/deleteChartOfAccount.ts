import { onCall } from "firebase-functions/v2/https";
import { generalLedgerController } from "./controller";

export const deleteChartOfAccount = onCall(async (request) => {
  return generalLedgerController.deleteChartOfAccount(request);
});
