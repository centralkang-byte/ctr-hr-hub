// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Utilities
// Server-side helpers for standardized employee data
// ═══════════════════════════════════════════════════════════

import type { MinimalEmployee } from '@/types/employee'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

/**
 * Standard Prisma select for minimal employee data.
 * Uses select (NOT include) to minimize payload on list APIs.
 */
export const EMPLOYEE_MINIMAL_SELECT = {
  id: true,
  name: true,
  nameEn: true,
  employeeNo: true,
  photoUrl: true,
  email: true,
  phone: true,
  hireDate: true,
  assignments: {
    where: { isPrimary: true, endDate: null },
    orderBy: { effectiveDate: 'desc' as const },
    take: 1,
    select: {
      status: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, titleKo: true, titleEn: true } },
      jobGrade: { select: { id: true, name: true } },
      company: { select: { id: true, code: true, name: true, countryCode: true, locationCity: true } },
    },
  },
} as const

/**
 * Convert any Prisma employee query result to MinimalEmployee.
 * Defensive: handles null/undefined/malformed data without crashing.
 */
export function toMinimalEmployee(raw: any): MinimalEmployee | null {
  try {
    if (!raw || !raw.id || !raw.name) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignment = extractPrimaryAssignment(raw.assignments ?? []) as any
    const countryCode = assignment?.company?.countryCode ?? null
    // For KR/CN show Korean title, others show English title
    const jobTitle = countryCode && ['KR', 'CN'].includes(countryCode)
      ? (assignment?.position?.titleKo ?? assignment?.position?.titleEn ?? null)
      : (assignment?.position?.titleEn ?? assignment?.position?.titleKo ?? null)

    return {
      id: raw.id,
      name: raw.name,
      nameEn: raw.nameEn ?? null,
      employeeNo: raw.employeeNo ?? null,
      photoUrl: raw.photoUrl ?? null,
      department: assignment?.department?.name ?? null,
      departmentId: assignment?.department?.id ?? null,
      jobTitle,
      jobGrade: assignment?.jobGrade?.name ?? null,
      email: raw.email ?? null,
      phone: raw.phone ?? null,
      hireDate: raw.hireDate ? new Date(raw.hireDate).toISOString() : null,
      status: assignment?.status ?? null,
      locationCode: countryCode,
      locationCity: assignment?.company?.locationCity ?? null,
      companyName: assignment?.company?.name ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Batch convert for list APIs.
 */
export function toMinimalEmployees(rawList: any[]): MinimalEmployee[] {
  return rawList.map(toMinimalEmployee).filter((e): e is MinimalEmployee => e !== null)
}
