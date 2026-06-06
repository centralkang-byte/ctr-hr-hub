// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: multi-tenant companyId isolation for all API routes
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
import type { SessionUser } from '@/types'

/**
 * 멀티테넌트 companyId 결정
 * - SUPER_ADMIN: 쿼리 파라미터 companyId 허용
 * - 그 외: 무조건 user.companyId 강제
 */
export function resolveCompanyId(
  user: SessionUser,
  requestedCompanyId?: string | null,
): string {
  if (user.role === 'SUPER_ADMIN' && requestedCompanyId) {
    return requestedCompanyId
  }
  return user.companyId
}

/**
 * 멀티테넌트 companyId where 필터 조각 (집계/읽기용)
 * - SUPER_ADMIN: 지정 시 해당 법인, 미지정 시 전체({}) — 통합 집계뷰
 * - 그 외: 무조건 user.companyId 강제 (요청 파라미터 무시)
 * 단일 companyId가 필요한 쓰기/단일법인 분석은 resolveCompanyId를 쓸 것.
 */
export function resolveCompanyFilter(
  user: SessionUser,
  requestedCompanyId?: string | null,
): { companyId?: string } {
  // SUPER_ADMIN: 지정 시 해당 법인, 미지정 시 전체({}) — 통합 집계뷰
  if (user.role === 'SUPER_ADMIN') {
    return requestedCompanyId ? { companyId: requestedCompanyId } : {}
  }
  // 비-SUPER: 항상 자기 법인 강제 — companyId가 비어도 {}(전체) 반환 금지(fail-closed)
  return { companyId: user.companyId }
}
