// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Seed 17: Payroll Pipeline GP#3 QA (Expanded)
// ═══════════════════════════════════════════════════════════
// Runs: KR×12 + US×6 + CN×6 + VN×6 + RU×3 + EU×3 = 36 total
// Items: ~1,200+  Adjustments: ~40  Anomalies: ~60  Approvals: ~35
//
// IMPORTANT: This seed truncates ALL payroll data and recreates.
// Run after seed-06 to get full picture, or standalone.
// ═══════════════════════════════════════════════════════════

import { PrismaClient } from '../../src/generated/prisma/client'

// ─── Deterministic UUID ──────────────────────────────────────
function dUUID(ns: string, key: string): string {
    const str = `${ns}:${key}`
    let h = 0
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0 }
    const x = Math.abs(h).toString(16).padStart(8, '0')
    return `${x.slice(0, 8)}-${x.slice(0, 4)}-4${x.slice(1, 4)}-a${x.slice(0, 3)}-${x.padEnd(12, '0').slice(0, 12)}`
}

// ─── Seeded random (deterministic per employee+month) ────────
function sr(seed: string): number {
    let h = 0
    for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h) + seed.charCodeAt(i); h |= 0 }
    const x = Math.sin(Math.abs(h) * 9301 + 49297) * 233280
    return Math.abs(x - Math.floor(x))
}

// ─── KR Grade → base salary (Session 45: E1/S1/L2/L1) ────────
const KR_GRADE_BASE: Record<string, number> = {
    E1: 13_300_000, S1: 10_000_000, L2: 5_500_000, L1: 3_210_000,
    // 옛 코드 fallback (DB 전환 중 호환)
    G1: 13_300_000, G2: 8_750_000, G3: 6_670_000,
    G4: 5_210_000, G5: 4_080_000, G6: 3_210_000,
}

// ─── KR 4대보험 + 소득세 계산 ───────────────────────────────
function calcKR(base: number, otPay: number, bonus: number, yearMonth: string) {
    // TODO: Move to Settings (Payroll) — 국민연금 4.5%, 건강보험 3.545%, 장기요양 12.95%, 고용보험 0.9%
    const meal = 200_000, transport = 100_000
    const posAllowance = base > 6_000_000 ? 500_000 : base > 4_000_000 ? 300_000 : 150_000
    const grossPay = base + meal + transport + posAllowance + otPay + bonus
    const taxable = base + otPay + bonus  // 비과세 제외
    const np = Math.round(Math.min(base, 5_900_000) * 0.045)
    const hi = Math.round(base * 0.03545)
    const ltc = Math.round(hi * 0.1295)
    const ei = Math.round(base * 0.009)
    let it = 0
    if (taxable <= 3_000_000) it = Math.round(taxable * 0.03)
    else if (taxable <= 5_000_000) it = Math.round(90_000 + (taxable - 3_000_000) * 0.06)
    else if (taxable <= 8_000_000) it = Math.round(210_000 + (taxable - 5_000_000) * 0.10)
    else it = Math.round(510_000 + (taxable - 8_000_000) * 0.15)
    const localTax = Math.round(it * 0.1)
    const totalDed = np + hi + ltc + ei + it + localTax
    return {
        baseSalary: base, overtimePay: otPay, bonus, allowances: meal + transport + posAllowance,
        grossPay, deductions: totalDed, netPay: grossPay - totalDed,
        detail: {
            earnings: {
                baseSalary: base, mealAllowance: meal, transportAllowance: transport,
                positionAllowance: posAllowance, overtimePay: otPay, bonuses: bonus
            },
            insurance: { nationalPension: np, healthInsurance: hi, longTermCare: ltc, employmentInsurance: ei },
            tax: { incomeTax: it, localIncomeTax: localTax }
        },
    }
}

// ─── US salary ───────────────────────────────────────────────
function calcUS(annual: number, bonus: number = 0) {
    // TODO: Move to Settings (Payroll) — US: Social Security 6.2%, Medicare 1.45%, Federal ~15%
    const monthly = Math.round(annual / 12)
    const ss = Math.round(Math.min(monthly, 14_050) * 0.062)
    const med = Math.round(monthly * 0.0145)
    const fed = Math.round(monthly * 0.15)
    const ret = Math.round(monthly * 0.06) // 401k
    const total = ss + med + fed + ret
    const gross = monthly + bonus
    return {
        baseSalary: monthly, overtimePay: 0, bonus, allowances: 0, grossPay: gross,
        deductions: total, netPay: gross - total,
        detail: {
            earnings: { baseSalary: monthly, bonuses: bonus },
            insurance: { socialSecurity: ss, medicare: med },
            tax: { federalIncomeTax: fed, retirement401k: ret }
        }
    }
}

// ─── CN salary (CNY) ─────────────────────────────────────────
function calcCN(base: number, bonus: number = 0) {
    // TODO: Move to Settings (Payroll) — CN: 养老8%, 医疗2%, 失业0.5%, 住房12%
    const pen = Math.round(base * 0.08), med = Math.round(base * 0.02)
    const une = Math.round(base * 0.005), hf = Math.round(base * 0.12)
    const taxable = Math.max(0, base - pen - med - une - hf - 5_000)
    let it = 0
    if (taxable <= 3_000) it = Math.round(taxable * 0.03)
    else if (taxable <= 12_000) it = Math.round(90 + (taxable - 3_000) * 0.1)
    else it = Math.round(990 + (taxable - 12_000) * 0.2)
    const total = pen + med + une + hf + it
    const gross = base + bonus
    return {
        baseSalary: base, overtimePay: 0, bonus, allowances: 0, grossPay: gross,
        deductions: total, netPay: gross - total,
        detail: {
            earnings: { baseSalary: base, bonuses: bonus },
            insurance: { pension: pen, medical: med, unemployment: une, housingFund: hf },
            tax: { incomeTax: it }
        }
    }
}

