// ================================================================
// CTR HR Hub — Seed Data: GP#4 Session D-1 — Compensation Review
// prisma/seeds/20-compensation-review.ts
//
// Creates:
//   10 CompensationHistory records (8 normal + 2 exceptions)
//   Tied to existing 2025-H2 cycle and performance reviews
// ================================================================

import { CompensationChangeType, PrismaClient } from '../../src/generated/prisma/client'

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

// 10 employees with comp history data
// Realistic salaries: 35,000,000 ~ 90,000,000 KRW (Korean auto parts)
const COMP_RECORDS: Array<{
    empNo: string
    baseSalary: number
    grade: string
    meritPct: number
    isException: boolean
    exceptionReason?: string
}> = [
        { empNo: 'CTR-KR-3001', baseSalary: 45000000, grade: 'M', meritPct: 3, isException: false },
        { empNo: 'CTR-KR-3002', baseSalary: 48000000, grade: 'M_PLUS', meritPct: 5, isException: false },
        { empNo: 'CTR-KR-3006', baseSalary: 55000000, grade: 'E', meritPct: 9, isException: false },
        { empNo: 'CTR-KR-3010', baseSalary: 62000000, grade: 'M_PLUS', meritPct: 7, isException: false },
        { empNo: 'CTR-KR-3017', baseSalary: 78000000, grade: 'E', meritPct: 15, isException: true, exceptionReason: '핵심 인재 유지 — 경쟁사 제안 대응 필요' },
        { empNo: 'CTR-KR-3019', baseSalary: 42000000, grade: 'M', meritPct: 4, isException: false },
        { empNo: 'CTR-KR-3029', baseSalary: 90000000, grade: 'E', meritPct: 6, isException: false },
        { empNo: 'CTR-KR-3030', baseSalary: 38000000, grade: 'B', meritPct: 0, isException: true, exceptionReason: '수습 기간 미완료 — 6개월 후 재평가 예정' },
        { empNo: 'CTR-KR-3031', baseSalary: 52000000, grade: 'M', meritPct: 3, isException: false },
        { empNo: 'CTR-KR-3035', baseSalary: 47000000, grade: 'M_PLUS', meritPct: 5, isException: false },
    ]

export async function seedGP4CompReview(prisma: PrismaClient): Promise<void> {
    console.log('\n💰 Session D-1: Seeding compensation review records...\n')

    const cycle2025H2Id = deterministicUUID('cycle', 'CTR-KR:2025:H2')

    const cycle = await prisma.performanceCycle.findFirst({ where: { id: cycle2025H2Id } })
    if (!cycle) {
        console.log('  ⚠️ 2025-H2 cycle not found, skipping comp review seed')
        return
    }

    const hrManager = await prisma.employee.findFirst({ where: { employeeNo: 'CTR-KR-0002' } })
    if (!hrManager) {
        console.log('  ⚠️ HR manager not found, skipping comp review seed')
        return
    }

    let normalCount = 0
    let exceptionCount = 0

    for (let i = 0; i < COMP_RECORDS.length; i++) {
        const rec = COMP_RECORDS[i]
        const employee = await prisma.employee.findFirst({ where: { employeeNo: rec.empNo } })
        if (!employee) continue

        const compId = deterministicUUID('comp-hist', `2025H2:${rec.empNo}`)

        const existing = await prisma.compensationHistory.findFirst({ where: { id: compId } })
        if (existing) continue

        const increaseAmount = Math.round(rec.baseSalary * rec.meritPct / 100)
        const newSalary = rec.baseSalary + increaseAmount

        await prisma.compensationHistory.create({
            data: {
                id: compId,
                employeeId: employee.id,
                companyId: cycle.companyId,
                changeType: 'ANNUAL_INCREASE' as CompensationChangeType,
                previousBaseSalary: rec.baseSalary,
                newBaseSalary: newSalary,
                currency: 'KRW',
                changePct: rec.meritPct,
                effectiveDate: new Date('2026-01-01'),
                cycleId: cycle2025H2Id,
                performanceGradeAtTime: rec.grade,
                isException: rec.isException,
                exceptionReason: rec.exceptionReason ?? null,
                approvedById: hrManager.id,
                reason: rec.isException
                    ? `보상 예외: ${rec.exceptionReason}`
                    : `성과 기반 인상 (${rec.grade})`,
                compaRatio: Math.round((0.85 + sr(i * 77 + 13) * 0.3) * 100) / 100,
            },
        })

        if (rec.isException) {
            exceptionCount++
        } else {
            normalCount++
        }
    }

    console.log(`  ✅ ${normalCount + exceptionCount} compensation history records`)
    console.log(`     Normal: ${normalCount}, Exceptions: ${exceptionCount}`)
    console.log('')
}
