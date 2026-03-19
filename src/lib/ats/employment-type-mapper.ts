// ═══════════════════════════════════════════════════════════
// Track B B-1h: ATS → Employee employment type mapping
//
// ATS Requisition uses lowercase: 'permanent' | 'contract' | 'intern'
// Employee/Assignment uses Prisma enum: 'FULL_TIME' | 'CONTRACT' | 'DISPATCH' | 'INTERN'
//
// This mapper bridges the gap without modifying existing ATS DB data.
// ═══════════════════════════════════════════════════════════

import type { EmploymentType } from '@/generated/prisma/enums'

const ATS_TO_EMPLOYEE_MAP: Record<string, EmploymentType> = {
  permanent: 'FULL_TIME',
  contract: 'CONTRACT',
  intern: 'INTERN',
  // Future: 'dispatch' → 'DISPATCH' (if ATS adds dispatch type)
}

/**
 * Maps ATS Requisition employment type (lowercase) to Employee EmploymentType (Prisma enum).
 *
 * @param atsType - The ATS requisition type string (e.g. 'permanent', 'contract', 'intern')
 * @returns The corresponding Prisma EmploymentType enum value
 * @default 'FULL_TIME' if the atsType is unrecognized
 */
export function mapRequisitionTypeToEmploymentType(atsType: string | null | undefined): EmploymentType {
  if (!atsType) return 'FULL_TIME'
  return ATS_TO_EMPLOYEE_MAP[atsType.toLowerCase()] ?? 'FULL_TIME'
}
