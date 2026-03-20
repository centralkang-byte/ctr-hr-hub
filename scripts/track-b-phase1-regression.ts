/**
 * Track B Phase 1 — Mini Regression Script
 *
 * Usage: npx tsx scripts/track-b-phase1-regression.ts
 *
 * Validates data integrity after Phase 1 seed operations.
 * Does NOT modify any data — read-only checks.
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Check .env.local or .env')
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: PrismaClient = new (PrismaClient as any)({ adapter, log: ['warn', 'error'] })

let passed = 0
let failed = 0

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

async function regression() {
  console.log('═══════════════════════════════════════════')
  console.log(' Track B Phase 1 — Mini Regression')
  console.log('═══════════════════════════════════════════\n')

  // ── 1. Companies ──
  console.log('📌 Companies')
  const companies = await prisma.company.count()
  check('13 companies exist', companies === 13, `got ${companies}`)

  // ── 2. Departments ──
  console.log('\n📌 Departments')
  const departments = await prisma.department.count()
  check('≥195 departments', departments >= 195, `got ${departments}`)

  // No orphan departments (non-root without parent)
  const orphanDepts = await prisma.department.count({
    where: { parentId: null, level: { gt: 0 } },
  })
  check('No orphan departments (non-root with null parent)', orphanDepts === 0, `found ${orphanDepts}`)

  // Circular reference check
  const allDepts = await prisma.department.findMany({ select: { id: true, parentId: true } })
  const deptParentMap = new Map(allDepts.map(d => [d.id, d.parentId]))
  let circularCount = 0
  for (const [id] of deptParentMap) {
    let current: string | null = id
    const visited = new Set<string>()
    while (current && !visited.has(current)) {
      visited.add(current)
      current = deptParentMap.get(current) ?? null
    }
    if (current && visited.has(current)) circularCount++
  }
  check('No circular department references', circularCount === 0, `found ${circularCount}`)

  // ── 3. Positions ──
  console.log('\n📌 Positions')
  const positions = await prisma.position.count()
  check('≥250 positions', positions >= 250, `got ${positions}`)

  const dottedLines = await prisma.position.count({
    where: { dottedLinePositionId: { not: null } },
  })
  check('≥10 dotted line relationships', dottedLines >= 10, `got ${dottedLines}`)

  // Vice Chairman exists (not Chairman)
  const vchair = await prisma.position.findFirst({ where: { code: 'POS-HOLD-VCHAIR' } })
  check('Vice Chairman position exists (POS-HOLD-VCHAIR)', vchair !== null)
  if (vchair) {
    check('Vice Chairman title is 부회장', vchair.titleKo === '부회장', `got "${vchair.titleKo}"`)
  }

  // ── 4. Job Grades ──
  console.log('\n📌 Job Grades')
  const grades = await prisma.jobGrade.count()
  check('≥74 job grades (49 KR + 25 overseas)', grades >= 74, `got ${grades}`)

  // ── 5. Employees ──
  console.log('\n📌 Employees')
  const employees = await prisma.employee.count()
  check('≥440 employees', employees >= 440, `got ${employees}`)

  // Every employee has at least 1 assignment
  const noAssignment = await prisma.employee.count({
    where: { assignments: { none: {} } },
  })
  check('All employees have assignments', noAssignment === 0, `${noAssignment} without`)

  // Every employee has at least 1 role
  const noRole = await prisma.employee.count({
    where: { employeeRoles: { none: {} } },
  })
  check('All employees have roles', noRole === 0, `${noRole} without`)

  // ── 6. Worker type distribution ──
  console.log('\n📌 Worker Type Distribution')
  const fullTime = await prisma.employeeAssignment.count({
    where: { employmentType: 'FULL_TIME', isPrimary: true, endDate: null },
  })
  const dispatch = await prisma.employeeAssignment.count({
    where: { employmentType: 'DISPATCH', isPrimary: true, endDate: null },
  })
  const contract = await prisma.employeeAssignment.count({
    where: { employmentType: 'CONTRACT', isPrimary: true, endDate: null },
  })
  console.log(`  ℹ️  FULL_TIME=${fullTime}, DISPATCH=${dispatch}, CONTRACT=${contract}`)
  check('FULL_TIME ≥ 350', fullTime >= 350, `got ${fullTime}`)

  // ── 7. Named employee checks ──
  console.log('\n📌 Named Employee Checks')

  // 강상우 — SUPER_ADMIN, CTR-HOLD
  const kangSangwoo = await prisma.employee.findFirst({
    where: { email: 'sangwoo.kang@ctr.co.kr' },
    include: {
      assignments: { where: { isPrimary: true, endDate: null } },
      employeeRoles: { include: { role: true } },
    },
  })
  check('강상우 exists', kangSangwoo !== null)
  if (kangSangwoo) {
    const hasSuperAdmin = kangSangwoo.employeeRoles.some((r: { role: { code: string } }) => r.role.code === 'SUPER_ADMIN')
    check('강상우 is SUPER_ADMIN', hasSuperAdmin)

    const holdCompany = await prisma.company.findFirst({ where: { code: 'CTR-HOLD' } })
    const primaryCompanyId = kangSangwoo.assignments[0]?.companyId
    check('강상우 primary assignment = CTR-HOLD', primaryCompanyId === holdCompany?.id)
  }

  // ── 8. QA Test Accounts ──
  console.log('\n📌 QA Test Accounts')
  const qaEmails = [
    'super@ctr.co.kr', 'hr@ctr.co.kr', 'hr@ctr-cn.com',
    'manager@ctr.co.kr', 'manager2@ctr.co.kr',
    'employee-a@ctr.co.kr', 'employee-b@ctr.co.kr', 'employee-c@ctr.co.kr',
  ]
  for (const email of qaEmails) {
    const found = await prisma.employee.count({ where: { email } })
    check(`QA account ${email}`, found === 1, found === 0 ? 'NOT FOUND' : undefined)
  }

  // ── 9. Worker Type Settings ──
  console.log('\n📌 Worker Type Settings')
  const wtSettings = await prisma.companyProcessSetting.count({
    where: { settingType: 'WORKER_TYPE' },
  })
  check('≥9 WORKER_TYPE settings', wtSettings >= 9, `got ${wtSettings}`)

  // ── 10. resolveWorkerType() module exists ──
  console.log('\n📌 Code Checks')
  const fs = await import('fs')
  const resolverPath = path.resolve(__dirname, '..', 'src/lib/employee/worker-type-resolver.ts')
  check('resolveWorkerType() file exists', fs.existsSync(resolverPath))

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════')
  console.log(` Results: ${passed} passed, ${failed} failed`)
  console.log('═══════════════════════════════════════════\n')

  if (failed > 0) {
    console.log('⚠️  Some checks failed. This may be expected if seeds haven\'t been run yet.')
    console.log('    Run: npx tsx scripts/run-org-seed.ts')
  } else {
    console.log('✅ All Phase 1 regression checks passed!')
  }
}

regression()
  .catch(e => { console.error('❌ Regression failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
