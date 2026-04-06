// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Data Masking Utility
// src/lib/performance/data-masking.ts
//
// Controls what each viewer role can see in performance data.
// Design Decision #17: Employee ONLY sees finalGrade.
// ═══════════════════════════════════════════════════════════

export type ViewerRole = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'EXECUTIVE'

// ─── Determine viewer role ──────────────────────────────

export function determineViewerRole(
    userEmployeeId: string,
    reviewEmployeeId: string,
    userRole: string,
    isManager: boolean,
): ViewerRole {
    if (userRole === 'SUPER_ADMIN' || userRole === 'HR_ADMIN') return 'HR_ADMIN'
    if (userRole === 'EXECUTIVE') return 'EXECUTIVE'
    if (isManager) return 'MANAGER'
    if (userEmployeeId === reviewEmployeeId) return 'EMPLOYEE'
    return 'EMPLOYEE'
}

// ─── Mask PerformanceReview for viewer ──────────────────

export interface ReviewForMasking {
    originalGrade?: string | null
    finalGrade?: string | null
    calibrationNote?: string | null
    overdueFlags?: unknown
    notifiedAt?: Date | string | null
    notifiedBy?: string | null
    acknowledgedAt?: Date | string | null
    isAutoAcknowledged?: boolean
    mboScore?: unknown
    beiScore?: unknown
    totalScore?: unknown
    [key: string]: unknown
}

export function maskPerformanceReview<T extends ReviewForMasking>(
    review: T,
    viewerRole: ViewerRole,
): T {
    if (viewerRole === 'HR_ADMIN' || viewerRole === 'EXECUTIVE') {
        // Full access — everything visible
        return review
    }

    if (viewerRole === 'MANAGER') {
        // Manager sees both grades + overdue flags, but NOT calibration reasons
        return {
            ...review,
            calibrationNote: undefined,
        }
    }

    // EMPLOYEE: most restricted
    return {
        ...review,
        originalGrade: undefined,  // HIDDEN — employee never sees original
        calibrationNote: undefined,
        overdueFlags: undefined,   // HIDDEN — employee doesn't see their own flags
        notifiedBy: undefined,
    }
}

// ─── Mask Peer Review for viewer ────────────────────────

export interface PeerReviewForMasking {
    reviewerName?: string
    reviewerDepartment?: string
    submittedAt?: Date | string | null
    scoreChallenge: number
    scoreTrust: number
    scoreResponsibility: number
    scoreRespect: number
    overallComment: string
}

/**
 * Deterministic shuffle using seed string.
 * Ensures consistent ordering per (cycleId + employeeId) so the order
 * is stable across requests but uncorrelated with DB or submission order.
 *
 * GEMINI FIX #3: Prevents reviewer identification by position/timing.
 */
function deterministicShuffle<T>(arr: T[], seed: string): T[] {
    const result = [...arr]
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
    }

    for (let i = result.length - 1; i > 0; i--) {
        hash = ((hash << 5) - hash + i) | 0
        const j = Math.abs(hash) % (i + 1);
        [result[i], result[j]] = [result[j], result[i]]
    }

    return result
}

export function maskPeerReviews(
    reviews: PeerReviewForMasking[],
    viewerRole: ViewerRole,
    cycleId: string,
    employeeId: string,
): (PeerReviewForMasking & { reviewerLabel?: string })[] {
    if (viewerRole === 'MANAGER' || viewerRole === 'HR_ADMIN' || viewerRole === 'EXECUTIVE') {
        // Manager/HR sees reviewer names
        return reviews
    }

    // EMPLOYEE view: shuffle + anonymize
    const shuffled = deterministicShuffle(reviews, `${cycleId}:${employeeId}`)

    return shuffled.map((review, index) => ({
        scoreChallenge: review.scoreChallenge,
        scoreTrust: review.scoreTrust,
        scoreResponsibility: review.scoreResponsibility,
        scoreRespect: review.scoreRespect,
        overallComment: review.overallComment,
        reviewerLabel: `평가자 ${index + 1}`,
        // NO reviewerName, NO reviewerDepartment, NO submittedAt
    }))
}

// ─── Mask Cycle for Employee ────────────────────────────
// EMPLOYEE must never see COMP_REVIEW / COMP_COMPLETED status.
// Also provides isResultPublished to prevent premature result rendering
// when maskedStatus=CLOSED but actual status is still in comp review.

const HIDDEN_CYCLE_STATUSES = new Set(['COMP_REVIEW', 'COMP_COMPLETED'])

export interface CycleForMasking {
    status: string
    [key: string]: unknown
}

export function maskCycleForEmployee<T extends CycleForMasking>(
    cycle: T,
): T & { isResultPublished: boolean } {
    if (HIDDEN_CYCLE_STATUSES.has(cycle.status)) {
        return { ...cycle, status: 'CLOSED', isResultPublished: false }
    }
    return { ...cycle, isResultPublished: cycle.status === 'CLOSED' || cycle.status === 'COMP_COMPLETED' }
}

// ─── Grade Label Mapping ────────────────────────────────

// Settings-connected: grade labels per company (defaults below)
export const GRADE_LABELS: Record<string, { ko: string; en: string }> = {
    O: { ko: '탁월(Outstanding)', en: 'Outstanding' },
    E: { ko: '우수(Exceeds)', en: 'Exceeds Expectations' },
    M: { ko: '보통(Meets)', en: 'Meets Expectations' },
    S: { ko: '미흡(Sufficient)', en: 'Sufficient' },
}

export function getGradeLabel(gradeCode: string | null | undefined, lang: 'ko' | 'en' = 'ko'): string {
    if (!gradeCode) return ''
    return GRADE_LABELS[gradeCode]?.[lang] ?? gradeCode
}