// ─── VN salary (VND millions) ─────────────────────────────────
function calcVN(base: number, bonus: number = 0) {
    // TODO: Move to Settings (Payroll) — VN: BHXH 8%, BHYT 1.5%, BHTN 1%
    const si = Math.round(base * 0.08), hi = Math.round(base * 0.015), un = Math.round(base * 0.01)
    const taxable = Math.max(0, base - si - hi - un - 11_000_000)
    let it = 0
    if (taxable <= 5_000_000) it = Math.round(taxable * 0.05)
    else if (taxable <= 10_000_000) it = Math.round(250_000 + (taxable - 5_000_000) * 0.1)
    else it = Math.round(750_000 + (taxable - 10_000_000) * 0.15)
    const total = si + hi + un + it
    const gross = base + bonus
    return {
        baseSalary: base, overtimePay: 0, bonus, allowances: 0, grossPay: gross,
        deductions: total, netPay: gross - total,
        detail: {
            earnings: { baseSalary: base, bonuses: bonus },
            insurance: { socialInsurance: si, healthInsurance: hi, unemploymentInsurance: un },
            tax: { incomeTax: it }
        }
    }
}

// ─── RU salary (RUB) ─────────────────────────────────────────
function calcRU(base: number, bonus: number = 0) {
    // TODO: Move to Settings (Payroll) — RU: НДФЛ 13% flat rate
    const it = Math.round((base + bonus) * 0.13)
    const gross = base + bonus
    return {
        baseSalary: base, overtimePay: 0, bonus, allowances: 0, grossPay: gross,
        deductions: it, netPay: gross - it,
        detail: { earnings: { baseSalary: base, bonuses: bonus }, tax: { ndfl: it } }
    }
}

// calcMX removed — CTR-MX merged into CTR-US Location. EU calc is inline.

// ─── Month helpers ───────────────────────────────────────────
function periodOf(ym: string) {
    const [y, m] = ym.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0)
    return { year: y, month: m, periodStart: start, periodEnd: end }
}

// ─── Main ────────────────────────────────────────────────────

