// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Offboarding Completion Logic
// src/lib/offboarding/complete-offboarding.ts
//
// E-2: GP#2 Offboarding Pipeline
// Handles STEP 4: Final settlement + asset deduction + status update
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { canDeductUnreturnedAsset, calculateDeductionAmount } from '@/lib/labor/asset-deduction'

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
            throw new Error('Not all required tasks are completed')
        }

        // 3. Handle unreturned assets
        const countryCode = offboarding.employee?.assignments?.[0]?.company?.countryCode ?? 'KR'
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
                        deductionApproved: true,
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
                // TODO: Create notification for HR "민사 청구 필요"
            }
        }

        // 4. Settlement items (placeholder — actual calculation is GP#1/GP#3 territory)
        settlementItems.push(
            { type: 'UNUSED_LEAVE', amount: 0, note: 'TODO: 미사용 연차 수당 (GP#1 balance × daily wage)' },
            { type: 'NEGATIVE_LEAVE', amount: 0, note: 'TODO: 마이너스 연차 공제 (if applicable)' },
            { type: 'SEVERANCE', amount: 0, note: 'TODO: 퇴직금 (KR: 30일 × avg wage × years/365, if tenure ≥ 1yr)' },
            { type: 'FINAL_SALARY', amount: 0, note: 'TODO: 최종 급여 일할 계산' },
            { type: 'INSURANCE_LOSS', amount: 0, note: 'TODO: 4대보험 상실 처리' },
        )

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

    return {
        status: 'COMPLETED',
        settlementItems,
        assetDeductions,
    }
}
