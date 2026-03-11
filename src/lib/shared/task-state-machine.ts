// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Task Status State Machine (Shared)
// src/lib/shared/task-state-machine.ts
//
// 공유 상태 머신: 온보딩 + (향후) 오프보딩 태스크에 적용
// E-1: GP#2 Onboarding Pipeline
//
// Valid Transitions:
//   PENDING     → IN_PROGRESS
//   PENDING     → BLOCKED (reason required)
//   PENDING     → SKIPPED (non-required tasks only)
//   IN_PROGRESS → DONE
//   IN_PROGRESS → BLOCKED (reason required)
//   BLOCKED     → PENDING (unblock)
//   BLOCKED     → IN_PROGRESS (unblock + resume)
//   DONE / SKIPPED → terminal (no further transitions)
// ═══════════════════════════════════════════════════════════

import type { TaskProgressStatus } from '@/generated/prisma/client'

// ─── Types ────────────────────────────────────────────────

export interface TransitionInput {
    currentStatus: TaskProgressStatus
    targetStatus: TaskProgressStatus
    isRequired: boolean
    blockedReason?: string
}

export interface TransitionResult {
    allowed: boolean
    error?: string
}

// ─── Allowed Transitions Map ──────────────────────────────

const TRANSITIONS: Record<TaskProgressStatus, TaskProgressStatus[]> = {
    PENDING: ['IN_PROGRESS', 'BLOCKED', 'SKIPPED'],
    IN_PROGRESS: ['DONE', 'BLOCKED'],
    BLOCKED: ['PENDING', 'IN_PROGRESS'],
    DONE: [],      // terminal
    SKIPPED: [],      // terminal
}

// ─── Core Validator ───────────────────────────────────────

export function validateTaskTransition(input: TransitionInput): TransitionResult {
    const { currentStatus, targetStatus, isRequired, blockedReason } = input

    // Terminal state check
    if (currentStatus === 'DONE' || currentStatus === 'SKIPPED') {
        return { allowed: false, error: `${currentStatus} is a terminal state — no further transitions allowed.` }
    }

    // Transition allowed check
    const allowed = TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes(targetStatus)) {
        return { allowed: false, error: `Transition ${currentStatus} → ${targetStatus} is not allowed.` }
    }

    // SKIPPED only for non-required tasks
    if (targetStatus === 'SKIPPED' && isRequired) {
        return { allowed: false, error: 'Required tasks cannot be skipped.' }
    }

    // BLOCKED requires reason
    if (targetStatus === 'BLOCKED' && !blockedReason?.trim()) {
        return { allowed: false, error: 'blockedReason is required when setting status to BLOCKED.' }
    }

    return { allowed: true }
}

// ─── Helpers ──────────────────────────────────────────────

export function canSkip(isRequired: boolean): boolean {
    return !isRequired
}

export function requiresBlockedReason(targetStatus: TaskProgressStatus): boolean {
    return targetStatus === 'BLOCKED'
}

/**
 * BLOCKED tasks have their own nudge rules — never send overdue nudge to a blocked task.
 * Only PENDING and IN_PROGRESS tasks are eligible for standard overdue nudges.
 * BLOCKED tasks trigger separate 'Blocked Duration' alerts (2-day threshold per spec P0-2).
 */
export function isNudgeEligible(status: TaskProgressStatus): boolean {
    // BLOCKED tasks have their own nudge rules — never send overdue nudge to a blocked task
    return status === 'PENDING' || status === 'IN_PROGRESS'
}

/**
 * Check if a status is terminal (no further transitions possible).
 */
export function isTerminalStatus(status: TaskProgressStatus): boolean {
    return status === 'DONE' || status === 'SKIPPED'
}
