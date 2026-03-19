// ================================================================
// CTR HR Hub — Seed Data: Session B.4 — Partial Menu Fixes
// prisma/seeds/16-partial-fixes.ts
//
// Fixes 5 PARTIAL menus:
//   1. CalibrationAdjustment (~15 records)
//   2. AttritionRiskHistory (~40 records, 20 employees × 2 months)
//   3. PayrollSimulation (3 saved simulations)
//   4. PiiAccessLog (~20 records)
//   5. OneOnOne meetings (~10 records)
// ================================================================

import { PrismaClient, OneOnOneStatus, OneOnOneType } from '../../src/generated/prisma/client'

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

function daysAgo(n: number): Date {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d
}

function daysFromNow(n: number): Date {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d
}

// ── EMS block grade pairs for calibration ───────────────────
// originalBlock → adjustedBlock (up/down adjustment)
// TODO: Move to Settings (Performance > Calibration) — grade adjustment rules
const BLOCK_ADJUSTMENTS = [
    { original: '2B', adjusted: '2C', reason: '팀 내 상대 비교 결과 상향 조정' },
    { original: '1B', adjusted: '2B', reason: '관리자 추천으로 성과 재평가 후 상향' },
    { original: '3B', adjusted: '3C', reason: '전사 분포 조정을 위한 상향' },
    { original: '2A', adjusted: '2B', reason: '업무 성과 재검토 결과 하향 조정' },
    { original: '1C', adjusted: '2C', reason: '관리자와 HR 합의 후 하향 조정' },
    { original: '3A', adjusted: '3B', reason: '전사 성과 분포 균형 조정' },
]

// ── High-risk employee persona numbers (P5 = high overtime risk) ─
// These are employee numbers with known H risk signals
const HIGH_RISK_EMP_NOS = [
    'CTR-KR-3023', 'CTR-KR-3034', 'CTR-KR-3043', 'CTR-KR-3044',
    'CTR-KR-3053', 'CTR-KR-3065', 'CTR-KR-3070',
]

// ── Office IPs for PII access log ──────────────────────────
// TODO: Move to Settings (Compliance > PII Audit) — allowed IP ranges
const OFFICE_IPS = ['172.16.10.1', '172.16.10.2', '172.16.10.15', '10.0.1.50', '10.0.1.51']
const PII_FIELDS = ['주민등록번호', '급여정보', '계좌정보', '건강상태', '가족관계', '주소']
const PII_ACCESS_TYPES = ['VIEW', 'EXPORT', 'VIEW', 'VIEW', 'MODIFY', 'VIEW']

