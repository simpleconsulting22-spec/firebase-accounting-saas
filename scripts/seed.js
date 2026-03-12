/**
 * Seed script — writes test data directly to the live Firestore database.
 *
 * Usage:
 *   node scripts/seed.js --email your@email.com
 *
 * The --email flag looks up the Firebase Auth user by email and creates their
 * user profile document so they can log in and see data immediately.
 */

process.env.GOOGLE_CLOUD_PROJECT = "expense-workflow-platform";

const admin = require("/home/simpleconsulting22/firebase-accounting-saas/functions/node_modules/firebase-admin");
const Timestamp = admin.firestore.Timestamp;

admin.initializeApp({ projectId: "expense-workflow-platform" });

const db = admin.firestore();
const auth = admin.auth();

const email = (() => {
  const idx = process.argv.indexOf("--email");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ─── Timestamps ───────────────────────────────────────────────────────────────

const ts = (isoDate) => Timestamp.fromDate(new Date(isoDate));
const now = Timestamp.now();

// ─── Seed Data ────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant_citylight_group";
const ORG_CL = "org_citylight";
const ORG_GL = "org_glow";

async function seed() {
  console.log("🌱 Seeding Firestore...\n");
  const batch1 = db.batch();

  // ── Tenant ──────────────────────────────────────────────────────────────────
  batch1.set(db.collection("tenants").doc(TENANT_ID), {
    name: "CityLight Group",
    plan: "pro",
    modulesEnabled: {
      expenses: true,
      generalLedger: true,
      fixedAssets: false,
      financialReports: false,
      payroll: false,
      donations: false,
    },
    createdAt: ts("2026-01-01T00:00:00Z"),
  });

  // ── Organizations ────────────────────────────────────────────────────────────
  batch1.set(db.collection("organizations").doc(ORG_CL), {
    tenantId: TENANT_ID,
    name: "CityLight Church",
    domain: "thecitylight.org",
    createdAt: ts("2026-01-01T00:00:00Z"),
  });

  batch1.set(db.collection("organizations").doc(ORG_GL), {
    tenantId: TENANT_ID,
    name: "Glow Church",
    domain: "glowchurch.org",
    createdAt: ts("2026-01-01T00:00:00Z"),
  });

  // ── Funds — CityLight ────────────────────────────────────────────────────────
  const funds = [
    { id: "fund_cl_ops_2026",    fundName: "General Operating",    ministryDepartment: "Operations",       annualBudget: 150000, fundType: "Operating",        org: ORG_CL },
    { id: "fund_cl_youth_2026",  fundName: "Youth Ministry",       ministryDepartment: "Youth",            annualBudget: 30000,  fundType: "Operating",        org: ORG_CL },
    { id: "fund_cl_worship_2026",fundName: "Worship & Arts",       ministryDepartment: "Worship",          annualBudget: 25000,  fundType: "Operating",        org: ORG_CL },
    { id: "fund_cl_easter_2026", fundName: "Easter Event 2026",    ministryDepartment: "Events",           annualBudget: 20000,  fundType: "Events",           org: ORG_CL },
    { id: "fund_cl_missions_2026",fundName: "Missions & Outreach", ministryDepartment: "Missions",         annualBudget: 40000,  fundType: "Special Projects", org: ORG_CL },
    { id: "fund_gl_ops_2026",    fundName: "General Operating",    ministryDepartment: "Operations",       annualBudget: 80000,  fundType: "Operating",        org: ORG_GL },
    { id: "fund_gl_youth_2026",  fundName: "Youth Ministry",       ministryDepartment: "Youth",            annualBudget: 15000,  fundType: "Operating",        org: ORG_GL },
    { id: "fund_gl_conf_2026",   fundName: "Leadership Conference",ministryDepartment: "Leadership",       annualBudget: 12000,  fundType: "Events",           org: ORG_GL },
  ];

  for (const f of funds) {
    batch1.set(db.collection("funds").doc(f.id), {
      tenantId: TENANT_ID,
      organizationId: f.org,
      fundName: f.fundName,
      ministryDepartment: f.ministryDepartment,
      fundType: f.fundType,
      annualBudget: f.annualBudget,
      year: 2026,
      active: true,
      createdAt: ts("2026-01-01T00:00:00Z"),
    });
  }

  // ── Vendors ──────────────────────────────────────────────────────────────────
  const vendors = [
    { id: "vendor_amazon",     name: "Amazon Business",    category: "Office Supplies" },
    { id: "vendor_costco",     name: "Costco Wholesale",   category: "Supplies" },
    { id: "vendor_staples",    name: "Staples",            category: "Office Supplies" },
    { id: "vendor_target",     name: "Target",             category: "Supplies" },
    { id: "vendor_homedepot",  name: "Home Depot",         category: "Facilities" },
    { id: "vendor_soundgear",  name: "SoundGear Pro",      category: "A/V Equipment" },
    { id: "vendor_chick",      name: "Chick-fil-A",        category: "Food & Catering" },
    { id: "vendor_chipotle",   name: "Chipotle",           category: "Food & Catering" },
    { id: "vendor_uber",       name: "Uber / Lyft",        category: "Transportation" },
    { id: "vendor_delta",      name: "Delta Airlines",     category: "Travel" },
    { id: "vendor_marriott",   name: "Marriott Hotels",    category: "Travel" },
    { id: "vendor_printshop",  name: "City Print Shop",    category: "Printing" },
    { id: "vendor_canva",      name: "Canva Pro",          category: "Software" },
    { id: "vendor_planning",   name: "Planning Center",    category: "Software" },
  ];

  for (const v of vendors) {
    batch1.set(db.collection("vendors").doc(v.id), {
      tenantId: TENANT_ID,
      name: v.name,
      category: v.category,
      active: true,
      createdAt: ts("2026-01-01T00:00:00Z"),
    });
  }

  // ── Categories ───────────────────────────────────────────────────────────────
  const categories = [
    { id: "cat_office",    name: "Office Supplies" },
    { id: "cat_food",      name: "Food & Catering" },
    { id: "cat_travel",    name: "Travel & Transportation" },
    { id: "cat_av",        name: "A/V & Equipment" },
    { id: "cat_software",  name: "Software & Subscriptions" },
    { id: "cat_facilities",name: "Facilities & Maintenance" },
    { id: "cat_printing",  name: "Printing & Marketing" },
    { id: "cat_misc",      name: "Miscellaneous" },
  ];

  for (const c of categories) {
    batch1.set(db.collection("categories").doc(c.id), {
      tenantId: TENANT_ID,
      name: c.name,
      active: true,
      createdAt: ts("2026-01-01T00:00:00Z"),
    });
  }

  await batch1.commit();
  console.log("✅ Tenant, orgs, funds, vendors, categories seeded.");

  // ── User Profile ─────────────────────────────────────────────────────────────
  let uid = null;
  if (email) {
    try {
      const userRecord = await auth.getUserByEmail(email);
      uid = userRecord.uid;
      await db.collection("users").doc(uid).set({
        email,
        tenantId: TENANT_ID,
        orgRoles: {
          [ORG_CL]: ["admin", "requestor", "approver", "finance"],
          [ORG_GL]: ["admin", "requestor", "approver", "finance"],
        },
        name: userRecord.displayName || email.split("@")[0],
        active: true,
        createdAt: now,
      });
      console.log(`✅ User profile created for ${email} (uid: ${uid})`);
    } catch (err) {
      console.warn(`⚠️  Could not find Firebase Auth user for ${email}:`, err.message);
      console.warn("   The user must sign in with Google first before seeding their profile.");
    }
  } else {
    console.log("ℹ️  No --email provided. Skipping user profile. Run with --email your@email.com to create your profile.");
  }

  // ── Seed approver/requestor placeholder users (for display purposes) ──────────
  const seedUsers = [
    { id: "seed_requestor_cl", email: "sarah.johnson@thecitylight.org", name: "Sarah Johnson", roles: { [ORG_CL]: ["requestor"] } },
    { id: "seed_approver_cl",  email: "pastor.mike@thecitylight.org",   name: "Pastor Mike",   roles: { [ORG_CL]: ["approver"] } },
    { id: "seed_finance_cl",   email: "finance@thecitylight.org",       name: "Finance Team",  roles: { [ORG_CL]: ["finance"] } },
    { id: "seed_requestor_gl", email: "david.lee@glowchurch.org",       name: "David Lee",     roles: { [ORG_GL]: ["requestor"] } },
    { id: "seed_approver_gl",  email: "pastor.grace@glowchurch.org",    name: "Pastor Grace",  roles: { [ORG_GL]: ["approver"] } },
  ];

  const userBatch = db.batch();
  for (const u of seedUsers) {
    userBatch.set(db.collection("users").doc(u.id), {
      email: u.email,
      tenantId: TENANT_ID,
      orgRoles: u.roles,
      name: u.name,
      active: true,
      createdAt: ts("2026-01-01T00:00:00Z"),
    });
  }
  await userBatch.commit();
  console.log("✅ Seed user profiles created.");

  // ── Purchase Requests — various states ────────────────────────────────────────
  const requestorId = uid || "seed_requestor_cl";
  const approverId  = uid || "seed_approver_cl";

  const requests = [
    {
      id: "pr_draft_001",
      status: "DRAFT",
      purpose: "Office supplies for admin team",
      description: "Printer paper, pens, folders, and sticky notes for Q2",
      fundId: "fund_cl_ops_2026",
      ministryDepartment: "Operations",
      estimatedAmount: 185.50,
      org: ORG_CL,
      date: "2026-03-01",
    },
    {
      id: "pr_awaiting_001",
      status: "AWAITING_PREAPPROVAL",
      purpose: "Sound equipment for youth room",
      description: "New speaker system and microphone stand for weekly youth service",
      fundId: "fund_cl_youth_2026",
      ministryDepartment: "Youth",
      estimatedAmount: 1250.00,
      org: ORG_CL,
      date: "2026-03-05",
    },
    {
      id: "pr_awaiting_002",
      status: "AWAITING_PREAPPROVAL",
      purpose: "Easter event catering deposit",
      description: "50% deposit for catering vendor — Easter Sunday lunch reception",
      fundId: "fund_cl_easter_2026",
      ministryDepartment: "Events",
      estimatedAmount: 2400.00,
      org: ORG_CL,
      date: "2026-03-08",
    },
    {
      id: "pr_approved_001",
      status: "APPROVE",
      purpose: "Worship team retreat accommodation",
      description: "Hotel and meals for 2-day worship planning retreat, 8 people",
      fundId: "fund_cl_worship_2026",
      ministryDepartment: "Worship",
      estimatedAmount: 3200.00,
      approvedAmount: 3200.00,
      org: ORG_CL,
      date: "2026-02-15",
    },
    {
      id: "pr_expense_draft_001",
      status: "EXPENSE_DRAFT",
      purpose: "Missions conference travel — Pastor Tom",
      description: "Flights, hotel, and registration for national missions conference",
      fundId: "fund_cl_missions_2026",
      ministryDepartment: "Missions",
      estimatedAmount: 1850.00,
      approvedAmount: 1850.00,
      actualAmount: 1420.75,
      org: ORG_CL,
      date: "2026-02-20",
    },
    {
      id: "pr_finance_review_001",
      status: "AWAITING_FINANCE_REVIEW",
      purpose: "Canva Pro annual subscription renewal",
      description: "Annual renewal for Canva Pro team plan — used by communications dept",
      fundId: "fund_cl_ops_2026",
      ministryDepartment: "Communications",
      estimatedAmount: 549.00,
      approvedAmount: 549.00,
      actualAmount: 549.00,
      org: ORG_CL,
      date: "2026-02-10",
    },
    {
      id: "pr_paid_001",
      status: "MARK_PAY",
      purpose: "Youth group pizza night supplies",
      description: "Pizza, drinks, and paper goods for monthly youth social",
      fundId: "fund_cl_youth_2026",
      ministryDepartment: "Youth",
      estimatedAmount: 320.00,
      approvedAmount: 320.00,
      actualAmount: 298.43,
      org: ORG_CL,
      date: "2026-02-01",
    },
    {
      id: "pr_rejected_001",
      status: "REJECT",
      purpose: "New office furniture set",
      description: "Standing desks and chairs for volunteer office",
      fundId: "fund_cl_ops_2026",
      ministryDepartment: "Operations",
      estimatedAmount: 4500.00,
      org: ORG_CL,
      date: "2026-01-20",
    },
    {
      id: "pr_revisions_001",
      status: "REQUEST_REVISIONS_NEEDED",
      purpose: "Printing — sermon series promotional banners",
      description: "6x large format banners for series promotion — missing vendor quote",
      fundId: "fund_cl_ops_2026",
      ministryDepartment: "Communications",
      estimatedAmount: 780.00,
      org: ORG_CL,
      date: "2026-03-02",
    },
    // Glow Church requests
    {
      id: "pr_gl_draft_001",
      status: "DRAFT",
      purpose: "Leadership conference registration",
      description: "Registration fees for 3 staff members attending leadership summit",
      fundId: "fund_gl_conf_2026",
      ministryDepartment: "Leadership",
      estimatedAmount: 1200.00,
      org: ORG_GL,
      date: "2026-03-06",
    },
    {
      id: "pr_gl_awaiting_001",
      status: "AWAITING_PREAPPROVAL",
      purpose: "Youth ministry supplies Q1",
      description: "Craft supplies, games, and snacks for weekly youth program",
      fundId: "fund_gl_youth_2026",
      ministryDepartment: "Youth",
      estimatedAmount: 425.00,
      org: ORG_GL,
      date: "2026-03-04",
    },
  ];

  const prBatch = db.batch();
  for (const r of requests) {
    prBatch.set(db.collection("purchaseRequests").doc(r.id), {
      tenantId: TENANT_ID,
      organizationId: r.org,
      fundId: r.fundId,
      ministryDepartment: r.ministryDepartment,
      requestorId,
      approverId,
      estimatedAmount: r.estimatedAmount,
      approvedAmount: r.approvedAmount || 0,
      actualAmount: r.actualAmount || 0,
      status: r.status,
      plannedPaymentMethod: "Check",
      purpose: r.purpose,
      description: r.description,
      requestedExpenseDate: ts(r.date + "T00:00:00Z"),
      createdAt: ts(r.date + "T09:00:00Z"),
      updatedAt: ts(r.date + "T09:00:00Z"),
    });
  }
  await prBatch.commit();
  console.log(`✅ ${requests.length} purchase requests seeded across all statuses.`);

  // ── Expense Reports ───────────────────────────────────────────────────────────
  const erBatch = db.batch();

  erBatch.set(db.collection("expenseReports").doc("er_expense_draft_001"), {
    tenantId: TENANT_ID,
    organizationId: ORG_CL,
    requestId: "pr_expense_draft_001",
    status: "DRAFT",
    postingStatus: "NOT_POSTED",
    createdAt: ts("2026-02-22T10:00:00Z"),
    updatedAt: ts("2026-02-22T10:00:00Z"),
  });

  erBatch.set(db.collection("expenseReports").doc("er_finance_review_001"), {
    tenantId: TENANT_ID,
    organizationId: ORG_CL,
    requestId: "pr_finance_review_001",
    status: "SUBMIT",
    postingStatus: "NOT_POSTED",
    createdAt: ts("2026-02-11T10:00:00Z"),
    updatedAt: ts("2026-02-12T10:00:00Z"),
    submittedAt: ts("2026-02-12T10:00:00Z"),
  });

  erBatch.set(db.collection("expenseReports").doc("er_paid_001"), {
    tenantId: TENANT_ID,
    organizationId: ORG_CL,
    requestId: "pr_paid_001",
    status: "APPROVE",
    postingStatus: "NOT_POSTED",
    createdAt: ts("2026-02-03T10:00:00Z"),
    updatedAt: ts("2026-02-05T10:00:00Z"),
    submittedAt: ts("2026-02-04T10:00:00Z"),
  });

  await erBatch.commit();
  console.log("✅ Expense reports seeded.");

  // ── Line Items ────────────────────────────────────────────────────────────────
  const liBatch = db.batch();

  // Missions conference (expense draft)
  liBatch.set(db.collection("expenseLineItems").doc("li_001"), {
    tenantId: TENANT_ID, organizationId: ORG_CL,
    requestId: "pr_expense_draft_001", reportId: "er_expense_draft_001",
    vendorId: "vendor_delta", categoryId: "cat_travel",
    amount: 687.50, expenseDate: ts("2026-02-21T00:00:00Z"),
    description: "Round-trip flight — Atlanta to Dallas",
    createdAt: ts("2026-02-22T10:00:00Z"), updatedAt: ts("2026-02-22T10:00:00Z"),
  });
  liBatch.set(db.collection("expenseLineItems").doc("li_002"), {
    tenantId: TENANT_ID, organizationId: ORG_CL,
    requestId: "pr_expense_draft_001", reportId: "er_expense_draft_001",
    vendorId: "vendor_marriott", categoryId: "cat_travel",
    amount: 534.25, expenseDate: ts("2026-02-22T00:00:00Z"),
    description: "2 nights hotel — conference rate",
    createdAt: ts("2026-02-22T10:05:00Z"), updatedAt: ts("2026-02-22T10:05:00Z"),
  });
  liBatch.set(db.collection("expenseLineItems").doc("li_003"), {
    tenantId: TENANT_ID, organizationId: ORG_CL,
    requestId: "pr_expense_draft_001", reportId: "er_expense_draft_001",
    vendorId: "vendor_uber", categoryId: "cat_travel",
    amount: 199.00, expenseDate: ts("2026-02-22T00:00:00Z"),
    description: "Conference registration fee",
    createdAt: ts("2026-02-22T10:10:00Z"), updatedAt: ts("2026-02-22T10:10:00Z"),
  });

  // Canva subscription (finance review)
  liBatch.set(db.collection("expenseLineItems").doc("li_004"), {
    tenantId: TENANT_ID, organizationId: ORG_CL,
    requestId: "pr_finance_review_001", reportId: "er_finance_review_001",
    vendorId: "vendor_canva", categoryId: "cat_software",
    amount: 549.00, expenseDate: ts("2026-02-10T00:00:00Z"),
    description: "Canva Pro Team — annual subscription",
    createdAt: ts("2026-02-11T10:00:00Z"), updatedAt: ts("2026-02-11T10:00:00Z"),
  });

  // Youth pizza night (paid)
  liBatch.set(db.collection("expenseLineItems").doc("li_005"), {
    tenantId: TENANT_ID, organizationId: ORG_CL,
    requestId: "pr_paid_001", reportId: "er_paid_001",
    vendorId: "vendor_chick", categoryId: "cat_food",
    amount: 218.43, expenseDate: ts("2026-02-01T00:00:00Z"),
    description: "Chick-fil-A catering order — 40 people",
    createdAt: ts("2026-02-03T10:00:00Z"), updatedAt: ts("2026-02-03T10:00:00Z"),
  });
  liBatch.set(db.collection("expenseLineItems").doc("li_006"), {
    tenantId: TENANT_ID, organizationId: ORG_CL,
    requestId: "pr_paid_001", reportId: "er_paid_001",
    vendorId: "vendor_costco", categoryId: "cat_food",
    amount: 80.00, expenseDate: ts("2026-02-01T00:00:00Z"),
    description: "Drinks, paper plates, napkins",
    createdAt: ts("2026-02-03T10:05:00Z"), updatedAt: ts("2026-02-03T10:05:00Z"),
  });

  await liBatch.commit();
  console.log("✅ Expense line items seeded.");

  // ── Approval History ──────────────────────────────────────────────────────────
  const apBatch = db.batch();

  const approval = (id, requestId, step, decision, by, dateStr, comments = "") => ({
    id, data: {
      tenantId: TENANT_ID, organizationId: ORG_CL,
      requestId, step, decision, approvedBy: by,
      comments,
      approvedAt: ts(dateStr),
      createdAt: ts(dateStr),
    }
  });

  const approvals = [
    approval("ap_001", "pr_awaiting_001", "PR_SUBMIT",  "SUBMIT",  requestorId, "2026-03-05T09:00:00Z"),
    approval("ap_002", "pr_awaiting_002", "PR_SUBMIT",  "SUBMIT",  requestorId, "2026-03-08T09:00:00Z"),
    approval("ap_003", "pr_approved_001", "PR_SUBMIT",  "SUBMIT",  requestorId, "2026-02-15T09:00:00Z"),
    approval("ap_004", "pr_approved_001", "PR_REVIEW",  "APPROVE", approverId,  "2026-02-16T10:00:00Z", "Looks good, approved for retreat."),
    approval("ap_005", "pr_expense_draft_001", "PR_SUBMIT",  "SUBMIT",  requestorId, "2026-02-20T09:00:00Z"),
    approval("ap_006", "pr_expense_draft_001", "PR_REVIEW",  "APPROVE", approverId,  "2026-02-21T09:00:00Z", "Approved. Please submit receipts after the conference."),
    approval("ap_007", "pr_finance_review_001", "PR_SUBMIT",  "SUBMIT",  requestorId, "2026-02-10T09:00:00Z"),
    approval("ap_008", "pr_finance_review_001", "PR_REVIEW",  "APPROVE", approverId,  "2026-02-10T14:00:00Z"),
    approval("ap_009", "pr_finance_review_001", "ER_SUBMIT",  "SUBMIT",  requestorId, "2026-02-12T10:00:00Z"),
    approval("ap_010", "pr_paid_001", "PR_SUBMIT",  "SUBMIT",  requestorId, "2026-02-01T09:00:00Z"),
    approval("ap_011", "pr_paid_001", "PR_REVIEW",  "APPROVE", approverId,  "2026-02-01T11:00:00Z"),
    approval("ap_012", "pr_paid_001", "ER_SUBMIT",  "SUBMIT",  requestorId, "2026-02-03T10:00:00Z"),
    approval("ap_013", "pr_paid_001", "ER_REVIEW",  "APPROVE", "seed_finance_cl", "2026-02-05T10:00:00Z", "Receipts verified."),
    approval("ap_014", "pr_paid_001", "ER_PAYMENT", "MARK_PAY","seed_finance_cl", "2026-02-06T10:00:00Z", "Paid via check #4421."),
    approval("ap_015", "pr_rejected_001", "PR_SUBMIT",  "SUBMIT",  requestorId, "2026-01-20T09:00:00Z"),
    approval("ap_016", "pr_rejected_001", "PR_REVIEW",  "REJECT",  approverId,  "2026-01-21T10:00:00Z", "Over budget for this quarter. Please resubmit next fiscal year."),
    approval("ap_017", "pr_revisions_001", "PR_SUBMIT",  "SUBMIT",  requestorId, "2026-03-02T09:00:00Z"),
    approval("ap_018", "pr_revisions_001", "PR_REVIEW",  "REQUEST_REVISIONS", approverId, "2026-03-03T10:00:00Z", "Please attach a vendor quote before we can approve."),
  ];

  for (const a of approvals) {
    apBatch.set(db.collection("approvals").doc(a.id), a.data);
  }
  await apBatch.commit();
  console.log("✅ Approval history seeded.");

  console.log("\n🎉 Database seeded successfully!\n");
  console.log("  Tenant:    tenant_citylight_group");
  console.log("  Orgs:      org_citylight, org_glow");
  console.log("  Funds:     8 funds across both orgs");
  console.log("  Vendors:   14 vendors");
  console.log("  Requests:  11 purchase requests (Draft → Paid → Rejected)");
  console.log("  Reports:   3 expense reports");
  console.log("  Line Items:6 line items");
  console.log("  Approvals: 18 approval history entries");
  if (uid) {
    console.log(`\n  Your account (${email}) has admin access to both orgs.`);
    console.log("  Log in at https://expense-workflow-platform.web.app");
  }
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
