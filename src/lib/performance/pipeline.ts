// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Performance Pipeline State Machine
// src/lib/performance/pipeline.ts
//
// Central module for pipeline transitions + overdue processing
// Used by: advance/route.ts, cron/overdue-check, cron/auto-acknowledge
// ═══════════════════════════════════════════════════════════

import type { CycleStatus } from '@/generated/prisma/client'

// ─── 9-State Transition Map ──────────────────────────────
// Uses existing enum names (DRAFT/ACTIVE/EVAL_OPEN) — NOT renamed.
// See Session A: Append-Only Enum strategy.

export const TRANSITIONS: Record<string, CycleStatus> = {
    DRAFT: 'ACTIVE' as CycleStatus,         // Setup → Goal Setting
    ACTIVE: 'CHECK_IN' as CycleStatus,       // Goal Setting → Check-in
    CHECK_IN: 'EVAL_OPEN' as CycleStatus,      // Check-in → Evaluation
    EVAL_OPEN: 'CALIBRATION' as CycleStatus,    // Evaluation → Calibration
    CALIBRATION: 'FINALIZED' as CycleStatus,       // Calibration → Finalized
    FINALIZED: 'CLOSED' as CycleStatus,          // Finalized → Closed (results)
    CLOSED: 'COMP_REVIEW' as CycleStatus,     // Closed → Comp Review
    COMP_REVIEW: 'COMP_COMPLETED' as CycleStatus,  // Comp Review → Comp Completed
    // COMP_COMPLETED is terminal — no further transition
}

// ─── UI Display labels ───────────────────────────────────
export const CYCLE_STATUS_LABELS: Record<string, { ko: string; en: string }> = {
    DRAFT: { ko: '개시(Setup)', en: 'Setup' },
    ACTIVE: { ko: '목표설정(Goal Setting)', en: 'Goal Setting' },
    CHECK_IN: { ko: '중간 체크인', en: 'Check-in' },
    EVAL_OPEN: { ko: '평가 실시', en: 'Evaluation' },
    CALIBRATION: { ko: '캘리브레이션', en: 'Calibration' },
    FINALIZED: { ko: '결과 확정', en: 'Finalized' },
    CLOSED: { ko: '결과 통보', en: 'Result Notification' },
    COMP_REVIEW: { ko: '보상 기획', en: 'Comp Review' },
    COMP_COMPLETED: { ko: '보상 완료', en: 'Comp Completed' },
}

// ─── Overdue Flag Helpers ────────────────────────────────

export type OverdueFlag =
    | `GOAL_LATE_${number}D`
    | 'CHECKIN_MISSING'
    | `SELF_EVAL_LATE_${number}D`
    | `MANAGER_EVAL_LATE_${number}D`

/** Add flag to existing overdue flags array (dedup) */
export function addOverdueFlag(existing: unknown, newFlag: string): string[] {
    const flags = Array.isArray(existing) ? existing as string[] : []
    if (flags.includes(newFlag)) return flags
    return [...flags, newFlag]
}

/** Calculate days since a deadline */
export function daysSinceDeadline(deadlineDate: Date, now: Date = new Date()): number {
    return Math.max(0, Math.floor((now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24)))
}

// Settings-connected: auto-acknowledge window (default: 168 hours = 7 days)
export const AUTO_ACKNOWLEDGE_HOURS = 168

/** Check if a notification has expired (168 hours = 7 days, timezone-safe) */
export function isAutoAcknowledgeExpired(notifiedAt: Date, now: Date = new Date()): boolean {
    const hoursSince = (now.getTime() - notifiedAt.getTime()) / (1000 * 60 * 60)
    return hoursSince >= AUTO_ACKNOWLEDGE_HOURS
}

// ─── Overdue Description Formatter ───────────────────────

export function formatOverdueBadge(flags: string[]): string {
    if (!flags || flags.length === 0) return ''

    const parts: string[] = []
    for (const flag of flags) {
        if (flag.startsWith('GOAL_LATE_')) {
            const days = flag.replace('GOAL_LATE_', '').replace('D', '')
            parts.push(`목표 ${days}일 지연`)
        } else if (flag === 'CHECKIN_MISSING') {
            parts.push('체크인 미완료')
        } else if (flag.startsWith('SELF_EVAL_LATE_')) {
            const days = flag.replace('SELF_EVAL_LATE_', '').replace('D', '')
            parts.push(`자기평가 ${days}일 지연`)
        } else if (flag.startsWith('MANAGER_EVAL_LATE_')) {
            const days = flag.replace('MANAGER_EVAL_LATE_', '').replace('D', '')
            parts.push(`상사평가 ${days}일 지연`)
        }
    }

    return parts.length > 0 ? `🚨 ${parts.join(' · ')}` : ''
}
