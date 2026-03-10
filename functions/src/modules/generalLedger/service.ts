import { chartOfAccountsService } from "../../services/chartOfAccountsService";
import { glPostingService } from "../../services/glPostingService";
import { journalEntryService } from "../../services/journalEntryService";

export const generalLedgerModuleService = {
  listChartOfAccounts: chartOfAccountsService.listChartOfAccounts,
  createChartOfAccount: chartOfAccountsService.createChartOfAccount,
  updateChartOfAccount: chartOfAccountsService.updateChartOfAccount,
  deleteChartOfAccount: chartOfAccountsService.deleteChartOfAccount,
  createJournalEntry: journalEntryService.createJournalEntry,
  listJournalEntries: journalEntryService.listJournalEntries,
  getJournalEntryDetail: journalEntryService.getJournalEntryDetail,
  postExpenseReportToLedger: glPostingService.postExpenseReportToLedger
};
