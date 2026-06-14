// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recruitment 공유 SSOT (읽기 권한 + 단계 집계)
// 채용 공고 목록/요약 라우트가 공유 → 권한·집계 의미 drift 방지 (Codex Gate1 P1).
// ═══════════════════════════════════════════════════════════

import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import type { ApplicationStage } from '@/generated/prisma/enums'

// ─── Read allowlist ──────────────────────────────────────────

// 채용 공고 목록·요약 조회 허용 역할.
// recruitment:read 모듈권한은 너무 넓어(dashboard/talent-pool/costs 등) 목록+요약만 MANAGER에 명시 개방.
// EXECUTIVE 제외 — seed가 *_export만 부여하고 recruitment:read는 미부여.
export const POSTINGS_READ_ROLES: ReadonlyArray<SessionUser['role']> = [
  ROLE.SUPER_ADMIN,
  ROLE.HR_ADMIN,
  ROLE.MANAGER,
]

// ─── Stage bucket helper (현재 단계 스냅샷) ──────────────────

export interface StageBuckets {
  /** 받은 지원 총계 (모든 단계 합 = 공고별 application 수) */
  applied: number
  /** 현재 서류심사 단계 */
  screen: number
  /** 현재 면접 단계 (1차/2차/최종) */
  interview: number
  /** 오퍼 단계 (발송/수락/거절) + 채용확정 */
  offer: number
}

/**
 * 단계별 카운트 맵 → 4-cell 스냅샷.
 *
 * ⚠️ 누적 전환 funnel 이 아니라 **현재 단계 분포** 다. `Application.stage` 는 현재 상태만
 * 저장하므로(단계전환 이력 테이블 부재) 과거 통과 여부는 복원 불가 — 기존 `/recruitment/dashboard`
 * funnel 과 동일한 의미. summary KPI 와 카드 셀이 이 함수를 공유해 의미가 일관되게 유지된다.
 */
export function bucketStages(
  counts: Partial<Record<ApplicationStage, number>>,
): StageBuckets {
  const c = (s: ApplicationStage): number => counts[s] ?? 0
  return {
    applied:
      c('APPLIED') +
      c('SCREENING') +
      c('INTERVIEW_1') +
      c('INTERVIEW_2') +
      c('FINAL') +
      c('OFFER') +
      c('OFFER_ACCEPTED') +
      c('OFFER_DECLINED') +
      c('HIRED') +
      c('REJECTED'),
    screen: c('SCREENING'),
    interview: c('INTERVIEW_1') + c('INTERVIEW_2') + c('FINAL'),
    offer: c('OFFER') + c('OFFER_ACCEPTED') + c('OFFER_DECLINED') + c('HIRED'),
  }
}
