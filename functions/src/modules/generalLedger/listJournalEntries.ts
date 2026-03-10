import { onCall } from "firebase-functions/v2/https";
import { generalLedgerController } from "./controller";

export const listJournalEntries = onCall(async (request) => {
  return generalLedgerController.listJournalEntries(request);
});
