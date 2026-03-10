import { Timestamp } from "firebase-admin/firestore";
import { ModuleFlags } from "./common";

export interface Tenant {
  name: string;
  createdAt: Timestamp;
  plan: string;
  modulesEnabled: ModuleFlags;
}
