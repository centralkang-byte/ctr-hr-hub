// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Home Dashboard DTO Types
// Shared DTO between /api/v1/home/summary route and home components.
// Prevents interface drift across 4 role-specific HomeClients.
// ═══════════════════════════════════════════════════════════

// ─── Shared entity types ────────────────────────────────────

/** 온보딩/오프보딩 트래커 item (admin list / team / personal 공통) */
export interface OnboardingItem {
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
}

export interface ExecSummary extends BaseSummary {
  role: 'EXECUTIVE'
  newHires: number
  terminations: number
  turnoverRate: number
  openPositions: number
  pendingLeaves: number
}

/** Discriminated union — role로 좁혀 사용 */
export type HomeSummary =
  | EmployeeSummary
  | ManagerSummary
  | HrAdminSummary
  | ExecSummary
