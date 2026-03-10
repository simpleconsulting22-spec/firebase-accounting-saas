import { Timestamp } from "firebase-admin/firestore";

export type AccountingExportType =
  | "quickbooks_expense_export"
  | "gl_export"
  | "reporting_export";

export type AccountingExportStatus = "RUNNING" | "COMPLETED" | "FAILED";

export interface AccountingExport {
  tenantId: string;
  organizationId: string;
  exportType: AccountingExportType;
  status: AccountingExportStatus;
  dateFrom: Timestamp;
  dateTo: Timestamp;
  generatedBy: string;
  generatedAt: Timestamp;
  fileUrl: string;
  rowCount: number;
  metadata: Record<string, unknown>;
}
