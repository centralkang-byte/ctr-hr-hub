// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Frontend Employee Adapter
// Converts various API response shapes → MinimalEmployee
// for EmployeeCell consumption.
// ═══════════════════════════════════════════════════════════

import type { MinimalEmployee } from '@/types/employee'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

/**
 * Frontend adapter: Convert typical Prisma employee with nested assignments
 * to MinimalEmployee for EmployeeCell consumption.
 *
 * Use when the API was NOT converted in EC-2a (most routes).
 * Safe to use with `any` — all fields accessed via optional chaining.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adaptEmployeeForCell(emp: any): MinimalEmployee | null {
  if (!emp) return null
  const a = extractPrimaryAssignment(emp.assignments ?? []) ?? emp.currentAssignment ?? null
  return {
    id: emp.id ?? '',
    name: emp.name ?? '',
    nameEn: emp.nameEn ?? null,
    employeeNo: emp.employeeNo ?? emp.employeeNumber ?? null,
    photoUrl: emp.photoUrl ?? null,
    department: a?.department?.name ?? emp.departmentName ?? emp.department ?? null,
    departmentId: a?.department?.id ?? emp.departmentId ?? null,
    jobTitle: a?.position?.titleKo ?? a?.position?.title ?? emp.positionTitle ?? emp.jobTitle ?? null,
    jobGrade: a?.jobGrade?.name ?? emp.gradeName ?? emp.jobGrade ?? null,
    email: emp.email ?? null,
    phone: emp.phone ?? null,
    hireDate: emp.hireDate ? String(emp.hireDate) : null,
    status: a?.status ?? emp.status ?? null,
    locationCode: a?.company?.countryCode ?? a?.company?.locationCode ?? emp.locationCode ?? null,
    locationCity: a?.company?.locationCity ?? emp.locationCity ?? null,
    companyName: a?.company?.name ?? emp.companyName ?? null,
  }
}

/**
 * Bulk convert array of employees to MinimalEmployee[].
 * Filters out null results automatically.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adaptEmployeesForCell(employees: any[]): MinimalEmployee[] {
  return employees
    .map(adaptEmployeeForCell)
    .filter((e): e is MinimalEmployee => e !== null)
}
