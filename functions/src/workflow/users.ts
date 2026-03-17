import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { COLLECTION, ROLE, TENANT_ID } from "./constants";
import { nowTimestamp, requireRole, verifyAuth, verifyOrgAccess } from "./helpers";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

const VALID_ROLES: string[] = Object.values(ROLE);

function isValidRole(role: string): boolean {
  return VALID_ROLES.includes(role);
}

async function writeAuditLog(
  db: admin.firestore.Firestore,
  actionType: string,
  collectionName: string,
  recordId: string,
  orgId: string,
  performedBy: string,
  performedByEmail: string,
  payload: Record<string, unknown>
): Promise<void> {
  await db.collection(COLLECTION.ADMIN_AUDIT_LOGS).add({
    actionType,
    collectionName,
    recordId,
    orgId,
    performedBy,
    performedByEmail,
    payload,
    timestamp: nowTimestamp(),
  });
}

async function getCallerEmail(uid: string): Promise<string> {
  try {
    const userRecord = await admin.auth().getUser(uid);
    return userRecord.email ?? "";
  } catch {
    return "";
  }
}

// ─── Bootstrap admins ────────────────────────────────────────────────────────
// Hardcoded admins that are auto-provisioned on first login even if no
// Firestore record exists yet. Remove an entry once the user is in Firestore.

const BOOTSTRAP_ADMINS: Record<string, { name: string; orgId: string }> = {
  "deboijiwola@thecitylight.org": { name: "Debo Ijiwola", orgId: "org_citylight" },
};

// ─── resolveGoogleLogin ───────────────────────────────────────────────────────
// Called on first Google Sign-In to provision the UID-keyed Firestore doc.
// Idempotent: safe to call even when the doc already exists.

export const resolveGoogleLogin = onCall(
  async (request: CallableRequest) => {
    const uid = verifyAuth(request);
    const db = admin.firestore();

    // Fast path: UID-keyed doc already exists (returning user)
    const uidDoc = await db.collection(COLLECTION.USERS).doc(uid).get();
    if (uidDoc.exists) {
      const data = uidDoc.data()!;
      if (data.active === false) {
        throw new HttpsError(
          "permission-denied",
          "Your account has been deactivated. Contact your administrator."
        );
      }
      return { success: true };
    }

    // Get caller's email from Firebase Auth
    let email: string | undefined;
    try {
      const userRecord = await admin.auth().getUser(uid);
      email = userRecord.email;
    } catch (err) {
      logger.error("resolveGoogleLogin: failed to fetch auth user", err);
      throw new HttpsError("internal", "Failed to retrieve your account information.");
    }

    if (!email) {
      throw new HttpsError("invalid-argument", "Your Google account has no email address.");
    }

    const emailNormalized = email.toLowerCase();

    // Look up pre-created user record — try lowercase match first, then original
    let emailDoc: admin.firestore.QueryDocumentSnapshot | null = null;

    const tryQuery = async (emailVal: string) => {
      const snap = await db
        .collection(COLLECTION.USERS)
        .where("email", "==", emailVal)
        .limit(1)
        .get();
      return snap.empty ? null : snap.docs[0];
    };

    emailDoc = await tryQuery(emailNormalized);
    if (!emailDoc && emailNormalized !== email) {
      emailDoc = await tryQuery(email);
    }

    if (!emailDoc) {
      // Check bootstrap admin list (hardcoded fallback for initial setup)
      const bootstrap = BOOTSTRAP_ADMINS[emailNormalized];
      if (bootstrap) {
        const profileData = {
          userId: uid,
          name: bootstrap.name,
          email: emailNormalized,
          orgId: bootstrap.orgId,
          tenantId: TENANT_ID,
          role: ROLE.ADMIN,
          ministryDepartment: "",
          active: true,
          createdAt: nowTimestamp(),
          updatedAt: nowTimestamp(),
        };
        await db.collection(COLLECTION.USERS).doc(uid).set(profileData);
        logger.info(`resolveGoogleLogin: bootstrap admin provisioned — ${emailNormalized}`);
        return { success: true };
      }

      throw new HttpsError(
        "not-found",
        "Access not granted. Please contact your administrator."
      );
    }

    const userData = emailDoc.data();

    if (userData.active === false) {
      throw new HttpsError(
        "permission-denied",
        "Your account has been deactivated. Contact your administrator."
      );
    }

    // Create UID-keyed doc (the definitive doc going forward)
    await db.collection(COLLECTION.USERS).doc(uid).set({
      ...userData,
      userId: uid,
      email: emailNormalized,   // normalize email on first login
      updatedAt: nowTimestamp(),
    });

    // Delete the old email-keyed doc so it doesn't linger
    if (emailDoc.id !== uid) {
      await emailDoc.ref.delete();
    }

    return { success: true };
  }
);

