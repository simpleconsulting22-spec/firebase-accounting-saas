import { Timestamp } from "firebase-admin/firestore";

export interface PurchaseRequest {
  tenantId: string;
  organizationId: string;
  fundId: string;
  ministryDepartment: string;
  requestorId: string;
  approverId: string;
  estimatedAmount: number;
  approvedAmount: number;
  actualAmount: number;
  status: string;
  plannedPaymentMethod: string;
  purpose: string;
  description: string;
  requestedExpenseDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
