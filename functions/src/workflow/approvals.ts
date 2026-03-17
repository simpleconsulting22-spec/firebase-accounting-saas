import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import {
  COLLECTION,
  ROLE,
  STATUS,
  STEP,
  TENANT_ID,
  TOKEN_TYPE,
} from "./constants";
import {
  generateToken,
  nowTimestamp,
  requireRole,
  tokenExpiryDate,
  verifyAuth,
  verifyOrgAccess,
} from "./helpers";
import {
  sendApprovedEmail,
  sendFinalApprovedEmail,
  sendNeedsEditsEmail,
  sendOverageEmail,
  sendReceiptsReviewEmail,
  sendRejectedEmail,
} from "./email";
import { Request, Token } from "./types";

// ─── validateTokenAndGetRequest ───────────────────────────────────────────────

/**
 * PUBLIC — no auth required.
 * Looks up a token, validates it is not used/expired, and returns
 * the associated request data plus token type.
 */
export const validateTokenAndGetRequest = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { token: string };
    if (!data.token) {
      throw new HttpsError(
        "invalid-argument",
        "token is required."
      );
    }

    const db = admin.firestore();
    const tokenRef = db.collection(COLLECTION.TOKENS).doc(data.token);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists) {
      throw new HttpsError("not-found", "Token not found.");
    }

    const tokenDoc = { id: tokenSnap.id, ...tokenSnap.data() } as Token;

    if (tokenDoc.used === true) {
      throw new HttpsError(
        "failed-precondition",
        "This token has already been used."
      );
    }

    const now = admin.firestore.Timestamp.now();
    if (tokenDoc.expiresAt.toMillis() < now.toMillis()) {
      throw new HttpsError(
        "deadline-exceeded",
        "This token has expired."
      );
    }

    // Fetch associated request
    const requestSnap = await db
      .collection(COLLECTION.REQUESTS)
      .doc(tokenDoc.requestId)
      .get();

    if (!requestSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Associated request not found."
      );
    }

    const requestDoc = { id: requestSnap.id, ...requestSnap.data() } as Request;

    return {
      token: {
        id: tokenDoc.id,
        type: tokenDoc.type,
        expiresAt: tokenDoc.expiresAt,
        used: tokenDoc.used,
      },
      request: requestDoc,
    };
  }
);

// ─── submitApproverDecision ───────────────────────────────────────────────────

/**
 * Pre-approval step decision.
 * decision="approve": PREAPPROVED, step=3, set approvedAmount, send approved email
 * decision="reject": REJECTED, send rejected email
 * decision="needs_edits": NEEDS_EDITS_STEP1, send needs edits email
 * Marks token as used.
 */
