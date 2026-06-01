// ═══════════════════════════════════════════════════════════
// QA Accounts Seed Wrapper
// ───────────────────────────────────────────────────────────
// Lightweight wrapper that runs ONLY the QA accounts seed module
// (prisma/seeds/00-qa-accounts.ts) — fully idempotent via upsert.
//
// Use cases:
//   - Vercel build hook: refresh QA accounts after each deploy without
//     re-running the full master seed (which is heavy)
//   - CI workflows (e2e, visual baseline) that need QA accounts but
//     don't want the cost of the full master seed
//   - Local recovery when QA accounts go missing from the shared dev DB
//
// Note: prisma/seed.ts (master orchestrator) ALSO calls seedQAAccounts
// (see prisma/seed.ts:3568), so running the master seed is sufficient.
// This wrapper exists for environments where the master seed is too heavy.
// ═══════════════════════════════════════════════════════════

import dotenv from 'dotenv'
import path from 'path'

// Load .env.local first (higher priority), then fallback to .env.
// Mirrors prisma/seed.ts pattern. Vercel build env injects DATABASE_URL
// directly, so these files may be absent — dotenv.config is no-op then.
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

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
