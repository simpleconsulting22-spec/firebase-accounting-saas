import { Timestamp } from "firebase-admin/firestore";

export type FundType = "Operating" | "Events" | "Special Projects";

export interface Fund {
  tenantId: string;
  organizationId: string;
  ministryDepartment: string;
  fundName: string;
  fundType: FundType;
  annualBudget: number;
  year: number;
  createdAt: Timestamp;
  active: boolean;
}
