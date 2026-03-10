# Multi-Tenant Accounting SaaS (Firebase) - Phase 6

This repository contains:

- multi-tenant architecture scaffold
- strict Firestore collection model interfaces
- service-layer backend foundation
- thin controller pattern
- Firestore + Storage security rules
- module-access middleware
- vendor/category sharing foundation
- fund-based budget service foundation
- expenses module workflows (phase 2)
- shared vendors/categories CRUD management by group (phase 3)
- approval workflow for purchase requests and expense reports (phase 4)
- accounting export bridge with QuickBooks-ready expense export (phase 5)
- general ledger foundation with idempotent posting and journal controls (phase 6)
- emulator-ready configuration

No Apps Script migration is included.
No QuickBooks integration is included.
No direct QuickBooks API sync is included.

## Required top-level Firestore collections

- tenants
- organizations
- users
- vendors
- categories
- funds
- purchaseRequests
- expenseReports
- expenseLineItems
- approvals
- accountingExports
- chartOfAccounts
- journalEntries
- assets
- reports

## Tenant and organization model

- tenant = paying customer/network
- organization = church/nonprofit/business entity under a tenant

A tenant may have many organizations.

Every financial document uses both:

- tenantId
- organizationId

## Vendor/category sharing model

- Vendors are scoped by `vendorGroupId`
- Categories are scoped by `categoryGroupId`

This supports:

- organizations that share both vendors and categories
- organizations that share vendors but use separate categories

## Backend architecture

- `/functions/src/modules/*` = module callables/controllers/validation adapters
- `/functions/src/services/*` = business services
- `/functions/src/middleware/*` = auth, tenant/org access, module access checks
- `/functions/src/models/*` = collection interfaces

## Frontend architecture

- `/frontend/src/modules/*` = module pages and components
- `/frontend/src/services/*` = API/auth/module/sharing clients
- `/frontend/src/hooks/*` = auth hook
- `/frontend/src/layouts/*` = app shell

## Accounting Export Bridge (Phase 5)

- New top-level collection: `accountingExports`
- New backend module: `/functions/src/modules/accountingExports`
- Reusable services:
  - `accountingExportService`
  - `quickbooksExportMapper`
  - `exportStorageService`
- CSV utility:
  - `/functions/src/utils/csv.ts`
- Storage path for export files:
  - `exports/{tenantId}/{organizationId}/{exportId}.csv`

### Why this is future-proof

- Export generation is separated from mapping and storage concerns.
- Mapper is specific to QuickBooks-ready shape today, but bridge supports additional `exportType` values (`gl_export`, `reporting_export`).
- Export history persists metadata and status, enabling later:
  - GL journal export pipelines
  - financial reporting extract pipelines
  - AI anomaly/reconciliation review over exported rows

## General Ledger Foundation (Phase 6)

- Chart of Accounts CRUD with org-level uniqueness rules:
  - `accountNumber` unique within organization
  - active `accountName` unique within organization
- Immutable posted Journal Entries with:
  - balanced debit/credit validation
  - `periodKey` foundation (`YYYY-MM`) for future reporting periods
  - account reference validation before posting
- Reusable `glPostingService` with idempotent posting guard by:
  - `tenantId + organizationId + sourceModule + sourceId`
- Expense posting mapper foundation:
  - maps approved/paid expense reports to journal payloads
  - `className` uses `ministryDepartment`
  - `tagName` uses `fundName` for `Events` and `Special Projects`, blank for `Operating`
- Posting status tracking on expense reports:
  - `postingStatus`
  - `journalEntryId`
  - `postedAt`
  - `postingError`
- React admin UI (admin/finance only):
  - Chart of Accounts list + create/edit/delete
  - Journal Entries list + detail view
  - Expense report posting action panel

## Local setup

### 1) Configure Firebase project id

Update `.firebaserc`:

- `your-firebase-project-id`

### 2) Install dependencies

```bash
cd functions
npm install

cd ../frontend
npm install
```

### 3) Start emulators

```bash
cd ..
firebase emulators:start
```

Emulator ports:

- Auth: 9099
- Firestore: 8080
- Functions: 5001
- Storage: 9199
- Emulator UI: 4000

### 4) Start frontend

```bash
cd frontend
npm run dev
```

## Phase 7 scope (next)

- add direct QuickBooks API push option (optional)
- add GL closing/open period workflows
- add financial reporting module implementation on top of `journalEntries`
- add fixed-asset posting integration into GL
- add automated tests for posting idempotency and ledger mappings
