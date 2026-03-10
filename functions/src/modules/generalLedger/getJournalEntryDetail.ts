import { onCall } from "firebase-functions/v2/https";
import { generalLedgerController } from "./controller";

export const getJournalEntryDetail = onCall(async (request) => {
  return generalLedgerController.getJournalEntryDetail(request);
});
