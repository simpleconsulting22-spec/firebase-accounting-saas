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
exports.adminApproveReceiptsReview = exports.applyOverageApproval = exports.sendBackForEdits = exports.rejectReceiptsReview = exports.approveReceiptsReview = exports.submitApproverDecision = exports.validateTokenAndGetRequest = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const constants_1 = require("./constants");
const helpers_1 = require("./helpers");
const email_1 = require("./email");
// ─── validateTokenAndGetRequest ───────────────────────────────────────────────
/**
 * PUBLIC — no auth required.
 * Looks up a token, validates it is not used/expired, and returns
 * the associated request data plus token type.
 */
exports.validateTokenAndGetRequest = (0, https_1.onCall)(async (request) => {
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
    // Fetch associated request
    const requestSnap = await db
        .collection(constants_1.COLLECTION.REQUESTS)
        .doc(tokenDoc.requestId)
        .get();
    if (!requestSnap.exists) {
        throw new https_1.HttpsError("not-found", "Associated request not found.");
    }
    const requestDoc = { id: requestSnap.id, ...requestSnap.data() };
    return {
        token: {
            id: tokenDoc.id,
            type: tokenDoc.type,
            expiresAt: tokenDoc.expiresAt,
            used: tokenDoc.used,
        },
        request: requestDoc,
    };
});
// ─── submitApproverDecision ───────────────────────────────────────────────────
/**
 * Pre-approval step decision.
 * decision="approve": PREAPPROVED, step=3, set approvedAmount, send approved email
 * decision="reject": REJECTED, send rejected email
 * decision="needs_edits": NEEDS_EDITS_STEP1, send needs edits email
 * Marks token as used.
 */
exports.submitApproverDecision = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    if (!data.token || !data.decision) {
        throw new https_1.HttpsError("invalid-argument", "token and decision are required.");
    }
    const validDecisions = ["approve", "reject", "needs_edits"];
    if (!validDecisions.includes(data.decision)) {
        throw new https_1.HttpsError("invalid-argument", `decision must be one of: ${validDecisions.join(", ")}`);
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
    if (tokenDoc.type !== constants_1.TOKEN_TYPE.PRE_APPROVAL) {
        throw new https_1.HttpsError("invalid-argument", "This token is not a pre-approval token.");
    }
    const requestRef = db
        .collection(constants_1.COLLECTION.REQUESTS)
        .doc(tokenDoc.requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
        throw new https_1.HttpsError("not-found", "Request not found.");
    }
    const requestDoc = { id: requestSnap.id, ...requestSnap.data() };
    if (requestDoc.status !== constants_1.STATUS.SUBMITTED_PREAPPROVAL) {
        throw new https_1.HttpsError("failed-precondition", `Request is not in SUBMITTED_PREAPPROVAL status (current: ${requestDoc.status})`);
    }
    const nowTs = (0, helpers_1.nowTimestamp)();
    let newStatus;
    let updates = {
        preApprovalDecidedAt: nowTs,
        preApprovalDecidedBy: requestDoc.approverId,
        preApprovalNotes: data.notes ?? "",
        updatedAt: nowTs,
    };
    if (data.decision === "approve") {
        if (!data.approvedAmount || data.approvedAmount <= 0) {
            // Default to estimated amount if not provided
            updates["approvedAmount"] = requestDoc.estimatedAmount;
        }
        else {
            updates["approvedAmount"] = data.approvedAmount;
        }
        newStatus = constants_1.STATUS.PREAPPROVED;
        updates["status"] = newStatus;
        updates["step"] = constants_1.STEP.EXPENSE_REPORT;
        updates["preApprovedAt"] = nowTs;
        updates["preApprovedBy"] = requestDoc.approverEmail;
    }
    else if (data.decision === "reject") {
        newStatus = constants_1.STATUS.REJECTED;
        updates["status"] = newStatus;
        updates["rejectedAt"] = nowTs;
        updates["rejectedBy"] = requestDoc.approverId;
        updates["rejectionReason"] = data.notes ?? "";
    }
    else {
        // needs_edits
        newStatus = constants_1.STATUS.NEEDS_EDITS_STEP1;
        updates["status"] = newStatus;
        updates["step"] = constants_1.STEP.DRAFT_SUBMIT;
    }
    // Mark token used and update request in a batch
    const batch = db.batch();
    batch.update(tokenRef, { used: true });
    batch.update(requestRef, updates);
    await batch.commit();
    const updatedRequest = {
        ...requestDoc,
        ...updates,
        preApprovalNotes: data.notes ?? "",
        approvedAmount: data.decision === "approve"
            ? updates["approvedAmount"]
            : requestDoc.approvedAmount,
    };
    try {
        if (data.decision === "approve") {
            await (0, email_1.sendApprovedEmail)(updatedRequest);
            console.log("Approval notification sent to", requestDoc.requestorEmail);
        }
        else if (data.decision === "reject") {
            const rejectedRequest = {
                ...updatedRequest,
                rejectionReason: data.notes ?? "",
            };
            await (0, email_1.sendRejectedEmail)(rejectedRequest);
            console.log("Rejection notification sent to", requestDoc.requestorEmail);
        }
        else {
            await (0, email_1.sendNeedsEditsEmail)(updatedRequest);
            console.log("Needs-edits notification sent to", requestDoc.requestorEmail);
        }
    }
    catch (emailErr) {
        console.error("Failed to send decision notification email", emailErr);
    }
    return { success: true, status: newStatus };
});
// ─── approveReceiptsReview ────────────────────────────────────────────────────
/**
 * Receipts reviewer approves via token: status → FINAL_APPROVED, step=5.
 */
