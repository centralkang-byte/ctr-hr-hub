/**
 * B1: 법인별 커스터마이징 엔진 — 설정 타입 정의
 * 모든 B 세션에서 타입 안전하게 사용
 */

// ─── 공통 ──────────────────────────────────────────────────────

export type GradeItem = {
  code: string
  label: string
  order: number
}

export type DistributionRule = {
  gradeCode: string
  minPct: number
  maxPct: number
}

export type ApprovalStep = {
  stepOrder: number
  approverRole: string
}

// ─── 평가 설정 ────────────────────────────────────────────────

export type EvaluationMethodology = 'MBO_ONLY' | 'MBO_BEI'
export type OverallGradeMethod = 'MATRIX' | 'WEIGHTED' | 'MANUAL'
export type ForcedDistributionType = 'SOFT' | 'HARD'

export interface EvaluationSettings {
  id: string
  companyId: string | null
  methodology: EvaluationMethodology
  mboGrades: GradeItem[]
  beiGrades: GradeItem[]
  overallGradeEnabled: boolean
  overallGradeMethod: OverallGradeMethod
  mboWeight: number
  beiWeight: number
  forcedDistribution: boolean
  forcedDistributionType: ForcedDistributionType
  distributionRules: DistributionRule[]
  reviewProcessOrder: string[]
  createdAt: Date
  updatedAt: Date
}

// ─── 승진 설정 ────────────────────────────────────────────────

export type PromotionCycle = 'ANNUAL' | 'SEMI_ANNUAL' | 'QUARTERLY'

export interface JobLevel {
  code: string
  label: string
  order: number
  trackType?: string
}

export interface PromotionRule {
  fromLevel: string
  toLevel: string
  minMonths: number
  requiredGrade: string
}

export interface PromotionSettings {
  id: string
  companyId: string | null
  jobLevels: JobLevel[]
  promotionRules: PromotionRule[]
  promotionCycle: PromotionCycle
  promotionMonth: number
  approvalChain: ApprovalStep[]
  createdAt: Date
  updatedAt: Date
}

// ─── 보상 설정 ────────────────────────────────────────────────

export type PayComponentType = 'BASE' | 'ALLOWANCE' | 'BONUS' | 'DEDUCTION'
export type BonusType = 'GRADE_BASED' | 'PROFIT_SHARING' | 'MIXED'
export type BandPosition = 'LOWER' | 'MID' | 'UPPER'

export interface PayComponent {
  code: string
  label: string
  type: PayComponentType
  taxable: boolean
  required: boolean
  maxNonTaxable?: number
}

export interface SalaryBandEntry {
  jobLevel: string
  currency: string
  min: number
  mid: number
  max: number
}

export interface RaiseMatrixEntry {
  grade: string
  bandPosition: BandPosition
  raisePct: number
}

export interface BonusRule {
  grade: string
  months?: number
  pct?: number
}

export interface CompensationSettings {
  id: string
  companyId: string | null
  payComponents: PayComponent[]
  salaryBands: SalaryBandEntry[]
  raiseMatrix: RaiseMatrixEntry[]
  bonusType: BonusType
  bonusRules: BonusRule[]
  currency: string
  createdAt: Date
  updatedAt: Date
}

// ─── 근태 설정 (B6 UI) ────────────────────────────────────────

export interface FlexWorkConfig {
  flexEnabled: boolean
  coreTimeStart?: string
  coreTimeEnd?: string
}

export interface AttendanceSettings {
  id: string
  companyId: string | null
  standardHoursPerDay: number
  standardDaysPerWeek: number
  weeklyMaxHours: number
  shiftEnabled: boolean
  flexWork: FlexWorkConfig
  createdAt: Date
  updatedAt: Date
}

// ─── 휴가 설정 (B6 UI) ────────────────────────────────────────

export interface LeaveTypeConfig {
  code: string
  label: string
  paidType: 'PAID' | 'UNPAID' | 'PARTIAL'
  carryOver: boolean
  maxDays?: number
}

export interface AnnualLeaveRule {
  method: 'FIXED' | 'ACCRUAL'
  baseDays: number
  accrualRule?: Array<{ tenureYears: number; days: number }>
}

export interface LeaveSettings {
  id: string
  companyId: string | null
  leaveTypes: LeaveTypeConfig[]
  annualLeaveRule: AnnualLeaveRule
  createdAt: Date
  updatedAt: Date
}

// ─── 온보딩 설정 (B5 UI) ─────────────────────────────────────

export interface ChecklistTask {
  day: number
  title: string
  assigneeRole: string
  category: string
}

export interface EmotionPulseConfig {
  frequency: string
  questionTemplate?: string
  escalationThreshold?: number
}

export interface OnboardingSettings {
  id: string
  companyId: string | null
  checklistTemplate: ChecklistTask[]
  emotionPulse: EmotionPulseConfig
  createdAt: Date
  updatedAt: Date
}

// ─── 승인 플로우 ─────────────────────────────────────────────

export type ApprovalModule = 'benefits' | 'recruitment' | 'leave' | 'promotion' | 'general' | 'payroll' | 'discipline' | 'attendance' | 'certificate' | 'offboarding' | 'personnel_order' | 'probation' | 'contract_conversion'
export type ApproverType = 'role' | 'specific_user'
export type ApproverRole = 'direct_manager' | 'hr_admin' | 'dept_head' | 'finance' | 'ceo'

export interface ApprovalFlowStepData {
  id: string
  flowId: string
  stepOrder: number
  approverType: ApproverType
  approverRole: ApproverRole | null
  approverUserId: string | null
  isRequired: boolean
  autoApproveDays: number | null
  createdAt: Date
}

export interface ApprovalFlowData {
  id: string
  name: string
  description: string | null
  companyId: string | null
  module: ApprovalModule
  deletedAt: string | null
  steps: ApprovalFlowStepData[]
  createdAt: Date
  updatedAt: Date
}

// ─── API 응답 타입 ────────────────────────────────────────────

export type SettingsCategory =
  | 'evaluation'
  | 'promotion'
  | 'compensation'
  | 'attendance'
  | 'leave'
  | 'onboarding'

export interface SettingsResponse<T> {
  data: T
  isOverride: boolean  // true = 법인 커스텀, false = 글로벌 기본값
  companyId: string | null
}