export const submitApproverDecision = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      token: string;
      decision: "approve" | "reject" | "needs_edits";
      notes?: string;
      approvedAmount?: number;
    };
    if (!data.token || !data.decision) {
      throw new HttpsError(
        "invalid-argument",
        "token and decision are required."
      );
    }

    const validDecisions = ["approve", "reject", "needs_edits"];
    if (!validDecisions.includes(data.decision)) {
      throw new HttpsError(
        "invalid-argument",
        `decision must be one of: ${validDecisions.join(", ")}`
      );
    }

    const db = admin.firestore();
    const tokenRef = db.collection(COLLECTION.TOKENS).doc(data.token);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists) {
      throw new HttpsError("not-found", "Token not found.");
    }

    const tokenDoc = { id: tokenSnap.id, ...tokenSnap.data() } as Token;

    if (tokenDoc.used === true) {
      throw new HttpsError(
        "failed-precondition",
        "This token has already been used."
      );
    }

    const now = admin.firestore.Timestamp.now();
    if (tokenDoc.expiresAt.toMillis() < now.toMillis()) {
      throw new HttpsError(
        "deadline-exceeded",
        "This token has expired."
      );
    }

    if (tokenDoc.type !== TOKEN_TYPE.PRE_APPROVAL) {
      throw new HttpsError(
        "invalid-argument",
        "This token is not a pre-approval token."
      );
    }

    const requestRef = db
      .collection(COLLECTION.REQUESTS)
      .doc(tokenDoc.requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      throw new HttpsError("not-found", "Request not found.");
    }

    const requestDoc = { id: requestSnap.id, ...requestSnap.data() } as Request;

    if (requestDoc.status !== STATUS.SUBMITTED_PREAPPROVAL) {
      throw new HttpsError(
        "failed-precondition",
        `Request is not in SUBMITTED_PREAPPROVAL status (current: ${requestDoc.status})`
      );
    }

    const nowTs = nowTimestamp();
    let newStatus: string;
    let updates: Record<string, unknown> = {
      preApprovalDecidedAt: nowTs,
      preApprovalDecidedBy: requestDoc.approverId,
      preApprovalNotes: data.notes ?? "",
      updatedAt: nowTs,
    };

    if (data.decision === "approve") {
      if (!data.approvedAmount || data.approvedAmount <= 0) {
        // Default to estimated amount if not provided
        updates["approvedAmount"] = requestDoc.estimatedAmount;
      } else {
        updates["approvedAmount"] = data.approvedAmount;
      }
      newStatus = STATUS.PREAPPROVED;
      updates["status"] = newStatus;
      updates["step"] = STEP.EXPENSE_REPORT;
      updates["preApprovedAt"] = nowTs;
      updates["preApprovedBy"] = requestDoc.approverEmail;
    } else if (data.decision === "reject") {
      newStatus = STATUS.REJECTED;
      updates["status"] = newStatus;
      updates["rejectedAt"] = nowTs;
      updates["rejectedBy"] = requestDoc.approverId;
      updates["rejectionReason"] = data.notes ?? "";
    } else {
      // needs_edits
      newStatus = STATUS.NEEDS_EDITS_STEP1;
      updates["status"] = newStatus;
      updates["step"] = STEP.DRAFT_SUBMIT;
    }

    // Mark token used and update request in a batch
    const batch = db.batch();
    batch.update(tokenRef, { used: true });
    batch.update(requestRef, updates);
    await batch.commit();

    const updatedRequest: Request = {
      ...requestDoc,
      ...updates,
      preApprovalNotes: data.notes ?? "",
      approvedAmount:
        data.decision === "approve"
          ? (updates["approvedAmount"] as number)
          : requestDoc.approvedAmount,
    };

    try {
      if (data.decision === "approve") {
        await sendApprovedEmail(updatedRequest);
        console.log("Approval notification sent to", requestDoc.requestorEmail);
      } else if (data.decision === "reject") {
        const rejectedRequest = {
          ...updatedRequest,
          rejectionReason: data.notes ?? "",
        };
        await sendRejectedEmail(rejectedRequest);
        console.log("Rejection notification sent to", requestDoc.requestorEmail);
      } else {
        await sendNeedsEditsEmail(updatedRequest);
        console.log("Needs-edits notification sent to", requestDoc.requestorEmail);
      }
    } catch (emailErr) {
      console.error("Failed to send decision notification email", emailErr);
    }

    return { success: true, status: newStatus };
  }
);

// ─── approveReceiptsReview ────────────────────────────────────────────────────

/**
 * Receipts reviewer approves via token: status → FINAL_APPROVED, step=5.
 */
export const approveReceiptsReview = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { token: string; notes?: string };
    if (!data.token) {
      throw new HttpsError(
        "invalid-argument",
        "token is required."
      );
    }

    const db = admin.firestore();
    const tokenRef = db.collection(COLLECTION.TOKENS).doc(data.token);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists) {
      throw new HttpsError("not-found", "Token not found.");
    }

    const tokenDoc = { id: tokenSnap.id, ...tokenSnap.data() } as Token;

    if (tokenDoc.used === true) {
      throw new HttpsError(
        "failed-precondition",
        "This token has already been used."
      );
    }

    const now = admin.firestore.Timestamp.now();
    if (tokenDoc.expiresAt.toMillis() < now.toMillis()) {
      throw new HttpsError(
        "deadline-exceeded",
        "This token has expired."
      );
    }

    if (tokenDoc.type !== TOKEN_TYPE.RECEIPTS_REVIEW) {
      throw new HttpsError(
        "invalid-argument",
        "This token is not a receipts review token."
      );
    }

    const requestRef = db
      .collection(COLLECTION.REQUESTS)
      .doc(tokenDoc.requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      throw new HttpsError("not-found", "Request not found.");
    }

    const requestDoc = { id: requestSnap.id, ...requestSnap.data() } as Request;

    if (requestDoc.status !== STATUS.SUBMITTED_RECEIPT_REVIEW) {
      throw new HttpsError(
        "failed-precondition",
        `Request is not in SUBMITTED_RECEIPT_REVIEW status (current: ${requestDoc.status})`
      );
    }

    const nowTs = nowTimestamp();
    const batch = db.batch();
    batch.update(tokenRef, { used: true });
    batch.update(requestRef, {
      status: STATUS.FINAL_APPROVED,
      step: STEP.FINAL_APPROVED,
      finalApprovedAt: nowTs,
      finalApprovedBy: "receipts_reviewer",
      receiptsReviewDecidedAt: nowTs,
      receiptsReviewDecidedBy: "receipts_reviewer",
      receiptsReviewNotes: data.notes ?? "",
      updatedAt: nowTs,
    });
    await batch.commit();

    const updatedRequest: Request = {
      ...requestDoc,
      status: STATUS.FINAL_APPROVED,
      step: STEP.FINAL_APPROVED,
      receiptsReviewNotes: data.notes ?? "",
    };

    await sendFinalApprovedEmail(updatedRequest);

    return { success: true, status: STATUS.FINAL_APPROVED };
  }
);

