// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Domain Event Type Definitions
// src/lib/events/types.ts
// ═══════════════════════════════════════════════════════════
//
// 설계 원칙:
//   - Phase A snapshot에서 식별된 cross-module side-effect를 이벤트로 정의
//   - 각 이벤트는 handler가 필요한 최소한의 페이로드만 포함
//   - 새 이벤트 추가 시: DomainEventMap에 key-payload 쌍 추가
// ═══════════════════════════════════════════════════════════

// ------------------------------------
// Event Name Registry
// ------------------------------------

export const DOMAIN_EVENTS = {
  // Leave module
  LEAVE_APPROVED: 'LEAVE_APPROVED',
  LEAVE_REJECTED: 'LEAVE_REJECTED',
  LEAVE_CANCELLED: 'LEAVE_CANCELLED',
  LEAVE_REQUESTED: 'LEAVE_REQUESTED',   // 신청 생성 (향후 알림/워크플로우용)

  // Payroll module (GP#2 기존)
  PAYROLL_CALCULATED: 'PAYROLL_CALCULATED',
  PAYROLL_APPROVED: 'PAYROLL_APPROVED',
  PAYROLL_PAID: 'PAYROLL_PAID',     // 지급 완료 (향후 SocialInsurance 연동)

  // GP#3: Payroll Pipeline Events
  PAYROLL_ATTENDANCE_CLOSED: 'PAYROLL_ATTENDANCE_CLOSED',
  PAYROLL_ATTENDANCE_REOPENED: 'PAYROLL_ATTENDANCE_REOPENED',
  PAYROLL_ADJUSTMENT_ADDED: 'PAYROLL_ADJUSTMENT_ADDED',
  PAYROLL_REVIEW_READY: 'PAYROLL_REVIEW_READY',
  PAYROLL_PUBLISHED: 'PAYROLL_PUBLISHED',

  // Onboarding module
  EMPLOYEE_HIRED: 'EMPLOYEE_HIRED',
  ONBOARDING_TASK_COMPLETED: 'ONBOARDING_TASK_COMPLETED',
  ONBOARDING_COMPLETED: 'ONBOARDING_COMPLETED',

  // Offboarding module
  EMPLOYEE_OFFBOARDING_STARTED: 'EMPLOYEE_OFFBOARDING_STARTED',
  OFFBOARDING_TASK_COMPLETED: 'OFFBOARDING_TASK_COMPLETED',
  OFFBOARDING_COMPLETED: 'OFFBOARDING_COMPLETED',

  // Performance Review module
  PERFORMANCE_CYCLE_PHASE_CHANGED: 'PERFORMANCE_CYCLE_PHASE_CHANGED',
  PERFORMANCE_MBO_GOAL_SUBMITTED: 'PERFORMANCE_MBO_GOAL_SUBMITTED',
  PERFORMANCE_MBO_GOAL_REVIEWED: 'PERFORMANCE_MBO_GOAL_REVIEWED',
  PERFORMANCE_SELF_EVAL_SUBMITTED: 'PERFORMANCE_SELF_EVAL_SUBMITTED',
  PERFORMANCE_MANAGER_EVAL_SUBMITTED: 'PERFORMANCE_MANAGER_EVAL_SUBMITTED',
  PERFORMANCE_CYCLE_FINALIZED: 'PERFORMANCE_CYCLE_FINALIZED',

  // GP#4: Pipeline State Machine Events (Session B)
  GOAL_OVERDUE: 'GOAL_OVERDUE',
  CHECKIN_COMPLETED: 'CHECKIN_COMPLETED',
  CHECKIN_OVERDUE: 'CHECKIN_OVERDUE',
  SELF_EVAL_OVERDUE: 'SELF_EVAL_OVERDUE',
  PEER_NOMINATION_COMPLETED: 'PEER_NOMINATION_COMPLETED',
  PEER_EVAL_SUBMITTED: 'PEER_EVAL_SUBMITTED',
  CALIBRATION_ADJUSTED: 'CALIBRATION_ADJUSTED',
  CALIBRATION_APPROVED: 'CALIBRATION_APPROVED',
  RESULT_NOTIFIED: 'RESULT_NOTIFIED',
  RESULT_ACKNOWLEDGED: 'RESULT_ACKNOWLEDGED',
  COMP_REVIEW_STARTED: 'COMP_REVIEW_STARTED',
  COMP_EXCEPTION_FLAGGED: 'COMP_EXCEPTION_FLAGGED',
  COMP_APPROVED: 'COMP_APPROVED',
} as const

