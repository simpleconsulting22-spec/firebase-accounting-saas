import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import {
  BASE_URL,
  COLLECTION,
  ROLE,
  STATUS,
  STEP,
  TENANT_ID,
  TOKEN_TYPE,
} from "./constants";
import {
  generateToken,
  getNextRequestId,
  getUserOrgRoles,
  getUserProfile,
  nowTimestamp,
  tokenExpiryDate,
  verifyAuth,
  verifyOrgAccess,
} from "./helpers";
import { sendPreApprovalEmail } from "./email";
import { Request, SavePurchaseRequestDraftInput } from "./types";

// ─── savePurchaseRequestDraft ─────────────────────────────────────────────────

/**
 * Creates or updates a DRAFT purchase request.
 * - If new: generates REQ-ID, creates pre-approval token
 * - If updating existing DRAFT or NEEDS_EDITS_STEP1: updates fields
 */
export const savePurchaseRequestDraft = onCall(
  async (request: CallableRequest) => {
    const data = request.data as SavePurchaseRequestDraftInput;
    const uid = await verifyOrgAccess(request, data.orgId);
    const db = admin.firestore();

    // Validate required fields
    if (!data.orgId) {
      throw new HttpsError("invalid-argument", "orgId is required.");
    }
    if (!data.purpose?.trim()) {
      throw new HttpsError("invalid-argument", "purpose is required.");
    }
    if (!data.estimatedAmount || data.estimatedAmount <= 0) {
      throw new HttpsError(
        "invalid-argument",
        "estimatedAmount must be a positive number."
      );
    }

    const userProfile = await getUserProfile(uid);
    if (!userProfile) {
      throw new HttpsError(
        "failed-precondition",
        "User profile not found. Please complete your profile first."
      );
    }

    const now = nowTimestamp();

    if (data.requestId) {
      // Update existing request
      const ref = db.collection(COLLECTION.REQUESTS).doc(data.requestId);
      const snap = await ref.get();

      if (!snap.exists) {
        throw new HttpsError("not-found", "Request not found.");
      }

      const existing = snap.data() as Request;

      if (existing.orgId !== data.orgId) {
        throw new HttpsError(
          "permission-denied",
          "You do not have access to this request."
        );
      }

      if (existing.requestorId !== uid) {
        throw new HttpsError(
          "permission-denied",
          "Only the original requestor can edit this draft."
        );
      }

      if (
        existing.status !== STATUS.DRAFT &&
        existing.status !== STATUS.NEEDS_EDITS_STEP1
      ) {
        throw new HttpsError(
          "failed-precondition",
          `Cannot edit a request with status: ${existing.status}`
        );
      }

      await ref.update({
        approverId: data.approverId,
        approverEmail: data.approverEmail,
        approverName: data.approverName,
        ministryDepartment: data.ministryDepartment,
        fundId: data.fundId,
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        category: data.category,
        estimatedAmount: data.estimatedAmount,
        paymentMethod: data.paymentMethod,
        purpose: data.purpose,
        description: data.description,
        requestedExpenseDate: data.requestedExpenseDate,
        updatedAt: now,
      });

      const updated = await ref.get();
      return { requestId: data.requestId, request: { id: data.requestId, ...updated.data() } };
    } else {
      // Create new request
      const year = new Date().getFullYear();
      const requestId = await getNextRequestId(data.orgId, year);

      // Generate pre-approval token
      const tokenValue = generateToken();
      const tokenExpiry = tokenExpiryDate(7 * 24); // 7 days

      // Create token doc
      const tokenRef = db.collection(COLLECTION.TOKENS).doc(tokenValue);
      await tokenRef.set({
        requestId,
        orgId: data.orgId,
        tenantId: TENANT_ID,
        type: TOKEN_TYPE.PRE_APPROVAL,
        used: false,
        expiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
        createdAt: now,
      });

      const newRequest: Omit<Request, "id"> = {
        orgId: data.orgId,
        tenantId: TENANT_ID,
        requestorId: uid,
        requestorEmail: userProfile.email,
        requestorName: userProfile.displayName,
        approverId: data.approverId,
        approverEmail: data.approverEmail,
        approverName: data.approverName,
        ministryDepartment: data.ministryDepartment,
        fundId: data.fundId,
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        category: data.category,
        estimatedAmount: data.estimatedAmount,
        approvedAmount: 0,
        actualAmount: 0,
        paymentMethod: data.paymentMethod,
        purpose: data.purpose,
        description: data.description,
        requestedExpenseDate: data.requestedExpenseDate,
        status: STATUS.DRAFT,
        step: STEP.DRAFT_SUBMIT,
        preApprovalToken: tokenValue,
        preApprovalTokenExpiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
        preApprovalDecidedAt: null,
        preApprovalDecidedBy: null,
        preApprovalNotes: "",
        expenseReportSubmittedAt: null,
        receiptsReviewToken: "",
        receiptsReviewTokenExpiresAt: admin.firestore.Timestamp.fromDate(new Date(0)),
        receiptsReviewDecidedAt: null,
        receiptsReviewDecidedBy: null,
        receiptsReviewNotes: "",
        finalApprovedAt: null,
        finalApprovedBy: null,
        paidAt: null,
        paidBy: null,
        paymentReference: "",
        qbSentAt: null,
        qbSentBy: null,
        qbEnteredAt: null,
        qbEnteredBy: null,
        qbEnteredNotes: "",
        rejectedAt: null,
        rejectedBy: null,
        rejectionReason: "",
        createdAt: now,
        updatedAt: now,
      };

      await db.collection(COLLECTION.REQUESTS).doc(requestId).set(newRequest);

      return {
        requestId,
        request: { id: requestId, ...newRequest },
      };
    }
  }
);

