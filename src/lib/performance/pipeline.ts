// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Performance Pipeline State Machine
// src/lib/performance/pipeline.ts
//
// Central module for pipeline transitions + overdue processing
// Used by: advance/route.ts, cron/overdue-check, cron/auto-acknowledge
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: 7-step performance cycle state machine (DRAFT→CLOSED)
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════

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
    CALIBRATION: { ko: '피플세션(People Session)', en: 'People Session' },
    FINALIZED: { ko: '결과 확정', en: 'Finalized' },
    CLOSED: { ko: '결과 통보', en: 'Result Notification' },
    COMP_REVIEW: { ko: '보상 기획', en: 'Comp Review' },
    COMP_COMPLETED: { ko: '보상 완료', en: 'Comp Completed' },
}

// ─── Half-Aware Pipeline ────────────────────────────────
// H1 = 경량 (목표→평가→결과 통보)
// H2/ANNUAL = 풀 (목표→평가→결과 통보→피플세션→보상)

export const H1_PIPELINE: string[] = ['DRAFT', 'ACTIVE', 'EVAL_OPEN', 'CLOSED']
export const H2_PIPELINE: string[] = ['DRAFT', 'ACTIVE', 'EVAL_OPEN', 'CLOSED', 'CALIBRATION', 'COMP_REVIEW', 'COMP_COMPLETED']

/** half 값에 따른 파이프라인 단계 반환 */
export function getPipelineSteps(half: string): string[] {
    return half === 'H1' ? H1_PIPELINE : H2_PIPELINE
}

/** half 값을 고려한 다음 상태 반환 (null = 터미널) */
export function getNextStatus(current: string, half: string): CycleStatus | null {
    const pipeline = getPipelineSteps(half)
    const idx = pipeline.indexOf(current)
    if (idx === -1 || idx === pipeline.length - 1) return null
    return pipeline[idx + 1] as CycleStatus
}

/** 해당 상태가 파이프라인의 마지막인지 확인 */
export function isFinalStatus(status: string, half: string): boolean {
    const pipeline = getPipelineSteps(half)
    return pipeline[pipeline.length - 1] === status
}

/** 특정 기능 영역에서 허용되는 상태 목록 (half-aware) */
export function getAllowedStatuses(phase: string, half: string): string[] {
    const pipeline = getPipelineSteps(half)
    const all = new Set(pipeline)

    switch (phase) {
        case 'goals':       // 목표 관리 — ACTIVE 이후 전부
            return pipeline.filter((_, i) => i >= 1)
        case 'evaluation':  // 자기/상사 평가 — EVAL_OPEN 이후
            return pipeline.filter((_, i) => i >= pipeline.indexOf('EVAL_OPEN'))
        case 'result':      // 결과 열람 — CLOSED 이후 (isResultPublished로 추가 제어)
            return pipeline.filter((_, i) => i >= pipeline.indexOf('CLOSED'))
        case 'compensation': // 보상 — H2만, COMP_REVIEW 이후
            return all.has('COMP_REVIEW') ? ['COMP_REVIEW', 'COMP_COMPLETED'] : []
        case 'checkin':     // 체크인 — 독립 활동이지만 ACTIVE 이후
            return pipeline.filter((_, i) => i >= 1)
        default:
            return pipeline
    }
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
