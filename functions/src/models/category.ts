import { Timestamp } from "firebase-admin/firestore";

export interface Category {
  tenantId: string;
  categoryGroupId: string;
  organizationId?: string;
  name: string;
  expenseAccountId?: string;
  active: boolean;
  createdAt: Timestamp;
}
