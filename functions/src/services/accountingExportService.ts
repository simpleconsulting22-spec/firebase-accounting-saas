import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS } from "../config/collections";
import {
  AccountingExport,
  AccountingExportStatus,
  AccountingExportType,
  Category,
  ExpenseLineItem,
  ExpenseReport,
  Organization,
  PurchaseRequest,
  Vendor
} from "../models";
import { AppError } from "../utils/errors";
import { db } from "../utils/firestore";
import { buildCsv } from "../utils/csv";
import { exportStorageService } from "./exportStorageService";
import {
  QUICKBOOKS_EXPORT_HEADERS,
  QuickbooksExportInputRow,
  QuickbooksExpenseExportRow,
  quickbooksExportMapper
} from "./quickbooksExportMapper";
import { Fund } from "../models/fund";

export interface GenerateQuickbooksExpenseExportInput {
  tenantId: string;
  organizationId: string;
  dateFrom: string;
  dateTo: string;
  generatedBy: string;
}

export interface GenerateQuickbooksExpenseExportResult {
  exportId: string;
  status: AccountingExportStatus;
  fileUrl: string;
  rowCount: number;
  exportType: AccountingExportType;
}

export interface ListAccountingExportsInput {
  tenantId: string;
  organizationId: string;
  limit?: number;
}

export interface AccountingExportHistoryItem {
  id: string;
  tenantId: string;
  organizationId: string;
  exportType: AccountingExportType;
  status: AccountingExportStatus;
  dateFrom: string;
  dateTo: string;
  generatedBy: string;
  generatedAt: string;
  fileUrl: string;
  rowCount: number;
  metadata: Record<string, unknown>;
}

const QUICKBOOKS_EXPORT_TYPE: AccountingExportType = "quickbooks_expense_export";
const QUICKBOOKS_EXPORTABLE_REQUEST_STATUSES = new Set(["EXPENSE_APPROVED", "PAID"]);
const QUICKBOOKS_EXPORTABLE_REPORT_STATUSES = new Set(["APPROVED", "PAID"]);

