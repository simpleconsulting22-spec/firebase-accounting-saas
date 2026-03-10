export interface TenantOrgPayload {
  tenantId: string;
  organizationId: string;
}

export interface CreatePurchaseRequestPayload extends TenantOrgPayload {
  fundId: string;
  ministryDepartment: string;
  approverId: string;
  estimatedAmount: number;
  plannedPaymentMethod: string;
  purpose: string;
  description?: string;
  requestedExpenseDate: string;
}

export interface UpdateDraftPurchaseRequestPayload extends CreatePurchaseRequestPayload {
  requestId: string;
}

export interface RequestActionPayload extends TenantOrgPayload {
  requestId: string;
}

export interface CreateExpenseReportPayload extends RequestActionPayload {}

export interface UpsertExpenseLineItemPayload extends TenantOrgPayload {
  requestId: string;
  reportId: string;
  lineItemId?: string;
  vendorId: string;
  categoryId: string;
  amount: number;
  expenseDate: string;
  description?: string;
  receiptUrl?: string;
}

export interface BudgetSnapshotPayload extends TenantOrgPayload {
  fundId: string;
}

export type PurchaseRequestApprovalAction = "APPROVE" | "REJECT" | "REQUEST_REVISIONS";
export type ExpenseReportApprovalAction = "SUBMIT" | "APPROVE" | "REJECT" | "REQUEST_REVISIONS" | "MARK_PAID";

export interface PurchaseRequestApprovalPayload extends TenantOrgPayload {
  requestId: string;
  action: PurchaseRequestApprovalAction;
  comments?: string;
}

export interface ExpenseReportApprovalPayload extends TenantOrgPayload {
  requestId: string;
  reportId: string;
  action: ExpenseReportApprovalAction;
  comments?: string;
}

export interface PurchaseRequestDetailResponse {
  request: Record<string, unknown> & { id: string };
  expenseReport: (Record<string, unknown> & { id: string }) | null;
  lineItems: Array<Record<string, unknown> & { id: string }>;
  approvals: Array<Record<string, unknown> & { id: string }>;
  budgetSnapshot: Record<string, unknown> | null;
}
