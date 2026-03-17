import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { COLLECTION, FUNDS, ROLE, TENANT_ID } from "./constants";
import { nowTimestamp, requireRole, verifyAuth, verifyOrgAccess } from "./helpers";
import { AdminDept } from "./types";

// ─── getMinistryDepartmentsByOrg ──────────────────────────────────────────────

/**
 * Returns all ministry departments (adminDepts) for an org.
 * Available to any authenticated user with org access.
 */
export const getMinistryDepartmentsByOrg = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string };
    await verifyOrgAccess(request, data.orgId);
    const db = admin.firestore();

    const snap = await db
      .collection(COLLECTION.ADMIN_DEPTS)
      .where("orgId", "==", data.orgId)
      .orderBy("ministryDepartment", "asc")
      .get();

    const depts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { departments: depts };
  }
);

// ─── getApproverMapping ───────────────────────────────────────────────────────

/**
 * Returns approver info for a specific ministry department.
 * Queries by `ministryDepartment` first, falls back to `name` for old docs.
 */
export const getApproverMapping = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string; deptName: string };
    await verifyOrgAccess(request, data.orgId);
    const db = admin.firestore();

    // Try matching by `ministryDepartment` first
    let snap = await db
      .collection(COLLECTION.ADMIN_DEPTS)
      .where("orgId", "==", data.orgId)
      .where("ministryDepartment", "==", data.deptName)
      .limit(1)
      .get();

    // If not found, try matching by `name` for old docs
    if (snap.empty) {
      snap = await db
        .collection(COLLECTION.ADMIN_DEPTS)
        .where("orgId", "==", data.orgId)
        .where("name", "==", data.deptName)
        .limit(1)
        .get();
    }

    if (snap.empty) {
      return { approver: null };
    }

    const dept = { id: snap.docs[0].id, ...snap.docs[0].data() } as AdminDept;
    return {
      approver: {
        approverId: dept.approverId,
        approverEmail: dept.approverEmail,
        approverName: dept.approverName,
      },
    };
  }
);

// ─── getFundsForOrg ───────────────────────────────────────────────────────────

/**
 * Returns the funds list for an org (hardcoded global list).
 */
export const getFundsForOrg = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string };
    await verifyOrgAccess(request, data.orgId);
    return { funds: FUNDS };
  }
);

// ─── adminListDepartments ─────────────────────────────────────────────────────

/**
 * Requires ADMIN role. Returns all departments for the org with full metadata.
 * Returns all — let the frontend filter by active field.
 */
export const adminListDepartments = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    const snap = await db
      .collection(COLLECTION.ADMIN_DEPTS)
      .where("orgId", "==", data.orgId)
      .get();

    const depts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { departments: depts };
  }
);

// ─── adminUpsertDepartment ────────────────────────────────────────────────────

/**
 * Requires ADMIN role. Creates or updates a ministry department.
 * Uses `ministryDepartment` field. Sets both orgId and organizationId on write.
 */
export const adminUpsertDepartment = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      orgId: string;
      dept: {
        id?: string;
        ministryDepartment: string;
        approverId?: string;
        approverEmail: string;
        approverName?: string;
        active?: boolean;
      };
    };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const resolvedName = (data.dept?.ministryDepartment || "").trim();
    if (!resolvedName) {
      throw new HttpsError(
        "invalid-argument",
        "ministryDepartment is required."
      );
    }

    const db = admin.firestore();
    const now = nowTimestamp();

    if (data.dept.id) {
      // Update existing
      const ref = db.collection(COLLECTION.ADMIN_DEPTS).doc(data.dept.id);
      const snap = await ref.get();

      if (!snap.exists || snap.data()?.orgId !== data.orgId) {
        throw new HttpsError(
          "not-found",
          "Department not found."
        );
      }

      const updatePayload: Record<string, any> = {
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
    } else {
      // Create new — set both orgId and organizationId
      const newRef = db.collection(COLLECTION.ADMIN_DEPTS).doc();
      await newRef.set({
        orgId: data.orgId,
        organizationId: data.orgId,
        tenantId: TENANT_ID,
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
  }
);

// ─── adminDeactivateDepartment ────────────────────────────────────────────────

/**
 * Requires ADMIN role. Sets a ministry department active to false.
 */
export const adminDeactivateDepartment = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string; deptId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    if (!data.deptId) {
      throw new HttpsError(
        "invalid-argument",
        "deptId is required."
      );
    }

    const db = admin.firestore();
    const ref = db.collection(COLLECTION.ADMIN_DEPTS).doc(data.deptId);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new HttpsError(
        "not-found",
        "Department not found."
      );
    }

    if (snap.data()?.orgId !== data.orgId) {
      throw new HttpsError(
        "permission-denied",
        "This department does not belong to your organization."
      );
    }

    await ref.update({ active: false, updatedAt: nowTimestamp() });

    return { success: true };
  }
);

// ─── adminReactivateDepartment ────────────────────────────────────────────────

/**
 * Requires ADMIN role. Sets a ministry department active to true.
 */
export const adminReactivateDepartment = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string; deptId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    if (!data.deptId) {
      throw new HttpsError(
        "invalid-argument",
        "deptId is required."
      );
    }

    const db = admin.firestore();
    const ref = db.collection(COLLECTION.ADMIN_DEPTS).doc(data.deptId);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new HttpsError(
        "not-found",
        "Department not found."
      );
    }

    if (snap.data()?.orgId !== data.orgId) {
      throw new HttpsError(
        "permission-denied",
        "This department does not belong to your organization."
      );
    }

    await ref.update({ active: true, updatedAt: nowTimestamp() });

    return { success: true };
  }
);
