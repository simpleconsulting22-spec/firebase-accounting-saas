/**
 * Firestore seed script — initial data for CityLight Church and Glow Church.
 *
 * Usage:
 *   npm run seed
 *
 * Targets the Firestore emulator by default (localhost:8080).
 * To target a live project, unset FIRESTORE_EMULATOR_HOST before running.
 */

import * as admin from 'firebase-admin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// Default to the local emulator if the env var is not already set.
process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080'

admin.initializeApp({ projectId: 'demo-project' })
const db = getFirestore()

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant_main'
const ORG_CL = 'org_citylight'
const ORG_GL = 'org_glow'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Delete all documents in a collection that match a given orgId. */
async function clearCollectionForOrg(
  collectionName: string,
  orgId: string,
): Promise<void> {
  const snap = await db
    .collection(collectionName)
    .where('orgId', '==', orgId)
    .get()

  if (snap.empty) return

  const batches: admin.firestore.WriteBatch[] = []
  let batch = db.batch()
  let opCount = 0

  for (const doc of snap.docs) {
    batch.delete(doc.ref)
    opCount++
    if (opCount === 500) {
      batches.push(batch)
      batch = db.batch()
      opCount = 0
    }
  }
  if (opCount > 0) batches.push(batch)

  for (const b of batches) await b.commit()
}

// ─── 1. Escalation Rules ──────────────────────────────────────────────────────

interface EscalationRuleDef {
  step: number
  role: string
  threshold: number
  bufferAmount: number
}

const escalationRules: EscalationRuleDef[] = [
  { step: 1, role: 'ADMIN',                       threshold: 0,    bufferAmount: 0   },
  { step: 2, role: 'FINANCE_PAYOR',               threshold: 500,  bufferAmount: 50  },
  { step: 3, role: 'FINANCE_RECEIPTS_REVIEWER',   threshold: 1000, bufferAmount: 100 },
  { step: 4, role: 'FINANCE_QB_ENTRY',            threshold: 5000, bufferAmount: 250 },
]

async function seedEscalationRules(): Promise<void> {
  console.log('Seeding escalation rules...')

  for (const orgId of [ORG_CL, ORG_GL]) {
    await clearCollectionForOrg('escalationRules', orgId)
  }

  let total = 0
  const batch = db.batch()

  for (const orgId of [ORG_CL, ORG_GL]) {
    for (const rule of escalationRules) {
      const ref = db.collection('escalationRules').doc()
      batch.set(ref, {
        orgId,
        tenantId: TENANT_ID,
        step: rule.step,
        role: rule.role,
        threshold: rule.threshold,
        bufferAmount: rule.bufferAmount,
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
      })
      total++
    }
  }

  await batch.commit()
  console.log(`  ✓ Escalation rules seeded (${total} docs).`)
}

// ─── 2. Admin Departments ─────────────────────────────────────────────────────

interface DeptDef {
  ministryDepartment: string
  approverEmail: string
  approverName: string
}

const citylightDepts: DeptDef[] = [
  { ministryDepartment: 'Worship',             approverEmail: 'james@citylightmn.com', approverName: 'James Wilson' },
  { ministryDepartment: 'Youth Ministry',      approverEmail: 'james@citylightmn.com', approverName: 'James Wilson' },
  { ministryDepartment: "Children's Ministry", approverEmail: 'james@citylightmn.com', approverName: 'James Wilson' },
  { ministryDepartment: 'Outreach & Missions', approverEmail: 'james@citylightmn.com', approverName: 'James Wilson' },
  { ministryDepartment: 'Operations',          approverEmail: 'james@citylightmn.com', approverName: 'James Wilson' },
  { ministryDepartment: 'Small Groups',        approverEmail: 'james@citylightmn.com', approverName: 'James Wilson' },
  { ministryDepartment: 'Communications',      approverEmail: 'james@citylightmn.com', approverName: 'James Wilson' },
  { ministryDepartment: 'Finance',             approverEmail: 'james@citylightmn.com', approverName: 'James Wilson' },
]

