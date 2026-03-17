import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { COLLECTION, ROLE, TENANT_ID } from "./constants";
import { nowTimestamp, requireRole, verifyOrgAccess } from "./helpers";

// ─── Audit Log Helper ─────────────────────────────────────────────────────────

async function writeAuditLog(params: {
  actionType: string;
  collectionName: string;
  recordId: string;
  orgId: string;
  performedBy: string;
  performedByEmail: string;
  payload?: Record<string, any>;
}): Promise<void> {
  const db = admin.firestore();
  await db.collection(COLLECTION.ADMIN_AUDIT_LOGS).add({
    actionType: params.actionType,
    collectionName: params.collectionName,
    recordId: params.recordId,
    orgId: params.orgId,
    performedBy: params.performedBy,
    performedByEmail: params.performedByEmail,
    payload: params.payload ?? {},
    timestamp: nowTimestamp(),
  });
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValid4DigitYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1000 && year <= 9999;
}

function parseBool(val: string | undefined): boolean {
  if (val === undefined || val === null) return false;
  const v = String(val).trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

const VALID_ROLES = [
  "ADMIN",
  "FINANCE_PAYOR",
  "FINANCE_NOTIFY",
  "FINANCE_RECEIPTS_REVIEWER",
  "FINANCE_QB_ENTRY",
];

// ─── Batch helper (max 500 ops per Firestore batch) ───────────────────────────

type BatchOp =
  | { type: "set"; ref: FirebaseFirestore.DocumentReference; data: Record<string, any> }
  | { type: "update"; ref: FirebaseFirestore.DocumentReference; data: Record<string, any> };

async function commitInChunks(
  db: FirebaseFirestore.Firestore,
  ops: BatchOp[]
): Promise<void> {
  const CHUNK_SIZE = 499;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();
    for (const op of chunk) {
      if (op.type === "set") {
        batch.set(op.ref, op.data);
      } else {
        batch.update(op.ref, op.data);
      }
    }
    await batch.commit();
  }
}

// ─── Default workflow settings ────────────────────────────────────────────────

const DEFAULT_WORKFLOW_SETTINGS = {
  approvalLevels: 2,
  receiptRequiredThreshold: 25,
  expenseApprovalThreshold: 500,
};

// ─── Categories CRUD ──────────────────────────────────────────────────────────

export const adminListCategories = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    const snap = await db
      .collection(COLLECTION.CATEGORIES)
      .where("orgId", "==", data.orgId)
      .orderBy("categoryName", "asc")
      .get();

    return { categories: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

export const adminUpsertCategory = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      orgId: string;
      category: {
        id?: string;
        categoryId?: string;    // user-specified ID, required on create
        categoryName: string;
        active?: boolean;
      };
    };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    if (!data.category?.categoryName?.trim()) {
      throw new HttpsError(
        "invalid-argument",
        "categoryName is required."
      );
    }

    const db = admin.firestore();
    const now = nowTimestamp();
    const performedByEmail = request.auth?.token?.email ?? "unknown";

    if (data.category.id) {
      // Update existing
      const ref = db.collection(COLLECTION.CATEGORIES).doc(data.category.id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.orgId !== data.orgId) {
        throw new HttpsError("not-found", "Category not found.");
      }
      const updatePayload: Record<string, any> = {
        categoryName: data.category.categoryName.trim(),
        updatedAt: now,
      };
      if (data.category.categoryId !== undefined) {
        updatePayload.categoryId = data.category.categoryId;
      }
      if (data.category.active !== undefined) {
        updatePayload.active = data.category.active;
      }
      await ref.update(updatePayload);
      await writeAuditLog({
        actionType: "UPDATE_CATEGORY",
        collectionName: COLLECTION.CATEGORIES,
        recordId: data.category.id,
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: updatePayload,
      });
      return { success: true, categoryId: data.category.id };
    } else {
      if (!data.category.categoryId?.trim()) {
        throw new HttpsError(
          "invalid-argument",
          "categoryId is required when creating a new category."
        );
      }
      const newRef = db.collection(COLLECTION.CATEGORIES).doc();
      const docData = {
        orgId: data.orgId,
        tenantId: TENANT_ID,
        categoryId: data.category.categoryId.trim(),
        categoryName: data.category.categoryName.trim(),
        active: data.category.active !== undefined ? data.category.active : true,
        createdAt: now,
        updatedAt: now,
      };
      await newRef.set(docData);
      await writeAuditLog({
        actionType: "CREATE_CATEGORY",
        collectionName: COLLECTION.CATEGORIES,
        recordId: newRef.id,
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: docData,
      });
      return { success: true, categoryId: newRef.id };
    }
  }
);

export const adminSetCategoryStatus = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string; categoryId: string; active: boolean };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    if (!data.categoryId) {
      throw new HttpsError("invalid-argument", "categoryId is required.");
    }
    if (typeof data.active !== "boolean") {
      throw new HttpsError("invalid-argument", "active must be a boolean.");
    }

    const db = admin.firestore();
    const ref = db.collection(COLLECTION.CATEGORIES).doc(data.categoryId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.orgId !== data.orgId) {
      throw new HttpsError("not-found", "Category not found.");
    }

    const now = nowTimestamp();
    await ref.update({ active: data.active, updatedAt: now });
    await writeAuditLog({
      actionType: data.active ? "ACTIVATE_CATEGORY" : "DEACTIVATE_CATEGORY",
      collectionName: COLLECTION.CATEGORIES,
      recordId: data.categoryId,
      orgId: data.orgId,
      performedBy: uid,
      performedByEmail: request.auth?.token?.email ?? "unknown",
      payload: { active: data.active },
    });

    return { success: true };
  }
);

// ─── Category Budgets CRUD ────────────────────────────────────────────────────

