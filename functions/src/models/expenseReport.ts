import { Timestamp } from "firebase-admin/firestore";

export type ExpensePostingStatus = "NOT_POSTED" | "POSTED" | "FAILED";

export interface ExpenseReport {
  tenantId: string;
  organizationId: string;
  requestId: string;
  status: string;
  postingStatus?: ExpensePostingStatus;
  journalEntryId?: string;
  postedAt?: Timestamp;
  postingError?: string;
  submittedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
