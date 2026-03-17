import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { COLLECTION, ROLE, STATUS, STEP } from "./constants";
import {
  nowTimestamp,
  requireRole,
  verifyOrgAccess,
} from "./helpers";
import {
  sendPaymentConfirmationEmail,
  sendQBSentEmail,
} from "./email";
import { Request } from "./types";

// ─── markAsPaid ───────────────────────────────────────────────────────────────

/**
 * Requires FINANCE_PAYOR role.
 * Transitions FINAL_APPROVED → PAID, step=6.
 * Sends payment confirmation email to requestor.
 */
export const markAsPaid = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      requestId: string;
      orgId: string;
      paymentReference: string;
      paidAt?: string; // ISO date string, optional override
    };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.FINANCE_PAYOR, ROLE.ADMIN]);

    if (!data.paymentReference?.trim()) {
      throw new HttpsError(
        "invalid-argument",
        "paymentReference is required."
      );
    }

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

    if (requestDoc.status !== STATUS.FINAL_APPROVED) {
      throw new HttpsError(
        "failed-precondition",
        `Request must be in FINAL_APPROVED status to mark as paid (current: ${requestDoc.status})`
      );
    }

    const nowTs = nowTimestamp();
    const paidAtTs = data.paidAt
      ? admin.firestore.Timestamp.fromDate(new Date(data.paidAt))
      : nowTs;

    await ref.update({
      status: STATUS.PAID,
      step: STEP.PAID,
      paidAt: paidAtTs,
      paidBy: uid,
      paymentReference: data.paymentReference.trim(),
      updatedAt: nowTs,
    });

    const updatedRequest: Request = {
      ...requestDoc,
      status: STATUS.PAID,
      step: STEP.PAID,
      paidAt: paidAtTs,
      paidBy: uid,
      paymentReference: data.paymentReference.trim(),
    };

    await sendPaymentConfirmationEmail(updatedRequest);

    return { success: true, status: STATUS.PAID };
  }
);

// ─── sendToQuickBooks ─────────────────────────────────────────────────────────

/**
 * Requires FINANCE_QB_ENTRY or ADMIN role.
 * Transitions PAID → QB_SENT, step=7.
 * Sends QB sent email to QB assist emails.
 */
export const sendToQuickBooks = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { requestId: string; orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.FINANCE_QB_ENTRY, ROLE.ADMIN]);

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

    if (requestDoc.status !== STATUS.PAID) {
      throw new HttpsError(
        "failed-precondition",
        `Request must be in PAID status to send to QuickBooks (current: ${requestDoc.status})`
      );
    }

    const nowTs = nowTimestamp();

    await ref.update({
      status: STATUS.QB_SENT,
      step: STEP.QB_SENT,
      qbSentAt: nowTs,
      qbSentBy: uid,
      updatedAt: nowTs,
    });

    const updatedRequest: Request = {
      ...requestDoc,
      status: STATUS.QB_SENT,
      step: STEP.QB_SENT,
      qbSentAt: nowTs,
      qbSentBy: uid,
    };

    await sendQBSentEmail(updatedRequest);

    return { success: true, status: STATUS.QB_SENT };
  }
);

// ─── confirmQBEntry ───────────────────────────────────────────────────────────

/**
 * Requires FINANCE_QB_ENTRY or ADMIN role.
 * Transitions QB_SENT → QB_ENTERED, step=8.
 */
export const confirmQBEntry = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { requestId: string; orgId: string; notes?: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.FINANCE_QB_ENTRY, ROLE.ADMIN]);

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

    if (requestDoc.status !== STATUS.QB_SENT) {
      throw new HttpsError(
        "failed-precondition",
        `Request must be in QB_SENT status to confirm entry (current: ${requestDoc.status})`
      );
    }

    const nowTs = nowTimestamp();

    await ref.update({
      status: STATUS.QB_ENTERED,
      step: STEP.QB_ENTERED,
      qbEnteredAt: nowTs,
      qbEnteredBy: uid,
      qbEnteredNotes: data.notes ?? "",
      updatedAt: nowTs,
    });

    return { success: true, status: STATUS.QB_ENTERED };
  }
);