export const adminListCategoryBudgets = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string; year?: number };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    let query: FirebaseFirestore.Query = db
      .collection(COLLECTION.CATEGORY_BUDGETS)
      .where("orgId", "==", data.orgId);

    if (data.year !== undefined) {
      query = query.where("year", "==", data.year);
    }

    const snap = await query.get();
    return { budgets: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

export const adminUpsertCategoryBudget = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      orgId: string;
      budget: {
        id?: string;
        organizationId?: string;
        year: number;
        ministryDepartment: string;
        fundName: string;
        fundType: string;
        approvedAnnualBudget: number;
      };
    };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    if (!isValid4DigitYear(data.budget.year)) {
      throw new HttpsError("invalid-argument", "year must be a valid 4-digit year.");
    }
    if (typeof data.budget.approvedAnnualBudget !== "number" || data.budget.approvedAnnualBudget < 0) {
      throw new HttpsError("invalid-argument", "approvedAnnualBudget must be a non-negative number.");
    }

    const db = admin.firestore();
    const now = nowTimestamp();
    const performedByEmail = request.auth?.token?.email ?? "unknown";
    const orgId = data.orgId;

    if (data.budget.id) {
      const ref = db.collection(COLLECTION.CATEGORY_BUDGETS).doc(data.budget.id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.orgId !== orgId) {
        throw new HttpsError("not-found", "Category budget not found.");
      }
      const updatePayload: Record<string, any> = {
        organizationId: orgId,
        year: data.budget.year,
        ministryDepartment: (data.budget.ministryDepartment ?? "").trim(),
        fundName: (data.budget.fundName ?? "").trim(),
        fundType: (data.budget.fundType ?? "").trim(),
        approvedAnnualBudget: data.budget.approvedAnnualBudget,
        updatedAt: now,
      };
      await ref.update(updatePayload);
      await writeAuditLog({
        actionType: "UPDATE_CATEGORY_BUDGET",
        collectionName: COLLECTION.CATEGORY_BUDGETS,
        recordId: data.budget.id,
        orgId,
        performedBy: uid,
        performedByEmail,
        payload: updatePayload,
      });
      return { success: true, budgetId: data.budget.id };
    } else {
      const newRef = db.collection(COLLECTION.CATEGORY_BUDGETS).doc();
      const docData = {
        orgId,
        organizationId: orgId,
        tenantId: TENANT_ID,
        year: data.budget.year,
        ministryDepartment: (data.budget.ministryDepartment ?? "").trim(),
        fundName: (data.budget.fundName ?? "").trim(),
        fundType: (data.budget.fundType ?? "").trim(),
        approvedAnnualBudget: data.budget.approvedAnnualBudget,
        createdAt: now,
        updatedAt: now,
      };
      await newRef.set(docData);
      await writeAuditLog({
        actionType: "CREATE_CATEGORY_BUDGET",
        collectionName: COLLECTION.CATEGORY_BUDGETS,
        recordId: newRef.id,
        orgId,
        performedBy: uid,
        performedByEmail,
        payload: docData,
      });
      return { success: true, budgetId: newRef.id };
    }
  }
);

// ─── Workflow Settings ────────────────────────────────────────────────────────

export const adminGetWorkflowSettings = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    const snap = await db
      .collection(COLLECTION.WORKFLOW_SETTINGS)
      .where("orgId", "==", data.orgId)
      .limit(1)
      .get();

    if (snap.empty) {
      return {
        settings: {
          orgId: data.orgId,
          tenantId: TENANT_ID,
          ...DEFAULT_WORKFLOW_SETTINGS,
        },
      };
    }

    return { settings: { id: snap.docs[0].id, ...snap.docs[0].data() } };
  }
);

export const adminSaveWorkflowSettings = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      orgId: string;
      settings: {
        approvalLevels: number;
        receiptRequiredThreshold: number;
        expenseApprovalThreshold: number;
      };
    };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    if (
      typeof data.settings?.approvalLevels !== "number" ||
      typeof data.settings?.receiptRequiredThreshold !== "number" ||
      typeof data.settings?.expenseApprovalThreshold !== "number"
    ) {
      throw new HttpsError(
        "invalid-argument",
        "approvalLevels, receiptRequiredThreshold, and expenseApprovalThreshold are required numbers."
      );
    }

    const db = admin.firestore();
    const now = nowTimestamp();
    const performedByEmail = request.auth?.token?.email ?? "unknown";

    // Check for existing settings doc
    const existing = await db
      .collection(COLLECTION.WORKFLOW_SETTINGS)
      .where("orgId", "==", data.orgId)
      .limit(1)
      .get();

    const docPayload = {
      orgId: data.orgId,
      tenantId: TENANT_ID,
      approvalLevels: data.settings.approvalLevels,
      receiptRequiredThreshold: data.settings.receiptRequiredThreshold,
      expenseApprovalThreshold: data.settings.expenseApprovalThreshold,
      updatedAt: now,
    };

    let settingsId: string;
    if (!existing.empty) {
      const ref = existing.docs[0].ref;
      await ref.update(docPayload);
      settingsId = existing.docs[0].id;
    } else {
      const newRef = db.collection(COLLECTION.WORKFLOW_SETTINGS).doc();
      await newRef.set({ ...docPayload, createdAt: now });
      settingsId = newRef.id;
    }

    await writeAuditLog({
      actionType: "SAVE_WORKFLOW_SETTINGS",
      collectionName: COLLECTION.WORKFLOW_SETTINGS,
      recordId: settingsId,
      orgId: data.orgId,
      performedBy: uid,
      performedByEmail,
      payload: docPayload,
    });

    return { success: true, settingsId };
  }
);

// ─── Escalation Rules CRUD ────────────────────────────────────────────────────

