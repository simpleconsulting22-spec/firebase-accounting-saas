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
exports.pingServer = exports.generateQBBookkeepingSummary = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const constants_1 = require("./constants");
const helpers_1 = require("./helpers");
// ─── generateQBBookkeepingSummary ─────────────────────────────────────────────
/**
 * Requires FINANCE role.
 * Returns an array of line items with associated request info for QB export.
 * Filters by org, date range, and statuses in [PAID, QB_SENT, QB_ENTERED].
 */
exports.generateQBBookkeepingSummary = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const uid = await (0, helpers_1.verifyOrgAccess)(request, data.orgId);
    await (0, helpers_1.requireRole)(uid, data.orgId, [
        constants_1.ROLE.ADMIN,
        constants_1.ROLE.FINANCE_PAYOR,
        constants_1.ROLE.FINANCE_QB_ENTRY,
        constants_1.ROLE.FINANCE_RECEIPTS_REVIEWER,
    ]);
    if (!data.startDate || !data.endDate) {
        throw new https_1.HttpsError("invalid-argument", "startDate and endDate are required.");
    }
    const startTs = admin.firestore.Timestamp.fromDate(new Date(`${data.startDate}T00:00:00.000Z`));
    const endTs = admin.firestore.Timestamp.fromDate(new Date(`${data.endDate}T23:59:59.999Z`));
    const db = admin.firestore();
    // Fetch paid/QB requests within the date range
    const exportStatuses = [constants_1.STATUS.PAID, constants_1.STATUS.QB_SENT, constants_1.STATUS.QB_ENTERED];
    const requestsSnap = await db
        .collection(constants_1.COLLECTION.REQUESTS)
        .where("orgId", "==", data.orgId)
        .where("status", "in", exportStatuses)
        .where("paidAt", ">=", startTs)
        .where("paidAt", "<=", endTs)
        .orderBy("paidAt", "asc")
        .get();
    const requests = requestsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (requests.length === 0) {
        return { rows: [], count: 0 };
    }
    // Fetch line items for all these requests
    const requestIds = requests.map((r) => r.id);
    // Firestore 'in' queries are limited to 30 items per query
    const chunks = [];
    for (let i = 0; i < requestIds.length; i += 30) {
        chunks.push(requestIds.slice(i, i + 30));
    }
    const allLineItems = [];
    for (const chunk of chunks) {
        const liSnap = await db
            .collection(constants_1.COLLECTION.LINE_ITEMS)
            .where("requestId", "in", chunk)
            .get();
        allLineItems.push(...liSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    // Build a map for quick lookup
    const requestMap = new Map(requests.map((r) => [r.id, r]));
    // Build export rows
    const rows = allLineItems.map((li) => {
        const req = requestMap.get(li.requestId);
        return {
            // Request fields
            requestId: li.requestId,
            requestDate: req?.requestedExpenseDate ?? "",
            paidAt: req?.paidAt?.toDate().toISOString() ?? "",
            paymentMethod: req?.paymentMethod ?? "",
            paymentReference: req?.paymentReference ?? "",
            requestorName: req?.requestorName ?? "",
            requestorEmail: req?.requestorEmail ?? "",
            ministryDepartment: req?.ministryDepartment ?? "",
            fundId: req?.fundId ?? "",
            vendorName: req?.vendorName ?? li.vendorName,
            purpose: req?.purpose ?? "",
            status: req?.status ?? "",
            // Line item fields
            lineItemId: li.id,
            lineItemDescription: li.description,
            lineItemCategory: li.category,
            lineItemAmount: li.amount,
            lineItemReceiptDate: li.receiptDate,
            lineItemNotes: li.notes,
        };
    });
    // Sort by paidAt then requestId for consistent ordering
    rows.sort((a, b) => {
        if (a.paidAt < b.paidAt)
            return -1;
        if (a.paidAt > b.paidAt)
            return 1;
        return a.requestId.localeCompare(b.requestId);
    });
    return {
        rows,
        count: rows.length,
        requestCount: requests.length,
        startDate: data.startDate,
        endDate: data.endDate,
    };
});
// ─── pingServer ───────────────────────────────────────────────────────────────
/**
 * Health check endpoint. Returns { ok: true, timestamp }.
 */
exports.pingServer = (0, https_1.onCall)(async (_request) => {
    return {
        ok: true,
        timestamp: new Date().toISOString(),
    };
});
