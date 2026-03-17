"use strict";
// ─── Status Constants ────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTION = exports.BASE_URL = exports.FUNDS = exports.PAYMENT_METHODS = exports.CATEGORIES = exports.VALID_ORG_IDS = exports.ORG_CONFIG = exports.TENANT_ID = exports.TOKEN_TYPE = exports.ROLE = exports.STEP = exports.STATUS = void 0;
exports.STATUS = {
    DRAFT: "DRAFT",
    SUBMITTED_PREAPPROVAL: "SUBMITTED_PREAPPROVAL",
    PREAPPROVED: "PREAPPROVED",
    DRAFT_EXPENSE: "DRAFT_EXPENSE",
    SUBMITTED_RECEIPT_REVIEW: "SUBMITTED_RECEIPT_REVIEW",
    FINAL_APPROVED: "FINAL_APPROVED",
    PAID: "PAID",
    QB_SENT: "QB_SENT",
    QB_ENTERED: "QB_ENTERED",
    NEEDS_EDITS_STEP1: "NEEDS_EDITS_STEP1",
    NEEDS_EDITS_STEP3: "NEEDS_EDITS_STEP3",
    EXCEEDS_APPROVED_AMOUNT: "EXCEEDS_APPROVED_AMOUNT",
    REJECTED: "REJECTED",
};
// ─── Step Constants ───────────────────────────────────────────────────────────
exports.STEP = {
    DRAFT_SUBMIT: 1,
    PREAPPROVAL_REVIEW: 2,
    EXPENSE_REPORT: 3,
    RECEIPTS_REVIEW: 4,
    FINAL_APPROVED: 5,
    PAID: 6,
    QB_SENT: 7,
    QB_ENTERED: 8,
};
// ─── Role Constants ───────────────────────────────────────────────────────────
exports.ROLE = {
    ADMIN: "ADMIN",
    REQUESTOR: "REQUESTOR",
    FINANCE_PAYOR: "FINANCE_PAYOR",
    FINANCE_NOTIFY: "FINANCE_NOTIFY",
    FINANCE_RECEIPTS_REVIEWER: "FINANCE_RECEIPTS_REVIEWER",
    FINANCE_QB_ENTRY: "FINANCE_QB_ENTRY",
};
// ─── Token Types ──────────────────────────────────────────────────────────────
exports.TOKEN_TYPE = {
    PRE_APPROVAL: "PRE_APPROVAL",
    RECEIPTS_REVIEW: "RECEIPTS_REVIEW",
    VENDOR_INTAKE: "VENDOR_INTAKE",
};
// ─── Tenant ───────────────────────────────────────────────────────────────────
exports.TENANT_ID = "tenant_main";
exports.ORG_CONFIG = {
    org_citylight: {
        name: "CityLight Church",
        qbAssistEmails: ["james@citylightmn.com", "rachel@citylightmn.com"],
        adminEmails: ["james@citylightmn.com"],
        allowedDomains: ["citylightmn.com"],
        escalationBufferAmount: 50,
    },
    org_glow: {
        name: "Glow Church",
        qbAssistEmails: ["megan@glowchurch.org", "tyler@glowchurch.org"],
        adminEmails: ["megan@glowchurch.org"],
        allowedDomains: ["glowchurch.org"],
        escalationBufferAmount: 50,
    },
};
exports.VALID_ORG_IDS = Object.keys(exports.ORG_CONFIG);
// ─── Categories ───────────────────────────────────────────────────────────────
exports.CATEGORIES = [
    "Advertising & Marketing",
    "Auto & Travel",
    "Bank Fees & Charges",
    "Books & Subscriptions",
    "Building & Facilities",
    "Business Meals & Entertainment",
    "Charitable Giving",
    "Childcare",
    "Cleaning & Janitorial",
    "Cloud Services & SaaS",
    "Conference & Events",
    "Consulting & Professional Fees",
    "Contractors & Freelancers",
    "Copier & Printing",
    "Creative & Design Services",
    "Curriculum & Education Materials",
    "Décor & Staging",
    "Donations & Benevolence",
    "Dues & Memberships",
    "Equipment Purchase",
    "Equipment Rental",
    "Facilities Rental",
    "Food & Beverages",
    "Gifts & Appreciation",
    "Guest Speaker Honoraria",
    "Insurance",
    "IT & Tech Support",
    "Legal & Compliance",
    "Licenses & Permits",
    "Media & Production",
    "Medical & Health",
    "Ministry Supplies",
    "Missions & Outreach",
    "Music & Worship Resources",
    "Office Supplies",
    "Online Advertising",
    "Pastoral Care Expenses",
    "Payroll & Compensation",
    "Petty Cash Reimbursement",
    "Photography & Videography",
    "Postage & Shipping",
    "Prayer & Spiritual Formation",
    "Printing & Publications",
    "Program Expenses",
    "Repairs & Maintenance",
    "Retreat & Camping",
    "Safety & Security",
    "Small Group Resources",
    "Social Media & Content",
    "Software & Apps",
    "Sound & AV Equipment",
    "Staffing & HR",
    "Streaming & Broadcast",
    "Student Ministry Expenses",
    "Technology & Electronics",
    "Training & Development",
    "Transportation & Logistics",
    "Utilities & Services",
    "Volunteer Appreciation",
    "Worship & Sanctuary Supplies",
];
// ─── Payment Methods ──────────────────────────────────────────────────────────
exports.PAYMENT_METHODS = [
    "Check",
    "ACH / Direct Deposit",
    "Credit Card",
    "Debit Card",
    "Zelle",
    "Cash",
    "Venmo",
    "PayPal",
    "Wire Transfer",
    "Other",
];
// ─── Funds ────────────────────────────────────────────────────────────────────
exports.FUNDS = [
    "General Fund",
    "Building Fund",
    "Missions Fund",
    "Youth Fund",
    "Worship Fund",
];
// ─── URLs ─────────────────────────────────────────────────────────────────────
exports.BASE_URL = "https://app.example.com";
// ─── Firestore Collections ────────────────────────────────────────────────────
exports.COLLECTION = {
    REQUESTS: "requests",
    LINE_ITEMS: "lineItems",
    FILES: "files",
    TOKENS: "tokens",
    USERS: "users",
    ADMIN_DEPTS: "adminDepts",
    COUNTERS: "counters",
    ORG_ROLES: "orgRoles",
    ESCALATION_RULES: "escalationRules",
    BUDGETS: "budgets",
    VENDORS: "vendors",
    VENDOR_SETUP_REQUESTS: "vendorSetupRequests",
    VENDOR_INTAKES: "vendorIntakes",
    QB_PAYMENT_ACCOUNTS: "qbPaymentAccounts",
    MAIL: "mail",
    CATEGORIES: "categories",
    CATEGORY_BUDGETS: "categoryBudgets",
    WORKFLOW_SETTINGS: "workflowSettings",
    ADMIN_AUDIT_LOGS: "adminAuditLogs",
};
