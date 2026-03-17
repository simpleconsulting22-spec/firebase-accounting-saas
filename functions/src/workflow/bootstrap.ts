import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import {
  CATEGORIES,
  COLLECTION,
  ORG_CONFIG,
  PAYMENT_METHODS,
  TENANT_ID,
} from "./constants";
import {
  getAllUserOrgRoles,
  getUserProfile,
  nowTimestamp,
  verifyAuth,
} from "./helpers";

// ─── getBootstrap ─────────────────────────────────────────────────────────────

/**
 * Returns org config, categories, payment methods, user profile, and user's orgs/roles.
 * Called on app load to hydrate the frontend.
 */
export const getBootstrap = onCall(
  async (request: CallableRequest) => {
    const uid = verifyAuth(request);
    const db = admin.firestore();

    // Fetch user profile and org roles in parallel
    const [profile, orgRoles] = await Promise.all([
      getUserProfile(uid),
      getAllUserOrgRoles(uid),
    ]);

    // Build per-org config visible to this user
    const userOrgIds = orgRoles.map((r) => r.orgId);
    const orgsConfig = userOrgIds.reduce<
      Record<string, { name: string; escalationBufferAmount: number }>
    >((acc, orgId) => {
      if (ORG_CONFIG[orgId]) {
        acc[orgId] = {
          name: ORG_CONFIG[orgId].name,
          escalationBufferAmount: ORG_CONFIG[orgId].escalationBufferAmount,
        };
      }
      return acc;
    }, {});

    // Fetch vendors count per org (lightweight)
    const vendorCounts: Record<string, number> = {};
    for (const orgId of userOrgIds) {
      const snap = await db
        .collection(COLLECTION.VENDORS)
        .where("orgId", "==", orgId)
        .where("status", "==", "active")
        .get();
      vendorCounts[orgId] = snap.size;
    }

    return {
      tenantId: TENANT_ID,
      categories: CATEGORIES,
      paymentMethods: PAYMENT_METHODS,
      orgsConfig,
      userOrgRoles: orgRoles,
      profile: profile ?? null,
      profileComplete: !!(profile?.displayName),
    };
  }
);

// ─── getMyProfile ─────────────────────────────────────────────────────────────

/**
 * Returns the current user's Firestore profile document.
 */
export const getMyProfile = onCall(async (request: CallableRequest) => {
  const uid = verifyAuth(request);
  const profile = await getUserProfile(uid);
  return { profile: profile ?? null };
});

// ─── saveUserProfile ──────────────────────────────────────────────────────────

/**
 * Upserts the current user's profile (displayName, phone, etc.).
 */
export const saveUserProfile = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { displayName?: string; phone?: string };
    const uid = verifyAuth(request);
    const db = admin.firestore();

    if (!data.displayName || data.displayName.trim().length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "displayName is required."
      );
    }

    const userRecord = await admin.auth().getUser(uid);
    const email = userRecord.email ?? "";

    const ref = db.collection(COLLECTION.USERS).doc(uid);
    const snap = await ref.get();

    if (snap.exists) {
      await ref.update({
        displayName: data.displayName.trim(),
        phone: data.phone ?? "",
        updatedAt: nowTimestamp(),
      });
    } else {
      await ref.set({
        uid,
        email,
        displayName: data.displayName.trim(),
        phone: data.phone ?? "",
        orgIds: [],
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp(),
      });
    }

    const updated = await getUserProfile(uid);
    return { profile: updated };
  }
);

// ─── getProfileGate ───────────────────────────────────────────────────────────

/**
 * Checks if the user's profile is complete (has a displayName set).
 * Used to gate access to the main app until profile is filled out.
 */
export const getProfileGate = onCall(
  async (request: CallableRequest) => {
    const uid = verifyAuth(request);
    const profile = await getUserProfile(uid);

    const isComplete = !!(profile?.displayName?.trim());
    return {
      profileComplete: isComplete,
      missingFields: isComplete ? [] : ["displayName"],
    };
  }
);
