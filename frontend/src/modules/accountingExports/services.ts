import { apiClient } from "../../services/apiClient";
import {
  AccountingExportHistoryItem,
  GenerateQuickbooksExpenseExportPayload,
  GenerateQuickbooksExpenseExportResult,
  ListAccountingExportsPayload
} from "./types";

export const accountingExportsApi = {
  generateQuickbooksExpenseExport(
    payload: GenerateQuickbooksExpenseExportPayload
  ): Promise<GenerateQuickbooksExpenseExportResult> {
    return apiClient.call<GenerateQuickbooksExpenseExportPayload, GenerateQuickbooksExpenseExportResult>(
      "generateQuickbooksExpenseExport",
      payload
    );
  },

  listAccountingExports(payload: ListAccountingExportsPayload): Promise<AccountingExportHistoryItem[]> {
    return apiClient.call<ListAccountingExportsPayload, AccountingExportHistoryItem[]>(
      "listAccountingExports",
      payload
    );
  }
};
