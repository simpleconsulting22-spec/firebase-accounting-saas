import { onCall } from "firebase-functions/v2/https";
import { generalLedgerController } from "./controller";

export const listChartOfAccounts = onCall(async (request) => {
  return generalLedgerController.listChartOfAccounts(request);
});