export const adminListEscalationRules = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    const snap = await db
      .collection(COLLECTION.ESCALATION_RULES)
      .where("orgId", "==", data.orgId)
      .orderBy("step", "asc")
      .get();

    return { rules: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

export const adminUpsertEscalationRule = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      orgId: string;
      rule: {
        id?: string;
        step: number;
        role: string;
        threshold: number;
        bufferAmount?: number;
        status?: "active" | "inactive";
      };
    };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    if (
      typeof data.rule?.step !== "number" ||
      data.rule.step < 1 ||
      data.rule.step > 8
    ) {
      throw new HttpsError("invalid-argument", "step must be between 1 and 8.");
    }
    if (!data.rule?.role?.trim()) {
      throw new HttpsError("invalid-argument", "role is required.");
    }
    if (typeof data.rule?.threshold !== "number" || data.rule.threshold < 0) {
      throw new HttpsError("invalid-argument", "threshold must be a non-negative number.");
    }

    const db = admin.firestore();
    const now = nowTimestamp();
    const performedByEmail = request.auth?.token?.email ?? "unknown";

    if (data.rule.id) {
      const ref = db.collection(COLLECTION.ESCALATION_RULES).doc(data.rule.id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.orgId !== data.orgId) {
        throw new HttpsError("not-found", "Escalation rule not found.");
      }
      const updatePayload: Record<string, any> = {
        step: data.rule.step,
        role: data.rule.role.trim(),
        threshold: data.rule.threshold,
        bufferAmount: data.rule.bufferAmount ?? snap.data()?.bufferAmount ?? 0,
        updatedAt: now,
      };
      if (data.rule.status !== undefined) {
        updatePayload.status = data.rule.status;
      }
      await ref.update(updatePayload);
      await writeAuditLog({
        actionType: "UPDATE_ESCALATION_RULE",
        collectionName: COLLECTION.ESCALATION_RULES,
        recordId: data.rule.id,
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: updatePayload,
      });
      return { success: true, ruleId: data.rule.id };
    } else {
      const newRef = db.collection(COLLECTION.ESCALATION_RULES).doc();
      const docData = {
        orgId: data.orgId,
        tenantId: TENANT_ID,
        step: data.rule.step,
        role: data.rule.role.trim(),
        threshold: data.rule.threshold,
        bufferAmount: data.rule.bufferAmount ?? 0,
        status: data.rule.status ?? "active",
        updatedAt: now,
      };
      await newRef.set(docData);
      await writeAuditLog({
        actionType: "CREATE_ESCALATION_RULE",
        collectionName: COLLECTION.ESCALATION_RULES,
        recordId: newRef.id,
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: docData,
      });
      return { success: true, ruleId: newRef.id };
    }
  }
);

export const adminSetEscalationRuleStatus = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string; ruleId: string; status: "active" | "inactive" };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    if (!data.ruleId) {
      throw new HttpsError("invalid-argument", "ruleId is required.");
    }
    if (data.status !== "active" && data.status !== "inactive") {
      throw new HttpsError("invalid-argument", "status must be active or inactive.");
    }

    const db = admin.firestore();
    const ref = db.collection(COLLECTION.ESCALATION_RULES).doc(data.ruleId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.orgId !== data.orgId) {
      throw new HttpsError("not-found", "Escalation rule not found.");
    }

    const now = nowTimestamp();
    await ref.update({ status: data.status, updatedAt: now });
    await writeAuditLog({
      actionType: data.status === "active" ? "ACTIVATE_ESCALATION_RULE" : "DEACTIVATE_ESCALATION_RULE",
      collectionName: COLLECTION.ESCALATION_RULES,
      recordId: data.ruleId,
      orgId: data.orgId,
      performedBy: uid,
      performedByEmail: request.auth?.token?.email ?? "unknown",
      payload: { status: data.status },
    });

    return { success: true };
  }
);

// ─── QB Payment Accounts CRUD ─────────────────────────────────────────────────

export const adminListQBAccounts = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    const snap = await db
      .collection(COLLECTION.QB_PAYMENT_ACCOUNTS)
      .where("orgId", "==", data.orgId)
      .orderBy("name", "asc")
      .get();

    return { accounts: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

export const adminUpsertQBAccount = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      orgId: string;
      account: {
        id?: string;
        name: string;
        accountNumber?: string;
        accountType?: string;
        status?: "active" | "inactive";
      };
    };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    if (!data.account?.name?.trim()) {
      throw new HttpsError("invalid-argument", "name is required.");
    }

    const db = admin.firestore();
    const now = nowTimestamp();
    const performedByEmail = request.auth?.token?.email ?? "unknown";

    if (data.account.id) {
      const ref = db.collection(COLLECTION.QB_PAYMENT_ACCOUNTS).doc(data.account.id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.orgId !== data.orgId) {
        throw new HttpsError("not-found", "QB account not found.");
      }
      const updatePayload: Record<string, any> = {
        name: data.account.name.trim(),
        accountName: data.account.name.trim(),
        accountNumber: data.account.accountNumber ?? snap.data()?.accountNumber ?? "",
        accountType: data.account.accountType ?? snap.data()?.accountType ?? "",
        updatedAt: now,
      };
      if (data.account.status !== undefined) {
        updatePayload.status = data.account.status;
      }
      await ref.update(updatePayload);
      await writeAuditLog({
        actionType: "UPDATE_QB_ACCOUNT",
        collectionName: COLLECTION.QB_PAYMENT_ACCOUNTS,
        recordId: data.account.id,
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: updatePayload,
      });
      return { success: true, accountId: data.account.id };
    } else {
      const newRef = db.collection(COLLECTION.QB_PAYMENT_ACCOUNTS).doc();
      const docData = {
        orgId: data.orgId,
        tenantId: TENANT_ID,
        name: data.account.name.trim(),
        accountName: data.account.name.trim(),
        accountNumber: data.account.accountNumber ?? "",
        accountType: data.account.accountType ?? "",
        status: data.account.status ?? "active",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await newRef.set(docData);
      await writeAuditLog({
        actionType: "CREATE_QB_ACCOUNT",
        collectionName: COLLECTION.QB_PAYMENT_ACCOUNTS,
        recordId: newRef.id,
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: docData,
      });
      return { success: true, accountId: newRef.id };
    }
  }
);

