import { apiClient } from "../../services/apiClient";
import {
  ChartOfAccountRecord,
  CreateChartOfAccountPayload,
  CreateJournalEntryPayload,
  DeleteChartOfAccountPayload,
  GetJournalEntryDetailPayload,
  JournalEntryDetail,
  JournalEntryListItem,
  ListChartOfAccountsPayload,
  ListJournalEntriesPayload,
  PostExpenseReportToLedgerPayload,
  PostExpenseReportToLedgerResult,
  UpdateChartOfAccountPayload
} from "./types";

export const generalLedgerApi = {
  listChartOfAccounts(payload: ListChartOfAccountsPayload): Promise<ChartOfAccountRecord[]> {
    return apiClient.call<ListChartOfAccountsPayload, ChartOfAccountRecord[]>("listChartOfAccounts", payload);
  },

  createChartOfAccount(payload: CreateChartOfAccountPayload): Promise<{ accountId: string }> {
    return apiClient.call<CreateChartOfAccountPayload, { accountId: string }>(
      "createChartOfAccount",
      payload
    );
  },

  updateChartOfAccount(payload: UpdateChartOfAccountPayload): Promise<{ accountId: string }> {
    return apiClient.call<UpdateChartOfAccountPayload, { accountId: string }>(
      "updateChartOfAccount",
      payload
    );
  },

  deleteChartOfAccount(payload: DeleteChartOfAccountPayload): Promise<{ accountId: string }> {
    return apiClient.call<DeleteChartOfAccountPayload, { accountId: string }>(
      "deleteChartOfAccount",
      payload
    );
  },

  createJournalEntry(payload: CreateJournalEntryPayload): Promise<{
    journalEntryId: string;
    status: "DRAFT" | "POSTED";
    periodKey: string;
  }> {
    return apiClient.call<
      CreateJournalEntryPayload,
      { journalEntryId: string; status: "DRAFT" | "POSTED"; periodKey: string }
    >("createJournalEntry", payload);
  },

  listJournalEntries(payload: ListJournalEntriesPayload): Promise<JournalEntryListItem[]> {
    return apiClient.call<ListJournalEntriesPayload, JournalEntryListItem[]>(
      "listJournalEntries",
      payload
    );
  },

  getJournalEntryDetail(payload: GetJournalEntryDetailPayload): Promise<JournalEntryDetail> {
    return apiClient.call<GetJournalEntryDetailPayload, JournalEntryDetail>(
      "getJournalEntryDetail",
      payload
    );
  },

  postExpenseReportToLedger(
    payload: PostExpenseReportToLedgerPayload
  ): Promise<PostExpenseReportToLedgerResult> {
    return apiClient.call<PostExpenseReportToLedgerPayload, PostExpenseReportToLedgerResult>(
      "postExpenseReportToLedger",
      payload
    );
  }
};
