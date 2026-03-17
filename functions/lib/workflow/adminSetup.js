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
exports.adminBulkImportQBAccounts = exports.adminBulkImportEscalationRules = exports.adminBulkImportCategoryBudgets = exports.adminBulkImportVendors = exports.adminBulkImportCategories = exports.adminBulkImportDepartments = exports.adminSetVendorStatus = exports.adminUpsertVendor = exports.adminListVendors = exports.adminSetQBAccountStatus = exports.adminUpsertQBAccount = exports.adminListQBAccounts = exports.adminSetEscalationRuleStatus = exports.adminUpsertEscalationRule = exports.adminListEscalationRules = exports.adminSaveWorkflowSettings = exports.adminGetWorkflowSettings = exports.adminUpsertCategoryBudget = exports.adminListCategoryBudgets = exports.adminSetCategoryStatus = exports.adminUpsertCategory = exports.adminListCategories = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const constants_1 = require("./constants");
const helpers_1 = require("./helpers");
// ─── Audit Log Helper ─────────────────────────────────────────────────────────
async function writeAuditLog(params) {
    const db = admin.firestore();
    await db.collection(constants_1.COLLECTION.ADMIN_AUDIT_LOGS).add({
        actionType: params.actionType,
        collectionName: params.collectionName,
        recordId: params.recordId,
        orgId: params.orgId,
        performedBy: params.performedBy,
        performedByEmail: params.performedByEmail,
        payload: params.payload ?? {},
        timestamp: (0, helpers_1.nowTimestamp)(),
    });
}
// ─── Validation helpers ───────────────────────────────────────────────────────
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValid4DigitYear(year) {
    return Number.isInteger(year) && year >= 1000 && year <= 9999;
}
function parseBool(val) {
    if (val === undefined || val === null)
        return false;
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
async function commitInChunks(db, ops) {
    const CHUNK_SIZE = 499;
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
        const chunk = ops.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();
        for (const op of chunk) {
            if (op.type === "set") {
                batch.set(op.ref, op.data);
            }
            else {
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
exports.adminListCategories = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    const snap = await db
        .collection(constants_1.COLLECTION.CATEGORIES)
        .where("orgId", "==", data.orgId)
        .orderBy("categoryName", "asc")
        .get();
    return { categories: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
});
exports.adminUpsertCategory = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    if (!data.category?.categoryName?.trim()) {
        throw new https_1.HttpsError("invalid-argument", "categoryName is required.");
    }
    const db = admin.firestore();
    const now = (0, helpers_1.nowTimestamp)();
    const performedByEmail = request.auth?.token?.email ?? "unknown";
    if (data.category.id) {
        // Update existing
        const ref = db.collection(constants_1.COLLECTION.CATEGORIES).doc(data.category.id);
        const snap = await ref.get();
        if (!snap.exists || snap.data()?.orgId !== data.orgId) {
            throw new https_1.HttpsError("not-found", "Category not found.");
        }
        const updatePayload = {
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
            collectionName: constants_1.COLLECTION.CATEGORIES,
            recordId: data.category.id,
            orgId: data.orgId,
            performedBy: uid,
            performedByEmail,
            payload: updatePayload,
        });
        return { success: true, categoryId: data.category.id };
    }
    else {
        if (!data.category.categoryId?.trim()) {
            throw new https_1.HttpsError("invalid-argument", "categoryId is required when creating a new category.");
        }
        const newRef = db.collection(constants_1.COLLECTION.CATEGORIES).doc();
        const docData = {
            orgId: data.orgId,
            tenantId: constants_1.TENANT_ID,
            categoryId: data.category.categoryId.trim(),
            categoryName: data.category.categoryName.trim(),
            active: data.category.active !== undefined ? data.category.active : true,
            createdAt: now,
            updatedAt: now,
        };
        await newRef.set(docData);
        await writeAuditLog({
            actionType: "CREATE_CATEGORY",
            collectionName: constants_1.COLLECTION.CATEGORIES,
            recordId: newRef.id,
            orgId: data.orgId,
            performedBy: uid,
            performedByEmail,
            payload: docData,
        });
        return { success: true, categoryId: newRef.id };
    }
});
exports.adminSetCategoryStatus = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    if (!data.categoryId) {
        throw new https_1.HttpsError("invalid-argument", "categoryId is required.");
    }
    if (typeof data.active !== "boolean") {
        throw new https_1.HttpsError("invalid-argument", "active must be a boolean.");
    }
    const db = admin.firestore();
    const ref = db.collection(constants_1.COLLECTION.CATEGORIES).doc(data.categoryId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.orgId !== data.orgId) {
        throw new https_1.HttpsError("not-found", "Category not found.");
    }
    const now = (0, helpers_1.nowTimestamp)();
    await ref.update({ active: data.active, updatedAt: now });
    await writeAuditLog({
        actionType: data.active ? "ACTIVATE_CATEGORY" : "DEACTIVATE_CATEGORY",
        collectionName: constants_1.COLLECTION.CATEGORIES,
        recordId: data.categoryId,
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail: request.auth?.token?.email ?? "unknown",
        payload: { active: data.active },
    });
    return { success: true };
});
// ─── Category Budgets CRUD ────────────────────────────────────────────────────
exports.adminListCategoryBudgets = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    let query = db
        .collection(constants_1.COLLECTION.CATEGORY_BUDGETS)
        .where("orgId", "==", data.orgId);
    if (data.year !== undefined) {
        query = query.where("year", "==", data.year);
    }
    const snap = await query.get();
    return { budgets: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
});
exports.adminUpsertCategoryBudget = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    if (!isValid4DigitYear(data.budget.year)) {
        throw new https_1.HttpsError("invalid-argument", "year must be a valid 4-digit year.");
    }
    if (typeof data.budget.approvedAnnualBudget !== "number" || data.budget.approvedAnnualBudget < 0) {
        throw new https_1.HttpsError("invalid-argument", "approvedAnnualBudget must be a non-negative number.");
    }
    const db = admin.firestore();
    const now = (0, helpers_1.nowTimestamp)();
    const performedByEmail = request.auth?.token?.email ?? "unknown";
    const orgId = data.orgId;
    if (data.budget.id) {
        const ref = db.collection(constants_1.COLLECTION.CATEGORY_BUDGETS).doc(data.budget.id);
        const snap = await ref.get();
        if (!snap.exists || snap.data()?.orgId !== orgId) {
            throw new https_1.HttpsError("not-found", "Category budget not found.");
        }
        const updatePayload = {
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
            collectionName: constants_1.COLLECTION.CATEGORY_BUDGETS,
            recordId: data.budget.id,
            orgId,
            performedBy: uid,
            performedByEmail,
            payload: updatePayload,
        });
        return { success: true, budgetId: data.budget.id };
    }
    else {
        const newRef = db.collection(constants_1.COLLECTION.CATEGORY_BUDGETS).doc();
        const docData = {
            orgId,
            organizationId: orgId,
            tenantId: constants_1.TENANT_ID,
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
            collectionName: constants_1.COLLECTION.CATEGORY_BUDGETS,
            recordId: newRef.id,
            orgId,
            performedBy: uid,
            performedByEmail,
            payload: docData,
        });
        return { success: true, budgetId: newRef.id };
    }
});
// ─── Workflow Settings ────────────────────────────────────────────────────────
exports.adminGetWorkflowSettings = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    const snap = await db
        .collection(constants_1.COLLECTION.WORKFLOW_SETTINGS)
        .where("orgId", "==", data.orgId)
        .limit(1)
        .get();
    if (snap.empty) {
        return {
            settings: {
                orgId: data.orgId,
                tenantId: constants_1.TENANT_ID,
                ...DEFAULT_WORKFLOW_SETTINGS,
            },
        };
    }
    return { settings: { id: snap.docs[0].id, ...snap.docs[0].data() } };
});
exports.adminSaveWorkflowSettings = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    if (typeof data.settings?.approvalLevels !== "number" ||
        typeof data.settings?.receiptRequiredThreshold !== "number" ||
        typeof data.settings?.expenseApprovalThreshold !== "number") {
        throw new https_1.HttpsError("invalid-argument", "approvalLevels, receiptRequiredThreshold, and expenseApprovalThreshold are required numbers.");
    }
    const db = admin.firestore();
    const now = (0, helpers_1.nowTimestamp)();
    const performedByEmail = request.auth?.token?.email ?? "unknown";
    // Check for existing settings doc
    const existing = await db
        .collection(constants_1.COLLECTION.WORKFLOW_SETTINGS)
        .where("orgId", "==", data.orgId)
        .limit(1)
        .get();
    const docPayload = {
        orgId: data.orgId,
        tenantId: constants_1.TENANT_ID,
        approvalLevels: data.settings.approvalLevels,
        receiptRequiredThreshold: data.settings.receiptRequiredThreshold,
        expenseApprovalThreshold: data.settings.expenseApprovalThreshold,
        updatedAt: now,
    };
    let settingsId;
    if (!existing.empty) {
        const ref = existing.docs[0].ref;
        await ref.update(docPayload);
        settingsId = existing.docs[0].id;
    }
    else {
        const newRef = db.collection(constants_1.COLLECTION.WORKFLOW_SETTINGS).doc();
        await newRef.set({ ...docPayload, createdAt: now });
        settingsId = newRef.id;
    }
    await writeAuditLog({
        actionType: "SAVE_WORKFLOW_SETTINGS",
        collectionName: constants_1.COLLECTION.WORKFLOW_SETTINGS,
        recordId: settingsId,
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: docPayload,
    });
    return { success: true, settingsId };
});
// ─── Escalation Rules CRUD ────────────────────────────────────────────────────
exports.adminListEscalationRules = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    const snap = await db
        .collection(constants_1.COLLECTION.ESCALATION_RULES)
        .where("orgId", "==", data.orgId)
        .orderBy("step", "asc")
        .get();
    return { rules: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
});
exports.adminUpsertEscalationRule = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    if (typeof data.rule?.step !== "number" ||
        data.rule.step < 1 ||
        data.rule.step > 8) {
        throw new https_1.HttpsError("invalid-argument", "step must be between 1 and 8.");
    }
    if (!data.rule?.role?.trim()) {
        throw new https_1.HttpsError("invalid-argument", "role is required.");
    }
    if (typeof data.rule?.threshold !== "number" || data.rule.threshold < 0) {
        throw new https_1.HttpsError("invalid-argument", "threshold must be a non-negative number.");
    }
    const db = admin.firestore();
    const now = (0, helpers_1.nowTimestamp)();
    const performedByEmail = request.auth?.token?.email ?? "unknown";
    if (data.rule.id) {
        const ref = db.collection(constants_1.COLLECTION.ESCALATION_RULES).doc(data.rule.id);
        const snap = await ref.get();
        if (!snap.exists || snap.data()?.orgId !== data.orgId) {
            throw new https_1.HttpsError("not-found", "Escalation rule not found.");
        }
        const updatePayload = {
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
            collectionName: constants_1.COLLECTION.ESCALATION_RULES,
            recordId: data.rule.id,
            orgId: data.orgId,
            performedBy: uid,
            performedByEmail,
            payload: updatePayload,
        });
        return { success: true, ruleId: data.rule.id };
    }
    else {
        const newRef = db.collection(constants_1.COLLECTION.ESCALATION_RULES).doc();
        const docData = {
            orgId: data.orgId,
            tenantId: constants_1.TENANT_ID,
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
            collectionName: constants_1.COLLECTION.ESCALATION_RULES,
            recordId: newRef.id,
            orgId: data.orgId,
            performedBy: uid,
            performedByEmail,
            payload: docData,
        });
        return { success: true, ruleId: newRef.id };
    }
});
exports.adminSetEscalationRuleStatus = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    if (!data.ruleId) {
        throw new https_1.HttpsError("invalid-argument", "ruleId is required.");
    }
    if (data.status !== "active" && data.status !== "inactive") {
        throw new https_1.HttpsError("invalid-argument", "status must be active or inactive.");
    }
    const db = admin.firestore();
    const ref = db.collection(constants_1.COLLECTION.ESCALATION_RULES).doc(data.ruleId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.orgId !== data.orgId) {
        throw new https_1.HttpsError("not-found", "Escalation rule not found.");
    }
    const now = (0, helpers_1.nowTimestamp)();
    await ref.update({ status: data.status, updatedAt: now });
    await writeAuditLog({
        actionType: data.status === "active" ? "ACTIVATE_ESCALATION_RULE" : "DEACTIVATE_ESCALATION_RULE",
        collectionName: constants_1.COLLECTION.ESCALATION_RULES,
        recordId: data.ruleId,
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail: request.auth?.token?.email ?? "unknown",
        payload: { status: data.status },
    });
    return { success: true };
});
// ─── QB Payment Accounts CRUD ─────────────────────────────────────────────────
exports.adminListQBAccounts = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    const snap = await db
        .collection(constants_1.COLLECTION.QB_PAYMENT_ACCOUNTS)
        .where("orgId", "==", data.orgId)
        .orderBy("name", "asc")
        .get();
    return { accounts: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
});
exports.adminUpsertQBAccount = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    if (!data.account?.name?.trim()) {
        throw new https_1.HttpsError("invalid-argument", "name is required.");
    }
    const db = admin.firestore();
    const now = (0, helpers_1.nowTimestamp)();
    const performedByEmail = request.auth?.token?.email ?? "unknown";
    if (data.account.id) {
        const ref = db.collection(constants_1.COLLECTION.QB_PAYMENT_ACCOUNTS).doc(data.account.id);
        const snap = await ref.get();
        if (!snap.exists || snap.data()?.orgId !== data.orgId) {
            throw new https_1.HttpsError("not-found", "QB account not found.");
        }
        const updatePayload = {
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
            collectionName: constants_1.COLLECTION.QB_PAYMENT_ACCOUNTS,
            recordId: data.account.id,
            orgId: data.orgId,
            performedBy: uid,
            performedByEmail,
            payload: updatePayload,
        });
        return { success: true, accountId: data.account.id };
    }
    else {
        const newRef = db.collection(constants_1.COLLECTION.QB_PAYMENT_ACCOUNTS).doc();
        const docData = {
            orgId: data.orgId,
            tenantId: constants_1.TENANT_ID,
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
            collectionName: constants_1.COLLECTION.QB_PAYMENT_ACCOUNTS,
            recordId: newRef.id,
            orgId: data.orgId,
            performedBy: uid,
            performedByEmail,
            payload: docData,
        });
        return { success: true, accountId: newRef.id };
    }
});
exports.adminSetQBAccountStatus = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    if (!data.accountId) {
        throw new https_1.HttpsError("invalid-argument", "accountId is required.");
    }
    if (data.status !== "active" && data.status !== "inactive") {
        throw new https_1.HttpsError("invalid-argument", "status must be active or inactive.");
    }
    const db = admin.firestore();
    const ref = db.collection(constants_1.COLLECTION.QB_PAYMENT_ACCOUNTS).doc(data.accountId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.orgId !== data.orgId) {
        throw new https_1.HttpsError("not-found", "QB account not found.");
    }
    const now = (0, helpers_1.nowTimestamp)();
    await ref.update({
        status: data.status,
        isActive: data.status === "active",
        updatedAt: now,
    });
    await writeAuditLog({
        actionType: data.status === "active" ? "ACTIVATE_QB_ACCOUNT" : "DEACTIVATE_QB_ACCOUNT",
        collectionName: constants_1.COLLECTION.QB_PAYMENT_ACCOUNTS,
        recordId: data.accountId,
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail: request.auth?.token?.email ?? "unknown",
        payload: { status: data.status },
    });
    return { success: true };
});
// ─── Vendors CRUD (direct vendor management) ──────────────────────────────────
exports.adminListVendors = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const db = admin.firestore();
    const snap = await db
        .collection(constants_1.COLLECTION.VENDORS)
        .where("orgId", "==", data.orgId)
        .orderBy("vendorName", "asc")
        .get();
    return { vendors: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
});
exports.adminUpsertVendor = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const resolvedName = (data.vendor?.vendorName || "").trim();
    if (!resolvedName) {
        throw new https_1.HttpsError("invalid-argument", "Vendor name is required.");
    }
    const db = admin.firestore();
    const now = (0, helpers_1.nowTimestamp)();
    const performedByEmail = request.auth?.token?.email ?? "unknown";
    if (data.vendor.id) {
        const ref = db.collection(constants_1.COLLECTION.VENDORS).doc(data.vendor.id);
        const snap = await ref.get();
        if (!snap.exists || snap.data()?.orgId !== data.orgId) {
            throw new https_1.HttpsError("not-found", "Vendor not found.");
        }
        const existing = snap.data();
        const updatePayload = {
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
            collectionName: constants_1.COLLECTION.VENDORS,
            recordId: data.vendor.id,
            orgId: data.orgId,
            performedBy: uid,
            performedByEmail,
            payload: updatePayload,
        });
        return { success: true, vendorId: data.vendor.id };
    }
    else {
        const newRef = db.collection(constants_1.COLLECTION.VENDORS).doc();
        const docData = {
            orgId: data.orgId,
            tenantId: constants_1.TENANT_ID,
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
            collectionName: constants_1.COLLECTION.VENDORS,
            recordId: newRef.id,
            orgId: data.orgId,
            performedBy: uid,
            performedByEmail,
            payload: docData,
        });
        return { success: true, vendorId: newRef.id };
    }
});
exports.adminSetVendorStatus = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    if (!data.vendorId) {
        throw new https_1.HttpsError("invalid-argument", "vendorId is required.");
    }
    if (typeof data.active !== "boolean") {
        throw new https_1.HttpsError("invalid-argument", "active must be a boolean.");
    }
    const db = admin.firestore();
    const ref = db.collection(constants_1.COLLECTION.VENDORS).doc(data.vendorId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.orgId !== data.orgId) {
        throw new https_1.HttpsError("not-found", "Vendor not found.");
    }
    const now = (0, helpers_1.nowTimestamp)();
    await ref.update({ active: data.active, updatedAt: now });
    await writeAuditLog({
        actionType: data.active ? "ACTIVATE_VENDOR" : "DEACTIVATE_VENDOR",
        collectionName: constants_1.COLLECTION.VENDORS,
        recordId: data.vendorId,
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail: request.auth?.token?.email ?? "unknown",
        payload: { active: data.active },
    });
    return { success: true };
});
// ─── adminBulkImportDepartments ───────────────────────────────────────────────
exports.adminBulkImportDepartments = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const performedByEmail = request.auth?.token?.email ?? "unknown";
    const result = { created: 0, updated: 0, errors: [] };
    const rows = data.rows ?? [];
    // Duplicate detection within CSV
    const seenKeys = new Map();
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const key = (row.ministryDepartment ?? "").trim().toLowerCase() + "|" + data.orgId;
        if (seenKeys.has(key)) {
            result.errors.push({
                row: i + 1,
                field: "ministryDepartment",
                message: `Duplicate ministryDepartment "${row.ministryDepartment}" in import (first seen at row ${seenKeys.get(key) + 1}).`,
            });
        }
        else {
            seenKeys.set(key, i);
        }
    }
    if (result.errors.length > 0)
        return result;
    // Validate rows
    const validRows = [];
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
    if (validRows.length === 0)
        return result;
    const db = admin.firestore();
    // Load existing departments for this org
    const existingSnap = await db
        .collection(constants_1.COLLECTION.ADMIN_DEPTS)
        .where("orgId", "==", data.orgId)
        .get();
    const existingByKey = new Map();
    for (const doc of existingSnap.docs) {
        const d = doc.data();
        const nameVal = (d.ministryDepartment ?? d.departmentName ?? d.name).trim().toLowerCase();
        existingByKey.set(nameVal + "|" + data.orgId, doc);
    }
    const now = (0, helpers_1.nowTimestamp)();
    const ops = [];
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
        }
        else {
            const newRef = db.collection(constants_1.COLLECTION.ADMIN_DEPTS).doc();
            ops.push({
                type: "set",
                ref: newRef,
                data: {
                    orgId: data.orgId,
                    organizationId: data.orgId,
                    tenantId: constants_1.TENANT_ID,
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
        collectionName: constants_1.COLLECTION.ADMIN_DEPTS,
        recordId: "bulk",
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: { created: result.created, updated: result.updated },
    });
    return result;
});
// ─── adminBulkImportCategories ────────────────────────────────────────────────
exports.adminBulkImportCategories = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const performedByEmail = request.auth?.token?.email ?? "unknown";
    const result = { created: 0, updated: 0, errors: [] };
    const rows = data.rows ?? [];
    // Duplicate detection within CSV
    const seenKeys = new Map();
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const key = (row.categoryName ?? "").trim().toLowerCase() + "|" + data.orgId;
        if (seenKeys.has(key)) {
            result.errors.push({
                row: i + 1,
                field: "categoryName",
                message: `Duplicate categoryName "${row.categoryName}" in import (first seen at row ${seenKeys.get(key) + 1}).`,
            });
        }
        else {
            seenKeys.set(key, i);
        }
    }
    if (result.errors.length > 0)
        return result;
    // Validate rows
    const validRows = [];
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
    if (validRows.length === 0)
        return result;
    const db = admin.firestore();
    const existingSnap = await db
        .collection(constants_1.COLLECTION.CATEGORIES)
        .where("orgId", "==", data.orgId)
        .get();
    const existingByKey = new Map();
    for (const doc of existingSnap.docs) {
        const d = doc.data();
        existingByKey.set(d.categoryName.trim().toLowerCase() + "|" + data.orgId, doc);
    }
    const now = (0, helpers_1.nowTimestamp)();
    const ops = [];
    for (const { row } of validRows) {
        const name = row.categoryName.trim();
        const key = name.toLowerCase() + "|" + data.orgId;
        const existing = existingByKey.get(key);
        const activeVal = row.active === undefined || row.active === "" ? true : parseBool(row.active);
        if (existing) {
            const updateData = {
                categoryId: row.categoryId.trim(),
                categoryName: name,
                active: activeVal,
                updatedAt: now,
            };
            ops.push({ type: "update", ref: existing.ref, data: updateData });
            result.updated++;
        }
        else {
            const newRef = db.collection(constants_1.COLLECTION.CATEGORIES).doc();
            ops.push({
                type: "set",
                ref: newRef,
                data: {
                    orgId: data.orgId,
                    tenantId: constants_1.TENANT_ID,
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
        collectionName: constants_1.COLLECTION.CATEGORIES,
        recordId: "bulk",
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: { created: result.created, updated: result.updated },
    });
    return result;
});
// ─── adminBulkImportVendors ───────────────────────────────────────────────────
exports.adminBulkImportVendors = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const performedByEmail = request.auth?.token?.email ?? "unknown";
    const result = { created: 0, updated: 0, errors: [] };
    const rows = data.rows ?? [];
    // Duplicate detection within CSV
    const seenKeys = new Map();
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const key = (row.vendorName ?? "").trim().toLowerCase() + "|" + data.orgId;
        if (seenKeys.has(key)) {
            result.errors.push({
                row: i + 1,
                field: "vendorName",
                message: `Duplicate vendorName "${row.vendorName}" in import (first seen at row ${seenKeys.get(key) + 1}).`,
            });
        }
        else {
            seenKeys.set(key, i);
        }
    }
    if (result.errors.length > 0)
        return result;
    // Validate rows
    const validRows = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!(row.vendorName ?? "").trim()) {
            result.errors.push({ row: i + 1, field: "vendorName", message: "vendorName is required." });
            continue;
        }
        validRows.push({ idx: i, row });
    }
    if (validRows.length === 0)
        return result;
    const db = admin.firestore();
    const existingSnap = await db
        .collection(constants_1.COLLECTION.VENDORS)
        .where("orgId", "==", data.orgId)
        .get();
    // Match against vendorName field
    const existingByKey = new Map();
    for (const doc of existingSnap.docs) {
        const d = doc.data();
        existingByKey.set(d.vendorName.trim().toLowerCase() + "|" + data.orgId, doc);
    }
    const now = (0, helpers_1.nowTimestamp)();
    const ops = [];
    for (const { row } of validRows) {
        const name = row.vendorName.trim();
        const key = name.toLowerCase() + "|" + data.orgId;
        const existing = existingByKey.get(key);
        const activeVal = row.active === undefined || row.active === "" ? true : parseBool(row.active);
        const w9OnFileVal = parseBool(row.w9OnFile);
        const is1099Val = parseBool(row.is1099Required);
        if (existing) {
            const existingData = existing.data();
            const updateData = {
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
        }
        else {
            const newRef = db.collection(constants_1.COLLECTION.VENDORS).doc();
            ops.push({
                type: "set",
                ref: newRef,
                data: {
                    orgId: data.orgId,
                    tenantId: constants_1.TENANT_ID,
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
        collectionName: constants_1.COLLECTION.VENDORS,
        recordId: "bulk",
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: { created: result.created, updated: result.updated },
    });
    return result;
});
// ─── adminBulkImportCategoryBudgets ──────────────────────────────────────────
exports.adminBulkImportCategoryBudgets = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const performedByEmail = request.auth?.token?.email ?? "unknown";
    const result = { created: 0, updated: 0, errors: [] };
    const rows = data.rows ?? [];
    // Duplicate detection within CSV
    const seenKeys = new Map();
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const key = (row.organizationId ?? "").trim().toLowerCase() +
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
                message: `Duplicate combination in import (first seen at row ${seenKeys.get(key) + 1}).`,
            });
        }
        else {
            seenKeys.set(key, i);
        }
    }
    if (result.errors.length > 0)
        return result;
    // Validate rows
    const validRows = [];
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
    if (validRows.length === 0)
        return result;
    const db = admin.firestore();
    // Load existing budgets for this org
    const existingSnap = await db
        .collection(constants_1.COLLECTION.CATEGORY_BUDGETS)
        .where("orgId", "==", data.orgId)
        .get();
    const existingByKey = new Map();
    for (const doc of existingSnap.docs) {
        const d = doc.data();
        const k = data.orgId.toLowerCase() +
            "|" +
            d.year +
            "|" +
            d.ministryDepartment.trim().toLowerCase();
        existingByKey.set(k, doc);
    }
    const now = (0, helpers_1.nowTimestamp)();
    const ops = [];
    for (const { row } of validRows) {
        const year = parseInt(row.year, 10);
        const ministryDepartment = row.ministryDepartment.trim();
        const approvedAnnualBudget = parseFloat(row.approvedAnnualBudget);
        const key = data.orgId.toLowerCase() +
            "|" +
            year +
            "|" +
            ministryDepartment.toLowerCase();
        const existing = existingByKey.get(key);
        if (existing) {
            const updateData = {
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
        }
        else {
            const newRef = db.collection(constants_1.COLLECTION.CATEGORY_BUDGETS).doc();
            ops.push({
                type: "set",
                ref: newRef,
                data: {
                    orgId: data.orgId,
                    organizationId: data.orgId,
                    tenantId: constants_1.TENANT_ID,
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
        collectionName: constants_1.COLLECTION.CATEGORY_BUDGETS,
        recordId: "bulk",
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: { created: result.created, updated: result.updated },
    });
    return result;
});
// ─── adminBulkImportEscalationRules ──────────────────────────────────────────
exports.adminBulkImportEscalationRules = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const performedByEmail = request.auth?.token?.email ?? "unknown";
    const result = { created: 0, updated: 0, errors: [] };
    const rows = data.rows ?? [];
    // Duplicate detection within CSV
    const seenKeys = new Map();
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const key = (row.step ?? "") + "|" + (row.role ?? "").trim().toUpperCase() + "|" + data.orgId;
        if (seenKeys.has(key)) {
            result.errors.push({
                row: i + 1,
                field: "step+role",
                message: `Duplicate step+role combination "${row.step}/${row.role}" in import (first seen at row ${seenKeys.get(key) + 1}).`,
            });
        }
        else {
            seenKeys.set(key, i);
        }
    }
    if (result.errors.length > 0)
        return result;
    // Validate rows
    const validRows = [];
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
    if (validRows.length === 0)
        return result;
    const db = admin.firestore();
    const existingSnap = await db
        .collection(constants_1.COLLECTION.ESCALATION_RULES)
        .where("orgId", "==", data.orgId)
        .get();
    const existingByKey = new Map();
    for (const doc of existingSnap.docs) {
        const d = doc.data();
        const k = d.step + "|" + d.role.toUpperCase() + "|" + data.orgId;
        existingByKey.set(k, doc);
    }
    const now = (0, helpers_1.nowTimestamp)();
    const ops = [];
    for (const { row } of validRows) {
        const step = parseInt(row.step, 10);
        const role = row.role.trim().toUpperCase();
        const threshold = parseFloat(row.threshold);
        const bufferAmount = row.bufferAmount ? parseFloat(row.bufferAmount) : undefined;
        const key = step + "|" + role + "|" + data.orgId;
        const existing = existingByKey.get(key);
        if (existing) {
            const updateData = {
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
        }
        else {
            const newRef = db.collection(constants_1.COLLECTION.ESCALATION_RULES).doc();
            ops.push({
                type: "set",
                ref: newRef,
                data: {
                    orgId: data.orgId,
                    tenantId: constants_1.TENANT_ID,
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
        collectionName: constants_1.COLLECTION.ESCALATION_RULES,
        recordId: "bulk",
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: { created: result.created, updated: result.updated },
    });
    return result;
});
// ─── adminBulkImportQBAccounts ────────────────────────────────────────────────
exports.adminBulkImportQBAccounts = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [constants_1.ROLE.ADMIN]);
    const performedByEmail = request.auth?.token?.email ?? "unknown";
    const result = { created: 0, updated: 0, errors: [] };
    const rows = data.rows ?? [];
    // Duplicate detection within CSV
    const seenKeys = new Map();
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const key = (row.accountName ?? "").trim().toLowerCase() + "|" + data.orgId;
        if (seenKeys.has(key)) {
            result.errors.push({
                row: i + 1,
                field: "accountName",
                message: `Duplicate accountName "${row.accountName}" in import (first seen at row ${seenKeys.get(key) + 1}).`,
            });
        }
        else {
            seenKeys.set(key, i);
        }
    }
    if (result.errors.length > 0)
        return result;
    // Validate rows
    const validRows = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!(row.accountName ?? "").trim()) {
            result.errors.push({ row: i + 1, field: "accountName", message: "accountName is required." });
            continue;
        }
        validRows.push({ idx: i, row });
    }
    if (validRows.length === 0)
        return result;
    const db = admin.firestore();
    const existingSnap = await db
        .collection(constants_1.COLLECTION.QB_PAYMENT_ACCOUNTS)
        .where("orgId", "==", data.orgId)
        .get();
    // Match against `name` field
    const existingByKey = new Map();
    for (const doc of existingSnap.docs) {
        const d = doc.data();
        const nameVal = (d.name ?? d.accountName).trim().toLowerCase();
        existingByKey.set(nameVal + "|" + data.orgId, doc);
    }
    const now = (0, helpers_1.nowTimestamp)();
    const ops = [];
    for (const { row } of validRows) {
        const name = row.accountName.trim();
        const key = name.toLowerCase() + "|" + data.orgId;
        const existing = existingByKey.get(key);
        if (existing) {
            const updateData = {
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
        }
        else {
            const newRef = db.collection(constants_1.COLLECTION.QB_PAYMENT_ACCOUNTS).doc();
            const newStatus = row.status === "inactive" ? "inactive" : "active";
            ops.push({
                type: "set",
                ref: newRef,
                data: {
                    orgId: data.orgId,
                    tenantId: constants_1.TENANT_ID,
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
        collectionName: constants_1.COLLECTION.QB_PAYMENT_ACCOUNTS,
        recordId: "bulk",
        orgId: data.orgId,
        performedBy: uid,
        performedByEmail,
        payload: { created: result.created, updated: result.updated },
    });
    return result;
});
