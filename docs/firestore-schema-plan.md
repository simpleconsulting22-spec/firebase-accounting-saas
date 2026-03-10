# Firestore Schema Plan (Phase 6)

This plan preserves a strict multi-tenant model:

- `tenant` = paying customer/network
- `organization` = church/nonprofit/business entity under that tenant

All financial records must include `tenantId` and `organizationId`.

## Top-level collections (exact names)

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

## Collection field definitions

### tenants
- name
- createdAt
- plan
- modulesEnabled

### organizations
- tenantId
- name
- type
- vendorGroupId
- categoryGroupId
- createdAt

### users
- email
- tenantId
- orgRoles
- vendorGroupIds (optional)
- categoryGroupIds (optional)
- createdAt

### vendors
- tenantId
- vendorGroupId
- name
- paymentMethods
- createdAt
- active

### categories
- tenantId
- categoryGroupId
- organizationId (optional)
- name
- active
- createdAt

### funds
- tenantId
- organizationId
- ministryDepartment
- fundName
- fundType
- annualBudget
- year
- createdAt
- active

### purchaseRequests
- tenantId
- organizationId
- fundId
- ministryDepartment
- requestorId
- approverId
- estimatedAmount
- approvedAmount
- actualAmount
- status
- plannedPaymentMethod
- purpose
- description
- requestedExpenseDate
- createdAt
- updatedAt

### expenseReports
- tenantId
- organizationId
- requestId
- status
- postingStatus (optional)
- journalEntryId (optional)
- postedAt (optional)
- postingError (optional)
- submittedAt
- createdAt
- updatedAt

### expenseLineItems
- tenantId
- organizationId
- reportId
- requestId
- vendorId
- categoryId
- amount
- expenseDate
- description
- receiptUrl
- createdAt
- updatedAt

### approvals
- tenantId
- organizationId
- requestId
- reportId (optional)
- step
- decision
- approvedBy
- approvedAt
- comments
- createdAt

### accountingExports
- tenantId
- organizationId
- exportType
- status
- dateFrom
- dateTo
- generatedBy
- generatedAt
- fileUrl
- rowCount
- metadata

### chartOfAccounts
- tenantId
- organizationId
- accountNumber
- accountName
- accountType
- parentAccountId
- postingRole (optional)
- active
- createdAt
- updatedAt

### journalEntries
- tenantId
- organizationId
- date
- periodKey
- reference
- sourceModule
- sourceId
- status
- memo
- lines
- createdAt
- createdBy

`lines[]` supports:
- accountId
- debit
- credit
- memo
- className
- tagName

### assets
- tenantId
- organizationId
- name
- purchaseDate
- purchaseValue
- usefulLifeYears
- depreciationMethod
- status
- createdAt

### reports
- tenantId
- organizationId
- type
- period
- generatedAt
- createdBy

## Sharing model

- Vendor access is controlled by `vendorGroupId`.
- Category access is controlled by `categoryGroupId`.

Example relationship:
- CityLight + Glow + LDC can share vendors via common `vendorGroupId`.
- CityLight + Glow can share categories via one `categoryGroupId`.
- LDC can use separate categories via different `categoryGroupId`.

## Storage paths

- `receipts/{tenantId}/{organizationId}/{requestId}/{fileId}`
- `exports/{tenantId}/{organizationId}/{exportId}.csv`

## Budget rule

- Annual = `funds.annualBudget`
- Used = sum of `expenseLineItems.amount` for records linked to the same `fundId`
- Remaining = `annualBudget - used`

## AI readiness (not implemented)

Data model is prepared for future collections:
- aiPredictions
- aiInsights
- aiEmbeddings

All finance entities include timestamps and normalized identifiers to support future AI pipelines.