const glowDepts: DeptDef[] = [
  { ministryDepartment: 'Worship',             approverEmail: 'megan@glowchurch.org', approverName: 'Megan Torres' },
  { ministryDepartment: 'Youth Ministry',      approverEmail: 'megan@glowchurch.org', approverName: 'Megan Torres' },
  { ministryDepartment: "Children's Ministry", approverEmail: 'megan@glowchurch.org', approverName: 'Megan Torres' },
  { ministryDepartment: 'Outreach & Missions', approverEmail: 'megan@glowchurch.org', approverName: 'Megan Torres' },
  { ministryDepartment: 'Operations',          approverEmail: 'megan@glowchurch.org', approverName: 'Megan Torres' },
  { ministryDepartment: 'Communications',      approverEmail: 'megan@glowchurch.org', approverName: 'Megan Torres' },
  { ministryDepartment: 'Finance',             approverEmail: 'megan@glowchurch.org', approverName: 'Megan Torres' },
]

async function seedAdminDepts(): Promise<void> {
  console.log('Seeding admin departments...')

  for (const orgId of [ORG_CL, ORG_GL]) {
    await clearCollectionForOrg('adminDepts', orgId)
  }

  const depts = [
    ...citylightDepts.map((d) => ({ ...d, orgId: ORG_CL })),
    ...glowDepts.map((d) => ({ ...d, orgId: ORG_GL })),
  ]

  let total = 0
  const batch = db.batch()
  for (const dept of depts) {
    const ref = db.collection('adminDepts').doc()
    batch.set(ref, {
      orgId: dept.orgId,
      organizationId: dept.orgId,
      tenantId: TENANT_ID,
      ministryDepartment: dept.ministryDepartment,
      approverEmail: dept.approverEmail,
      approverName: dept.approverName,
      approverId: '',
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    })
    total++
  }
  await batch.commit()

  console.log(`  ✓ Admin departments seeded (${total} docs).`)
}

// ─── 3. Categories ────────────────────────────────────────────────────────────

interface CategoryDef {
  categoryId: string
  categoryName: string
}

const categories: CategoryDef[] = [
  { categoryId: 'CAT-001', categoryName: 'Food & Beverages' },
  { categoryId: 'CAT-002', categoryName: 'Office Supplies' },
  { categoryId: 'CAT-003', categoryName: 'Technology & Equipment' },
  { categoryId: 'CAT-004', categoryName: 'Printing & Signage' },
  { categoryId: 'CAT-005', categoryName: 'Facility & Maintenance' },
  { categoryId: 'CAT-006', categoryName: 'Travel & Transportation' },
  { categoryId: 'CAT-007', categoryName: 'Event & Programs' },
  { categoryId: 'CAT-008', categoryName: 'Missions & Outreach' },
  { categoryId: 'CAT-009', categoryName: 'Worship & Media' },
  { categoryId: 'CAT-010', categoryName: 'Pastoral & Ministry' },
]

async function seedCategories(): Promise<void> {
  console.log('Seeding categories...')

  for (const orgId of [ORG_CL, ORG_GL]) {
    await clearCollectionForOrg('categories', orgId)
  }

  let total = 0
  const batch = db.batch()
  for (const orgId of [ORG_CL, ORG_GL]) {
    for (const cat of categories) {
      const ref = db.collection('categories').doc()
      batch.set(ref, {
        orgId,
        tenantId: TENANT_ID,
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
      })
      total++
    }
  }
  await batch.commit()

  console.log(`  ✓ Categories seeded (${total} docs).`)
}

// ─── 4. QB Payment Accounts ───────────────────────────────────────────────────

const qbAccounts = [
  'General Checking',
  'Petty Cash',
  'Credit Card - Visa',
  'Credit Card - Mastercard',
  'PayPal Business',
  'Venmo Business',
]

