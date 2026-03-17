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
exports.getRequestDetail = exports.getMyDashboards = exports.submitPreApproval = exports.savePurchaseRequestDraft = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const constants_1 = require("./constants");
const helpers_1 = require("./helpers");
const email_1 = require("./email");
// ─── savePurchaseRequestDraft ─────────────────────────────────────────────────
/**
 * Creates or updates a DRAFT purchase request.
 * - If new: generates REQ-ID, creates pre-approval token
 * - If updating existing DRAFT or NEEDS_EDITS_STEP1: updates fields
 */
exports.savePurchaseRequestDraft = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    const db = admin.firestore();
    // Validate required fields
    if (!data.orgId) {
        throw new https_1.HttpsError("invalid-argument", "orgId is required.");
    }
    if (!data.purpose?.trim()) {
        throw new https_1.HttpsError("invalid-argument", "purpose is required.");
    }
    if (!data.estimatedAmount || data.estimatedAmount <= 0) {
        throw new https_1.HttpsError("invalid-argument", "estimatedAmount must be a positive number.");
    }
    const userProfile = await (0, helpers_1.getUserProfile)(uid);
    if (!userProfile) {
        throw new https_1.HttpsError("failed-precondition", "User profile not found. Please complete your profile first.");
    }
    const now = (0, helpers_1.nowTimestamp)();
    if (data.requestId) {
        // Update existing request
        const ref = db.collection(constants_1.COLLECTION.REQUESTS).doc(data.requestId);
        const snap = await ref.get();
        if (!snap.exists) {
            throw new https_1.HttpsError("not-found", "Request not found.");
        }
        const existing = snap.data();
        if (existing.orgId !== data.orgId) {
            throw new https_1.HttpsError("permission-denied", "You do not have access to this request.");
        }
        if (existing.requestorId !== uid) {
            throw new https_1.HttpsError("permission-denied", "Only the original requestor can edit this draft.");
        }
        if (existing.status !== constants_1.STATUS.DRAFT &&
            existing.status !== constants_1.STATUS.NEEDS_EDITS_STEP1) {
            throw new https_1.HttpsError("failed-precondition", `Cannot edit a request with status: ${existing.status}`);
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
    }
    else {
        // Create new request
        const year = new Date().getFullYear();
        const requestId = await (0, helpers_1.getNextRequestId)(data.orgId, year);
        // Generate pre-approval token
        const tokenValue = (0, helpers_1.generateToken)();
        const tokenExpiry = (0, helpers_1.tokenExpiryDate)(7 * 24); // 7 days
        // Create token doc
        const tokenRef = db.collection(constants_1.COLLECTION.TOKENS).doc(tokenValue);
        await tokenRef.set({
            requestId,
            orgId: data.orgId,
            tenantId: constants_1.TENANT_ID,
            type: constants_1.TOKEN_TYPE.PRE_APPROVAL,
            used: false,
            expiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
            createdAt: now,
        });
        const newRequest = {
            orgId: data.orgId,
            tenantId: constants_1.TENANT_ID,
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
            status: constants_1.STATUS.DRAFT,
            step: constants_1.STEP.DRAFT_SUBMIT,
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
        await db.collection(constants_1.COLLECTION.REQUESTS).doc(requestId).set(newRequest);
        return {
            requestId,
            request: { id: requestId, ...newRequest },
        };
    }
});
// ─── submitPreApproval ────────────────────────────────────────────────────────
/**
 * Transitions DRAFT → SUBMITTED_PREAPPROVAL and sends pre-approval email to approver.
 */
