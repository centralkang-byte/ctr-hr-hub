// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Nudge System Type Definitions
// src/lib/nudge/types.ts
// ═══════════════════════════════════════════════════════════
//
// Nudge = 처리 지연된 태스크에 대한 자동 리마인더
//
// 설계 원칙:
//   - Rule-based: 각 룰이 WHAT / WHEN / WHO / HOW를 정의
//   - Configurable: 임계값은 룰 정의에서 설정 (하드코딩 없음)
//   - History: Notification 테이블 재활용 (triggerType 패턴)
//   - Trigger: Login/Dashboard 요청 시 lazy evaluation (D-3)
// ═══════════════════════════════════════════════════════════

// ------------------------------------
// Nudge Thresholds
// ------------------------------------

export interface NudgeThresholds {
  /** 첫 번째 nudge를 보낼 경과 일수 */
  triggerAfterDays: number
  /** 이후 반복 간격 (일) */
  repeatEveryDays: number
  /** 최대 nudge 횟수 (이후 spam 방지로 중단) */
  maxNudges: number
}

// ------------------------------------
// Overdue Item (룰이 찾아낸 지연 항목)
// ------------------------------------

export interface OverdueItem {
  /** 원본 레코드 PK */
  sourceId: string
  /** Prisma 모델명 */
  sourceModel: string
  /** 알림 받을 대상 employeeId 목록 */
  recipientIds: string[]
  /** 항목이 생성된 시각 (경과 계산 기준) */
  createdAt: Date
  /** UI 표시용 제목 (알림 body에 포함) */
  displayTitle: string
  /** 처리 페이지 링크 */
  actionUrl: string
  /** 추가 메타데이터 (알림 metadata에 포함) */
  meta?: Record<string, unknown>
}

// ------------------------------------
// Nudge Rule Interface
// ------------------------------------

export interface NudgeRule {
  /** 고유 식별자 (e.g., 'leave-pending-approval') */
  ruleId: string
  /** 사람이 읽을 수 있는 설명 */
  description: string
  /** 소스 모델 (감사 추적용) */
  sourceModel: string
  /** 룰이 적용될 companyId — 실행 시 주입 */
  // companyId는 evaluate() 인자로 전달

  /** 임계값 설정 */
  thresholds: NudgeThresholds

  /** 알림 triggerType (e.g., 'nudge_leave_pending') */
  triggerType: string
  /** 알림 제목 생성기 */
  buildTitle(item: OverdueItem): string
  /** 알림 본문 생성기 */
  buildBody(item: OverdueItem, daysOverdue: number): string

  /**
   * 처리 지연된 항목을 DB에서 조회
   * @param companyId    법인 필터
   * @param assigneeId   담당자 필터 (login user — 자신 관련 항목만 조회)
   * @param cutoffDate   createdAt < cutoffDate 인 항목만 (triggerAfterDays 적용)
   */
  findOverdueItems(
    companyId: string,
    assigneeId: string,
    cutoffDate: Date,
  ): Promise<OverdueItem[]>
}

// ------------------------------------
// Nudge Config (엔진 설정)
// ------------------------------------

export interface NudgeEngineConfig {
  /** 등록된 룰 목록 */
  rules: NudgeRule[]
  /** 동일 소스에 대해 하루 1회 이상 nudge 금지 (default: true) */
  oncePer24h?: boolean
}

// ------------------------------------
// Nudge Result (실행 결과 감사용)
// ------------------------------------

export interface NudgeResult {
  ruleId: string
  sourceId: string
  recipientId: string
  sent: boolean
  reason?: string  // 미발송 사유 ('max_nudges_reached' | 'cooldown' | 'no_recipients')
}

export interface NudgeRunSummary {
  evaluatedAt: Date
  companyId: string
  assigneeId: string
  totalRules: number
  totalChecked: number
  totalSent: number
  results: NudgeResult[]
}