export type DomainEventName = typeof DOMAIN_EVENTS[keyof typeof DOMAIN_EVENTS]

// ------------------------------------
// Payload Definitions
// ------------------------------------

/** 공통 컨텍스트 — 모든 이벤트에 포함 */
export interface EventContext {
  companyId: string
  actorId: string    // 이벤트를 발생시킨 employeeId
  occurredAt: Date
}

// ── Leave Events ─────────────────────────────────────────

export interface LeaveApprovedPayload {
  ctx: EventContext
  requestId: string
  employeeId: string
  policyId: string
  balanceId: string
  days: number
  startDate: Date
  endDate: Date
}

export interface LeaveRejectedPayload {
  ctx: EventContext
  requestId: string
  employeeId: string
  policyId: string
  balanceId: string
  days: number
  rejectionReason: string
}

export interface LeaveCancelledPayload {
  ctx: EventContext
  requestId: string
  employeeId: string
  policyId: string
  balanceId: string
  days: number
  previousStatus: 'PENDING' | 'APPROVED'  // 어떤 컬럼을 복원해야 하는지
}

export interface LeaveRequestedPayload {
  ctx: EventContext
  requestId: string
  employeeId: string
  policyId: string
  days: number
  startDate: Date
  endDate: Date
}

// ── Payroll Events ────────────────────────────────────────

export interface PayrollCalculatedPayload {
  ctx: EventContext
  runId: string
  yearMonth: string
  headcount: number
  totalGross: number
  totalNet: number
}

export interface PayrollApprovedPayload {
  ctx: EventContext
  runId: string
  yearMonth: string
  year: number
  month: number
  payrollItemIds: Array<{ id: string; employeeId: string }>
}

export interface PayrollPaidPayload {
  ctx: EventContext
  runId: string
  yearMonth: string
  paidAt: Date
}

// ── GP#3 Payroll Pipeline Events ─────────────────────────

export interface PayrollAttendanceClosedPayload {
  ctx: EventContext
  payrollRunId: string
  companyId: string
  yearMonth: string
  year: number
  month: number
  totalEmployees: number
  confirmedCount: number
  excludedCount: number
}

export interface PayrollAttendanceReopenedPayload {
  ctx: EventContext
  payrollRunId: string
  companyId: string
  yearMonth: string
}

export interface PayrollAdjustmentAddedPayload {
  ctx: EventContext
  payrollRunId: string
  companyId: string
  adjustmentId: string
  employeeId: string
  amount: number
  type: string
}

export interface PayrollReviewReadyPayload {
  ctx: EventContext
  payrollRunId: string
  companyId: string
  yearMonth: string
  anomalyCount: number
}

export interface PayrollPublishedPayload {
  ctx: EventContext
  payrollRunId: string
  companyId: string
  yearMonth: string
  headcount: number
  publishedAt: Date
}

// ── Onboarding Events ────────────────────────────────────

/**
 * 직원 등록 완료 이벤트.
 * employees/route.ts POST 핸들러에서 발행.
 * Session B 핸들러: EmployeeOnboarding + tasks 자동 생성
 */
export interface EmployeeHiredPayload {
  ctx: EventContext
  employeeId: string
  companyId: string          // EmployeeAssignment.companyId (소속 법인)
  hireDate: Date
  departmentId?: string
  positionId?: string        // jobGradeId (직급 식별자)
}

/**
 * 온보딩 개별 태스크 완료 이벤트.
 * onboarding/tasks/[id]/complete route에서 발행.
 */
