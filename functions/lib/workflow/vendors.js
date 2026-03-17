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
exports.getVendorIntakeByToken = exports.submitVendorIntake = exports.regenerateVendorIntakeLink = exports.rejectVendorSetup = exports.approveVendorSetup = exports.getVendorSetupById = exports.getVendorDashboards = exports.getPendingVendorSetupRequests = exports.submitVendorSetupRequest = exports.getActiveVendors = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const constants_1 = require("./constants");
const helpers_1 = require("./helpers");
const email_1 = require("./email");
// ─── getActiveVendors ─────────────────────────────────────────────────────────
/**
 * Returns all active vendors for an org.
 */
exports.getActiveVendors = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    const db = admin.firestore();
    const snap = await db
        .collection(constants_1.COLLECTION.VENDORS)
        .where("orgId", "==", data.orgId)
        .where("status", "==", "active")
        .orderBy("vendorName", "asc")
        .get();
    const vendors = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { vendors };
});
// ─── submitVendorSetupRequest ─────────────────────────────────────────────────
/**
 * Creates a vendor setup request, generates intake token, and sends intake email to vendor.
 */
exports.submitVendorSetupRequest = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    if (!data.vendorName?.trim()) {
        throw new https_1.HttpsError("invalid-argument", "vendorName is required.");
    }
    if (!data.vendorEmail?.trim()) {
        throw new https_1.HttpsError("invalid-argument", "vendorEmail is required.");
    }
    const userProfile = await (0, helpers_1.getUserProfile)(uid);
    if (!userProfile) {
        throw new https_1.HttpsError("failed-precondition", "User profile not found.");
    }
    const db = admin.firestore();
    const now = (0, helpers_1.nowTimestamp)();
    // Generate intake token (30 days)
    const tokenValue = (0, helpers_1.generateToken)();
    const tokenExpiry = (0, helpers_1.tokenExpiryDate)(30 * 24);
    // Create vendor setup request
    const setupRef = db.collection(constants_1.COLLECTION.VENDOR_SETUP_REQUESTS).doc();
    const setupData = {
        orgId: data.orgId,
        tenantId: constants_1.TENANT_ID,
        requestorId: uid,
        requestorEmail: userProfile.email,
        requestorName: userProfile.displayName,
        vendorName: data.vendorName.trim(),
        vendorEmail: data.vendorEmail.trim().toLowerCase(),
        contactName: data.contactName ?? "",
        notes: data.notes ?? "",
        status: "pending",
        intakeToken: tokenValue,
        intakeTokenExpiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
        createdAt: now,
        updatedAt: now,
    };
    await setupRef.set(setupData);
    // Create token doc
    await db.collection(constants_1.COLLECTION.TOKENS).doc(tokenValue).set({
        requestId: setupRef.id,
        orgId: data.orgId,
        tenantId: constants_1.TENANT_ID,
        type: constants_1.TOKEN_TYPE.VENDOR_INTAKE,
        used: false,
        expiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
        createdAt: now,
    });
    const intakeUrl = `${constants_1.BASE_URL}/vendor-intake?token=${tokenValue}`;
    const vendorSetupRequest = {
        id: setupRef.id,
        ...setupData,
    };
    await (0, email_1.sendVendorIntakeEmail)(vendorSetupRequest, tokenValue, intakeUrl);
    return {
        success: true,
        vendorSetupRequestId: setupRef.id,
        intakeUrl,
    };
});
// ─── getPendingVendorSetupRequests ────────────────────────────────────────────
/**
 * Requires ADMIN or FINANCE role.
 * Returns all pending vendor setup requests for the org.
 */
exports.getPendingVendorSetupRequests = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [
        constants_1.ROLE.ADMIN,
        constants_1.ROLE.FINANCE_PAYOR,
        constants_1.ROLE.FINANCE_RECEIPTS_REVIEWER,
        constants_1.ROLE.FINANCE_QB_ENTRY,
    ]);
    const db = admin.firestore();
    const snap = await db
        .collection(constants_1.COLLECTION.VENDOR_SETUP_REQUESTS)
        .where("orgId", "==", data.orgId)
        .where("status", "==", "pending")
        .orderBy("createdAt", "desc")
        .get();
    const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { requests };
});
// ─── getVendorDashboards ──────────────────────────────────────────────────────
/**
 * Returns vendor setup requests for the current user, split by status.
 */
