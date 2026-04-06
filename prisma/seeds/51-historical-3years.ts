// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Historical 3-Year Data Seed
// Flag-gated: SEED_HISTORY=true npx tsx prisma/seed.ts
// Purpose: trend charts, YoY comparison, turnover analysis
// ═══════════════════════════════════════════════════════════

import type { PrismaClient } from '../../src/generated/prisma/client'

// ─── Deterministic helpers ─────────────────────────────────

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

const uid = (key: string) => deterministicUUID('hist-51', key)

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    return s / 0x7fffffff
  }
}

// ─── Constants ─────────────────────────────────────────────

// 36 months: 2023-01 ~ 2025-12
const HISTORY_MONTHS: Array<{ year: number; month: number }> = []
for (let y = 2023; y <= 2025; y++) {
  for (let m = 1; m <= 12; m++) {
    HISTORY_MONTHS.push({ year: y, month: m })
  }
}

// 6 evaluation cycles (H1/H2 × 3 years)
const EVAL_CYCLES = [
  { name: '2023-H1', year: 2023, half: 'H1', startMonth: 1, endMonth: 6 },
  { name: '2023-H2', year: 2023, half: 'H2', startMonth: 7, endMonth: 12 },
  { name: '2024-H1', year: 2024, half: 'H1', startMonth: 1, endMonth: 6 },
  { name: '2024-H2', year: 2024, half: 'H2', startMonth: 7, endMonth: 12 },
  { name: '2025-H1', year: 2025, half: 'H1', startMonth: 1, endMonth: 6 },
  { name: '2025-H2', year: 2025, half: 'H2', startMonth: 7, endMonth: 12 },
]

const GRADE_SALARY: Record<string, number> = {
  E1: 160_000_000,
  S1: 100_000_000,
  L2: 65_000_000,
  L1: 38_000_000,
}

// ─── Main ──────────────────────────────────────────────────

