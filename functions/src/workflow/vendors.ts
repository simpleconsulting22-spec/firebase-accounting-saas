import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import {
  BASE_URL,
  COLLECTION,
  ROLE,
  TENANT_ID,
  TOKEN_TYPE,
} from "./constants";
import {
  generateToken,
  getUserProfile,
  nowTimestamp,
  requireRole,
  tokenExpiryDate,
  verifyAuth,
  verifyOrgAccess,
} from "./helpers";
import {
  sendVendorApprovedEmail,
  sendVendorIntakeEmail,
  sendVendorRejectedEmail,
} from "./email";
import { Token, VendorIntakeInput, VendorSetupRequest } from "./types";

// ─── getActiveVendors ─────────────────────────────────────────────────────────

/**
 * Returns all active vendors for an org.
 */
export const getActiveVendors = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string };
    await verifyOrgAccess(request, data.orgId);
    const db = admin.firestore();

    const snap = await db
      .collection(COLLECTION.VENDORS)
      .where("orgId", "==", data.orgId)
      .where("status", "==", "active")
      .orderBy("vendorName", "asc")
      .get();

    const vendors = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { vendors };
  }
);

// ─── submitVendorSetupRequest ─────────────────────────────────────────────────

/**
 * Creates a vendor setup request, generates intake token, and sends intake email to vendor.
 */
export const submitVendorSetupRequest = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      orgId: string;
      vendorName: string;
      vendorEmail: string;
      contactName: string;
      notes?: string;
    };
    const uid = await verifyOrgAccess(request, data.orgId);

    if (!data.vendorName?.trim()) {
      throw new HttpsError(
        "invalid-argument",
        "vendorName is required."
      );
    }
    if (!data.vendorEmail?.trim()) {
      throw new HttpsError(
        "invalid-argument",
        "vendorEmail is required."
      );
    }

    const userProfile = await getUserProfile(uid);
    if (!userProfile) {
      throw new HttpsError(
        "failed-precondition",
        "User profile not found."
      );
    }

    const db = admin.firestore();
    const now = nowTimestamp();

    // Generate intake token (30 days)
    const tokenValue = generateToken();
    const tokenExpiry = tokenExpiryDate(30 * 24);

    // Create vendor setup request
    const setupRef = db.collection(COLLECTION.VENDOR_SETUP_REQUESTS).doc();
    const setupData: Omit<VendorSetupRequest, "id"> = {
      orgId: data.orgId,
      tenantId: TENANT_ID,
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
    await db.collection(COLLECTION.TOKENS).doc(tokenValue).set({
      requestId: setupRef.id,
      orgId: data.orgId,
      tenantId: TENANT_ID,
      type: TOKEN_TYPE.VENDOR_INTAKE,
      used: false,
      expiresAt: admin.firestore.Timestamp.fromDate(tokenExpiry),
      createdAt: now,
    });

    const intakeUrl = `${BASE_URL}/vendor-intake?token=${tokenValue}`;

    const vendorSetupRequest: VendorSetupRequest = {
      id: setupRef.id,
      ...setupData,
    };

    await sendVendorIntakeEmail(vendorSetupRequest, tokenValue, intakeUrl);

    return {
      success: true,
      vendorSetupRequestId: setupRef.id,
      intakeUrl,
    };
  }
);

// ─── getPendingVendorSetupRequests ────────────────────────────────────────────

/**
 * Requires ADMIN or FINANCE role.
 * Returns all pending vendor setup requests for the org.
 */
export const getPendingVendorSetupRequests = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [
      ROLE.ADMIN,
      ROLE.FINANCE_PAYOR,
      ROLE.FINANCE_RECEIPTS_REVIEWER,
      ROLE.FINANCE_QB_ENTRY,
    ]);

    const db = admin.firestore();
    const snap = await db
      .collection(COLLECTION.VENDOR_SETUP_REQUESTS)
      .where("orgId", "==", data.orgId)
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
      .get();

    const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { requests };
  }
);

// ─── getVendorDashboards ──────────────────────────────────────────────────────

/**
 * Returns vendor setup requests for the current user, split by status.
 */
