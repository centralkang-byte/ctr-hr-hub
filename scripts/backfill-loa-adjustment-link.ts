// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Backfill LOA Adjustment Links
//
// One-time script to link existing PayrollAdjustment records
// (category = 'LOA_PAY_ADJUSTMENT') to their matching LeaveOfAbsence records.
//
// Logic:
// 1. Find all PayrollAdjustments where category='LOA_PAY_ADJUSTMENT' and loaId IS NULL
// 2. For each, find matching LOA by employeeId + yearMonth date range
// 3. If exactly one match → update with loaId and loaYearMonth
// 4. If zero or multiple matches → log warning and skip
//
// 실행: npx tsx scripts/backfill-loa-adjustment-link.ts
// ═══════════════════════════════════════════════════════════

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) throw new Error('DATABASE_URL not set')
const adapter = new PrismaPg({ connectionString: dbUrl })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: PrismaClient = new (PrismaClient as any)({ adapter })

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Backfill LOA Adjustment Links`)
  console.log(`${'═'.repeat(60)}\n`)

  // ── Find orphan adjustments ──────────────────────────
  console.log('🔍 Finding orphan LOA adjustments (loaId IS NULL)...')
  const orphanAdjs = await prisma.payrollAdjustment.findMany({
    where: {
      category: 'LOA_PAY_ADJUSTMENT',
      loaId: null,
    },
    include: {
      payrollRun: { select: { yearMonth: true, companyId: true } },
      employee: { select: { id: true, name: true } },
    },
  })

  console.log(`✓ Found ${orphanAdjs.length} orphan adjustments\n`)

  if (orphanAdjs.length === 0) {
    console.log('No orphan adjustments to process. Exiting.')
    return
  }

  let matched = 0
  let skipped = 0

  // ── Process each adjustment ──────────────────────────
  for (const adj of orphanAdjs) {
    const { id, employeeId, payrollRun, employee } = adj
    const [y, m] = payrollRun.yearMonth.split('-').map(Number)

    // Parse yearMonth to date range
    const monthStart = new Date(Date.UTC(y, m - 1, 1))
    const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))

    // Find matching LOAs
    // Status must be ACTIVE, COMPLETED, or RETURN_REQUESTED
    // Date range must overlap with the payroll month
    const candidateLoas = await prisma.leaveOfAbsence.findMany({
      where: {
        employeeId,
        status: { in: ['ACTIVE', 'COMPLETED', 'RETURN_REQUESTED'] },
        startDate: { lte: monthEnd },
        OR: [
          { expectedEndDate: null },
          { expectedEndDate: { gte: monthStart } },
          { actualEndDate: { gte: monthStart } },
        ],
      },
      select: { id: true, startDate: true, expectedEndDate: true, actualEndDate: true },
    })

    if (candidateLoas.length === 1) {
      // ✓ Exactly one match
      const loa = candidateLoas[0]
      await prisma.payrollAdjustment.update({
        where: { id },
        data: {
          loaId: loa.id,
          loaYearMonth: payrollRun.yearMonth,
        },
      })
      matched++
      console.log(
        `✓ adj:${id.slice(0, 8)} emp:${employee.name} month:${payrollRun.yearMonth} → loaId:${loa.id.slice(0, 8)}`
      )
    } else {
      // ✗ Zero or multiple matches
      skipped++
      console.warn(
        `⚠ adj:${id.slice(0, 8)} emp:${employee.name} month:${payrollRun.yearMonth} — ${candidateLoas.length} candidate LOAs (expected 1)`
      )
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Summary`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`Total processed: ${orphanAdjs.length}`)
  console.log(`Matched:        ${matched}`)
  console.log(`Skipped:        ${skipped}`)
  console.log(`${'═'.repeat(60)}\n`)
}

main()
  .catch((err) => {
    console.error('\n❌ Error:', err.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