export interface OnboardingTaskCompletedPayload {
  ctx: EventContext
  employeeOnboardingTaskId: string
  employeeOnboardingId: string
  employeeId: string
  companyId: string
  completedBy: string        // 완료 처리한 actorId
  taskCategory: string       // OnboardingTaskCategory enum value
  allRequiredDone: boolean   // 전체 필수 태스크 완료 여부 (ONBOARDING_COMPLETED 체인 신호)
}

/**
 * 온보딩 전체 완료 이벤트.
 * allRequiredDone === true 일 때 tasks/complete route에서 추가 발행.
 */
export interface OnboardingCompletedPayload {
  ctx: EventContext
  employeeOnboardingId: string
  employeeId: string
  companyId: string
  completedAt: Date
}

// ── Offboarding Events ───────────────────────────────────

/**
 * 오프보딩 시작 이벤트.
 * employees/[id]/offboarding/start POST 핸들러에서 발행.
 * Session B 핸들러: EmployeeOffboardingTask 중복 가드 (이미 start route에서 생성됨)
 */
export interface EmployeeOffboardingStartedPayload {
  ctx: EventContext
  employeeId: string
  companyId: string
  offboardingId: string
  resignType: string     // ResignType enum value
  lastWorkingDate: Date
  checklistId: string
  handoverToId?: string
}

/**
 * 오프보딩 개별 태스크 완료 이벤트.
 * offboarding/[id]/tasks/[taskId]/complete PUT 핸들러에서 발행.
 */
export interface OffboardingTaskCompletedPayload {
  ctx: EventContext
  employeeId: string
  companyId: string
  offboardingId: string
  taskId: string         // EmployeeOffboardingTask.id
  completedBy: string
  taskTitle: string
  allRequiredDone: boolean
}

/**
 * 오프보딩 전체 완료 이벤트.
 * allRequiredDone === true 일 때 추가 발행.
 */
export interface OffboardingCompletedPayload {
  ctx: EventContext
  employeeId: string
  companyId: string
  offboardingId: string
  lastWorkingDate: Date
  resignType: string
  completedAt: Date
}

// ── Performance Review Events ─────────────────────────

/**
 * 성과 주기 페이즈 전환 이벤트.
 * DB CycleStatus enum: DRAFT | ACTIVE | EVAL_OPEN | CALIBRATION | CLOSED
 * advance/route.ts (PUT) + finalize/route.ts (POST) 에서 발행.
 *
 * 상태 머신:
 *   DRAFT → ACTIVE → EVAL_OPEN → CALIBRATION → CLOSED
 */
export interface PerformanceCyclePhaseChangedPayload {
  ctx: EventContext
  cycleId: string
  companyId: string
  fromPhase: string   // CycleStatus value
  toPhase: string     // CycleStatus value
  cycleName: string
  year: number
  half: string        // CycleHalf enum value (H1 | H2 | ANNUAL)
}

/**
 * 직원이 MBO 목표를 승인 요청 제출한 이벤트.
 * goals/[id]/submit PUT 핸들러에서 발행.
 */
export interface PerformanceMboGoalSubmittedPayload {
  ctx: EventContext
  employeeId: string
  companyId: string
  cycleId: string
  goalCount: number         // 플리코된 내 PENDING_APPROVAL 전환 목표 수
  totalWeight: number       // 가중치 합계 (= 100 유효성 검증 후)
}

/**
 * 매니저가 MBO 목표를 승인하거나 수정 요청한 이벤트.
 * goals/[id]/approve PUT → APPROVED
 * goals/[id]/request-revision PUT → REVISION_REQUESTED
 */
export interface PerformanceMboGoalReviewedPayload {
  ctx: EventContext
  employeeId: string      // 목표 소유 직원
  companyId: string
  cycleId: string
  reviewerId: string      // 승인/수정 요청 매니저
  decision: 'APPROVED' | 'REVISION_REQUESTED'
  goalId: string
  comment?: string        // 수정 사유 (수정 요청시)
}

/**
 * 직원이 자기평가를 제출한 이벤트.
 * evaluations/self POST (status='SUBMITTED') 일 때 발행.
 */