exports.getVendorDashboards = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    const db = admin.firestore();
    const snap = await db
        .collection(constants_1.COLLECTION.VENDOR_SETUP_REQUESTS)
        .where("orgId", "==", data.orgId)
        .where("requestorId", "==", uid)
        .orderBy("createdAt", "desc")
        .get();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const pending = all.filter((r) => r.status === "pending");
    const approved = all.filter((r) => r.status === "approved");
    const rejected = all.filter((r) => r.status === "rejected");
    return { pending, approved, rejected };
});
// ─── getVendorSetupById ───────────────────────────────────────────────────────
/**
 * Returns a vendor setup request plus associated intake data.
 */
exports.getVendorSetupById = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    const db = admin.firestore();
    const setupSnap = await db
        .collection(constants_1.COLLECTION.VENDOR_SETUP_REQUESTS)
        .doc(data.vendorSetupRequestId)
        .get();
    if (!setupSnap.exists) {
        throw new https_1.HttpsError("not-found", "Vendor setup request not found.");
    }
    const setupRequest = {
        id: setupSnap.id,
        ...setupSnap.data(),
    };
    if (setupRequest.orgId !== data.orgId) {
        throw new https_1.HttpsError("permission-denied", "You do not have access to this vendor setup request.");
    }
    // Fetch intake data if it exists
    const intakeSnap = await db
        .collection(constants_1.COLLECTION.VENDOR_INTAKES)
        .where("vendorSetupRequestId", "==", data.vendorSetupRequestId)
        .limit(1)
        .get();
    const intake = intakeSnap.empty
        ? null
        : { id: intakeSnap.docs[0].id, ...intakeSnap.docs[0].data() };
    return { setupRequest, intake };
});
// ─── approveVendorSetup ───────────────────────────────────────────────────────
/**
 * Requires ADMIN role. Creates vendor doc, marks setup request approved,
 * and sends approval email to requestor.
 */
exports.approveVendorSetup = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    const setupRef = db
        .collection(constants_1.COLLECTION.VENDOR_SETUP_REQUESTS)
        .doc(data.vendorSetupRequestId);
    const setupSnap = await setupRef.get();
    if (!setupSnap.exists) {
        throw new https_1.HttpsError("not-found", "Vendor setup request not found.");
    }
    const setupRequest = {
        id: setupSnap.id,
        ...setupSnap.data(),
    };
    if (setupRequest.orgId !== data.orgId) {
        throw new https_1.HttpsError("permission-denied", "You do not have access to this vendor setup request.");
    }
    if (setupRequest.status !== "pending") {
        throw new https_1.HttpsError("failed-precondition", `Cannot approve a request with status: ${setupRequest.status}`);
    }
    const now = (0, helpers_1.nowTimestamp)();
    const batch = db.batch();
    // Create vendor doc
    const vendorRef = db.collection(constants_1.COLLECTION.VENDORS).doc();
    batch.set(vendorRef, {
        orgId: data.orgId,
        tenantId: constants_1.TENANT_ID,
        vendorName: setupRequest.vendorName,
        vendorEmail: setupRequest.vendorEmail,
        contactName: setupRequest.contactName,
        status: "active",
        vendorSetupRequestId: data.vendorSetupRequestId,
        createdAt: now,
        updatedAt: now,
    });
    // Update setup request
    batch.update(setupRef, {
        status: "approved",
        approvedAt: now,
        approvedBy: uid,
        updatedAt: now,
    });
    await batch.commit();
    await (0, email_1.sendVendorApprovedEmail)(setupRequest);
    return { success: true, vendorId: vendorRef.id };
});
// ─── rejectVendorSetup ────────────────────────────────────────────────────────
/**
 * Requires ADMIN role. Marks vendor setup rejected and sends rejection email.
 */
