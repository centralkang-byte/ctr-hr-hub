/**
 * Phase 6B — Seed Invariant + Cascade Orphan Validator
 *
 * Usage: npm run seed:validate   (or: npx tsx scripts/seed-validate-phase6b.ts)
 *
 * Read-only validator. Asserts ~25 invariants against the 3 seed files:
 *   - prisma/seeds/49-edge-case-personas.ts  (30 personas, unconditional)
 *   - prisma/seeds/50-volume-stress.ts       (2,500 emps, gated SEED_VOLUME)
 *   - prisma/seeds/51-historical-3years.ts   (36-mo history, gated SEED_HISTORY)
 *
 * Sections:
 *   A — Edge persona existence + domain (8 checks, unconditional)
 *   B — Edge persona invariants (7 checks, unconditional)
 *   C — Cascade orphan detection via raw SQL (7 queries, unconditional)
 *   D — Restrict constraint sanity (1 query, unconditional)
 *   E — Volume seed assertions (4 checks, gated on VOL- detection)
 *   F — History seed assertions (4 checks, gated on HIST- detection)
 *   G — Summary + exit (0 pass / 1 assertion fail / 2 infra fail)
 *
 * INTEGRITY TOOL — scripts/ only. Raw $queryRaw calls in Section C/D bypass
 * RLS by design: an integrity check needs ground truth, not tenant-scoped
 * views. Do NOT copy this pattern into src/app/api/** or src/lib/** runtime
 * code — it would open a cross-tenant data leak.
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

// ─── Deterministic UUID ─────────────────────────────────────
// Must stay in sync with prisma/seeds/49-edge-case-personas.ts:10-22.
// Hand-rolled 32-bit hash (not UUIDv5) — collision risk exists but is out
// of scope for Phase 6B. See plan §5 "Risks" for the collision follow-up.
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

const uid = (key: string) => deterministicUUID('edge-persona-49', key)

// ─── Check Helper ───────────────────────────────────────────

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

// ─── Main ───────────────────────────────────────────────────

async function validate() {
  console.log('═══════════════════════════════════════════')
  console.log(' Phase 6B — Seed Invariant + Cascade Validator')
  console.log('═══════════════════════════════════════════\n')

  // Flag detection
  const volumeSeedCount = await prisma.employee.count({
    where: { employeeNo: { startsWith: 'VOL-' } },
  })
  const historyCycleCount = await prisma.performanceCycle.count({
    where: { name: { startsWith: 'HIST-' } },
  })
  const volumeSeeded = volumeSeedCount > 0
  const historySeeded = historyCycleCount > 0
  console.log(`ℹ️  Flag detection: volume=${volumeSeeded ? 'yes' : 'no'}, history=${historySeeded ? 'yes' : 'no'}`)

  // ═════════════════════════════════════════════════════════
  // Section A — Edge persona existence + domain (8 checks)
  // ═════════════════════════════════════════════════════════
  console.log('\n📌 Section A — Edge persona existence + domain')

  // FIXTURE_TODAY — stable reference date for time-windowed assertions.
  // Anchored at 2026-04-06 (matches EDGE-012 hireDate with "// 오늘 입사"
  // comment in prisma/seeds/49-edge-case-personas.ts:197). Using wall-clock
  // `new Date()` would produce false failures after 2026-05-06 (EDGE-007
  // resignDate) and 2026-06-01 (EDGE-001 probationEndDate). Update this
  // constant only if the seed's static fixture dates change.
  const FIXTURE_TODAY = new Date('2026-04-06T00:00:00Z')
  const fixturePlus31 = new Date(FIXTURE_TODAY)
  fixturePlus31.setDate(fixturePlus31.getDate() + 31) // +31 absorbs TZ drift

  // A1 — EDGE-002 probation-expired (probationEndDate < FIXTURE_TODAY, status IN_PROGRESS)
  const probExpired = await prisma.employee.findUnique({
    where: { id: uid('probation-expired') },
    select: { probationStatus: true, probationEndDate: true },
  })
  check(
    'A1 EDGE-002 probation-expired: probationEndDate past + status IN_PROGRESS',
    probExpired !== null &&
      probExpired.probationStatus === 'IN_PROGRESS' &&
      probExpired.probationEndDate !== null &&
      probExpired.probationEndDate < FIXTURE_TODAY,
    probExpired ? `endDate=${probExpired.probationEndDate?.toISOString().slice(0, 10)}, status=${probExpired.probationStatus}` : 'not found',
  )

  // A2 — EDGE-003 contract-expiring (contractEndDate within FIXTURE_TODAY..+31d, type CONTRACT)
  const contractExp = await prisma.employee.findUnique({
    where: { id: uid('contract-expiring') },
    include: {
      assignments: {
        where: { endDate: null, isPrimary: true },
        select: { employmentType: true },
      },
    },
  })
  const contractExpOk =
    contractExp !== null &&
    contractExp.contractEndDate !== null &&
    contractExp.contractEndDate >= FIXTURE_TODAY &&
    contractExp.contractEndDate <= fixturePlus31 &&
    contractExp.assignments[0]?.employmentType === 'CONTRACT'
  check(
    'A2 EDGE-003 contract-expiring: in FIXTURE..+31d + CONTRACT',
    contractExpOk,
    contractExp
      ? `endDate=${contractExp.contractEndDate?.toISOString().slice(0, 10)}, type=${contractExp.assignments[0]?.employmentType}`
      : 'not found',
  )

  // A3 — EDGE-005 on-leave-childcare has ACTIVE PARENTAL LOA
  const loa = await prisma.leaveOfAbsence.findFirst({
    where: {
      employeeId: uid('on-leave-childcare'),
      status: 'ACTIVE',
      type: { code: 'PARENTAL' },
    },
    select: { id: true, payType: true },
  })
  check(
    'A3 EDGE-005 on-leave-childcare: ACTIVE PARENTAL LOA exists',
    loa !== null,
    loa ? `payType=${loa.payType}` : 'no ACTIVE PARENTAL LOA found',
  )

  // A4 — EDGE-007 offboarding-d30 (resignDate in FIXTURE_TODAY..+31d, assignment status ACTIVE)
  const offboard = await prisma.employee.findUnique({
    where: { id: uid('offboarding-d30') },
    include: {
      assignments: {
        where: { endDate: null, isPrimary: true },
        select: { status: true },
      },
    },
  })
  const offboardOk =
    offboard !== null &&
    offboard.resignDate !== null &&
    offboard.resignDate >= FIXTURE_TODAY &&
    offboard.resignDate <= fixturePlus31 &&
    offboard.assignments[0]?.status === 'ACTIVE'
  check(
    'A4 EDGE-007 offboarding-d30: resignDate in FIXTURE..+31d + assignment ACTIVE',
    offboardOk,
    offboard
      ? `resign=${offboard.resignDate?.toISOString().slice(0, 10)}, assignStatus=${offboard.assignments[0]?.status}`
      : 'not found',
  )

  // A5 — EDGE-009 concurrent-2company (exactly 2 active assignments, endDate null)
  const concurrentActiveCount = await prisma.employeeAssignment.count({
    where: { employeeId: uid('concurrent-2company'), endDate: null },
  })
  check(
    'A5 EDGE-009 concurrent-2company: exactly 2 active assignments',
    concurrentActiveCount === 2,
    `got ${concurrentActiveCount}`,
  )

  // A6 — EDGE-013 entity-transfer (current CTR-CN + historical CTR KR)
  const cnCurrent = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: uid('entity-transfer'),
      endDate: null,
      company: { code: 'CTR-CN' },
    },
    select: { id: true },
  })
  const krHistorical = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: uid('entity-transfer'),
      endDate: { not: null },
      company: { code: 'CTR' },
    },
    select: { id: true },
  })
  check(
    'A6 EDGE-013 entity-transfer: current CTR-CN + historical CTR (KR)',
    cnCurrent !== null && krHistorical !== null,
    `cnCurrent=${cnCurrent !== null}, krHistorical=${krHistorical !== null}`,
  )

  // A7 — EDGE-019 offcycle-pending (PENDING_APPROVAL, current=65M, proposed=72M)
  const pendingReq = await prisma.offCycleCompRequest.findFirst({
    where: {
      employeeId: uid('offcycle-pending'),
      status: 'PENDING_APPROVAL',
    },
    select: { currentBaseSalary: true, proposedBaseSalary: true },
  })
  const currentSalary = pendingReq ? Number(pendingReq.currentBaseSalary) : 0
  const proposedSalary = pendingReq ? Number(pendingReq.proposedBaseSalary) : 0
  check(
    'A7 EDGE-019 offcycle-pending: PENDING_APPROVAL + 65M→72M',
    pendingReq !== null && currentSalary === 65_000_000 && proposedSalary === 72_000_000,
    pendingReq ? `current=${currentSalary}, proposed=${proposedSalary}` : 'not found',
  )

  // A8 — EDGE-021 leave-zero (LeaveYearBalance 2026, entitled=15, used=15)
  const zeroBal = await prisma.leaveYearBalance.findFirst({
    where: {
      employeeId: uid('leave-zero'),
      year: 2026,
    },
    select: { entitled: true, used: true },
  })
  const zeroEntitled = zeroBal ? Number(zeroBal.entitled) : -1
  const zeroUsed = zeroBal ? Number(zeroBal.used) : -1
  check(
    'A8 EDGE-021 leave-zero: year=2026, entitled=15, used=15',
    zeroBal !== null && zeroEntitled === 15 && zeroUsed === 15,
    zeroBal ? `entitled=${zeroEntitled}, used=${zeroUsed}` : 'not found',
  )

  // ═════════════════════════════════════════════════════════
  // Section B — Edge persona invariants (7 checks)
  // ═════════════════════════════════════════════════════════
  console.log('\n📌 Section B — Edge persona invariants')

  // B1 — EDGE-022 leave-negative (used > entitled)
  const negBal = await prisma.leaveYearBalance.findFirst({
    where: { employeeId: uid('leave-negative'), year: 2026 },
    select: { entitled: true, used: true },
  })
  const negEntitled = negBal ? Number(negBal.entitled) : 0
  const negUsed = negBal ? Number(negBal.used) : 0
  check(
    'B1 EDGE-022 leave-negative: used > entitled (2일 선사용)',
    negBal !== null && negUsed > negEntitled,
    negBal ? `entitled=${negEntitled}, used=${negUsed}` : 'not found',
  )

  // B2 — EDGE-023 tardy-frequent (≥5 LATE attendance records)
  const tardyCount = await prisma.attendance.count({
    where: { employeeId: uid('tardy-frequent'), status: 'LATE' },
  })
  check(
    'B2 EDGE-023 tardy-frequent: ≥5 LATE attendance records',
    tardyCount >= 5,
    `got ${tardyCount}`,
  )

  // B3 — EDGE-024 overtime-warning (≥1 Attendance with overtimeMinutes>0 AND totalMinutes≥720)
  const otCount = await prisma.attendance.count({
    where: {
      employeeId: uid('overtime-warning'),
      overtimeMinutes: { gt: 0 },
      totalMinutes: { gte: 720 },
    },
  })
  check(
    'B3 EDGE-024 overtime-warning: ≥1 record with overtime + ≥720min total',
    otCount >= 1,
    `got ${otCount}`,
  )

  // B4 — EDGE-012 no-department (primary assignment with departmentId null)
  const noDeptAssign = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: uid('no-department'),
      departmentId: null,
      isPrimary: true,
      endDate: null,
    },
    select: { id: true },
  })
  check('B4 EDGE-012 no-department: primary assignment has null departmentId', noDeptAssign !== null)

  // B5 — EDGE-014 no-grade-overseas (CTR-US assignment with jobGradeId null)
  const noGradeAssign = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: uid('no-grade-overseas'),
      jobGradeId: null,
      endDate: null,
      company: { code: 'CTR-US' },
    },
    select: { id: true },
  })
  check('B5 EDGE-014 no-grade-overseas: CTR-US assignment has null jobGradeId', noGradeAssign !== null)

  // B6 — EDGE-001 probation-active (positive control: probationEndDate > FIXTURE_TODAY, IN_PROGRESS)
  const probActive = await prisma.employee.findUnique({
    where: { id: uid('probation-active') },
    select: { probationStatus: true, probationEndDate: true },
  })
  check(
    'B6 EDGE-001 probation-active: probationEndDate > FIXTURE + status IN_PROGRESS (positive control)',
    probActive !== null &&
      probActive.probationStatus === 'IN_PROGRESS' &&
      probActive.probationEndDate !== null &&
      probActive.probationEndDate > FIXTURE_TODAY,
    probActive ? `endDate=${probActive.probationEndDate?.toISOString().slice(0, 10)}` : 'not found',
  )

  // B7 — Floor check: ≥28 EDGE personas exist (tolerant, out of 30 seeded)
  const edgeCount = await prisma.employee.count({
    where: { employeeNo: { startsWith: 'EDGE-' } },
  })
  check('B7 Floor ≥28 EDGE personas (of 30 seeded)', edgeCount >= 28, `got ${edgeCount}`)

  // ═════════════════════════════════════════════════════════
  // Section C — Cascade orphan detection (raw SQL, bypasses RLS)
  // ═════════════════════════════════════════════════════════
  console.log('\n📌 Section C — Cascade orphan detection')

  // C1 — employee_assignments → employees (audit trail linchpin, schema.prisma:1615)
  const c1 = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM employee_assignments c
    LEFT JOIN employees p ON c.employee_id = p.id
    WHERE p.id IS NULL
  `
  const c1count = Number(c1[0].count)
  check('C1 employee_assignments → employees: no orphans', c1count === 0, `found ${c1count}`)

  // C2 — employee_profile_extensions → employees (schema.prisma:3754)
  const c2 = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM employee_profile_extensions c
    LEFT JOIN employees p ON c.employee_id = p.id
    WHERE p.id IS NULL
  `
  const c2count = Number(c2[0].count)
  check('C2 employee_profile_extensions → employees: no orphans', c2count === 0, `found ${c2count}`)

  // C3 — emergency_contacts → employees (schema.prisma:3770)
  const c3 = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM emergency_contacts c
    LEFT JOIN employees p ON c.employee_id = p.id
    WHERE p.id IS NULL
  `
  const c3count = Number(c3[0].count)
  check('C3 emergency_contacts → employees: no orphans', c3count === 0, `found ${c3count}`)

  // C4 — profile_visibilities → employees (schema.prisma:3789)
  const c4 = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM profile_visibilities c
    LEFT JOIN employees p ON c.employee_id = p.id
    WHERE p.id IS NULL
  `
  const c4count = Number(c4[0].count)
  check('C4 profile_visibilities → employees: no orphans', c4count === 0, `found ${c4count}`)

  // C5a — year_end_dependents → year_end_settlements (schema.prisma:6229)
  const c5a = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM year_end_dependents c
    LEFT JOIN year_end_settlements p ON c.settlement_id = p.id
    WHERE p.id IS NULL
  `
  const c5acount = Number(c5a[0].count)
  check('C5a year_end_dependents → settlements: no orphans', c5acount === 0, `found ${c5acount}`)

  // C5b — year_end_deductions → year_end_settlements (schema.prisma:6248)
  const c5b = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM year_end_deductions c
    LEFT JOIN year_end_settlements p ON c.settlement_id = p.id
    WHERE p.id IS NULL
  `
  const c5bcount = Number(c5b[0].count)
  check('C5b year_end_deductions → settlements: no orphans', c5bcount === 0, `found ${c5bcount}`)

  // C5c — year_end_documents → year_end_settlements (schema.prisma:6263)
  const c5c = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM year_end_documents c
    LEFT JOIN year_end_settlements p ON c.settlement_id = p.id
    WHERE p.id IS NULL
  `
  const c5ccount = Number(c5c[0].count)
  check('C5c year_end_documents → settlements: no orphans', c5ccount === 0, `found ${c5ccount}`)

  // C6 — EmployeeAssignment.work_location_id dangling (SetNull, schema.prisma:1622)
  // Schema says onDelete: SetNull, so any non-null work_location_id must point at an existing row.
  const c6 = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM employee_assignments c
    LEFT JOIN work_locations p ON c.work_location_id = p.id
    WHERE c.work_location_id IS NOT NULL AND p.id IS NULL
  `
  const c6count = Number(c6[0].count)
  check('C6 employee_assignments.work_location_id dangling SetNull', c6count === 0, `found ${c6count}`)

  // ═════════════════════════════════════════════════════════
  // Section D — Restrict constraint sanity (1 query)
  // ═════════════════════════════════════════════════════════
  console.log('\n📌 Section D — Restrict constraint sanity')

  // D1 — goal_revisions → mbo_goals (onDelete: Restrict, schema.prisma:2823)
  // Postgres enforces this at the DB layer; this check catches bulk-SQL seed
  // paths that bypassed Prisma.
  const d1 = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM goal_revisions c
    LEFT JOIN mbo_goals p ON c.goal_id = p.id
    WHERE p.id IS NULL
  `
  const d1count = Number(d1[0].count)
  check('D1 goal_revisions → mbo_goals: no orphans (Restrict sanity)', d1count === 0, `found ${d1count}`)

  // ═════════════════════════════════════════════════════════
  // Section E — Volume seed assertions (gated on VOL- detection)
  // ═════════════════════════════════════════════════════════
  console.log('\n📌 Section E — Volume seed (50-volume-stress.ts)')

  if (!volumeSeeded) {
    console.log('  ⏭️  Volume seed not detected (no VOL- employees), skipping §E')
  } else {
    // E1 — VOL employee count within ±1% of TOTAL=2500
    check(
      'E1 VOL employees between 2480 and 2520 (±1% of 2500)',
      volumeSeedCount >= 2480 && volumeSeedCount <= 2520,
      `got ${volumeSeedCount}`,
    )

    // E2 — Every VOL employee has exactly 1 primary assignment (endDate null)
    const volEmpIds = await prisma.employee.findMany({
      where: { employeeNo: { startsWith: 'VOL-' } },
      select: { id: true },
    })
    const volIds = volEmpIds.map(e => e.id)
    const primaryAssigns = await prisma.employeeAssignment.findMany({
      where: { employeeId: { in: volIds }, isPrimary: true, endDate: null },
      select: { employeeId: true },
    })
    const countByEmp = new Map<string, number>()
    for (const a of primaryAssigns) {
      countByEmp.set(a.employeeId, (countByEmp.get(a.employeeId) ?? 0) + 1)
    }
    let volWithWrongPrimary = 0
    for (const id of volIds) {
      if (countByEmp.get(id) !== 1) volWithWrongPrimary++
    }
    check(
      'E2 Every VOL employee has exactly 1 primary active assignment',
      volWithWrongPrimary === 0,
      `${volWithWrongPrimary} VOL employees without exactly 1 primary`,
    )

    // E3 — Attendance floor: ≥30000 rows for VOL employees
    const volAttCount = await prisma.attendance.count({
      where: { employeeId: { in: volIds } },
    })
    check('E3 ≥30000 attendance rows for VOL employees', volAttCount >= 30000, `got ${volAttCount}`)

    // E4 — MboGoal floor: ≥2800 rows for VOL employees
    const volGoalCount = await prisma.mboGoal.count({
      where: { employeeId: { in: volIds } },
    })
    check('E4 ≥2800 mbo_goals for VOL employees', volGoalCount >= 2800, `got ${volGoalCount}`)
  }

  // ═════════════════════════════════════════════════════════
  // Section F — History seed assertions (gated on HIST- detection)
  // ═════════════════════════════════════════════════════════
  console.log('\n📌 Section F — History seed (51-historical-3years.ts)')

  if (!historySeeded) {
    console.log('  ⏭️  History seed not detected (no HIST- cycles), skipping §F')
  } else {
    // F1 — Exactly 6 HIST cycles
    check('F1 HIST cycles exactly 6', historyCycleCount === 6, `got ${historyCycleCount}`)

    // F2 — All 6 HIST cycles have status CLOSED
    const nonClosed = await prisma.performanceCycle.count({
      where: {
        name: { startsWith: 'HIST-' },
        status: { not: 'CLOSED' },
      },
    })
    check('F2 All HIST cycles status=CLOSED', nonClosed === 0, `${nonClosed} non-CLOSED`)

    // F3 — ≥36 payroll runs in historical range 2023-01..2025-12.
    // Global count would produce false passes because 06-payroll.ts seeds
    // runs in 2025-09..2026-02. Restricting by yearMonth isolates the
    // 51-historical-3years contribution (36 months × N companies).
    const payrollRunCount = await prisma.payrollRun.count({
      where: { yearMonth: { gte: '2023-01', lte: '2025-12' } },
    })
    check('F3 ≥36 payroll runs in 2023-01..2025-12', payrollRunCount >= 36, `got ${payrollRunCount}`)

    // F4 — ≥15 HIST-T* turnover employees. Seed targets "5% annual × 3 years"
    // × non-VOL/EDGE pool (~140 in CTR), realistic floor ~20. Observed = 21
    // on current staging (see commit history of this script). Floor of 15
    // allows seed variability without false failures.
    const turnoverCount = await prisma.employee.count({
      where: { employeeNo: { startsWith: 'HIST-T' } },
    })
    check('F4 ≥15 HIST-T* turnover employees', turnoverCount >= 15, `got ${turnoverCount}`)
  }

  // ═════════════════════════════════════════════════════════
  // Section G — Summary + exit
  // ═════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════')
  console.log(` Results: ${passed} passed, ${failed} failed`)
  console.log('═══════════════════════════════════════════\n')

  if (failed === 0) {
    console.log('✅ All Phase 6B checks passed')
    process.exit(0)
  } else {
    console.log('❌ Phase 6B validation failed')
    process.exit(1)
  }
}

validate()
  .catch(e => {
    console.error('❌ Validator errored:', e)
    process.exit(2)
  })
  .finally(() => prisma.$disconnect())
