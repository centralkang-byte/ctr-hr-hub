// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Milestone Helpers
// src/lib/onboarding/milestone-helpers.ts
//
// E-1: Milestone enum utilities for task grouping, progress,
// and checkin milestone resolution.
// ═══════════════════════════════════════════════════════════

import type { OnboardingMilestone, TaskProgressStatus } from '@/generated/prisma/client'

// ─── Milestone from dueDays ───────────────────────────────

export function getMilestoneFromDueDays(dueDays: number): OnboardingMilestone {
    if (dueDays <= 1) return 'DAY_1'
    if (dueDays <= 7) return 'DAY_7'
    if (dueDays <= 30) return 'DAY_30'
    return 'DAY_90'
}

// ─── Milestone Labels ─────────────────────────────────────

const MILESTONE_LABELS: Record<OnboardingMilestone, { ko: string; en: string }> = {
    DAY_1: { ko: 'Day 1 · 첫날', en: 'Day 1 · First Day' },
    DAY_7: { ko: 'Day 7 · 1주차', en: 'Day 7 · Week 1' },
    DAY_30: { ko: 'Day 30 · 1개월', en: 'Day 30 · Month 1' },
    DAY_90: { ko: 'Day 90 · 3개월', en: 'Day 90 · Month 3' },
}

export function getMilestoneLabel(milestone: OnboardingMilestone, lang: 'ko' | 'en' = 'ko'): string {
    return MILESTONE_LABELS[milestone]?.[lang] ?? milestone
}

// ─── Milestone Order (for sorting) ────────────────────────

const MILESTONE_ORDER: Record<OnboardingMilestone, number> = {
    DAY_1: 0, DAY_7: 1, DAY_30: 2, DAY_90: 3,
}

export function getMilestoneOrder(milestone: OnboardingMilestone): number {
    return MILESTONE_ORDER[milestone] ?? 99
}

// ─── Group Tasks by Milestone ─────────────────────────────

export interface TaskWithDueDate {
    id: string
    status: TaskProgressStatus
    dueDate?: Date | string | null
    task?: { dueDaysAfter?: number; isRequired?: boolean;[key: string]: unknown }
    [key: string]: unknown
}

export function groupTasksByMilestone<T extends TaskWithDueDate>(
    tasks: T[],
    hireDate?: Date | string | null,
): Map<OnboardingMilestone, T[]> {
    const grouped = new Map<OnboardingMilestone, T[]>()

    // Initialize all milestones
    const milestones: OnboardingMilestone[] = ['DAY_1', 'DAY_7', 'DAY_30', 'DAY_90']
    for (const m of milestones) grouped.set(m, [])

    for (const task of tasks) {
        let dueDays: number | undefined

        // Try to compute due days from task template
        if (task.task?.dueDaysAfter != null) {
            dueDays = task.task.dueDaysAfter
        } else if (task.dueDate && hireDate) {
            // Compute from dueDate - hireDate
            const due = new Date(task.dueDate).getTime()
            const hire = new Date(hireDate).getTime()
            dueDays = Math.max(0, Math.round((due - hire) / (1000 * 60 * 60 * 24)))
        }

        const milestone = getMilestoneFromDueDays(dueDays ?? 1)
        const list = grouped.get(milestone) ?? []
        list.push(task)
        grouped.set(milestone, list)
    }

    return grouped
}

// ─── Progress Calculation ─────────────────────────────────

export interface ProgressResult {
    total: number
    done: number
    blocked: number
    inProgress: number
    pending: number
    skipped: number
    percentage: number
}

export function calculateProgress(tasks: Array<{ status: TaskProgressStatus }>): ProgressResult {
    const total = tasks.length
    const done = tasks.filter((t) => t.status === 'DONE').length
    const blocked = tasks.filter((t) => t.status === 'BLOCKED').length
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length
    const pending = tasks.filter((t) => t.status === 'PENDING').length
    const skipped = tasks.filter((t) => t.status === 'SKIPPED').length
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0

    return { total, done, blocked, inProgress, pending, skipped, percentage }
}

// ─── Current Milestone (from hire date) ───────────────────

export function getCurrentMilestone(hireDate: Date | string): OnboardingMilestone {
    const daysSinceHire = Math.floor(
        (Date.now() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24),
    )
    return getMilestoneFromDueDays(daysSinceHire)
}
