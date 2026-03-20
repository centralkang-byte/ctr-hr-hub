// ================================================================
// Track B Phase 1: Org Structure Seed Runner
// scripts/run-org-seed.ts
//
// Usage: npx tsx scripts/run-org-seed.ts
//
// Runs: Departments → JobGrades → Positions → Employees (in order)
// ================================================================

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { seedDepartments } from '../prisma/seeds/36-departments'
import { seedJobGrades } from '../prisma/seeds/37-job-grades'
import { seedPositions } from '../prisma/seeds/38-positions'
import { seedEmployees } from '../prisma/seeds/39-employees'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Check .env.local or .env')
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log(' Track B Phase 1 Session 2: Org Structure ')
  console.log('═══════════════════════════════════════════')

  try {
    await seedDepartments(prisma)
    await seedJobGrades(prisma)
    await seedPositions(prisma)
    await seedEmployees(prisma)

    console.log('\n═══════════════════════════════════════════')
    console.log(' ✅ All org structure + employee seeds complete!')
    console.log('═══════════════════════════════════════════\n')
  } catch (error) {
    console.error('\n❌ Org seed failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
