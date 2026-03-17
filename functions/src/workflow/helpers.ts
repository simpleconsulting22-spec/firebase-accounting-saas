import * as admin from "firebase-admin";
import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { v4: uuidv4 } = require("uuid") as { v4: () => string };
import { COLLECTION, TENANT_ID } from "./constants";
import { UserProfile } from "./types";

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

/**
 * Verifies that a callable context has an authenticated user.
 * Throws HttpsError if not authenticated.
 */
export function verifyAuth(request: CallableRequest): string {
  if (!request.auth?.uid) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in to perform this action."
    );
  }
  return request.auth.uid;
}

/**
 * Verifies that the authenticated user has access to the given orgId.
 * Supports both the new flat schema (orgId + role fields) and the legacy
 * orgRoles map field, then falls back to the orgRoles collection.
 */
export async function verifyOrgAccess(
  request: CallableRequest,
  orgId: string
): Promise<string> {
  const uid = verifyAuth(request);
  const db = admin.firestore();

  // Check new flat schema first
  const userSnap = await db.collection(COLLECTION.USERS).doc(uid).get();
  if (userSnap.exists) {
    const data = userSnap.data()!;
    // New flat schema
    if (data.orgId === orgId && data.active !== false) return uid;
    // Legacy orgRoles map
    if (data.orgRoles && data.orgRoles[orgId]) return uid;
  }

  // Fall back to orgRoles collection
  const roleSnap = await db
    .collection(COLLECTION.ORG_ROLES)
    .where("uid", "==", uid)
    .where("orgId", "==", orgId)
    .limit(1)
    .get();

  if (!roleSnap.empty) {
    return uid;
  }

  throw new HttpsError(
    "permission-denied",
    "You do not have access to this organization."
  );
}

/**
 * Returns the roles array for a given user + org, or [] if none.
 * Supports both the new flat schema (single role field) and the legacy
 * orgRoles map field, then falls back to the orgRoles collection.
 */
export async function getUserOrgRoles(
  uid: string,
  orgId: string
): Promise<string[]> {
  const db = admin.firestore();

  const userSnap = await db.collection(COLLECTION.USERS).doc(uid).get();
  if (userSnap.exists) {
    const data = userSnap.data()!;
    // New flat schema
    if (data.orgId === orgId && data.role) return [data.role];
    // Legacy orgRoles map
    if (data.orgRoles?.[orgId]) return data.orgRoles[orgId];
  }

  // Fall back to orgRoles collection
  const snap = await db
    .collection(COLLECTION.ORG_ROLES)
    .where("uid", "==", uid)
    .where("orgId", "==", orgId)
    .limit(1)
    .get();

  if (snap.empty) return [];
  const data = snap.docs[0].data();
  return Array.isArray(data.roles) ? data.roles : [];
}

/**
 * Requires that the user has at least one of the given roles in the org.
 */
export async function requireRole(
  uid: string,
  orgId: string,
  roles: string[]
): Promise<void> {
  const userRoles = await getUserOrgRoles(uid, orgId);
  const hasRole = roles.some((r) => userRoles.includes(r));
  if (!hasRole) {
    throw new HttpsError(
      "permission-denied",
      `Requires one of the following roles: ${roles.join(", ")}`
    );
  }
}

// ─── Request ID Counter ───────────────────────────────────────────────────────

/**
 * Atomically increments the request counter for an org+year and returns
 * the next formatted request ID: REQ-YYYY-###
 */
export async function getNextRequestId(
  orgId: string,
  year: number
): Promise<string> {
  const db = admin.firestore();
  const counterId = `${orgId}_${year}`;
  const counterRef = db.collection(COLLECTION.COUNTERS).doc(counterId);

  let newCount = 1;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists ? (snap.data()?.count ?? 0) : 0;
    newCount = current + 1;
    tx.set(
      counterRef,
      {
        orgId,
        year,
        count: newCount,
      },
      { merge: true }
    );
  });

  const paddedCount = String(newCount).padStart(3, "0");
  return `REQ-${year}-${paddedCount}`;
}

// ─── Token Utilities ──────────────────────────────────────────────────────────

/**
 * Generates a UUID v4 token string.
 */
export function generateToken(): string {
  return uuidv4();
}

/**
 * Returns a Date N hours from now.
 */
export function tokenExpiryDate(hours: number): Date {
  const d = new Date();
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Formats a number as a USD currency string: "$1,234.56"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── User Profile ─────────────────────────────────────────────────────────────

/**
 * Fetches the user profile document from Firestore by UID.
 * Returns null if not found.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = admin.firestore();
  const snap = await db.collection(COLLECTION.USERS).doc(uid).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<UserProfile, "id">) };
}

/**
 * Returns all org roles for a given user (across all orgs).
 */
export async function getAllUserOrgRoles(
  uid: string
): Promise<Array<{ orgId: string; roles: string[] }>> {
  const db = admin.firestore();
  const snap = await db
    .collection(COLLECTION.ORG_ROLES)
    .where("uid", "==", uid)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      orgId: data.orgId,
      roles: Array.isArray(data.roles) ? data.roles : [],
    };
  });
}

/**
 * Returns all users in an org that have a specific role.
 */
export async function getUsersByRole(
  orgId: string,
  role: string
): Promise<Array<{ uid: string; email: string }>> {
  const db = admin.firestore();

  // Query orgRoles for users with this org who have the role in their array
  const snap = await db
    .collection(COLLECTION.ORG_ROLES)
    .where("orgId", "==", orgId)
    .get();

  const matchingUids: string[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (Array.isArray(data.roles) && data.roles.includes(role)) {
      matchingUids.push(data.uid);
    }
  }

  if (matchingUids.length === 0) return [];

  // Fetch user profiles to get emails
  const results: Array<{ uid: string; email: string }> = [];
  for (const uid of matchingUids) {
    try {
      const userRecord = await admin.auth().getUser(uid);
      results.push({ uid, email: userRecord.email ?? "" });
    } catch {
      // skip users that can't be fetched
    }
  }

  return results;
}

/**
 * Validates that the orgId is one of the known valid orgs.
 */
export function validateOrgId(orgId: string): void {
  const { VALID_ORG_IDS } = require("./constants");
  if (!VALID_ORG_IDS.includes(orgId)) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid orgId: ${orgId}`
    );
  }
}

/**
 * Returns current server timestamp.
 */
export function nowTimestamp(): Timestamp {
  return Timestamp.now();
}

/**
 * Returns the tenant ID constant.
 */
export function getTenantId(): string {
  return TENANT_ID;
}
