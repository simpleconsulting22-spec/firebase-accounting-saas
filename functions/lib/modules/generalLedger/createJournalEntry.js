"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJournalEntry = void 0;
const https_1 = require("firebase-functions/v2/https");
const controller_1 = require("./controller");
exports.createJournalEntry = (0, https_1.onCall)(async (request) => {
    return controller_1.generalLedgerController.createJournalEntry(request);
});
