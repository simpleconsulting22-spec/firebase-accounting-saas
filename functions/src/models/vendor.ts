import { Timestamp } from "firebase-admin/firestore";

export interface Vendor {
  tenantId: string;
  vendorGroupId: string;
  name: string;
  paymentMethods: string[];
  createdAt: Timestamp;
  active: boolean;
}
