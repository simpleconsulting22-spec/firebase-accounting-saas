import { Timestamp } from "firebase-admin/firestore";

export type Role = "admin" | "finance" | "approver" | "requestor";

export interface ModuleFlags {
  expenses: boolean;
  generalLedger: boolean;
  fixedAssets: boolean;
  financialReports: boolean;
  payroll: boolean;
  donations: boolean;
}

export interface AuditFields {
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
