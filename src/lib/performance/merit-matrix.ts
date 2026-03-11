// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Merit Matrix Utility
// src/lib/performance/merit-matrix.ts
//
// Design Decision #15: Grade × Comparatio Band → Merit %
// Design Decision #18: Soft Warning (exceptions allowed)
// ═══════════════════════════════════════════════════════════

import type { PrismaClient } from '@/generated/prisma/client'

export interface MeritRecommendation {
    meritMinPct: number
    meritMaxPct: number
    meritRecommendedPct: number
    comparatioBand: 'LOW' | 'MID' | 'HIGH'
    isException: boolean
}

// Settings-connected: comparatio thresholds (defaults below)
const COMPARATIO_LOW_THRESHOLD = 0.9
const COMPARATIO_HIGH_THRESHOLD = 1.1

/**
 * Calculate comparatio band from salary ratio.
 * GEMINI FIX #3: Division by zero → default to 1.0 (MID band).
 */
export function getComparatioBand(comparatio: number): 'LOW' | 'MID' | 'HIGH' {
    if (comparatio < COMPARATIO_LOW_THRESHOLD) return 'LOW'
    if (comparatio > COMPARATIO_HIGH_THRESHOLD) return 'HIGH'
    return 'MID'
}

/**
 * Calculate comparatio safely.
 * GEMINI FIX #3: If midpoint is 0/null → default to 1.0.
 */
export function calculateComparatio(currentSalary: number, midpointSalary: number | null): number {
    if (!midpointSalary || midpointSalary <= 0) return 1.0
    return Math.round((currentSalary / midpointSalary) * 100) / 100
}

/**
 * Look up merit recommendation from SalaryAdjustmentMatrix.
 * Falls back to default 0% if no matrix row found.
 */
export async function getMeritRecommendation(
    grade: string,
    comparatio: number,
    companyId: string,
    prisma: PrismaClient,
): Promise<MeritRecommendation> {
    const band = getComparatioBand(comparatio)

    const matrixRow = await prisma.salaryAdjustmentMatrix.findFirst({
        where: {
            companyId,
            gradeKey: grade,
            comparatioBand: band,
        },
        select: {
            meritMinPct: true,
            meritMaxPct: true,
            meritRecommendedPct: true,
        },
    })

    if (!matrixRow) {
        return {
            meritMinPct: 0,
            meritMaxPct: 0,
            meritRecommendedPct: 0,
            comparatioBand: band,
            isException: false,
        }
    }

    return {
        meritMinPct: Number(matrixRow.meritMinPct ?? 0),
        meritMaxPct: Number(matrixRow.meritMaxPct ?? 0),
        meritRecommendedPct: Number(matrixRow.meritRecommendedPct ?? 0),
        comparatioBand: band,
        isException: false,
    }
}

/**
 * Check if applied percentage is within matrix range.
 * Design Decision #18: Soft Warning — exceptions allowed with reason.
 */
export function checkMeritException(
    appliedPct: number,
    minPct: number,
    maxPct: number,
): { isException: boolean; direction: 'ABOVE_MAX' | 'BELOW_MIN' | 'WITHIN' } {
    if (appliedPct > maxPct) return { isException: true, direction: 'ABOVE_MAX' }
    if (appliedPct < minPct) return { isException: true, direction: 'BELOW_MIN' }
    return { isException: false, direction: 'WITHIN' }
}

/**
 * Get an employee's current base salary from the latest CompensationHistory record.
 * Falls back to 0 if no comp history exists.
 */
export async function getCurrentSalary(
    employeeId: string,
    companyId: string,
    prisma: PrismaClient,
): Promise<{ salary: number; currency: string }> {
    const latest = await prisma.compensationHistory.findFirst({
        where: { employeeId, companyId },
        orderBy: { effectiveDate: 'desc' },
        select: { newBaseSalary: true, currency: true },
    })

    if (latest) return { salary: Number(latest.newBaseSalary), currency: latest.currency }

    // Fallback: check latest PayrollItem
    const latestPayroll = await prisma.payrollItem.findFirst({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        select: { baseSalary: true },
    })

    return {
        salary: latestPayroll ? Number(latestPayroll.baseSalary) : 0,
        currency: 'KRW',
    }
}

/**
 * Get salary band midpoint for an employee's job grade.
 * Returns null if no band exists.
 */
export async function getSalaryBandMidpoint(
    jobGradeId: string | null,
    companyId: string,
    prisma: PrismaClient,
): Promise<number | null> {
    if (!jobGradeId) return null

    const band = await prisma.salaryBand.findFirst({
        where: {
            companyId,
            jobGradeId,
            effectiveTo: null, // current band
        },
        select: { midSalary: true },
    })

    return band ? Number(band.midSalary) : null
}