exports.submitPreApproval = (0, https_1.onCall)(async (request) => {
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
        throw new https_1.HttpsError("permission-denied", "Only the original requestor can submit this request.");
    }
    if (requestDoc.status !== constants_1.STATUS.DRAFT &&
        requestDoc.status !== constants_1.STATUS.NEEDS_EDITS_STEP1) {
        throw new https_1.HttpsError("failed-precondition", `Cannot submit a request with status: ${requestDoc.status}`);
    }
    const now = (0, helpers_1.nowTimestamp)();
    await ref.update({
        status: constants_1.STATUS.SUBMITTED_PREAPPROVAL,
        step: constants_1.STEP.PREAPPROVAL_REVIEW,
        submittedAt: now,
        updatedAt: now,
    });
    const updatedRequest = { ...requestDoc, status: constants_1.STATUS.SUBMITTED_PREAPPROVAL, step: constants_1.STEP.PREAPPROVAL_REVIEW };
    try {
        await (0, email_1.sendPreApprovalEmail)(updatedRequest, requestDoc.preApprovalToken);
        console.log("Approval email sent to", requestDoc.approverEmail);
    }
    catch (emailErr) {
        console.error("Failed to send approval email", emailErr);
    }
    return { success: true, status: constants_1.STATUS.SUBMITTED_PREAPPROVAL };
});
// ─── getMyDashboards ──────────────────────────────────────────────────────────
/**
 * Returns dashboard data for the current user:
 * - myRequests: requests where user is requestor
 * - pendingApprovals: requests where user is approver and status=SUBMITTED_PREAPPROVAL
 * - financeQueue: requests in finance-relevant statuses (for finance roles)
 */
exports.getMyDashboards = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    const db = admin.firestore();
    const [userRoles, myRequestsSnap, pendingApprovalsSnap] = await Promise.all([
        (0, helpers_1.getUserOrgRoles)(uid, data.orgId),
        db
            .collection(constants_1.COLLECTION.REQUESTS)
            .where("orgId", "==", data.orgId)
            .where("requestorId", "==", uid)
            .orderBy("createdAt", "desc")
            .get(),
        db
            .collection(constants_1.COLLECTION.REQUESTS)
            .where("orgId", "==", data.orgId)
            .where("approverId", "==", uid)
            .where("status", "==", constants_1.STATUS.SUBMITTED_PREAPPROVAL)
            .orderBy("createdAt", "desc")
            .get(),
    ]);
    const myRequests = myRequestsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const pendingApprovals = pendingApprovalsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    }));
    // Finance queue: show relevant statuses to finance roles
    const isFinance = userRoles.includes(constants_1.ROLE.ADMIN) ||
        userRoles.includes(constants_1.ROLE.FINANCE_PAYOR) ||
        userRoles.includes(constants_1.ROLE.FINANCE_RECEIPTS_REVIEWER) ||
        userRoles.includes(constants_1.ROLE.FINANCE_QB_ENTRY) ||
        userRoles.includes(constants_1.ROLE.FINANCE_NOTIFY);
    let financeQueue = [];
    if (isFinance) {
        const financeStatuses = [
            constants_1.STATUS.SUBMITTED_RECEIPT_REVIEW,
            constants_1.STATUS.EXCEEDS_APPROVED_AMOUNT,
            constants_1.STATUS.FINAL_APPROVED,
            constants_1.STATUS.PAID,
            constants_1.STATUS.QB_SENT,
            constants_1.STATUS.QB_ENTERED,
        ];
        const financeSnap = await db
            .collection(constants_1.COLLECTION.REQUESTS)
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
});
// ─── getRequestDetail ─────────────────────────────────────────────────────────
/**
 * Returns full request detail including line items and files.
 */
exports.getRequestDetail = (0, https_1.onCall)(async (request) => {
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
    // Verify user has right to view: requestor, approver, or finance role
    const userRoles = await (0, helpers_1.getUserOrgRoles)(uid, data.orgId);
    const isFinance = userRoles.includes(constants_1.ROLE.ADMIN) ||
        userRoles.includes(constants_1.ROLE.FINANCE_PAYOR) ||
        userRoles.includes(constants_1.ROLE.FINANCE_RECEIPTS_REVIEWER) ||
        userRoles.includes(constants_1.ROLE.FINANCE_QB_ENTRY) ||
        userRoles.includes(constants_1.ROLE.FINANCE_NOTIFY);
    const canView = requestDoc.requestorId === uid ||
        requestDoc.approverId === uid ||
        isFinance;
    if (!canView) {
        throw new https_1.HttpsError("permission-denied", "You do not have permission to view this request.");
    }
    // Fetch line items and files in parallel
    const [lineItemsSnap, filesSnap] = await Promise.all([
        db
            .collection(constants_1.COLLECTION.LINE_ITEMS)
            .where("requestId", "==", data.requestId)
            .orderBy("createdAt", "asc")
            .get(),
        db
            .collection(constants_1.COLLECTION.FILES)
            .where("requestId", "==", data.requestId)
            .orderBy("createdAt", "asc")
            .get(),
    ]);
    const lineItems = lineItemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const files = filesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { request: requestDoc, lineItems, files };
});
