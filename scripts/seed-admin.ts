/**
 * One-time script: create the bootstrap admin user in Firestore emulator.
 * Run: FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node --project tsconfig.seed.json scripts/seed-admin.ts
 */

import * as admin from 'firebase-admin'
import { getFirestore } from 'firebase-admin/firestore'

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080'

admin.initializeApp({ projectId: 'demo-project' })
const db = getFirestore()

async function main() {
  const email = 'deboijiwola@thecitylight.org'
  const docId = email.toLowerCase()

  // Check if already exists (by email field query — handles both email-keyed and uid-keyed docs)
  const existing = await db
    .collection('users')
    .where('email', '==', email)
    .limit(1)
    .get()

  if (!existing.empty) {
    console.log(`User already exists (doc: ${existing.docs[0].id}). Ensuring active + ADMIN role...`)
    await existing.docs[0].ref.update({ active: true, role: 'ADMIN', updatedAt: new Date() })
    console.log('Updated.')
    return
  }

  await db.collection('users').doc(docId).set({
    userId: docId,
    name: 'Debo Ijiwola',
    email,
    orgId: 'org_citylight',
    tenantId: 'tenant_main',
    role: 'ADMIN',
    ministryDepartment: '',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  console.log(`Created admin user: ${email}`)
}

main().catch(err => { console.error(err); process.exit(1) })
