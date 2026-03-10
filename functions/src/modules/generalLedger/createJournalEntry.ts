import { onCall } from "firebase-functions/v2/https";
import { generalLedgerController } from "./controller";

export const createJournalEntry = onCall(async (request) => {
  return generalLedgerController.createJournalEntry(request);
});