export const adminSetQBAccountStatus = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string; accountId: string; status: "active" | "inactive" };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    if (!data.accountId) {
      throw new HttpsError("invalid-argument", "accountId is required.");
    }
    if (data.status !== "active" && data.status !== "inactive") {
      throw new HttpsError("invalid-argument", "status must be active or inactive.");
    }

    const db = admin.firestore();
    const ref = db.collection(COLLECTION.QB_PAYMENT_ACCOUNTS).doc(data.accountId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.orgId !== data.orgId) {
      throw new HttpsError("not-found", "QB account not found.");
    }

    const now = nowTimestamp();
    await ref.update({
      status: data.status,
      isActive: data.status === "active",
      updatedAt: now,
    });
    await writeAuditLog({
      actionType: data.status === "active" ? "ACTIVATE_QB_ACCOUNT" : "DEACTIVATE_QB_ACCOUNT",
      collectionName: COLLECTION.QB_PAYMENT_ACCOUNTS,
      recordId: data.accountId,
      orgId: data.orgId,
      performedBy: uid,
      performedByEmail: request.auth?.token?.email ?? "unknown",
      payload: { status: data.status },
    });

    return { success: true };
  }
);

// ─── Vendors CRUD (direct vendor management) ──────────────────────────────────

export const adminListVendors = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const db = admin.firestore();
    const snap = await db
      .collection(COLLECTION.VENDORS)
      .where("orgId", "==", data.orgId)
      .orderBy("vendorName", "asc")
      .get();

    return { vendors: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

export const adminUpsertVendor = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      orgId: string;
      vendor: {
        id?: string;
        vendorId?: string;
        vendorName: string;
        vendorEmail?: string;
        vendorType?: string;
        w9OnFile?: boolean;
        w9TaxClassification?: string;
        llcTaxTreatment?: string;
        is1099Required?: boolean;
        active?: boolean;
      };
    };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const resolvedName = (data.vendor?.vendorName || "").trim();
    if (!resolvedName) {
      throw new HttpsError("invalid-argument", "Vendor name is required.");
    }

    const db = admin.firestore();
    const now = nowTimestamp();
    const performedByEmail = request.auth?.token?.email ?? "unknown";

    if (data.vendor.id) {
      const ref = db.collection(COLLECTION.VENDORS).doc(data.vendor.id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.orgId !== data.orgId) {
        throw new HttpsError("not-found", "Vendor not found.");
      }
      const existing = snap.data()!;
      const updatePayload: Record<string, any> = {
        vendorName: resolvedName,
        vendorEmail: data.vendor.vendorEmail ?? existing.vendorEmail ?? "",
        vendorType: data.vendor.vendorType ?? existing.vendorType ?? "",
        w9OnFile: data.vendor.w9OnFile !== undefined ? data.vendor.w9OnFile : (existing.w9OnFile ?? false),
        w9TaxClassification: data.vendor.w9TaxClassification ?? existing.w9TaxClassification ?? "",
        llcTaxTreatment: data.vendor.llcTaxTreatment ?? existing.llcTaxTreatment ?? "",
        is1099Required: data.vendor.is1099Required !== undefined ? data.vendor.is1099Required : (existing.is1099Required ?? false),
        updatedAt: now,
      };
      if (data.vendor.vendorId !== undefined) {
        updatePayload.vendorId = data.vendor.vendorId;
      }
      if (data.vendor.active !== undefined) {
        updatePayload.active = data.vendor.active;
      }
      await ref.update(updatePayload);
      await writeAuditLog({
        actionType: "UPDATE_VENDOR",
        collectionName: COLLECTION.VENDORS,
        recordId: data.vendor.id,
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: updatePayload,
      });
      return { success: true, vendorId: data.vendor.id };
    } else {
      const newRef = db.collection(COLLECTION.VENDORS).doc();
      const docData = {
        orgId: data.orgId,
        tenantId: TENANT_ID,
        vendorId: data.vendor.vendorId ?? "",
        vendorName: resolvedName,
        vendorEmail: data.vendor.vendorEmail ?? "",
        vendorType: data.vendor.vendorType ?? "",
        w9OnFile: data.vendor.w9OnFile ?? false,
        w9TaxClassification: data.vendor.w9TaxClassification ?? "",
        llcTaxTreatment: data.vendor.llcTaxTreatment ?? "",
        is1099Required: data.vendor.is1099Required ?? false,
        active: data.vendor.active !== undefined ? data.vendor.active : true,
        createdAt: now,
        updatedAt: now,
      };
      await newRef.set(docData);
      await writeAuditLog({
        actionType: "CREATE_VENDOR",
        collectionName: COLLECTION.VENDORS,
        recordId: newRef.id,
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: docData,
      });
      return { success: true, vendorId: newRef.id };
    }
  }
);

export const adminSetVendorStatus = onCall(
  async (request: CallableRequest) => {
    const data = request.data as { orgId: string; vendorId: string; active: boolean };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    if (!data.vendorId) {
      throw new HttpsError("invalid-argument", "vendorId is required.");
    }
    if (typeof data.active !== "boolean") {
      throw new HttpsError("invalid-argument", "active must be a boolean.");
    }

    const db = admin.firestore();
    const ref = db.collection(COLLECTION.VENDORS).doc(data.vendorId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.orgId !== data.orgId) {
      throw new HttpsError("not-found", "Vendor not found.");
    }

    const now = nowTimestamp();
    await ref.update({ active: data.active, updatedAt: now });
    await writeAuditLog({
      actionType: data.active ? "ACTIVATE_VENDOR" : "DEACTIVATE_VENDOR",
      collectionName: COLLECTION.VENDORS,
      recordId: data.vendorId,
      orgId: data.orgId,
      performedBy: uid,
      performedByEmail: request.auth?.token?.email ?? "unknown",
      payload: { active: data.active },
    });

    return { success: true };
  }
);

