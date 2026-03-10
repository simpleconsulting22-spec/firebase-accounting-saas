export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type AccountPostingRole = "expense_default" | "cash_default" | "payable_default";
export type JournalEntryStatus = "DRAFT" | "POSTED";

export interface TenantOrgPayload {
  tenantId: string;
  organizationId: string;
}

export interface ChartOfAccountRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  parentAccountId?: string | null;
  postingRole?: AccountPostingRole | null;
  active: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ListChartOfAccountsPayload extends TenantOrgPayload {
  includeInactive?: boolean;
}

export interface CreateChartOfAccountPayload extends TenantOrgPayload {
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  parentAccountId?: string;
  postingRole?: AccountPostingRole;
  active?: boolean;
}

export interface UpdateChartOfAccountPayload extends TenantOrgPayload {
  accountId: string;
  accountNumber?: string;
  accountName?: string;
  accountType?: AccountType;
  parentAccountId?: string | null;
  postingRole?: AccountPostingRole | null;
  active?: boolean;
}

export interface DeleteChartOfAccountPayload extends TenantOrgPayload {
  accountId: string;
}

export interface JournalEntryLinePayload {
  accountId: string;
  debit: number;
  credit: number;
  memo?: string;
  className?: string;
  tagName?: string;
}

export interface CreateJournalEntryPayload extends TenantOrgPayload {
  date: string;
  reference: string;
  sourceModule: string;
  sourceId: string;
  memo?: string;
  status?: JournalEntryStatus;
  lines: JournalEntryLinePayload[];
}

export interface ListJournalEntriesPayload extends TenantOrgPayload {
  status?: JournalEntryStatus;
  limit?: number;
}

export interface JournalEntryListItem {
  id: string;
  date: string;
  periodKey: string;
  reference: string;
  sourceModule: string;
  sourceId: string;
  status: JournalEntryStatus;
  memo: string;
  lineCount: number;
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
  createdBy: string;
}

export interface GetJournalEntryDetailPayload extends TenantOrgPayload {
  journalEntryId: string;
}

export interface JournalEntryDetailLine {
  accountId: string;
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
  memo: string;
  className: string;
  tagName: string;
}

export interface JournalEntryDetail {
  id: string;
  tenantId: string;
  organizationId: string;
  date: string;
  periodKey: string;
  reference: string;
  sourceModule: string;
  sourceId: string;
  status: JournalEntryStatus;
  memo: string;
  createdAt: string;
  createdBy: string;
  totalDebit: number;
  totalCredit: number;
  lines: JournalEntryDetailLine[];
}

export interface PostExpenseReportToLedgerPayload extends TenantOrgPayload {
  reportId: string;
  date?: string;
  reference?: string;
  memo?: string;
}

export interface PostExpenseReportToLedgerResult {
  reportId: string;
  postingStatus: "POSTED";
  journalEntryId: string;
  existed: boolean;
  periodKey: string;
}
