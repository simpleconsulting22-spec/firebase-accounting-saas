import { Timestamp } from "firebase-admin/firestore";

export interface Organization {
  tenantId: string;
  name: string;
  type: string;
  vendorGroupId: string;
  categoryGroupId: string;
  createdAt: Timestamp;
}