// ─── Bulk Import Result type ──────────────────────────────────────────────────

interface BulkImportResult {
  created: number;
  updated: number;
  errors: Array<{ row: number; field?: string; message: string }>;
}

// ─── adminBulkImportDepartments ───────────────────────────────────────────────

export const adminBulkImportDepartments = onCall(
  async (request: CallableRequest): Promise<BulkImportResult> => {
    const data = request.data as { orgId: string; rows: Record<string, string>[] };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const performedByEmail = request.auth?.token?.email ?? "unknown";
    const result: BulkImportResult = { created: 0, updated: 0, errors: [] };
    const rows = data.rows ?? [];

    // Duplicate detection within CSV
    const seenKeys = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key = (row.ministryDepartment ?? "").trim().toLowerCase() + "|" + data.orgId;
      if (seenKeys.has(key)) {
        result.errors.push({
          row: i + 1,
          field: "ministryDepartment",
          message: `Duplicate ministryDepartment "${row.ministryDepartment}" in import (first seen at row ${seenKeys.get(key)! + 1}).`,
        });
      } else {
        seenKeys.set(key, i);
      }
    }

    if (result.errors.length > 0) return result;

    // Validate rows
    const validRows: Array<{ idx: number; row: Record<string, string> }> = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = (row.ministryDepartment ?? "").trim();
      if (!name) {
        result.errors.push({ row: i + 1, field: "ministryDepartment", message: "ministryDepartment is required." });
        continue;
      }
      if (!row.approverEmail?.trim()) {
        result.errors.push({ row: i + 1, field: "approverEmail", message: "approverEmail is required." });
        continue;
      }
      if (!isValidEmail(row.approverEmail.trim())) {
        result.errors.push({ row: i + 1, field: "approverEmail", message: `Invalid email: ${row.approverEmail}` });
        continue;
      }
      validRows.push({ idx: i, row });
    }

    if (validRows.length === 0) return result;

    const db = admin.firestore();
    // Load existing departments for this org
    const existingSnap = await db
      .collection(COLLECTION.ADMIN_DEPTS)
      .where("orgId", "==", data.orgId)
      .get();

    const existingByKey = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of existingSnap.docs) {
      const d = doc.data();
      const nameVal = ((d.ministryDepartment ?? d.departmentName ?? d.name) as string).trim().toLowerCase();
      existingByKey.set(nameVal + "|" + data.orgId, doc);
    }

    const now = nowTimestamp();
    const ops: BatchOp[] = [];

    for (const { row } of validRows) {
      const name = row.ministryDepartment.trim();
      const key = name.toLowerCase() + "|" + data.orgId;
      const existing = existingByKey.get(key);
      const activeVal = row.active === undefined || row.active === "" ? true : parseBool(row.active);

      if (existing) {
        ops.push({
          type: "update",
          ref: existing.ref,
          data: {
            ministryDepartment: name,
            approverEmail: row.approverEmail.trim(),
            approverName: (row.approverName ?? "").trim(),
            active: activeVal,
            updatedAt: now,
          },
        });
        result.updated++;
      } else {
        const newRef = db.collection(COLLECTION.ADMIN_DEPTS).doc();
        ops.push({
          type: "set",
          ref: newRef,
          data: {
            orgId: data.orgId,
            organizationId: data.orgId,
            tenantId: TENANT_ID,
            ministryDepartment: name,
            approverId: "",
            approverEmail: row.approverEmail.trim(),
            approverName: (row.approverName ?? "").trim(),
            active: activeVal,
            createdAt: now,
            updatedAt: now,
          },
        });
        result.created++;
      }
    }

    await commitInChunks(db, ops);
    await writeAuditLog({
      actionType: "BULK_IMPORT_DEPARTMENTS",
      collectionName: COLLECTION.ADMIN_DEPTS,
      recordId: "bulk",
      orgId: data.orgId,
      performedBy: uid,
      performedByEmail,
      payload: { created: result.created, updated: result.updated },
    });

    return result;
  }
);

// ─── adminBulkImportCategories ────────────────────────────────────────────────

export const adminBulkImportCategories = onCall(
  async (request: CallableRequest): Promise<BulkImportResult> => {
    const data = request.data as { orgId: string; rows: Record<string, string>[] };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const performedByEmail = request.auth?.token?.email ?? "unknown";
    const result: BulkImportResult = { created: 0, updated: 0, errors: [] };
    const rows = data.rows ?? [];

    // Duplicate detection within CSV
    const seenKeys = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key = (row.categoryName ?? "").trim().toLowerCase() + "|" + data.orgId;
      if (seenKeys.has(key)) {
        result.errors.push({
          row: i + 1,
          field: "categoryName",
          message: `Duplicate categoryName "${row.categoryName}" in import (first seen at row ${seenKeys.get(key)! + 1}).`,
        });
      } else {
        seenKeys.set(key, i);
      }
    }

    if (result.errors.length > 0) return result;

    // Validate rows
    const validRows: Array<{ idx: number; row: Record<string, string> }> = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!(row.categoryName ?? "").trim()) {
        result.errors.push({ row: i + 1, field: "categoryName", message: "categoryName is required." });
        continue;
      }
      if (!(row.categoryId ?? "").trim()) {
        result.errors.push({ row: i + 1, field: "categoryId", message: "categoryId is required." });
        continue;
      }
      validRows.push({ idx: i, row });
    }

    if (validRows.length === 0) return result;

    const db = admin.firestore();
    const existingSnap = await db
      .collection(COLLECTION.CATEGORIES)
      .where("orgId", "==", data.orgId)
      .get();

    const existingByKey = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of existingSnap.docs) {
      const d = doc.data();
      existingByKey.set((d.categoryName as string).trim().toLowerCase() + "|" + data.orgId, doc);
    }

    const now = nowTimestamp();
    const ops: BatchOp[] = [];

    for (const { row } of validRows) {
      const name = row.categoryName.trim();
      const key = name.toLowerCase() + "|" + data.orgId;
      const existing = existingByKey.get(key);
      const activeVal = row.active === undefined || row.active === "" ? true : parseBool(row.active);

      if (existing) {
        const updateData: Record<string, any> = {
          categoryId: row.categoryId.trim(),
          categoryName: name,
          active: activeVal,
          updatedAt: now,
        };
        ops.push({ type: "update", ref: existing.ref, data: updateData });
        result.updated++;
      } else {
        const newRef = db.collection(COLLECTION.CATEGORIES).doc();
        ops.push({
          type: "set",
          ref: newRef,
          data: {
            orgId: data.orgId,
            tenantId: TENANT_ID,
            categoryId: row.categoryId.trim(),
            categoryName: name,
            active: activeVal,
            createdAt: now,
            updatedAt: now,
          },
        });
        result.created++;
      }
    }

    await commitInChunks(db, ops);
    await writeAuditLog({
      actionType: "BULK_IMPORT_CATEGORIES",
      collectionName: COLLECTION.CATEGORIES,
      recordId: "bulk",
      orgId: data.orgId,
      performedBy: uid,
      performedByEmail,
      payload: { created: result.created, updated: result.updated },
    });

    return result;
  }
);

