// ═══════════════════════════════════════════════════════════
// CTR HR Hub — MinimalEmployee Type
// Standardized employee shape for all UI components
// ═══════════════════════════════════════════════════════════

import type { EmployeeStatus } from '@/generated/prisma/enums'

/**
 * Minimal employee data for EmployeeCell component.
 * Standardized shape used across all API responses and UI components.
 * All optional fields render gracefully when null.
 */
export interface MinimalEmployee {
  id: string
  name: string                          // 한글/현지어 이름
  nameEn?: string | null                // 영문명 (KR/CN only parenthesized)
  employeeNo?: string | null            // 사번
  photoUrl?: string | null              // 프로필 사진 URL
  department?: string | null            // 부서명
  departmentId?: string | null          // 부서 ID (아바타 색상 결정용)
  jobTitle?: string | null              // 직책: "팀장", "Manager" (Position.titleKo/titleEn)
  jobGrade?: string | null              // 직급: "대리", "G3" (JobGrade.name)
  email?: string | null                 // 회사 이메일
  phone?: string | null                 // 휴대전화
  hireDate?: string | null              // 입사일 (ISO string)
  status?: EmployeeStatus | null        // ACTIVE, ON_LEAVE, RESIGNED, TERMINATED
  locationCode?: string | null          // 국가 코드: KR, US, CN, RU, VN, MX (Company.countryCode)
  locationCity?: string | null          // 도시명: 창원, Michigan, 장춘 (Company.locationCity)
  companyName?: string | null           // 법인명: CTR-KR
}
