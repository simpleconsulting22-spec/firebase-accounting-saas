import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '../firebase'

const functions = getFunctions(app)

function callable<T = any, R = any>(name: string) {
  return (data?: T): Promise<R> => httpsCallable<T, R>(functions, name)(data).then(r => r.data)
}

export const api = {
  // Bootstrap
  getBootstrap: callable('getBootstrap'),
  getMyProfile: callable('getMyProfile'),
  saveUserProfile: callable('saveUserProfile'),

  // Requests
  savePurchaseRequestDraft: callable('savePurchaseRequestDraft'),
  submitPreApproval: callable('submitPreApproval'),
  getMyDashboards: callable('getMyDashboards'),
  getRequestDetail: callable('getRequestDetail'),

  // Expense Report
  saveExpenseReport: callable('saveExpenseReport'),
  submitExpenseReport: callable('submitExpenseReport'),
  registerFile: callable('registerFile'),
  deleteReceiptFile: callable('deleteReceiptFile'),

  // Approvals
  validateTokenAndGetRequest: callable('validateTokenAndGetRequest'),
  submitApproverDecision: callable('submitApproverDecision'),
  approveReceiptsReview: callable('approveReceiptsReview'),
  rejectReceiptsReview: callable('rejectReceiptsReview'),
  sendBackForEdits: callable('sendBackForEdits'),
  applyOverageApproval: callable('applyOverageApproval'),
  adminApproveReceiptsReview: callable('adminApproveReceiptsReview'),

  // Payment
  markAsPaid: callable('markAsPaid'),
  sendToQuickBooks: callable('sendToQuickBooks'),
  confirmQBEntry: callable('confirmQBEntry'),

  // Admin
  getMinistryDepartmentsByOrg: callable('getMinistryDepartmentsByOrg'),
  getApproverMapping: callable('getApproverMapping'),
  getFundsForOrg: callable('getFundsForOrg'),
  adminListDepartments: callable('adminListDepartments'),
  adminUpsertDepartment: callable('adminUpsertDepartment'),
  adminDeleteDepartment: callable('adminDeleteDepartment'),

  // Categories
  adminListCategories: callable('adminListCategories'),
  adminUpsertCategory: callable('adminUpsertCategory'),
  adminSetCategoryStatus: callable('adminSetCategoryStatus'),

  // Category Budgets
  adminListCategoryBudgets: callable('adminListCategoryBudgets'),
  adminUpsertCategoryBudget: callable('adminUpsertCategoryBudget'),
  adminSetCategoryBudgetStatus: callable('adminSetCategoryBudgetStatus'),

  // Workflow Settings
  adminGetWorkflowSettings: callable('adminGetWorkflowSettings'),
  adminSaveWorkflowSettings: callable('adminSaveWorkflowSettings'),

  // Escalation Rules
  adminListEscalationRules: callable('adminListEscalationRules'),
  adminUpsertEscalationRule: callable('adminUpsertEscalationRule'),
  adminSetEscalationRuleStatus: callable('adminSetEscalationRuleStatus'),

  // QB Accounts
  adminListQBAccounts: callable('adminListQBAccounts'),
  adminUpsertQBAccount: callable('adminUpsertQBAccount'),
  adminSetQBAccountStatus: callable('adminSetQBAccountStatus'),

  // Vendors (admin)
  adminListVendors: callable('adminListVendors'),
  adminUpsertVendor: callable('adminUpsertVendor'),
  adminSetVendorStatus: callable('adminSetVendorStatus'),

  // Bulk imports
  adminBulkImportDepartments: callable('adminBulkImportDepartments'),
  adminBulkImportCategories: callable('adminBulkImportCategories'),
  adminBulkImportVendors: callable('adminBulkImportVendors'),
  adminBulkImportCategoryBudgets: callable('adminBulkImportCategoryBudgets'),
  adminBulkImportEscalationRules: callable('adminBulkImportEscalationRules'),
  adminBulkImportQBAccounts: callable('adminBulkImportQBAccounts'),

  // Deactivate/reactivate departments
  adminDeactivateDepartment: callable('adminDeactivateDepartment'),
  adminReactivateDepartment: callable('adminReactivateDepartment'),

  // Vendors
  getActiveVendors: callable('getActiveVendors'),
  submitVendorSetupRequest: callable('submitVendorSetupRequest'),
  getPendingVendorSetupRequests: callable('getPendingVendorSetupRequests'),
  getVendorDashboards: callable('getVendorDashboards'),
  getVendorSetupById: callable('getVendorSetupById'),
  approveVendorSetup: callable('approveVendorSetup'),
  rejectVendorSetup: callable('rejectVendorSetup'),
  regenerateVendorIntakeLink: callable('regenerateVendorIntakeLink'),
  submitVendorIntake: callable('submitVendorIntake'),
  getVendorIntakeByToken: callable('getVendorIntakeByToken'),

  // Exports
  generateQBBookkeepingSummary: callable('generateQBBookkeepingSummary'),
  pingServer: callable('pingServer'),

  // Auth
  resolveGoogleLogin: callable('resolveGoogleLogin'),

  // User management
  adminCreateUser: callable('adminCreateUser'),
  adminListUsers: callable('adminListUsers'),
  adminUpdateUser: callable('adminUpdateUser'),
  adminSetUserStatus: callable('adminSetUserStatus'),
  adminResendWelcomeEmail: callable('adminResendWelcomeEmail'),
  adminBulkImportUsers: callable('adminBulkImportUsers'),
}
