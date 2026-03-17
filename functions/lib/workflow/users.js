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
exports.adminBulkImportUsers = exports.adminResendWelcomeEmail = exports.adminSetUserStatus = exports.adminUpdateUser = exports.adminListUsers = exports.adminCreateUser = exports.resolveGoogleLogin = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const constants_1 = require("./constants");
const helpers_1 = require("./helpers");
// ─── Helpers ──────────────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email) {
    return EMAIL_REGEX.test(email);
}
const VALID_ROLES = Object.values(constants_1.ROLE);
function isValidRole(role) {
    return VALID_ROLES.includes(role);
}
async function writeAuditLog(db, actionType, collectionName, recordId, orgId, performedBy, performedByEmail, payload) {
    await db.collection(constants_1.COLLECTION.ADMIN_AUDIT_LOGS).add({
        actionType,
        collectionName,
        recordId,
        orgId,
        performedBy,
        performedByEmail,
        payload,
        timestamp: (0, helpers_1.nowTimestamp)(),
    });
}
async function getCallerEmail(uid) {
    try {
        const userRecord = await admin.auth().getUser(uid);
        return userRecord.email ?? "";
    }
    catch {
        return "";
    }
}
// ─── Bootstrap admins ────────────────────────────────────────────────────────
// Hardcoded admins that are auto-provisioned on first login even if no
// Firestore record exists yet. Remove an entry once the user is in Firestore.
const BOOTSTRAP_ADMINS = {
    "deboijiwola@thecitylight.org": { name: "Debo Ijiwola", orgId: "org_citylight" },
};
// ─── resolveGoogleLogin ───────────────────────────────────────────────────────
// Called on first Google Sign-In to provision the UID-keyed Firestore doc.
// Idempotent: safe to call even when the doc already exists.
exports.resolveGoogleLogin = (0, https_1.onCall)(async (request) => {
    const uid = (0, helpers_1.verifyAuth)(request);
    const db = admin.firestore();
    // Fast path: UID-keyed doc already exists (returning user)
    const uidDoc = await db.collection(constants_1.COLLECTION.USERS).doc(uid).get();
    if (uidDoc.exists) {
        const data = uidDoc.data();
        if (data.active === false) {
            throw new https_1.HttpsError("permission-denied", "Your account has been deactivated. Contact your administrator.");
        }
        return { success: true };
    }
    // Get caller's email from Firebase Auth
    let email;
    try {
        const userRecord = await admin.auth().getUser(uid);
        email = userRecord.email;
    }
    catch (err) {
        v2_1.logger.error("resolveGoogleLogin: failed to fetch auth user", err);
        throw new https_1.HttpsError("internal", "Failed to retrieve your account information.");
    }
    if (!email) {
        throw new https_1.HttpsError("invalid-argument", "Your Google account has no email address.");
    }
    const emailNormalized = email.toLowerCase();
    // Look up pre-created user record — try lowercase match first, then original
    let emailDoc = null;
    const tryQuery = async (emailVal) => {
        const snap = await db
            .collection(constants_1.COLLECTION.USERS)
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
                tenantId: constants_1.TENANT_ID,
                role: constants_1.ROLE.ADMIN,
                ministryDepartment: "",
                active: true,
                createdAt: (0, helpers_1.nowTimestamp)(),
                updatedAt: (0, helpers_1.nowTimestamp)(),
            };
            await db.collection(constants_1.COLLECTION.USERS).doc(uid).set(profileData);
            v2_1.logger.info(`resolveGoogleLogin: bootstrap admin provisioned — ${emailNormalized}`);
            return { success: true };
        }
        throw new https_1.HttpsError("not-found", "Access not granted. Please contact your administrator.");
    }
    const userData = emailDoc.data();
    if (userData.active === false) {
        throw new https_1.HttpsError("permission-denied", "Your account has been deactivated. Contact your administrator.");
    }
    // Create UID-keyed doc (the definitive doc going forward)
    await db.collection(constants_1.COLLECTION.USERS).doc(uid).set({
        ...userData,
        userId: uid,
        email: emailNormalized, // normalize email on first login
        updatedAt: (0, helpers_1.nowTimestamp)(),
    });
    // Delete the old email-keyed doc so it doesn't linger
    if (emailDoc.id !== uid) {
        await emailDoc.ref.delete();
    }
    return { success: true };
});
// ─── adminCreateUser ──────────────────────────────────────────────────────────
// Creates a Firestore user record keyed by email (no Firebase Auth account).
// The UID-keyed doc is created automatically when the user first signs in
// with Google via resolveGoogleLogin.
exports.adminCreateUser = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const callerUid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(callerUid, data.orgId, [constants_1.ROLE.ADMIN]);
    if (!data.name || !data.name.trim()) {
        throw new https_1.HttpsError("invalid-argument", "Name is required.");
    }
    if (!data.email || !data.email.trim()) {
        throw new https_1.HttpsError("invalid-argument", "Email is required.");
    }
    if (!isValidEmail(data.email)) {
        throw new https_1.HttpsError("invalid-argument", "Email format is invalid.");
    }
    if (!data.role || !isValidRole(data.role)) {
        throw new https_1.HttpsError("invalid-argument", `Role must be one of: ${VALID_ROLES.join(", ")}`);
    }
    const db = admin.firestore();
    // Check if email already exists in this org (by email field query)
    const existingSnap = await db
        .collection(constants_1.COLLECTION.USERS)
        .where("email", "==", data.email)
        .where("orgId", "==", data.orgId)
        .limit(1)
        .get();
    if (!existingSnap.empty) {
        throw new https_1.HttpsError("already-exists", "A user with this email already exists in this organization.");
    }
    // Store with email as the doc ID — resolveGoogleLogin will migrate to UID on first login
    const emailDocId = data.email.toLowerCase();
    await db.collection(constants_1.COLLECTION.USERS).doc(emailDocId).set({
        userId: emailDocId,
        name: data.name,
        email: data.email,
        orgId: data.orgId,
        tenantId: constants_1.TENANT_ID,
        role: data.role,
        ministryDepartment: data.ministryDepartment || "",
        active: true,
        createdAt: (0, helpers_1.nowTimestamp)(),
        updatedAt: (0, helpers_1.nowTimestamp)(),
    });
    // Send welcome email
    await db.collection(constants_1.COLLECTION.MAIL).add({
        to: [data.email],
        message: {
            subject: "You've been added to Expense Workflow",
            html: `<p>Hi ${data.name},</p>
               <p>Your account has been created in the Expense Workflow system.</p>
               <p>Sign in using your Google account (${data.email}) at your organization's Expense Workflow portal.</p>`,
        },
    });
    const callerEmail = await getCallerEmail(callerUid);
    await writeAuditLog(db, "CREATE_USER", constants_1.COLLECTION.USERS, emailDocId, data.orgId, callerUid, callerEmail, { name: data.name, email: data.email, role: data.role, orgId: data.orgId });
    return { success: true, userId: emailDocId };
});
// ─── adminListUsers ───────────────────────────────────────────────────────────
exports.adminListUsers = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const callerUid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(callerUid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    const snap = await db
        .collection(constants_1.COLLECTION.USERS)
        .where("orgId", "==", data.orgId)
        .orderBy("name")
        .get();
    const users = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return { users };
});
// ─── adminUpdateUser ──────────────────────────────────────────────────────────
exports.adminUpdateUser = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const callerUid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(callerUid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    const userRef = db.collection(constants_1.COLLECTION.USERS).doc(data.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError("not-found", "User not found.");
    }
    const userData = userSnap.data();
    if (userData.orgId !== data.orgId) {
        throw new https_1.HttpsError("permission-denied", "User does not belong to this organization.");
    }
    await userRef.update({
        name: data.name,
        role: data.role,
        ministryDepartment: data.ministryDepartment,
        active: data.active,
        updatedAt: (0, helpers_1.nowTimestamp)(),
    });
    const callerEmail = await getCallerEmail(callerUid);
    await writeAuditLog(db, "UPDATE_USER", constants_1.COLLECTION.USERS, data.userId, data.orgId, callerUid, callerEmail, { name: data.name, role: data.role, ministryDepartment: data.ministryDepartment, active: data.active });
    return { success: true };
});
// ─── adminSetUserStatus ───────────────────────────────────────────────────────
exports.adminSetUserStatus = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const callerUid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(callerUid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    const userRef = db.collection(constants_1.COLLECTION.USERS).doc(data.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError("not-found", "User not found.");
    }
    const userData = userSnap.data();
    if (userData.orgId !== data.orgId) {
        throw new https_1.HttpsError("permission-denied", "User does not belong to this organization.");
    }
    await userRef.update({
        active: data.active,
        updatedAt: (0, helpers_1.nowTimestamp)(),
    });
    const callerEmail = await getCallerEmail(callerUid);
    await writeAuditLog(db, "SET_USER_STATUS", constants_1.COLLECTION.USERS, data.userId, data.orgId, callerUid, callerEmail, { active: data.active });
    return { success: true };
});
// ─── adminResendWelcomeEmail ──────────────────────────────────────────────────
exports.adminResendWelcomeEmail = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const callerUid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(callerUid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    const userSnap = await db.collection(constants_1.COLLECTION.USERS).doc(data.userId).get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError("not-found", "User not found.");
    }
    const userData = userSnap.data();
    if (userData.orgId !== data.orgId) {
        throw new https_1.HttpsError("permission-denied", "User does not belong to this organization.");
    }
    const email = userData.email;
    const name = userData.name;
    await db.collection(constants_1.COLLECTION.MAIL).add({
        to: [email],
        message: {
            subject: "You've been added to Expense Workflow",
            html: `<p>Hi ${name},</p>
               <p>Your account is set up in the Expense Workflow system.</p>
               <p>Sign in using your Google account (${email}) at your organization's Expense Workflow portal.</p>`,
        },
    });
    return { success: true };
});
// ─── adminBulkImportUsers ─────────────────────────────────────────────────────
exports.adminBulkImportUsers = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const callerUid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(callerUid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    const callerEmail = await getCallerEmail(callerUid);
    let created = 0;
    let updated = 0;
    const errors = [];
    const seenEmails = new Set();
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
                .collection(constants_1.COLLECTION.USERS)
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
                    updatedAt: (0, helpers_1.nowTimestamp)(),
                });
                await writeAuditLog(db, "BULK_UPDATE_USER", constants_1.COLLECTION.USERS, existingDoc.id, data.orgId, callerUid, callerEmail, { name: row.name, email: row.email, role: row.role, active: isActive });
                updated++;
            }
            else {
                // Create new user keyed by email
                await db.collection(constants_1.COLLECTION.USERS).doc(emailLower).set({
                    userId: emailLower,
                    name: row.name,
                    email: row.email,
                    orgId: data.orgId,
                    tenantId: constants_1.TENANT_ID,
                    role: row.role,
                    ministryDepartment: row.ministryDepartment || "",
                    active: isActive,
                    createdAt: (0, helpers_1.nowTimestamp)(),
                    updatedAt: (0, helpers_1.nowTimestamp)(),
                });
                await writeAuditLog(db, "BULK_CREATE_USER", constants_1.COLLECTION.USERS, emailLower, data.orgId, callerUid, callerEmail, { name: row.name, email: row.email, role: row.role, active: isActive });
                created++;
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            errors.push({ row: rowNum, email: row.email, error: message });
        }
    }
    return { created, updated, errors };
});