// ─── adminCreateUser ──────────────────────────────────────────────────────────
// Creates a Firestore user record keyed by email (no Firebase Auth account).
// The UID-keyed doc is created automatically when the user first signs in
// with Google via resolveGoogleLogin.

export const adminCreateUser = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      orgId: string;
      name: string;
      email: string;
      role: string;
      ministryDepartment?: string;
    };
    const callerUid = await verifyOrgAccess(request, data.orgId);
    await requireRole(callerUid, data.orgId, [ROLE.ADMIN]);

    if (!data.name || !data.name.trim()) {
      throw new HttpsError("invalid-argument", "Name is required.");
    }
    if (!data.email || !data.email.trim()) {
      throw new HttpsError("invalid-argument", "Email is required.");
    }
    if (!isValidEmail(data.email)) {
      throw new HttpsError("invalid-argument", "Email format is invalid.");
    }
    if (!data.role || !isValidRole(data.role)) {
      throw new HttpsError(
        "invalid-argument",
        `Role must be one of: ${VALID_ROLES.join(", ")}`
      );
    }

    const db = admin.firestore();

    // Check if email already exists in this org (by email field query)
    const existingSnap = await db
      .collection(COLLECTION.USERS)
      .where("email", "==", data.email)
      .where("orgId", "==", data.orgId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      throw new HttpsError(
        "already-exists",
        "A user with this email already exists in this organization."
      );
    }

    // Store with email as the doc ID — resolveGoogleLogin will migrate to UID on first login
    const emailDocId = data.email.toLowerCase();
    await db.collection(COLLECTION.USERS).doc(emailDocId).set({
      userId: emailDocId,
      name: data.name,
      email: data.email,
      orgId: data.orgId,
      tenantId: TENANT_ID,
      role: data.role,
      ministryDepartment: data.ministryDepartment || "",
      active: true,
      createdAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    });

    // Send welcome email
    await db.collection(COLLECTION.MAIL).add({
      to: [data.email],
      message: {
        subject: "You've been added to Expense Workflow",
        html: `<p>Hi ${data.name},</p>
               <p>Your account has been created in the Expense Workflow system.</p>
               <p>Sign in using your Google account (${data.email}) at your organization's Expense Workflow portal.</p>`,
      },
    });

    const callerEmail = await getCallerEmail(callerUid);
    await writeAuditLog(
      db,
      "CREATE_USER",
      COLLECTION.USERS,
      emailDocId,
      data.orgId,
      callerUid,
      callerEmail,
      { name: data.name, email: data.email, role: data.role, orgId: data.orgId }
    );

    return { success: true, userId: emailDocId };
  }
);

// ─── adminListUsers ───────────────────────────────────────────────────────────

export const adminListUsers = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string };
    const callerUid = await verifyOrgAccess(request, data.orgId);
    await requireRole(callerUid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    const snap = await db
      .collection(COLLECTION.USERS)
      .where("orgId", "==", data.orgId)
      .orderBy("name")
      .get();

    const users = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return { users };
  }
);

// ─── adminUpdateUser ──────────────────────────────────────────────────────────

export const adminUpdateUser = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      orgId: string;
      userId: string;
      name: string;
      role: string;
      ministryDepartment: string;
      active: boolean;
    };
    const callerUid = await verifyOrgAccess(request, data.orgId);
    await requireRole(callerUid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    const userRef = db.collection(COLLECTION.USERS).doc(data.userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User not found.");
    }

    const userData = userSnap.data()!;
    if (userData.orgId !== data.orgId) {
      throw new HttpsError("permission-denied", "User does not belong to this organization.");
    }

    await userRef.update({
      name: data.name,
      role: data.role,
      ministryDepartment: data.ministryDepartment,
      active: data.active,
      updatedAt: nowTimestamp(),
    });

    const callerEmail = await getCallerEmail(callerUid);
    await writeAuditLog(
      db,
      "UPDATE_USER",
      COLLECTION.USERS,
      data.userId,
      data.orgId,
      callerUid,
      callerEmail,
      { name: data.name, role: data.role, ministryDepartment: data.ministryDepartment, active: data.active }
    );

    return { success: true };
  }
);

// ─── adminSetUserStatus ───────────────────────────────────────────────────────

