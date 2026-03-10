export const COLLECTIONS = {
  tenants: "tenants",
  organizations: "organizations",
  users: "users",
  vendors: "vendors",
  categories: "categories",
  funds: "funds",
  purchaseRequests: "purchaseRequests",
  expenseReports: "expenseReports",
  expenseLineItems: "expenseLineItems",
  approvals: "approvals",
  accountingExports: "accountingExports",
  chartOfAccounts: "chartOfAccounts",
  journalEntries: "journalEntries",
  assets: "assets",
  reports: "reports"
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

export type ModuleKey =
  | "expenses"
  | "generalLedger"
  | "fixedAssets"
  | "financialReports"
  | "payroll"
  | "donations";
