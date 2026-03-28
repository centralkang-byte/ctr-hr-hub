// ================================================================
// B-3 Regression: Create concurrent assignments using actual DB data
// scripts/seed-concurrent-regression.ts
//
// Creates 6 secondary assignments for regression testing:
// - 3 QA accounts (manager, manager2, hr) for UI testing
// - 3 regular employees for data path testing
// - Mix of domestic (CTR-KR→CTR-MOB/ECO/ENG) and overseas (CTR-KR→CTR-EU)
// ================================================================

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Deterministic UUID
function deterministicUUID(namespace: string, key: string): string {
  const str = `${namespace}:${key}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(0, 3)}-${hex.padEnd(12, '0').slice(0, 12)}`
}

interface ConcurrentDef {
  employeeEmail: string
  targetPositionCode: string
  reason: string
}

const CONCURRENT_DEFS: ConcurrentDef[] = [
  // Scenario 1: QA Manager → CTR-MOB ENG Head (domestic cross-company)
  { employeeEmail: 'manager@ctr.co.kr', targetPositionCode: 'CTR-MOB-ENG-HEAD', reason: 'CTR-MOB ENG Head(겸)' },
  // Scenario 2: QA Manager2 → CTR-ECO OPS Head (domestic cross-company)
  { employeeEmail: 'manager2@ctr.co.kr', targetPositionCode: 'CTR-ECO-OPS-HEAD', reason: 'CTR-ECO OPS Head(겸)' },
  // Scenario 3: QA HR Admin → CTR-HQ STRAT Head (domestic cross-company, HR role)
  { employeeEmail: 'hr@ctr.co.kr', targetPositionCode: 'CTR-HQ-STRAT-HEAD', reason: 'CTR-HQ 전략기획팀장(겸)' },
  // Scenario 4: Regular employee → CTR-ENG RD Head (domestic cross-company)
  { employeeEmail: 'park.bj@ctr.co.kr', targetPositionCode: 'CTR-ENG-RD-HEAD', reason: 'CTR-ENG R&D팀장(겸)' },
  // Scenario 5: Regular employee → CTR-EU SALES Head (overseas cross-company — payroll block test)
  { employeeEmail: 'han.fin@ctr.co.kr', targetPositionCode: 'CTR-EU-SALES-HEAD', reason: 'CTR-EU 영업팀장(겸)' },
  // Scenario 6: Regular employee → CTR-ECO ENG Head (domestic cross-company)
  { employeeEmail: 'lee.fin@ctr.co.kr', targetPositionCode: 'CTR-ECO-ENG-HEAD', reason: 'CTR-ECO ENG팀장(겸)' },
]

async function main() {
  console.log('\n========================================')
  console.log('B-3 Regression: Concurrent Assignments')
  console.log('========================================\n')

  let created = 0
  let skipped = 0

  for (const def of CONCURRENT_DEFS) {
    const { employeeEmail, targetPositionCode, reason } = def

    // 1. Find employee
    const employee = await prisma.employee.findFirst({ where: { email: employeeEmail } })
    if (!employee) {
      console.warn(`  ⚠️ SKIP: Employee not found — ${employeeEmail}`)
      skipped++
      continue
    }

    // 2. Find target position
    const position = await prisma.position.findFirst({
      where: { code: targetPositionCode },
      select: { id: true, companyId: true, departmentId: true },
    })
    if (!position) {
      console.warn(`  ⚠️ SKIP: Position not found — ${targetPositionCode}`)
      skipped++
      continue
    }

    // 3. Find primary assignment
    const primaryAssignment = await prisma.employeeAssignment.findFirst({
      where: { employeeId: employee.id, isPrimary: true, endDate: null },
    })
    if (!primaryAssignment) {
      console.warn(`  ⚠️ SKIP: No active primary — ${employee.name} (${employeeEmail})`)
      skipped++
      continue
    }

    // 4. Check if secondary already exists for this position
    const existing = await prisma.employeeAssignment.findFirst({
      where: { employeeId: employee.id, positionId: position.id, endDate: null, isPrimary: false },
    })
    if (existing) {
      console.log(`  ⏭️ EXISTS: ${employee.name} → ${targetPositionCode}`)
      skipped++
      continue
    }

    // 5. Create secondary assignment
    const assignmentId = deterministicUUID('regression-concurrent', `${employeeEmail}:${targetPositionCode}`)
    await prisma.employeeAssignment.upsert({
      where: { id: assignmentId },
      update: {
        companyId: position.companyId,
        departmentId: position.departmentId,
        positionId: position.id,
        jobGradeId: primaryAssignment.jobGradeId,
        employmentType: primaryAssignment.employmentType,
        status: primaryAssignment.status,
        isPrimary: false,
        changeType: 'CONCURRENT',
        effectiveDate: primaryAssignment.effectiveDate,
      },
      create: {
        id: assignmentId,
        employeeId: employee.id,
        companyId: position.companyId,
        departmentId: position.departmentId,
        positionId: position.id,
        jobGradeId: primaryAssignment.jobGradeId,
        jobCategoryId: primaryAssignment.jobCategoryId,
        employmentType: primaryAssignment.employmentType,
        contractType: primaryAssignment.contractType,
        status: primaryAssignment.status,
        isPrimary: false,
        changeType: 'CONCURRENT',
        effectiveDate: primaryAssignment.effectiveDate,
        reason,
      },
    })

    console.log(`  ✅ ${employee.name} (${employeeEmail}) → ${targetPositionCode} [${reason}]`)
    created++
  }

  console.log(`\n  📊 Results: ${created} created, ${skipped} skipped`)
  console.log('========================================\n')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
