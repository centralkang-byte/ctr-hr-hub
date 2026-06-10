// DESIGN.md Section 5 — Status Badge Color Mapping (6 categories)
// 모든 상태 뱃지 색상의 단일 소스. 페이지별 개별 hex 하드코딩 금지.

// ─── Types ──────────────────────────────────────────────────

export type StatusCategory = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent'

// ─── Badge FG (WCAG AA 4.5:1+ on white) ────────────────────

/** 뱃지 텍스트 전경색 — WCAG AA 대비비 충족을 위해 차트/BG 색상보다 약간 진한 값
 *  Wave 0: proto 시맨틱 패밀리 ink 파생 — success oklch(46% .12 155) 6.64:1, error oklch(50% .19 25) 5.57:1 */
export const STATUS_BADGE_FG: Record<StatusCategory, string> = {
  success: '#006b39',
  warning: '#b45309', // 유지 — proto #d0901e는 텍스트 AA 미달 (D17 bg/text 분리, Gate1)
  error: '#b71824',
  info: 'hsl(var(--wt-7))',   // P2a-status: Workday steel-blue SSOT
  neutral: '#64748b',
  accent: 'hsl(var(--wt-4))', // P2a-status: Workday purple SSOT
} as const

// ─── Chart / Inline FG & BG ────────────────────────────────

/** 시맨틱 foreground 색상 (차트·아이콘용 — 텍스트는 STATUS_BADGE_FG 사용)
 *  Wave 0: proto --success/--danger (styles.css :root oklch) */
export const STATUS_FG: Record<StatusCategory, string> = {
  success: '#008b4e',
  warning: '#b45309',
  error: '#d73337',
  info: 'hsl(var(--wt-7))',   // P2a-status: Workday steel-blue SSOT
  neutral: '#64748b',
  accent: 'hsl(var(--wt-4))', // P2a-status: Workday purple SSOT
} as const

/** 시맨틱 background 색상 (차트 fill, 배경색용) — Wave 0: proto -soft (warning은 AA 4.51:1 위해 house 유지) */
export const STATUS_BG: Record<StatusCategory, string> = {
  success: '#d8f8e2',
  warning: '#fef3c7',
  error: '#ffe6e1',
  info: 'hsl(var(--wt-7) / 0.14)',   // P2a-status: steel-blue soft tint SSOT
  neutral: '#f1f5f9',
  accent: 'hsl(var(--wt-4) / 0.14)', // P2a-status: purple soft tint SSOT
} as const

// ─── STATUS_MAP — status string → category ─────────────────