export const adminSetUserStatus = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string; userId: string; active: boolean };
    const callerUid = await verifyOrgAccess(request, data.orgId);
    await requireRole(callerUid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    const userRef = db.collection(COLLECTION.USERS).doc(data.userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User not found.");
    }

    const userData = userSnap.data()!;
    if (userData.orgId !== data.orgId) {
      throw new HttpsError("permission-denied", "User does not belong to this organization.");
    }

    await userRef.update({
      active: data.active,
      updatedAt: nowTimestamp(),
    });

    const callerEmail = await getCallerEmail(callerUid);
    await writeAuditLog(
      db,
      "SET_USER_STATUS",
      COLLECTION.USERS,
      data.userId,
      data.orgId,
      callerUid,
      callerEmail,
      { active: data.active }
    );

    return { success: true };
  }
);

// ─── adminResendWelcomeEmail ──────────────────────────────────────────────────

export const adminResendWelcomeEmail = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string; userId: string };
    const callerUid = await verifyOrgAccess(request, data.orgId);
    await requireRole(callerUid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    const userSnap = await db.collection(COLLECTION.USERS).doc(data.userId).get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User not found.");
    }

    const userData = userSnap.data()!;
    if (userData.orgId !== data.orgId) {
      throw new HttpsError("permission-denied", "User does not belong to this organization.");
    }

    const email: string = userData.email;
    const name: string = userData.name;

    await db.collection(COLLECTION.MAIL).add({
      to: [email],
      message: {
        subject: "You've been added to Expense Workflow",
        html: `<p>Hi ${name},</p>
               <p>Your account is set up in the Expense Workflow system.</p>
               <p>Sign in using your Google account (${email}) at your organization's Expense Workflow portal.</p>`,
      },
    });

    return { success: true };
  }
);

// ─── adminBulkImportUsers ─────────────────────────────────────────────────────

export const adminBulkImportUsers = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      orgId: string;
      rows: Array<{
        name: string;
        email: string;
        role: string;
        ministryDepartment?: string;
        active?: string | boolean;
      }>;
    };
    const callerUid = await verifyOrgAccess(request, data.orgId);
    await requireRole(callerUid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    const callerEmail = await getCallerEmail(callerUid);

    let created = 0;
    let updated = 0;
    const errors: Array<{ row: number; email: string; error: string }> = [];

    const seenEmails = new Set<string>();

    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      const rowNum = i + 1;

      if (!row.name || !row.name.trim()) {
        errors.push({ row: rowNum, email: row.email || "", error: "Name is required." });
        continue;
      }
      if (!row.email || !row.email.trim()) {
        errors.push({ row: rowNum, email: "", error: "Email is required." });
        continue;
      }
      if (!isValidEmail(row.email)) {
        errors.push({ row: rowNum, email: row.email, error: "Invalid email format." });
        continue;
      }
      if (!row.role || !isValidRole(row.role)) {
        errors.push({
          row: rowNum,
          email: row.email,
          error: `Role must be one of: ${VALID_ROLES.join(", ")}`,
        });
        continue;
      }

      const emailLower = row.email.toLowerCase();
      if (seenEmails.has(emailLower)) {
        errors.push({ row: rowNum, email: row.email, error: "Duplicate email within import rows." });
        continue;
      }
      seenEmails.add(emailLower);

      // Parse active: CSV sends strings "true"/"false"
      const isActive = String(row.active ?? "true").toLowerCase() !== "false";

      try {
        // Check if user already exists for this org (by email field)
        const existingSnap = await db
          .collection(COLLECTION.USERS)
          .where("email", "==", row.email)
          .where("orgId", "==", data.orgId)
          .limit(1)
          .get();

        if (!existingSnap.empty) {
          const existingDoc = existingSnap.docs[0];

          await existingDoc.ref.update({
            name: row.name,
            role: row.role,
            ministryDepartment: row.ministryDepartment || "",
            active: isActive,
            updatedAt: nowTimestamp(),
          });

          await writeAuditLog(
            db,
            "BULK_UPDATE_USER",
            COLLECTION.USERS,
            existingDoc.id,
            data.orgId,
            callerUid,
            callerEmail,
            { name: row.name, email: row.email, role: row.role, active: isActive }
          );

          updated++;
        } else {
          // Create new user keyed by email
          await db.collection(COLLECTION.USERS).doc(emailLower).set({
            userId: emailLower,
            name: row.name,
            email: row.email,
            orgId: data.orgId,
            tenantId: TENANT_ID,
            role: row.role,
            ministryDepartment: row.ministryDepartment || "",
            active: isActive,
            createdAt: nowTimestamp(),
            updatedAt: nowTimestamp(),
          });

          await writeAuditLog(
            db,
            "BULK_CREATE_USER",
            COLLECTION.USERS,
            emailLower,
            data.orgId,
            callerUid,
            callerEmail,
            { name: row.name, email: row.email, role: row.role, active: isActive }
          );

          created++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push({ row: rowNum, email: row.email, error: message });
      }
    }

    return { created, updated, errors };
  }
);