async function seedQbPaymentAccounts(): Promise<void> {
  console.log('Seeding QB payment accounts...')

  for (const orgId of [ORG_CL, ORG_GL]) {
    await clearCollectionForOrg('qbPaymentAccounts', orgId)
  }

  let total = 0
  const batch = db.batch()
  for (const orgId of [ORG_CL, ORG_GL]) {
    for (const name of qbAccounts) {
      const ref = db.collection('qbPaymentAccounts').doc()
      batch.set(ref, {
        orgId,
        tenantId: TENANT_ID,
        name,
        accountType: 'Checking',
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
      })
      total++
    }
  }
  await batch.commit()

  console.log(`  ✓ QB payment accounts seeded (${total} docs).`)
}

// ─── 5. Counters ──────────────────────────────────────────────────────────────

async function seedCounters(): Promise<void> {
  console.log('Seeding counters...')

  const counterDefs = [
    { id: 'counter_org_citylight_2025', orgId: ORG_CL, year: 2025 },
    { id: 'counter_org_citylight_2026', orgId: ORG_CL, year: 2026 },
    { id: 'counter_org_glow_2025',      orgId: ORG_GL, year: 2025 },
    { id: 'counter_org_glow_2026',      orgId: ORG_GL, year: 2026 },
  ]

  const batch = db.batch()
  for (const c of counterDefs) {
    batch.set(
      db.collection('counters').doc(c.id),
      { orgId: c.orgId, year: c.year, count: 0 },
      { merge: true },
    )
  }
  await batch.commit()

  console.log(`  ✓ Counters seeded (${counterDefs.length} docs).`)
}

// ─── 6. Sample Vendors ────────────────────────────────────────────────────────

interface VendorDef {
  vendorId: string
  vendorName: string
  vendorEmail: string
  vendorType: string
  w9OnFile: boolean
  w9TaxClassification: string
  is1099Required: boolean
}

const sampleVendors: VendorDef[] = [
  {
    vendorId: 'VND-001',
    vendorName: 'Amazon Business',
    vendorEmail: 'business@amazon.com',
    vendorType: 'Business',
    w9OnFile: false,
    w9TaxClassification: 'C Corporation',
    is1099Required: false,
  },
  {
    vendorId: 'VND-002',
    vendorName: 'Staples',
    vendorEmail: 'biz@staples.com',
    vendorType: 'Business',
    w9OnFile: false,
    w9TaxClassification: 'C Corporation',
    is1099Required: false,
  },
  {
    vendorId: 'VND-003',
    vendorName: 'Home Depot Pro',
    vendorEmail: 'pro@homedepot.com',
    vendorType: 'Business',
    w9OnFile: false,
    w9TaxClassification: 'C Corporation',
    is1099Required: false,
  },
]

async function seedVendors(): Promise<void> {
  console.log('Seeding vendors...')

  for (const orgId of [ORG_CL, ORG_GL]) {
    await clearCollectionForOrg('vendors', orgId)
  }

  let total = 0
  const batch = db.batch()
  for (const orgId of [ORG_CL, ORG_GL]) {
    for (const v of sampleVendors) {
      const ref = db.collection('vendors').doc()
      batch.set(ref, {
        orgId,
        tenantId: TENANT_ID,
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        vendorEmail: v.vendorEmail,
        vendorType: v.vendorType,
        w9OnFile: v.w9OnFile,
        w9TaxClassification: v.w9TaxClassification,
        llcTaxTreatment: '',
        is1099Required: v.is1099Required,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
      })
      total++
    }
  }
  await batch.commit()

  console.log(`  ✓ Vendors seeded (${total} docs).`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Firestore Seed Script ===')
  console.log(`  Emulator host : ${process.env.FIRESTORE_EMULATOR_HOST}`)
  console.log(`  Project       : demo-project`)
  console.log(`  Tenant        : ${TENANT_ID}`)
  console.log(`  Orgs          : ${ORG_CL}, ${ORG_GL}`)
  console.log('')

  await seedEscalationRules()
  await seedAdminDepts()
  await seedCategories()
  await seedQbPaymentAccounts()
  await seedCounters()
  await seedVendors()

  console.log('')
  console.log('All seed data written successfully.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
