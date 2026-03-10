"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountingExportService = void 0;
const firestore_1 = require("firebase-admin/firestore");
const collections_1 = require("../config/collections");
const errors_1 = require("../utils/errors");
const firestore_2 = require("../utils/firestore");
const csv_1 = require("../utils/csv");
const exportStorageService_1 = require("./exportStorageService");
const quickbooksExportMapper_1 = require("./quickbooksExportMapper");
const QUICKBOOKS_EXPORT_TYPE = "quickbooks_expense_export";
const QUICKBOOKS_EXPORTABLE_REQUEST_STATUSES = new Set(["EXPENSE_APPROVED", "PAID"]);
const QUICKBOOKS_EXPORTABLE_REPORT_STATUSES = new Set(["APPROVED", "PAID"]);
const parseDateAsStartUtc = (raw, field) => {
    const parsed = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
        throw new errors_1.AppError(`Invalid ${field}.`, "validation/invalid-date", 400);
    }
    return firestore_1.Timestamp.fromDate(parsed);
};
const parseDateAsEndUtc = (raw, field) => {
    const parsed = new Date(`${raw}T23:59:59.999Z`);
    if (Number.isNaN(parsed.getTime())) {
        throw new errors_1.AppError(`Invalid ${field}.`, "validation/invalid-date", 400);
    }
    return firestore_1.Timestamp.fromDate(parsed);
};
const dateToIso = (value) => value ? value.toDate().toISOString().slice(0, 10) : "";
const chunkIds = (ids, size) => {
    const chunks = [];
    for (let i = 0; i < ids.length; i += size) {
        chunks.push(ids.slice(i, i + size));
    }
    return chunks;
};
const fetchByDocumentIds = async (collection, ids) => {
    const map = new Map();
    if (ids.length === 0) {
        return map;
    }
    const chunks = chunkIds(Array.from(new Set(ids)), 30);
    for (const idChunk of chunks) {
        const snap = await firestore_2.db
            .collection(collection)
            .where(firestore_1.FieldPath.documentId(), "in", idChunk)
            .get();
        snap.forEach((doc) => {
            map.set(doc.id, doc.data());
        });
    }
    return map;
};
const isQuickbooksExpenseLineExportEligible = (request, report) => {
    if (!request || !report) {
        return false;
    }
    return (QUICKBOOKS_EXPORTABLE_REQUEST_STATUSES.has(request.status) &&
        QUICKBOOKS_EXPORTABLE_REPORT_STATUSES.has(report.status));
};
const toHistoryItem = (id, value) => ({
    id,
    tenantId: value.tenantId,
    organizationId: value.organizationId,
    exportType: value.exportType,
    status: value.status,
    dateFrom: value.dateFrom.toDate().toISOString().slice(0, 10),
    dateTo: value.dateTo.toDate().toISOString().slice(0, 10),
    generatedBy: value.generatedBy,
    generatedAt: value.generatedAt.toDate().toISOString(),
    fileUrl: value.fileUrl,
    rowCount: value.rowCount,
    metadata: value.metadata || {}
});
exports.accountingExportService = {
    async generateQuickbooksExpenseExport(input) {
        const dateFrom = parseDateAsStartUtc(input.dateFrom, "dateFrom");
        const dateTo = parseDateAsEndUtc(input.dateTo, "dateTo");
        if (dateFrom.toMillis() > dateTo.toMillis()) {
            throw new errors_1.AppError("dateFrom must be before or equal to dateTo.", "validation/invalid-range", 400);
        }
        const organizationSnap = await firestore_2.db.collection(collections_1.COLLECTIONS.organizations).doc(input.organizationId).get();
        if (!organizationSnap.exists) {
            throw new errors_1.AppError("Organization not found.", "organization/not-found", 404);
        }
        const organization = organizationSnap.data();
        if (organization.tenantId !== input.tenantId) {
            throw new errors_1.AppError("Organization does not belong to tenant.", "organization/forbidden", 403);
        }
        const exportRef = firestore_2.db.collection(collections_1.COLLECTIONS.accountingExports).doc();
        const now = firestore_1.Timestamp.now();
        const baseExport = {
            tenantId: input.tenantId,
            organizationId: input.organizationId,
            exportType: QUICKBOOKS_EXPORT_TYPE,
            status: "RUNNING",
            dateFrom,
            dateTo,
            generatedBy: input.generatedBy,
            generatedAt: now,
            fileUrl: "",
            rowCount: 0,
            metadata: {
                format: "csv",
                bridge: "accountingExportService",
                mapper: "quickbooksExportMapper",
                eligibilityRule: "Expense line items exported only when purchase request status in [EXPENSE_APPROVED, PAID] and expense report status in [APPROVED, PAID].",
                columns: quickbooksExportMapper_1.QUICKBOOKS_EXPORT_HEADERS
            }
        };
        await exportRef.set(baseExport);
        try {
            const lineItemsSnap = await firestore_2.db
                .collection(collections_1.COLLECTIONS.expenseLineItems)
                .where("tenantId", "==", input.tenantId)
                .where("organizationId", "==", input.organizationId)
                .where("expenseDate", ">=", dateFrom)
                .where("expenseDate", "<=", dateTo)
                .orderBy("expenseDate", "asc")
                .get();
            const lineItems = lineItemsSnap.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            }));
            const requestMap = await fetchByDocumentIds(collections_1.COLLECTIONS.purchaseRequests, lineItems.map((item) => item.requestId));
            const reportMap = await fetchByDocumentIds(collections_1.COLLECTIONS.expenseReports, lineItems.map((item) => item.reportId));
            const vendorMap = await fetchByDocumentIds(collections_1.COLLECTIONS.vendors, lineItems.map((item) => item.vendorId));
            const categoryMap = await fetchByDocumentIds(collections_1.COLLECTIONS.categories, lineItems.map((item) => item.categoryId));
            const eligibleInputRows = [];
            for (const lineItem of lineItems) {
                const request = requestMap.get(lineItem.requestId) || null;
                const report = reportMap.get(lineItem.reportId) || null;
                if (!isQuickbooksExpenseLineExportEligible(request, report)) {
                    continue;
                }
                if (!request || request.tenantId !== input.tenantId || request.organizationId !== input.organizationId) {
                    continue;
                }
                const vendor = vendorMap.get(lineItem.vendorId);
                const category = categoryMap.get(lineItem.categoryId);
                eligibleInputRows.push({
                    lineItemId: lineItem.id,
                    requestId: lineItem.requestId,
                    orgName: organization.name,
                    ministryDepartment: request.ministryDepartment || "",
                    event: request.purpose || "",
                    vendorName: vendor?.name || lineItem.vendorId,
                    expenseDate: dateToIso(lineItem.expenseDate),
                    categoryName: category?.name || lineItem.categoryId,
                    description: lineItem.description || "",
                    amount: Number(lineItem.amount || 0),
                    fund: null
                });
            }
            const requestFunds = Array.from(new Set(eligibleInputRows
                .map((row) => requestMap.get(row.requestId)?.fundId || "")
                .filter((id) => id.length > 0)));
            const fundMap = await fetchByDocumentIds(collections_1.COLLECTIONS.funds, requestFunds);
            eligibleInputRows.forEach((row) => {
                const request = requestMap.get(row.requestId);
                const fund = request ? fundMap.get(request.fundId) || null : null;
                row.fund = fund;
            });
            const mappedRows = quickbooksExportMapper_1.quickbooksExportMapper.mapRows(eligibleInputRows);
            const jsonPayload = {
                exportType: QUICKBOOKS_EXPORT_TYPE,
                tenantId: input.tenantId,
                organizationId: input.organizationId,
                filters: {
                    dateFrom: input.dateFrom,
                    dateTo: input.dateTo
                },
                rowCount: mappedRows.length,
                columns: quickbooksExportMapper_1.QUICKBOOKS_EXPORT_HEADERS,
                rows: mappedRows
            };
            const csvContent = (0, csv_1.buildCsv)({
                headers: quickbooksExportMapper_1.QUICKBOOKS_EXPORT_HEADERS,
                rows: mappedRows
            });
            const upload = await exportStorageService_1.exportStorageService.uploadCsv({
                tenantId: input.tenantId,
                organizationId: input.organizationId,
                exportId: exportRef.id,
                csvContent
            });
            await exportRef.update({
                status: "COMPLETED",
                generatedAt: firestore_1.Timestamp.now(),
                fileUrl: upload.fileUrl,
                rowCount: mappedRows.length,
                metadata: {
                    ...(baseExport.metadata || {}),
                    storagePath: upload.storagePath,
                    jsonPayloadSummary: {
                        exportType: jsonPayload.exportType,
                        rowCount: jsonPayload.rowCount,
                        columns: jsonPayload.columns
                    }
                }
            });
            return {
                exportId: exportRef.id,
                status: "COMPLETED",
                fileUrl: upload.fileUrl,
                rowCount: mappedRows.length,
                exportType: QUICKBOOKS_EXPORT_TYPE
            };
        }
        catch (error) {
            await exportRef.update({
                status: "FAILED",
                generatedAt: firestore_1.Timestamp.now(),
                metadata: {
                    ...(baseExport.metadata || {}),
                    errorMessage: error instanceof Error ? error.message : "Unknown export failure"
                }
            });
            if (error instanceof errors_1.AppError) {
                throw error;
            }
            throw new errors_1.AppError("Failed to generate export.", "accounting-export/failed", 500);
        }
    },
    async listAccountingExports(input) {
        const limit = Math.min(Math.max(Number(input.limit || 25), 1), 100);
        const snap = await firestore_2.db
            .collection(collections_1.COLLECTIONS.accountingExports)
            .where("tenantId", "==", input.tenantId)
            .where("organizationId", "==", input.organizationId)
            .orderBy("generatedAt", "desc")
            .limit(limit)
            .get();
        return snap.docs.map((doc) => toHistoryItem(doc.id, doc.data()));
    }
};