exports.approveReceiptsReview = (0, https_1.onCall)(async (request) => {
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
    if (tokenDoc.type !== constants_1.TOKEN_TYPE.RECEIPTS_REVIEW) {
        throw new https_1.HttpsError("invalid-argument", "This token is not a receipts review token.");
    }
    const requestRef = db
        .collection(constants_1.COLLECTION.REQUESTS)
        .doc(tokenDoc.requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
        throw new https_1.HttpsError("not-found", "Request not found.");
    }
    const requestDoc = { id: requestSnap.id, ...requestSnap.data() };
    if (requestDoc.status !== constants_1.STATUS.SUBMITTED_RECEIPT_REVIEW) {
        throw new https_1.HttpsError("failed-precondition", `Request is not in SUBMITTED_RECEIPT_REVIEW status (current: ${requestDoc.status})`);
    }
    const nowTs = (0, helpers_1.nowTimestamp)();
    const batch = db.batch();
    batch.update(tokenRef, { used: true });
    batch.update(requestRef, {
        status: constants_1.STATUS.FINAL_APPROVED,
        step: constants_1.STEP.FINAL_APPROVED,
        finalApprovedAt: nowTs,
        finalApprovedBy: "receipts_reviewer",
        receiptsReviewDecidedAt: nowTs,
        receiptsReviewDecidedBy: "receipts_reviewer",
        receiptsReviewNotes: data.notes ?? "",
        updatedAt: nowTs,
    });
    await batch.commit();
    const updatedRequest = {
        ...requestDoc,
        status: constants_1.STATUS.FINAL_APPROVED,
        step: constants_1.STEP.FINAL_APPROVED,
        receiptsReviewNotes: data.notes ?? "",
    };
    await (0, email_1.sendFinalApprovedEmail)(updatedRequest);
    return { success: true, status: constants_1.STATUS.FINAL_APPROVED };
});
// ─── rejectReceiptsReview ─────────────────────────────────────────────────────
/**
 * Receipts reviewer rejects via token: status → REJECTED.
 */
