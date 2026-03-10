import { expenseService } from "../../services/expenseService";

export const expensesModuleService = {
  createPurchaseRequest: expenseService.createPurchaseRequest,
  updateDraftPurchaseRequest: expenseService.updateDraftPurchaseRequest,
  submitPurchaseRequest: expenseService.submitPurchaseRequest,
  applyPurchaseRequestApprovalAction: expenseService.applyPurchaseRequestApprovalAction,
  createExpenseReport: expenseService.createExpenseReport,
  upsertExpenseLineItem: expenseService.upsertExpenseLineItem,
  applyExpenseReportApprovalAction: expenseService.applyExpenseReportApprovalAction,
  getPurchaseRequestDetail: expenseService.getPurchaseRequestDetail
};
