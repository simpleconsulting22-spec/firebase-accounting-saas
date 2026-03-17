import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import {
  COLLECTION,
  ORG_CONFIG,
  STATUS,
  STEP,
  TENANT_ID,
  TOKEN_TYPE,
} from "./constants";
import {
  generateToken,
  nowTimestamp,
  tokenExpiryDate,
  verifyAuth,
  verifyOrgAccess,
} from "./helpers";
import { sendOverageEmail, sendReceiptsReviewEmail } from "./email";
import { LineItemInput, Request } from "./types";

// ─── saveExpenseReport ────────────────────────────────────────────────────────

/**
 * Saves line items to the lineItems collection and updates the request's
 * actualAmount to the sum of all line items. Moves status to DRAFT_EXPENSE.
 */
export const saveExpenseReport = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      requestId: string;
      orgId: string;
      lineItems: LineItemInput[];
      notes?: string;
    };
    const uid = await verifyOrgAccess(request, data.orgId);
    const db = admin.firestore();

    const ref = db.collection(COLLECTION.REQUESTS).doc(data.requestId);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "Request not found.");
    }

    const requestDoc = { id: snap.id, ...snap.data() } as Request;

    if (requestDoc.orgId !== data.orgId) {
      throw new HttpsError(
        "permission-denied",
        "You do not have access to this request."
      );
    }

    if (requestDoc.requestorId !== uid) {
      throw new HttpsError(
        "permission-denied",
        "Only the original requestor can save the expense report."
      );
    }

    const editableStatuses: string[] = [
      STATUS.PREAPPROVED,
      STATUS.DRAFT_EXPENSE,
      STATUS.NEEDS_EDITS_STEP3,
      STATUS.EXCEEDS_APPROVED_AMOUNT,
    ];

    if (!editableStatuses.includes(requestDoc.status)) {
      throw new HttpsError(
        "failed-precondition",
        `Cannot save expense report with status: ${requestDoc.status}`
      );
    }

    if (!Array.isArray(data.lineItems) || data.lineItems.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "At least one line item is required."
      );
    }

    const now = nowTimestamp();
    const batch = db.batch();

    // Delete existing line items for this request
    const existingSnap = await db
      .collection(COLLECTION.LINE_ITEMS)
      .where("requestId", "==", data.requestId)
      .get();

    for (const doc of existingSnap.docs) {
      batch.delete(doc.ref);
    }

    // Calculate actual amount and add new line items
    let actualAmount = 0;
    for (const item of data.lineItems) {
      const lineItemRef = db.collection(COLLECTION.LINE_ITEMS).doc();
      actualAmount += item.amount ?? 0;
      batch.set(lineItemRef, {
        requestId: data.requestId,
        orgId: data.orgId,
        tenantId: TENANT_ID,
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
    const updateData: Record<string, unknown> = {
      actualAmount,
      status: STATUS.DRAFT_EXPENSE,
      step: STEP.EXPENSE_REPORT,
      updatedAt: now,
    };

    if (data.notes !== undefined) {
      updateData["receiptsReviewNotes"] = data.notes;
    }

    batch.update(ref, updateData);
    await batch.commit();

    return { success: true, actualAmount, lineItemCount: data.lineItems.length };
  }
);

// ─── submitExpenseReport ──────────────────────────────────────────────────────

/**
 * Transitions DRAFT_EXPENSE → SUBMITTED_RECEIPT_REVIEW (or EXCEEDS_APPROVED_AMOUNT).
 * Creates receiptsReview token and sends email to FINANCE_RECEIPTS_REVIEWER users.
 */
export const submitExpenseReport = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { requestId: string; orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    const db = admin.firestore();

    const ref = db.collection(COLLECTION.REQUESTS).doc(data.requestId);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "Request not found.");
    }

    const requestDoc = { id: snap.id, ...snap.data() } as Request;

    if (requestDoc.orgId !== data.orgId) {
      throw new HttpsError(
        "permission-denied",
        "You do not have access to this request."
      );
    }

    if (requestDoc.requestorId !== uid) {
      throw new HttpsError(
        "permission-denied",
        "Only the original requestor can submit the expense report."
      );
    }

    if (requestDoc.status !== STATUS.DRAFT_EXPENSE) {
      throw new HttpsError(
        "failed-precondition",
        `Cannot submit expense report with status: ${requestDoc.status}`
      );
    }

    const now = nowTimestamp();
    const escalationBuffer =
      ORG_CONFIG[data.orgId]?.escalationBufferAmount ?? 50;

    // Check for overage
    const isOverage =
      requestDoc.actualAmount > requestDoc.approvedAmount + escalationBuffer;

    if (isOverage) {
      await ref.update({
        status: STATUS.EXCEEDS_APPROVED_AMOUNT,
        expenseReportSubmittedAt: now,
        updatedAt: now,
      });

      const overageRequest = {
        ...requestDoc,
        status: STATUS.EXCEEDS_APPROVED_AMOUNT,
        expenseReportSubmittedAt: now,
      };
      await sendOverageEmail(overageRequest);

      return { success: true, status: STATUS.EXCEEDS_APPROVED_AMOUNT };
    }

    // Generate receipts review token (14 days)
    const tokenValue = generateToken();
    const tokenExpiry = tokenExpiryDate(14 * 24);

    await db.collection(COLLECTION.TOKENS).doc(tokenValue).set({
      requestId: data.requestId,
      orgId: data.orgId,
      tenantId: TENANT_ID,
      type: TOKEN_TYPE.RECEIPTS_REVIEW,
      used: false,
      expiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
      createdAt: now,
    });

    await ref.update({
      status: STATUS.SUBMITTED_RECEIPT_REVIEW,
      step: STEP.RECEIPTS_REVIEW,
      receiptsReviewToken: tokenValue,
      receiptsReviewTokenExpiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
      expenseReportSubmittedAt: now,
      updatedAt: now,
    });

    const updatedRequest: Request = {
      ...requestDoc,
      status: STATUS.SUBMITTED_RECEIPT_REVIEW,
      step: STEP.RECEIPTS_REVIEW,
      receiptsReviewToken: tokenValue,
      receiptsReviewTokenExpiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
    };

    await sendReceiptsReviewEmail(updatedRequest, tokenValue);

    return { success: true, status: STATUS.SUBMITTED_RECEIPT_REVIEW };
  }
);

