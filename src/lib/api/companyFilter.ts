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