// ─── adminBulkImportVendors ───────────────────────────────────────────────────

export const adminBulkImportVendors = onCall(
  async (request: CallableRequest): Promise<BulkImportResult> => {
    const data = request.data as { orgId: string; rows: Record<string, string>[] };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const performedByEmail = request.auth?.token?.email ?? "unknown";
    const result: BulkImportResult = { created: 0, updated: 0, errors: [] };
    const rows = data.rows ?? [];

    // Duplicate detection within CSV
    const seenKeys = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key = (row.vendorName ?? "").trim().toLowerCase() + "|" + data.orgId;
      if (seenKeys.has(key)) {
        result.errors.push({
          row: i + 1,
          field: "vendorName",
          message: `Duplicate vendorName "${row.vendorName}" in import (first seen at row ${seenKeys.get(key)! + 1}).`,
        });
      } else {
        seenKeys.set(key, i);
      }
    }

    if (result.errors.length > 0) return result;

    // Validate rows
    const validRows: Array<{ idx: number; row: Record<string, string> }> = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!(row.vendorName ?? "").trim()) {
        result.errors.push({ row: i + 1, field: "vendorName", message: "vendorName is required." });
        continue;
      }
      validRows.push({ idx: i, row });
    }

    if (validRows.length === 0) return result;

    const db = admin.firestore();
    const existingSnap = await db
      .collection(COLLECTION.VENDORS)
      .where("orgId", "==", data.orgId)
      .get();

    // Match against vendorName field
    const existingByKey = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of existingSnap.docs) {
      const d = doc.data();
      existingByKey.set((d.vendorName as string).trim().toLowerCase() + "|" + data.orgId, doc);
    }

    const now = nowTimestamp();
    const ops: BatchOp[] = [];

    for (const { row } of validRows) {
      const name = row.vendorName.trim();
      const key = name.toLowerCase() + "|" + data.orgId;
      const existing = existingByKey.get(key);
      const activeVal = row.active === undefined || row.active === "" ? true : parseBool(row.active);
      const w9OnFileVal = parseBool(row.w9OnFile);
      const is1099Val = parseBool(row.is1099Required);

      if (existing) {
        const existingData = existing.data();
        const updateData: Record<string, any> = {
          vendorName: name,
          vendorEmail: row.vendorEmail ?? existingData.vendorEmail ?? "",
          vendorType: row.vendorType ?? existingData.vendorType ?? "",
          w9OnFile: w9OnFileVal,
          w9TaxClassification: row.w9TaxClassification ?? existingData.w9TaxClassification ?? "",
          llcTaxTreatment: row.llcTaxTreatment ?? existingData.llcTaxTreatment ?? "",
          is1099Required: is1099Val,
          active: activeVal,
          updatedAt: now,
        };
        if (row.vendorId !== undefined) {
          updateData.vendorId = row.vendorId;
        }
        ops.push({ type: "update", ref: existing.ref, data: updateData });
        result.updated++;
      } else {
        const newRef = db.collection(COLLECTION.VENDORS).doc();
        ops.push({
          type: "set",
          ref: newRef,
          data: {
            orgId: data.orgId,
            tenantId: TENANT_ID,
            vendorId: row.vendorId ?? "",
            vendorName: name,
            vendorEmail: row.vendorEmail ?? "",
            vendorType: row.vendorType ?? "",
            w9OnFile: w9OnFileVal,
            w9TaxClassification: row.w9TaxClassification ?? "",
            llcTaxTreatment: row.llcTaxTreatment ?? "",
            is1099Required: is1099Val,
            active: activeVal,
            createdAt: now,
            updatedAt: now,
          },
        });
        result.created++;
      }
    }

    await commitInChunks(db, ops);
    await writeAuditLog({
      actionType: "BULK_IMPORT_VENDORS",
      collectionName: COLLECTION.VENDORS,
      recordId: "bulk",
      orgId: data.orgId,
      performedBy: uid,
      performedByEmail,
      payload: { created: result.created, updated: result.updated },
    });

    return result;
  }
);

// ─── adminBulkImportCategoryBudgets ──────────────────────────────────────────