exports.rejectReceiptsReview = (0, https_1.onCall)(async (request) => {
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
    if (tokenDoc.type !== constants_1.TOKEN_TYPE.RECEIPTS_REVIEW) {
        throw new https_1.HttpsError("invalid-argument", "This token is not a receipts review token.");
    }
    const requestRef = db
        .collection(constants_1.COLLECTION.REQUESTS)
        .doc(tokenDoc.requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
        throw new https_1.HttpsError("not-found", "Request not found.");
    }
    const requestDoc = { id: requestSnap.id, ...requestSnap.data() };
    if (requestDoc.status !== constants_1.STATUS.SUBMITTED_RECEIPT_REVIEW) {
        throw new https_1.HttpsError("failed-precondition", `Request is not in SUBMITTED_RECEIPT_REVIEW status (current: ${requestDoc.status})`);
    }
    const nowTs = (0, helpers_1.nowTimestamp)();
    const batch = db.batch();
    batch.update(tokenRef, { used: true });
    batch.update(requestRef, {
        status: constants_1.STATUS.REJECTED,
        rejectedAt: nowTs,
        rejectedBy: "receipts_reviewer",
        rejectionReason: data.reason ?? "",
        receiptsReviewDecidedAt: nowTs,
        receiptsReviewDecidedBy: "receipts_reviewer",
        receiptsReviewNotes: data.reason ?? "",
        updatedAt: nowTs,
    });
    await batch.commit();
    const updatedRequest = {
        ...requestDoc,
        status: constants_1.STATUS.REJECTED,
        rejectionReason: data.reason ?? "",
    };
    await (0, email_1.sendRejectedEmail)(updatedRequest);
    return { success: true, status: constants_1.STATUS.REJECTED };
});
// ─── sendBackForEdits ─────────────────────────────────────────────────────────
/**
 * Receipts reviewer sends back for edits via token: status → NEEDS_EDITS_STEP3.
 */
exports.sendBackForEdits = (0, https_1.onCall)(async (request) => {
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
    if (tokenDoc.type !== constants_1.TOKEN_TYPE.RECEIPTS_REVIEW) {
        throw new https_1.HttpsError("invalid-argument", "This token is not a receipts review token.");
    }
    const requestRef = db
        .collection(constants_1.COLLECTION.REQUESTS)
        .doc(tokenDoc.requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
        throw new https_1.HttpsError("not-found", "Request not found.");
    }
    const requestDoc = { id: requestSnap.id, ...requestSnap.data() };
    if (requestDoc.status !== constants_1.STATUS.SUBMITTED_RECEIPT_REVIEW) {
        throw new https_1.HttpsError("failed-precondition", `Request is not in SUBMITTED_RECEIPT_REVIEW status (current: ${requestDoc.status})`);
    }
    const nowTs = (0, helpers_1.nowTimestamp)();
    const batch = db.batch();
    batch.update(tokenRef, { used: true });
    batch.update(requestRef, {
        status: constants_1.STATUS.NEEDS_EDITS_STEP3,
        step: constants_1.STEP.EXPENSE_REPORT,
        receiptsReviewNotes: data.notes ?? "",
        updatedAt: nowTs,
    });
    await batch.commit();
    // Reuse sendNeedsEditsEmail but for step 3 context
    const updatedRequest = {
        ...requestDoc,
        status: constants_1.STATUS.NEEDS_EDITS_STEP3,
        preApprovalNotes: data.notes ?? "",
    };
    // Send an email to requestor about step 3 edits needed
    await (0, email_1.sendNeedsEditsEmail)(updatedRequest);
    return { success: true, status: constants_1.STATUS.NEEDS_EDITS_STEP3 };
});
// ─── applyOverageApproval ─────────────────────────────────────────────────────
/**
 * Admin/finance overrides the approved amount to resolve EXCEEDS_APPROVED_AMOUNT.
 * Generates a new receipts review token and moves to SUBMITTED_RECEIPT_REVIEW.
 */
