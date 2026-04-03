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
const SELF_SERVICE_PATHS = ['/payroll/me', '/onboarding/me']

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

// ─── Conditional item visibility ────────────────────────────
// conditional 필드가 있는 아이템의 런타임 노출 여부 결정.
// 조건 평가 실패(데이터 없음) 시 true(항상 표시) fallback.

function shouldShowConditional(
  user: SessionUser,
  conditionalType: 'onboarding' | 'offboarding' | 'year-end',
  countryCode?: string | null,
): boolean {
  const today = new Date()

  switch (conditionalType) {
    case 'year-end': {
      // KR 법인 + 1~3월에만 표시
      if (countryCode && countryCode !== 'KR') return false
      const month = today.getMonth() + 1 // 1-indexed
      return month >= 1 && month <= 3
    }

    case 'onboarding': {
      // hireDate 기준 입사 90일 이내에만 표시
      // hireDate가 없으면 safe fallback: 항상 표시
      const hireDateStr = (user as { hireDate?: string | Date }).hireDate
      if (!hireDateStr) return true
      const hireDate = new Date(hireDateStr)
      const ninetyDaysAfter = new Date(hireDate.getTime() + 90 * 24 * 60 * 60 * 1000)
      return today <= ninetyDaysAfter
    }

    case 'offboarding': {
      // 퇴직 절차 진행 중인 경우에만 표시
      // offboardingStatus가 없으면 safe fallback: 항상 표시
      const offboardingStatus = (user as { offboardingStatus?: string | null }).offboardingStatus
      if (offboardingStatus === undefined) return true
      return offboardingStatus !== null
    }

    default:
      return true
  }
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

            // Conditional visibility (onboarding / offboarding / year-end)
            if (item.conditional) {
              return shouldShowConditional(user, item.conditional, countryCode)
            }

            return true
          })
          // NEW/beta 뱃지 제거 (사용자 요청)
          .map(({ badge: _badge, ...item }) => item),
      }))
      .filter((section) => section.items.length > 0)
  }, [user, countryCode])

  return { sections }
}
