// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Home Preview Guard
// /home-preview/* 서버 페이지의 3중 접근 제어 SSOT.
// R3에서 4 pilot(manager/hr-admin/executive/employee) 복제를 방지하기 위한 헬퍼.
// Codex Gate 1 LOW 반영 — route drift 차단.
// ═══════════════════════════════════════════════════════════

import { notFound } from 'next/navigation'
import type { RoleCode } from '@/lib/constants'

/**
 * Preview env + production 가드 (2중).
 *
 * 1. `HOME_PREVIEW !== 'true'` → 서버 전용 env flag 미설정 시 완전 차단
 * 2. `VERCEL_ENV === 'production'` → production 배포 보호 (env가 실수로 켜져도 차단)
 *
 * 두 조건 모두 통과해야 preview 페이지가 렌더된다.
 * 호출 위치: /home-preview/* page.tsx의 최상단.
 */
export function assertHomePreviewEnabled(): void {
  if (process.env.HOME_PREVIEW !== 'true') {
    notFound()
  }
  if (process.env.VERCEL_ENV === 'production') {
    notFound()
  }
}

/**
 * Role 가드 — allowedRoles에 포함되지 않으면 notFound().
 *
 * summary API가 role별 다른 DTO 반환 → wrong role이 V2 컴포넌트에 접근하면 DTO 미스매치.
 * SUPER_ADMIN 포함 여부는 각 pilot에서 명시적으로 선택 (HR/EXEC은 포함, MANAGER/EMPLOYEE는 제외).
 *
 * `SessionUser.role`은 `string` 타입이므로 userRole도 string으로 받고, allowedRoles만 typed.
 */
export function assertPilotRole(
  userRole: string,
  allowedRoles: readonly RoleCode[],
): void {
  if (!(allowedRoles as readonly string[]).includes(userRole)) {
    notFound()
  }
}