export async function seedPayrollPipeline(prisma: PrismaClient): Promise<void> {
    console.log('\n🏦 Seed 17: Payroll Pipeline GP#3 (Expanded)')
    console.log('  ⚠️  Cleaning existing payroll data...')

    // Truncate in FK order
    await prisma.payslip.deleteMany({})
    await prisma.payrollApprovalStep.deleteMany({})
    await prisma.payrollApproval.deleteMany({})
    await prisma.payrollAnomaly.deleteMany({})
    await prisma.payrollAdjustment.deleteMany({})
    await prisma.payrollItem.deleteMany({})
    await prisma.payrollRun.deleteMany({})
    console.log('  ✓ Cleared')

    // ── Companies ──────────────────────────────────────────────
    const coList = await prisma.company.findMany({
        where: { code: { in: ['CTR', 'CTR-US', 'CTR-CN', 'CTR-VN', 'CTR-RU', 'CTR-EU'] } },
        select: { id: true, code: true, currency: true },
    })
    const co = Object.fromEntries(coList.map(c => [c.code!, c]))
    const coId = (code: string) => co[code]?.id ?? ''

    // ── HR actor per entity ─────────────────────────────────────
    async function getActor(companyId: string): Promise<string> {
        const e = await prisma.employee.findFirst({
            where: { assignments: { some: { companyId, endDate: null, status: 'ACTIVE' } } },
            select: { id: true },
            orderBy: { employeeNo: 'asc' },
        })
        return e?.id ?? ''
    }
    const actorKR = await getActor(coId('CTR'))
    const actorUS = await getActor(coId('CTR-US'))
    const actorCN = await getActor(coId('CTR-CN'))
    const actorVN = await getActor(coId('CTR-VN'))
    const actorRU = await getActor(coId('CTR-RU'))
    const actorEU = await getActor(coId('CTR-EU'))

    if (!actorKR) { console.warn('  ⚠️  No KR employee — aborting'); return }

    // ── KR Employees ───────────────────────────────────────────
    const krEmps = await prisma.employee.findMany({
        where: { assignments: { some: { companyId: coId('CTR'), endDate: null, status: { in: ['ACTIVE', 'ON_LEAVE'] } } } },
        select: { id: true, employeeNo: true },
        orderBy: { employeeNo: 'asc' },
        take: 80,
    })

    // Grade lookup per employee from job grade data
    const krGradeMap: Record<string, string> = {}
    for (const emp of krEmps) {
        const no = emp.employeeNo ?? ''
        if (no.startsWith('CTR-KR-0') || no.startsWith('CTR-KR-1') || no.startsWith('CTR-KR-2')) {
            const idx = parseInt(no.split('-').pop() ?? '1')
            krGradeMap[emp.id] = idx <= 1 ? 'G1' : idx <= 3 ? 'G2' : idx <= 6 ? 'G3' : 'G4'
        } else {
            const idx = parseInt(no.split('-').pop() ?? '30')
            krGradeMap[emp.id] = idx <= 10 ? 'G4' : idx <= 30 ? 'G5' : 'G6'
        }
    }

    // ── US/CN/VN/RU/MX Employees ──────────────────────────────
    async function getEmps(code: string, limit: number) {
        return prisma.employee.findMany({
            where: { assignments: { some: { companyId: coId(code), endDate: null, status: 'ACTIVE' } } },
            select: { id: true, employeeNo: true },
            orderBy: { employeeNo: 'asc' },
            take: limit,
        })
    }
    const usEmps = await getEmps('CTR-US', 15)
    const cnEmps = await getEmps('CTR-CN', 12)
    const vnEmps = await getEmps('CTR-VN', 10)
    const ruEmps = await getEmps('CTR-RU', 8)
    const euEmps = await getEmps('CTR-EU', 8)

    console.log(`  KR:${krEmps.length} US:${usEmps.length} CN:${cnEmps.length} VN:${vnEmps.length} RU:${ruEmps.length} EU:${euEmps.length}`)

    // Shared calc result shape (all country calcs must conform)
    interface CalcResult {
        baseSalary: number; overtimePay: number; bonus: number
        allowances: number; grossPay: number; deductions: number; netPay: number
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detail: Record<string, any>
    }

    async function createRun(opts: {
        code: string; ym: string; status: string; actor: string
        name: string; currency: string
        emps: Array<{ id: string; employeeNo: string | null }>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        calcFn: (emp: { id: string; employeeNo: string | null }, ym: string) => CalcResult
        paidAt?: Date
        adjCount?: number; anomCount?: number; allAnomsResolved?: boolean
    }) {
        const { year, month, periodStart, periodEnd } = periodOf(opts.ym)
        const items = opts.emps.map(e => opts.calcFn(e, opts.ym))

        const totalGross = items.reduce((s, i) => s + i.grossPay, 0)
        const totalDed = items.reduce((s, i) => s + i.deductions, 0)
        const totalNet = items.reduce((s, i) => s + i.netPay, 0)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const run = await prisma.payrollRun.create({
            data: {
                companyId: coId(opts.code), name: opts.name, runType: 'MONTHLY',
                yearMonth: opts.ym, year, month, frequency: 'MONTHLY',
                periodStart, periodEnd,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                status: opts.status as any,
                currency: opts.currency,
                headcount: opts.emps.length, totalGross, totalDeductions: totalDed, totalNet,
                paidAt: opts.paidAt ?? null, createdById: opts.actor,
                attendanceClosedAt: opts.status !== 'DRAFT' ? new Date(`${opts.ym}-20T09:00:00Z`) : null,
                attendanceClosedBy: opts.status !== 'DRAFT' ? opts.actor : null,
                adjustmentCount: opts.adjCount ?? 0, anomalyCount: opts.anomCount ?? 0,
                allAnomaliesResolved: opts.allAnomsResolved ?? (opts.status !== 'REVIEW'),
            }
        })

        // Items — explicit field mapping to satisfy Prisma types
        await prisma.payrollItem.createMany({
            data: opts.emps.map((e, i) => ({
                runId: run.id, employeeId: e.id, currency: opts.currency,
                baseSalary: items[i].baseSalary,
                overtimePay: items[i].overtimePay,
                bonus: items[i].bonus,
                allowances: items[i].allowances,
                grossPay: items[i].grossPay,
                deductions: items[i].deductions,
                netPay: items[i].netPay,
                detail: items[i].detail,
            })),
            skipDuplicates: true,
        })
        return { run, totalGross, totalDed, totalNet, itemCount: opts.emps.length }
    }

    // ══════════════════════════════════════════════════════════════
    // Helper: create approval chain
    // ══════════════════════════════════════════════════════════════
    interface StepDef {
        role: string; approverId: string | null
        status: 'APPROVED' | 'PENDING' | 'REJECTED'; comment?: string; decidedAt?: Date
    }
    async function createApproval(runId: string, requestedBy: string, requestedAt: Date,
        steps: StepDef[], completedAt?: Date) {
        const doneCount = steps.filter(s => s.status === 'APPROVED').length
        const allDone = doneCount === steps.length
        const overallStatus = allDone ? 'APPROVED' : steps.some(s => s.status === 'REJECTED') ? 'REJECTED'
            : doneCount > 0 ? 'IN_PROGRESS' : 'PENDING'
        const approval = await prisma.payrollApproval.create({
            data: {
                payrollRunId: runId, currentStep: Math.min(doneCount + 1, steps.length),
                totalSteps: steps.length, status: overallStatus,
                requestedBy, requestedAt, completedAt: completedAt ?? (allDone ? steps[steps.length - 1].decidedAt : null),
            }
        })
        await prisma.payrollApprovalStep.createMany({
            data:
                steps.map((s, idx) => ({
                    approvalId: approval.id, stepNumber: idx + 1, roleRequired: s.role,
                    approverId: s.approverId, status: s.status,
                    comment: s.comment ?? null, decidedAt: s.decidedAt ?? null,
                })), skipDuplicates: true,
        })
        return approval
    }

    // ══════════════════════════════════════════════════════════════
    // Helper: payslips for a run
    // ══════════════════════════════════════════════════════════════
    async function createPayslips(runId: string, companyId: string, year: number, month: number, sentAt: Date) {
        const items = await prisma.payrollItem.findMany({ where: { runId }, select: { id: true, employeeId: true } })
        await prisma.payslip.createMany({
            data: items.map((it, i) => ({
                payrollItemId: it.id, employeeId: it.employeeId, companyId, year, month,
                isViewed: i % 3 !== 0, sentViaEmail: true, sentAt,
            })), skipDuplicates: true
        })
        return items.length
    }

    // ══════════════════════════════════════════════════════════════
    // KR CALC FN
    // ══════════════════════════════════════════════════════════════
    const krCalc = (e: { id: string }, ym: string) => {
        const grade = krGradeMap[e.id] ?? 'G5'
        const base = KR_GRADE_BASE[grade] ?? 4_080_000
        const seed = `${e.id}-${ym}`
        const [y, m] = ym.split('-').map(Number)
        const isQ4 = m >= 10
        const otPay = Math.round(sr(seed) * (isQ4 ? 400_000 : 200_000) / 10_000) * 10_000
        const isDecember = m === 12
        const bonus = isDecember ? Math.round(base * 1.0) : 0  // 연말 성과급 100%
        return calcKR(base, otPay, bonus, ym)
    }

    // ══════════════════════════════════════════════════════════════
    // CTR: 12 runs (2025-03 ~ 2026-02)
    // ══════════════════════════════════════════════════════════════
    const KR_RUNS = [
        { ym: '2025-03', status: 'PAID' }, { ym: '2025-04', status: 'PAID' },
        { ym: '2025-05', status: 'PAID' }, { ym: '2025-06', status: 'PAID' },
        { ym: '2025-07', status: 'PAID' }, { ym: '2025-08', status: 'PAID' },
        { ym: '2025-09', status: 'PAID' }, { ym: '2025-10', status: 'PAID' },
        { ym: '2025-11', status: 'PAID' }, { ym: '2025-12', status: 'PAID' },
        { ym: '2026-01', status: 'APPROVED' }, { ym: '2026-02', status: 'DRAFT' },
    ]

    const krRunMap: Record<string, string> = {}
    for (const r of KR_RUNS) {
        const { year, month } = periodOf(r.ym)
        const isDraft = r.status === 'DRAFT'
        const res = await createRun({
            code: 'CTR', ym: r.ym, status: r.status, actor: actorKR,
            name: `CTR-KR ${r.ym} 월급`, currency: 'KRW',
            emps: isDraft ? [] : krEmps, calcFn: krCalc,
            paidAt: r.status === 'PAID' ? new Date(`${r.ym}-25T00:00:00Z`) : undefined,
            adjCount: r.ym === '2026-01' ? 2 : r.ym === '2025-12' ? 2 : r.ym === '2025-10' ? 3 : 0,
            anomCount: 0, allAnomsResolved: true,
        })
        krRunMap[r.ym] = res.run.id

        // Payslips for PAID runs
        if (r.status === 'PAID') {
            await createPayslips(res.run.id, coId('CTR'), year, month, new Date(`${r.ym}-26T08:00:00Z`))
        }

        // Approval chains for PAID/APPROVED runs
        if (!isDraft) {
            const reqAt = new Date(`${r.ym.slice(0, -2)}${String(parseInt(r.ym.slice(-2)) < 10 ? '0' : '')}${parseInt(r.ym.slice(-2)) - 1 < 1 ? 12 : parseInt(r.ym.slice(-2)) - 1}-20T10:00:00Z`)
            const reqDate = new Date(year, month - 1, 21, 10, 0, 0)
            const step1At = new Date(year, month - 1, 22, 10, 0, 0)
            const step2At = new Date(year, month - 1, 23, 14, 0, 0)
            const step3At = new Date(year, month - 1, 24, 11, 0, 0)
            const isApproved = r.status === 'APPROVED'

            await createApproval(res.run.id, actorKR, reqDate,
                r.ym === '2026-01'
                    ? [
                        { role: 'HR_MANAGER', approverId: actorKR, status: 'APPROVED', comment: '검토 완료 — 조정 2건 확인', decidedAt: step1At },
                        { role: 'HR_DIRECTOR', approverId: actorKR, status: 'APPROVED', comment: '승인합니다', decidedAt: step2At },
                        { role: 'CFO', approverId: null, status: 'PENDING' },
                    ]
                    : [
                        { role: 'HR_MANAGER', approverId: actorKR, status: 'APPROVED', comment: '이상 없음', decidedAt: step1At },
                        { role: 'HR_DIRECTOR', approverId: actorKR, status: 'APPROVED', comment: '확인 완료', decidedAt: step2At },
                        { role: 'CFO', approverId: actorKR, status: 'APPROVED', comment: '최종 승인', decidedAt: step3At },
                    ],
                r.status === 'PAID' ? step3At : undefined,
            )
        }
    }
    console.log(`  ✓ KR: ${KR_RUNS.length} runs`)

    // ── KR Adjustments ─────────────────────────────────────────
    const adjEmps = krEmps.slice(0, 10)
    const KADJ = [
        { ym: '2025-04', type: 'RETROACTIVE', cat: '기본급', desc: '임금협상 타결 소급분 — 1차', amount: 250_000, ei: 0 },
        { ym: '2025-04', type: 'RETROACTIVE', cat: '기본급', desc: '임금협상 타결 소급분 — 1차 (2)', amount: 200_000, ei: 1 },
        { ym: '2025-05', type: 'RETROACTIVE', cat: '기본급', desc: '임금협상 소급분 — 2차', amount: 250_000, ei: 2 },
        { ym: '2025-06', type: 'BONUS', cat: '상여금', desc: '결혼축의금', amount: 500_000, ei: 3 },
        { ym: '2025-07', type: 'CORRECTION', cat: '시간외수당', desc: '전월 야간수당 오류 정정', amount: 180_000, ei: 4 },
        { ym: '2025-08', type: 'BONUS', cat: '상여금', desc: '출산축하금', amount: 1_000_000, ei: 5 },
        { ym: '2025-09', type: 'CORRECTION', cat: '기본급', desc: '퇴사자 미사용 연차수당 정산', amount: 850_000, ei: 6 },
        { ym: '2025-10', type: 'RETROACTIVE', cat: '기본급', desc: '승진자 급여차액 소급 — 1차', amount: 350_000, ei: 0 },
        { ym: '2025-10', type: 'RETROACTIVE', cat: '기본급', desc: '승진자 급여차액 소급 — 2차', amount: 400_000, ei: 1 },
        { ym: '2025-10', type: 'RETROACTIVE', cat: '기본급', desc: '승진자 급여차액 소급 — 3차', amount: 280_000, ei: 2 },
        { ym: '2025-11', type: 'RETROACTIVE', cat: '기본급', desc: '10월 승진자 소급 2차', amount: 350_000, ei: 3 },
        { ym: '2025-11', type: 'BONUS', cat: '상여금', desc: '조의금 — 부친 별세', amount: 300_000, ei: 4 },
        { ym: '2025-12', type: 'CORRECTION', cat: '건강보험', desc: '건강보험 연말정산 환급', amount: 78_000, ei: 5 },
        { ym: '2025-12', type: 'CORRECTION', cat: '건강보험', desc: '건강보험 연말정산 추가징수', amount: -52_000, ei: 6 },
        { ym: '2026-01', type: 'RETROACTIVE', cat: '기본급', desc: '연봉 재산정 소급분 (연봉 협상 지연)', amount: 1_000_000, ei: 7 },
        { ym: '2026-01', type: 'BONUS', cat: '상여금', desc: '자녀 입학 축하금', amount: 300_000, ei: 8 },
    ]
    for (const a of KADJ) {
        const runId = krRunMap[a.ym]
        if (!runId || !adjEmps[a.ei]) continue
        await prisma.payrollAdjustment.create({
            data: {
                payrollRunId: runId, employeeId: adjEmps[a.ei].id,
                type: a.type as 'RETROACTIVE' | 'BONUS' | 'CORRECTION' | 'DEDUCTION' | 'OTHER',
                category: a.cat, description: a.desc, amount: a.amount, createdById: actorKR,
            }
        }).catch(() => { })
    }
    console.log('  ✓ KR adjustments:', KADJ.length)

    // ── KR Anomalies (historical — RESOLVED/WHITELISTED for past months) ──
    const ANOMALY_RULES = [
        { code: 'MOM_CHANGE_30PCT', sev: 'WARNING', desc: (n: string) => `[대폭 변동] ${n} — 전월 대비 총지급액 급변동 (±30% 초과)` },
        { code: 'OVERTIME_SPIKE', sev: 'WARNING', desc: (n: string) => `[연장근로 급증] ${n} — 월간 연장근로 시간 급증, 52시간 한도 근접` },
        { code: 'ZERO_AMOUNT', sev: 'CRITICAL', desc: (n: string) => `[금액 이상] ${n} — 기본급 또는 총지급액이 0원` },
        { code: 'MANUAL_OVERRIDE', sev: 'INFO', desc: (n: string) => `[수동 조정] ${n} — 수동 조정 이력 있음` },
    ] as const

    const historicalAnomalyMonths = ['2025-10', '2025-11', '2025-12']
    for (const ym of historicalAnomalyMonths) {
        const runId = krRunMap[ym]
        if (!runId) continue
        const empsForMonth = krEmps.slice(0, 5)
        for (let i = 0; i < empsForMonth.length && i < 3; i++) {
            const rule = ANOMALY_RULES[i % ANOMALY_RULES.length]
            const emp = empsForMonth[i]
            const resolved = sr(`${emp.id}-${ym}-res`) > 0.3
            await prisma.payrollAnomaly.create({
                data: {
                    payrollRunId: runId, employeeId: emp.id,
                    ruleCode: rule.code, severity: rule.sev as 'CRITICAL' | 'WARNING' | 'INFO',
                    description: rule.desc(`직원${i + 1}`),
                    status: resolved ? 'RESOLVED' : 'WHITELISTED',
                    resolvedBy: resolved ? actorKR : null,
                    resolvedAt: resolved ? new Date(`${ym}-23T10:00:00Z`) : null,
                    resolution: resolved ? 'CONFIRMED_NORMAL' : null,
                    whitelisted: !resolved, whitelistReason: !resolved ? '반복 패턴 확인 — 예외 등록' : null,
                }
            }).catch(() => { })
        }
    }

    // ══════════════════════════════════════════════════════════════
    // CTR-US: 6 runs (2025-09 ~ 2026-02)
    // ══════════════════════════════════════════════════════════════
    const US_ANNUAL_SALARIES = [180_000, 150_000, 130_000, 120_000, 110_000, 100_000, 95_000, 85_000, 80_000, 75_000, 70_000, 68_000, 65_000, 62_000, 60_000]
    const usCalc = (e: { id: string }, ym: string) => {
        const idx = usEmps.findIndex(u => u.id === e.id)
        const annual = US_ANNUAL_SALARIES[idx % US_ANNUAL_SALARIES.length] ?? 80_000
        const [, m] = ym.split('-').map(Number)
        const bonus = m === 12 ? Math.round(annual * 0.12 / 12) : 0
        return calcUS(annual, bonus)
    }

    const US_RUNS = [
        { ym: '2025-09', status: 'PAID' }, { ym: '2025-10', status: 'PAID' },
        { ym: '2025-11', status: 'PAID' }, { ym: '2025-12', status: 'PAID' },
        { ym: '2026-01', status: 'REVIEW', anomCount: 8, allResolved: false },
        { ym: '2026-02', status: 'DRAFT' },
    ]
    const usRunMap: Record<string, string> = {}
    for (const r of US_RUNS) {
        const isDraft = r.status === 'DRAFT'
        const { year, month } = periodOf(r.ym)
        const res = await createRun({
            code: 'CTR-US', ym: r.ym, status: r.status, actor: actorUS || actorKR,
            name: `CTR-US ${r.ym} Payroll`, currency: 'USD',
            emps: isDraft ? [] : usEmps, calcFn: usCalc,
            paidAt: r.status === 'PAID' ? new Date(`${r.ym}-20T00:00:00Z`) : undefined,
            anomCount: (r as { anomCount?: number }).anomCount ?? 0,
            allAnomsResolved: (r as { allResolved?: boolean }).allResolved ?? r.status !== 'REVIEW',
        })
        usRunMap[r.ym] = res.run.id
        if (r.status === 'PAID') {
            await createPayslips(res.run.id, coId('CTR-US'), year, month, new Date(`${r.ym}-21T08:00:00Z`))
            await createApproval(res.run.id, actorUS || actorKR, new Date(year, month - 1, 16, 10, 0, 0), [
                { role: 'LOCAL_HR_MANAGER', approverId: actorUS || actorKR, status: 'APPROVED', comment: 'No issues found', decidedAt: new Date(year, month - 1, 17, 10, 0, 0) },
                { role: 'REGIONAL_DIRECTOR', approverId: actorUS || actorKR, status: 'APPROVED', comment: 'Approved', decidedAt: new Date(year, month - 1, 18, 10, 0, 0) },
            ], new Date(year, month - 1, 18, 10, 0, 0))
        }
    }
    console.log('  ✓ US:', US_RUNS.length, 'runs')

    // US 2026-01 REVIEW: 8 Open anomalies
    const usReviewRunId = usRunMap['2026-01']
    if (usReviewRunId && usEmps.length > 0) {
        const U_ANOMALIES = [
            { ei: 0, code: 'MOM_CHANGE_30PCT', sev: 'WARNING', desc: `${usEmps[0]?.employeeNo} — 전월 대비 총지급액 +45% 급증`, cur: 12800, prev: 8800, thr: '30%' },
            { ei: 1, code: 'MOM_CHANGE_30PCT', sev: 'WARNING', desc: `${usEmps[1]?.employeeNo ?? 'Employee'} — Revenue bonus spike detected`, cur: 15200, prev: 9000, thr: '30%' },
            { ei: 2, code: 'FIRST_PAYROLL', sev: 'INFO', desc: `${usEmps[2]?.employeeNo ?? 'NewHire'} — 입사 후 첫 급여. 일할 계산 확인 필요.`, cur: null, prev: null, thr: null },
            { ei: 3, code: 'ZERO_AMOUNT', sev: 'CRITICAL', desc: `${usEmps[3]?.employeeNo ?? 'Employee'} — Base salary is $0. Missing attendance data.`, cur: 0, prev: null, thr: null },
            { ei: 4, code: 'BAND_EXCEEDED', sev: 'WARNING', desc: `${usEmps[4]?.employeeNo ?? 'Employee'} — 급여 밴드 최대값 초과 ($15,000 cap)`, cur: 16800, prev: null, thr: '$15,000' },
            { ei: 5, code: 'OVERTIME_SPIKE', sev: 'WARNING', desc: `${usEmps[5]?.employeeNo ?? 'Employee'} — Overtime hours spike: 52h → 78h`, cur: 780, prev: 520, thr: '52h' },
            { ei: 6, code: 'OVERTIME_SPIKE', sev: 'WARNING', desc: `${usEmps[6]?.employeeNo ?? 'Employee'} — Overtime costs exceed 50% of base salary`, cur: null, prev: null, thr: '50%' },
            { ei: 7, code: 'MANUAL_OVERRIDE', sev: 'INFO', desc: `${usEmps[7]?.employeeNo ?? 'Employee'} — 수동 조정 이력 있음. 변동 사유 확인 필요.`, cur: null, prev: null, thr: null },
        ]
        await prisma.payrollAnomaly.createMany({
            data:
                U_ANOMALIES.filter(a => usEmps[a.ei]).map(a => ({
                    payrollRunId: usReviewRunId, employeeId: usEmps[a.ei].id,
                    ruleCode: a.code, severity: a.sev as 'CRITICAL' | 'WARNING' | 'INFO',
                    description: a.desc, status: 'OPEN',
                    currentValue: a.cur != null ? a.cur : null,
                    previousValue: a.prev != null ? a.prev : null,
                    threshold: a.thr,
                })), skipDuplicates: true,
        })
        console.log('  ✓ US 2026-01 anomalies: 8 OPEN')
    }

    // ══════════════════════════════════════════════════════════════
    // CTR-CN: 6 runs (2025-09 ~ 2026-02)
    // ══════════════════════════════════════════════════════════════
    const CN_BASE_SALARIES = [25000, 22000, 20000, 18000, 16500, 15000, 14000, 13500, 12000, 11000, 10000, 9500]
    const cnCalc = (e: { id: string }, ym: string) => {
        const idx = cnEmps.findIndex(u => u.id === e.id)
        const base = CN_BASE_SALARIES[idx % CN_BASE_SALARIES.length] ?? 12000
        const [, m] = ym.split('-').map(Number)
        const bonus = m === 12 ? base : 0  // 13th month
        return calcCN(base, bonus)
    }
    const CN_RUNS = [
        { ym: '2025-09', status: 'PAID' }, { ym: '2025-10', status: 'PAID' },
        { ym: '2025-11', status: 'PAID' }, { ym: '2025-12', status: 'PAID' },
        { ym: '2026-01', status: 'PENDING_APPROVAL' },
        { ym: '2026-02', status: 'DRAFT' },
    ]
    const cnRunMap: Record<string, string> = {}
    for (const r of CN_RUNS) {
        const isDraft = r.status === 'DRAFT'
        const { year, month } = periodOf(r.ym)
        const res = await createRun({
            code: 'CTR-CN', ym: r.ym, status: r.status, actor: actorCN || actorKR,
            name: `CTR-CN ${r.ym} 工资`, currency: 'CNY',
            emps: isDraft ? [] : cnEmps, calcFn: cnCalc,
            paidAt: r.status === 'PAID' ? new Date(`${r.ym}-25T00:00:00Z`) : undefined,
        })
        cnRunMap[r.ym] = res.run.id
        if (r.status === 'PAID') {
            await createPayslips(res.run.id, coId('CTR-CN'), year, month, new Date(`${r.ym}-26T08:00:00Z`))
            await createApproval(res.run.id, actorCN || actorKR, new Date(year, month - 1, 20, 10, 0, 0), [
                { role: 'LOCAL_HR', approverId: actorCN || actorKR, status: 'APPROVED', comment: '确认无误', decidedAt: new Date(year, month - 1, 21, 10, 0, 0) },
                { role: 'REGIONAL_DIRECTOR', approverId: actorCN || actorKR, status: 'APPROVED', comment: '批准', decidedAt: new Date(year, month - 1, 22, 10, 0, 0) },
            ], new Date(year, month - 1, 22, 10, 0, 0))
        } else if (r.status === 'PENDING_APPROVAL') {
            await createApproval(res.run.id, actorCN || actorKR, new Date(2026, 0, 21, 10, 0, 0), [
                { role: 'LOCAL_HR', approverId: actorCN || actorKR, status: 'APPROVED', comment: '确认完毕', decidedAt: new Date(2026, 0, 23, 10, 0, 0) },
                { role: 'REGIONAL_DIRECTOR', approverId: null, status: 'PENDING' },
            ])
        }
    }
    console.log('  ✓ CN:', CN_RUNS.length, 'runs')

    // ══════════════════════════════════════════════════════════════
    // CTR-VN: 6 runs
    // ══════════════════════════════════════════════════════════════
    const VN_BASES = [45_000_000, 38_000_000, 32_000_000, 28_000_000, 24_000_000, 20_000_000, 18_000_000, 15_000_000, 12_000_000, 10_000_000]
    const vnCalc = (e: { id: string }, ym: string) => {
        const idx = vnEmps.findIndex(u => u.id === e.id)
        const base = VN_BASES[idx % VN_BASES.length] ?? 15_000_000
        const [, m] = ym.split('-').map(Number)
        const bonus = m === 12 ? base : 0  // Tet bonus
        return calcVN(base, bonus)
    }
    const VN_RUNS = [
        { ym: '2025-09', status: 'PAID' }, { ym: '2025-10', status: 'PAID' },
        { ym: '2025-11', status: 'PAID' }, { ym: '2025-12', status: 'PAID' },
        { ym: '2026-01', status: 'APPROVED' }, { ym: '2026-02', status: 'ATTENDANCE_CLOSED' },
    ]
    for (const r of VN_RUNS) {
        const notClosed = !['ATTENDANCE_CLOSED', 'DRAFT'].includes(r.status)
        const { year, month } = periodOf(r.ym)
        const res = await createRun({
            code: 'CTR-VN', ym: r.ym, status: r.status, actor: actorVN || actorKR,
            name: `CTR-VN ${r.ym} Lương`, currency: 'VND',
            emps: notClosed ? vnEmps : [],
            calcFn: vnCalc,
            paidAt: r.status === 'PAID' ? new Date(`${r.ym}-28T00:00:00Z`) : undefined,
        })
        if (r.status === 'PAID') {
            await createPayslips(res.run.id, coId('CTR-VN'), year, month, new Date(`${r.ym}-28T08:00:00Z`))
            await createApproval(res.run.id, actorVN || actorKR, new Date(year, month - 1, 26, 10, 0, 0), [
                { role: 'LOCAL_HR', approverId: actorVN || actorKR, status: 'APPROVED', decidedAt: new Date(year, month - 1, 27, 10, 0, 0) },
                { role: 'DIRECTOR', approverId: actorVN || actorKR, status: 'APPROVED', decidedAt: new Date(year, month - 1, 28, 10, 0, 0) },
            ], new Date(year, month - 1, 28, 10, 0, 0))
        }
    }
    console.log('  ✓ VN:', VN_RUNS.length, 'runs')

    // ══════════════════════════════════════════════════════════════
    // CTR-RU: 3 runs
    // ══════════════════════════════════════════════════════════════
    const RU_BASES = [180_000, 150_000, 130_000, 110_000, 95_000, 80_000, 70_000, 60_000]
    const ruCalc = (e: { id: string }, ym: string) => {
        const idx = ruEmps.findIndex(u => u.id === e.id)
        const base = RU_BASES[idx % RU_BASES.length] ?? 80_000
        const [, m] = ym.split('-').map(Number)
        const bonus = m === 12 ? base : 0  // 13th salary
        return calcRU(base, bonus)
    }
    const RU_RUNS = [
        { ym: '2025-12', status: 'PAID' },
        { ym: '2026-01', status: 'PAID' },
        { ym: '2026-02', status: 'CALCULATING' },
    ]
    for (const r of RU_RUNS) {
        const { year, month } = periodOf(r.ym)
        const res = await createRun({
            code: 'CTR-RU', ym: r.ym, status: r.status, actor: actorRU || actorKR,
            name: `CTR-RU ${r.ym} Зарплата`, currency: 'RUB',
            emps: r.status === 'CALCULATING' ? [] : ruEmps,
            calcFn: ruCalc,
            paidAt: r.status === 'PAID' ? new Date(`${r.ym}-10T00:00:00Z`) : undefined,
        })
        if (r.status === 'PAID') {
            await createPayslips(res.run.id, coId('CTR-RU'), year, month, new Date(`${r.ym}-11T08:00:00Z`))
            await createApproval(res.run.id, actorRU || actorKR, new Date(year, month - 1, 6, 10, 0, 0), [
                { role: 'LOCAL_HR', approverId: actorRU || actorKR, status: 'APPROVED', decidedAt: new Date(year, month - 1, 8, 10, 0, 0) },
            ], new Date(year, month - 1, 8, 10, 0, 0))
        }
    }
    console.log('  ✓ RU:', RU_RUNS.length, 'runs')

    // ══════════════════════════════════════════════════════════════
    // CTR-EU: 3 runs (replaced CTR-MX — merged into CTR-US Location)
    // ══════════════════════════════════════════════════════════════
    const EU_BASES = [18_000, 15_000, 12_000, 10_000, 9_000, 8_000, 7_000, 6_500]
    const euCalc = (e: { id: string }) => {
        const idx = euEmps.findIndex(u => u.id === e.id)
        const base = EU_BASES[idx % EU_BASES.length] ?? 10_000
        // Poland: ZUS ~13.7%, PIT ~17%
        const zus = Math.round(base * 0.137), pit = Math.round(base * 0.17)
        const total = zus + pit
        return {
            baseSalary: base, overtimePay: 0, bonus: 0, allowances: 0, grossPay: base,
            deductions: total, netPay: base - total,
            detail: { earnings: { baseSalary: base }, tax: { zus, pit } }
        }
    }
    const EU_RUNS = [
        { ym: '2025-12', status: 'PAID' },
        { ym: '2026-01', status: 'PAID' },
        { ym: '2026-02', status: 'DRAFT' },
    ]
    for (const r of EU_RUNS) {
        const { year, month } = periodOf(r.ym)
        const res = await createRun({
            code: 'CTR-EU', ym: r.ym, status: r.status, actor: actorEU || actorKR,
            name: `CTR-EU ${r.ym} Payroll`, currency: 'PLN',
            emps: r.status === 'DRAFT' ? [] : euEmps,
            calcFn: euCalc,
            paidAt: r.status === 'PAID' ? new Date(`${r.ym}-05T00:00:00Z`) : undefined,
        })
        if (r.status === 'PAID') {
            await createPayslips(res.run.id, coId('CTR-EU'), year, month, new Date(`${r.ym}-06T08:00:00Z`))
            await createApproval(res.run.id, actorEU || actorKR, new Date(year, month - 1, 3, 10, 0, 0), [
                { role: 'LOCAL_HR', approverId: actorEU || actorKR, status: 'APPROVED', decidedAt: new Date(year, month - 1, 4, 10, 0, 0) },
            ], new Date(year, month - 1, 4, 10, 0, 0))
        }
    }
    console.log('  ✓ EU:', EU_RUNS.length, 'runs')

    // ── Summary ─────────────────────────────────────────────────
    const [runCnt, itemCnt, adjCnt, anomCnt, apprCnt, stepCnt, slipCnt] = await Promise.all([
        prisma.payrollRun.count(), prisma.payrollItem.count(),
        prisma.payrollAdjustment.count(), prisma.payrollAnomaly.count(),
        prisma.payrollApproval.count(), prisma.payrollApprovalStep.count(),
        prisma.payslip.count(),
    ])
    console.log(`\n  📊 Counts:`)
    console.log(`     PayrollRun:          ${runCnt}`)
    console.log(`     PayrollItem:         ${itemCnt}`)
    console.log(`     PayrollAdjustment:   ${adjCnt}`)
    console.log(`     PayrollAnomaly:      ${anomCnt}`)
    console.log(`     PayrollApproval:     ${apprCnt}`)
    console.log(`     PayrollApprovalStep: ${stepCnt}`)
    console.log(`     Payslip:             ${slipCnt}`)
    console.log('✅ Seed 17 complete\n')
}
