// ================================================================
// CTR HR Hub — Seed Data Expansion: Session 3 — KR Payroll
// prisma/seeds/06-payroll.ts
//
// Creates:
//   CTR: 6 PayrollRuns × ~80 employees = ~480 PayrollItems
//   Period: 2025-09 ~ 2026-02
//   Uses createMany + skipDuplicates for idempotency
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

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

function sr(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

// ── Grade → monthly base salary (KRW) ────────────────────────
const GRADE_BASE: Record<string, number> = {
  G1: 13_300_000,
  G2:  8_750_000,
  G3:  6_670_000,
  G4:  5_210_000,
  G5:  4_080_000,
  G6:  3_210_000,
  S1:  8_750_000,  // fallback for global grades
  S2:  6_670_000,
  S3:  5_210_000,
  S4:  4_080_000,
}
const POSITION_ALLOWANCE: Record<string, number> = {
  G1: 1_000_000, G2: 700_000, G3: 500_000,
  G4: 300_000,   G5: 150_000, G6: 0,
  S1: 700_000,   S2: 500_000, S3: 300_000, S4: 150_000,
}
const MEAL_ALLOWANCE      = 200_000
const TRANSPORT_ALLOWANCE = 100_000

// ── Persona → overtime calculation ───────────────────────────
const KR_PERSONA: Record<string, string> = {
  'CTR-KR-0001':'P1','CTR-KR-0002':'P9','CTR-KR-0003':'P1',
  'CTR-KR-2001':'P8','CTR-KR-2002':'P8','CTR-KR-2003':'P8',
  'CTR-KR-2004':'P8','CTR-KR-2005':'P8','CTR-KR-2006':'P8',
  'CTR-KR-3001':'P8','CTR-KR-3002':'P8','CTR-KR-3003':'P8',
  'CTR-KR-3004':'P3','CTR-KR-3005':'P3','CTR-KR-3006':'P2',
  'CTR-KR-3007':'P2','CTR-KR-3008':'P8','CTR-KR-3009':'P8',
  'CTR-KR-3010':'P1','CTR-KR-3011':'P6','CTR-KR-3012':'P6',
  'CTR-KR-3013':'P4','CTR-KR-3014':'P1','CTR-KR-3015':'P7',
  'CTR-KR-3016':'P5','CTR-KR-3017':'P9','CTR-KR-3018':'P9',
  'CTR-KR-3019':'P1','CTR-KR-3020':'P1','CTR-KR-3021':'P2',
  'CTR-KR-3022':'P2','CTR-KR-3023':'P5','CTR-KR-3024':'P4',
  'CTR-KR-3025':'P4','CTR-KR-3026':'P1','CTR-KR-3027':'P6',
  'CTR-KR-3028':'P3','CTR-KR-3029':'P9','CTR-KR-3030':'P9',
  'CTR-KR-3031':'P1','CTR-KR-3032':'P1','CTR-KR-3033':'P2',
  'CTR-KR-3034':'P5','CTR-KR-3035':'P8','CTR-KR-3036':'P8',
  'CTR-KR-3037':'P4','CTR-KR-3038':'P6','CTR-KR-3039':'P9',
  'CTR-KR-3040':'P9','CTR-KR-3041':'P1','CTR-KR-3042':'P2',
  'CTR-KR-3043':'P5','CTR-KR-3044':'P5','CTR-KR-3045':'P4',
  'CTR-KR-3046':'P6','CTR-KR-3047':'P1','CTR-KR-3048':'P9',
  'CTR-KR-3049':'P2','CTR-KR-3050':'P1','CTR-KR-3051':'P1',
  'CTR-KR-3052':'P4','CTR-KR-3053':'P5','CTR-KR-3054':'P6',
  'CTR-KR-3055':'P9','CTR-KR-3056':'P1','CTR-KR-3057':'P1',
  'CTR-KR-3058':'P2','CTR-KR-3059':'P4','CTR-KR-3060':'P6',
  'CTR-KR-3061':'P9','CTR-KR-3062':'P1','CTR-KR-3063':'P1',
  'CTR-KR-3064':'P7','CTR-KR-3065':'P5','CTR-KR-3066':'P9',
  'CTR-KR-3067':'P1','CTR-KR-3068':'P4','CTR-KR-3069':'P9',
  'CTR-KR-3070':'P10',
}

function calcOvertime(persona: string, baseSalary: number, seed: number): number {
  const hourlyRate = baseSalary / 209
  const otRate     = hourlyRate * 1.5

  switch (persona) {
    case 'P1':  return 0
    case 'P2':  return Math.round((200_000 + sr(seed) * 200_000) / 10_000) * 10_000
    case 'P3':  return Math.round((400_000 + sr(seed) * 300_000) / 10_000) * 10_000
    case 'P4':  return Math.round((50_000  + sr(seed) * 50_000)  / 10_000) * 10_000
    case 'P5':  return Math.round(sr(seed) * 50_000 / 10_000) * 10_000
    case 'P6':  return 0
    case 'P8':  return Math.round((150_000 + sr(seed) * 150_000) / 10_000) * 10_000
    case 'P9':  return Math.round((100_000 + sr(seed) * 100_000) / 10_000) * 10_000
    case 'P10': return Math.round(sr(seed) * 50_000 / 10_000) * 10_000
    default:    return Math.round(sr(seed) * 80_000 / 10_000) * 10_000
  }
}

// ── Social insurance deductions (2025 rates) ─────────────────
function calcDeductions(baseSalary: number): {
  nationalPension: number
  healthInsurance: number
  longTermCare:    number
  employmentInsurance: number
  incomeTax:       number
  total:           number
} {
  const np     = Math.round(baseSalary * 0.045)   // 국민연금 4.5%
  const hi     = Math.round(baseSalary * 0.03545)  // 건강보험 3.545%
  const ltc    = Math.round(hi * 0.1295)           // 장기요양 12.95% of HI
  const ei     = Math.round(baseSalary * 0.009)    // 고용보험 0.9%
  // Simplified income tax withholding: ~6-24% of (base - deductions)
  const taxable = baseSalary - np - hi - ltc - ei
  const it = taxable < 14_000_000
    ? Math.round(taxable * 0.06)
    : Math.round(14_000_000 * 0.06 + (taxable - 14_000_000) * 0.15)
  const total = np + hi + ltc + ei + it
  return { nationalPension: np, healthInsurance: hi, longTermCare: ltc, employmentInsurance: ei, incomeTax: it, total }
}

// ── CN Payroll extension data ─────────────────────────────────
const CN_EXTRA_MONTHS = [
  { yearMonth: '2025-10', year: 2025, month: 10 },
  { yearMonth: '2025-11', year: 2025, month: 11 },
  { yearMonth: '2025-12', year: 2025, month: 12 },
]
const CN_EMP_LIST = [
  { num: 'CN001', name: '王伟',   base: 18000, allow: 3500, ded: 3780, net: 17720 },
  { num: 'CN002', name: '李娜',   base: 15000, allow: 2800, ded: 3000, net: 14800 },
  { num: 'CN003', name: '张磊',   base: 22000, allow: 4200, ded: 4800, net: 21400 },
  { num: 'CN004', name: '刘芳',   base: 12000, allow: 2000, ded: 2400, net: 11600 },
  { num: 'CN005', name: '陈强',   base: 16500, allow: 3000, ded: 3300, net: 16200 },
  { num: 'CN006', name: '杨洋',   base: 25000, allow: 5000, ded: 5500, net: 24500 },
  { num: 'CN007', name: '赵静',   base: 13500, allow: 2500, ded: 2700, net: 13300 },
  { num: 'CN008', name: '黄明',   base: 19000, allow: 3800, ded: 4100, net: 18700 },
  { num: 'CN009', name: '周丽',   base: 14000, allow: 2600, ded: 2800, net: 13800 },
  { num: 'CN010', name: '吴刚',   base: 20000, allow: 4000, ded: 4400, net: 19600 },
]

// ────────────────────────────────────────────────────────────
export async function seedPayroll(prisma: PrismaClient): Promise<void> {
  console.log('\n💰 Session 3: Seeding payroll (KR 6 months + CN extension)...\n')

  // Company IDs
  const krCo = await prisma.company.findFirst({ where: { code: 'CTR' } })
  const cnCo = await prisma.company.findFirst({ where: { code: 'CTR-CN' } })
  if (!krCo) { console.error('  ❌ CTR-KR not found'); return }
  const krId = krCo.id
  const cnId = cnCo?.id

  // KR payroll months
  const KR_MONTHS = [
    { yearMonth: '2025-09', year: 2025, month: 9  },
    { yearMonth: '2025-10', year: 2025, month: 10 },
    { yearMonth: '2025-11', year: 2025, month: 11 },
    { yearMonth: '2025-12', year: 2025, month: 12 },
    { yearMonth: '2026-01', year: 2026, month: 1  },
    { yearMonth: '2026-02', year: 2026, month: 2  },
  ]

  // Fetch KR active employees with grade info
  const krAssignments = await prisma.employeeAssignment.findMany({
    where:  { companyId: krId, isPrimary: true, endDate: null, status: { not: 'TERMINATED' } },
    select: {
      employeeId:    true,
      employmentType:true,
      jobGrade:      { select: { code: true } },
      employee:      { select: { employeeNo: true, hireDate: true } },
    },
  })

  let krRunCount = 0
  let krItemCount = 0

  // ── CTR Payroll ───────────────────────────────────────
  for (const mo of KR_MONTHS) {
    const periodStart = new Date(`${mo.yearMonth}-01`)
    const periodEnd   = new Date(mo.year, mo.month, 0) // last day of month
    const paidAt      = new Date(`${mo.yearMonth}-25`)

    // Build items first so we can sum for the run
    const items: {
      id:          string
      employeeId:  string
      baseSalary:  number
      overtimePay: number
      bonus:       number
      allowances:  number
      grossPay:    number
      deductions:  number
      netPay:      number
      detail:      object
    }[] = []

    for (let ei = 0; ei < krAssignments.length; ei++) {
      const asgn    = krAssignments[ei]
      const empNo   = asgn.employee.employeeNo
      const empId   = asgn.employeeId
      const persona = KR_PERSONA[empNo] ?? 'P1'
      const gradeCode = asgn.jobGrade?.code ?? 'G6'

      // P7 (ON_LEAVE): no payroll
      if (persona === 'P7') continue

      // P4 hired after this month: skip
      if (asgn.employee.hireDate > periodEnd) continue

      const baseSalary = GRADE_BASE[gradeCode] ?? 3_210_000
      const positionAllowance = POSITION_ALLOWANCE[gradeCode] ?? 0

      // Intern: 70% of base
      const actualBase = asgn.employmentType === 'INTERN'
        ? Math.round(baseSalary * 0.7)
        : baseSalary

      const overtimePay = calcOvertime(persona, actualBase, ei * 31 + mo.month * 7)
      const allowances  = positionAllowance + MEAL_ALLOWANCE + TRANSPORT_ALLOWANCE
      const grossPay    = actualBase + overtimePay + allowances
      const ded         = calcDeductions(actualBase)
      const netPay      = grossPay - ded.total

      const itemId = deterministicUUID('payitem', `KR:${mo.yearMonth}:${empNo}`)

      items.push({
        id:          itemId,
        employeeId:  empId,
        baseSalary:  actualBase,
        overtimePay,
        bonus:       0,
        allowances,
        grossPay,
        deductions:  ded.total,
        netPay,
        detail: {
          components: {
            base:              actualBase,
            positionAllowance,
            meal:              MEAL_ALLOWANCE,
            transport:         TRANSPORT_ALLOWANCE,
            overtime:          overtimePay,
          },
          deductions: {
            nationalPension:     ded.nationalPension,
            healthInsurance:     ded.healthInsurance,
            longTermCare:        ded.longTermCare,
            employmentInsurance: ded.employmentInsurance,
            incomeTax:           ded.incomeTax,
          },
          grade:   gradeCode,
          persona: persona,
        },
      })
    }

    // Create PayrollRun
    const runId        = deterministicUUID('payrun', `CTR-KR:${mo.yearMonth}`)
    const totalGross   = items.reduce((s, i) => s + i.grossPay, 0)
    const totalDed     = items.reduce((s, i) => s + i.deductions, 0)
    const totalNet     = items.reduce((s, i) => s + i.netPay, 0)

    const existingRun = await prisma.payrollRun.findFirst({ where: { id: runId } })
    if (!existingRun) {
      await prisma.payrollRun.create({
        data: {
          id:              runId,
          companyId:       krId,
          name:            `CTR-KR ${mo.yearMonth} 급여`,
          runType:         'MONTHLY',
          yearMonth:       mo.yearMonth,
          frequency:       'MONTHLY',
          periodStart,
          periodEnd,
          status:          'PAID',
          currency:        'KRW',
          headcount:       items.length,
          totalGross,
          totalDeductions: totalDed,
          totalNet,
          paidAt,
        },
      })
      krRunCount++
    }

    // Batch insert PayrollItems
    const result = await prisma.payrollItem.createMany({
      data: items.map(itm => ({
        id:          itm.id,
        runId,
        employeeId:  itm.employeeId,
        baseSalary:  itm.baseSalary,
        overtimePay: itm.overtimePay,
        bonus:       itm.bonus,
        allowances:  itm.allowances,
        grossPay:    itm.grossPay,
        deductions:  itm.deductions,
        netPay:      itm.netPay,
        currency:    'KRW',
        detail:      itm.detail,
      })),
      skipDuplicates: true,
    })
    krItemCount += result.count
    console.log(`  KR ${mo.yearMonth}: ${items.length} employees, ${result.count} items inserted`)
  }

  // ── CTR-CN Payroll Extension (Oct~Dec 2025) ───────────────
  console.log('  \n📌 Extending CTR-CN payroll (Oct-Dec 2025)...')
  let cnItemCount = 0
  let cnRunCount  = 0

  if (cnId) {
    // Get CN employees (existing B7-2 synthetic employees)
    for (const mo of CN_EXTRA_MONTHS) {
      const periodStart = new Date(`${mo.yearMonth}-01`)
      const periodEnd   = new Date(mo.year, mo.month, 0)

      const runId  = deterministicUUID('prun', `CTR-CN:${mo.yearMonth}`)
      const existingRun = await prisma.payrollRun.findFirst({ where: { id: runId } })

      const cnItems = []
      for (const emp of CN_EMP_LIST) {
        const existingEmployee = await prisma.employee.findFirst({
          where: { employeeNo: emp.num }, select: { id: true },
        })
        if (!existingEmployee) continue

        const itemId = deterministicUUID('pitem', `${runId}:${emp.num}`)
        cnItems.push({ ...emp, employeeId: existingEmployee.id, itemId })
      }

      const totalGross = cnItems.reduce((s, e) => s + e.base + e.allow, 0)
      const totalNet   = cnItems.reduce((s, e) => s + e.net, 0)
      const totalDed   = cnItems.reduce((s, e) => s + e.ded, 0)

      if (!existingRun) {
        await prisma.payrollRun.create({
          data: {
            id:              runId,
            companyId:       cnId,
            name:            `CTR-CN ${mo.yearMonth} 工资`,
            runType:         'MONTHLY',
            yearMonth:       mo.yearMonth,
            frequency:       'MONTHLY',
            periodStart,
            periodEnd,
            status:          'PAID',
            currency:        'CNY',
            headcount:       cnItems.length,
            totalGross,
            totalDeductions: totalDed,
            totalNet,
            paidAt:          new Date(`${mo.yearMonth}-25`),
          },
        })
        cnRunCount++
      }

      const existingRunId = (await prisma.payrollRun.findFirst({ where: { id: runId } }))?.id ?? runId
      const result = await prisma.payrollItem.createMany({
        data: cnItems.map(e => ({
          id:          e.itemId,
          runId:       existingRunId,
          employeeId:  e.employeeId,
          baseSalary:  e.base,
          overtimePay: 0,
          bonus:       0,
          allowances:  e.allow,
          grossPay:    e.base + e.allow,
          deductions:  e.ded,
          netPay:      e.net,
          currency:    'CNY',
          detail:      { source: 'import', employeeNumber: e.num, employeeName: e.name },
        })),
        skipDuplicates: true,
      })
      cnItemCount += result.count
      console.log(`  CN ${mo.yearMonth}: ${result.count} items inserted`)
    }
  }

  // ── Summary ──────────────────────────────────────────────
  const totalRuns  = await prisma.payrollRun.count()
  const totalItems = await prisma.payrollItem.count()

  // Average net pay per grade (KR only, last month)
  const lastMonth = '2026-02'
  const lastRun   = await prisma.payrollRun.findFirst({ where: { companyId: krId, yearMonth: lastMonth } })
  let avgNetNote = ''
  if (lastRun) {
    const allItems = await prisma.payrollItem.findMany({
      where: { runId: lastRun.id },
      select: { netPay: true },
    })
    const avg = allItems.reduce((s, i) => s + Number(i.netPay), 0) / (allItems.length || 1)
    avgNetNote = ` (KR Feb avg net: ₩${Math.round(avg).toLocaleString()})`
  }

  console.log('\n======================================')
  console.log('💰 Payroll Seed Complete!')
  console.log('======================================')
  console.log(`  KR PayrollRuns inserted:  ${krRunCount}`)
  console.log(`  KR PayrollItems inserted: ${krItemCount}`)
  console.log(`  CN PayrollRuns inserted:  ${cnRunCount}`)
  console.log(`  CN PayrollItems inserted: ${cnItemCount}`)
  console.log(`  Total PayrollRuns (DB):   ${totalRuns}`)
  console.log(`  Total PayrollItems (DB):  ${totalItems}${avgNetNote}`)
  console.log('======================================\n')
}
