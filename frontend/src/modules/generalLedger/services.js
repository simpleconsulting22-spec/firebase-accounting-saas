import { apiClient } from "../../services/apiClient";
export const generalLedgerApi = {
    listChartOfAccounts(payload) {
        return apiClient.call("listChartOfAccounts", payload);
    },
    createChartOfAccount(payload) {
        return apiClient.call("createChartOfAccount", payload);
    },
    updateChartOfAccount(payload) {
        return apiClient.call("updateChartOfAccount", payload);
    },
    deleteChartOfAccount(payload) {
        return apiClient.call("deleteChartOfAccount", payload);
    },
    createJournalEntry(payload) {
        return apiClient.call("createJournalEntry", payload);
    },
    listJournalEntries(payload) {
        return apiClient.call("listJournalEntries", payload);
    },
    getJournalEntryDetail(payload) {
        return apiClient.call("getJournalEntryDetail", payload);
    },
    postExpenseReportToLedger(payload) {
        return apiClient.call("postExpenseReportToLedger", payload);
    }
};