exports.rejectVendorSetup = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    const setupRef = db
        .collection(constants_1.COLLECTION.VENDOR_SETUP_REQUESTS)
        .doc(data.vendorSetupRequestId);
    const setupSnap = await setupRef.get();
    if (!setupSnap.exists) {
        throw new https_1.HttpsError("not-found", "Vendor setup request not found.");
    }
    const setupRequest = {
        id: setupSnap.id,
        ...setupSnap.data(),
    };
    if (setupRequest.orgId !== data.orgId) {
        throw new https_1.HttpsError("permission-denied", "You do not have access to this vendor setup request.");
    }
    if (setupRequest.status !== "pending") {
        throw new https_1.HttpsError("failed-precondition", `Cannot reject a request with status: ${setupRequest.status}`);
    }
    const now = (0, helpers_1.nowTimestamp)();
    await setupRef.update({
        status: "rejected",
        rejectedAt: now,
        rejectedBy: uid,
        rejectionReason: data.reason ?? "",
        updatedAt: now,
    });
    const rejectedSetupRequest = {
        ...setupRequest,
        status: "rejected",
        rejectionReason: data.reason ?? "",
    };
    await (0, email_1.sendVendorRejectedEmail)(rejectedSetupRequest);
    return { success: true };
});
// ─── regenerateVendorIntakeLink ───────────────────────────────────────────────
/**
 * Creates a new intake token for a vendor setup request and resends the intake email.
 */
exports.regenerateVendorIntakeLink = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    const setupRef = db
        .collection(constants_1.COLLECTION.VENDOR_SETUP_REQUESTS)
        .doc(data.vendorSetupRequestId);
    const setupSnap = await setupRef.get();
    if (!setupSnap.exists) {
        throw new https_1.HttpsError("not-found", "Vendor setup request not found.");
    }
    const setupRequest = {
        id: setupSnap.id,
        ...setupSnap.data(),
    };
    if (setupRequest.orgId !== data.orgId) {
        throw new https_1.HttpsError("permission-denied", "You do not have access to this vendor setup request.");
    }
    const now = (0, helpers_1.nowTimestamp)();
    const newTokenValue = (0, helpers_1.generateToken)();
    const tokenExpiry = (0, helpers_1.tokenExpiryDate)(30 * 24);
    // Create new token doc
    await db.collection(constants_1.COLLECTION.TOKENS).doc(newTokenValue).set({
        requestId: data.vendorSetupRequestId,
        orgId: data.orgId,
        tenantId: constants_1.TENANT_ID,
        type: constants_1.TOKEN_TYPE.VENDOR_INTAKE,
        used: false,
        expiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
        createdAt: now,
    });
    // Update setup request with new token
    await setupRef.update({
        intakeToken: newTokenValue,
        intakeTokenExpiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
        updatedAt: now,
    });
    const intakeUrl = `${constants_1.BASE_URL}/vendor-intake?token=${newTokenValue}`;
    const updatedSetupRequest = {
        ...setupRequest,
        intakeToken: newTokenValue,
    };
    await (0, email_1.sendVendorIntakeEmail)(updatedSetupRequest, newTokenValue, intakeUrl);
    return { success: true, intakeUrl };
});
// ─── submitVendorIntake ───────────────────────────────────────────────────────
/**
 * PUBLIC — no auth required.
 * Vendor submits their W9/intake info via the token link.
 */