export interface PerformanceSelfEvalSubmittedPayload {
  ctx: EventContext
  employeeId: string
  companyId: string
  cycleId: string
  evaluationId: string
  performanceScore: number
  competencyScore: number
}

/**
 * 매니저가 팀원 평가를 제출한 이벤트.
 * evaluations/manager POST (status='SUBMITTED') 일 때 발행.
 */
export interface PerformanceManagerEvalSubmittedPayload {
  ctx: EventContext
  employeeId: string      // 평가 대상 직원
  companyId: string
  cycleId: string
  evaluatorId: string     // 평가한 매니저
  evaluationId: string
  performanceScore: number
  competencyScore: number
  emsBlock: string        // EMS 블록 코드 (e.g., 'A1', 'B2')
}

/**
 * 성과 주기 최종 확정 이벤트 (CALIBRATION → CLOSED).
 * finalize/route.ts POST에서 PERFORMANCE_CYCLE_PHASE_CHANGED와 함께 발행.
 */
export interface PerformanceCycleFinalizedPayload {
  ctx: EventContext
  cycleId: string
  companyId: string
  cycleName: string
  year: number
  half: string            // CycleHalf
  totalEvaluated: number  // 확정된 평가 수 (SUBMITTED 기준)
}

// ── GP#4 Session B: Pipeline Events ──────────────────────

export interface GoalOverduePayload {
  ctx: EventContext
  cycleId: string
  companyId: string
  overdueEmployeeIds: string[]
  overdueCount: number
  daysSinceDeadline: number
}

export interface CheckinCompletedPayload {
  ctx: EventContext
  cycleId: string
  employeeId: string
  companyId: string
}

export interface CheckinOverduePayload {
  ctx: EventContext
  cycleId: string
  companyId: string
  overdueEmployeeIds: string[]
  overdueCount: number
  checkInMode: string  // MANDATORY | RECOMMENDED
}

export interface SelfEvalOverduePayload {
  ctx: EventContext
  cycleId: string
  companyId: string
  overdueEmployeeIds: string[]
  overdueCount: number
  daysSinceDeadline: number
}

export interface PeerNominationCompletedPayload {
  ctx: EventContext
  cycleId: string
  employeeId: string  // 피평가자
  companyId: string
  nomineeIds: string[]
  nomineeCount: number
}

export interface PeerEvalSubmittedPayload {
  ctx: EventContext
  cycleId: string
  nominationId: string
  reviewerId: string   // 동료 평가자
  employeeId: string   // 피평가자
  companyId: string
  allPeersDone: boolean
}

export interface CalibrationAdjustedPayload {
  ctx: EventContext
  cycleId: string
  employeeId: string
  companyId: string
  originalGrade: string
  adjustedGrade: string
  reason: string
}

export interface CalibrationApprovedPayload {
  ctx: EventContext
  cycleId: string
  companyId: string
  approvedBy: string
  totalEmployees: number
  adjustedCount: number
}

export interface ResultNotifiedPayload {
  ctx: EventContext
  cycleId: string
  employeeId: string
  companyId: string
  notifiedBy: string  // managerId
  finalGrade: string
}

export interface ResultAcknowledgedPayload {
  ctx: EventContext
  cycleId: string
  employeeId: string
  companyId: string
  isAutoAcknowledged: boolean
  allDone: boolean  // true면 전체 사이클 CLOSED 가능
}

export interface CompReviewStartedPayload {
  ctx: EventContext
  cycleId: string
  companyId: string
  totalEmployees: number
}

export interface CompExceptionFlaggedPayload {
  ctx: EventContext
  cycleId: string
  employeeId: string
  companyId: string
  recommendedPct: number
  actualPct: number
  reason: string
}

export interface CompApprovedPayload {
  ctx: EventContext
  cycleId: string
  companyId: string
  approvedBy: string
  totalEmployees: number
  totalBudgetImpact: number
  payrollRunId?: string
}

// ------------------------------------
// Discriminated Union (Event Map)
// ------------------------------------

