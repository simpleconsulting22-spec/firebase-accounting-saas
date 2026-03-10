"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quickbooksExportMapper = exports.QUICKBOOKS_EXPORT_HEADERS = void 0;
const tagFromFund = (fund) => {
    if (!fund) {
        return "";
    }
    if (fund.fundType === "Events" || fund.fundType === "Special Projects") {
        return fund.fundName;
    }
    return "";
};
exports.QUICKBOOKS_EXPORT_HEADERS = [
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
exports.quickbooksExportMapper = {
    mapRows(inputRows) {
        const rowsByRequest = new Map();
        inputRows.forEach((row) => {
            if (!rowsByRequest.has(row.requestId)) {
                rowsByRequest.set(row.requestId, []);
            }
            rowsByRequest.get(row.requestId).push(row);
        });
        const mapped = [];
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
