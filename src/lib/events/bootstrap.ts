// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Event Bus Bootstrap
// src/lib/events/bootstrap.ts
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: 13 event handlers across 4 Golden Paths (Hire→Onboard, Payroll, Performance, Offboarding)
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════
//
// 앱 시작 시 1회 호출하여 모든 핸들러를 EventBus에 등록.
// Next.js: src/instrumentation.ts 또는 최상위 layout.tsx에서 호출.
//
// 사용법:
//   import { bootstrapEventHandlers } from '@/lib/events/bootstrap'
//   bootstrapEventHandlers()
// ═══════════════════════════════════════════════════════════

import { eventBus } from './event-bus'
import { leaveApprovedHandler } from './handlers/leave-approved.handler'
import { leaveRejectedHandler } from './handlers/leave-rejected.handler'
import { leaveCancelledHandler } from './handlers/leave-cancelled.handler'
import { payrollCalculatedHandler } from './handlers/payroll-calculated.handler'
import { payrollApprovedHandler } from './handlers/payroll-approved.handler'
import { payrollAttendanceClosedHandler } from './handlers/payroll-attendance-closed.handler'
import { payrollReviewReadyHandler } from './handlers/payroll-review-ready.handler'
import { employeeHiredHandler } from './handlers/employee-hired.handler'
import { offboardingStartedHandler } from './handlers/offboarding-started.handler'
import { mboGoalSubmittedHandler } from './handlers/mbo-goal-submitted.handler'
import { mboGoalReviewedHandler } from './handlers/mbo-goal-reviewed.handler'
import { selfEvalSubmittedHandler } from './handlers/self-eval-submitted.handler'
import { managerEvalSubmittedHandler } from './handlers/manager-eval-submitted.handler'
import { offerSentHandler } from './handlers/offer-sent.handler'
import { offerAcceptedHandler } from './handlers/offer-accepted.handler'
import { offerDeclinedHandler } from './handlers/offer-declined.handler'
import { interviewScheduledHandler } from './handlers/interview-scheduled.handler'
import { quarterlyReviewCreatedHandler } from './handlers/quarterly-review-created.handler'
import { quarterlyReviewSubmittedHandler } from './handlers/quarterly-review-submitted.handler'
import { quarterlyReviewCompletedHandler } from './handlers/quarterly-review-completed.handler'
import { quarterlyReviewReopenedHandler } from './handlers/quarterly-review-reopened.handler'
import { goalRevisionProposedHandler } from './handlers/goal-revision-proposed.handler'
import { goalRevisionApprovedHandler, goalRevisionRejectedHandler } from './handlers/goal-revision-reviewed.handler'
import { compApprovedHandler } from './handlers/comp-approved.handler'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let bootstrapped = false

/**
 * 모든 도메인 이벤트 핸들러를 EventBus에 등록.
 * 멱등적 — 중복 호출 시 재등록하지 않음.
 */
export function bootstrapEventHandlers(): void {
  // Clear existing handlers to prevent duplication on hot-reload
  // (globalThis.__eventBus persists but this module's `bootstrapped` flag resets)
  eventBus.clearAll()

  // ── Leave Events ────────────────────────────────────────
  eventBus.subscribe(leaveApprovedHandler)
  eventBus.subscribe(leaveRejectedHandler)
  eventBus.subscribe(leaveCancelledHandler)

  // ── Payroll Events ───────────────────────────────────────
  eventBus.subscribe(payrollCalculatedHandler)
  eventBus.subscribe(payrollApprovedHandler)
  // GP#3 pipeline handlers
  eventBus.subscribe(payrollAttendanceClosedHandler)
  eventBus.subscribe(payrollReviewReadyHandler)

  // ── Onboarding Events ────────────────────────────────────
  eventBus.subscribe(employeeHiredHandler)
  // onboardingTaskCompletedHandler + onboardingCompletedHandler → Session C†

  // ── Offboarding Events ───────────────────────────────────
  eventBus.subscribe(offboardingStartedHandler)

  // ── Performance Review Events ─────────────────────────────
  // Session B ✔️
  eventBus.subscribe(mboGoalSubmittedHandler)
  eventBus.subscribe(mboGoalReviewedHandler)
  // Session C ✔️
  eventBus.subscribe(selfEvalSubmittedHandler)
  eventBus.subscribe(managerEvalSubmittedHandler)
  // Session D ✔️
  // PERFORMANCE_CYCLE_FINALIZED — publishing done in advance/finalize routes.
  // No dedicated handler needed: downstream consumers subscribe directly to the event bus.

  // ── Recruitment Events ────────────────────────────────────
  eventBus.subscribe(offerSentHandler)
  eventBus.subscribe(offerAcceptedHandler)
  eventBus.subscribe(offerDeclinedHandler)
  eventBus.subscribe(interviewScheduledHandler)

  // ── Quarterly Review Events (Phase B-2) ─────────────────────
  eventBus.subscribe(quarterlyReviewCreatedHandler)
  eventBus.subscribe(quarterlyReviewSubmittedHandler)
  eventBus.subscribe(quarterlyReviewCompletedHandler)
  eventBus.subscribe(quarterlyReviewReopenedHandler)

  // ── Goal Revision Events (Phase C) ─────────────────────
  eventBus.subscribe(goalRevisionProposedHandler)
  eventBus.subscribe(goalRevisionApprovedHandler)
  eventBus.subscribe(goalRevisionRejectedHandler)

  // ── Compensation Events ──────────────────────────────────
  eventBus.subscribe(compApprovedHandler)

  bootstrapped = true
}
