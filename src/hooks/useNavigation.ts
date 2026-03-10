'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — useNavigation Hook
// 역할 기반 섹션/항목 필터링 + 국가 필터링
// ═══════════════════════════════════════════════════════════

import { useMemo } from 'react'
import { NAVIGATION, type NavSection, type NavItem } from '@/config/navigation'
import { ROLE, MODULE, ACTION } from '@/lib/constants'
import type { Permission, SessionUser } from '@/types'

// ─── Permission check (reuse existing logic) ────────────────

function canAccessModule(
  user: SessionUser,
  module: string,
): boolean {
  if (user.role === ROLE.SUPER_ADMIN) return true

  // HR_ADMIN has implicit access to settings, analytics, and compliance
  // These modules may not have explicit permissions seeded
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
        // SUPER_ADMIN sees everything
        if (user.role === ROLE.SUPER_ADMIN) return true
        return section.visibleTo.includes(user.role)
      })
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          // Module permission check
          if (!canAccessModule(user, item.module)) return false

          // Country filter
          if (item.countryFilter) {
            if (!countryCode) return true
            return item.countryFilter.includes(countryCode)
          }

          return true
        }),
      }))
      .filter((section) => section.items.length > 0)
  }, [user, countryCode])

  return { sections }
}
