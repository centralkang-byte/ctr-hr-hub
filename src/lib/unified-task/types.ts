// ═══════════════════════════════════════════════════════════
// CTR HR Hub — UnifiedTask Interface Contract
// Stage 2, Task 1 of v3.0 Roadmap
// ═══════════════════════════════════════════════════════════
// 설계 원칙:
//   - API Aggregation 패턴 (D-1): 새 DB 모델 없음
//   - 각 소스 모델(LeaveRequest, PayrollRun 등)을 런타임에 변환
//   - 확장 가능한 enum 구조 (향후 소스 추가 용이)
// ═══════════════════════════════════════════════════════════

// ------------------------------------
// Enums
// ------------------------------------

/** 태스크 소스 타입. 새 모듈 추가 시 여기에 enum value 추가 */
export enum UnifiedTaskType {
  // Stage 1 소스
  LEAVE_APPROVAL = 'LEAVE_APPROVAL',
  PAYROLL_REVIEW = 'PAYROLL_REVIEW',

  // Stage 3+ 예정
  ONBOARDING_TASK = 'ONBOARDING_TASK',
  PERFORMANCE_REVIEW = 'PERFORMANCE_REVIEW',
  BENEFIT_REQUEST = 'BENEFIT_REQUEST',
  OFFBOARDING_TASK = 'OFFBOARDING_TASK',
}

/** 통합 상태. 각 소스의 세부 상태는 metadata에 보존 */
export enum UnifiedTaskStatus {
  PENDING = 'PENDING',         // 대기 중 (승인/처리 필요)
  IN_PROGRESS = 'IN_PROGRESS', // 진행 중 (다단계 승인의 중간 단계 등)
  COMPLETED = 'COMPLETED',     // 완료 (승인됨/처리됨)
  REJECTED = 'REJECTED',       // 반려/거절
  CANCELLED = 'CANCELLED',     // 신청자 취소
}

export enum UnifiedTaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// ------------------------------------
// Core Interface
// ------------------------------------

export interface UnifiedTaskActor {
  employeeId: string
  name: string
  position?: string      // 직위 (e.g., "책임매니저")
  department?: string    // 부서명
  avatarUrl?: string
}

export interface UnifiedTask {
  // === Identity ===
  /** 복합 키: `${sourceModel}:${sourceId}` (e.g., "LeaveRequest:clx123") */
  id: string
  type: UnifiedTaskType
  status: UnifiedTaskStatus
  priority: UnifiedTaskPriority

  // === Display ===
  title: string      // UI 표시용 (e.g., "연차 3일 신청 — 김철수")
  summary?: string   // 부가 설명 (e.g., "2026-03-10 ~ 2026-03-12")

  // === People ===
  requester: UnifiedTaskActor   // 신청자/대상자
  assignee: UnifiedTaskActor    // 현재 처리 담당자 (승인권자)

  // === Timing ===
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
  dueDate?: string    // 처리 기한 (있는 경우)

  // === Source Tracing ===
  sourceId: string      // 원본 레코드 PK
  sourceModel: string   // Prisma 모델명 (e.g., "LeaveRequest", "PayrollRun")
  actionUrl: string     // 상세/처리 페이지 경로 (e.g., "/leave/team")

  // === Company Context ===
  companyId: string   // 법인 필터링용

  // === Extensible Metadata ===
  metadata: Record<string, unknown>
  // 소스별 원본 상태, 금액, 일수 등 자유 형식
  // e.g., LeaveRequest: { leaveType: "ANNUAL", days: 3, originalStatus: "PENDING" }
  // e.g., PayrollRun:   { period: "2026-03", totalAmount: 45000000, headcount: 150 }
}

// ------------------------------------
// Mapper Contract (각 소스별 구현)
// ------------------------------------

/**
 * 소스 모델 → UnifiedTask 변환기 인터페이스.
 * 각 모듈에서 이 인터페이스를 구현하여 자기 데이터를 통합 형식으로 변환.
 *
 * 구현 위치:
 *   - src/lib/unified-task/mappers/leave.mapper.ts
 *   - src/lib/unified-task/mappers/payroll.mapper.ts
 */
export interface UnifiedTaskMapper<TSource> {
  type: UnifiedTaskType
  toUnifiedTask(source: TSource): UnifiedTask
  toUnifiedTasks(sources: TSource[]): UnifiedTask[]
}

// ------------------------------------
// Query / Filter
// ------------------------------------

export interface UnifiedTaskFilter {
  types?: UnifiedTaskType[]
  statuses?: UnifiedTaskStatus[]
  priorities?: UnifiedTaskPriority[]
  assigneeId?: string
  requesterId?: string
  companyId?: string
  dateRange?: {
    from?: string   // ISO 8601
    to?: string
  }
}

export interface UnifiedTaskSortOption {
  field: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority'
  direction: 'asc' | 'desc'
}

export interface UnifiedTaskListParams {
  filter?: UnifiedTaskFilter
  sort?: UnifiedTaskSortOption
  page?: number
  limit?: number
}

export interface UnifiedTaskListResponse {
  items: UnifiedTask[]
  total: number
  page: number
  limit: number
  /** 소스별 카운트 (뱃지 표시용) */
  countByType: Partial<Record<UnifiedTaskType, number>>
  /** 상태별 카운트 */
  countByStatus: Partial<Record<UnifiedTaskStatus, number>>
}

// ------------------------------------
// Status Mapping Reference
// ------------------------------------
//
// LeaveRequest → UnifiedTaskStatus:
//   PENDING        → PENDING
//   APPROVED       → COMPLETED
//   REJECTED       → REJECTED
//   CANCELLED      → CANCELLED
//
// PayrollRun → UnifiedTaskStatus:
//   DRAFT          → PENDING
//   CALCULATING    → IN_PROGRESS
//   REVIEW         → IN_PROGRESS
//   APPROVED       → COMPLETED
//   PAID           → COMPLETED
//   CANCELLED      → CANCELLED
//
// Priority inference:
//   LeaveRequest: PENDING > 3일 = HIGH, else MEDIUM
//   PayrollRun: REVIEW = HIGH, DRAFT = MEDIUM
