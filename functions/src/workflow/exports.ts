import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { COLLECTION, ROLE, STATUS } from "./constants";
import { requireRole, verifyOrgAccess } from "./helpers";
import { LineItem, Request } from "./types";

// ─── generateQBBookkeepingSummary ─────────────────────────────────────────────

/**
 * Requires FINANCE role.
 * Returns an array of line items with associated request info for QB export.
 * Filters by org, date range, and statuses in [PAID, QB_SENT, QB_ENTERED].
 */
export const generateQBBookkeepingSummary = onCall(
  async (request: CallableRequest) => {
    const data = request.data as {
      orgId: string;
      startDate: string; // ISO date string (YYYY-MM-DD)
      endDate: string; // ISO date string (YYYY-MM-DD)
    };
    const uid = await verifyOrgAccess(request, data.orgId);
    await requireRole(uid, data.orgId, [
      ROLE.ADMIN,
      ROLE.FINANCE_PAYOR,
      ROLE.FINANCE_QB_ENTRY,
      ROLE.FINANCE_RECEIPTS_REVIEWER,
    ]);

    if (!data.startDate || !data.endDate) {
      throw new HttpsError(
        "invalid-argument",
        "startDate and endDate are required."
      );
    }

    const startTs = admin.firestore.Timestamp.fromDate(
      new Date(`${data.startDate}T00:00:00.000Z`)
    );
    const endTs = admin.firestore.Timestamp.fromDate(
      new Date(`${data.endDate}T23:59:59.999Z`)
    );

    const db = admin.firestore();

    // Fetch paid/QB requests within the date range
    const exportStatuses = [STATUS.PAID, STATUS.QB_SENT, STATUS.QB_ENTERED];

    const requestsSnap = await db
      .collection(COLLECTION.REQUESTS)
      .where("orgId", "==", data.orgId)
      .where("status", "in", exportStatuses)
      .where("paidAt", ">=", startTs)
      .where("paidAt", "<=", endTs)
      .orderBy("paidAt", "asc")
      .get();

    const requests = requestsSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as Request)
    );

    if (requests.length === 0) {
      return { rows: [], count: 0 };
    }

    // Fetch line items for all these requests
    const requestIds = requests.map((r) => r.id);

    // Firestore 'in' queries are limited to 30 items per query
    const chunks: string[][] = [];
    for (let i = 0; i < requestIds.length; i += 30) {
      chunks.push(requestIds.slice(i, i + 30));
    }

    const allLineItems: LineItem[] = [];
    for (const chunk of chunks) {
      const liSnap = await db
        .collection(COLLECTION.LINE_ITEMS)
        .where("requestId", "in", chunk)
        .get();
      allLineItems.push(
        ...liSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LineItem))
      );
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
      if (a.paidAt < b.paidAt) return -1;
      if (a.paidAt > b.paidAt) return 1;
      return a.requestId.localeCompare(b.requestId);
    });

    return {
      rows,
      count: rows.length,
      requestCount: requests.length,
      startDate: data.startDate,
      endDate: data.endDate,
    };
  }
);

// ─── pingServer ───────────────────────────────────────────────────────────────

/**
 * Health check endpoint. Returns { ok: true, timestamp }.
 */
export const pingServer = onCall(async (_request: CallableRequest) => {
  return {
    ok: true,
    timestamp: new Date().toISOString(),
  };
});
