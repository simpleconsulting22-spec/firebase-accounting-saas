import { Timestamp } from "firebase-admin/firestore";

export interface ExpenseLineItem {
  tenantId: string;
  organizationId: string;
  reportId: string;
  requestId: string;
  vendorId: string;
  categoryId: string;
  amount: number;
  expenseDate: Timestamp;
  description: string;
  receiptUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