// ─── rejectReceiptsReview ─────────────────────────────────────────────────────

/**
 * Receipts reviewer rejects via token: status → REJECTED.
 */
export const rejectReceiptsReview = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { token: string; reason?: string };
    if (!data.token) {
      throw new HttpsError(
        "invalid-argument",
        "token is required."
      );
    }

    const db = admin.firestore();
    const tokenRef = db.collection(COLLECTION.TOKENS).doc(data.token);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists) {
      throw new HttpsError("not-found", "Token not found.");
    }

    const tokenDoc = { id: tokenSnap.id, ...tokenSnap.data() } as Token;

    if (tokenDoc.used === true) {
      throw new HttpsError(
        "failed-precondition",
        "This token has already been used."
      );
    }

    const now = admin.firestore.Timestamp.now();
    if (tokenDoc.expiresAt.toMillis() < now.toMillis()) {
      throw new HttpsError(
        "deadline-exceeded",
        "This token has expired."
      );
    }

    if (tokenDoc.type !== TOKEN_TYPE.RECEIPTS_REVIEW) {
      throw new HttpsError(
        "invalid-argument",
        "This token is not a receipts review token."
      );
    }

    const requestRef = db
      .collection(COLLECTION.REQUESTS)
      .doc(tokenDoc.requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      throw new HttpsError("not-found", "Request not found.");
    }

    const requestDoc = { id: requestSnap.id, ...requestSnap.data() } as Request;

    if (requestDoc.status !== STATUS.SUBMITTED_RECEIPT_REVIEW) {
      throw new HttpsError(
        "failed-precondition",
        `Request is not in SUBMITTED_RECEIPT_REVIEW status (current: ${requestDoc.status})`
      );
    }

    const nowTs = nowTimestamp();
    const batch = db.batch();
    batch.update(tokenRef, { used: true });
    batch.update(requestRef, {
      status: STATUS.REJECTED,
      rejectedAt: nowTs,
      rejectedBy: "receipts_reviewer",
      rejectionReason: data.reason ?? "",
      receiptsReviewDecidedAt: nowTs,
      receiptsReviewDecidedBy: "receipts_reviewer",
      receiptsReviewNotes: data.reason ?? "",
      updatedAt: nowTs,
    });
    await batch.commit();

    const updatedRequest: Request = {
      ...requestDoc,
      status: STATUS.REJECTED,
      rejectionReason: data.reason ?? "",
    };

    await sendRejectedEmail(updatedRequest);

    return { success: true, status: STATUS.REJECTED };
  }
);

// ─── sendBackForEdits ─────────────────────────────────────────────────────────

/**
 * Receipts reviewer sends back for edits via token: status → NEEDS_EDITS_STEP3.
 */