export async function seedHistorical3Years(prisma: PrismaClient) {
  console.log('\n🌱 Seeding 51-historical-3years (3yr history)...')

  if (process.env.SEED_HISTORY !== 'true') {
    console.log('  ⏭️  Skipped (set SEED_HISTORY=true to enable)')
    return { payslips: 0, cycles: 0, turnover: 0 }
  }

  // Check if fully seeded (cycles + evaluations + turnover all exist)
  const existingCycles = await prisma.performanceCycle.count({ where: { name: { startsWith: 'HIST-' } } })
  const existingEvals = await prisma.performanceEvaluation.count({
    where: { cycle: { name: { startsWith: 'HIST-' } } },
  })
  const existingTurnover = await prisma.employee.count({ where: { employeeNo: { startsWith: 'HIST-T' } } })
  if (existingCycles >= 6 && existingEvals > 0 && existingTurnover > 0) {
    console.log(`  ⏭️  Already seeded (${existingCycles} cycles, ${existingEvals} evals, ${existingTurnover} turnover)`)
    return { payslips: 0, cycles: 0, turnover: 0 }
  }

  const rand = seededRandom(51_2025)

  // ── Lookup ──
  const companies = await prisma.company.findMany({ select: { id: true, code: true } })
  const companyMap: Record<string, string> = {}
  for (const c of companies) companyMap[c.code] = c.id

  const ctrId = companyMap['CTR']
  if (!ctrId) {
    console.error('  ❌ CTR company not found')
    return { payslips: 0, cycles: 0, turnover: 0 }
  }

  // Get existing non-VOL, non-EDGE employees with assignments
  const employees = await prisma.employee.findMany({
    where: {
      employeeNo: { not: { startsWith: 'VOL-' } },
      NOT: { employeeNo: { startsWith: 'EDGE-' } },
    },
    select: { id: true, employeeNo: true, hireDate: true },
  })

  const assignments = await prisma.employeeAssignment.findMany({
    where: {
      employeeId: { in: employees.map(e => e.id) },
      isPrimary: true,
      endDate: null,
    },
    select: { employeeId: true, companyId: true, jobGradeId: true },
  })

  const empAssignMap: Record<string, { companyId: string; jobGradeId: string | null }> = {}
  for (const a of assignments) {
    empAssignMap[a.employeeId] = { companyId: a.companyId, jobGradeId: a.jobGradeId }
  }

  // Grade code lookup
  const grades = await prisma.jobGrade.findMany({ select: { id: true, code: true } })
  const gradeCodeMap: Record<string, string> = {} // id -> code
  for (const g of grades) gradeCodeMap[g.id] = g.code

  // Filter to employees with assignments
  const targetEmps = employees.filter(e => empAssignMap[e.id])
  console.log(`  📊 Target: ${targetEmps.length} employees (excluding VOL/EDGE)`)

  // ── 1. Historical PayrollRun + PayrollPayslip ──

  console.log('  ⏳ Generating payroll history (36 months)...')
  let payslipCount = 0

  // Create one PayrollRun per month per company
  const payrollRunIds: Record<string, string> = {} // "companyId:YYYY-MM" -> runId
  const companyIds = [...new Set(Object.values(empAssignMap).map(a => a.companyId))]

  for (const { year, month } of HISTORY_MONTHS) {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`

    for (const companyId of companyIds) {
      const runId = uid(`run-${companyId.slice(0, 8)}-${monthStr}`)
      payrollRunIds[`${companyId}:${monthStr}`] = runId

      const existingRun = await prisma.payrollRun.findUnique({ where: { id: runId } })
      if (!existingRun) {
        await prisma.payrollRun.create({
          data: {
            id: runId,
            companyId,
            yearMonth: monthStr,
            year,
            month,
            periodStart: new Date(year, month - 1, 1),
            periodEnd: new Date(year, month, 0),
            status: 'PAID',
            headcount: 0,
          },
        })
      }
    }
  }

  // Create payslips for each employee × month
  const PAYSLIP_BATCH = 500
  let itemBatch: Array<{
    id: string; runId: string; employeeId: string;
    baseSalary: number; grossPay: number; netPay: number; deductions: number;
  }> = []

  for (const emp of targetEmps) {
    const assign = empAssignMap[emp.id]
    if (!assign) continue

    const gradeCode = assign.jobGradeId ? (gradeCodeMap[assign.jobGradeId] ?? 'L2') : 'L2'
    const annualSalary = GRADE_SALARY[gradeCode] ?? 65_000_000
    const monthlySalary = Math.round(annualSalary / 12)

    for (const { year, month } of HISTORY_MONTHS) {
      // Skip months before hire date
      const hireDate = new Date(emp.hireDate)
      if (new Date(year, month - 1) < new Date(hireDate.getFullYear(), hireDate.getMonth())) continue

      const monthStr = `${year}-${String(month).padStart(2, '0')}`
      const runId = payrollRunIds[`${assign.companyId}:${monthStr}`]
      if (!runId) continue

      // Apply annual raise: ~3% per year from 2023
      const yearsFromBase = year - 2023
      const adjustedSalary = Math.round(monthlySalary * (1 + 0.03 * yearsFromBase))

      const gross = adjustedSalary
      const deductions = Math.round(gross * 0.15) // ~15% tax+insurance
      const net = gross - deductions

      itemBatch.push({
        id: uid(`item-${emp.employeeNo}-${monthStr}`),
        runId,
        employeeId: emp.id,
        baseSalary: adjustedSalary,
        grossPay: gross,
        netPay: net,
        deductions,
      })

      if (itemBatch.length >= PAYSLIP_BATCH) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await prisma.payrollItem.createMany({ data: itemBatch as any[], skipDuplicates: true })
        payslipCount += itemBatch.length
        itemBatch = []
      }
    }
  }

  if (itemBatch.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.payrollItem.createMany({ data: itemBatch as any[], skipDuplicates: true })
    payslipCount += itemBatch.length
  }

  console.log(`  ✅ Payslips: ${payslipCount} records`)

  // ── 2. Historical Performance Cycles ──

  console.log('  ⏳ Generating performance cycles (6 cycles)...')
  let cycleCount = 0

  for (const cycle of EVAL_CYCLES) {
    const cycleId = uid(`cycle-${cycle.name}`)

    const existingCycle2 = await prisma.performanceCycle.findUnique({ where: { id: cycleId } })
    if (!existingCycle2) {
      await prisma.performanceCycle.create({
        data: {
          id: cycleId,
          companyId: ctrId,
          name: `HIST-${cycle.name}`,
          year: cycle.year,
          half: cycle.half as 'H1' | 'H2',
          goalStart: new Date(cycle.year, cycle.startMonth - 1, 1),
          goalEnd: new Date(cycle.year, cycle.startMonth + 2, 0),
          evalStart: new Date(cycle.year, cycle.startMonth + 3, 1),
          evalEnd: new Date(cycle.year, cycle.endMonth, 0),
          status: 'CLOSED',
          mboWeight: 70,
          beiWeight: 30,
        },
      })
    }

    // Create evaluations for CTR employees (sample 50)
    const ctrEmps = targetEmps.filter(e => empAssignMap[e.id]?.companyId === ctrId).slice(0, 50)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evalBatch: any[] = []

    const gradeDistribution = ['E', 'M_PLUS', 'M_PLUS', 'M_PLUS', 'M', 'M', 'M', 'M', 'M', 'B']

    for (const emp of ctrEmps) {
      const hireDate = new Date(emp.hireDate)
      if (new Date(cycle.year, cycle.startMonth - 1) < hireDate) continue

      const perfScore = 60 + Math.floor(rand() * 40) // 60-99
      const compScore = 60 + Math.floor(rand() * 40)
      const grade = gradeDistribution[Math.floor(rand() * gradeDistribution.length)]

      evalBatch.push({
        id: uid(`eval-${emp.employeeNo}-${cycle.name}`),
        cycleId,
        employeeId: emp.id,
        evaluatorId: emp.id, // self-eval for historical data
        companyId: ctrId,
        evalType: 'MANAGER',
        performanceScore: perfScore,
        competencyScore: compScore,
        finalGradeEnum: grade,
        status: 'SUBMITTED',
      })
    }

    if (evalBatch.length > 0) {
      await prisma.performanceEvaluation.createMany({ data: evalBatch, skipDuplicates: true })
      cycleCount += evalBatch.length
    }
  }

  console.log(`  ✅ Evaluations: ${cycleCount} records (6 cycles × ~50 employees)`)

  // ── 3. Turnover Records (5% annual) ──

  console.log('  ⏳ Generating turnover records...')
  let turnoverCount = 0

  // Create resigned employees for turnover analytics
  const turnoverPerYear = Math.ceil(targetEmps.length * 0.05) // 5%

  for (const year of [2023, 2024, 2025]) {
    for (let t = 0; t < turnoverPerYear; t++) {
      const empId = uid(`turnover-${year}-${t}`)
      const assignId = uid(`turnover-assign-${year}-${t}`)
      const idx = `T${year}-${String(t).padStart(3, '0')}`
      const resignMonth = 1 + Math.floor(rand() * 12)
      const resignDate = new Date(year, resignMonth - 1, 10 + Math.floor(rand() * 15))
      const hireDate = new Date(year - 2 - Math.floor(rand() * 3), Math.floor(rand() * 12), 1)

      const existingTurnoverEmp = await prisma.employee.findUnique({ where: { id: empId } })
      if (!existingTurnoverEmp) {
        await prisma.employee.create({
          data: {
            id: empId,
            employeeNo: `HIST-${idx}`,
            name: `퇴직자${idx}`,
            nameEn: `Resigned ${idx}`,
            email: `hist-${idx.toLowerCase()}@ctr.test`,
            hireDate,
            resignDate,
          },
        })

        await prisma.employeeAssignment.create({
          data: {
            id: assignId,
            employeeId: empId,
            effectiveDate: hireDate,
            endDate: resignDate,
            changeType: 'HIRE',
            companyId: ctrId,
            employmentType: 'FULL_TIME',
            status: 'RESIGNED',
            isPrimary: true,
          },
        })
      }

      turnoverCount++
    }
  }

  console.log(`  ✅ Turnover: ${turnoverCount} resigned employees (3 years × 5%)`)

  const total = payslipCount + cycleCount + turnoverCount
  console.log(`  🎉 Historical 3-year total: ${total} records`)
  return { payslips: payslipCount, cycles: cycleCount, turnover: turnoverCount }
}
