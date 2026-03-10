import { Fund } from "../models/fund";

export interface QuickbooksExportInputRow {
  lineItemId: string;
  requestId: string;
  orgName: string;
  ministryDepartment: string;
  event: string;
  vendorName: string;
  expenseDate: string;
  categoryName: string;
  description: string;
  amount: number;
  fund: Fund | null;
}

export interface QuickbooksExpenseExportRow {
  LineID: string;
  RequestID: string;
  Org: string;
  "Class (MinistryDepartment)": string;
  Event: string;
  Vendor: string;
  ExpenseDate: string;
  Category: string;
  Description: string;
  Amount: number;
  "Tag (Event/Special Projects)": string;
}

const tagFromFund = (fund: Fund | null): string => {
  if (!fund) {
    return "";
  }
  if (fund.fundType === "Events" || fund.fundType === "Special Projects") {
    return fund.fundName;
  }
  return "";
};

export const QUICKBOOKS_EXPORT_HEADERS: string[] = [
  "LineID",
  "RequestID",
  "Org",
  "Class (MinistryDepartment)",
  "Event",
  "Vendor",
  "ExpenseDate",
  "Category",
  "Description",
  "Amount",
  "Tag (Event/Special Projects)"
];

export const quickbooksExportMapper = {
  mapRows(inputRows: QuickbooksExportInputRow[]): QuickbooksExpenseExportRow[] {
    const rowsByRequest = new Map<string, QuickbooksExportInputRow[]>();
    inputRows.forEach((row) => {
      if (!rowsByRequest.has(row.requestId)) {
        rowsByRequest.set(row.requestId, []);
      }
      rowsByRequest.get(row.requestId)!.push(row);
    });

    const mapped: QuickbooksExpenseExportRow[] = [];
    Array.from(rowsByRequest.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([requestId, rows]) => {
        rows
          .slice()
          .sort((left, right) => {
            const byDate = left.expenseDate.localeCompare(right.expenseDate);
            if (byDate !== 0) {
              return byDate;
            }
            return left.lineItemId.localeCompare(right.lineItemId);
          })
          .forEach((row, index) => {
            const sequence = index + 1;
            mapped.push({
              LineID: `${requestId}-L${sequence}`,
              RequestID: requestId,
              Org: row.orgName,
              "Class (MinistryDepartment)": row.ministryDepartment,
              Event: row.event,
              Vendor: row.vendorName,
              ExpenseDate: row.expenseDate,
              Category: row.categoryName,
              Description: row.description,
              Amount: row.amount,
              "Tag (Event/Special Projects)": tagFromFund(row.fund)
            });
          });
      });

    return mapped;
  }
};
