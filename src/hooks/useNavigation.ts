'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — useNavigation Hook
// 역할 기반 섹션/항목 필터링 + 국가 필터링
// EMPLOYEE: MY SPACE 항목을 대분류별 가상 섹션으로 재그룹
// ═══════════════════════════════════════════════════════════

import { useMemo } from 'react'
import { NAVIGATION, type NavSection } from '@/config/navigation'
import { ROLE, MODULE, ACTION } from '@/lib/constants'
import type { Permission, SessionUser } from '@/types'
import {
  User,
  Clock,
  Wallet,
  Target,
  Network,
  Briefcase,
  type LucideIcon,
} from 'lucide-react'

// ─── Self-service routes (ALL_ROLES, bypass module permission) ──
// middleware.ts에서 ALL_ROLES로 허용된 /*/me 라우트들.
// 모듈 권한 없어도 사이드바에 표시 (예: MANAGER → /payroll/me)
const SELF_SERVICE_PATHS = ['/payroll/me', '/onboarding/me']

// ─── EMPLOYEE 대분류 그룹 정의 ────────────────────────────
// MY SPACE 항목을 HR 관리자 섹션 구조와 동일한 대분류로 분리
// labelKey가 기존 i18n에 없으면 label(한국어)이 fallback으로 표시됨
interface EmployeeGroup {
  key: string
  labelKey: string
  label: string
  icon: LucideIcon
  itemKeys: string[]
}

const EMPLOYEE_GROUPS: EmployeeGroup[] = [
  {
    key: 'my-space',
    labelKey: 'nav.mySpace.label',
    label: '나의 공간',
    icon: User,
    itemKeys: ['my-tasks', 'my-profile', 'my-documents', 'my-notification-settings'],
  },
  {
    key: 'my-work',
    labelKey: 'nav.employee.work',
    label: '근태/휴가',
    icon: Clock,
    itemKeys: ['my-attendance', 'my-leave'],
  },
  {
    key: 'my-pay',
    labelKey: 'nav.payroll.label',
    label: '급여',
    icon: Wallet,
    itemKeys: ['my-payslip', 'my-year-end'],
  },
  {
    key: 'my-growth',
    labelKey: 'nav.performance.label',
    label: '성과/보상',
    icon: Target,
    itemKeys: ['my-goals', 'my-skills', 'my-training', 'my-recognition', 'my-benefits'],
  },
  {
    key: 'employee-org',
    labelKey: 'nav.employee.org',
    label: '조직',
    icon: Network,
    itemKeys: ['my-directory', 'my-org', 'my-onboarding', 'my-offboarding', 'my-internal-jobs'],
  },
]

// MY SPACE에서 대분류로 분리 대상인 모든 item key
const REGROUPED_ITEM_KEYS = new Set(
  EMPLOYEE_GROUPS.flatMap((g) => g.itemKeys),
)

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
    const filtered = NAVIGATION
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

            // Module permission check (self-service 제외)
            if (!isSelfService && !canAccessModule(user, item.module)) return false

            // Country filter
            if (item.countryFilter) {
              if (!countryCode) return true
              return item.countryFilter.includes(countryCode)
            }

            return true
          })
          // NEW/beta 뱃지 제거 (사용자 요청)
          .map(({ badge, ...item }) => item),
      }))
      .filter((section) => section.items.length > 0)

    // ─── EMPLOYEE: MY SPACE 항목을 대분류별 가상 섹션으로 분리 ──
    if (user.role === ROLE.EMPLOYEE) {
      return regroupForEmployee(filtered)
    }

    return filtered
  }, [user, countryCode])

  return { sections }
}

// ─── EMPLOYEE 대분류 재그룹 ─────────────────────────────────
// MY SPACE의 17개 항목을 5개 대분류 섹션으로 분리
// HOME 등 다른 섹션은 그대로 유지

function regroupForEmployee(sections: NavSection[]): NavSection[] {
  const result: NavSection[] = []

  for (const section of sections) {
    if (section.key !== 'my-space') {
      // HOME 등 다른 섹션은 그대로
      result.push(section)
      continue
    }

    // MY SPACE 항목을 item key → NavItem 맵으로 변환
    const itemMap = new Map(section.items.map((item) => [item.key, item]))

    // 대분류별 가상 섹션 생성
    for (const group of EMPLOYEE_GROUPS) {
      const items = group.itemKeys
        .map((key) => itemMap.get(key))
        .filter(Boolean) as NavSection['items']

      if (items.length === 0) continue

      result.push({
        key: group.key,
        labelKey: group.labelKey,
        label: group.label,
        icon: group.icon,
        visibleTo: [ROLE.EMPLOYEE],
        items,
      })

      // 처리된 항목 제거
      for (const key of group.itemKeys) {
        itemMap.delete(key)
      }
    }

    // 그룹에 포함되지 않은 나머지 항목이 있으면 나의 공간에 추가
    const remaining = Array.from(itemMap.values())
    if (remaining.length > 0) {
      // 이미 my-space 섹션이 result에 있으면 거기에 추가
      const mySpaceSection = result.find((s) => s.key === 'my-space')
      if (mySpaceSection) {
        mySpaceSection.items.push(...remaining)
      } else {
        result.push({
          ...section,
          items: remaining,
        })
      }
    }
  }

  return result
}