exports.submitVendorIntake = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    if (!data.token) {
        throw new https_1.HttpsError("invalid-argument", "token is required.");
    }
    if (!data.intakeData) {
        throw new https_1.HttpsError("invalid-argument", "intakeData is required.");
    }
    const db = admin.firestore();
    const tokenRef = db.collection(constants_1.COLLECTION.TOKENS).doc(data.token);
    const tokenSnap = await tokenRef.get();
    if (!tokenSnap.exists) {
        throw new https_1.HttpsError("not-found", "Token not found.");
    }
    const tokenDoc = { id: tokenSnap.id, ...tokenSnap.data() };
    if (tokenDoc.used === true) {
        throw new https_1.HttpsError("failed-precondition", "This token has already been used.");
    }
    const now = admin.firestore.Timestamp.now();
    if (tokenDoc.expiresAt.toMillis() < now.toMillis()) {
        throw new https_1.HttpsError("deadline-exceeded", "This token has expired.");
    }
    if (tokenDoc.type !== constants_1.TOKEN_TYPE.VENDOR_INTAKE) {
        throw new https_1.HttpsError("invalid-argument", "This token is not a vendor intake token.");
    }
    const vendorSetupRequestId = tokenDoc.requestId;
    // Validate required intake fields
    const required = [
        "legalName",
        "taxId",
        "contactEmail",
        "contactName",
    ];
    for (const field of required) {
        if (!data.intakeData[field]) {
            throw new https_1.HttpsError("invalid-argument", `${field} is required.`);
        }
    }
    const nowTs = admin.firestore.Timestamp.now();
    // Save vendor intake doc
    const intakeRef = db.collection(constants_1.COLLECTION.VENDOR_INTAKES).doc();
    await intakeRef.set({
        vendorSetupRequestId,
        orgId: tokenDoc.orgId,
        tenantId: constants_1.TENANT_ID,
        legalName: data.intakeData.legalName ?? "",
        dbaName: data.intakeData.dbaName ?? "",
        address: data.intakeData.address ?? "",
        taxId: data.intakeData.taxId ?? "",
        taxClassification: data.intakeData.taxClassification ?? "",
        is1099: data.intakeData.is1099 ?? false,
        bankName: data.intakeData.bankName ?? "",
        accountType: data.intakeData.accountType ?? "",
        routingNumber: data.intakeData.routingNumber ?? "",
        accountNumber: data.intakeData.accountNumber ?? "",
        contactName: data.intakeData.contactName ?? "",
        contactEmail: data.intakeData.contactEmail ?? "",
        contactPhone: data.intakeData.contactPhone ?? "",
        signatureDate: data.intakeData.signatureDate ?? "",
        submittedAt: nowTs,
    });
    // Mark token as used
    await tokenRef.update({ used: true });
    return { success: true, intakeId: intakeRef.id };
});
// ─── getVendorIntakeByToken ───────────────────────────────────────────────────
/**
 * PUBLIC — no auth required.
 * Returns vendor setup request info needed to render the intake form.
 */
exports.getVendorIntakeByToken = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    if (!data.token) {
        throw new https_1.HttpsError("invalid-argument", "token is required.");
    }
    const db = admin.firestore();
    const tokenRef = db.collection(constants_1.COLLECTION.TOKENS).doc(data.token);
    const tokenSnap = await tokenRef.get();
    if (!tokenSnap.exists) {
        throw new https_1.HttpsError("not-found", "Token not found.");
    }
    const tokenDoc = { id: tokenSnap.id, ...tokenSnap.data() };
    if (tokenDoc.used === true) {
        throw new https_1.HttpsError("failed-precondition", "This token has already been used.");
    }
    const now = admin.firestore.Timestamp.now();
    if (tokenDoc.expiresAt.toMillis() < now.toMillis()) {
        throw new https_1.HttpsError("deadline-exceeded", "This token has expired.");
    }
    if (tokenDoc.type !== constants_1.TOKEN_TYPE.VENDOR_INTAKE) {
        throw new https_1.HttpsError("invalid-argument", "This token is not a vendor intake token.");
    }
    const setupSnap = await db
        .collection(constants_1.COLLECTION.VENDOR_SETUP_REQUESTS)
        .doc(tokenDoc.requestId)
        .get();
    if (!setupSnap.exists) {
        throw new https_1.HttpsError("not-found", "Vendor setup request not found.");
    }
    const setupRequest = { id: setupSnap.id, ...setupSnap.data() };
    // Return only the info needed for the form (not sensitive admin data)
    return {
        vendorSetupRequestId: setupRequest.id,
        orgId: setupRequest.orgId,
        vendorName: setupRequest.vendorName,
        vendorEmail: setupRequest.vendorEmail,
        contactName: setupRequest.contactName,
        orgName: require("./constants").ORG_CONFIG[setupRequest.orgId]?.name ?? setupRequest.orgId,
        tokenExpiresAt: tokenDoc.expiresAt,
    };
});
