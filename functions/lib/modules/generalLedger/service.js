"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalLedgerModuleService = void 0;
const chartOfAccountsService_1 = require("../../services/chartOfAccountsService");
const glPostingService_1 = require("../../services/glPostingService");
const journalEntryService_1 = require("../../services/journalEntryService");
exports.generalLedgerModuleService = {
    listChartOfAccounts: chartOfAccountsService_1.chartOfAccountsService.listChartOfAccounts,
    createChartOfAccount: chartOfAccountsService_1.chartOfAccountsService.createChartOfAccount,
    updateChartOfAccount: chartOfAccountsService_1.chartOfAccountsService.updateChartOfAccount,
    deleteChartOfAccount: chartOfAccountsService_1.chartOfAccountsService.deleteChartOfAccount,
    createJournalEntry: journalEntryService_1.journalEntryService.createJournalEntry,
    listJournalEntries: journalEntryService_1.journalEntryService.listJournalEntries,
    getJournalEntryDetail: journalEntryService_1.journalEntryService.getJournalEntryDetail,
    postExpenseReportToLedger: glPostingService_1.glPostingService.postExpenseReportToLedger
};
