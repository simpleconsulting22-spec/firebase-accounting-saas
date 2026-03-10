import { apiClient } from "../../services/apiClient";
export const expensesApi = {
    createPurchaseRequest(payload) {
        return apiClient.call("createPurchaseRequest", payload);
    },
    updateDraftPurchaseRequest(payload) {
        return apiClient.call("updateDraftPurchaseRequest", payload);
    },
    submitPurchaseRequest(payload) {
        return apiClient.call("submitPurchaseRequest", payload);
    },
    applyPurchaseRequestApprovalAction(payload) {
        return apiClient.call("applyPurchaseRequestApprovalAction", payload);
    },
    getPurchaseRequestDetail(payload) {
        return apiClient.call("getPurchaseRequestDetail", payload);
    },
    createExpenseReport(payload) {
        return apiClient.call("createExpenseReport", payload);
    },
    upsertExpenseLineItem(payload) {
        return apiClient.call("addExpenseLineItem", payload);
    },
    applyExpenseReportApprovalAction(payload) {
        return apiClient.call("applyExpenseReportApprovalAction", payload);
    },
    getBudgetSnapshot(payload) {
        return apiClient.call("getBudgetSnapshot", payload);
    }
};
