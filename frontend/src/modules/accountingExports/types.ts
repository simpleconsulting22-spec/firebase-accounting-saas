export interface AccountingExportContext {
  tenantId: string;
  organizationId: string;
}

export interface GenerateQuickbooksExpenseExportPayload extends AccountingExportContext {
  dateFrom: string;
  dateTo: string;
}

export interface ListAccountingExportsPayload extends AccountingExportContext {
  limit?: number;
}

export interface GenerateQuickbooksExpenseExportResult {
  exportId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  fileUrl: string;
  rowCount: number;
  exportType: "quickbooks_expense_export" | "gl_export" | "reporting_export";
}

export interface AccountingExportHistoryItem {
  id: string;
  tenantId: string;
  organizationId: string;
  exportType: "quickbooks_expense_export" | "gl_export" | "reporting_export";
  status: "RUNNING" | "COMPLETED" | "FAILED";
  dateFrom: string;
  dateTo: string;
  generatedBy: string;
  generatedAt: string;
  fileUrl: string;
  rowCount: number;
  metadata: Record<string, unknown>;
}
