export interface AccountingExportSeedDoc {
  collection: string;
  id: string;
  data: Record<string, unknown>;
}

export const accountingExportSeedExamples: AccountingExportSeedDoc[] = [
  {
    collection: "tenants",
    id: "tenant_citylight_group",
    data: {
      name: "CityLight Group",
      plan: "pro",
      modulesEnabled: {
        expenses: true,
        generalLedger: false,
        fixedAssets: false,
        financialReports: true,
        payroll: false,
        donations: false
      },
      createdAt: "2026-01-01T00:00:00.000Z"
    }
  },
  {
    collection: "accountingExports",
    id: "exp_seed_001",
    data: {
      tenantId: "tenant_citylight_group",
      organizationId: "org_citylight",
      exportType: "quickbooks_expense_export",
      status: "COMPLETED",
      dateFrom: "2026-03-01T00:00:00.000Z",
      dateTo: "2026-03-31T23:59:59.999Z",
      generatedBy: "seed-user-finance",
      generatedAt: "2026-04-01T12:00:00.000Z",
      fileUrl: "https://example.com/exports/tenant_citylight_group/org_citylight/exp_seed_001.csv",
      rowCount: 18,
      metadata: {
        format: "csv",
        bridge: "accountingExportService",
        mapper: "quickbooksExportMapper"
      }
    }
  }
];
