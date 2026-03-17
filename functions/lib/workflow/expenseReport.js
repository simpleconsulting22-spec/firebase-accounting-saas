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
exports.deleteReceiptFile = exports.registerFile = exports.submitExpenseReport = exports.saveExpenseReport = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const constants_1 = require("./constants");
const helpers_1 = require("./helpers");
const email_1 = require("./email");
// ─── saveExpenseReport ────────────────────────────────────────────────────────
/**
 * Saves line items to the lineItems collection and updates the request's
 * actualAmount to the sum of all line items. Moves status to DRAFT_EXPENSE.
 */
exports.saveExpenseReport = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
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
    if (requestDoc.requestorId !== uid) {
        throw new https_1.HttpsError("permission-denied", "Only the original requestor can save the expense report.");
    }
    const editableStatuses = [
        constants_1.STATUS.PREAPPROVED,
        constants_1.STATUS.DRAFT_EXPENSE,
        constants_1.STATUS.NEEDS_EDITS_STEP3,
        constants_1.STATUS.EXCEEDS_APPROVED_AMOUNT,
    ];
    if (!editableStatuses.includes(requestDoc.status)) {
        throw new https_1.HttpsError("failed-precondition", `Cannot save expense report with status: ${requestDoc.status}`);
    }
    if (!Array.isArray(data.lineItems) || data.lineItems.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "At least one line item is required.");
    }
    const now = (0, helpers_1.nowTimestamp)();
    const batch = db.batch();
    // Delete existing line items for this request
    const existingSnap = await db
        .collection(constants_1.COLLECTION.LINE_ITEMS)
        .where("requestId", "==", data.requestId)
        .get();
    for (const doc of existingSnap.docs) {
        batch.delete(doc.ref);
    }
    // Calculate actual amount and add new line items
    let actualAmount = 0;
    for (const item of data.lineItems) {
        const lineItemRef = db.collection(constants_1.COLLECTION.LINE_ITEMS).doc();
        actualAmount += item.amount ?? 0;
        batch.set(lineItemRef, {
            requestId: data.requestId,
            orgId: data.orgId,
            tenantId: constants_1.TENANT_ID,
            description: item.description ?? "",
            amount: item.amount ?? 0,
            category: item.category ?? "",
            vendorName: item.vendorName ?? "",
            receiptDate: item.receiptDate ?? "",
            notes: item.notes ?? "",
            createdAt: now,
            updatedAt: now,
        });
    }
    // Update request
    const updateData = {
        actualAmount,
        status: constants_1.STATUS.DRAFT_EXPENSE,
        step: constants_1.STEP.EXPENSE_REPORT,
        updatedAt: now,
    };
    if (data.notes !== undefined) {
        updateData["receiptsReviewNotes"] = data.notes;
    }
    batch.update(ref, updateData);
    await batch.commit();
    return { success: true, actualAmount, lineItemCount: data.lineItems.length };
});
// ─── submitExpenseReport ──────────────────────────────────────────────────────
/**
 * Transitions DRAFT_EXPENSE → SUBMITTED_RECEIPT_REVIEW (or EXCEEDS_APPROVED_AMOUNT).
 * Creates receiptsReview token and sends email to FINANCE_RECEIPTS_REVIEWER users.
 */
exports.submitExpenseReport = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
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
    if (requestDoc.requestorId !== uid) {
        throw new https_1.HttpsError("permission-denied", "Only the original requestor can submit the expense report.");
    }
    if (requestDoc.status !== constants_1.STATUS.DRAFT_EXPENSE) {
        throw new https_1.HttpsError("failed-precondition", `Cannot submit expense report with status: ${requestDoc.status}`);
    }
    const now = (0, helpers_1.nowTimestamp)();
    const escalationBuffer = constants_1.ORG_CONFIG[data.orgId]?.escalationBufferAmount ?? 50;
    // Check for overage
    const isOverage = requestDoc.actualAmount > requestDoc.approvedAmount + escalationBuffer;
    if (isOverage) {
        await ref.update({
            status: constants_1.STATUS.EXCEEDS_APPROVED_AMOUNT,
            expenseReportSubmittedAt: now,
            updatedAt: now,
        });
        const overageRequest = {
            ...requestDoc,
            status: constants_1.STATUS.EXCEEDS_APPROVED_AMOUNT,
            expenseReportSubmittedAt: now,
        };
        await (0, email_1.sendOverageEmail)(overageRequest);
        return { success: true, status: constants_1.STATUS.EXCEEDS_APPROVED_AMOUNT };
    }
    // Generate receipts review token (14 days)
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
        receiptsReviewToken: tokenValue,
        receiptsReviewTokenExpiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
        expenseReportSubmittedAt: now,
        updatedAt: now,
    });
    const updatedRequest = {
        ...requestDoc,
        status: constants_1.STATUS.SUBMITTED_RECEIPT_REVIEW,
        step: constants_1.STEP.RECEIPTS_REVIEW,
        receiptsReviewToken: tokenValue,
        receiptsReviewTokenExpiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
    };
    await (0, email_1.sendReceiptsReviewEmail)(updatedRequest, tokenValue);
    return { success: true, status: constants_1.STATUS.SUBMITTED_RECEIPT_REVIEW };
});
// ─── registerFile ─────────────────────────────────────────────────────────────
/**
 * Saves file metadata to the files collection after client-side upload to Storage.
 */
exports.registerFile = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    const db = admin.firestore();
    if (!data.requestId || !data.fileName || !data.fileUrl) {
        throw new https_1.HttpsError("invalid-argument", "requestId, fileName, and fileUrl are required.");
    }
    // Verify request exists and belongs to this org
    const reqSnap = await db
        .collection(constants_1.COLLECTION.REQUESTS)
        .doc(data.requestId)
        .get();
    if (!reqSnap.exists) {
        throw new https_1.HttpsError("not-found", "Request not found.");
    }
    const req = reqSnap.data();
    if (req.orgId !== data.orgId) {
        throw new https_1.HttpsError("permission-denied", "You do not have access to this request.");
    }
    const now = (0, helpers_1.nowTimestamp)();
    const fileRef = db.collection(constants_1.COLLECTION.FILES).doc();
    const fileData = {
        requestId: data.requestId,
        orgId: data.orgId,
        tenantId: constants_1.TENANT_ID,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize ?? 0,
        mimeType: data.mimeType ?? "application/octet-stream",
        uploadedBy: uid,
        createdAt: now,
    };
    if (data.lineItemId) {
        fileData["lineItemId"] = data.lineItemId;
    }
    await fileRef.set(fileData);
    return { success: true, fileId: fileRef.id };
});
// ─── deleteReceiptFile ────────────────────────────────────────────────────────
/**
 * Deletes file metadata from the files collection.
 * Storage deletion is handled client-side.
 */
exports.deleteReceiptFile = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    const db = admin.firestore();
    const ref = db.collection(constants_1.COLLECTION.FILES).doc(data.fileId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "File not found.");
    }
    const file = snap.data();
    if (file.orgId !== data.orgId) {
        throw new https_1.HttpsError("permission-denied", "You do not have access to this file.");
    }
    if (file.uploadedBy !== uid) {
        throw new https_1.HttpsError("permission-denied", "Only the uploader can delete this file.");
    }
    await ref.delete();
    return { success: true };
});
