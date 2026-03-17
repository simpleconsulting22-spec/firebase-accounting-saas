export interface Request {
  id: string
  orgId: string
  tenantId: string
  requestorId: string
  requestorEmail: string
  requestorName: string
  approverId: string
  approverEmail: string
  approverName: string
  ministryDepartment: string
  fundId: string
  vendorId: string
  vendorName: string
  category: string
  estimatedAmount: number
  approvedAmount: number
  actualAmount: number
  paymentMethod: string
  purpose: string
  description: string
  requestedExpenseDate: string
  status: string
  step: number
  preApprovalToken: string
  preApprovalNotes: string
  receiptsReviewNotes: string
  rejectionReason: string
  paymentReference: string
  qbEnteredNotes: string
  createdAt: any
  updatedAt: any
  [key: string]: any
}

export interface LineItem {
  id?: string
  requestId: string
  orgId: string
  description: string
  amount: number
  category: string
  vendorName: string
  receiptDate: string
  notes: string
}

export interface FileRecord {
  id?: string
  requestId: string
  orgId: string
  fileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  lineItemId?: string
  uploadedAt: any
}

export interface Vendor {
  id?: string;
  orgId: string;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  vendorType: string;
  w9OnFile: boolean;
  w9TaxClassification: string;
  llcTaxTreatment: string;
  is1099Required: boolean;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface AdminDept {
  id?: string;
  orgId: string;
  organizationId: string;
  ministryDepartment: string;
  approverName: string;
  approverEmail: string;
  approverId?: string;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface VendorSetupRequest {
  id?: string
  orgId: string
  vendorName: string
  vendorEmail: string
  contactName: string
  notes: string
  status: string
  requestorId: string
  requestorEmail: string
  createdAt: any
}

export interface DashboardData {
  myRequests: Request[]
  pendingApprovals: Request[]
  financeQueue: Request[]
}

export interface Category {
  id?: string;
  orgId: string;
  categoryId: string;
  categoryName: string;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface CategoryBudget {
  id?: string;
  orgId: string;
  organizationId: string;
  year: number;
  ministryDepartment: string;
  fundName: string;
  fundType: string;
  category: string;
  approvedAnnualBudget: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface WorkflowSettings {
  id?: string;
  orgId: string;
  approvalLevels: number;
  receiptRequiredThreshold: number;
  expenseApprovalThreshold: number;
  updatedAt?: any;
}

export interface EscalationRule {
  id?: string;
  orgId: string;
  step: number;
  role: string;
  threshold: number;
  bufferAmount?: number;
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

export interface QBAccount {
  id?: string;
  orgId: string;
  name: string;
  accountNumber: string;
  accountType: string;
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

export interface BulkImportResult {
  created: number;
  updated: number;
  errors: Array<{ row: number; field?: string; message: string }>;
}

export interface AppUser {
  id?: string;
  userId: string;
  name: string;
  email: string;
  orgId: string;
  role: string;
  ministryDepartment: string;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}
