import { Timestamp } from "firebase-admin/firestore";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type AccountPostingRole = "expense_default" | "cash_default" | "payable_default";

export interface ChartOfAccount {
  tenantId: string;
  organizationId: string;
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  parentAccountId?: string;
  postingRole?: AccountPostingRole;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
