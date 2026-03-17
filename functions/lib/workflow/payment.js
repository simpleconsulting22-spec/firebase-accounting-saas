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
exports.confirmQBEntry = exports.sendToQuickBooks = exports.markAsPaid = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const constants_1 = require("./constants");
const helpers_1 = require("./helpers");
const email_1 = require("./email");
// ─── markAsPaid ───────────────────────────────────────────────────────────────
/**
 * Requires FINANCE_PAYOR role.
 * Transitions FINAL_APPROVED → PAID, step=6.
 * Sends payment confirmation email to requestor.
 */
exports.markAsPaid = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.FINANCE_PAYOR, constants_1.ROLE.ADMIN]);
    if (!data.paymentReference?.trim()) {
        throw new https_1.HttpsError("invalid-argument", "paymentReference is required.");
    }
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
    if (requestDoc.status !== constants_1.STATUS.FINAL_APPROVED) {
        throw new https_1.HttpsError("failed-precondition", `Request must be in FINAL_APPROVED status to mark as paid (current: ${requestDoc.status})`);
    }
    const nowTs = (0, helpers_1.nowTimestamp)();
    const paidAtTs = data.paidAt
        ? admin.firestore.Timestamp.fromDate(new Date(data.paidAt))
        : nowTs;
    await ref.update({
        status: constants_1.STATUS.PAID,
        step: constants_1.STEP.PAID,
        paidAt: paidAtTs,
        paidBy: uid,
        paymentReference: data.paymentReference.trim(),
        updatedAt: nowTs,
    });
    const updatedRequest = {
        ...requestDoc,
        status: constants_1.STATUS.PAID,
        step: constants_1.STEP.PAID,
        paidAt: paidAtTs,
        paidBy: uid,
        paymentReference: data.paymentReference.trim(),
    };
    await (0, email_1.sendPaymentConfirmationEmail)(updatedRequest);
    return { success: true, status: constants_1.STATUS.PAID };
});
// ─── sendToQuickBooks ─────────────────────────────────────────────────────────
/**
 * Requires FINANCE_QB_ENTRY or ADMIN role.
 * Transitions PAID → QB_SENT, step=7.
 * Sends QB sent email to QB assist emails.
 */
exports.sendToQuickBooks = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.FINANCE_QB_ENTRY, constants_1.ROLE.ADMIN]);
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
    if (requestDoc.status !== constants_1.STATUS.PAID) {
        throw new https_1.HttpsError("failed-precondition", `Request must be in PAID status to send to QuickBooks (current: ${requestDoc.status})`);
    }
    const nowTs = (0, helpers_1.nowTimestamp)();
    await ref.update({
        status: constants_1.STATUS.QB_SENT,
        step: constants_1.STEP.QB_SENT,
        qbSentAt: nowTs,
        qbSentBy: uid,
        updatedAt: nowTs,
    });
    const updatedRequest = {
        ...requestDoc,
        status: constants_1.STATUS.QB_SENT,
        step: constants_1.STEP.QB_SENT,
        qbSentAt: nowTs,
        qbSentBy: uid,
    };
    await (0, email_1.sendQBSentEmail)(updatedRequest);
    return { success: true, status: constants_1.STATUS.QB_SENT };
});
// ─── confirmQBEntry ───────────────────────────────────────────────────────────
/**
 * Requires FINANCE_QB_ENTRY or ADMIN role.
 * Transitions QB_SENT → QB_ENTERED, step=8.
 */
exports.confirmQBEntry = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.FINANCE_QB_ENTRY, constants_1.ROLE.ADMIN]);
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
    if (requestDoc.status !== constants_1.STATUS.QB_SENT) {
        throw new https_1.HttpsError("failed-precondition", `Request must be in QB_SENT status to confirm entry (current: ${requestDoc.status})`);
    }
    const nowTs = (0, helpers_1.nowTimestamp)();
    await ref.update({
        status: constants_1.STATUS.QB_ENTERED,
        step: constants_1.STEP.QB_ENTERED,
        qbEnteredAt: nowTs,
        qbEnteredBy: uid,
        qbEnteredNotes: data.notes ?? "",
        updatedAt: nowTs,
    });
    return { success: true, status: constants_1.STATUS.QB_ENTERED };
});
