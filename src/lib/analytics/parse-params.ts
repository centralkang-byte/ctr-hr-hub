// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Query Parameter Parser
// G-1: TTM (Trailing 12 Months) default to prevent empty charts
// G-2 QA: Division→children resolution for 3-layer filter
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

export interface AnalyticsQueryParams {
  companyId?: string
  departmentId?: string
  /** Resolved department IDs (includes parent + all children) */
  departmentIds?: string[]
  startDate: Date
  endDate: Date
}

export function parseAnalyticsParams(searchParams: URLSearchParams): AnalyticsQueryParams {
  const now = new Date()
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

  const startStr = searchParams.get('startDate')
  const endStr = searchParams.get('endDate')

  return {
    companyId: searchParams.get('companyId') || undefined,
    departmentId: searchParams.get('departmentId') || undefined,
    startDate: startStr ? new Date(startStr) : twelveMonthsAgo,
    endDate: endStr ? new Date(endStr) : now,
  }
}

/**
 * Resolve a department filter into an array of department IDs.
 * If the given departmentId is a parent (has children), returns
 * the parent ID + all child IDs. Otherwise returns [departmentId].
 * Returns undefined if no departmentId is provided.
 */
export async function resolveDepartmentFilter(departmentId?: string): Promise<string[] | undefined> {
  if (!departmentId) return undefined

  const children = await prisma.department.findMany({
    where: { parentId: departmentId, isActive: true, deletedAt: null },
    select: { id: true },
  })

  if (children.length > 0) {
    return [departmentId, ...children.map((c) => c.id)]
  }
  return [departmentId]
}

/** Format date as YYYY-MM */
export function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Generate array of YYYY-MM strings between two dates */
export function generateMonthRange(start: Date, end: Date): string[] {
  const months: string[] = []
  const current = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)

  while (current <= endMonth) {
    months.push(toYearMonth(current))
    current.setMonth(current.getMonth() + 1)
  }
  return months
}