exports.applyOverageApproval = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN, constants_1.ROLE.FINANCE_RECEIPTS_REVIEWER]);
    const db = admin.firestore();
    const ref = db.collection(constants_1.COLLECTION.REQUESTS).doc(data.requestId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "Request not found.");
    }
    const requestDoc = { id: snap.id, ...snap.data() };
    if (requestDoc.orgId !== data.orgId) {
        throw new https_1.HttpsError("permission-denied", "You do not have access to this request.");
    }
    if (requestDoc.status !== constants_1.STATUS.EXCEEDS_APPROVED_AMOUNT) {
        throw new https_1.HttpsError("failed-precondition", `Request is not in EXCEEDS_APPROVED_AMOUNT status (current: ${requestDoc.status})`);
    }
    if (!data.newApprovedAmount || data.newApprovedAmount <= 0) {
        throw new https_1.HttpsError("invalid-argument", "newApprovedAmount must be a positive number.");
    }
    const now = (0, helpers_1.nowTimestamp)();
    // Generate new receipts review token
    const tokenValue = (0, helpers_1.generateToken)();
    const tokenExpiry = (0, helpers_1.tokenExpiryDate)(14 * 24);
    await db.collection(constants_1.COLLECTION.TOKENS).doc(tokenValue).set({
        requestId: data.requestId,
        orgId: data.orgId,
        tenantId: constants_1.TENANT_ID,
        type: constants_1.TOKEN_TYPE.RECEIPTS_REVIEW,
        used: false,
        expiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
        createdAt: now,
    });
    await ref.update({
        status: constants_1.STATUS.SUBMITTED_RECEIPT_REVIEW,
        step: constants_1.STEP.RECEIPTS_REVIEW,
        approvedAmount: data.newApprovedAmount,
        receiptsReviewToken: tokenValue,
        receiptsReviewTokenExpiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
        updatedAt: now,
    });
    const updatedRequest = {
        ...requestDoc,
        status: constants_1.STATUS.SUBMITTED_RECEIPT_REVIEW,
        step: constants_1.STEP.RECEIPTS_REVIEW,
        approvedAmount: data.newApprovedAmount,
        receiptsReviewToken: tokenValue,
    };
    await (0, email_1.sendReceiptsReviewEmail)(updatedRequest, tokenValue);
    return {
        success: true,
        status: constants_1.STATUS.SUBMITTED_RECEIPT_REVIEW,
        newApprovedAmount: data.newApprovedAmount,
    };
});
// ─── adminApproveReceiptsReview ───────────────────────────────────────────────
/**
 * Admin bypasses the token-based receipts approval flow and directly approves.
 * status → FINAL_APPROVED, step=5.
 */
exports.adminApproveReceiptsReview = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [
        constants_1.ROLE.ADMIN,
        constants_1.ROLE.FINANCE_RECEIPTS_REVIEWER,
    ]);
    const db = admin.firestore();
    const ref = db.collection(constants_1.COLLECTION.REQUESTS).doc(data.requestId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "Request not found.");
    }
    const requestDoc = { id: snap.id, ...snap.data() };
    if (requestDoc.orgId !== data.orgId) {
        throw new https_1.HttpsError("permission-denied", "You do not have access to this request.");
    }
    const reviewableStatuses = [
        constants_1.STATUS.SUBMITTED_RECEIPT_REVIEW,
        constants_1.STATUS.EXCEEDS_APPROVED_AMOUNT,
    ];
    if (!reviewableStatuses.includes(requestDoc.status)) {
        throw new https_1.HttpsError("failed-precondition", `Cannot approve receipts review with status: ${requestDoc.status}`);
    }
    const nowTs = (0, helpers_1.nowTimestamp)();
    await ref.update({
        status: constants_1.STATUS.FINAL_APPROVED,
        step: constants_1.STEP.FINAL_APPROVED,
        finalApprovedAt: nowTs,
        finalApprovedBy: uid,
        receiptsReviewDecidedAt: nowTs,
        receiptsReviewDecidedBy: uid,
        receiptsReviewNotes: data.notes ?? "",
        updatedAt: nowTs,
    });
    const updatedRequest = {
        ...requestDoc,
        status: constants_1.STATUS.FINAL_APPROVED,
        step: constants_1.STEP.FINAL_APPROVED,
        receiptsReviewNotes: data.notes ?? "",
    };
    await (0, email_1.sendFinalApprovedEmail)(updatedRequest);
    return { success: true, status: constants_1.STATUS.FINAL_APPROVED };
});
