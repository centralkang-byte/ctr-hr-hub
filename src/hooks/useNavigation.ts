'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — useNavigation Hook
// 역할 기반 섹션/항목 필터링 + 국가 필터링 + 조건부 아이템 필터링
// ═══════════════════════════════════════════════════════════

import { useMemo } from 'react'
import { NAVIGATION, type NavSection } from '@/config/navigation'
import { ROLE, MODULE, ACTION } from '@/lib/constants'
import type { Permission, SessionUser } from '@/types'

// ─── Self-service routes (ALL_ROLES, bypass module permission) ──
// middleware.ts에서 ALL_ROLES로 허용된 /*/me 라우트들.
// 모듈 권한 없어도 사이드바에 표시 (예: MANAGER → /payroll/me)
const SELF_SERVICE_PATHS = ['/payroll/me', '/onboarding/me', '/my/training']

// ─── Permission check ────────────────────────────────────────

function canAccessModule(user: SessionUser, module: string): boolean {
  if (user.role === ROLE.SUPER_ADMIN) return true

  // HR_ADMIN has implicit access to settings, analytics, and compliance
  if (module === MODULE.SETTINGS || module === MODULE.ANALYTICS || module === MODULE.COMPLIANCE) {
    return user.role === ROLE.HR_ADMIN || user.role === ROLE.EXECUTIVE
  }

  return user.permissions.some(
    (p: Permission) => p.module === module && p.action === ACTION.VIEW,
  )
}

// ─── Hook ───────────────────────────────────────────────────

interface UseNavigationOptions {
  user: SessionUser
  countryCode?: string | null
}

interface UseNavigationReturn {
  sections: NavSection[]
}

export function useNavigation({
  user,
  countryCode,
}: UseNavigationOptions): UseNavigationReturn {
  const sections = useMemo(() => {
    return NAVIGATION
      .filter((section) => {
        if (user.role === ROLE.SUPER_ADMIN) return true
        return section.visibleTo.includes(user.role)
      })
      .map((section) => ({
        ...section,
        items: section.items
          .filter((item) => {
            // Self-service 라우트는 모듈 권한과 무관하게 전 직원 표시
            const isSelfService = SELF_SERVICE_PATHS.includes(item.href)
            if (!isSelfService && !canAccessModule(user, item.module)) return false

            // Country filter
            if (item.countryFilter) {
              if (!countryCode) return true
              if (!item.countryFilter.includes(countryCode)) return false
            }

            // (Wave1 IA: conditional 아이템 전부 rail 데모션 — 조건부 노출은
            // 각 허브/홈 트래커가 담당. year-end 조건 SSOT = lib/payroll/year-end-visibility)

            return true
          })
          // NEW/beta 뱃지 제거 (사용자 요청)
          .map(({ badge: _badge, ...item }) => item),
      }))
      .filter((section) => section.items.length > 0)
  }, [user, countryCode])

  return { sections }
}
