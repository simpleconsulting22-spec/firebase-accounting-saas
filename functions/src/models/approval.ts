import { Timestamp } from "firebase-admin/firestore";

export interface Approval {
  tenantId: string;
  organizationId: string;
  requestId: string;
  reportId?: string;
  step: string;
  decision: string;
  approvedBy: string;
  approvedAt?: Timestamp;
  comments?: string;
  createdAt: Timestamp;
}
