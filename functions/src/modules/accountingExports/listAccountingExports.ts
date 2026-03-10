import { onCall } from "firebase-functions/v2/https";
import { accountingExportsController } from "./controller";

export const listAccountingExports = onCall(async (request) => {
  return accountingExportsController.listAccountingExports(request);
});
