// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Offboarding Completion Logic
// src/lib/offboarding/complete-offboarding.ts
//
// E-2: GP#2 Offboarding Pipeline
// Handles STEP 4: Final settlement + asset deduction + status update
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { conflict } from '@/lib/errors'
import { canDeductUnreturnedAsset, calculateDeductionAmount } from '@/lib/labor/asset-deduction'
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

    // 정산 컨텍스트 — tx 내부에서 확정해 반환, Phase B(tx 외부)에서 재사용.
    // assignment 마감(5b) 후 active-assignment 재조회 금지: compId='' → 퇴직금·최종급여 0 정산 버그.
    const settlement = await prisma.$transaction(async (tx) => {
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

        // 2d. 정산 법인 확정 + invariant — 정산 법인 = 소유 법인 (Codex Gate1 r4:
        //     오프보딩 시작 후 법인 이동 시 타법인 급여 데이터 기반 정산(노출) + 퇴직금
        //     3개월 윈도 과소계산 → 전 role(SUPER 포함) 완료 차단, 취소·재시작 유도.
        //     정산 무결성 invariant이지 권한 예외가 아님)
        const employeeId = offboarding.employeeId
        const lastWorkingDate = offboarding.lastWorkingDate
        const assignmentAtLwd = await tx.employeeAssignment.findFirst({
            where: {
                employeeId,
                isPrimary: true,
                effectiveDate: { lte: lastWorkingDate },
                OR: [{ endDate: null }, { endDate: { gte: lastWorkingDate } }],
            },
            orderBy: { effectiveDate: 'desc' },
            select: { companyId: true, company: { select: { countryCode: true } } },
        })
        if (offboarding.companyId && assignmentAtLwd && assignmentAtLwd.companyId !== offboarding.companyId) {
            throw conflict('오프보딩 시작 후 법인이 변경된 직원입니다. 오프보딩을 취소하고 현재 법인에서 재시작해 주세요.')
        }
        const settlementCompanyId = offboarding.companyId ?? assignmentAtLwd?.companyId ?? ''

        // 3. Handle unreturned assets
        const countryCode = assignmentAtLwd?.company?.countryCode ?? 'KR'
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
        //    (정산 법인 = 2d에서 확정한 settlementCompanyId)

        // 4a. Leave balance settlement (unused leave pay / negative leave deduction)
        //     SSOT = LeaveYearBalance. 레거시 EmployeeLeaveBalance는 런타임에 더 이상 기록되지 않으므로
        //     (웹 신청·승인은 LeaveYearBalance만 갱신) 정산이 stale 잔액을 읽지 않도록 신 테이블 사용.
        const currentYear = lastWorkingDate.getFullYear()
        // 정산 대상 = 연차(annual)만. 병가 등 비연차 유급휴가는 퇴사 미정산 (CEO 정책 2026-06-09).
        // (S271은 표시를 annual로 필터했으나 정산은 전타입 합산으로 남아 병가까지 과지급되던 버그 수정.)
        const leaveBalances = await tx.leaveYearBalance.findMany({
            where: { employeeId, year: currentYear, leaveTypeDef: { code: 'annual' } },
        })

        // Daily wage from latest compensation (tx 내부 조회)
        const latestComp = await tx.compensationHistory.findFirst({
            where: { employeeId, companyId: settlementCompanyId, effectiveDate: { lte: lastWorkingDate } },
            orderBy: { effectiveDate: 'desc' },
        })
        const annualSalary = latestComp ? Number(latestComp.newBaseSalary) : 0
        const dailyWage = annualSalary > 0 ? Math.round(annualSalary / 365) : 0

        let unusedLeaveDays = 0
        let negativeLeaveDays = 0
        for (const bal of leaveBalances) {
            // 정산 잔여 = entitled + carriedOver + adjusted - used (pending 제외: 기존 정산 동작 보존 —
            // 미승인 PENDING 신청을 미사용 연차로 과소지급하지 않음).
            const remaining =
                Number(bal.entitled) + Number(bal.carriedOver) + Number(bal.adjusted) - Number(bal.used)
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

        // 5b. Close the primary assignment — endDate=lastWorkingDate
        //     퇴사 완료 시 활성 assignment를 마감해야 active(endDate:null) 쿼리에서 제외됨.
        //     start route는 status(RESIGNED/TERMINATED)만 set하고 endDate는 열어둠 → 완료 시 마감.
        //     동일 where(isPrimary, endDate:null)로 start route와 정합.
        await tx.employeeAssignment.updateMany({
            where: { employeeId, isPrimary: true, endDate: null },
            data: { endDate: lastWorkingDate },
        })

        // 6. Mark all remaining PENDING/IN_PROGRESS tasks as SKIPPED (cleanup)
        await tx.employeeOffboardingTask.updateMany({
            where: {
                employeeOffboardingId: offboardingId,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
            data: { status: 'SKIPPED' },
        })

        return { settlementCompanyId, employeeId, lastWorkingDate }
    })

    // Settlement Phase B — 퇴직금 + 최종 급여 (tx 외부, 전역 prisma 사용)
    // ⚠️ calculateSeverance는 전역 prisma 인스턴스를 사용하므로 반드시 tx 밖에서 호출
    //    정산 법인 = tx 내부(2d)에서 확정한 settlementCompanyId. 5b가 assignment를 마감했으므로
    //    active-assignment 재조회는 금지 (compId='' → 퇴직금·최종급여 0 정산 버그였음).
    {
        const { settlementCompanyId, employeeId: empId, lastWorkingDate: lwDate } = settlement

        // Severance (퇴직금)
        try {
            const severance = await calculateSeverance(empId, lwDate, settlementCompanyId)
            settlementItems.push({
                type: 'SEVERANCE',
                amount: severance.isEligible ? severance.netSeverancePay : 0,
                note: severance.isEligible
                    ? `퇴직금 ${severance.severancePay.toLocaleString()}원 (세후 ${severance.netSeverancePay.toLocaleString()}원, 재직 ${severance.tenureYears}년)`
                    : `퇴직금 미대상 — ${severance.ineligibleReason ?? `재직 ${severance.tenureDays}일 < 365일`}`,
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
            where: { employeeId: empId, companyId: settlementCompanyId, effectiveDate: { lte: lwDate } },
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
