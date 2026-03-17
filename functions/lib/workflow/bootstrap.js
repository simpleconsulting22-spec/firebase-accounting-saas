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
exports.getProfileGate = exports.saveUserProfile = exports.getMyProfile = exports.getBootstrap = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const constants_1 = require("./constants");
const helpers_1 = require("./helpers");
// ─── getBootstrap ─────────────────────────────────────────────────────────────
/**
 * Returns org config, categories, payment methods, user profile, and user's orgs/roles.
 * Called on app load to hydrate the frontend.
 */
exports.getBootstrap = (0, https_1.onCall)(async (request) => {
    const uid = (0, helpers_1.verifyAuth)(request);
    const db = admin.firestore();
    // Fetch user profile and org roles in parallel
    const [profile, orgRoles] = await Promise.all([
        (0, helpers_1.getUserProfile)(uid),
        (0, helpers_1.getAllUserOrgRoles)(uid),
    ]);
    // Build per-org config visible to this user
    const userOrgIds = orgRoles.map((r) => r.orgId);
    const orgsConfig = userOrgIds.reduce((acc, orgId) => {
        if (constants_1.ORG_CONFIG[orgId]) {
            acc[orgId] = {
                name: constants_1.ORG_CONFIG[orgId].name,
                escalationBufferAmount: constants_1.ORG_CONFIG[orgId].escalationBufferAmount,
            };
        }
        return acc;
    }, {});
    // Fetch vendors count per org (lightweight)
    const vendorCounts = {};
    for (const orgId of userOrgIds) {
        const snap = await db
            .collection(constants_1.COLLECTION.VENDORS)
            .where("orgId", "==", orgId)
            .where("status", "==", "active")
            .get();
        vendorCounts[orgId] = snap.size;
    }
    return {
        tenantId: constants_1.TENANT_ID,
        categories: constants_1.CATEGORIES,
        paymentMethods: constants_1.PAYMENT_METHODS,
        orgsConfig,
        userOrgRoles: orgRoles,
        profile: profile ?? null,
        profileComplete: !!(profile?.displayName),
    };
});
// ─── getMyProfile ─────────────────────────────────────────────────────────────
/**
 * Returns the current user's Firestore profile document.
 */
exports.getMyProfile = (0, https_1.onCall)(async (request) => {
    const uid = (0, helpers_1.verifyAuth)(request);
    const profile = await (0, helpers_1.getUserProfile)(uid);
    return { profile: profile ?? null };
});
// ─── saveUserProfile ──────────────────────────────────────────────────────────
/**
 * Upserts the current user's profile (displayName, phone, etc.).
 */
exports.saveUserProfile = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = (0, helpers_1.verifyAuth)(request);
    const db = admin.firestore();
    if (!data.displayName || data.displayName.trim().length === 0) {
        throw new https_1.HttpsError("invalid-argument", "displayName is required.");
    }
    const userRecord = await admin.auth().getUser(uid);
    const email = userRecord.email ?? "";
    const ref = db.collection(constants_1.COLLECTION.USERS).doc(uid);
    const snap = await ref.get();
    if (snap.exists) {
        await ref.update({
            displayName: data.displayName.trim(),
            phone: data.phone ?? "",
            updatedAt: (0, helpers_1.nowTimestamp)(),
        });
    }
    else {
        await ref.set({
            uid,
            email,
            displayName: data.displayName.trim(),
            phone: data.phone ?? "",
            orgIds: [],
            createdAt: (0, helpers_1.nowTimestamp)(),
            updatedAt: (0, helpers_1.nowTimestamp)(),
        });
    }
    const updated = await (0, helpers_1.getUserProfile)(uid);
    return { profile: updated };
});
// ─── getProfileGate ───────────────────────────────────────────────────────────
/**
 * Checks if the user's profile is complete (has a displayName set).
 * Used to gate access to the main app until profile is filled out.
 */
exports.getProfileGate = (0, https_1.onCall)(async (request) => {
    const uid = (0, helpers_1.verifyAuth)(request);
    const profile = await (0, helpers_1.getUserProfile)(uid);
    const isComplete = !!(profile?.displayName?.trim());
    return {
        profileComplete: isComplete,
        missingFields: isComplete ? [] : ["displayName"],
    };
});
