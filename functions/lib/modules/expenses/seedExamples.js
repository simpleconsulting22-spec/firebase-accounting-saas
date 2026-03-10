"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expensesEmulatorSeedExamples = void 0;
exports.expensesEmulatorSeedExamples = [
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
                financialReports: false,
                payroll: false,
                donations: false
            },
            createdAt: "2026-01-01T00:00:00.000Z"
        }
    },
    {
        collection: "organizations",
        id: "org_citylight",
        data: {
            tenantId: "tenant_citylight_group",
            name: "CityLight Church",
            type: "church",
            vendorGroupId: "vg_citylight_related",
            categoryGroupId: "cg_citylight_glow_shared",
            createdAt: "2026-01-01T00:00:00.000Z"
        }
    },
    {
        collection: "users",
        id: "seed-user-1",
        data: {
            email: "requestor@citylight.org",
            tenantId: "tenant_citylight_group",
            orgRoles: {
                org_citylight: ["requestor", "approver"]
            },
            createdAt: "2026-01-01T00:00:00.000Z"
        }
    },
    {
        collection: "funds",
        id: "fund_ops_2026",
        data: {
            tenantId: "tenant_citylight_group",
            organizationId: "org_citylight",
            ministryDepartment: "Operations",
            fundName: "General Operating",
            fundType: "Operating",
            annualBudget: 100000,
            year: 2026,
            createdAt: "2026-01-01T00:00:00.000Z",
            active: true
        }
    },
    {
        collection: "purchaseRequests",
        id: "pr_seed_001",
        data: {
            tenantId: "tenant_citylight_group",
            organizationId: "org_citylight",
            fundId: "fund_ops_2026",
            ministryDepartment: "Operations",
            requestorId: "seed-user-1",
            approverId: "seed-user-1",
            estimatedAmount: 500,
            approvedAmount: 0,
            actualAmount: 0,
            status: "DRAFT",
            plannedPaymentMethod: "card",
            purpose: "Seed purchase request",
            description: "Safe emulator seed example",
            requestedExpenseDate: "2026-03-01T00:00:00.000Z",
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-01T00:00:00.000Z"
        }
    }
];