// ─── submitPreApproval ────────────────────────────────────────────────────────

/**
 * Transitions DRAFT → SUBMITTED_PREAPPROVAL and sends pre-approval email to approver.
 */
export const submitPreApproval = onCall(
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
        "Only the original requestor can submit this request."
      );
    }

    if (
      requestDoc.status !== STATUS.DRAFT &&
      requestDoc.status !== STATUS.NEEDS_EDITS_STEP1
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Cannot submit a request with status: ${requestDoc.status}`
      );
    }

    const now = nowTimestamp();

    await ref.update({
      status: STATUS.SUBMITTED_PREAPPROVAL,
      step: STEP.PREAPPROVAL_REVIEW,
      submittedAt: now,
      updatedAt: now,
    });

    const updatedRequest = { ...requestDoc, status: STATUS.SUBMITTED_PREAPPROVAL, step: STEP.PREAPPROVAL_REVIEW };

    try {
      await sendPreApprovalEmail(updatedRequest, requestDoc.preApprovalToken);
      console.log("Approval email sent to", requestDoc.approverEmail);
    } catch (emailErr) {
      console.error("Failed to send approval email", emailErr);
    }

    return { success: true, status: STATUS.SUBMITTED_PREAPPROVAL };
  }
);

// ─── getMyDashboards ──────────────────────────────────────────────────────────

/**
 * Returns dashboard data for the current user:
 * - myRequests: requests where user is requestor
 * - pendingApprovals: requests where user is approver and status=SUBMITTED_PREAPPROVAL
 * - financeQueue: requests in finance-relevant statuses (for finance roles)
 */
export const getMyDashboards = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    const db = admin.firestore();

    const [userRoles, myRequestsSnap, pendingApprovalsSnap] = await Promise.all([
      getUserOrgRoles(uid, data.orgId),
      db
        .collection(COLLECTION.REQUESTS)
        .where("orgId", "==", data.orgId)
        .where("requestorId", "==", uid)
        .orderBy("createdAt", "desc")
        .get(),
      db
        .collection(COLLECTION.REQUESTS)
        .where("orgId", "==", data.orgId)
        .where("approverId", "==", uid)
        .where("status", "==", STATUS.SUBMITTED_PREAPPROVAL)
        .orderBy("createdAt", "desc")
        .get(),
    ]);

    const myRequests = myRequestsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const pendingApprovals = pendingApprovalsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Finance queue: show relevant statuses to finance roles
    const isFinance =
      userRoles.includes(ROLE.ADMIN) ||
      userRoles.includes(ROLE.FINANCE_PAYOR) ||
      userRoles.includes(ROLE.FINANCE_RECEIPTS_REVIEWER) ||
      userRoles.includes(ROLE.FINANCE_QB_ENTRY) ||
      userRoles.includes(ROLE.FINANCE_NOTIFY);

    let financeQueue: Record<string, unknown>[] = [];

    if (isFinance) {
      const financeStatuses = [
        STATUS.SUBMITTED_RECEIPT_REVIEW,
        STATUS.EXCEEDS_APPROVED_AMOUNT,
        STATUS.FINAL_APPROVED,
        STATUS.PAID,
        STATUS.QB_SENT,
        STATUS.QB_ENTERED,
      ];

      const financeSnap = await db
        .collection(COLLECTION.REQUESTS)
        .where("orgId", "==", data.orgId)
        .where("status", "in", financeStatuses)
        .orderBy("updatedAt", "desc")
        .get();

      financeQueue = financeSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    return {
      myRequests,
      pendingApprovals,
      financeQueue,
    };
  }
);

// ─── getRequestDetail ─────────────────────────────────────────────────────────

/**
 * Returns full request detail including line items and files.
 */
export const getRequestDetail = onCall(
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

    // Verify user has right to view: requestor, approver, or finance role
    const userRoles = await getUserOrgRoles(uid, data.orgId);
    const isFinance =
      userRoles.includes(ROLE.ADMIN) ||
      userRoles.includes(ROLE.FINANCE_PAYOR) ||
      userRoles.includes(ROLE.FINANCE_RECEIPTS_REVIEWER) ||
      userRoles.includes(ROLE.FINANCE_QB_ENTRY) ||
      userRoles.includes(ROLE.FINANCE_NOTIFY);

    const canView =
      requestDoc.requestorId === uid ||
      requestDoc.approverId === uid ||
      isFinance;

    if (!canView) {
      throw new HttpsError(
        "permission-denied",
        "You do not have permission to view this request."
      );
    }

    // Fetch line items and files in parallel
    const [lineItemsSnap, filesSnap] = await Promise.all([
      db
        .collection(COLLECTION.LINE_ITEMS)
        .where("requestId", "==", data.requestId)
        .orderBy("createdAt", "asc")
        .get(),
      db
        .collection(COLLECTION.FILES)
        .where("requestId", "==", data.requestId)
        .orderBy("createdAt", "asc")
        .get(),
    ]);

    const lineItems = lineItemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const files = filesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return { request: requestDoc, lineItems, files };
  }
);