export const getVendorDashboards = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    const db = admin.firestore();

    const snap = await db
      .collection(COLLECTION.VENDOR_SETUP_REQUESTS)
      .where("orgId", "==", data.orgId)
      .where("requestorId", "==", uid)
      .orderBy("createdAt", "desc")
      .get();

    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<
      VendorSetupRequest & { id: string }
    >;

    const pending = all.filter((r) => r.status === "pending");
    const approved = all.filter((r) => r.status === "approved");
    const rejected = all.filter((r) => r.status === "rejected");

    return { pending, approved, rejected };
  }
);

// ─── getVendorSetupById ───────────────────────────────────────────────────────

/**
 * Returns a vendor setup request plus associated intake data.
 */
export const getVendorSetupById = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { vendorSetupRequestId: string; orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    const db = admin.firestore();

    const setupSnap = await db
      .collection(COLLECTION.VENDOR_SETUP_REQUESTS)
      .doc(data.vendorSetupRequestId)
      .get();

    if (!setupSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Vendor setup request not found."
      );
    }

    const setupRequest = {
      id: setupSnap.id,
      ...setupSnap.data(),
    } as VendorSetupRequest & { id: string };

    if (setupRequest.orgId !== data.orgId) {
      throw new HttpsError(
        "permission-denied",
        "You do not have access to this vendor setup request."
      );
    }

    // Fetch intake data if it exists
    const intakeSnap = await db
      .collection(COLLECTION.VENDOR_INTAKES)
      .where("vendorSetupRequestId", "==", data.vendorSetupRequestId)
      .limit(1)
      .get();

    const intake = intakeSnap.empty
      ? null
      : { id: intakeSnap.docs[0].id, ...intakeSnap.docs[0].data() };

    return { setupRequest, intake };
  }
);

// ─── approveVendorSetup ───────────────────────────────────────────────────────

/**
 * Requires ADMIN role. Creates vendor doc, marks setup request approved,
 * and sends approval email to requestor.
 */
export const approveVendorSetup = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { vendorSetupRequestId: string; orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    const setupRef = db
      .collection(COLLECTION.VENDOR_SETUP_REQUESTS)
      .doc(data.vendorSetupRequestId);
    const setupSnap = await setupRef.get();

    if (!setupSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Vendor setup request not found."
      );
    }

    const setupRequest = {
      id: setupSnap.id,
      ...setupSnap.data(),
    } as VendorSetupRequest & { id: string };

    if (setupRequest.orgId !== data.orgId) {
      throw new HttpsError(
        "permission-denied",
        "You do not have access to this vendor setup request."
      );
    }

    if (setupRequest.status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        `Cannot approve a request with status: ${setupRequest.status}`
      );
    }

    const now = nowTimestamp();
    const batch = db.batch();

    // Create vendor doc
    const vendorRef = db.collection(COLLECTION.VENDORS).doc();
    batch.set(vendorRef, {
      orgId: data.orgId,
      tenantId: TENANT_ID,
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

    await sendVendorApprovedEmail(setupRequest);

    return { success: true, vendorId: vendorRef.id };
  }
);

// ─── rejectVendorSetup ────────────────────────────────────────────────────────

/**
 * Requires ADMIN role. Marks vendor setup rejected and sends rejection email.
 */
export const rejectVendorSetup = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { vendorSetupRequestId: string; orgId: string; reason?: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    const setupRef = db
      .collection(COLLECTION.VENDOR_SETUP_REQUESTS)
      .doc(data.vendorSetupRequestId);
    const setupSnap = await setupRef.get();

    if (!setupSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Vendor setup request not found."
      );
    }

    const setupRequest = {
      id: setupSnap.id,
      ...setupSnap.data(),
    } as VendorSetupRequest & { id: string };

    if (setupRequest.orgId !== data.orgId) {
      throw new HttpsError(
        "permission-denied",
        "You do not have access to this vendor setup request."
      );
    }

    if (setupRequest.status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        `Cannot reject a request with status: ${setupRequest.status}`
      );
    }

    const now = nowTimestamp();

    await setupRef.update({
      status: "rejected",
      rejectedAt: now,
      rejectedBy: uid,
      rejectionReason: data.reason ?? "",
      updatedAt: now,
    });

    const rejectedSetupRequest: VendorSetupRequest = {
      ...setupRequest,
      status: "rejected",
      rejectionReason: data.reason ?? "",
    };

    await sendVendorRejectedEmail(rejectedSetupRequest);

    return { success: true };
  }
);

