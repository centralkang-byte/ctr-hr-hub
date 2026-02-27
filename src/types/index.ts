// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Global Types
// ═══════════════════════════════════════════════════════════

// Re-export Prisma generated types
export type {
  Company,
  Department,
  JobGrade,
  JobCategory,
  Role,
  Permission as PrismaPermission,
  RolePermission,
  EmployeeRole,
  Employee,
  EmployeeAuth,
  SsoIdentity,
  SsoSession,
  EmployeeHistory,
  EmployeeDocument,
  Attendance,
  AttendanceTerminal,
  LeavePolicy,
  EmployeeLeaveBalance,
  LeaveRequest,
  Holiday,
  JobPosting,
  Applicant,
  Application,
  InterviewSchedule,
  InterviewEvaluation,
  CompetencyLibrary,
  PerformanceCycle,
  MboGoal,
  MboProgress,
  PerformanceEvaluation,
  EmsBlockConfig,
  OneOnOne,
  Recognition,
  CalibrationRule,
  CalibrationSession,
  CalibrationAdjustment,
  SalaryBand,
  CompensationHistory,
  SalaryAdjustmentMatrix,
  BenefitPolicy,
  EmployeeBenefit,
  AllowanceRecord,
  PayrollRun,
  PayrollItem,
  NotificationTrigger,
  Notification,
  AiLog,
  TrainingCourse,
  TrainingEnrollment,
  PulseSurvey,
  PulseQuestion,
  PulseResponse,
  ProfileChangeRequest,
  SuccessionPlan,
  SuccessionCandidate,
  AttritionRiskHistory,
  AuditLog,
  HrDocument,
  HrDocumentChunk,
  HrChatSession,
  HrChatMessage,
  CollaborationScore,
  PeerReviewNomination,
  TenantSetting,
  TermOverride,
  TenantEnumOption,
  CustomField,
  CustomFieldValue,
  WorkflowRule,
  WorkflowStep,
  EmailTemplate,
  ExportTemplate,
  DisciplinaryAction,
  RewardRecord,
  OnboardingTemplate,
  OnboardingTask,
  EmployeeOnboarding,
  EmployeeOnboardingTask,
  OnboardingCheckin,
  OffboardingChecklist,
  OffboardingTask,
  EmployeeOffboarding,
  EmployeeOffboardingTask,
  ExitInterview,
  OrgChangeHistory,
  WorkSchedule,
  EmployeeSchedule,
} from '@/generated/prisma/client'

export {
  type CompanyPayrollMode,
  type EmploymentType,
  type EmployeeStatus,
  type HistoryChangeType,
  type DocType,
  type ScheduleType,
  type ClockMethod,
  type WorkType,
  type AttendanceStatus,
  type TerminalType,
  type LeaveType,
  type LeaveRequestStatus,
  type PostingStatus,
  type ApplicantSource,
  type ApplicationStage,
  type InterviewStatus,
  type InterviewRecommendation,
  type CycleHalf,
  type CycleStatus,
  type GoalStatus,
  type EvalType,
  type EvalStatus,
  type OneOnOneStatus,
  type CalibrationStatus,
  type CompensationChangeType,
  type BenefitCategory,
  type BenefitFrequency,
  type BenefitEnrollmentStatus,
  type AllowanceType,
  type PayrollStatus,
  type NotificationChannel,
  type AiFeature,
  type TrainingCategory,
  type EnrollmentStatus,
  type PulseScope,
  type AnonymityLevel,
  type PulseStatus,
  type QuestionType,
  type ChangeRequestStatus,
  type Criticality,
  type PlanStatus,
  type Readiness,
  type HrDocType,
  type ChatRole,
  type ChatFeedback,
  type CollabScoreType,
  type NominationSource,
  type NominationStatus,
  type CustomFieldType,
  type ApproverType,
  type TemplateChannel,
  type ExportFormat,
  type JobCategoryCode,
  type OnboardingTargetType,
  type OnboardingAssignee,
  type OnboardingTaskCategory,
  type OnboardingProgressStatus,
  type TaskProgressStatus,
  type Mood,
  type DisciplinaryType,
  type DisciplinaryCategory,
  type AppealStatus,
  type RewardType,
  type WorkMode,
  type InterviewType,
  type InterviewRound,
  type DisciplinaryStatus,
  type OffboardingTargetType,
  type OffboardingAssignee,
  type OffboardingStatus,
  type TaskStatus,
  type ExitReason,
  type ResignType,
  type OrgChangeType,
} from '@/generated/prisma/enums'

// ─── Permission (RBAC) ────────────────────────────────────

export interface Permission {
  module: string
  action: string
}

// ─── Session / Auth ───────────────────────────────────────

export interface SessionUser {
  id: string
  employeeId: string
  companyId: string
  name: string
  email: string
  role: string
  permissions: Permission[]
}

// ─── API Response Types ───────────────────────────────────

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiResponse<T> {
  data: T
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationInfo
}

export interface ApiErrorDetail {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ApiErrorResponse {
  error: ApiErrorDetail
}

// ─── Common utility types ─────────────────────────────────

export type SortDirection = 'asc' | 'desc'

// ─── Reference data option types ──────────────────────────

export interface RefOption {
  id: string
  name: string
}

export interface DeptOption {
  id: string
  name: string
  companyId: string
}

export interface ListQueryParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortDir?: SortDirection
}

// ─── Tenant Customization Types ───────────────────────────

export interface CoreValue {
  key: string
  label: string
  icon: string
  color: string
}

export interface RatingScale {
  min: number
  max: number
  labels: string[]
}

export interface GradeLabels {
  [grade: string]: string
}

export interface BrandColors {
  primary: string
  secondary: string | null
  accent: string
}

export interface DashboardLayout {
  [role: string]: {
    widgets: string[]
    sort_order: number[]
  }
}
