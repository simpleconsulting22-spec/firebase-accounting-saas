"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expensesModuleService = void 0;
const expenseService_1 = require("../../services/expenseService");
exports.expensesModuleService = {
    createPurchaseRequest: expenseService_1.expenseService.createPurchaseRequest,
    updateDraftPurchaseRequest: expenseService_1.expenseService.updateDraftPurchaseRequest,
    submitPurchaseRequest: expenseService_1.expenseService.submitPurchaseRequest,
    applyPurchaseRequestApprovalAction: expenseService_1.expenseService.applyPurchaseRequestApprovalAction,
    createExpenseReport: expenseService_1.expenseService.createExpenseReport,
    upsertExpenseLineItem: expenseService_1.expenseService.upsertExpenseLineItem,
    applyExpenseReportApprovalAction: expenseService_1.expenseService.applyExpenseReportApprovalAction,
    getPurchaseRequestDetail: expenseService_1.expenseService.getPurchaseRequestDetail
};
