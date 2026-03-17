"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuth = verifyAuth;
exports.verifyOrgAccess = verifyOrgAccess;
exports.getUserOrgRoles = getUserOrgRoles;
exports.requireRole = requireRole;
exports.getNextRequestId = getNextRequestId;
exports.generateToken = generateToken;
exports.tokenExpiryDate = tokenExpiryDate;
exports.formatCurrency = formatCurrency;
exports.getUserProfile = getUserProfile;
exports.getAllUserOrgRoles = getAllUserOrgRoles;
exports.getUsersByRole = getUsersByRole;
exports.validateOrgId = validateOrgId;
exports.nowTimestamp = nowTimestamp;
exports.getTenantId = getTenantId;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { v4: uuidv4 } = require("uuid");
const constants_1 = require("./constants");
// ─── Auth Helpers ─────────────────────────────────────────────────────────────
/**
 * Verifies that a callable context has an authenticated user.
 * Throws HttpsError if not authenticated.
 */
function verifyAuth(request) {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "You must be signed in to perform this action.");
    }
    return request.auth.uid;
}
/**
 * Verifies that the authenticated user has access to the given orgId.
 * Supports both the new flat schema (orgId + role fields) and the legacy
 * orgRoles map field, then falls back to the orgRoles collection.
 */
async function verifyOrgAccess(request, orgId) {
    const uid = verifyAuth(request);
    const db = admin.firestore();
    // Check new flat schema first
    const userSnap = await db.collection(constants_1.COLLECTION.USERS).doc(uid).get();
    if (userSnap.exists) {
        const data = userSnap.data();
        // New flat schema
        if (data.orgId === orgId && data.active !== false)
            return uid;
        // Legacy orgRoles map
        if (data.orgRoles && data.orgRoles[orgId])
            return uid;
    }
    // Fall back to orgRoles collection
    const roleSnap = await db
        .collection(constants_1.COLLECTION.ORG_ROLES)
        .where("uid", "==", uid)
        .where("orgId", "==", orgId)
        .limit(1)
        .get();
    if (!roleSnap.empty) {
        return uid;
    }
    throw new https_1.HttpsError("permission-denied", "You do not have access to this organization.");
}
/**
 * Returns the roles array for a given user + org, or [] if none.
 * Supports both the new flat schema (single role field) and the legacy
 * orgRoles map field, then falls back to the orgRoles collection.
 */
async function getUserOrgRoles(uid, orgId) {
    const db = admin.firestore();
    const userSnap = await db.collection(constants_1.COLLECTION.USERS).doc(uid).get();
    if (userSnap.exists) {
        const data = userSnap.data();
        // New flat schema
        if (data.orgId === orgId && data.role)
            return [data.role];
        // Legacy orgRoles map
        if (data.orgRoles?.[orgId])
            return data.orgRoles[orgId];
    }
    // Fall back to orgRoles collection
    const snap = await db
        .collection(constants_1.COLLECTION.ORG_ROLES)
        .where("uid", "==", uid)
        .where("orgId", "==", orgId)
        .limit(1)
        .get();
    if (snap.empty)
        return [];
    const data = snap.docs[0].data();
    return Array.isArray(data.roles) ? data.roles : [];
}
/**
 * Requires that the user has at least one of the given roles in the org.
 */
async function requireRole(uid, orgId, roles) {
    const userRoles = await getUserOrgRoles(uid, orgId);
    const hasRole = roles.some((r) => userRoles.includes(r));
    if (!hasRole) {
        throw new https_1.HttpsError("permission-denied", `Requires one of the following roles: ${roles.join(", ")}`);
    }
}
// ─── Request ID Counter ───────────────────────────────────────────────────────
/**
 * Atomically increments the request counter for an org+year and returns
 * the next formatted request ID: REQ-YYYY-###
 */
async function getNextRequestId(orgId, year) {
    const db = admin.firestore();
    const counterId = `${orgId}_${year}`;
    const counterRef = db.collection(constants_1.COLLECTION.COUNTERS).doc(counterId);
    let newCount = 1;
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        const current = snap.exists ? (snap.data()?.count ?? 0) : 0;
        newCount = current + 1;
        tx.set(counterRef, {
            orgId,
            year,
            count: newCount,
        }, { merge: true });
    });
    const paddedCount = String(newCount).padStart(3, "0");
    return `REQ-${year}-${paddedCount}`;
}
// ─── Token Utilities ──────────────────────────────────────────────────────────
/**
 * Generates a UUID v4 token string.
 */
function generateToken() {
    return uuidv4();
}
/**
 * Returns a Date N hours from now.
 */
function tokenExpiryDate(hours) {
    const d = new Date();
    d.setTime(d.getTime() + hours * 60 * 60 * 1000);
    return d;
}
// ─── Formatting ───────────────────────────────────────────────────────────────
/**
 * Formats a number as a USD currency string: "$1,234.56"
 */
function formatCurrency(amount) {
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
async function getUserProfile(uid) {
    const db = admin.firestore();
    const snap = await db.collection(constants_1.COLLECTION.USERS).doc(uid).get();
    if (!snap.exists)
        return null;
    return { id: snap.id, ...snap.data() };
}
/**
 * Returns all org roles for a given user (across all orgs).
 */
async function getAllUserOrgRoles(uid) {
    const db = admin.firestore();
    const snap = await db
        .collection(constants_1.COLLECTION.ORG_ROLES)
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
async function getUsersByRole(orgId, role) {
    const db = admin.firestore();
    // Query orgRoles for users with this org who have the role in their array
    const snap = await db
        .collection(constants_1.COLLECTION.ORG_ROLES)
        .where("orgId", "==", orgId)
        .get();
    const matchingUids = [];
    for (const doc of snap.docs) {
        const data = doc.data();
        if (Array.isArray(data.roles) && data.roles.includes(role)) {
            matchingUids.push(data.uid);
        }
    }
    if (matchingUids.length === 0)
        return [];
    // Fetch user profiles to get emails
    const results = [];
    for (const uid of matchingUids) {
        try {
            const userRecord = await admin.auth().getUser(uid);
            results.push({ uid, email: userRecord.email ?? "" });
        }
        catch {
            // skip users that can't be fetched
        }
    }
    return results;
}
/**
 * Validates that the orgId is one of the known valid orgs.
 */
function validateOrgId(orgId) {
    const { VALID_ORG_IDS } = require("./constants");
    if (!VALID_ORG_IDS.includes(orgId)) {
        throw new https_1.HttpsError("invalid-argument", `Invalid orgId: ${orgId}`);
    }
}
/**
 * Returns current server timestamp.
 */
function nowTimestamp() {
    return firestore_1.Timestamp.now();
}
/**
 * Returns the tenant ID constant.
 */
function getTenantId() {
    return constants_1.TENANT_ID;
}