// ────────────────────────────────────────────────────────────
export async function seedPartialFixes(prisma: PrismaClient): Promise<void> {
    console.log('\n🔧 Session B.4: Seeding partial menu fixes...\n')

    const krCo = await prisma.company.findFirst({ where: { code: 'CTR' } })
    if (!krCo) { console.error('  ❌ CTR-KR not found'); return }
    const krId = krCo.id

    const hrEmp = await prisma.employee.findFirst({ where: { employeeNo: 'CTR-KR-0001' } })
    if (!hrEmp) { console.error('  ❌ HR employee not found'); return }
    const hrId = hrEmp.id

    const managerEmp = await prisma.employee.findFirst({ where: { employeeNo: 'CTR-KR-0002' } })
    const managerId = managerEmp?.id ?? hrId

    // ── 1. CalibrationAdjustment ─────────────────────────────
    console.log('📌 Fix 1: CalibrationAdjustment...')
    let calibCount = 0

    const calibSession = await prisma.calibrationSession.findFirst({
        where: { companyId: krId },
        orderBy: { createdAt: 'desc' },
    })

    if (calibSession) {
        // Get KR employees for adjustments (~15 records)
        const krEmps = await prisma.employeeAssignment.findMany({
            where: { companyId: krId, isPrimary: true, endDate: null },
            select: { employeeId: true },
            take: 20,
        })

        // Get recent performance evaluations to link
        const evals = await prisma.performanceEvaluation.findMany({
            where: { companyId: krId },
            select: { id: true, employeeId: true },
            take: 20,
        })
        const evalMap: Record<string, string> = {}
        for (const e of evals) evalMap[e.employeeId] = e.id

        // ~30% of employees get calibration adjustments
        const adjustCount = Math.min(15, Math.floor(krEmps.length * 0.3))
        const targetEmps = krEmps.slice(0, adjustCount)

        for (let i = 0; i < targetEmps.length; i++) {
            const empId = targetEmps[i].employeeId
            const blkDef = BLOCK_ADJUSTMENTS[i % BLOCK_ADJUSTMENTS.length]

            // Generate realistic scores for each block
            const origPerf = 2.0 + sr(i * 11) * 2.0  // 2.0~4.0
            const origComp = 2.0 + sr(i * 13) * 2.0
            const adjPerf = blkDef.adjusted > blkDef.original
                ? origPerf + 0.3 + sr(i * 7) * 0.4   // up
                : origPerf - 0.3 - sr(i * 7) * 0.4   // down
            const adjComp = blkDef.adjusted > blkDef.original
                ? origComp + 0.2 + sr(i * 5) * 0.3
                : origComp - 0.2 - sr(i * 5) * 0.3

            const adjId = deterministicUUID('calibadj', `${calibSession.id}:${empId}`)
            const exists = await prisma.calibrationAdjustment.findFirst({ where: { id: adjId } })
            if (!exists) {
                await prisma.calibrationAdjustment.create({
                    data: {
                        id: adjId,
                        sessionId: calibSession.id,
                        employeeId: empId,
                        evaluatorId: managerId,
                        originalPerformanceScore: Math.max(1.0, Math.min(5.0, origPerf)),
                        originalCompetencyScore: Math.max(1.0, Math.min(5.0, origComp)),
                        originalBlock: blkDef.original,
                        adjustedPerformanceScore: Math.max(1.0, Math.min(5.0, adjPerf)),
                        adjustedCompetencyScore: Math.max(1.0, Math.min(5.0, adjComp)),
                        adjustedBlock: blkDef.adjusted,
                        reason: blkDef.reason,
                        adjustedBy: hrId,
                        adjustedAt: new Date('2025-12-20'),
                        evaluationId: evalMap[empId] ?? null,
                    },
                })
                calibCount++
            }
        }
    } else {
        console.log('  ⚠ No calibration session found, skipping CalibrationAdjustment')
    }
    console.log(`  ✅ ${calibCount} calibration adjustments`)

    // ── 2. AttritionRiskHistory ──────────────────────────────
    console.log('📌 Fix 2: AttritionRiskHistory...')
    let attritionCount = 0

    const allKrEmps = await prisma.employeeAssignment.findMany({
        where: { companyId: krId, isPrimary: true, endDate: null, status: { not: 'TERMINATED' } },
        select: { employeeId: true, employee: { select: { employeeNo: true } } },
        take: 20,
    })

    // TODO: Move to Settings (Analytics > Attrition) — risk score thresholds
    const RISK_MONTHS = [
        { year: 2026, month: 1, calculatedAt: new Date('2026-01-31') },
        { year: 2026, month: 2, calculatedAt: new Date('2026-02-28') },
    ]

    for (let i = 0; i < allKrEmps.length; i++) {
        const { employeeId, employee } = allKrEmps[i]
        const isHighRisk = HIGH_RISK_EMP_NOS.includes(employee.employeeNo)

        for (const mo of RISK_MONTHS) {
            const ruleScore = isHighRisk
                ? 60 + Math.floor(sr(i * 7 + mo.month) * 30)  // 60~90
                : 15 + Math.floor(sr(i * 11 + mo.month) * 40) // 15~55

            const aiAdjustment = Math.floor((sr(i * 3 + mo.month * 7) - 0.5) * 20) // -10~+10
            const score = Math.max(0, Math.min(100, ruleScore + (aiAdjustment ?? 0)))

            // Risk level thresholds
            // TODO: Move to Settings (Analytics > Attrition) — risk level thresholds

            const scoreFactors = {
                tenureMonths: { score: isHighRisk ? 80 : 30, weight: 0.20 },
                overtimeHours: { score: isHighRisk ? 75 : 20, weight: 0.25 },
                absenceFrequency: { score: Math.floor(sr(i * 19) * 60), weight: 0.15 },
                recentLeaveUsage: { score: Math.floor(sr(i * 23) * 50), weight: 0.15 },
                performanceScore: { score: Math.floor(sr(i * 31) * 70), weight: 0.25 },
            }

            const histId = deterministicUUID('attrition', `${employeeId}:${mo.year}:${mo.month}`)
            const exists = await prisma.attritionRiskHistory.findFirst({ where: { id: histId } })
            if (!exists) {
                await prisma.attritionRiskHistory.create({
                    data: {
                        id: histId,
                        employeeId,
                        companyId: krId,
                        score,
                        ruleScore,
                        aiAdjustment,
                        scoreFactors,
                        calculatedAt: mo.calculatedAt,
                    },
                })
                attritionCount++
            }
        }
    }
    console.log(`  ✅ ${attritionCount} attrition risk history records`)

    // ── 3. PayrollSimulation ─────────────────────────────────
    console.log('📌 Fix 3: PayrollSimulation...')
    let simCount = 0

    // PayrollSimulation.employeeId is required (the HR who created it)
    // Use HR admin employee as the "reference employee" for global simulations
    const simDefs = [
        {
            key: 'KR-2026-RAISE-5PCT',
            type: 'mass_adjustment',
            title: '2026 연봉인상 시뮬레이션 (전직원 +5%)',
            employeeNo: 'CTR-KR-0001',
            parameters: {
                scope: 'all_kr',
                adjustmentType: 'percentage',
                value: 5.0,
                effectiveDate: '2026-01-01',
                currency: 'KRW',
            },
            results: {
                affectedCount: 70,
                totalCurrentCost: 5_200_000_000,
                totalProjectedCost: 5_460_000_000,
                totalIncreaseAmount: 260_000_000,
                avgIncreasePerEmployee: 3_714_286,
                summary: '전직원 5% 인상 시, 연간 2억 6천만원 추가 인건비 발생 예상.',
            },
        },
        {
            key: 'KR-2026-PERF-BONUS',
            type: 'performance_bonus',
            title: '성과급 시뮬레이션 (S/A등급)',
            employeeNo: 'CTR-KR-0001',
            parameters: {
                scope: 'grade_filter',
                grades: ['S', 'A'],
                bonusType: 'performance_incentive',
                sFactor: 2.0,
                aFactor: 1.5,
                baseSalaryMultiplier: 'monthly_base',
                currency: 'KRW',
            },
            results: {
                sGradeCount: 5,
                aGradeCount: 18,
                totalBonusCost: 450_000_000,
                avgBonusPerEmployee: 19_565_217,
                summary: 'S등급 5명 × 월봉 2개월 + A등급 18명 × 월봉 1.5개월 기준.',
            },
        },
        {
            key: 'CN-2026-WAGE-ADJ',
            type: 'entity_adjustment',
            title: 'CTR-CN 현지 임금조정 시뮬레이션',
            employeeNo: 'CTR-KR-0001',
            parameters: {
                scope: 'entity',
                entity: 'CTR-CN',
                adjustmentType: 'percentage',
                value: 8.0,
                currency: 'CNY',
                effectiveDate: '2026-01-01',
                note: '중국 현지 최저임금 인상에 따른 대응 시뮬레이션',
            },
            results: {
                affectedCount: 18,
                totalCurrentCost: 3_240_000,
                totalProjectedCost: 3_499_200,
                totalIncreaseAmount: 259_200,
                avgIncreasePerEmployee: 14_400,
                summary: 'CTR-CN 전직원 8% 인상 시, 연간 259,200 CNY 추가 인건비 예상.',
            },
        },
    ]

    for (const sim of simDefs) {
        const simEmp = await prisma.employee.findFirst({ where: { employeeNo: sim.employeeNo } })
        if (!simEmp) continue

        const simId = deterministicUUID('payrollsim', sim.key)
        const exists = await prisma.payrollSimulation.findFirst({ where: { id: simId } })
        if (!exists) {
            await prisma.payrollSimulation.create({
                data: {
                    id: simId,
                    createdBy: simEmp.id,
                    employeeId: simEmp.id,  // required field per schema
                    type: sim.type,
                    title: sim.title,
                    parameters: sim.parameters,
                    results: sim.results,
                },
            })
            simCount++
        }
    }
    console.log(`  ✅ ${simCount} payroll simulations`)

    // ── 4. PiiAccessLog ──────────────────────────────────────
    console.log('📌 Fix 4: PiiAccessLog...')
    let piiCount = 0

    const hrEmps = [hrId, managerId]
    const targetEmps = await prisma.employeeAssignment.findMany({
        where: { companyId: krId, isPrimary: true },
        select: { employeeId: true },
        take: 10,
    })

    for (let i = 0; i < 20; i++) {
        const actorId = hrEmps[i % hrEmps.length]
        const targetEmp = targetEmps[i % targetEmps.length]
        const targetId = targetEmp.employeeId

        if (actorId === targetId) continue  // skip self-access

        const accessType = PII_ACCESS_TYPES[i % PII_ACCESS_TYPES.length]
        const fieldName = PII_FIELDS[i % PII_FIELDS.length]
        const ip = OFFICE_IPS[i % OFFICE_IPS.length]

        const piiId = deterministicUUID('piilog', `${actorId}:${targetId}:${i}`)
        const exists = await prisma.piiAccessLog.findFirst({ where: { id: piiId } })
        if (!exists) {
            await prisma.piiAccessLog.create({
                data: {
                    id: piiId,
                    companyId: krId,
                    actorId,
                    targetId,
                    accessType,
                    fieldName,
                    ipAddress: ip,
                    userAgent: 'Mozilla/5.0 (CTR-HR-Hub Internal)',
                    createdAt: daysAgo(Math.floor(sr(i * 7) * 30)),
                },
            })
            piiCount++
        }
    }
    console.log(`  ✅ ${piiCount} PII access logs`)

    // ── 5. OneOnOne ──────────────────────────────────────────
    console.log('📌 Fix 5 (Bonus): OneOnOne meetings...')
    let ooCount = 0

    // Manager-report pairs: manager (CTR-KR-0002) + employees
    const reportEmps = await prisma.employeeAssignment.findMany({
        where: { companyId: krId, isPrimary: true, endDate: null, status: 'ACTIVE' },
        select: { employeeId: true },
        take: 10,
    })

    const OO_STATUSES: OneOnOneStatus[] = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'SCHEDULED', 'CANCELLED']
    const OO_TYPES: OneOnOneType[] = ['REGULAR', 'REGULAR', 'GOAL_REVIEW', 'DEVELOPMENT', 'AD_HOC']
    const OO_AGENDAS = [
        '이번 주 업무 진행 현황 공유 및 장애물 논의',
        '2025-H2 목표 달성 현황 점검 및 2026 목표 예비 논의',
        '개인 성과 피드백 및 역량 개발 계획 수립',
        '팀 내 협업 이슈 해결 방안 논의',
        '커리어 개발 방향성 및 교육 계획 논의',
    ]

    for (let i = 0; i < Math.min(10, reportEmps.length); i++) {
        const empId = reportEmps[i].employeeId
        if (empId === managerId) continue

        const status = OO_STATUSES[i % OO_STATUSES.length]
        const meetType = OO_TYPES[i % OO_TYPES.length]
        const isCompleted = status === 'COMPLETED'
        const isScheduled = status === 'SCHEDULED'

        const scheduledAt = isScheduled
            ? daysFromNow(7 + i * 3)
            : daysAgo(7 + i * 4)

        const ooId = deterministicUUID('oneonone', `${managerId}:${empId}:${i}`)
        const exists = await prisma.oneOnOne.findFirst({ where: { id: ooId } })
        if (!exists) {
            await prisma.oneOnOne.create({
                data: {
                    id: ooId,
                    employeeId: empId,
                    managerId,
                    companyId: krId,
                    scheduledAt,
                    completedAt: isCompleted ? new Date(scheduledAt.getTime() + 3600_000) : null,
                    status,
                    meetingType: meetType,
                    agenda: OO_AGENDAS[i % OO_AGENDAS.length],
                    notes: isCompleted
                        ? `논의 완료. 다음 미팅 전 ${['목표 업데이트', '액션 플랜 작성', '주간 보고서 공유'][i % 3]} 필요.`
                        : null,
                    actionItems: isCompleted
                        ? [{ task: '액션 아이템 #1', owner: '직원', dueDate: daysFromNow(7).toISOString() }]
                        : undefined,
                },
            })
            ooCount++
        }
    }
    console.log(`  ✅ ${ooCount} 1:1 meetings`)

    // ── Summary ──────────────────────────────────────────────
    const totalCalib = await prisma.calibrationAdjustment.count()
    const totalAttrition = await prisma.attritionRiskHistory.count()
    const totalSim = await prisma.payrollSimulation.count()
    const totalPii = await prisma.piiAccessLog.count()
    const totalOO = await prisma.oneOnOne.count()

    console.log('\n======================================')
    console.log('🔧 Partial Fixes Seed Complete!')
    console.log('======================================')
    console.log(`  CalibrationAdjustments:  ${totalCalib}`)
    console.log(`  AttritionRiskHistory:    ${totalAttrition}`)
    console.log(`  PayrollSimulations:      ${totalSim}`)
    console.log(`  PiiAccessLogs:           ${totalPii}`)
    console.log(`  OneOnOne meetings:       ${totalOO}`)
    console.log('======================================\n')
}
