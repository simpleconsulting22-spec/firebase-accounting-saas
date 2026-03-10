import { Timestamp } from "firebase-admin/firestore";

export interface Report {
  tenantId: string;
  organizationId: string;
  type: string;
  period: string;
  generatedAt: Timestamp;
  createdBy: string;
}
