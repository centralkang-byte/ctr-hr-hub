# CTR HR Hub — UnifiedTask Hub 설계서 v1.0

> **문서 목적:** UnifiedTask Hub(통합 업무함) 설계안. 모든 파이프라인을 연결하는 중추 시스템의 아키텍처 기준 문서.
> **작성일:** 2026-03-11
> **버전:** v1.1 (v1.0 + 90일 타임박스 롤링 윈도우 반영 + v1.1a 교차검토: GP#2→GP#3 번호 수정 + v1.1b 코드스캔 검증: CycleStatus 7단계 + BENEFIT_REQUEST 이슈 기록)

---

## 1. 왜 UnifiedTask Hub가 필요한가

CTR HR Hub에는 6개 파이프라인이 있고, 각각 "해야 할 일"을 만들어냅니다:

| 파이프라인 | 만들어지는 태스크 예시 |
|-----------|---------------------|
| GP#1 휴가 | "김대리 휴가 승인 대기" |
| GP#3 급여 | "2월 급여 검토 필요" |
| GP#4 성과 | "MBO 목표 제출 마감 D-3" |
| Onboarding | "신입 IT 계정 생성" |
| Offboarding | "퇴직자 장비 반납 확인" |

**문제:** 각 모듈에 흩어져 있으면 매니저가 5개 메뉴를 돌아다녀야 합니다. 직원도 "내가 지금 뭘 해야 하는지" 한눈에 파악이 안 됩니다.

**해결:** **하나의 통합 업무함**에서 모든 파이프라인의 "할 일"을 한눈에 보여줍니다. Workday의 **"My Tasks"** 또는 FLEX의 **"360° Workflow"**에 해당합니다.

### 비유

UnifiedTask Hub는 **공항 출발 안내 전광판**입니다. 대한항공, 아시아나, 제주항공(= 각 파이프라인)이 각자 비행기를 운영하지만, 승객(= 직원/매니저/HR)은 **하나의 전광판**에서 자기가 탈 비행기(= 해야 할 일)를 확인합니다.

---

## 2. 🚨 핵심 아키텍처 원칙: API Aggregation (D-1 결정)

> **이 결정은 UnifiedTask Hub 전체를 관통하는 가장 중요한 원칙입니다.**

### 문제

"모든 파이프라인의 태스크를 한 곳에서 보려면, 통합 태스크 테이블이 필요하지 않을까?"

### 해결: 새 DB 모델 없이 API 조합으로 해결

```
UnifiedTask Hub API 호출 시:
    ↓
각 파이프라인의 기존 모델을 조회:
  ├ LeaveRequest (GP#1) — PENDING 건 조회
  ├ PayrollRun (GP#2) — 검토 필요 건 조회
  ├ EmployeeOnboardingTask (Onboarding) — 미완료 태스크 조회
  ├ EmployeeOffboardingTask (Offboarding) — 미완료 태스크 조회
  └ MboGoal + PerformanceEvaluation (GP#4) — 사이클 단계별 동적 계산
    ↓
각 매퍼가 공통 UnifiedTask 형식으로 변환
    ↓
합쳐서 정렬 + 필터 + 페이지네이션 후 응답
```

### 왜 새 DB 모델을 만들지 않는가

| 새 모델 만들면 | API Aggregation이면 |
|-------------|-------------------|
| 이중 데이터 — 원본 모델과 태스크 테이블 양쪽에 상태 관리 | 원본 모델 하나만 관리 |
| 동기화 문제 — 원본이 바뀌면 태스크도 갱신해야 함 | 항상 최신 데이터 (조회 시점 계산) |
| 마이그레이션 필요 | 스키마 변경 없음 |
| 태스크 생성 이벤트 필요 | 조회 시 실시간 계산 |

**트레이드오프:** 조회할 때마다 여러 테이블을 합산하므로 쿼리가 복잡합니다. 하지만 배치 쿼리 + 인메모리 처리로 성능을 확보합니다.

---

## 3. UnifiedTask 공통 인터페이스

모든 파이프라인의 태스크가 동일한 형태로 변환됩니다:

```typescript
interface UnifiedTask {
  // 식별
  id: string;              // 복합 ID (예: "leave_request:abc123")
  type: UnifiedTaskType;   // LEAVE | PAYROLL | ONBOARDING | OFFBOARDING | PERFORMANCE_REVIEW
  sourceModel: string;     // 원본 모델명
  sourceId: string;        // 원본 레코드 ID

  // 표시
  title: string;           // "[휴가] 김대리 연차 승인 요청"
  description?: string;    // 상세 설명
  status: UnifiedTaskStatus; // PENDING | IN_PROGRESS | DONE (구현 확정값)

  // 우선순위 + 기한
  priority: Priority;      // URGENT | HIGH | MEDIUM | LOW
  dueDate?: Date;          // 마감일 (있으면)
  isOverdue: boolean;      // 기한 초과 여부

  // 담당
  assigneeId?: string;     // 담당자 직원 ID
  assigneeType?: string;   // EMPLOYEE | MANAGER | HR | IT 등

  // 메타데이터
  sourceUrl: string;       // 클릭 시 이동할 상세 페이지 URL
  context: Record<string, any>; // 파이프라인별 추가 정보
  createdAt: Date;
}
```

### 복합 ID 형식

```
{sourceType}:{sourceId}

예시:
  leave_request:abc123                          — 휴가 승인 건
  payroll_run:def456                            — 급여 검토 건
  onboarding_task:ghi789                        — 온보딩 태스크
  offboarding_task:jkl012                       — 오프보딩 태스크
  performance:goal_submit:emp123:cycle456       — MBO 목표 제출
  performance:mgr_eval:emp789:cycle456          — 팀원 평가 작성
  performance:calibration:session012            — 캘리브레이션 세션
```

### UnifiedTaskType enum

```typescript
enum UnifiedTaskType {
  LEAVE_APPROVAL = 'LEAVE_APPROVAL',
  PAYROLL_REVIEW = 'PAYROLL_REVIEW',
  ONBOARDING_TASK = 'ONBOARDING_TASK',
  OFFBOARDING_TASK = 'OFFBOARDING_TASK',
  PERFORMANCE_REVIEW = 'PERFORMANCE_REVIEW',
  BENEFIT_REQUEST = 'BENEFIT_REQUEST',      // ⚠️ enum 정의됨, 매퍼 미구현
}
```

---

## 4. 매퍼 아키텍처 — 5개 파이프라인

각 파이프라인마다 **매퍼(Mapper)**가 존재합니다. 매퍼는 원본 모델을 UnifiedTask 형식으로 변환하는 함수입니다.

### 매퍼 비교표

| 매퍼 | 유형 | 데이터 소스 | 특징 |
|------|------|-----------|------|
| leave.mapper | **정적** | LeaveRequest 테이블 | DB 레코드를 직접 변환 |
| payroll.mapper | **정적** | PayrollRun 테이블 | DB 레코드를 직접 변환 |
| onboarding.mapper | **정적** | EmployeeOnboardingTask 테이블 | DB 레코드를 직접 변환 |
| offboarding.mapper | **정적** | EmployeeOffboardingTask 테이블 | DB 레코드를 직접 변환 |
| **performance.mapper** | **동적** | MboGoal + PerformanceEvaluation + CalibrationSession | 사이클 단계 × 역할 기반 실시간 계산 |

### 4-1. Leave 매퍼 (GP#1)

```
LeaveRequest WHERE status = PENDING
    ↓
매퍼 변환:
  - id: "leave_request:{leaveRequestId}"
  - title: "[휴가] {employeeName} {leaveType} 승인 요청"
  - status: PENDING
  - priority: 신청일로부터 3일+ → HIGH
  - assignee: 직속 매니저 (또는 Delegation 수임자)
  - sourceUrl: /leave/team
  - context: { leaveType, startDate, endDate, days, remainingBalance }
```

### 4-2. Payroll 매퍼 (GP#2)

```
PayrollRun WHERE status = REVIEW_NEEDED (또는 유사 상태)
    ↓
매퍼 변환:
  - id: "payroll_run:{payrollRunId}"
  - title: "[급여] {month}월 급여 검토 필요"
  - status: PENDING
  - priority: 급여 마감일 기준
  - assignee: HR_ADMIN
  - sourceUrl: /payroll/{payrollRunId}
```

### 4-3. Onboarding 매퍼

```
EmployeeOnboardingTask WHERE status IN [PENDING, IN_PROGRESS, BLOCKED]
    ↓
매퍼 변환:
  - id: "onboarding_task:{taskId}"
  - title: "[온보딩] Day {N} | {taskTitle}"
  - status: PENDING (BLOCKED도 PENDING으로, blocked 표시 추가)
  - priority: overdue 기반 동적 — >3일 지연=URGENT, >0일=HIGH
  - assignee: 태스크의 assigneeType에 따라 (EMPLOYEE=본인, BUDDY=buddyId, HR/IT=SystemActor)
  - sourceUrl: /onboarding/{onboardingId}
  - context: { milestone: "Day 1|7|30|90", isBlocked, blockReason }
```

### 4-4. Offboarding 매퍼

```
EmployeeOffboardingTask WHERE status IN [PENDING, BLOCKED]
    ↓
매퍼 변환:
  - id: "offboarding_task:{taskId}"
  - title: "[퇴직] {taskTitle}"
  - status: PENDING
  - priority: 퇴직일 역산 — 기한 초과=URGENT, 당일=HIGH, 3일 이내=MEDIUM
  - assignee: 태스크의 assigneeType에 따라
  - sourceUrl: /offboarding/{offboardingId}
  - context: { resignType, lastWorkingDate, handoverToId }
```

### 4-5. Performance 매퍼 (가장 복잡 — 동적)

다른 매퍼가 "DB 테이블 읽기"인 것과 달리, Performance 매퍼는 **사이클 단계 × 역할에 따라 태스크를 실시간 계산**합니다.

```
현재 활성 사이클의 단계 확인 (ACTIVE / CHECK_IN / EVAL_OPEN / CALIBRATION / FINALIZED)
    ↓
사용자의 역할 확인 (직원? 매니저? HR?)
    ↓
Phase-Role Matrix에 따라 태스크 동적 생성:

ACTIVE 단계:
  직원 → "MBO 목표 등록 및 제출" (MboGoal 기반)
  매니저 → "팀원 목표 검토" (팀원별 1건)

CHECK_IN 단계:
  직원 → "중간 체크인 작성" (체크인 기록 기반)
  매니저 → "팀원 체크인 확인" (팀원별 1건)

EVAL_OPEN 단계:
  직원 → "자기평가 작성" (PerformanceEvaluation SELF 기반)
  매니저 → "팀원 평가 작성" (팀원별 1건)

CALIBRATION 단계:
  HR → "캘리브레이션 세션 진행" (CalibrationSession 기반)

FINALIZED 단계:
  매니저 → "팀원 결과 통보" (팀원별 1건)
  직원 → "평가 결과 확인" (7일 미확인 시 자동 Acknowledge)
```

**DB CycleStatus 실제 값:** DRAFT / ACTIVE / CHECK_IN / EVAL_OPEN / CALIBRATION / FINALIZED / CLOSED (7단계)

**배치 쿼리 전략 (N+1 방지):**
```
쿼리 1: 활성 사이클 조회 (1건)
쿼리 2: 현재 사용자의 포지션 조회 (매니저 여부 판단)
쿼리 3: direct report 조회 (매니저인 경우)
쿼리 4: 해당 사이클의 관련 데이터 일괄 조회 (MboGoal 또는 Evaluation)
    ↓
인메모리 Map<employeeId, statuses[]> 그룹핑으로 태스크 계산
```

최대 4개 쿼리로 직원 수에 무관하게 일정한 성능을 유지합니다.

---

## 5. API 설계

### 엔드포인트

```
GET /api/v1/unified-tasks
```

### 쿼리 파라미터

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| types | string[] | 조회할 타입 필터 (LEAVE, PAYROLL, ONBOARDING 등). 미지정 시 전체 |
| status | string | PENDING / COMPLETED / ALL |
| priority | string | URGENT / HIGH / MEDIUM / LOW |
| fromDate | string (ISO) | 조회 시작일. **COMPLETED 조회 시 기본값 = 90일 전** (타임박스 정책). PENDING 조회 시 무시됨 |
| page | number | 페이지 번호 |
| limit | number | 페이지 크기 |
| sortBy | string | priority / dueDate / createdAt |
| sortOrder | string | asc / desc |

### 응답 구조

```typescript
{
  data: UnifiedTask[],           // 변환된 태스크 목록
  pagination: {
    page, limit, total, totalPages
  },
  countByType: {                 // 타입별 건수 (탭 뱃지용)
    LEAVE: 3,
    PAYROLL: 1,
    ONBOARDING: 5,
    OFFBOARDING: 2,
    PERFORMANCE_REVIEW: 4,
  },
  countByStatus: {               // 상태별 건수
    PENDING: 12,
    COMPLETED: 45,
  }
}
```

### 내부 처리 흐름

```
요청 수신 (GET /api/v1/unified-tasks?types=LEAVE,ONBOARDING&status=COMPLETED)
    ↓
status=COMPLETED인 경우: fromDate 기본값 = now() - 90일 (타임박스 적용)
status=PENDING인 경우: fromDate 무시 (진행 중인 건은 전부 표시)
    ↓
types 파라미터 파싱 → fetchLeave=true, fetchOnboarding=true, 나머지=false
    ↓
Promise.all([
  fetchLeave ? leaveMapper(companyId, userId, { fromDate }) : [],
  fetchPayroll ? payrollMapper(companyId, { fromDate }) : [],
  fetchOnboarding ? onboardingMapper(companyId, userId, { fromDate }) : [],
  fetchOffboarding ? offboardingMapper(companyId, userId, { fromDate }) : [],
  fetchPerformance ? performanceMapper(companyId, userId, userRole, { fromDate }) : [],
])
    ↓
5개 배열 병합 → 정렬 → 페이지네이션 → 응답
```

**핵심:** 요청한 타입만 쿼리합니다. `types=LEAVE`만 보내면 나머지 4개 매퍼는 실행하지 않습니다.

---

## 6. Priority 계산 표준

모든 매퍼가 동일한 기준으로 우선순위를 계산합니다:

### 기한 기반 (dueDate가 있는 경우)

| 기한 대비 | Priority |
|----------|----------|
| 기한 초과 (overdue) | **URGENT** |
| 기한 당일 | **HIGH** |
| 기한 3일 이내 | **MEDIUM** |
| 기한 3일 이상 | **LOW** |

### 파이프라인별 특수 규칙

| 파이프라인 | 특수 규칙 |
|-----------|----------|
| Leave | 신청 후 3일+ 미처리 → HIGH 승격 |
| Onboarding | 마일스톤별 동적 — Day 1 태스크는 기본 HIGH |
| Offboarding | 퇴직일 D-6 이내 → 무조건 URGENT |
| Performance | 사이클 마감일(goalEnd/evalEnd) 기반 |

---

## 7. 역할별 보이는 태스크

UnifiedTask Hub는 **로그인한 사용자의 역할에 따라 다른 태스크**를 보여줍니다:

### 직원 (Employee)

| 파이프라인 | 보이는 태스크 |
|-----------|------------|
| GP#1 휴가 | 본인 신청 건의 상태 (PENDING/APPROVED) |
| GP#4 성과 | MBO 목표 제출, 자기평가 작성, 결과 확인 |
| Onboarding | 본인 담당 태스크 (교육 이수, 체크인 응답 등) |
| Offboarding | 본인 담당 태스크 (장비 반납, 사물함 정리 등) |

### 매니저 (Manager)

| 파이프라인 | 보이는 태스크 |
|-----------|------------|
| GP#1 휴가 | 팀원 휴가 승인 대기 건 |
| GP#4 성과 | 팀원 목표 검토, 팀원별 평가 작성 |
| Onboarding | 매니저 담당 태스크 (1:1 면담, Sign-off 등) |
| Offboarding | 매니저 담당 태스크 (인수인계 확인 등) |

### HR

| 파이프라인 | 보이는 태스크 |
|-----------|------------|
| GP#1 휴가 | 대리 승인 필요 건 (Delegation 에스컬레이션) |
| GP#2 급여 | 급여 검토/승인 대기 건 |
| GP#4 성과 | 캘리브레이션 세션 |
| Onboarding | HR 담당 태스크 (서류 수령, 보험 등록 등) |
| Offboarding | HR 담당 태스크 (퇴직 면담, 정산 등) |

---

## 8. 이벤트 엔진 연결

UnifiedTask Hub 자체는 이벤트를 발행하지 않습니다. 각 파이프라인의 이벤트가 원본 모델을 변경하면, 다음 UnifiedTask 조회 시 자동으로 반영됩니다.

```
예: 매니저가 휴가 승인 클릭
    ↓
Leave API: LeaveRequest.status = APPROVED
    ↓
LEAVE_APPROVED 이벤트 발행 → 알림 처리
    ↓
다음번 UnifiedTask Hub 조회 시:
  - leave.mapper가 이 건을 더 이상 PENDING으로 반환하지 않음
  - 자연스럽게 태스크 목록에서 사라짐
```

**API Aggregation의 장점이 여기서 발휘됩니다:** 별도의 "태스크 상태 동기화" 로직이 필요 없습니다. 원본이 바뀌면 다음 조회에서 자동 반영됩니다.

---

## 9. Nudge 엔진 연결

Nudge 시스템은 UnifiedTask Hub와 독립적으로 동작하되, **동일한 데이터 소스**를 공유합니다.

```
UnifiedTask Hub: "이 사람이 지금 뭘 해야 하는지" 보여줌 (Pull)
Nudge Engine: "이 사람이 안 하고 있으니 재촉" 보냄 (Push)
```

### Nudge 트리거 방식: Lazy Update (D-3 결정)

Nudge는 별도 Cron이 아닌, **사용자가 로그인할 때(unread-count 폴링 시)** fire-and-forget으로 실행됩니다.

```
직원이 로그인 → unread-count API 호출
    ↓
fire-and-forget으로 Nudge 체크 실행
    ↓
각 Nudge 룰이 조건 확인:
  - leave-pending.rule: 3일+ PENDING 건 있으면 매니저에게 알림
  - onboarding-overdue.rule: 마일스톤 기한 초과 태스크 있으면 담당자에게 알림
  - performance-goal-overdue.rule: 목표 미제출자에게 알림
  ...
    ↓
Notification 테이블에 기록 (triggerType 패턴으로 중복 방지)
```

### 현재 등록된 Nudge 룰 (7개)

| # | 룰 | 파이프라인 | 대상 |
|---|---|-----------|------|
| 1 | leave-pending | GP#1 | 매니저 (3일+ 미승인) |
| 2 | payroll-review | GP#2 | HR (1일+ 미검토) |
| 3 | onboarding-overdue | Onboarding | 태스크 담당자 (마일스톤별 동적) |
| 4 | onboarding-checkin-missing | Onboarding | 신입 (Day 7/30/90 체크인 누락) |
| 5 | offboarding-overdue | Offboarding | 태스크 담당자 (퇴직일 역산) |
| 6 | exit-interview-pending | Offboarding | HR (D-7 면담 미실시) |
| 7~9 | performance-goal-overdue, performance-eval-overdue, performance-calibration-pending | GP#4 | 직원/매니저/HR |

---

## 10. 상태 머신

UnifiedTask 자체에는 상태 머신이 없습니다. 각 원본 모델의 상태 머신이 그대로 반영됩니다.

### 상태 매핑 표준

| 원본 상태 | UnifiedTask 상태 |
|----------|------------------|
| PENDING / NOT_STARTED / DRAFT | **PENDING** |
| IN_PROGRESS | **IN_PROGRESS** (해당 매퍼만) |
| DONE / SUBMITTED / APPROVED / CONFIRMED / COMPLETED | **COMPLETED** |
| SKIPPED / CANCELLED / REJECTED | **CANCELLED** |
| BLOCKED | **PENDING** (isBlocked=true 표시) |

---

## 11. 성능 설계

### 쿼리 최적화 전략

| 전략 | 내용 |
|------|------|
| **타입 필터링** | 요청한 types만 매퍼 실행 (불필요한 쿼리 skip) |
| **배치 쿼리** | 매퍼별 1~4개 쿼리로 제한 (N+1 금지) |
| **인메모리 처리** | DB에서 가져온 후 Map/Set으로 그룹핑, 필터, 정렬 |
| **Promise.all** | 5개 매퍼 병렬 실행 |
| **페이지네이션** | 전체 결과를 합친 후 page/limit 적용 |

### 예상 쿼리 수

| 시나리오 | 총 쿼리 수 |
|---------|:---:|
| 직원이 전체 타입 조회 | 최대 8~10개 (5매퍼 × 1~2개씩) |
| 매니저가 LEAVE + ONBOARDING만 조회 | 3~4개 |
| HR이 PAYROLL만 조회 | 1~2개 |

300명 규모 법인에서도 응답 시간 500ms 이내 목표.

---

## 12. UI 연동 설계

### 통합 업무함 화면 구조

```
┌─────────────────────────────────────────────┐
│  📋 나의 업무                    [전체] [진행중]│
│                                              │
│  ┌─ 타입 필터 탭 ──────────────────────────┐  │
│  │ 전체(15) │ 휴가(3) │ 급여(1) │ 온보딩(5) │  │
│  │ 오프보딩(2) │ 성과(4)                    │  │
│  └──────────────────────────────────────────┘  │
│                                              │
│  ┌─ 태스크 목록 ────────────────────────────┐  │
│  │ 🔴 [긴급] [퇴직] 박과장 장비 반납 확인    D-1│  │
│  │ 🟡 [높음] [성과] MBO 목표 제출 마감     D-3│  │
│  │ 🟡 [높음] [휴가] 김대리 연차 승인 대기   3일│  │
│  │ 🟢 [보통] [온보딩] Day 7 | 시스템 교육   D-5│  │
│  │ 🔵 [낮음] [온보딩] Day 30 | 목표 설정  D-25│  │
│  └──────────────────────────────────────────┘  │
│                                              │
│  태스크 클릭 → sourceUrl로 이동 (상세 페이지)   │
└─────────────────────────────────────────────┘
```

### 탭 뱃지

`countByType`을 활용하여 각 타입 탭에 미처리 건수를 배지로 표시합니다.

### 태스크 카드 표시 정보

| 요소 | 소스 |
|------|------|
| Priority 아이콘 (🔴🟡🟢🔵) | priority 필드 |
| 타입 태그 ([휴가], [성과] 등) | type 필드 |
| 제목 | title 필드 |
| 기한/경과일 | dueDate + isOverdue |
| 클릭 동작 | sourceUrl로 라우팅 |

### 완료 탭 — 90일 타임박스 UX (v1.1 추가)

"완료된 업무" 탭은 최근 90일 이내 완료 건만 표시합니다. 목록 하단에 다음 안내 문구를 노출합니다:

```
┌──────────────────────────────────────────────────────┐
│  ℹ️  최근 90일 이내의 통합 업무 내역만 표시됩니다.      │
│     이전 내역은 아래 메뉴에서 확인하실 수 있습니다:      │
│     나의 휴가 내역 · 급여 명세서 · 성과 평가 이력        │
│     온보딩 진행 현황 · 오프보딩 이력                     │
└──────────────────────────────────────────────────────┘
```

**설계 근거:**
- 통합 업무함은 "영구 보관함"이 아닌 **"현재와 최근의 흐름을 보는 전광판"**
- 1인당 90일간 발생하는 태스크는 30~50건 수준 → 인메모리 합산에 부담 없음
- 90일 이전 내역은 각 모듈의 전용 이력 페이지에서 전체 조회 가능
- // TODO: Move to Settings (System) — 타임박스 기간 90일 기본값

---

## 13. 알려진 제약 / TODO

| 이슈 | 상태 | 비고 |
|------|------|------|
| **BENEFIT_REQUEST 매퍼** | ⚠️ enum만 존재 | `UnifiedTaskType`에 BENEFIT_REQUEST 정의됨, `benefit.mapper.ts` 미구현. 향후 복리후생 승인 연동 시 추가 또는 enum 제거 |
| **90일 타임박스** | ✅ 설계됨 | route 로직에서 COMPLETED 조회 시 fromDate 기본값 적용 여부 검증 필요 |
| MANAGER 관계 해결 | TODO | Position.reportsToPositionId 기반, 미구현 시 매니저 태스크 skip |
| HR/IT/FINANCE SystemActor | TODO | 실제 employeeId가 없어서 Nudge 대상에서 skip |
| 캐싱 | 미구현 | 현재는 매 요청마다 실시간 조회. 필요시 Redis 캐싱 추가 |
| 실시간 업데이트 | 미구현 | 현재는 폴링. 필요시 WebSocket/SSE 추가 |
| 벌크 액션 | 부분 구현 | 휴가 벌크 승인은 가능, 다른 타입은 각 모듈에서 처리 |
| 모바일 최적화 | TODO | 경량 응답 버전 (fields 파라미터로 필요 필드만) |

---

## 14. Workday와의 설계 비교

| 항목 | Workday "My Tasks" | CTR UnifiedTask Hub | 근거 |
|------|-------------------|-------------------|------|
| 데이터 소스 | Business Process Task 전용 모델 | **API Aggregation** (기존 모델 재활용) | 스키마 변경 없이 확장 가능 |
| 태스크 생성 | BP 진입 시 명시적 생성 | **조회 시 실시간 계산** | 동기화 문제 제거 |
| 성과 태스크 | 사이클 단계 전환 시 일괄 생성 | **동적 계산** (Phase-Role Matrix) | 수백 건 일괄 INSERT 불필요 |
| Nudge | 이메일 기반 | **Notification + Lazy Trigger** | Cron 불필요, 로그인 시 자동 체크 |
| 필터링 | 카테고리 탭 | **타입 기반 + countByType 뱃지** | 동일 UX |

---

## 부록 A: 파일 구조

```
src/lib/unified-task/
  ├ types.ts                    — UnifiedTask 인터페이스, enum, 상수
  └ mappers/
      ├ leave.mapper.ts         — GP#1 LeaveRequest → UnifiedTask
      ├ payroll.mapper.ts       — GP#2 PayrollRun → UnifiedTask
      ├ onboarding.mapper.ts    — Onboarding 태스크 → UnifiedTask
      ├ offboarding.mapper.ts   — Offboarding 태스크 → UnifiedTask
      └ performance.mapper.ts   — GP#4 동적 계산 → UnifiedTask

src/app/api/v1/unified-tasks/
  └ route.ts                    — GET API (필터+정렬+페이지네이션)

src/lib/nudge/
  ├ types.ts, nudge-engine.ts, check-nudges.ts
  └ rules/                      — 파이프라인별 Nudge 룰 (9개)

src/lib/events/
  ├ types.ts                    — 전체 도메인 이벤트 정의 (12+ 이벤트)
  ├ event-bus.ts                — In-process pub/sub
  ├ bootstrap.ts                — 핸들러 등록 (1회 실행)
  └ handlers/                   — 이벤트 핸들러 (6+개)
```

---

## 부록 B: 전체 결정사항 요약

| # | 항목 | 결정 |
|---|------|------|
| 1 | 데이터 모델 | **API Aggregation** — 새 UnifiedTask DB 모델 없음 (D-1 결정) |
| 2 | 매퍼 패턴 | 파이프라인별 매퍼 함수 (정적 4개 + 동적 1개) |
| 3 | 쿼리 전략 | Promise.all 병렬 + 배치 쿼리 + 인메모리 처리 |
| 4 | 타입 필터 | 요청한 types만 매퍼 실행 (불필요한 쿼리 skip) |
| 5 | Nudge 트리거 | Lazy Update — Cron 아닌 로그인 시 fire-and-forget (D-3 결정) |
| 6 | Nudge 저장 | Notification 테이블 재활용, triggerType으로 중복 방지 |
| 7 | 이벤트 | UnifiedTask 자체는 이벤트 미발행 — 원본 모델 이벤트에 의존 |
| 8 | bootstrap | instrumentation.ts에서 1회 실행 |
| 9 | Performance 매퍼 | 비동기 fetchPerformanceTasks() — Phase-Role Matrix 기반 동적 |
| 10 | DB CycleStatus | DRAFT/ACTIVE/CHECK_IN/EVAL_OPEN/CALIBRATION/FINALIZED/CLOSED (7단계) |
| 11 | **완료 태스크 보관** | **90일 타임박스 롤링 윈도우** — COMPLETED 조회 시 fromDate 기본값 = 90일 전. 이전 내역은 각 모듈 전용 이력 페이지에서 확인 |

---

> **다음 단계:** 캐싱 전략 (Redis or SWR) → 실시간 업데이트 (WebSocket) → 모바일 경량 API → 벌크 액션 통합
