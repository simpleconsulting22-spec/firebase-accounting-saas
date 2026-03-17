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
exports.adminReactivateDepartment = exports.adminDeactivateDepartment = exports.adminUpsertDepartment = exports.adminListDepartments = exports.getFundsForOrg = exports.getApproverMapping = exports.getMinistryDepartmentsByOrg = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const constants_1 = require("./constants");
const helpers_1 = require("./helpers");
// ─── getMinistryDepartmentsByOrg ──────────────────────────────────────────────
/**
 * Returns all ministry departments (adminDepts) for an org.
 * Available to any authenticated user with org access.
 */
exports.getMinistryDepartmentsByOrg = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    const db = admin.firestore();
    const snap = await db
        .collection(constants_1.COLLECTION.ADMIN_DEPTS)
        .where("orgId", "==", data.orgId)
        .orderBy("ministryDepartment", "asc")
        .get();
    const depts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { departments: depts };
});
// ─── getApproverMapping ───────────────────────────────────────────────────────
/**
 * Returns approver info for a specific ministry department.
 * Queries by `ministryDepartment` first, falls back to `name` for old docs.
 */
exports.getApproverMapping = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    const db = admin.firestore();
    // Try matching by `ministryDepartment` first
    let snap = await db
        .collection(constants_1.COLLECTION.ADMIN_DEPTS)
        .where("orgId", "==", data.orgId)
        .where("ministryDepartment", "==", data.deptName)
        .limit(1)
        .get();
    // If not found, try matching by `name` for old docs
    if (snap.empty) {
        snap = await db
            .collection(constants_1.COLLECTION.ADMIN_DEPTS)
            .where("orgId", "==", data.orgId)
            .where("name", "==", data.deptName)
            .limit(1)
            .get();
    }
    if (snap.empty) {
        return { approver: null };
    }
    const dept = { id: snap.docs[0].id, ...snap.docs[0].data() };
    return {
        approver: {
            approverId: dept.approverId,
            approverEmail: dept.approverEmail,
            approverName: dept.approverName,
        },
    };
});
// ─── getFundsForOrg ───────────────────────────────────────────────────────────
/**
 * Returns the funds list for an org (hardcoded global list).
 */
exports.getFundsForOrg = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    return { funds: constants_1.FUNDS };
});
// ─── adminListDepartments ─────────────────────────────────────────────────────
/**
 * Requires ADMIN role. Returns all departments for the org with full metadata.
 * Returns all — let the frontend filter by active field.
 */
exports.adminListDepartments = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    const snap = await db
        .collection(constants_1.COLLECTION.ADMIN_DEPTS)
        .where("orgId", "==", data.orgId)
        .get();
    const depts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { departments: depts };
});
// ─── adminUpsertDepartment ────────────────────────────────────────────────────
/**
 * Requires ADMIN role. Creates or updates a ministry department.
 * Uses `ministryDepartment` field. Sets both orgId and organizationId on write.
 */
exports.adminUpsertDepartment = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const resolvedName = (data.dept?.ministryDepartment || "").trim();
    if (!resolvedName) {
        throw new https_1.HttpsError("invalid-argument", "ministryDepartment is required.");
    }
    const db = admin.firestore();
    const now = (0, helpers_1.nowTimestamp)();
    if (data.dept.id) {
        // Update existing
        const ref = db.collection(constants_1.COLLECTION.ADMIN_DEPTS).doc(data.dept.id);
        const snap = await ref.get();
        if (!snap.exists || snap.data()?.orgId !== data.orgId) {
            throw new https_1.HttpsError("not-found", "Department not found.");
        }
        const updatePayload = {
            ministryDepartment: resolvedName,
            approverEmail: data.dept.approverEmail,
            approverName: data.dept.approverName ?? "",
            updatedAt: now,
        };
        if (data.dept.approverId !== undefined) {
            updatePayload.approverId = data.dept.approverId;
        }
        if (data.dept.active !== undefined) {
            updatePayload.active = data.dept.active;
        }
        await ref.update(updatePayload);
        return { success: true, deptId: data.dept.id };
    }
    else {
        // Create new — set both orgId and organizationId
        const newRef = db.collection(constants_1.COLLECTION.ADMIN_DEPTS).doc();
        await newRef.set({
            orgId: data.orgId,
            organizationId: data.orgId,
            tenantId: constants_1.TENANT_ID,
            ministryDepartment: resolvedName,
            approverId: data.dept.approverId ?? "",
            approverEmail: data.dept.approverEmail,
            approverName: data.dept.approverName ?? "",
            active: data.dept.active !== undefined ? data.dept.active : true,
            createdAt: now,
            updatedAt: now,
        });
        return { success: true, deptId: newRef.id };
    }
});
// ─── adminDeactivateDepartment ────────────────────────────────────────────────
/**
 * Requires ADMIN role. Sets a ministry department active to false.
 */
exports.adminDeactivateDepartment = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    if (!data.deptId) {
        throw new https_1.HttpsError("invalid-argument", "deptId is required.");
    }
    const db = admin.firestore();
    const ref = db.collection(constants_1.COLLECTION.ADMIN_DEPTS).doc(data.deptId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "Department not found.");
    }
    if (snap.data()?.orgId !== data.orgId) {
        throw new https_1.HttpsError("permission-denied", "This department does not belong to your organization.");
    }
    await ref.update({ active: false, updatedAt: (0, helpers_1.nowTimestamp)() });
    return { success: true };
});
// ─── adminReactivateDepartment ────────────────────────────────────────────────
/**
 * Requires ADMIN role. Sets a ministry department active to true.
 */
exports.adminReactivateDepartment = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    if (!data.deptId) {
        throw new https_1.HttpsError("invalid-argument", "deptId is required.");
    }
    const db = admin.firestore();
    const ref = db.collection(constants_1.COLLECTION.ADMIN_DEPTS).doc(data.deptId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "Department not found.");
    }
    if (snap.data()?.orgId !== data.orgId) {
        throw new https_1.HttpsError("permission-denied", "This department does not belong to your organization.");
    }
    await ref.update({ active: true, updatedAt: (0, helpers_1.nowTimestamp)() });
    return { success: true };
});
