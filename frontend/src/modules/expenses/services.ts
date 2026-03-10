import { apiClient } from "../../services/apiClient";
import {
  BudgetSnapshotPayload,
  CreateExpenseReportPayload,
  CreatePurchaseRequestPayload,
  ExpenseReportApprovalPayload,
  PurchaseRequestDetailResponse,
  PurchaseRequestApprovalPayload,
  RequestActionPayload,
  UpdateDraftPurchaseRequestPayload,
  UpsertExpenseLineItemPayload
} from "./types";

export const expensesApi = {
  createPurchaseRequest(payload: CreatePurchaseRequestPayload): Promise<{ requestId: string; status: string }> {
    return apiClient.call<CreatePurchaseRequestPayload, { requestId: string; status: string }>(
      "createPurchaseRequest",
      payload
    );
  },

  updateDraftPurchaseRequest(
    payload: UpdateDraftPurchaseRequestPayload
  ): Promise<{ requestId: string; status: string }> {
    return apiClient.call<UpdateDraftPurchaseRequestPayload, { requestId: string; status: string }>(
      "updateDraftPurchaseRequest",
      payload
    );
  },

  submitPurchaseRequest(payload: RequestActionPayload): Promise<{ requestId: string; status: string }> {
    return apiClient.call<RequestActionPayload, { requestId: string; status: string }>(
      "submitPurchaseRequest",
      payload
    );
  },

  applyPurchaseRequestApprovalAction(
    payload: PurchaseRequestApprovalPayload
  ): Promise<{ requestId: string; status: string }> {
    return apiClient.call<PurchaseRequestApprovalPayload, { requestId: string; status: string }>(
      "applyPurchaseRequestApprovalAction",
      payload
    );
  },

  getPurchaseRequestDetail(payload: RequestActionPayload): Promise<PurchaseRequestDetailResponse> {
    return apiClient.call<RequestActionPayload, PurchaseRequestDetailResponse>(
      "getPurchaseRequestDetail",
      payload
    );
  },

  createExpenseReport(
    payload: CreateExpenseReportPayload
  ): Promise<{ reportId: string; status: string; existed: boolean }> {
    return apiClient.call<CreateExpenseReportPayload, { reportId: string; status: string; existed: boolean }>(
      "createExpenseReport",
      payload
    );
  },

  upsertExpenseLineItem(
    payload: UpsertExpenseLineItemPayload
  ): Promise<{ lineItemId: string; actualAmount: number }> {
    return apiClient.call<UpsertExpenseLineItemPayload, { lineItemId: string; actualAmount: number }>(
      "addExpenseLineItem",
      payload
    );
  },

  applyExpenseReportApprovalAction(
    payload: ExpenseReportApprovalPayload
  ): Promise<{ requestId: string; reportId: string; requestStatus: string; reportStatus: string }> {
    return apiClient.call<
      ExpenseReportApprovalPayload,
      { requestId: string; reportId: string; requestStatus: string; reportStatus: string }
    >("applyExpenseReportApprovalAction", payload);
  },

  getBudgetSnapshot(payload: BudgetSnapshotPayload): Promise<Record<string, unknown>> {
    return apiClient.call<BudgetSnapshotPayload, Record<string, unknown>>("getBudgetSnapshot", payload);
  }
};