const parseDateAsStartUtc = (raw: string, field: string): Timestamp => {
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${field}.`, "validation/invalid-date", 400);
  }
  return Timestamp.fromDate(parsed);
};

const parseDateAsEndUtc = (raw: string, field: string): Timestamp => {
  const parsed = new Date(`${raw}T23:59:59.999Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${field}.`, "validation/invalid-date", 400);
  }
  return Timestamp.fromDate(parsed);
};

const dateToIso = (value: Timestamp | undefined): string =>
  value ? value.toDate().toISOString().slice(0, 10) : "";

const chunkIds = (ids: string[], size: number): string[][] => {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
};

const fetchByDocumentIds = async <T extends object>(
  collection: string,
  ids: string[]
): Promise<Map<string, T>> => {
  const map = new Map<string, T>();
  if (ids.length === 0) {
    return map;
  }

  const chunks = chunkIds(Array.from(new Set(ids)), 30);
  for (const idChunk of chunks) {
    const snap = await db
      .collection(collection)
      .where(FieldPath.documentId(), "in", idChunk)
      .get();
    snap.forEach((doc) => {
      map.set(doc.id, doc.data() as T);
    });
  }

  return map;
};

const isQuickbooksExpenseLineExportEligible = (
  request: PurchaseRequest | null,
  report: ExpenseReport | null
): boolean => {
  if (!request || !report) {
    return false;
  }
  return (
    QUICKBOOKS_EXPORTABLE_REQUEST_STATUSES.has(request.status) &&
    QUICKBOOKS_EXPORTABLE_REPORT_STATUSES.has(report.status)
  );
};

const toHistoryItem = (id: string, value: AccountingExport): AccountingExportHistoryItem => ({
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

export const accountingExportService = {
  async generateQuickbooksExpenseExport(
    input: GenerateQuickbooksExpenseExportInput
  ): Promise<GenerateQuickbooksExpenseExportResult> {
    const dateFrom = parseDateAsStartUtc(input.dateFrom, "dateFrom");
    const dateTo = parseDateAsEndUtc(input.dateTo, "dateTo");
    if (dateFrom.toMillis() > dateTo.toMillis()) {
      throw new AppError("dateFrom must be before or equal to dateTo.", "validation/invalid-range", 400);
    }

    const organizationSnap = await db.collection(COLLECTIONS.organizations).doc(input.organizationId).get();
    if (!organizationSnap.exists) {
      throw new AppError("Organization not found.", "organization/not-found", 404);
    }

    const organization = organizationSnap.data() as Organization;
    if (organization.tenantId !== input.tenantId) {
      throw new AppError("Organization does not belong to tenant.", "organization/forbidden", 403);
    }

    const exportRef = db.collection(COLLECTIONS.accountingExports).doc();
    const now = Timestamp.now();
    const baseExport: AccountingExport = {
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
        eligibilityRule:
          "Expense line items exported only when purchase request status in [EXPENSE_APPROVED, PAID] and expense report status in [APPROVED, PAID].",
        columns: QUICKBOOKS_EXPORT_HEADERS
      }
    };
    await exportRef.set(baseExport);

    try {
      const lineItemsSnap = await db
        .collection(COLLECTIONS.expenseLineItems)
        .where("tenantId", "==", input.tenantId)
        .where("organizationId", "==", input.organizationId)
        .where("expenseDate", ">=", dateFrom)
        .where("expenseDate", "<=", dateTo)
        .orderBy("expenseDate", "asc")
        .get();

      const lineItems = lineItemsSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as ExpenseLineItem)
      }));

      const requestMap = await fetchByDocumentIds<PurchaseRequest>(
        COLLECTIONS.purchaseRequests,
        lineItems.map((item) => item.requestId)
      );
      const reportMap = await fetchByDocumentIds<ExpenseReport>(
        COLLECTIONS.expenseReports,
        lineItems.map((item) => item.reportId)
      );
      const vendorMap = await fetchByDocumentIds<Vendor>(
        COLLECTIONS.vendors,
        lineItems.map((item) => item.vendorId)
      );
      const categoryMap = await fetchByDocumentIds<Category>(
        COLLECTIONS.categories,
        lineItems.map((item) => item.categoryId)
      );

      const eligibleInputRows: QuickbooksExportInputRow[] = [];
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

      const requestFunds = Array.from(
        new Set(
          eligibleInputRows
            .map((row) => requestMap.get(row.requestId)?.fundId || "")
            .filter((id) => id.length > 0)
        )
      );
      const fundMap = await fetchByDocumentIds<Fund>(COLLECTIONS.funds, requestFunds);

      eligibleInputRows.forEach((row) => {
        const request = requestMap.get(row.requestId);
        const fund = request ? fundMap.get(request.fundId) || null : null;
        row.fund = fund;
      });

      const mappedRows: QuickbooksExpenseExportRow[] = quickbooksExportMapper.mapRows(eligibleInputRows);
      const jsonPayload = {
        exportType: QUICKBOOKS_EXPORT_TYPE,
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        filters: {
          dateFrom: input.dateFrom,
          dateTo: input.dateTo
        },
        rowCount: mappedRows.length,
        columns: QUICKBOOKS_EXPORT_HEADERS,
        rows: mappedRows
      };

      const csvContent = buildCsv({
        headers: QUICKBOOKS_EXPORT_HEADERS,
        rows: mappedRows as unknown as Array<Record<string, unknown>>
      });

      const upload = await exportStorageService.uploadCsv({
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        exportId: exportRef.id,
        csvContent
      });

      await exportRef.update({
        status: "COMPLETED",
        generatedAt: Timestamp.now(),
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
    } catch (error) {
      await exportRef.update({
        status: "FAILED",
        generatedAt: Timestamp.now(),
        metadata: {
          ...(baseExport.metadata || {}),
          errorMessage: error instanceof Error ? error.message : "Unknown export failure"
        }
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to generate export.", "accounting-export/failed", 500);
    }
  },

  async listAccountingExports(input: ListAccountingExportsInput): Promise<AccountingExportHistoryItem[]> {
    const limit = Math.min(Math.max(Number(input.limit || 25), 1), 100);
    const snap = await db
      .collection(COLLECTIONS.accountingExports)
      .where("tenantId", "==", input.tenantId)
      .where("organizationId", "==", input.organizationId)
      .orderBy("generatedAt", "desc")
      .limit(limit)
      .get();

    return snap.docs.map((doc) => toHistoryItem(doc.id, doc.data() as AccountingExport));
  }
};
