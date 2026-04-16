// ═══════════════════════════════════════════════════════════
// QA Accounts Seed Wrapper
// ───────────────────────────────────────────────────────────
// Workaround: prisma/seed.ts (master orchestrator, DO NOT TOUCH)
// does not import or call seedQAAccounts from prisma/seeds/00-qa-accounts.ts,
// so the credentials provider's required SsoIdentity rows for super@/hr@/
// manager@/employee-* are never created by `npx tsx prisma/seed.ts`.
//
// CI workflows that run E2E or visual tests must call this wrapper AFTER
// the main seed to inject the QA accounts (employees + EmployeeAuth +
// SsoIdentity + EmployeeRole).
//
// TODO(seed): incorporate seedQAAccounts into prisma/seed.ts master
// orchestrator (separate task — touches DO NOT TOUCH file).
// ═══════════════════════════════════════════════════════════

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { seedQAAccounts } from '../prisma/seeds/00-qa-accounts'

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required to seed QA accounts')
  }

  // Prisma v7 requires the Postgres adapter — mirrors prisma/seed.ts pattern.
  const adapter = new PrismaPg({ connectionString: DATABASE_URL })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })
  try {
    await seedQAAccounts(prisma)
    console.log('✅ QA accounts seeded (super@/hr@/manager@/employee-*)')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('❌ QA accounts seed failed:', e)
  process.exit(1)
})
