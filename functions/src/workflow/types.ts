import { Timestamp } from "firebase-admin/firestore";

// ─── Request ──────────────────────────────────────────────────────────────────

export interface Request {
  id: string;
  orgId: string;
  tenantId: string;
  requestorId: string;
  requestorEmail: string;
  requestorName: string;
  approverId: string;
  approverEmail: string;
  approverName: string;
  ministryDepartment: string;
  fundId: string;
  vendorId: string;
  vendorName: string;
  category: string;
  estimatedAmount: number;
  approvedAmount: number;
  actualAmount: number;
  paymentMethod: string;
  purpose: string;
  description: string;
  requestedExpenseDate: string;
  status: string;
  step: number;
  preApprovalToken: string;
  preApprovalTokenExpiresAt: Timestamp;
  preApprovalDecidedAt: Timestamp | null;
  preApprovalDecidedBy: string | null;
  preApprovalNotes: string;
  expenseReportSubmittedAt: Timestamp | null;
  receiptsReviewToken: string;
  receiptsReviewTokenExpiresAt: Timestamp;
  receiptsReviewDecidedAt: Timestamp | null;
  receiptsReviewDecidedBy: string | null;
  receiptsReviewNotes: string;
  finalApprovedAt: Timestamp | null;
  finalApprovedBy: string | null;
  paidAt: Timestamp | null;
  paidBy: string | null;
  paymentReference: string;
  qbSentAt: Timestamp | null;
  qbSentBy: string | null;
  qbEnteredAt: Timestamp | null;
  qbEnteredBy: string | null;
  qbEnteredNotes: string;
  rejectedAt: Timestamp | null;
  rejectedBy: string | null;
  rejectionReason: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Line Item ────────────────────────────────────────────────────────────────

export interface LineItem {
  id: string;
  requestId: string;
  orgId: string;
  tenantId: string;
  description: string;
  amount: number;
  category: string;
  vendorName: string;
  receiptDate: string;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── File Record ──────────────────────────────────────────────────────────────

export interface FileRecord {
  id: string;
  requestId: string;
  orgId: string;
  tenantId: string;
  lineItemId?: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: Timestamp;
}

// ─── Token ────────────────────────────────────────────────────────────────────

export interface Token {
  id: string;
  requestId: string;
  orgId: string;
  tenantId: string;
  type: string;
  used: boolean;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

// ─── Admin Department ─────────────────────────────────────────────────────────

export interface AdminDept {
  id: string;
  orgId: string;            // system field = same value as organizationId
  tenantId: string;
  organizationId: string;   // user-facing org field
  ministryDepartment: string;
  approverName: string;
  approverEmail: string;
  approverId: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Counter ──────────────────────────────────────────────────────────────────

export interface Counter {
  id: string;
  orgId: string;
  year: number;
  count: number;
}

// ─── Escalation Rule ──────────────────────────────────────────────────────────

export interface EscalationRule {
  id: string;
  orgId: string;
  tenantId: string;
  step: number;
  role: string;
  threshold: number;
  bufferAmount: number;
  status: "active" | "inactive";
  updatedAt: Timestamp;
}

// ─── QB Payment Account ───────────────────────────────────────────────────────

export interface QBPaymentAccount {
  id: string;
  orgId: string;
  tenantId: string;
  name: string;
  accountName: string;
  accountNumber: string;
  accountType: string;
  status: "active" | "inactive";
  isActive: boolean;
  createdAt: Timestamp;
}

// ─── Vendor Setup Request ─────────────────────────────────────────────────────

export interface VendorSetupRequest {
  id: string;
  orgId: string;
  tenantId: string;
  requestorId: string;
  requestorEmail: string;
  requestorName: string;
  vendorName: string;
  vendorEmail: string;
  contactName: string;
  notes: string;
  status: "pending" | "approved" | "rejected";
  intakeToken: string;
  intakeTokenExpiresAt: Timestamp;
  rejectionReason?: string;
  approvedAt?: Timestamp;
  approvedBy?: string;
  rejectedAt?: Timestamp;
  rejectedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Vendor Intake ────────────────────────────────────────────────────────────

export interface VendorIntake {
  id: string;
  vendorSetupRequestId: string;
  orgId: string;
  tenantId: string;
  legalName: string;
  dbaName: string;
  address: string;
  taxId: string;
  taxClassification: string;
  is1099: boolean;
  bankName: string;
  accountType: string;
  routingNumber: string;
  accountNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  signatureDate: string;
  submittedAt: Timestamp;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  orgIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Org Role ─────────────────────────────────────────────────────────────────

export interface OrgRole {
  id: string;
  uid: string;
  orgId: string;
  tenantId: string;
  roles: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Vendor ───────────────────────────────────────────────────────────────────

export interface Vendor {
  id: string;
  orgId: string;
  tenantId: string;
  vendorId: string;         // user-specified ID
  vendorName: string;
  vendorEmail: string;
  vendorType: string;
  w9OnFile: boolean;
  w9TaxClassification: string;
  llcTaxTreatment: string;
  is1099Required: boolean;
  active: boolean;
  vendorSetupRequestId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Category ─────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  orgId: string;
  tenantId: string;
  categoryId: string;       // user-specified ID
  categoryName: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Category Budget ──────────────────────────────────────────────────────────

export interface CategoryBudget {
  id: string;
  orgId: string;            // system field = same value as organizationId
  tenantId: string;
  organizationId: string;   // user-facing org field
  year: number;
  ministryDepartment: string;
  fundName: string;
  fundType: string;
  category: string;
  approvedAnnualBudget: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Workflow Settings ────────────────────────────────────────────────────────

export interface WorkflowSettings {
  id: string;
  orgId: string;
  tenantId: string;
  approvalLevels: number;
  receiptRequiredThreshold: number;
  expenseApprovalThreshold: number;
  updatedAt: Timestamp;
}

// ─── Admin Audit Log ──────────────────────────────────────────────────────────

export interface AdminAuditLog {
  id: string;
  actionType: string;
  collectionName: string;
  recordId: string;
  orgId: string;
  performedBy: string;
  performedByEmail: string;
  payload: Record<string, any>;
  timestamp: Timestamp;
}

// ─── Input shapes for callable functions ──────────────────────────────────────

export interface SavePurchaseRequestDraftInput {
  requestId?: string;
  orgId: string;
  approverId: string;
  approverEmail: string;
  approverName: string;
  ministryDepartment: string;
  fundId: string;
  vendorId: string;
  vendorName: string;
  category: string;
  estimatedAmount: number;
  paymentMethod: string;
  purpose: string;
  description: string;
  requestedExpenseDate: string;
}

export interface LineItemInput {
  id?: string;
  description: string;
  amount: number;
  category: string;
  vendorName: string;
  receiptDate: string;
  notes: string;
}

export interface VendorIntakeInput {
  legalName: string;
  dbaName: string;
  address: string;
  taxId: string;
  taxClassification: string;
  is1099: boolean;
  bankName: string;
  accountType: string;
  routingNumber: string;
  accountNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  signatureDate: string;
}