// ─── registerFile ─────────────────────────────────────────────────────────────

/**
 * Saves file metadata to the files collection after client-side upload to Storage.
 */
export const registerFile = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      requestId: string;
      orgId: string;
      fileName: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
      lineItemId?: string;
    };
    const uid = await verifyOrgAccess(request, data.orgId);
    const db = admin.firestore();

    if (!data.requestId || !data.fileName || !data.fileUrl) {
      throw new HttpsError(
        "invalid-argument",
        "requestId, fileName, and fileUrl are required."
      );
    }

    // Verify request exists and belongs to this org
    const reqSnap = await db
      .collection(COLLECTION.REQUESTS)
      .doc(data.requestId)
      .get();

    if (!reqSnap.exists) {
      throw new HttpsError("not-found", "Request not found.");
    }

    const req = reqSnap.data() as Request;
    if (req.orgId !== data.orgId) {
      throw new HttpsError(
        "permission-denied",
        "You do not have access to this request."
      );
    }

    const now = nowTimestamp();
    const fileRef = db.collection(COLLECTION.FILES).doc();

    const fileData: Record<string, unknown> = {
      requestId: data.requestId,
      orgId: data.orgId,
      tenantId: TENANT_ID,
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
  }
);

// ─── deleteReceiptFile ────────────────────────────────────────────────────────

/**
 * Deletes file metadata from the files collection.
 * Storage deletion is handled client-side.
 */
export const deleteReceiptFile = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { fileId: string; orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    const db = admin.firestore();

    const ref = db.collection(COLLECTION.FILES).doc(data.fileId);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "File not found.");
    }

    const file = snap.data() as { orgId: string; uploadedBy: string };

    if (file.orgId !== data.orgId) {
      throw new HttpsError(
        "permission-denied",
        "You do not have access to this file."
      );
    }

    if (file.uploadedBy !== uid) {
      throw new HttpsError(
        "permission-denied",
        "Only the uploader can delete this file."
      );
    }

    await ref.delete();

    return { success: true };
  }
);