/** 전체 도메인의 status enum → StatusCategory 매핑 (SSOT) */
export const STATUS_MAP: Record<string, StatusCategory> = {
  // ─── Common (shared across domains) ───
  DRAFT: 'neutral',
  PENDING: 'warning',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  ACTIVE: 'success',
  FAILED: 'error',
  EXPIRED: 'neutral',
  SCHEDULED: 'info',
  ABSENT: 'error',
  NOT_STARTED: 'neutral',

  // ─── Employee ───
  PROBATION: 'warning',
  ON_LEAVE: 'accent',
  RESIGNED: 'error',
  TERMINATED: 'error',
  INACTIVE: 'neutral',

  // ─── Leave ───
  // PENDING, APPROVED, REJECTED, CANCELLED → common

  // ─── LOA ───
  REQUESTED: 'warning',
  RETURN_REQUESTED: 'info',
  // ACTIVE → common (success). LOA pages override with variant="accent"

  // ─── Attendance ───
  NORMAL: 'success',
  LATE: 'error',
  EARLY_OUT: 'warning',
  HOLIDAY: 'info',

  // ─── Shift ───
  WORKED: 'success',
  SWAPPED: 'warning',
  SCR_PENDING: 'warning',
  SCR_APPROVED: 'success',
  SCR_REJECTED: 'error',

  // ─── Payroll pipeline ───
  ATTENDANCE_CLOSED: 'info',
  CALCULATING: 'info',
  ADJUSTMENT: 'info',
  REVIEW: 'warning',
  PAID: 'success',
  PUBLISHED: 'success',

  // ─── Bank Transfer ───
  GENERATING: 'info',
  GENERATED: 'success',
  SUBMITTED: 'info',
  PARTIALLY_COMPLETED: 'warning',
  SUCCESS: 'success',

  // ─── Recruitment ───
  OPEN: 'info',
  CLOSED: 'neutral',
  FILLED: 'success',
  APPLIED: 'info',
  SCREENING: 'info',
  OFFER: 'accent',
  OFFER_ACCEPTED: 'success',
  HIRED: 'success',
  OFFER_DECLINED: 'error',
  NO_SHOW: 'error',
  INTERVIEW_1: 'info',
  INTERVIEW_2: 'info',
  FINAL: 'info',

  // ─── Probation ───
  PASSED: 'success',
  WAIVED: 'neutral',

  // ─── Performance — Cycle (9-state) ───
  EVAL_OPEN: 'info',
  CHECK_IN: 'info',
  CALIBRATION: 'warning',
  FINALIZED: 'success',
  COMP_REVIEW: 'warning',
  COMP_COMPLETED: 'success',

  // ─── Performance — Review (7-state) ───
  GOAL_SETTING: 'info',
  SELF_EVAL: 'info',
  PEER_EVAL: 'info',
  MANAGER_EVAL: 'info',
  CALIBRATED: 'warning',
  NOTIFIED: 'success',
  ACKNOWLEDGED: 'success',

  // ─── Performance — Goal ───
  ON_TRACK: 'success',
  AT_RISK: 'warning',
  BEHIND: 'error',

  // ─── Performance — Eval / Quarterly Review ───
  EMPLOYEE_DONE: 'warning',
  MANAGER_DONE: 'warning',
  CONFIRMED: 'success',

  // ─── Performance — Calibration ───
  CALIBRATION_DRAFT: 'neutral',
  CALIBRATION_IN_PROGRESS: 'info',
  CALIBRATION_COMPLETED: 'success',

  // ─── Off-Cycle Compensation ───
  // DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, CANCELLED → common

  // ─── Onboarding ───
  SUSPENDED: 'warning',
  ARCHIVED: 'neutral',

  // ─── Offboarding / Resignation Types ───
  VOLUNTARY: 'neutral',
  INVOLUNTARY: 'error',
  RETIREMENT: 'accent',
  CONTRACT_END: 'neutral',
  MUTUAL_AGREEMENT: 'neutral',

  // ─── Discipline ───
  DISCIPLINE_ACTIVE: 'error',
  DISCIPLINE_EXPIRED: 'neutral',
  DISCIPLINE_OVERTURNED: 'success',

  // ─── Appeal ───
  NONE: 'neutral',
  FILED: 'warning',
  UNDER_REVIEW: 'warning',
  UPHELD: 'error',
  OVERTURNED: 'success',

  // ─── Compliance ───
  ISSUED: 'success',
  PENDING_SIGNATURE: 'warning',
  SIGNED: 'success',
  PENDING_RENEWAL: 'warning',
  REVOKED: 'error',
  DPIA_DRAFT: 'neutral',
  IN_REVIEW: 'warning',
  GDPR_PENDING: 'warning',

  // ─── Benefits / Assets ───
  RETURNED: 'success',
  UNRETURNED: 'error',
  DEDUCTED: 'warning',
  CIVIL_CLAIM: 'error',

  // ─── Entity Transfer ───
  TRANSFER_REQUESTED: 'warning',
  FROM_APPROVED: 'info',
  TO_APPROVED: 'info',
  EXEC_APPROVED: 'info',
  TRANSFER_PROCESSING: 'info',
  TRANSFER_COMPLETED: 'success',
  TRANSFER_CANCELLED: 'error',
  DATA_PENDING: 'warning',
  DATA_MIGRATED: 'success',
  DATA_FAILED: 'error',

  // ─── Task ───
  DONE: 'success',
  SKIPPED: 'neutral',
  BLOCKED: 'error',

  // ─── Migration ───
  VALIDATING: 'info',
  VALIDATED: 'success',
  RUNNING: 'info',
  ROLLED_BACK: 'error',

  // ─── Severance Interim ───
  SIP_PENDING: 'warning',
  SIP_APPROVED: 'success',
  SIP_REJECTED: 'error',
  SIP_PAID: 'success',

  // ─── System ───
  M365_PENDING: 'warning',
  M365_SUCCESS: 'success',
  M365_FAILED: 'error',
  RESOLVED: 'success',
  WHITELISTED: 'neutral',

  // ─── Delegation ───
  // ACTIVE, EXPIRED, REVOKED → common/compliance

  // ─── AI Report ───
  // GENERATING, GENERATED → bank transfer section

  // ─── Training Enrollment ───
  ENROLLED: 'info',
  ENROLLMENT_COMPLETED: 'success',
  DROPPED: 'error',

  // ─── Change Request ───
  CHANGE_PENDING: 'warning',
  CHANGE_APPROVED: 'success',
  CHANGE_REJECTED: 'error',

  // ─── Succession Plan ───
  PLAN_DRAFT: 'neutral',
  PLAN_ACTIVE: 'info',

  // ─── Pulse Survey ───
  PULSE_DRAFT: 'neutral',
  PULSE_ACTIVE: 'info',
  PULSE_CLOSED: 'neutral',

  // ─── Compensation Letter ───
  SENT: 'success',

  // ─── Succession Risk ───
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'error',
} as const

// ─── Resolver ───────────────────────────────────────────────

/** status 문자열 → StatusCategory 자동 변환 (case-insensitive, fallback: neutral) */
export function resolveStatusCategory(status: string): StatusCategory {
  const key = status.toUpperCase()
  return STATUS_MAP[key] ?? 'neutral'
}

// ─── Deprecated (다음 배치에서 삭제 예정) ───────────────────

/** @deprecated badge.tsx CVA로 대체됨. 마이그레이션 완료 후 삭제. */
export const STATUS_VARIANT = {
  /** 승인 / 정상 / 완료 / 활성 */
  success: 'bg-[#008b4e]/10 text-[#006b39]',
  /** 대기 / 수습 / 검토중 */
  warning: 'bg-[#b45309]/10 text-[#b45309]',
  /** 반려 / 오류 / 만료 / 결근 */
  error: 'bg-[#d73337]/10 text-[#b71824]',
  /** 진행중 / 온보딩 / 참고 */
  info: 'bg-primary/10 text-primary',
  /** 미시작 / 초안 / 취소 / 비활성 */
  neutral: 'bg-[#f1f5f9] text-[#64748b]',
  /** @deprecated info로 통합됨 */
  primary: 'bg-primary/10 text-primary',
  /** 오퍼 / 휴직 / 출장 */
  accent: 'bg-wt-4/10 text-wt-4',
} as const

export type StatusVariant = keyof typeof STATUS_VARIANT