export const adminBulkImportCategoryBudgets = onCall(
  async (request: CallableRequest): Promise<BulkImportResult> => {
    const data = request.data as { orgId: string; rows: Record<string, string>[] };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const performedByEmail = request.auth?.token?.email ?? "unknown";
    const result: BulkImportResult = { created: 0, updated: 0, errors: [] };
    const rows = data.rows ?? [];

    // Duplicate detection within CSV
    const seenKeys = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key =
        (row.organizationId ?? "").trim().toLowerCase() +
        "|" +
        (row.year ?? "") +
        "|" +
        (row.ministryDepartment ?? "").trim().toLowerCase() +
        "|" +
        (row.fundName ?? "").trim().toLowerCase();
      if (seenKeys.has(key)) {
        result.errors.push({
          row: i + 1,
          field: "organizationId+year+ministryDepartment+fundName",
          message: `Duplicate combination in import (first seen at row ${seenKeys.get(key)! + 1}).`,
        });
      } else {
        seenKeys.set(key, i);
      }
    }

    if (result.errors.length > 0) return result;

    // Validate rows
    const validRows: Array<{ idx: number; row: Record<string, string> }> = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Validate organizationId matches calling user's orgId
      if (row.organizationId && row.organizationId.trim() !== data.orgId) {
        result.errors.push({ row: i + 1, field: "organizationId", message: `organizationId "${row.organizationId}" does not match your organization.` });
        continue;
      }

      if (!(row.ministryDepartment ?? "").trim()) {
        result.errors.push({ row: i + 1, field: "ministryDepartment", message: "ministryDepartment is required." });
        continue;
      }
      const year = parseInt(row.year ?? "", 10);
      if (!isValid4DigitYear(year)) {
        result.errors.push({ row: i + 1, field: "year", message: `year must be a valid 4-digit year, got: ${row.year}` });
        continue;
      }
      const approvedAnnualBudget = parseFloat(row.approvedAnnualBudget ?? "");
      if (isNaN(approvedAnnualBudget) || approvedAnnualBudget < 0) {
        result.errors.push({ row: i + 1, field: "approvedAnnualBudget", message: `approvedAnnualBudget must be a positive number, got: ${row.approvedAnnualBudget}` });
        continue;
      }
      validRows.push({ idx: i, row });
    }

    if (validRows.length === 0) return result;

    const db = admin.firestore();

    // Load existing budgets for this org
    const existingSnap = await db
      .collection(COLLECTION.CATEGORY_BUDGETS)
      .where("orgId", "==", data.orgId)
      .get();

    const existingByKey = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of existingSnap.docs) {
      const d = doc.data();
      const k =
        data.orgId.toLowerCase() +
        "|" +
        d.year +
        "|" +
        (d.ministryDepartment as string).trim().toLowerCase();
      existingByKey.set(k, doc);
    }

    const now = nowTimestamp();
    const ops: BatchOp[] = [];

    for (const { row } of validRows) {
      const year = parseInt(row.year, 10);
      const ministryDepartment = row.ministryDepartment.trim();
      const approvedAnnualBudget = parseFloat(row.approvedAnnualBudget);
      const key =
        data.orgId.toLowerCase() +
        "|" +
        year +
        "|" +
        ministryDepartment.toLowerCase();
      const existing = existingByKey.get(key);

      if (existing) {
        const updateData: Record<string, any> = {
          organizationId: data.orgId,
          year,
          ministryDepartment,
          fundName: (row.fundName ?? existing.data().fundName ?? "").trim(),
          fundType: (row.fundType ?? existing.data().fundType ?? "").trim(),
          approvedAnnualBudget,
          updatedAt: now,
        };
        ops.push({ type: "update", ref: existing.ref, data: updateData });
        result.updated++;
      } else {
        const newRef = db.collection(COLLECTION.CATEGORY_BUDGETS).doc();
        ops.push({
          type: "set",
          ref: newRef,
          data: {
            orgId: data.orgId,
            organizationId: data.orgId,
            tenantId: TENANT_ID,
            year,
            ministryDepartment,
            fundName: (row.fundName ?? "").trim(),
            fundType: (row.fundType ?? "").trim(),
            approvedAnnualBudget,
            createdAt: now,
            updatedAt: now,
          },
        });
        result.created++;
      }
    }

    await commitInChunks(db, ops);
    await writeAuditLog({
      actionType: "BULK_IMPORT_CATEGORY_BUDGETS",
      collectionName: COLLECTION.CATEGORY_BUDGETS,
      recordId: "bulk",
      orgId: data.orgId,
      performedBy: uid,
      performedByEmail,
      payload: { created: result.created, updated: result.updated },
    });

    return result;
  }
);

// ─── adminBulkImportEscalationRules ──────────────────────────────────────────

