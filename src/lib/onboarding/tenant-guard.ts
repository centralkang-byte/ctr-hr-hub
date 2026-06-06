// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding 멀티테넌트 가드 헬퍼
// 온보딩 인스턴스의 소속 법인을 안전하게 해석한다.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

/**
 * 온보딩 인스턴스의 소속 법인 ID를 해석한다.
 *
 * - `EmployeeOnboarding.companyId`가 채워져 있으면 그 값(SSOT).
 * - null(레거시/미완 데이터, B5 이전)이면 직원의 primary assignment 법인으로 fallback.
 *   - 1순위: active primary(endDate=null) — 미래 발령(pre-hire 온보딩)도 포함(effectiveDate 필터 없음).
 *   - 2순위: 가장 최근 primary(날짜 무관) — 완전 레거시 안전망.
 * - 끝내 없으면 null → 호출부에서 fail-closed(비-SUPER 접근 거부).
 *
 * @returns companyId 또는 null
 */
export async function resolveOnboardingCompanyId(onboarding: {
  companyId: string | null
  employeeId: string
}): Promise<string | null> {
  if (onboarding.companyId) return onboarding.companyId

  const active = await prisma.employeeAssignment.findFirst({
    where: { employeeId: onboarding.employeeId, isPrimary: true, endDate: null },
    orderBy: { effectiveDate: 'desc' },
    select: { companyId: true },
  })
  if (active) return active.companyId

  const anyPrimary = await prisma.employeeAssignment.findFirst({
    where: { employeeId: onboarding.employeeId, isPrimary: true },
    orderBy: { effectiveDate: 'desc' },
    select: { companyId: true },
  })
  return anyPrimary?.companyId ?? null
}