export interface DomainEventMap {
  LEAVE_APPROVED: LeaveApprovedPayload
  LEAVE_REJECTED: LeaveRejectedPayload
  LEAVE_CANCELLED: LeaveCancelledPayload
  LEAVE_REQUESTED: LeaveRequestedPayload
  PAYROLL_CALCULATED: PayrollCalculatedPayload
  PAYROLL_APPROVED: PayrollApprovedPayload
  PAYROLL_PAID: PayrollPaidPayload
  // GP#3 pipeline events
  PAYROLL_ATTENDANCE_CLOSED: PayrollAttendanceClosedPayload
  PAYROLL_ATTENDANCE_REOPENED: PayrollAttendanceReopenedPayload
  PAYROLL_ADJUSTMENT_ADDED: PayrollAdjustmentAddedPayload
  PAYROLL_REVIEW_READY: PayrollReviewReadyPayload
  PAYROLL_PUBLISHED: PayrollPublishedPayload
  EMPLOYEE_HIRED: EmployeeHiredPayload
  ONBOARDING_TASK_COMPLETED: OnboardingTaskCompletedPayload
  ONBOARDING_COMPLETED: OnboardingCompletedPayload
  EMPLOYEE_OFFBOARDING_STARTED: EmployeeOffboardingStartedPayload
  OFFBOARDING_TASK_COMPLETED: OffboardingTaskCompletedPayload
  OFFBOARDING_COMPLETED: OffboardingCompletedPayload
  // Performance Review
  PERFORMANCE_CYCLE_PHASE_CHANGED: PerformanceCyclePhaseChangedPayload
  PERFORMANCE_MBO_GOAL_SUBMITTED: PerformanceMboGoalSubmittedPayload
  PERFORMANCE_MBO_GOAL_REVIEWED: PerformanceMboGoalReviewedPayload
  PERFORMANCE_SELF_EVAL_SUBMITTED: PerformanceSelfEvalSubmittedPayload
  PERFORMANCE_MANAGER_EVAL_SUBMITTED: PerformanceManagerEvalSubmittedPayload
  PERFORMANCE_CYCLE_FINALIZED: PerformanceCycleFinalizedPayload
  // GP#4 pipeline events
  GOAL_OVERDUE: GoalOverduePayload
  CHECKIN_COMPLETED: CheckinCompletedPayload
  CHECKIN_OVERDUE: CheckinOverduePayload
  SELF_EVAL_OVERDUE: SelfEvalOverduePayload
  PEER_NOMINATION_COMPLETED: PeerNominationCompletedPayload
  PEER_EVAL_SUBMITTED: PeerEvalSubmittedPayload
  CALIBRATION_ADJUSTED: CalibrationAdjustedPayload
  CALIBRATION_APPROVED: CalibrationApprovedPayload
  RESULT_NOTIFIED: ResultNotifiedPayload
  RESULT_ACKNOWLEDGED: ResultAcknowledgedPayload
  COMP_REVIEW_STARTED: CompReviewStartedPayload
  COMP_EXCEPTION_FLAGGED: CompExceptionFlaggedPayload
  COMP_APPROVED: CompApprovedPayload
}

/** 타입-안전 이벤트 봉투 */
export interface DomainEvent<K extends DomainEventName = DomainEventName> {
  name: K
  payload: DomainEventMap[K]
}

// ------------------------------------
// Handler Interface
// ------------------------------------

/**
 * prisma.$transaction 콜백 인자 타입을 generic으로 추상화.
 * circular import 없이 handler가 tx 클라이언트를 받을 수 있음.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TxClient = any

/**
 * 이벤트 핸들러 인터페이스.
 * tx: Prisma 트랜잭션 클라이언트 (동기 실행 — 같은 트랜잭션 내 사용)
 * tx가 undefined이면 트랜잭션 외부 실행 (fire-and-forget 알림 등)
 */
export interface DomainEventHandler<K extends DomainEventName> {
  eventName: K
  handle(payload: DomainEventMap[K], tx?: TxClient): Promise<void>
}

