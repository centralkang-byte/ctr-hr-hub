/**
 * Track B B-3a: Assignment Helpers — SSOT
 *
 * Two helpers for safely accessing the Primary Assignment:
 * 1. fetchPrimaryAssignment() — DB query for single employee detail views
 * 2. extractPrimaryAssignment() — In-memory filter for list APIs with included assignments
 *
 * Convention: NEVER access assignments[0] directly.
 * Always use one of these helpers to get the Primary Assignment.
 *
 * @see CLAUDE.md — "Assignment 규칙 (Track B)" section
 */

import { cache } from 'react'
import { prisma } from '@/lib/prisma'

/**
 * 법인별 입사일 조회 — 해당 법인의 첫 Primary Assignment effectiveDate
 * Entity transfer 시 연차 리셋, 수습 기간 계산 등에 사용
 * 그룹 입사일은 Employee.hireDate (변경 안 함)
 */
export async function getCompanyHireDate(
  employeeId: string,
  companyId: string,
): Promise<Date | null> {
  const first = await prisma.employeeAssignment.findFirst({
    where: { employeeId, companyId, isPrimary: true },
    orderBy: { effectiveDate: 'asc' },
    select: { effectiveDate: true },
  })
  return first?.effectiveDate ?? null
}

/**
 * Helper 1: DB Query — for single employee detail views.
 * Use when you need to fetch the primary assignment from DB (no prior include).
 * Includes common relations — callers can spread additional includes if needed.
 *
 * TODO: Timezone-aware effectiveDate comparison (UTC vs Local) — currently uses
 * server-local time via new Date(). For cross-timezone accuracy (e.g., Detroit vs
 * Changwon), effectiveDate should be compared in the employee's location timezone.
 * Acceptable for V1 launch; revisit post-deployment.
 */
export const fetchPrimaryAssignment = cache(async function fetchPrimaryAssignment(employeeId: string) {
  const now = new Date()
  return prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      endDate: null,
      effectiveDate: { lte: now },
    },
    include: {
      company: true,
      department: true,
      position: true,
      jobGrade: true,
      workLocation: true,
    },
  })
})

/**
 * Helper 2: In-Memory Filter — for list APIs where assignments already loaded via include.
 * Use when employee.assignments[] is already in memory.
 *
 * Generic constraint accepts Date | string because:
 * - Backend (Prisma result): Date objects
 * - Frontend (JSON from API response): ISO string after serialization
 * Both cases must work without caller conversion.
 *
 * Fallback chain:
 *   1. isPrimary && !endDate && effectiveDate <= now (active primary)
 *   2. isPrimary (primary with endDate — terminated but was primary)
 *   3. Most recent by effectiveDate (last resort — legacy compat + data integrity warning)
 */
export function extractPrimaryAssignment<T extends Record<string, unknown>>(assignments: T[]): T | undefined {
  if (!assignments || assignments.length === 0) return undefined
  if (assignments.length === 1) return assignments[0] // fast path

  const now = new Date()

  // Helper to safely read optional fields from generic assignment objects
  const hasPrimary = (a: T) => 'isPrimary' in a && a.isPrimary === true
  const hasEndDate = (a: T) => 'endDate' in a && a.endDate != null
  const getEffectiveDate = (a: T): Date | null => {
    if (!('effectiveDate' in a) || !a.effectiveDate) return null
    return new Date(a.effectiveDate as string | Date)
  }

  // 1st priority: active primary
  const activePrimary = assignments.find(a => {
    if (!hasPrimary(a)) return false
    if (hasEndDate(a)) return false
    const ed = getEffectiveDate(a)
    return ed ? ed <= now : true
  })
  if (activePrimary) return activePrimary

  // 2nd priority: any primary (even ended)
  const anyPrimary = assignments.find(a => hasPrimary(a))
  if (anyPrimary) return anyPrimary

  // 3rd fallback: no isPrimary at all — data integrity issue, log for early detection
  console.warn(
    `[assignment-helpers] No isPrimary found for employee with ${assignments.length} assignments`
  )
  // Sort by effectiveDate if available, otherwise return first
  const withDates = assignments.filter(a => getEffectiveDate(a) !== null)
  if (withDates.length > 0) {
    return [...withDates].sort(
      (a, b) => getEffectiveDate(b)!.getTime() - getEffectiveDate(a)!.getTime()
    )[0]
  }
  return assignments[0]
}
