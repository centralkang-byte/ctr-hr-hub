// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Nudge Engine Singleton + Check Nudges Entry
// src/lib/nudge/check-nudges.ts
// ═══════════════════════════════════════════════════════════
//
// D-3 Lazy Trigger:
//   - Login 또는 Dashboard 로드 시 호출
//   - 해당 사용자에 대해서만 평가 (전체 스캔 아님)
//   - 권장 연결 포인트:
//       src/app/api/v1/auth/session/route.ts (세션 조회 API)
//       또는 GET /api/v1/dashboard/route.ts
//   - 연결은 별도 세션에서 확인 후 진행
// ═══════════════════════════════════════════════════════════

import { NudgeEngine }                           from './nudge-engine'
import { leavePendingRule }                      from './rules/leave-pending.rule'
import { payrollReviewRule }                     from './rules/payroll-review.rule'
import { onboardingOverdueRule }                 from './rules/onboarding-overdue.rule'
import { onboardingCheckinMissingRule }          from './rules/onboarding-checkin-missing.rule'
import { offboardingOverdueRule }                from './rules/offboarding-overdue.rule'
import { exitInterviewPendingRule }              from './rules/exit-interview-pending.rule'
import { performanceGoalOverdueRule }            from './rules/performance-goal-overdue.rule'
import { performanceEvalOverdueRule }            from './rules/performance-eval-overdue.rule'
import { performanceCalibrationPendingRule }     from './rules/performance-calibration-pending.rule'
import { delegationNotSetRule }                  from './rules/delegation-not-set.rule'
import { leaveYearendBurnRule }                  from './rules/leave-yearend-burn.rule'
import type { NudgeRunSummary } from './types'

// ------------------------------------
// Singleton Engine Instance
// ------------------------------------

const globalForNudge = globalThis as unknown as { __nudgeEngine?: NudgeEngine }

function getEngine(): NudgeEngine {
  if (!globalForNudge.__nudgeEngine) {
    globalForNudge.__nudgeEngine = new NudgeEngine({
      rules: [
        // Leave & Payroll
        leavePendingRule,
        payrollReviewRule,
        // Onboarding
        onboardingOverdueRule,
        onboardingCheckinMissingRule,
        // Offboarding
        offboardingOverdueRule,
        exitInterviewPendingRule,
        // Performance Review
        performanceGoalOverdueRule,
        performanceEvalOverdueRule,
        performanceCalibrationPendingRule,
        // Delegation
        delegationNotSetRule,
        // F-3: Leave year-end burn
        leaveYearendBurnRule,
      ],
      oncePer24h: true,
    })
  }
  return globalForNudge.__nudgeEngine
}

// ------------------------------------
// Public Entry Point
// ------------------------------------

/**
 * 로그인한 사용자에 대해 nudge 룰을 평가하고 리마인더 발송.
 *
 * 연결 포인트 제안 (확인 후 적용):
 *   1. GET /api/v1/me (세션/프로필 조회 API) — 가장 자연스러운 위치
 *   2. GET /api/v1/dashboard — 대시보드 데이터 로드 시
 *   3. POST /api/auth/session (NextAuth callback) — 로그인 직후
 *
 * fire-and-forget으로 호출: void checkNudgesForUser(...)
 *
 * @param companyId  법인 ID
 * @param employeeId 로그인 사용자 ID
 */
export async function checkNudgesForUser(
  companyId: string,
  employeeId: string,
): Promise<NudgeRunSummary> {
  const engine = getEngine()
  return engine.run(companyId, employeeId)
}
