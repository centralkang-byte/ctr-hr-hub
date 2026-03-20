// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Anomaly Detector (GP#3-A)
// src/lib/payroll/anomaly-detector.ts
// ═══════════════════════════════════════════════════════════
//
// ADJUSTMENT → REVIEW 전환 시 실행되는 이상 탐지 엔진.
// 6가지 규칙을 적용하여 PayrollAnomaly 레코드를 생성.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { PayrollAnomaly, Prisma } from '@/generated/prisma/client'
import { getPayrollSetting, getAttendanceSetting } from '@/lib/settings/get-setting'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

// ─── 탐지 규칙 코드 ─────────────────────────────────────────

export const ANOMALY_RULES = {
    MOM_CHANGE_30PCT: 'MOM_CHANGE_30PCT',    // 전월 대비 총지급액 ±30% 초과
    BAND_EXCEEDED: 'BAND_EXCEEDED',        // 급여 밴드 초과
    OT_LEGAL_LIMIT: 'OT_LEGAL_LIMIT',       // 법정 초과근무 52시간 초과
    BASE_PAY_BELOW_50: 'BASE_PAY_BELOW_50',    // 기본급 정상치 대비 50% 미만
    FIRST_PAYROLL: 'FIRST_PAYROLL',        // 신규입사자 첫 급여 (일할계산 확인)
    LAST_PAYROLL: 'LAST_PAYROLL',         // 퇴사자 마지막 급여 (일할계산 확인)
} as const

// ─── Settings 인터페이스 ─────────────────────────────────────

interface AnomalyThresholdSettings {
    momChangePercent: number       // 전월 대비 변동 기준 (기본 30%)
    momMinAmount: number           // 전월 대비 최소 금액 차이 (기본 50,000원)
    bandTolerance: number          // 급여 밴드 허용 오차 (기본 3%)
    monthlyOtLimit: number         // 월간 초과근무 한도 시간 (기본 52)
    prorateMinRatio: number        // 기본급 하한 일할 비율 (기본 20%)
}

const DEFAULT_THRESHOLDS: AnomalyThresholdSettings = {
    momChangePercent: 30,
    momMinAmount: 50_000,
    bandTolerance: 3,
    monthlyOtLimit: 52,
    prorateMinRatio: 20,
}

// ─── 허용 오차 (이중 필터: 금액 + 비율) ─────────────────────

function isWithinTolerance(
    currentValue: number,
    previousValue: number,
    percentThreshold: number = 30,
    amountThreshold: number = 50_000,
): boolean {
    const diff = Math.abs(currentValue - previousValue)
    if (diff < amountThreshold) return true
    const pctChange = previousValue > 0 ? (diff / previousValue) * 100 : 0
    return pctChange < percentThreshold
}

// ─── 메인 탐지 함수 ─────────────────────────────────────────

/**
 * PayrollRun에 속한 모든 직원에 대해 이상 규칙을 적용하고
 * PayrollAnomaly 레코드를 생성합니다.
 *
 * @param payrollRunId - 탐지 대상 PayrollRun ID
 * @returns 생성된 PayrollAnomaly 배열
 */
