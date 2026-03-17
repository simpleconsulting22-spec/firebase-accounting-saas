export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED_PREAPPROVAL: 'Pending Pre-Approval',
  PREAPPROVED: 'Pre-Approved',
  NEEDS_EDITS_STEP1: 'Needs Edits',
  DRAFT_EXPENSE: 'Expense Report Pending',
  SUBMITTED_RECEIPT_REVIEW: 'Pending Receipt Review',
  EXCEEDS_APPROVED_AMOUNT: 'Exceeds Approved Amount',
  NEEDS_EDITS_STEP3: 'Needs Edits (Expense)',
  FINAL_APPROVED: 'Final Approved',
  PAID: 'Paid',
  QB_SENT: 'QB Sent',
  QB_ENTERED: 'QB Entered',
  REJECTED: 'Rejected',
}

export const STATUS_BADGE_CLASS: Record<string, string> = {
  DRAFT: 'badge-ghost',
  SUBMITTED_PREAPPROVAL: 'badge-warning',
  PREAPPROVED: 'badge-success',
  NEEDS_EDITS_STEP1: 'badge-error',
  DRAFT_EXPENSE: 'badge-warning',
  SUBMITTED_RECEIPT_REVIEW: 'badge-warning',
  EXCEEDS_APPROVED_AMOUNT: 'badge-error',
  NEEDS_EDITS_STEP3: 'badge-error',
  FINAL_APPROVED: 'badge-success',
  PAID: 'badge-success',
  QB_SENT: 'badge-info',
  QB_ENTERED: 'badge-success',
  REJECTED: 'badge-error',
}

export const PAYMENT_METHODS = [
  'Check', 'ACH / Direct Deposit', 'Credit Card', 'Debit Card',
  'Zelle', 'Cash', 'Venmo', 'PayPal', 'Wire Transfer', 'Other'
]

export const CATEGORIES = [
  'Advertising & Marketing', 'Auto & Travel', 'Bank Fees & Charges',
  'Books & Subscriptions', 'Building & Facilities', 'Business Meals & Entertainment',
  'Charitable Giving', 'Childcare', 'Cleaning & Janitorial', 'Cloud Services & SaaS',
  'Conference & Events', 'Consulting & Professional Fees', 'Contractors & Freelancers',
  'Copier & Printing', 'Creative & Design Services', 'Curriculum & Education Materials',
  'Décor & Staging', 'Donations & Benevolence', 'Dues & Memberships', 'Equipment Purchase',
  'Equipment Rental', 'Facilities Rental', 'Food & Beverages', 'Gifts & Appreciation',
  'Guest Speaker Honoraria', 'Insurance', 'IT & Tech Support', 'Legal & Compliance',
  'Licenses & Permits', 'Media & Production', 'Medical & Health', 'Ministry Supplies',
  'Missions & Outreach', 'Music & Worship Resources', 'Office Supplies', 'Online Advertising',
  'Pastoral Care Expenses', 'Payroll & Compensation', 'Petty Cash Reimbursement',
  'Photography & Videography', 'Postage & Shipping', 'Prayer & Spiritual Formation',
  'Printing & Publications', 'Program Expenses', 'Repairs & Maintenance',
  'Retreat & Camping', 'Safety & Security', 'Small Group Resources',
  'Social Media & Content', 'Software & Apps', 'Sound & AV Equipment',
  'Staffing & HR', 'Streaming & Broadcast', 'Student Ministry Expenses',
  'Technology & Electronics', 'Training & Development', 'Transportation & Logistics',
  'Utilities & Services', 'Volunteer Appreciation', 'Worship & Sanctuary Supplies'
]

export const FUNDS = [
  'General Fund', 'Building Fund', 'Missions Fund', 'Youth Fund', 'Worship Fund'
]

export const ORG_NAMES: Record<string, string> = {
  org_citylight: 'CityLight Church',
  org_glow: 'Glow Church',
}