// ─── regenerateVendorIntakeLink ───────────────────────────────────────────────

/**
 * Creates a new intake token for a vendor setup request and resends the intake email.
 */
export const regenerateVendorIntakeLink = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { vendorSetupRequestId: string; orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    const setupRef = db
      .collection(COLLECTION.VENDOR_SETUP_REQUESTS)
      .doc(data.vendorSetupRequestId);
    const setupSnap = await setupRef.get();

    if (!setupSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Vendor setup request not found."
      );
    }

    const setupRequest = {
      id: setupSnap.id,
      ...setupSnap.data(),
    } as VendorSetupRequest & { id: string };

    if (setupRequest.orgId !== data.orgId) {
      throw new HttpsError(
        "permission-denied",
        "You do not have access to this vendor setup request."
      );
    }

    const now = nowTimestamp();
    const newTokenValue = generateToken();
    const tokenExpiry = tokenExpiryDate(30 * 24);

    // Create new token doc
    await db.collection(COLLECTION.TOKENS).doc(newTokenValue).set({
      requestId: data.vendorSetupRequestId,
      orgId: data.orgId,
      tenantId: TENANT_ID,
      type: TOKEN_TYPE.VENDOR_INTAKE,
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

    const intakeUrl = `${BASE_URL}/vendor-intake?token=${newTokenValue}`;

    const updatedSetupRequest: VendorSetupRequest = {
      ...setupRequest,
      intakeToken: newTokenValue,
    };

    await sendVendorIntakeEmail(updatedSetupRequest, newTokenValue, intakeUrl);

    return { success: true, intakeUrl };
  }
);

// ─── submitVendorIntake ───────────────────────────────────────────────────────

/**
 * PUBLIC — no auth required.
 * Vendor submits their W9/intake info via the token link.
 */
export const submitVendorIntake = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { token: string; intakeData: VendorIntakeInput };
    if (!data.token) {
      throw new HttpsError(
        "invalid-argument",
        "token is required."
      );
    }
    if (!data.intakeData) {
      throw new HttpsError(
        "invalid-argument",
        "intakeData is required."
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

    if (tokenDoc.type !== TOKEN_TYPE.VENDOR_INTAKE) {
      throw new HttpsError(
        "invalid-argument",
        "This token is not a vendor intake token."
      );
    }

    const vendorSetupRequestId = tokenDoc.requestId;

    // Validate required intake fields
    const required: (keyof VendorIntakeInput)[] = [
      "legalName",
      "taxId",
      "contactEmail",
      "contactName",
    ];
    for (const field of required) {
      if (!data.intakeData[field]) {
        throw new HttpsError(
          "invalid-argument",
          `${field} is required.`
        );
      }
    }

    const nowTs = admin.firestore.Timestamp.now();

    // Save vendor intake doc
    const intakeRef = db.collection(COLLECTION.VENDOR_INTAKES).doc();
    await intakeRef.set({
      vendorSetupRequestId,
      orgId: tokenDoc.orgId,
      tenantId: TENANT_ID,
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
  }
);

// ─── getVendorIntakeByToken ───────────────────────────────────────────────────

/**
 * PUBLIC — no auth required.
 * Returns vendor setup request info needed to render the intake form.
 */
export const getVendorIntakeByToken = onCall(
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

    if (tokenDoc.type !== TOKEN_TYPE.VENDOR_INTAKE) {
      throw new HttpsError(
        "invalid-argument",
        "This token is not a vendor intake token."
      );
    }

    const setupSnap = await db
      .collection(COLLECTION.VENDOR_SETUP_REQUESTS)
      .doc(tokenDoc.requestId)
      .get();

    if (!setupSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Vendor setup request not found."
      );
    }

    const setupRequest = { id: setupSnap.id, ...setupSnap.data() } as VendorSetupRequest & {
      id: string;
    };

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
  }
);