export const adminBulkImportEscalationRules = onCall(
  async (request: CallableRequest): Promise<BulkImportResult> => {
    const data = request.data as { orgId: string; rows: Record<string, string>[] };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const performedByEmail = request.auth?.token?.email ?? "unknown";
    const result: BulkImportResult = { created: 0, updated: 0, errors: [] };
    const rows = data.rows ?? [];

    // Duplicate detection within CSV
    const seenKeys = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key = (row.step ?? "") + "|" + (row.role ?? "").trim().toUpperCase() + "|" + data.orgId;
      if (seenKeys.has(key)) {
        result.errors.push({
          row: i + 1,
          field: "step+role",
          message: `Duplicate step+role combination "${row.step}/${row.role}" in import (first seen at row ${seenKeys.get(key)! + 1}).`,
        });
      } else {
        seenKeys.set(key, i);
      }
    }

    if (result.errors.length > 0) return result;

    // Validate rows
    const validRows: Array<{ idx: number; row: Record<string, string> }> = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const step = parseInt(row.step ?? "", 10);
      if (isNaN(step) || step < 1 || step > 8) {
        result.errors.push({ row: i + 1, field: "step", message: `step must be between 1 and 8, got: ${row.step}` });
        continue;
      }
      const role = (row.role ?? "").trim().toUpperCase();
      if (!role || !VALID_ROLES.includes(role)) {
        result.errors.push({ row: i + 1, field: "role", message: `role must be one of: ${VALID_ROLES.join(", ")}. Got: ${row.role}` });
        continue;
      }
      const threshold = parseFloat(row.threshold ?? "");
      if (isNaN(threshold) || threshold < 0) {
        result.errors.push({ row: i + 1, field: "threshold", message: `threshold must be a positive number, got: ${row.threshold}` });
        continue;
      }
      validRows.push({ idx: i, row });
    }

    if (validRows.length === 0) return result;

    const db = admin.firestore();
    const existingSnap = await db
      .collection(COLLECTION.ESCALATION_RULES)
      .where("orgId", "==", data.orgId)
      .get();

    const existingByKey = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of existingSnap.docs) {
      const d = doc.data();
      const k = d.step + "|" + (d.role as string).toUpperCase() + "|" + data.orgId;
      existingByKey.set(k, doc);
    }

    const now = nowTimestamp();
    const ops: BatchOp[] = [];

    for (const { row } of validRows) {
      const step = parseInt(row.step, 10);
      const role = row.role.trim().toUpperCase();
      const threshold = parseFloat(row.threshold);
      const bufferAmount = row.bufferAmount ? parseFloat(row.bufferAmount) : undefined;
      const key = step + "|" + role + "|" + data.orgId;
      const existing = existingByKey.get(key);

      if (existing) {
        const updateData: Record<string, any> = {
          threshold,
          updatedAt: now,
        };
        if (bufferAmount !== undefined && !isNaN(bufferAmount)) {
          updateData.bufferAmount = bufferAmount;
        }
        if (row.status) {
          updateData.status = row.status === "inactive" ? "inactive" : "active";
        }
        ops.push({ type: "update", ref: existing.ref, data: updateData });
        result.updated++;
      } else {
        const newRef = db.collection(COLLECTION.ESCALATION_RULES).doc();
        ops.push({
          type: "set",
          ref: newRef,
          data: {
            orgId: data.orgId,
            tenantId: TENANT_ID,
            step,
            role,
            threshold,
            bufferAmount: bufferAmount !== undefined && !isNaN(bufferAmount) ? bufferAmount : 0,
            status: row.status === "inactive" ? "inactive" : "active",
            updatedAt: now,
          },
        });
        result.created++;
      }
    }

    await commitInChunks(db, ops);
    await writeAuditLog({
      actionType: "BULK_IMPORT_ESCALATION_RULES",
      collectionName: COLLECTION.ESCALATION_RULES,
      recordId: "bulk",
      orgId: data.orgId,
      performedBy: uid,
      performedByEmail,
      payload: { created: result.created, updated: result.updated },
    });

    return result;
  }
);

// ─── adminBulkImportQBAccounts ────────────────────────────────────────────────

export const adminBulkImportQBAccounts = onCall(
  async (request: CallableRequest): Promise<BulkImportResult> => {
    const data = request.data as { orgId: string; rows: Record<string, string>[] };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [ROLE.ADMIN]);

    const performedByEmail = request.auth?.token?.email ?? "unknown";
    const result: BulkImportResult = { created: 0, updated: 0, errors: [] };
    const rows = data.rows ?? [];

    // Duplicate detection within CSV
    const seenKeys = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key = (row.accountName ?? "").trim().toLowerCase() + "|" + data.orgId;
      if (seenKeys.has(key)) {
        result.errors.push({
          row: i + 1,
          field: "accountName",
          message: `Duplicate accountName "${row.accountName}" in import (first seen at row ${seenKeys.get(key)! + 1}).`,
        });
      } else {
        seenKeys.set(key, i);
      }
    }

    if (result.errors.length > 0) return result;

    // Validate rows
    const validRows: Array<{ idx: number; row: Record<string, string> }> = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!(row.accountName ?? "").trim()) {
        result.errors.push({ row: i + 1, field: "accountName", message: "accountName is required." });
        continue;
      }
      validRows.push({ idx: i, row });
    }

    if (validRows.length === 0) return result;

    const db = admin.firestore();
    const existingSnap = await db
      .collection(COLLECTION.QB_PAYMENT_ACCOUNTS)
      .where("orgId", "==", data.orgId)
      .get();

    // Match against `name` field
    const existingByKey = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of existingSnap.docs) {
      const d = doc.data();
      const nameVal = ((d.name ?? d.accountName) as string).trim().toLowerCase();
      existingByKey.set(nameVal + "|" + data.orgId, doc);
    }

    const now = nowTimestamp();
    const ops: BatchOp[] = [];

    for (const { row } of validRows) {
      const name = row.accountName.trim();
      const key = name.toLowerCase() + "|" + data.orgId;
      const existing = existingByKey.get(key);

      if (existing) {
        const updateData: Record<string, any> = {
          name,
          accountName: name,
          accountNumber: row.accountNumber ?? existing.data().accountNumber ?? "",
          accountType: row.accountType ?? existing.data().accountType ?? "",
          updatedAt: now,
        };
        if (row.status) {
          const newStatus = row.status === "inactive" ? "inactive" : "active";
          updateData.status = newStatus;
          updateData.isActive = newStatus === "active";
        }
        ops.push({ type: "update", ref: existing.ref, data: updateData });
        result.updated++;
      } else {
        const newRef = db.collection(COLLECTION.QB_PAYMENT_ACCOUNTS).doc();
        const newStatus = row.status === "inactive" ? "inactive" : "active";
        ops.push({
          type: "set",
          ref: newRef,
          data: {
            orgId: data.orgId,
            tenantId: TENANT_ID,
            name,
            accountName: name,
            accountNumber: row.accountNumber ?? "",
            accountType: row.accountType ?? "",
            status: newStatus,
            isActive: newStatus === "active",
            createdAt: now,
            updatedAt: now,
          },
        });
        result.created++;
      }
    }

    await commitInChunks(db, ops);
    await writeAuditLog({
      actionType: "BULK_IMPORT_QB_ACCOUNTS",
      collectionName: COLLECTION.QB_PAYMENT_ACCOUNTS,
      recordId: "bulk",
      orgId: data.orgId,
      performedBy: uid,
      performedByEmail,
      payload: { created: result.created, updated: result.updated },
    });

    return result;
  }
);