export const sendBackForEdits = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { token: string; notes?: string };
    if (!data.token) {
      throw new HttpsError(
        "invalid-argument",
        "token is required."
      );
    }

    const db = admin.firestore();
    const tokenRef = db.collection(COLLECTION.TOKENS).doc(data.token);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists) {
      throw new HttpsError("not-found", "Token not found.");
    }

    const tokenDoc = { id: tokenSnap.id, ...tokenSnap.data() } as Token;

    if (tokenDoc.used === true) {
      throw new HttpsError(
        "failed-precondition",
        "This token has already been used."
      );
    }

    const now = admin.firestore.Timestamp.now();
    if (tokenDoc.expiresAt.toMillis() < now.toMillis()) {
      throw new HttpsError(
        "deadline-exceeded",
        "This token has expired."
      );
    }

    if (tokenDoc.type !== TOKEN_TYPE.RECEIPTS_REVIEW) {
      throw new HttpsError(
        "invalid-argument",
        "This token is not a receipts review token."
      );
    }

    const requestRef = db
      .collection(COLLECTION.REQUESTS)
      .doc(tokenDoc.requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      throw new HttpsError("not-found", "Request not found.");
    }

    const requestDoc = { id: requestSnap.id, ...requestSnap.data() } as Request;

    if (requestDoc.status !== STATUS.SUBMITTED_RECEIPT_REVIEW) {
      throw new HttpsError(
        "failed-precondition",
        `Request is not in SUBMITTED_RECEIPT_REVIEW status (current: ${requestDoc.status})`
      );
    }

    const nowTs = nowTimestamp();
    const batch = db.batch();
    batch.update(tokenRef, { used: true });
    batch.update(requestRef, {
      status: STATUS.NEEDS_EDITS_STEP3,
      step: STEP.EXPENSE_REPORT,
      receiptsReviewNotes: data.notes ?? "",
      updatedAt: nowTs,
    });
    await batch.commit();

    // Reuse sendNeedsEditsEmail but for step 3 context
    const updatedRequest: Request = {
      ...requestDoc,
      status: STATUS.NEEDS_EDITS_STEP3,
      preApprovalNotes: data.notes ?? "",
    };

    // Send an email to requestor about step 3 edits needed
    await sendNeedsEditsEmail(updatedRequest);

    return { success: true, status: STATUS.NEEDS_EDITS_STEP3 };
  }
);

// ─── applyOverageApproval ─────────────────────────────────────────────────────

/**
 * Admin/finance overrides the approved amount to resolve EXCEEDS_APPROVED_AMOUNT.
 * Generates a new receipts review token and moves to SUBMITTED_RECEIPT_REVIEW.
 */
export const applyOverageApproval = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      requestId: string;
      orgId: string;
      newApprovedAmount: number;
    };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN, ROLE.FINANCE_RECEIPTS_REVIEWER]);

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

    if (requestDoc.status !== STATUS.EXCEEDS_APPROVED_AMOUNT) {
      throw new HttpsError(
        "failed-precondition",
        `Request is not in EXCEEDS_APPROVED_AMOUNT status (current: ${requestDoc.status})`
      );
    }

    if (!data.newApprovedAmount || data.newApprovedAmount <= 0) {
      throw new HttpsError(
        "invalid-argument",
        "newApprovedAmount must be a positive number."
      );
    }

    const now = nowTimestamp();

    // Generate new receipts review token
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
      approvedAmount: data.newApprovedAmount,
      receiptsReviewToken: tokenValue,
      receiptsReviewTokenExpiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
      updatedAt: now,
    });

    const updatedRequest: Request = {
      ...requestDoc,
      status: STATUS.SUBMITTED_RECEIPT_REVIEW,
      step: STEP.RECEIPTS_REVIEW,
      approvedAmount: data.newApprovedAmount,
      receiptsReviewToken: tokenValue,
    };

    await sendReceiptsReviewEmail(updatedRequest, tokenValue);

    return {
      success: true,
      status: STATUS.SUBMITTED_RECEIPT_REVIEW,
      newApprovedAmount: data.newApprovedAmount,
    };
  }
);

// ─── adminApproveReceiptsReview ───────────────────────────────────────────────

/**
 * Admin bypasses the token-based receipts approval flow and directly approves.
 * status → FINAL_APPROVED, step=5.
 */
export const adminApproveReceiptsReview = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { requestId: string; orgId: string; notes?: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [
      ROLE.ADMIN,
      ROLE.FINANCE_RECEIPTS_REVIEWER,
    ]);

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

    const reviewableStatuses: string[] = [
      STATUS.SUBMITTED_RECEIPT_REVIEW,
      STATUS.EXCEEDS_APPROVED_AMOUNT,
    ];

    if (!reviewableStatuses.includes(requestDoc.status)) {
      throw new HttpsError(
        "failed-precondition",
        `Cannot approve receipts review with status: ${requestDoc.status}`
      );
    }

    const nowTs = nowTimestamp();

    await ref.update({
      status: STATUS.FINAL_APPROVED,
      step: STEP.FINAL_APPROVED,
      finalApprovedAt: nowTs,
      finalApprovedBy: uid,
      receiptsReviewDecidedAt: nowTs,
      receiptsReviewDecidedBy: uid,
      receiptsReviewNotes: data.notes ?? "",
      updatedAt: nowTs,
    });

    const updatedRequest: Request = {
      ...requestDoc,
      status: STATUS.FINAL_APPROVED,
      step: STEP.FINAL_APPROVED,
      receiptsReviewNotes: data.notes ?? "",
    };

    await sendFinalApprovedEmail(updatedRequest);

    return { success: true, status: STATUS.FINAL_APPROVED };
  }
);
