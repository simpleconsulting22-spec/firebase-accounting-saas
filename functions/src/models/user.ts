import { Timestamp } from "firebase-admin/firestore";
import { Role } from "./common";

export type OrgRoles = Record<string, Role[]>;

export interface User {
  email: string;
  tenantId: string;
  orgRoles: OrgRoles;
  vendorGroupIds?: string[];
  categoryGroupIds?: string[];
  createdAt: Timestamp;
}
