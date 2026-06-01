// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Home Dashboard DTO Types
// Shared DTO between /api/v1/home/summary route and home components.
// Prevents interface drift across 4 role-specific HomeClients.
// ═══════════════════════════════════════════════════════════

// ─── Shared entity types ────────────────────────────────────

/** 온보딩/오프보딩 트래커 item (admin list / team / personal 공통) */
export interface OnboardingItem {
  /**
   * 인스턴스 ID — 온보딩 리스트면 EmployeeOnboarding.id, 오프보딩이면 EmployeeOffboarding.id.
   * 역할/ACL이 허용될 때 `/onboarding/[id]` 또는 `/offboarding/[id]` 라우트로 연결.
   */
  recordId: string
  employeeId: string
  name: string
  department?: string | null
  /** ISO date — 입사일 or 시작일 */
  startDate?: string | null
  /**
   * 오늘 기준 D-day (음수 = 시작 전, 양수 = 진행 중, null = 알 수 없음)
   * 예: -5 → D-5, 3 → D+3
   */
  daysUntilStart?: number | null
  /** 0~100 */
  progress: number
  completedTasks: number
  totalTasks: number
}

/** 휴가 잔여 밸런스 (Employee 역할용) */
export interface LeaveBalanceItem {
  policy: string
  leaveType: string
  remaining: number
  used: number
  total: number
}

/** 분기 리뷰 통계 (Manager/HrAdmin 공통) */
export interface QuarterlyReviewStats {
  total: number
  completed: number
  pending: number
  completionRate?: number
}

/**
 * Trend 버킷 — sparkline 입력.
 * bucket: ISO date(일별) 또는 ISO week start(주별), value: 해당 버킷 집계치.
 * R2 pilot: pending leave 7d + 1:1 미팅 4w에 사용.
 */
export interface TrendPoint {
  bucket: string
  value: number
}

// ─── Base summary ───────────────────────────────────────────

interface BaseSummary {
  role: string
  totalEmployees: number
}

// ─── Per-role summary shapes ────────────────────────────────

export interface EmployeeSummary extends BaseSummary {
  role: 'EMPLOYEE'
  leaveBalance: LeaveBalanceItem[]
  attendanceThisMonth: number
  quarterlyReview?: { id: string | null; status: string | null }
  myOnboarding?: OnboardingItem | null
  myOffboarding?: OnboardingItem | null
  /** R3: 같은 매니저를 공유하는 동료 수 (본인 제외). 최상위/무소속은 0. */
  myTeamSize: number
}

export interface ManagerSummary extends BaseSummary {
  role: 'MANAGER'
  teamCount: number
  pendingLeaves?: number
  overdueLeaves?: number
  scheduledOneOnOnes?: number
  goalAchievement?: number // 0~100
  quarterlyReviewStats?: QuarterlyReviewStats
  teamOnboarding?: OnboardingItem[]
  teamOffboarding?: OnboardingItem[]
  /** R2 pilot: 지난 7일간 신규 휴가 요청 추이 (현재 PENDING 기준, 제출일 기준 버킷) */
  pendingLeavesTrend?: TrendPoint[]
  /** R2 pilot: 지난 4주간 1:1 미팅 예정/완료 합계 (주별 버킷) */
  oneOnOneTrend?: TrendPoint[]
}

/**
 * PR-5A: HR Admin dashboard — top pending approvals 카드 표현용.
 * `/api/v1/approvals/inbox` 의 ApprovalItem과 별개 (홈 전용 SSOT).
 */
export interface ApprovalPreviewItem {
  id: string
  requesterName: string
  team: string
  type: 'LEAVE' | 'PAYROLL' | 'OTHER'
  description: string
  /** ISO timestamp (createdAt). caller가 표시 시점 포맷 적용. */
  submittedAt: string
  urgency: 'overdue' | 'today' | 'queued'
  note: string | null
}

export interface HrAdminSummary extends BaseSummary {
  role: 'HR_ADMIN' | 'SUPER_ADMIN'
  newHires: number
  terminations: number
  turnoverRate: number
  openPositions: number
  pendingLeaves: number
  urgentCount?: number
  weekDeadlineCount?: number
  onboardingCount?: number
  quarterlyReviewStats?: QuarterlyReviewStats
  activeOnboarding?: OnboardingItem[]
  activeOffboarding?: OnboardingItem[]
  /** R3: 지난 7일 companyId 범위 PENDING 휴가 요청 제출일 추이 (일별 버킷) */
  pendingLeavesTrend?: TrendPoint[]
  /** R3: 지난 4주 신규 입사자 추이 (주별 버킷, hireDate 기준) */
  newHiresTrend?: TrendPoint[]
  /** PR-5A: 오늘 근태 카운트 (HR/SuperAdmin only). EXECUTIVE 분기에서는 undefined. */
  attendanceToday?: { present: number; late: number; absent: number }
  /** PR-5A: 처리 대기 휴가 요청 top 4 (HR/SuperAdmin only). EXECUTIVE 분기에서는 undefined. */
  topPendingApprovals?: ApprovalPreviewItem[]
}

export interface ExecSummary extends BaseSummary {
  role: 'EXECUTIVE'
  newHires: number
  terminations: number
  turnoverRate: number
  openPositions: number
  pendingLeaves: number
  /** R3: 활성 offboarding list (ExecutiveHomeV2 위젯 입력) */
  activeOffboarding?: OnboardingItem[]
  /** R3: 지난 4주 신규 입사자 추이 (주별 버킷) */
  newHiresTrend?: TrendPoint[]
}

/** Discriminated union — role로 좁혀 사용 */
export type HomeSummary =
  | EmployeeSummary
  | ManagerSummary
  | HrAdminSummary
  | ExecSummary
