import { Timestamp } from "firebase-admin/firestore";

export interface Asset {
  tenantId: string;
  organizationId: string;
  name: string;
  purchaseDate: Timestamp;
  purchaseValue: number;
  usefulLifeYears: number;
  depreciationMethod: string;
  status: string;
  createdAt: Timestamp;
}
