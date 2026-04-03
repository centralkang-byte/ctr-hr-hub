// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Offboarding Completion Logic
// src/lib/offboarding/complete-offboarding.ts
//
// E-2: GP#2 Offboarding Pipeline
// Handles STEP 4: Final settlement + asset deduction + status update
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { canDeductUnreturnedAsset, calculateDeductionAmount } from '@/lib/labor/asset-deduction'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { calculateSeverance } from '@/lib/payroll/severance'
import { differenceInDays, startOfMonth } from 'date-fns'

export interface SettlementItem {
    type: string
    amount: number
    note: string
}

export interface AssetDeductionResult {
    assetId: string
    assetName: string
    action: 'DEDUCTED' | 'CIVIL_CLAIM'
    deductionAmount: number
    reason?: string
}

export async function executeOffboardingCompletion(offboardingId: string): Promise<{
    status: 'COMPLETED'
    settlementItems: SettlementItem[]
    assetDeductions: AssetDeductionResult[]
}> {
    const assetDeductions: AssetDeductionResult[] = []
    const settlementItems: SettlementItem[] = []

    await prisma.$transaction(async (tx) => {
        // 1. Fetch offboarding with all tasks + assets
        const offboarding = await tx.employeeOffboarding.findUnique({
            where: { id: offboardingId },
            include: {
                offboardingTasks: { include: { task: true } },
                assetReturns: true,
                employee: {
                    select: {
                        id: true,
                        hireDate: true,
                        assignments: {
                            where: { isPrimary: true, endDate: null },
                            select: {
                                companyId: true,
                                company: { select: { countryCode: true } },
                            },
                            take: 1,
                        },
                    },
                },
            },
        })

        if (!offboarding) throw new Error('Offboarding not found')

        // 2. Verify all required tasks are DONE
        const requiredTasks = offboarding.offboardingTasks.filter((t) => t.task.isRequired)
        const allRequiredDone = requiredTasks.every((t) => t.status === 'DONE')
        if (!allRequiredDone) {
            const pendingTasks = requiredTasks
                .filter((t) => t.status !== 'DONE')
                .map((t) => t.task.title)
            throw new Error(`필수 태스크 미완료: ${pendingTasks.join(', ')}`)
        }

        // 2a. GATE: IT 계정 비활성화 확인
        if (!offboarding.isItAccountDeactivated) {
            throw new Error('IT 계정 비활성화가 완료되지 않았습니다. IT 담당자에게 확인하세요.')
        }

        // 2b. GATE: 퇴직면담 완료 확인
        if (!offboarding.isExitInterviewCompleted) {
            throw new Error('퇴직면담이 완료되지 않았습니다. HR 담당자가 면담을 진행해주세요.')
        }

        // 2c. GATE: 인수인계 확인 (인수자가 지정된 경우)
        if (offboarding.handoverToId) {
            const handoverTasks = offboarding.offboardingTasks.filter(
                (t) => t.assigneeId === offboarding.handoverToId && t.task.isRequired,
            )
            const allHandoverDone = handoverTasks.length === 0 || handoverTasks.every((t) => t.status === 'DONE')
            if (!allHandoverDone) {
                const pendingHandover = handoverTasks
                    .filter((t) => t.status !== 'DONE')
                    .map((t) => t.task.title)
                throw new Error(`인수인계 태스크 미완료: ${pendingHandover.join(', ')}`)
            }
        }

        // 3. Handle unreturned assets
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const countryCode = (extractPrimaryAssignment(offboarding.employee?.assignments ?? []) as any)?.company?.countryCode ?? 'KR'
        const unreturnedAssets = offboarding.assetReturns.filter((a) => a.status === 'PENDING' || a.status === 'UNRETURNED')

        for (const asset of unreturnedAssets) {
            const residualValue = asset.residualValue ? Number(asset.residualValue) : 0

            if (residualValue <= 0) {
                // No value to deduct
                await tx.assetReturn.update({
                    where: { id: asset.id },
                    data: { status: 'UNRETURNED' },
                })
                continue
            }

            const check = canDeductUnreturnedAsset(
                countryCode,
                asset.consentDocExists,
                residualValue,
            )

            if (check.canDeduct) {
                const deductionAmount = calculateDeductionAmount(check, residualValue)
                await tx.assetReturn.update({
                    where: { id: asset.id },
                    data: {
                        status: 'DEDUCTED',
                        isDeductionApproved: true,
                        deductionAmount: deductionAmount,
                    },
                })
                assetDeductions.push({
                    assetId: asset.id,
                    assetName: asset.assetName,
                    action: 'DEDUCTED',
                    deductionAmount,
                })
                // NOTE: PayrollAdjustment requires payrollRunId
                // Asset deduction will be applied in next payroll run (GP#3 territory)
                // For now, the AssetReturn.status=DEDUCTED serves as the flag
            } else {
                await tx.assetReturn.update({
                    where: { id: asset.id },
                    data: { status: 'CIVIL_CLAIM' },
                })
                assetDeductions.push({
                    assetId: asset.id,
                    assetName: asset.assetName,
                    action: 'CIVIL_CLAIM',
                    deductionAmount: 0,
                    reason: check.reason,
                })
                // Phase 4: sendNotification({ type: 'CIVIL_CLAIM_REQUIRED', ... }) 연동 예정
            }
        }

        // 4. Settlement Phase A — 연차 잔여분 + 보상 이력 조회 (tx 내부)
        const employeeId = offboarding.employee!.id
        const lastWorkingDate = offboarding.lastWorkingDate
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const companyIdForSettlement = (extractPrimaryAssignment(offboarding.employee!.assignments ?? []) as any)?.companyId ?? ''

        // 4a. Leave balance settlement (unused leave pay / negative leave deduction)
        const currentYear = lastWorkingDate.getFullYear()
        const leaveBalances = await tx.employeeLeaveBalance.findMany({
            where: { employeeId, year: currentYear },
        })

        // Daily wage from latest compensation (tx 내부 조회)
        const latestComp = await tx.compensationHistory.findFirst({
            where: { employeeId, companyId: companyIdForSettlement, effectiveDate: { lte: lastWorkingDate } },
            orderBy: { effectiveDate: 'desc' },
        })
        const annualSalary = latestComp ? Number(latestComp.newBaseSalary) : 0
        const dailyWage = annualSalary > 0 ? Math.round(annualSalary / 365) : 0

        let unusedLeaveDays = 0
        let negativeLeaveDays = 0
        for (const bal of leaveBalances) {
            const granted = Number(bal.grantedDays) + Number(bal.carryOverDays)
            const used = Number(bal.usedDays)
            const remaining = granted - used
            if (remaining > 0) {
                unusedLeaveDays += remaining
            } else if (remaining < 0) {
                negativeLeaveDays += Math.abs(remaining)
            }
        }

        settlementItems.push({
            type: 'UNUSED_LEAVE',
            amount: unusedLeaveDays * dailyWage,
            note: `미사용 연차 ${unusedLeaveDays}일 × 일급 ${dailyWage.toLocaleString()}원`,
        })

        if (negativeLeaveDays > 0) {
            settlementItems.push({
                type: 'NEGATIVE_LEAVE',
                amount: -(negativeLeaveDays * dailyWage),
                note: `초과사용 연차 ${negativeLeaveDays}일 × 일급 ${dailyWage.toLocaleString()}원 (공제)`,
            })
        }

        // 4d. Insurance loss (4대보험 상실) — flag only, actual filing is external
        settlementItems.push({
            type: 'INSURANCE_LOSS',
            amount: 0,
            note: '4대보험 상실신고 필요 (외부 처리)',
        })

        // 5. Update offboarding status to COMPLETED
        await tx.employeeOffboarding.update({
            where: { id: offboardingId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
            },
        })

        // 6. Mark all remaining PENDING/IN_PROGRESS tasks as SKIPPED (cleanup)
        await tx.employeeOffboardingTask.updateMany({
            where: {
                employeeOffboardingId: offboardingId,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
            data: { status: 'SKIPPED' },
        })
    })

    // Settlement Phase B — 퇴직금 + 최종 급여 (tx 외부, 전역 prisma 사용)
    // ⚠️ calculateSeverance는 전역 prisma 인스턴스를 사용하므로 반드시 tx 밖에서 호출
    const offboardingData = await prisma.employeeOffboarding.findUnique({
        where: { id: offboardingId },
        select: {
            lastWorkingDate: true,
            employee: {
                select: {
                    id: true,
                    assignments: {
                        where: { isPrimary: true, endDate: null },
                        select: { companyId: true },
                        take: 1,
                    },
                },
            },
        },
    })

    if (offboardingData?.employee) {
        const empId = offboardingData.employee.id
        const lwDate = offboardingData.lastWorkingDate
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const compId = (extractPrimaryAssignment(offboardingData.employee.assignments ?? []) as any)?.companyId ?? ''

        // Severance (퇴직금)
        try {
            const severance = await calculateSeverance(empId, lwDate)
            settlementItems.push({
                type: 'SEVERANCE',
                amount: severance.isEligible ? severance.netSeverancePay : 0,
                note: severance.isEligible
                    ? `퇴직금 ${severance.severancePay.toLocaleString()}원 (세후 ${severance.netSeverancePay.toLocaleString()}원, 재직 ${severance.tenureYears}년)`
                    : `퇴직금 미대상 (재직 ${severance.tenureDays}일 < 365일)`,
            })
        } catch {
            settlementItems.push({
                type: 'SEVERANCE',
                amount: 0,
                note: '퇴직금 산출 불가 (급여 데이터 부족)',
            })
        }

        // Final salary pro-rata (최종 급여 일할 계산)
        const latestCompPhaseB = await prisma.compensationHistory.findFirst({
            where: { employeeId: empId, companyId: compId, effectiveDate: { lte: lwDate } },
            orderBy: { effectiveDate: 'desc' },
        })
        const annualSalaryB = latestCompPhaseB ? Number(latestCompPhaseB.newBaseSalary) : 0
        const monthStart = startOfMonth(lwDate)
        const workedDaysInMonth = differenceInDays(lwDate, monthStart) + 1
        const daysInMonth = new Date(lwDate.getFullYear(), lwDate.getMonth() + 1, 0).getDate()
        const monthlySalary = annualSalaryB > 0 ? Math.round(annualSalaryB / 12) : 0
        const proRataSalary = Math.round(monthlySalary * (workedDaysInMonth / daysInMonth))

        settlementItems.push({
            type: 'FINAL_SALARY',
            amount: proRataSalary,
            note: `최종월 일할 급여: ${workedDaysInMonth}/${daysInMonth}일 × 월급 ${monthlySalary.toLocaleString()}원`,
        })
    }

    return {
        status: 'COMPLETED',
        settlementItems,
        assetDeductions,
    }
}
