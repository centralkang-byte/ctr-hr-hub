// ================================================================
// CTR HR Hub — Seed Data: Session B.1 — Year-End Settlement (Korea)
// prisma/seeds/13-year-end.ts
//
// Creates (2025 tax year, CTR-KR only):
//   ~30 YearEndSettlement (COMPLETED 70%, IN_PROGRESS 20%, NOT_STARTED 10%)
//   ~90 YearEndDeduction (2~4 per settlement)
//   ~30 YearEndDependent (0~3 per settlement)
//   ~21 WithholdingReceipt (for COMPLETED settlements)
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

function deterministicUUID(ns: string, key: string): string {
    const str = `${ns}:${key}`
    let h = 0
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0 }
    const hex = Math.abs(h).toString(16).padStart(8, '0')
    return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(0, 3)}-${hex.padEnd(12, '0').slice(0, 12)}`
}

function sr(seed: number): number {
    const x = Math.sin(seed * 9301 + 49297) * 233280
    return x - Math.floor(x)
}

// Korean tax deduction types (2025 기준)
// TODO: Move to Settings (Payroll > Year-End) — deduction config limits per category
const DEDUCTION_TYPES = [
    { code: 'INSURANCE', category: 'insurance', name: '보험료 공제', maxPct: 0.12 },
    { code: 'MEDICAL', category: 'medical', name: '의료비 공제', maxPct: 0.15 },
    { code: 'EDUCATION', category: 'education', name: '교육비 공제', maxPct: 0.15 },
    { code: 'DONATION', category: 'donation', name: '기부금 공제', maxPct: 0.15 },
    { code: 'CREDIT_CARD', category: 'credit_card', name: '신용카드 소득공제', maxPct: 0.15 },
    { code: 'HOUSING_FUND', category: 'housing', name: '주택자금 공제', maxPct: 0.40 },
]

// ── Grade → annual salary ─────────────────────────────────
// TODO: Move to Settings (Payroll > Year-End) — annual income reference per grade
const GRADE_ANNUAL: Record<string, number> = {
    G1: 159_600_000, G2: 105_000_000, G3: 80_040_000,
    G4: 62_520_000, G5: 48_960_000, G6: 38_520_000,
}

// Korean earned income deduction formula (2025)
// TODO: Move to Settings (Payroll > Year-End) — earned income deduction brackets
function calcEarnedIncomeDeduction(totalSalary: bigint): bigint {
    const s = Number(totalSalary)
    if (s <= 5_000_000) return BigInt(Math.min(s, 5_000_000))
    if (s <= 15_000_000) return BigInt(5_000_000 + Math.floor((s - 5_000_000) * 0.35))
    if (s <= 45_000_000) return BigInt(8_500_000 + Math.floor((s - 15_000_000) * 0.15))
    if (s <= 100_000_000) return BigInt(13_000_000 + Math.floor((s - 45_000_000) * 0.05))
    return BigInt(15_750_000 + Math.floor((s - 100_000_000) * 0.02))
}

// Progressive income tax rate (simplified 2025)
// TODO: Move to Settings (Payroll > Tax) — income tax bracket configuration
function calcIncomeTax(taxableBase: bigint): bigint {
    const b = Number(taxableBase)
    if (b <= 14_000_000) return BigInt(Math.floor(b * 0.06))
    if (b <= 50_000_000) return BigInt(840_000 + Math.floor((b - 14_000_000) * 0.15))
    if (b <= 88_000_000) return BigInt(6_240_000 + Math.floor((b - 50_000_000) * 0.24))
    if (b <= 150_000_000) return BigInt(15_360_000 + Math.floor((b - 88_000_000) * 0.35))
    return BigInt(37_060_000 + Math.floor((b - 150_000_000) * 0.38))
}

// ────────────────────────────────────────────────────────────
export async function seedYearEnd(prisma: PrismaClient): Promise<void> {
    console.log('\n📋 Session B.1: Seeding year-end settlement data (2025 tax year)...\n')

    const krCo = await prisma.company.findFirst({ where: { code: 'CTR-KR' } })
    if (!krCo) { console.error('  ❌ CTR-KR not found'); return }
    const krId = krCo.id

    // HR confirmer
    const hrEmp = await prisma.employee.findFirst({ where: { employeeNo: 'CTR-KR-0001' } })
    const hrId = hrEmp?.id

    // Get active KR employees with grade
    const krAssignments = await prisma.employeeAssignment.findMany({
        where: { companyId: krId, isPrimary: true, endDate: null, status: { not: 'TERMINATED' } },
        select: {
            employeeId: true,
            jobGrade: { select: { code: true } },
            employee: { select: { name: true, employeeNo: true } },
        },
        take: 30,
    })

    let settlementCount = 0
    let deductionCount = 0
    let dependentCount = 0
    let receiptCount = 0

    for (let i = 0; i < krAssignments.length; i++) {
        const asgn = krAssignments[i]
        const empId = asgn.employeeId
        const gradeCode = asgn.jobGrade?.code ?? 'G6'

        // Determine status: COMPLETED 70%, IN_PROGRESS 20%, NOT_STARTED 10%
        const r = sr(i * 13 + 1)
        const status = r < 0.70 ? 'completed' : r < 0.90 ? 'in_progress' : 'not_started'

        const totalSalary = BigInt(GRADE_ANNUAL[gradeCode] ?? 38_520_000)
        const earnedIncomeDeduction = calcEarnedIncomeDeduction(totalSalary)
        const earnedIncome = totalSalary - earnedIncomeDeduction

        // Personal deduction: 1,500,000 per person (본인공제) + dependents
        // TODO: Move to Settings (Payroll > Year-End) — personal deduction amount
        const personalDeduction = BigInt(1_500_000)
        const totalIncomeDeduction = personalDeduction
        const taxableBase = earnedIncome - totalIncomeDeduction > 0n
            ? earnedIncome - totalIncomeDeduction : 0n

        const calculatedTax = calcIncomeTax(taxableBase)

        // Tax credit (근로소득세액공제)
        // TODO: Move to Settings (Payroll > Year-End) — earned income tax credit rate
        const taxCredit = calculatedTax <= BigInt(1_300_000)
            ? calculatedTax * 55n / 100n
            : BigInt(715_000) + (calculatedTax - BigInt(1_300_000)) * 30n / 100n
        const totalTaxCredit = taxCredit > BigInt(660_000) ? BigInt(660_000) : taxCredit

        const determinedTax = calculatedTax - totalTaxCredit
        // Prepaid tax: monthly withholding ~80% of annual determined tax
        const prepaidTax = determinedTax * 80n / 100n
        const finalSettlement = determinedTax - prepaidTax
        const localTaxSettlement = finalSettlement * 10n / 100n

        const settlementId = deterministicUUID('yesettlement', `KR:${empId}:2025`)
        const existing = await prisma.yearEndSettlement.findFirst({
            where: { employeeId: empId, year: 2025 },
        })

        if (!existing) {
            await prisma.yearEndSettlement.create({
                data: {
                    id: settlementId,
                    employeeId: empId,
                    year: 2025,
                    status,
                    totalSalary,
                    earnedIncomeDeduction,
                    earnedIncome,
                    incomeDeductions: { personal: 1_500_000 },
                    totalIncomeDeduction,
                    taxableBase,
                    taxRate: 0.15,
                    calculatedTax,
                    taxCredits: { earnedIncome: Number(totalTaxCredit) },
                    totalTaxCredit,
                    determinedTax,
                    prepaidTax,
                    finalSettlement,
                    localTaxSettlement,
                    submittedAt: status !== 'not_started' ? new Date('2026-01-15') : null,
                    confirmedAt: status === 'completed' ? new Date('2026-02-20') : null,
                    confirmedBy: status === 'completed' ? hrId : null,
                },
            })
            settlementCount++

            // ── YearEndDeductions (2~4 per settlement) ─────────
            if (status !== 'not_started') {
                const numDeductions = 2 + Math.floor(sr(i * 7) * 3)
                const shuffled = [...DEDUCTION_TYPES].sort(() => sr(i * 3 + 11) - 0.5).slice(0, numDeductions)

                for (let di = 0; di < shuffled.length; di++) {
                    const ded = shuffled[di]
                    const inputAmount = BigInt(Math.round(
                        (300_000 + sr(i * 5 + di) * 2_000_000) / 10_000
                    ) * 10_000)
                    const salaryNum = Number(totalSalary)
                    const deductibleAmount = BigInt(Math.min(
                        Number(inputAmount),
                        Math.floor(salaryNum * ded.maxPct)
                    ))

                    await prisma.yearEndDeduction.create({
                        data: {
                            id: deterministicUUID('yeded', `${empId}:${ded.code}`),
                            settlementId,
                            configCode: ded.code,
                            category: ded.category,
                            name: ded.name,
                            inputAmount,
                            deductibleAmount,
                            details: { verified: status === 'completed' },
                            source: 'manual',
                        },
                    })
                    deductionCount++
                }
            }

            // ── YearEndDependents (0~3 per settlement) ─────────
            const depSeed = sr(i * 17)
            const numDeps = depSeed < 0.40 ? 0 : depSeed < 0.70 ? 1 : depSeed < 0.90 ? 2 : 3

            const DEP_RELATIONS = ['SPOUSE', 'CHILD', 'PARENT']
            const DEP_NAMES_M = ['김철수', '이민준', '박지훈']
            const DEP_NAMES_F = ['김영희', '이수연', '박지은']

            for (let di = 0; di < numDeps; di++) {
                const rel = DEP_RELATIONS[di % 3]
                const isFemale = (i + di) % 2 === 0
                const birthYear = rel === 'CHILD' ? 2010 + di * 3 : rel === 'SPOUSE' ? 1985 + i % 10 : 1955
                const depName = isFemale ? DEP_NAMES_F[di % 3] : DEP_NAMES_M[di % 3]
                const isDisabled = sr(i * 29 + di) < 0.08
                const isSenior = rel === 'PARENT' && birthYear <= 1956

                await prisma.yearEndDependent.create({
                    data: {
                        id: deterministicUUID('yedep', `${empId}:${di}`),
                        settlementId,
                        relationship: rel,
                        name: depName,
                        birthDate: new Date(`${birthYear}-05-10`),
                        isDisabled,
                        isSenior,
                        isSingleParent: false,
                        // TODO: Move to Settings (Payroll > Year-End) — dependent deduction amount
                        deductionAmount: 1_500_000,
                        additionalDeduction: isDisabled ? 2_000_000 : isSenior ? 1_000_000 : 0,
                    },
                })
                dependentCount++
            }

            // ── WithholdingReceipt (COMPLETED only) ─────────────
            if (status === 'completed') {
                const receiptExists = await prisma.withholdingReceipt.findFirst({
                    where: { settlementId },
                })
                if (!receiptExists) {
                    await prisma.withholdingReceipt.create({
                        data: {
                            id: deterministicUUID('wreceipt', `${empId}:2025`),
                            settlementId,
                            employeeId: empId,
                            year: 2025,
                            pdfPath: `receipts/year-end/2025/${empId}/withholding_receipt.pdf`,
                            issuedAt: new Date('2026-02-28'),
                        },
                    })
                    receiptCount++
                }
            }
        }
    }

    const totalS = await prisma.yearEndSettlement.count()
    const totalD = await prisma.yearEndDeduction.count()
    const totalDep = await prisma.yearEndDependent.count()
    const totalR = await prisma.withholdingReceipt.count()

    console.log('\n======================================')
    console.log('📋 Year-End Settlement Seed Complete!')
    console.log('======================================')
    console.log(`  YearEndSettlement:    ${totalS} (new: ${settlementCount})`)
    console.log(`  YearEndDeduction:     ${totalD} (new: ${deductionCount})`)
    console.log(`  YearEndDependent:     ${totalDep} (new: ${dependentCount})`)
    console.log(`  WithholdingReceipt:   ${totalR} (new: ${receiptCount})`)
    console.log('======================================\n')
}
