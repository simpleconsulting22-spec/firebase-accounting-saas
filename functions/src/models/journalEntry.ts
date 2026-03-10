import { Timestamp } from "firebase-admin/firestore";

export type JournalEntryStatus = "DRAFT" | "POSTED";

export interface JournalEntryLine {
  accountId: string;
  debit: number;
  credit: number;
  memo?: string;
  className?: string;
  tagName?: string;
}

export interface JournalEntry {
  tenantId: string;
  organizationId: string;
  date: Timestamp;
  periodKey: string;
  reference: string;
  sourceModule: string;
  sourceId: string;
  status: JournalEntryStatus;
  memo?: string;
  lines: JournalEntryLine[];
  createdAt: Timestamp;
  createdBy: string;
}