export async function detectAnomalies(
    payrollRunId: string,
): Promise<PayrollAnomaly[]> {
    // ── Fetch configurable thresholds from Settings ─────────────
    const settingsP = getPayrollSetting<AnomalyThresholdSettings>('anomaly-thresholds')
    const otSettingsP = getAttendanceSetting<{ weeklyCapHours: number }>('work-hour-limits')
    const [thresholdSettings, otSettings] = await Promise.all([settingsP, otSettingsP])
    const t: AnomalyThresholdSettings = {
        momChangePercent: thresholdSettings?.momChangePercent ?? DEFAULT_THRESHOLDS.momChangePercent,
        momMinAmount: thresholdSettings?.momMinAmount ?? DEFAULT_THRESHOLDS.momMinAmount,
        bandTolerance: thresholdSettings?.bandTolerance ?? DEFAULT_THRESHOLDS.bandTolerance,
        monthlyOtLimit: otSettings?.weeklyCapHours ?? thresholdSettings?.monthlyOtLimit ?? DEFAULT_THRESHOLDS.monthlyOtLimit,
        prorateMinRatio: thresholdSettings?.prorateMinRatio ?? DEFAULT_THRESHOLDS.prorateMinRatio,
    }

    // 1. 현재 PayrollRun + 모든 PayrollItem 조회
    const currentRun = await prisma.payrollRun.findUniqueOrThrow({
        where: { id: payrollRunId },
        include: {
            payrollItems: {
                include: {
                    employee: {
                        select: {
                            id: true,
                            name: true,
                            hireDate: true,
                            assignments: {
                                where: { isPrimary: true, endDate: null },
                                select: {
                                    jobGradeId: true,
                                    companyId: true,
                                },
                                take: 1,
                            },
                        },
                    },
                },
            },
        },
    })

    // 2. 전월 PayrollRun + Items 조회 (비교용)
    const prevRun = currentRun.previousMonthRunId
        ? await prisma.payrollRun.findUnique({
            where: { id: currentRun.previousMonthRunId },
            include: { payrollItems: { select: { employeeId: true, grossPay: true, netPay: true } } },
        })
        : null

    const prevItemMap = new Map(
        prevRun?.payrollItems.map((i) => [i.employeeId, i]) ?? []
    )

    // 3. SalaryBand 조회 (밴드 초과 확인용)
    const salaryBands = await prisma.salaryBand.findMany({
        where: {
            companyId: currentRun.companyId,
            effectiveTo: null, // 현재 유효한 밴드만
        },
    })

    // 4. 화이트리스트된 직원+규칙 조합 조회
    const whitelist = await prisma.payrollAnomaly.findMany({
        where: {
            whitelisted: true,
            employee: {
                assignments: {
                    some: { companyId: currentRun.companyId, isPrimary: true, endDate: null },
                },
            },
        },
        select: { employeeId: true, ruleCode: true },
    })

    const whitelistSet = new Set(whitelist.map((w) => `${w.employeeId}:${w.ruleCode}`))

    // 5. 기존 이상 항목 삭제 (재생성)
    await prisma.payrollAnomaly.deleteMany({
        where: { payrollRunId },
    })

    const anomaliesToCreate: Prisma.PayrollAnomalyCreateManyInput[] = []

    const currentYearMonth = currentRun.yearMonth
    const [yearStr, monthStr] = currentYearMonth.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)

    // 6. 각 직원에 대해 규칙 적용
    for (const item of currentRun.payrollItems) {
        const employeeId = item.employeeId
        const employee = item.employee
        const currentGross = Number(item.grossPay)
//         const currentNet = Number(item.netPay)
        const currentBase = Number(item.baseSalary)
        const prevItem = prevItemMap.get(employeeId)
        const assignment = extractPrimaryAssignment(employee.assignments ?? [])

        // ── Rule 1: 전월 대비 총지급액 ±30% 초과 ─────────────────
        const ruleCode1 = ANOMALY_RULES.MOM_CHANGE_30PCT
        if (prevItem && !whitelistSet.has(`${employeeId}:${ruleCode1}`)) {
            const prevGross = Number(prevItem.grossPay)
            if (!isWithinTolerance(currentGross, prevGross, t.momChangePercent, t.momMinAmount)) {
                const diff = currentGross - prevGross
                const pct = prevGross > 0 ? Math.round((Math.abs(diff) / prevGross) * 100) : 0
                anomaliesToCreate.push({
                    payrollRunId,
                    employeeId,
                    ruleCode: ruleCode1,
                    severity: 'WARNING',
                    description: `전월 대비 총지급액 ${pct}% ${diff >= 0 ? '증가' : '감소'} (${prevGross.toLocaleString()}원 → ${currentGross.toLocaleString()}원)`,
                    currentValue: currentGross,
                    previousValue: prevGross,
                    threshold: '30%',
                    status: 'OPEN',
                })
            }
        }

        // ── Rule 2: 급여 밴드 초과 ────────────────────────────────
        const ruleCode2 = ANOMALY_RULES.BAND_EXCEEDED
        if (assignment?.jobGradeId && !whitelistSet.has(`${employeeId}:${ruleCode2}`)) {
            const band = salaryBands.find((b) => b.jobGradeId === assignment.jobGradeId)
            if (band) {
                const annualBase = currentBase * 12
                const maxSalary = Number(band.maxSalary)
                const tolerance = maxSalary * (1 + t.bandTolerance / 100)
                if (annualBase > tolerance) {
                    anomaliesToCreate.push({
                        payrollRunId,
                        employeeId,
                        ruleCode: ruleCode2,
                        severity: 'WARNING',
                        description: `연간 기본급 환산(${annualBase.toLocaleString()}원)이 급여 밴드 상한(${maxSalary.toLocaleString()}원)을 초과`,
                        currentValue: annualBase,
                        previousValue: maxSalary,
                        threshold: `밴드 상한 + ${t.bandTolerance}%`,
                        status: 'OPEN',
                    })
                }
            }
        }

        // ── Rule 3: 초과근무 법정 한도 52시간 초과 ──────────────────
        const ruleCode3 = ANOMALY_RULES.OT_LEGAL_LIMIT
        if (!whitelistSet.has(`${employeeId}:${ruleCode3}`)) {
            const detail = item.detail as Record<string, unknown> | null
            if (detail?.overtime) {
                const ot = detail.overtime as Record<string, unknown>
                const totalOTHours = Number(ot.totalOvertimeHours ?? 0)
                const MONTHLY_OT_LIMIT = t.monthlyOtLimit
                if (totalOTHours > MONTHLY_OT_LIMIT) {
                    anomaliesToCreate.push({
                        payrollRunId,
                        employeeId,
                        ruleCode: ruleCode3,
                        severity: 'CRITICAL',
                        description: `월 초과근무 ${totalOTHours}시간 — 법정 한도 ${MONTHLY_OT_LIMIT}시간 초과`,
                        currentValue: totalOTHours,
                        previousValue: MONTHLY_OT_LIMIT,
                        threshold: `${MONTHLY_OT_LIMIT}h`,
                        status: 'OPEN',
                    })
                }
            }
        }

        // ── Rule 4: 기본급이 정상치 대비 50% 미만 ───────────────────
        const ruleCode4 = ANOMALY_RULES.BASE_PAY_BELOW_50
        if (!whitelistSet.has(`${employeeId}:${ruleCode4}`)) {
            const detail = item.detail as Record<string, unknown> | null
            // 일할계산이 적용된 경우만 체크
            if (detail?.isProrated) {
                const prorateRatio = Number(detail.prorateRatio ?? 1)
                // 일할계산 비율이 20% 미만이면 이상 (5일 이상 근무 기준)
                if (prorateRatio < t.prorateMinRatio / 100) {
                    anomaliesToCreate.push({
                        payrollRunId,
                        employeeId,
                        ruleCode: ruleCode4,
                        severity: 'WARNING',
                        description: `기본급 일할 비율 ${Math.round(prorateRatio * 100)}% — 매우 낮음 (근무일 부족 또는 무급휴가 과다)`,
                        currentValue: Math.round(prorateRatio * 100),
                        previousValue: 100,
                        threshold: `${t.prorateMinRatio}%`,
                        status: 'OPEN',
                    })
                }
            }
        }

        // ── Rule 5: 신규입사자 첫 급여 (정보성) ───────────────────
        const ruleCode5 = ANOMALY_RULES.FIRST_PAYROLL
        if (!whitelistSet.has(`${employeeId}:${ruleCode5}`) && employee.hireDate) {
            const hireDate = new Date(employee.hireDate)
            const hireYear = hireDate.getFullYear()
            const hireMonth = hireDate.getMonth() + 1
            // 이번 달이 입사 첫 달인지 확인
            if (hireYear === year && hireMonth === month) {
                anomaliesToCreate.push({
                    payrollRunId,
                    employeeId,
                    ruleCode: ruleCode5,
                    severity: 'INFO',
                    description: `신규입사자 첫 급여 — 일할계산 적용 여부를 확인하세요`,
                    currentValue: currentGross,
                    previousValue: null,
                    threshold: null,
                    status: 'OPEN',
                })
            }
        }

        // ── Rule 6: 퇴사자 마지막 급여 (정보성) ──────────────────
        const ruleCode6 = ANOMALY_RULES.LAST_PAYROLL
        if (!whitelistSet.has(`${employeeId}:${ruleCode6}`)) {
            // 잘 탐지하기 위해 퇴사 처리된 직원 확인
            const isOffboarding = await prisma.employeeOffboarding.findFirst({
                where: {
                    employeeId,
                    status: { in: ['IN_PROGRESS', 'COMPLETED'] },
                    lastWorkingDate: {
                        gte: new Date(year, month - 1, 1),
                        lte: new Date(year, month, 0),
                    },
                },
            })
            if (isOffboarding) {
                anomaliesToCreate.push({
                    payrollRunId,
                    employeeId,
                    ruleCode: ruleCode6,
                    severity: 'INFO',
                    description: `퇴사자 마지막 급여 — 일할계산 및 퇴직금 정산 여부를 확인하세요`,
                    currentValue: currentGross,
                    previousValue: prevItem ? Number(prevItem.grossPay) : null,
                    threshold: null,
                    status: 'OPEN',
                })
            }
        }
    }

    // 7. 이상 항목 일괄 생성
    if (anomaliesToCreate.length > 0) {
        await prisma.payrollAnomaly.createMany({
            data: anomaliesToCreate,
        })
    }

    // 8. 생성된 이상 항목 반환
    const created = await prisma.payrollAnomaly.findMany({
        where: { payrollRunId },
        orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }],
    })

    return created
}
