import { apiClient } from "../../services/apiClient";
export const accountingExportsApi = {
    generateQuickbooksExpenseExport(payload) {
        return apiClient.call("generateQuickbooksExpenseExport", payload);
    },
    listAccountingExports(payload) {
        return apiClient.call("listAccountingExports", payload);
    }
};
