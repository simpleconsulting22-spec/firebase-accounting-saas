import { db } from "../utils/firestore";
import { COLLECTIONS } from "../config/collections";
import { AppError } from "../utils/errors";

export interface AuthUserContext {
  uid: string;
  email?: string;
  tenantId: string;
  orgRoles: Record<string, string[]>;
}

export const authService = {
  async getUserContext(uid: string): Promise<AuthUserContext> {
    const snap = await db.collection(COLLECTIONS.users).doc(uid).get();
    if (!snap.exists) {
      throw new AppError("User profile not found", "auth/user-not-found", 403);
    }

    const data = snap.data() as any;
    return {
      uid,
      email: data.email,
      tenantId: data.tenantId,
      orgRoles: data.orgRoles || {}
    };
  }
};
