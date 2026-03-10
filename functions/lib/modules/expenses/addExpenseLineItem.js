"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addExpenseLineItem = void 0;
const https_1 = require("firebase-functions/v2/https");
const controller_1 = require("./controller");
exports.addExpenseLineItem = (0, https_1.onCall)(async (request) => {
    return controller_1.expensesController.upsertExpenseLineItem(request);
});
