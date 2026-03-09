# SHARED.md — 글로벌 공유 컨텍스트

> **이 파일은 읽기 전용입니다.** 각 트랙 세션에서 수정하지 마세요.
> 주차 종료 후 TRACK_A.md + TRACK_B.md 내용을 여기로 머지합니다.

---

## 프로젝트 기본 정보

- **프로젝트**: CTR HR Hub v2.0
- **최종 업데이트**: 2026-03-05 (Phase 0 완료 — Timezone Integrity)
- **프로젝트 경로**: `/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub`
- **스택**: Next.js (App Router) + Supabase Auth/Storage/Realtime + PostgreSQL + **Prisma ORM** + Tailwind CSS
- **DB 규칙**: 모든 테이블 = `prisma/schema.prisma` → `prisma migrate dev`. Supabase는 Auth+Storage+Realtime만.
- **법인**: CTR-HQ, CTR-KR, CTR-CN, CTR-RU, CTR-US, CTR-VN, CTR-MX (7개, HQ 포함 13개 엔티티)

---

## 현재 상태 요약

**전체 STEP 0~9 구현 완료 + 디자인 리팩토링(R1~R9) 완료.**
**리팩토링 마스터플랜 v2.0 Phase A (전체) + Phase B (B1~B11 전체) 완료.**

- `npx tsc --noEmit` = 0 errors ✅
- `npm run build` = 성공 ✅
- Git 커밋: 61개+

---

## 전체 진행 현황

### STEP 진행 현황

| STEP | 모듈 | 상태 | 커밋 범위 |
|------|------|------|-----------|
| 0 | Supabase 스키마 + Seed 데이터 | ✅ 완료 | `76b8016`~`8069a12` |
| 1 | 대시보드 + 사이드바 + 구성원 목록 | ✅ 완료 | STEP1 커밋들 |
| 2 | 구성원 상세 프로필 + 조직도 | ✅ 완료 | STEP2 커밋들 |
| 2.5 | Gap 보완 (협업 요청) | ✅ 완료 | |
| 3 | 온보딩 + 퇴직 + 셀프서비스 | ✅ 완료 | |
| 4 | 근태 + 휴가 + 단말기 | ✅ 완료 | |
| 5 | 채용 ATS + 징계/포상 | ✅ 완료 | `3b51ed8`~`8cc0d66` |
| 6-A | 성과관리 (MBO + CFR + 캘리브레이션) | ✅ 완료 | `62d2124`~`aa60293` |
| 6-B | 연봉 + 복리후생 + Attrition + 승계 | ✅ 완료 | `ecdee8f`, `ebf4cd9` |
| 7-1 | 급여 처리 (6-state machine + 한국세법) | ✅ 완료 | `30aae02` |
| 7-2 | HR 애널리틱스 대시보드 (9개 모듈 + AI) | ✅ 완료 | `e10c0f7` |
| 7-3 | 알림 시스템 (벨 + 트리거 설정) | ✅ 완료 | `85c1c59` |
| 8-1 | 관리자 설정 (11개 섹션) | ✅ 완료 | `9a0f89d` |
| 8-2 | 홈 + 매니저 허브 + HR 챗봇 + 커맨드 팔레트 | ✅ 완료 | `310584a` |
| 9-1 | i18n 다국어 (7개 언어) | ✅ 완료 | `e586055` |
| 9-2 | 컴플라이언스 (KR/CN/RU + GDPR) | ✅ 완료 | `edb0648` |
| R1~R6 | STEP 1~6A 디자인 리팩토링 (FLEX Green) | ✅ 완료 | |
| R7~R9 | STEP 7~9 디자인 리팩토링 (FLEX Green) | ✅ 완료 | 2026-03-01 |

### 리팩토링 마스터플랜 v2.0 진행 현황

> 총 16세션 / 약 15주. Notion 마스터플랜 참조.

| Phase | 세션 | 상태 |
|-------|------|------|
| **A: 아키텍처 기반** | A1 사이드바 IA 재설계 | ✅ 완료 |
| | A2-1 Core HR 데이터 모델 (employee_assignments) | ✅ 완료 |
| | A2-1b Settings Hub UI (설정 허브 3×2 카드 + 서브페이지) | ✅ 완료 |
| | A2-2 Position 기반 보고 라인 (포지션 체계) | ✅ 완료 |
| | A2-3 API 레이어 마이그레이션 (418 errors 수정) | ✅ 완료 |
| **B: 기능 구현** | B1 법인 커스터마이징 엔진 | ✅ 완료 |
| | B2 Core HR 고도화 | ✅ 완료 |
| | B3-1 Competency Framework | ✅ 완료 |
| | B3-2 AI 평가 초안 + 편향 감지 + 승계 고도화 | ✅ 완료 |
| | B4 ATS Enhancement | ✅ 완료 |
| | B5 온보딩/오프보딩 고도화 | ✅ 완료 |
| | B6-1 근태 고도화 (교대+유연+52시간) | ✅ 완료 |
| | B6-2 휴가 고도화 (정책엔진 + 통합 승인함) | ✅ 완료 |
| | B7-1a 한국법인 급여 계산 엔진 | ✅ 완료 |
| | B7-1b 연말정산 | ✅ 완료 |
| | B7-2 해외 급여 통합 + 글로벌 분析 | ✅ 완료 |
| | B8-1 조직도 시각화 + 조직 개편 | ✅ 완료 |
| | B8-2 People Directory + Self-Service | ✅ 완료 |
| | B8-3 스킬 매트릭스 + 갭 분석 | ✅ 완료 |
| | B9-1 LMS Lite (법정 의무교육 + 스킬 갭 추천) | ✅ 완료 |
| | B9-2 복리후생 신청·승인 | ✅ 완료 |
| | B10-1 HR 예측 애널리틱스 | ✅ 완료 |
| | B10-2 HR KPI 대시보드 | ✅ 완료 |
| | B11 알림 시스템 강화 + i18n 보완 + Teams 연동 완성 | ✅ 완료 |
| **C: UX 리팩토링** | C1~C3 | ✅ 완료 |

---

## 코드베이스 통계

| 항목 | 수량 |
|------|------|
| 총 TS/TSX 파일 | 894+ |
| TSX 파일 | 347+ |
| API 라우트 (route.ts) | 294+ |
| 페이지 (page.tsx) | 115+ |
| 컴포넌트 (components/) | 118+ |
| Prisma 모델 | 89+2 (EmployeeAssignment, EmployeeManagerBackup 추가) |
| Prisma enum | 70 |
| Git 커밋 | 61+ |

---

## QA 감사 스크립트 (Script/ 디렉토리)

| 파일 | 상태 |
|------|------|
| `QA1A_결과리포트.md` | ✅ STEP 0~6A (138항목: ✅110/⚠️12/❌16) |
| `QA1B_결과리포트.md` | ✅ STEP 6B~9 (151항목: ✅135/⚠️8/❌8) |
| `QA1_통합_기능정합성_리포트.md` | ✅ 전체 (289항목: ✅245(85%)/⚠️20(7%)/❌24(8%)) |
| `QA2_결과리포트.md` | ✅ 빌드·코드품질 (빌드 PASS, ESLint 0err/119warn) |
| `QA3_결과리포트.md` | ✅ 디자인 일관성 (금지패턴 0건, 경미 18건) |

---

## 디자인 시스템 (R1~R9 완료 기준)

### 적용 기준
- **프라이머리**: `#00C853` (FLEX Green) — `tailwind.config.ts`의 `ctr-primary`
- **중립색**: hex 기반 (`#1A1A1A`, `#333`, `#555`, `#666`, `#999` 등) — `ctr-gray-*` 토큰
- **시맨틱**: emerald→`#059669`, amber→`#B45309`, indigo→`#4338CA`, red→`#EF4444` (hex 전환)
- **Shadow**: 카드에서 shadow-sm/md 제거 — 모달/드롭다운만 shadow-lg/xl 유지
- **제외**: `src/components/ui/` (shadcn, CSS 변수 기반), Prisma 생성 파일

### R7~R9 최종 검증 결과 (2026-03-01)
| 검증 항목 | 결과 |
|-----------|------|
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | 성공 |
| 금지 패턴 잔존 | 0건 (slate/blue/gray/shadow-sm/md/emerald/amber/indigo) |

---

## 주요 설정 파일

| 파일 | 역할 |
|------|------|
| `tailwind.config.ts` | `ctr-primary: #00C853`, `ctr-gray` 팔레트 정의 |
| `CLAUDE.md` | 디자인 토큰 + 7섹션 IA + RBAC + 컴포넌트 스펙 |
| `CTR_UI_PATTERNS.md` | UI/UX 패턴 가이드 (P01~P13 + NP01~NP04) |
| `prisma/schema.prisma` | 89 모델, 70 enum |
| `src/config/navigation.ts` | 7섹션 메뉴 구조 정의 |
| `src/hooks/useNavigation.ts` | 역할 기반 네비게이션 훅 |
| `src/lib/assignments.ts` | Effective Dating 헬퍼 함수 (A2-1 신규) |
| `src/types/assignment.ts` | EmployeeAssignment 타입 정의 (A2-1 신규) |
| `src/lib/api/companyFilter.ts` | `resolveCompanyId` — SUPER_ADMIN/법인 필터 유틸 |
| `src/lib/api/batchProcess.ts` | 대용량 배치 처리 청크 유틸 |
| `prisma/seeds/foreign-payroll.ts` | 해외법인 급여 시드 (B7-2) |

---

## FIX 이력

### Golden Path #1: Leave Pipeline (Workday-style) — 2026-03-07
- **Employee**: 휴가 신청 폼에 실시간 잔여일 프리뷰 추가 (remaining = granted + carryOver - used - pending)
  - 정책 선택 시 현재 잔여일 표시; 날짜/일수 입력 시 `신청: N일 | 잔여: N일` 뱃지 실시간 업데이트
  - 잔여 > 3일: 초록, ≤ 3일: 황색, 음수: 빨강 + 신청 버튼 비활성화
  - 성공 toast `"휴가 신청이 완료되었습니다"`, 오류 시 에러 toast (폼 상태 유지)
- **Manager**: 팀뷰 인라인 승인/반려에 옵티미스틱 UI + 팀 부재 컨텍스트 추가
  - 승인 클릭 시 즉시 녹색 배경 + "승인" 뱃지 → 1.5s 후 페이드아웃 → 데이터 갱신
  - 반려 다이얼로그 확인 즉시 빨간 배경 적용 → 동일 페이드 시퀀스
  - API 오류 시 옵티미스틱 상태 즉시 롤백 + error toast
  - `해당 기간 팀 부재: N명` — 클라이언트사이드 overlap 계산 (동 기간 타 멤버 PENDING/APPROVED 요청 수)
- **Backend**: approve/reject API 응답에 업데이트된 잔액 포함
  - `{ data: { request, balance: { granted, used, pending, remaining } } }` 형태 확장
  - 트랜잭션(기존 유지) 완료 후 DB re-fetch로 정확한 값 반환
- **Balance lifecycle**: request→pendingDays++ | approve→pending--, used++ | reject/cancel→pending--
- **Files modified**:
  - `src/app/(dashboard)/leave/LeaveClient.tsx`
  - `src/app/(dashboard)/leave/team/LeaveTeamClient.tsx`
  - `src/app/api/v1/leave/requests/[id]/approve/route.ts`
  - `src/app/api/v1/leave/requests/[id]/reject/route.ts`

---

## Golden Path v3.0 진행 현황 — 2026-03-09

### Stage 2: Nudge System (재촉/리마인더) ✅
- `src/lib/nudge/types.ts` — NudgeRule, NudgeConfig 인터페이스
- `src/lib/nudge/nudge-engine.ts` — engine 구현 (oncePer24h, maxNudges)
- `src/lib/nudge/check-nudges.ts` — 싱글톤 엔진 + checkNudgesForUser
- Rules: `leave-pending.rule.ts`, `payroll-review.rule.ts`

### Stage 3: Onboarding Golden Path ✅
**Session A: Events**
- `EMPLOYEE_HIRED`, `ONBOARDING_TASK_COMPLETED`, `ONBOARDING_COMPLETED` → `src/lib/events/types.ts`
- POST /api/v1/employees → EMPLOYEE_HIRED 발행
- PUT /api/v1/onboarding/tasks/[id]/complete → 태스크 이벤트 발행

**Session B: Handler**
- `src/lib/events/handlers/employee-hired.handler.ts` — 온보딩 플랜 자동 생성
- `src/lib/onboarding/create-onboarding-plan.ts` — 재사용 가능한 플랜 생성 함수

**Session C: UnifiedTask Mapper**
- `src/lib/unified-task/mappers/onboarding.mapper.ts`
- `src/app/api/v1/unified-tasks/route.ts` — ONBOARDING_TASK 통합

**Session D: Nudge Rules**
- `src/lib/nudge/rules/onboarding-overdue.rule.ts` (동적 임계값: Day1/Week1/Month1+)
- `src/lib/nudge/rules/onboarding-checkin-missing.rule.ts`

### Stage 3: Offboarding Pipeline ✅
**Session A: Events**
- `EMPLOYEE_OFFBOARDING_STARTED`, `OFFBOARDING_TASK_COMPLETED`, `OFFBOARDING_COMPLETED` → `src/lib/events/types.ts`
- POST /api/v1/employees/[id]/offboarding/start → EMPLOYEE_OFFBOARDING_STARTED 발행
- PUT /api/v1/offboarding/[id]/tasks/[taskId]/complete → 태스크 + 완료 이벤트 발행

**Session B: Handler**
- `src/lib/events/handlers/offboarding-started.handler.ts` — 중복 가드 + fallback 태스크 생성
- `src/lib/events/bootstrap.ts` — offboardingStartedHandler 등록

**Session C: UnifiedTask Mapper**
- `src/lib/unified-task/mappers/offboarding.mapper.ts` — dueDate 역방향 계산 (lastWorkingDate - dueDaysBefore)
- `src/app/api/v1/unified-tasks/route.ts` — OFFBOARDING_TASK 통합

**Session D: Nudge Rules**
- `src/lib/nudge/rules/offboarding-overdue.rule.ts` (3단계 aggressive: D-14/D-7/D-6)
- `src/lib/nudge/rules/exit-interview-pending.rule.ts` (최종 근무일 7일 전부터, 최대 7회)
- `src/lib/nudge/check-nudges.ts` — 두 룰 등록

**TSC 결과**: `npx tsc --noEmit` = 0 errors ✅

### Stage 3: Performance Review Pipeline ✅
**Session A: Events + Cycle 상태 기계 이벤트 발행**
- 6개 도메인 이벤트 정의 → `src/lib/events/types.ts`
  - `PERFORMANCE_CYCLE_PHASE_CHANGED`, `PERFORMANCE_MBO_GOAL_SUBMITTED`, `PERFORMANCE_MBO_GOAL_REVIEWED`
  - `PERFORMANCE_SELF_EVAL_SUBMITTED`, `PERFORMANCE_MANAGER_EVAL_SUBMITTED`, `PERFORMANCE_CYCLE_FINALIZED`
- `advance/route.ts` → PHASE_CHANGED + FINALIZED (CLOSED 전환 시) 발행
- `finalize/route.ts` → PHASE_CHANGED + FINALIZED 발행
- DB CycleStatus 5단계: `DRAFT → ACTIVE → EVAL_OPEN → CALIBRATION → CLOSED`

**Session B: MBO Goal 이벤트 + 핸들러**
- `goals/[id]/submit/route.ts` → `PERFORMANCE_MBO_GOAL_SUBMITTED` 발행
- `goals/[id]/approve/route.ts` → `PERFORMANCE_MBO_GOAL_REVIEWED` (APPROVED) 발행
- `goals/[id]/request-revision/route.ts` → `PERFORMANCE_MBO_GOAL_REVIEWED` (REVISION_REQUESTED) 발행
- `src/lib/events/handlers/mbo-goal-submitted.handler.ts` — 포지션 기반 매니저 알림
- `src/lib/events/handlers/mbo-goal-reviewed.handler.ts` — 직원 알림 (APPROVED/REVISION priority 분기)

**Session C: Evaluation 이벤트 + 핸들러**
- `evaluations/self/route.ts` → `PERFORMANCE_SELF_EVAL_SUBMITTED` 발행 (status=SUBMITTED 시만)
- `evaluations/manager/route.ts` → `PERFORMANCE_MANAGER_EVAL_SUBMITTED` 발행 (emsBlock 재활용)
- `src/lib/events/handlers/self-eval-submitted.handler.ts` — 매니저에게 평가 독려 알림
- `src/lib/events/handlers/manager-eval-submitted.handler.ts` — 직원 알림(점수 미노출) + all-complete 체크 시 HR 알림
- EMS 9-Block 계산: `calculateEmsBlock()` in `src/lib/ems.ts` — 이미 두 라우트에 구현됨

**Session D: UnifiedTask Mapper + Nudge Rules**
- `src/lib/unified-task/mappers/performance.mapper.ts` — D-1 API Aggregation
  - ACTIVE: 직원 목표등록 + 매니저 팀원별 목표검토
  - EVAL_OPEN: 직원 자기평가 + 매니저 팀원별 평가
  - CALIBRATION: HR 캘리브레이션 세션
  - 배치 쿼리 최대 4개 (N+1 없음), 포지션 기반 direct report 조회
- `src/app/api/v1/unified-tasks/route.ts` — PERFORMANCE_REVIEW 타입 통합
- Nudge Rules (3개):
  - `performance-goal-overdue.rule.ts` (D-7/D-3/초과, 매니저 보조 nudge)
  - `performance-eval-overdue.rule.ts` (D-5/D-2/초과, self+mgr 통합, HR 보조 nudge)
  - `performance-calibration-pending.rule.ts` (3일 후 trigger, 세션 createdBy 기반)
- `src/lib/events/bootstrap.ts` — 모든 Session TODO 정리 완료, TODO 없음

**TSC 결과**: `npx tsc --noEmit` = 0 errors ✅

---

## 다음 작업

- [x] Phase A 전체 완료
- [x] Phase B (B1~B11) 전체 완료
- [x] FIX-1 보안 수정 완료
- [x] FIX-2 성능 최적화 + 구조 통일 완료
- [ ] **C1~C3: UX 리팩토링** (테이블 표준화, 대시보드 통일, DnD)
- [ ] **Seed 데이터 확충** — 트랜잭셔널 데이터 부족 (급여명세서, 평가, 근태 이력 등)
- [ ] RLS 정책 추가

---

## Phase A 완료 산출물

### A1: 사이드바 IA 재설계

**변경/생성된 파일:**
| 파일 | 상태 | 줄 수 |
|------|------|-------|
| `src/config/navigation.ts` | 신규 생성 | ~530줄 |
| `src/hooks/useNavigation.ts` | 신규 생성 | ~65줄 |
| `src/components/layout/Sidebar.tsx` | 전면 재구축 | ~310줄 (기존 493줄 → 310줄) |
| `messages/ko.json` | nav 섹션 추가 | +110줄 |
| `messages/en.json` | nav 섹션 추가 | +110줄 |

**구현 내용:**
- 기존 17개 flat NavGroup → 7개 역할 기반 섹션 (홈/나의 공간/팀 관리/인사 운영/인재 관리/인사이트/설정)
- 다크 테마 사이드바 (bg-[#111], 활성 bg-[#00C853])
- 역할 기반 가시성: EMPLOYEE(홈+나의 공간), MANAGER+(+팀 관리+인사이트), HR_ADMIN+(전체)
- comingSoon 항목 지원 (Lock 아이콘 + cursor-not-allowed)

### A2-1: Core HR 데이터 모델 (employee_assignments)

**스키마 변경:**
- `Employee` 모델에서 제거된 8개 필드: `companyId`, `departmentId`, `jobGradeId`, `jobCategoryId`, `managerId`, `employmentType`, `contractType`, `status`
- `EmployeeAssignment` 모델 신규 (Effective Dating 지원)
- `EmployeeManagerBackup` 모델 신규 (보고 라인 구성용)

### A2-2: Position 기반 보고 라인

**시드 데이터:**
- Global Jobs 15개 (companyId=NULL)
- CTR-KR Positions 59개 (9개 부서, 보고라인 설정 완료)
- Other Co Positions 81개 (CTR-CN/RU/US/VN/MX 간소화)
- Global Process Settings 8개 + 법인별 오버라이드

### A2-1b: Settings Hub UI

- 사이드바 settings 섹션: 37개 items → 단일 hub 링크
- 6개 카테고리 카드 3×2 그리드 + 검색바 (37개 항목 필터링)
- 카테고리 서브페이지: 좌측 사이드탭 + 우측 플레이스홀더

### A2-3: API 레이어 마이그레이션

**수정 패턴:**
| 패턴 | AS-IS | TO-BE |
|------|-------|-------|
| WHERE 절 | `companyId` 직접 | `assignments: { some: { companyId, isPrimary: true, endDate: null } }` |
| SELECT/INCLUDE | `department: true` 직접 | `assignments: { where: { isPrimary: true, endDate: null }, take: 1, include: { department: true } }` |
| 프로퍼티 접근 | `employee.companyId` | `employee.assignments?.[0]?.companyId` |

---

## Phase B 완료 산출물

### B1: 법인 커스터마이징 엔진

**핵심 설계:** `companyId = NULL` 레코드 = 글로벌 기본값, 법인 레코드 = 오버라이드.

**DB 테이블 (9개 신규 모델)**:
- `EvaluationSetting`, `PromotionSetting`, `CompensationSetting`
- `AttendanceSetting`, `LeaveSetting`, `OnboardingSetting`
- `ExchangeRate`, `ApprovalFlow`, `ApprovalFlowStep`

**핵심 컴포넌트**:
- `CompanySelector` — 법인 전환 드롭다운
- `GlobalOverrideBadge` — "글로벌 기본" vs "커스텀" 표시
- `getCompanySettings()` — 법인 → 글로벌 폴백 자동 처리

**시드 데이터:**
- 글로벌 기본값 3개 (EvaluationSetting, PromotionSetting, CompensationSetting)
- CTR-KR 오버라이드 (평가 5등급 S/A/B+/B/C, 직급 G1-G6)
- CTR-US 오버라이드 (MBO only, 5점 척도)
- ExchangeRate (KRW↔6개 통화) 6건
- ApprovalFlow (복리후생/채용/휴가/승진 1~4단계) 9건

---

### B2: Core HR 고도화 (직원 프로필 + Effective Dating UI)

**직원 프로필 탭 구조**: `/employees/[id]` → 5탭: `profile` / `assignment-history` / `compensation-info`(HR Admin) / `attendance`(→B6) / `performance`(→B3)

**재사용 컴포넌트**:
- `AssignmentTimeline` → `@/components/shared/AssignmentTimeline`
  - props: `events: TimelineEvent[], onEventClick?, loading?, emptyMessage?`
- `EffectiveDatePicker` → `@/components/shared/EffectiveDatePicker`
  - props: `value, onChange, allowFuture?, employeeHireDate?, quickSelects?, label?`
  - helper: `buildDefaultQuickSelects(hireDate)`

**API Routes (신규)**:
- `GET /api/v1/employees/[id]/history` — EmployeeAssignment 기반 타임라인
- `GET /api/v1/employees/[id]/snapshot?date=YYYY-MM-DD` — Effective Dating 시점조회
- `GET /api/v1/employees/[id]/compensation` — 현재 급여 + SalaryBand 정보
- `GET /api/v1/employees/export` — 필터 적용 엑셀 다운로드 (HR Admin)
- `POST /api/v1/employees/bulk-upload` — 발령 일괄 등록 (Effective Dating 준수)

**스키마 발견 사항**:
- `Department.code`, `JobGrade.code` 필드 존재 → BulkUpload에서 코드 기반 조회 사용
- `CompensationHistory` 관계명: `employee.compensationHistories`

---

### B3-1: Competency Framework + 법인별 리뷰 설정

**DB Migration — 5개 신규 테이블**:
- `CompetencyCategory`, `Competency`, `CompetencyLevel`, `CompetencyIndicator`, `CompetencyRequirement`
- `PerformanceEvaluation.performanceGrade String?`, `competencyGrade String?` 추가

**시드 데이터**:
- 3개 카테고리: core_value / leadership / technical
- 핵심가치 4개 역량: 도전(4개 지표), 신뢰(3개), 책임(3개), 존중(3개) = 13개 지표
- 리더십 3개, 직무전문 5개
- 역량 요건 22개 (핵심가치 16개 × S1~S4 + 리더십 6개 × S3,S4)

**주의**: `CompetencyLibrary` 구 테이블 유지 — `InterviewEvaluation.competencyLibraryId` 참조 존재

---

### B3-2: AI 평가 초안 + 편향 감지 + 승계 고도화

**DB Migration**:
- `AiEvaluationDraft`, `BiasDetectionLog` 신규
- `OneOnOne.sentimentTag`, `SuccessionCandidate.ranking/developmentNote` 추가
- `AiFeature` enum: `EVAL_DRAFT_GENERATION` 추가

**신규 컴포넌트**:
- `EmployeeInsightPanel` — 직원 통합 사이드패널
- `AiDraftModal` — AI 평가 초안 모달
- `BiasDetectionBanner` — 편향 감지 배너

**주의사항**:
- `AiEvaluationDraft.status` 값: draft|reviewed|applied|discarded
- 편향 감지: central_tendency, leniency 2가지 — 추후 severity/recency/tenure/gender 확장 예정

---

### B4: ATS Enhancement (채용 고도화)

**구현 항목**:
- AI 스크리닝 API — Claude API 연동, stage → SCREENING 자동 전환
- 면접 일정 관리 — InterviewSchedule CRUD
- 오퍼 관리 — OfferStatus: DRAFT/SENT/ACCEPTED/DECLINED/EXPIRED
- 내부 공고 — 내부 지원자 → Application 생성
- 채용 요청 결재 — ApprovalRecord 다중 결재 단계
- 후보자 히스토리 타임라인
- 중복 감지 — 3-tier: email(1.0) > phone(0.9) > name+birthDate(0.7)

**스키마 수정**:
- `Application.createdAt` → `appliedAt`
- `Employee.profilePhotoUrl` → `photoUrl`
- `InterviewSchedule.overallScore` 제거

---

### B5: 온보딩/오프보딩 고도화

**DB Migration**:
- `OnboardingPlan.planType` enum: `ONBOARDING / OFFBOARDING / CROSSBOARDING_DEPARTURE / CROSSBOARDING_ARRIVAL`
- `OnboardingCheckin.mood` enum: `GREAT / GOOD / NEUTRAL / STRUGGLING / BAD`
- `ExitInterview` 필드: `detailedReason`, `satisfactionDetail`(JSON), `suggestions`, `isConfidential`
- `CrossboardingRecord` 모델 신규

**핵심 기능**: `triggerCrossboarding()` — 출발/도착 법인 플랜 동시 시작

---

### B6-1: 근태 고도화 (교대+유연+52시간)

**52시간 경고 체계**:
- **주의** (44h+): 노란 배너
- **경고** (48h+): 주황 배너
- **차단** (52h+): 빨간 배너 + KPI 카드 경고색

**DB Migration**:
- `AttendanceSetting` 확장: `alertThresholds`, `enableBlocking`, `timezone`
- `WorkHourAlert` 신규 모델

**생성된 파일**:
- `src/lib/attendance/workTypeEngine.ts` — FIXED/FLEXIBLE/SHIFT/REMOTE 엔진
- `src/lib/attendance/workHourAlert.ts` — 52시간 경고 체커 + DB upsert
- `src/components/employees/tabs/AttendanceTab.tsx` — 직원 프로필 근태 탭

---

### B6-2: 휴가 고도화 (정책엔진 + 통합 승인함)

**DB Migration — 5개 신규 모델**:
- `LeaveTypeDef`, `LeaveAccrualRule`, `LeaveYearBalance`
- `AttendanceApprovalRequest`, `AttendanceApprovalStep`

**Accrual Engine** (`src/lib/leave/accrualEngine.ts`):
- 한국 근로기준법: 첫 해 월 1일(최대 11일), 1년+ 15일/년, 3년+ 2년마다 +1일(최대 25일)
- calendar_year / hire_date_anniversary 두 accrualBasis 지원

**시드 데이터**:
- 6개 법인 LeaveTypeDef: KR(연차·경조사·병가·출산육아), US(Vacation·Sick·PTO), CN(연차·병가·출산) 총 28개

**주의**: `LeaveTypeDef` ≠ `LeaveType` enum — 별개 개념, 혼용 금지

---

### B7-1a: 한국법인 급여 계산 엔진

**DB Migration — 3개 신규 모델**:
- `InsuranceRate` (4대보험 요율, @@unique([year, type]))
- `NontaxableLimit` (비과세 한도, @@unique([year, code]))
- `Payslip` (급여명세서 발급 추적, @@unique([payrollItemId]))

**시드 데이터**:
- 2025년 4대보험 5종: national_pension, health_insurance, long_term_care, employment_insurance, industrial_accident
- 2025년 비과세 한도 4종: meal_allowance(20만), vehicle_allowance(20만), childcare(20만), research_allowance(20만)

**계산 엔진** (`src/lib/payroll/kr-tax.ts`):
- `separateTaxableIncome()` — 비과세 한도 적용 후 과세/비과세 분리
- `calculateProrated()` — 중도입사/퇴사 일할계산 (주 5일 기준 평일 수)
- `detectPayrollAnomalies()` — 이상 항목 감지 (전월 >20% 변동, 초과근무 >기본급 50%)

**Payslip 생성**: `PUT /api/v1/payroll/runs/[id]/approve` — REVIEW→APPROVED 시 직원별 Payslip 자동 생성

---

### B7-1b: 연말정산

**DB Migration — 7개 신규 모델**:
- `YearEndDeductionConfig`, `IncomeTaxRate`, `YearEndSettlement`
- `YearEndDependent`, `YearEndDeduction`, `YearEndDocument`, `WithholdingReceipt`

**계산 엔진** (`src/lib/payroll/yearEndCalculation.ts`):
- `calculateYearEndSettlement()` — 11단계 연말정산 계산
- `calculateDeductibleAmount()` — DB rules 기반 공제항목 한도 적용

**UI**:
- 직원용: `/my/year-end` — 4단계 위저드 (부양가족→공제항목→추가공제→결과)
- HR 관리: `/payroll/year-end` — 진행현황 + 일괄 확정

**설계**: finalSettlement 양수=추가납부, 음수=환급. 한국 법인 전용.

---

### B7-2: 해외 급여 통합 + 글로벌 분析

**DB Migration — 5개 신규 모델**:
- `ExchangeRate`, `PayrollImportMapping`, `PayrollImportLog`
- `PayrollSimulation`, `PayrollAnomaly`

**이상 탐지 4가지 규칙**:
1. 급여 급등 — 전월 대비 50% 초과 증가
2. 마이너스 급여 — netPay < 0
3. 평균 이탈 — 법인 평균 ±3σ
4. 중복 처리 — 같은 yearMonth, 같은 직원 2건 이상

**시드**: `prisma/seeds/foreign-payroll.ts` — 5법인 × 30명 급여 시드 (환율 포함)

---

### B8-1: 조직도 시각화 + 조직 개편

**DB Migration**:
- `OrgRestructurePlan` 신규: status(draft/review/approved/applied), changes(Json)

**구현 항목**:
- OrgClient 3가지 뷰: Tree / List / Grid
- `RestructureModal` — 6가지 변경 유형: create/move/merge/rename/close/transfer_employee
- `RestructureDiffView` — 색상 구분: 신설=초록/제거=빨강/변경=노랑/이동=파랑

---

### B8-2: People Directory + Self-Service

**DB Migration**:
- `ProfileVisibility` 모델 (4-level: public/team/manager/private)
- `EmployeeProfileExtension.avatarPath` 추가
- `ProfileChangeRequest.reason`, `documentPath` 추가

**구현 항목**:
- People Directory (`/directory`) — 카드뷰/테이블뷰, ProfileVisibility 기반 마스킹
- Self-Service (`/my/profile`) — 4탭: 기본정보/연락처/비상연락처/공개설정
- My Space Dashboard (`/my`) — 프로필 요약, KPI 4개, 바로가기 6개

**EmployeeLeaveBalance 접근 패턴 (확정)**:
```ts
prisma.employeeLeaveBalance.findMany({
  where: { employeeId },
  include: { policy: { select: { name: true, leaveType: true } } },
})
// lb.grantedDays, lb.usedDays (Decimal)
const remaining = Number(lb.grantedDays) - Number(lb.usedDays)
```

---

### B8-3: 스킬 매트릭스 + 갭 분석

**DB Migration**:
- `EmployeeSkillAssessment` 확장: `selfLevel`, `managerLevel`, `finalLevel`, `expectedLevel`, `managerComment`
- `SkillGapReport` 신규
- `CompetencyRequirement` 신규: @@unique([competencyId_companyId_jobLevelCode])

**구현 항목**:
- `/my/skills` — 자기평가 UI (GAP 뱃지: 미달/부족/충족/초과)
- `/team/skills` — 매니저 평가 UI
- `/organization/skill-matrix` — 히트맵 + 레이더 차트 + 갭 리포트

**시드 데이터**:
- CompetencyRequirement: G3~G6 직급별 기대레벨
- CTR-KR MFG 직원 6명 + EmployeeSkillAssessment 54건 (period: 2026-H1)

---

### B9-1: LMS Lite (법정 의무교육 + 스킬 갭 추천)

**DB Migration**:
- `TrainingCourse` 확장: `format`, `linkedCompetencyIds`, `expectedLevelGain`, `provider`
- `MandatoryTrainingConfig` 신규
- `TrainingEnrollment` 확장: `source`(manual/mandatory_auto/system), `score`, `expiresAt`
- `EmployeeSkillAssessment` 신규 (B8-3에서 확장)
- `EnrollmentStatus` enum: `FAILED`, `EXPIRED` 추가

**시드 데이터**:
- 법정 의무교육 3개: LEG-001(산업안전보건), LEG-002(성희롱예방), LEG-003(개인정보보호)
- 직무 필수 5개: JOB-001~005
- 자기개발 4개: DEV-001~004
- MandatoryTrainingConfig 6개

---

### B9-2: 복리후생 신청·승인

**DB Migration — 3개 신규 모델**:
- `BenefitPlan`, `BenefitClaim`, `BenefitBudget`
- Migration: `a_benefit_claims`

**시드 데이터**:
- CTR-KR 10개 (family 5, education 2, health 2, lifestyle 1)
- CTR-US 5개 (financial 2, health 2, lifestyle 1)
- CN/RU/VN/MX 각 2개 = 총 23개 benefit_plans
- 예산 2025: KR 4카테고리(₩50M), US 3카테고리($90K) = 7개 benefit_budgets

**핵심 비즈니스 로직**:
- 승인 시 `BenefitBudget.usedAmount` 자동 증가 (트랜잭션)
- 연간 한도 초과 신청 차단
- 예산 80% 초과 시 경고 배지

---

### B10-1: HR 예측 애널리틱스

**DB Migration — 5개 신규 모델**:
- `TurnoverRiskScore`, `BurnoutScore`, `TeamHealthScore`
- `AnalyticsSnapshot`, `AnalyticsConfig`

**예측 엔진** (`src/lib/analytics/predictive/`):
- `turnoverRisk.ts` — 10개 신호 가중합 (riskLevel: low/medium(35+)/high(55+)/critical(75+))
- `burnout.ts` — 5개 지표 (riskLevel: low/medium(30+)/high(50+)/critical(70+))
- `teamHealth.ts` — 5개 지표 (팀 평균 감정, 이직률, 연차 사용률, 초과근무 분산도, 퇴직자 만족도)

**구현 항목**:
- `/analytics/predictive` — 4탭: 이직예측/번아웃/팀건강/인력현황
- `/analytics/predictive/[employeeId]` — 개인 상세 (SVG 게이지 + RadarChart + 권고사항)

**주의**:
- `Attendance.workDate` (Date 타입) vs `clockIn`/`clockOut` (DateTime 타입) 구분
- `ExitInterview.satisfactionScore` (1~10 스케일)

---

### B10-2: HR KPI 대시보드

**DB Migration**:
- `KpiDashboardConfig` (kpi_dashboard_configs) — 사용자별 대시보드 레이아웃

**라우트**:
- `/dashboard` — HR KPI 메인 (HR_ADMIN/SUPER_ADMIN/EXECUTIVE)
- `/dashboard/compare` — 글로벌 법인 비교

**위젯 목록** (widgetId: 데이터소스: 차트타입):
- `workforce-grade/company/trend/tenure`, `recruit-pipeline/ttr/talent-pool`
- `perf-grade/skill-gap`, `attend-52h/leave-trend/burnout`
- `payroll-cost`, `training-mandatory/benefit`

**공유 컴포넌트**:
- `KpiWidget` — bar/bar-horizontal/line/donut/number 차트타입
- `KpiSummaryCard` — 숫자형 KPI + 전월 변동
- `WidgetSkeleton`, `WidgetEmpty`

**스키마 주의**:
- TalentPool 모델 = `TalentPoolEntry` (companyId 필드 없음)
- TrainingEnrollment status = `ENROLLMENT_COMPLETED` (not 'COMPLETED')
- EmployeeAssignment 시작일 = `effectiveDate` (not `startDate`)
- PayrollRun → PayrollItem 관계명 = `payrollItems` (not `items`)

---

### B11: 알림 시스템 강화 + i18n 보완 + Teams 연동 완성

**이벤트 연결 현황**:

| 이벤트 | 파일 | 상태 |
|--------|------|------|
| leave_approved | api/v1/leave/requests/[id]/approve/route.ts | ✅ 연결됨 |
| leave_rejected | api/v1/leave/requests/[id]/reject/route.ts | ✅ 연결됨 |
| overtime_warning_48h | lib/attendance/workHourAlert.ts | ✅ 연결됨 |
| overtime_blocked_52h | lib/attendance/workHourAlert.ts | ✅ 연결됨 |
| payslip_issued | api/v1/payroll/runs/[id]/approve/route.ts | ✅ 연결됨 |
| turnover_risk_critical | lib/analytics/predictive/turnoverRisk.ts | ✅ 연결됨 |
| benefit_approved | api/v1/benefit-claims/[id]/route.ts (PATCH) | ✅ 연결됨 |
| evaluation_deadline | cron/eval-reminder 존재 | ⏭️ 스킵 |
| onboarding_task_overdue | 별도 스케줄러 없음 | ⏭️ 스킵 |

**i18n 추가 키**: `notification.types.*`, `notification.priority.*`, `notification.channels.*`, `notification.preference.*`

---

## FIX 이력

| 항목 | 내용 | 상태 |
|------|------|------|
| FIX-1 (STEP 시절) | 사이드바 Dead Link + 차트 컬러 | ✅ |
| 6A-FIX-1 | 성과관리 코어 (12 API + 14 컴포넌트) | ✅ |
| 6A-FIX-2 | CFR 1:1 미팅 + Recognition | ✅ |
| 6A-FIX-3 | Pulse Survey + 360° Peer Review | ✅ |
| **FIX-1 (보안)** | Critical 4건 + Medium 다수 수정 | ✅ 2026-03-03 |
| **FIX-2 (성능)** | N+1 쿼리 + 페이지네이션 + 복합인덱스 | ✅ 2026-03-03 |
| **Phase0-Step1** | `src/lib/timezone.ts` 글로벌 타임존 유틸 SSOT 생성 (`date-fns-tz` 3.2.0 추가) | ✅ 2026-03-05 |
| **Phase0-Step2** | `src/lib/api.ts` ApiClient에 `serializeDates()` 추가 — POST/PUT/PATCH 요청 body의 Date 인스턴스를 ISO 8601 문자열로 자동 변환 | ✅ 2026-03-05 |
| **Phase0-Step3** | 급여 계산 엔진 타임존 정합성 완성 — `kr-tax.ts` UTC-safe 날짜 산술 + `calculator.ts` `resolveCompanyTimezone()` 도입으로 근태 조회/일할계산 경계를 법인 로컬 타임존 기준 UTC Date로 교체. `npm run build` 성공 (next-app-loader 패치 포함). **Phase 0 Complete.** | ✅ 2026-03-05 |
| **Phase1-Session2** | CRAFTUI white/blue 테마 글로벌 레이아웃 적용 — `Sidebar.tsx` dark→white 전환 (bg-white, border-r #F0F0F3, 활성 #5E81F4, 비활성 #8181A5), `Header.tsx` 보더 #F0F0F3 업데이트, `DashboardShell.tsx` + `layout.tsx` 메인 배경 bg-[#F5F5FA] 적용. `npx tsc --noEmit` 0 errors. | ✅ 2026-03-05 |
| **Phase1-Session3** | CRAFTUI Flat UI 코어 컴포넌트 표준화 — `button.tsx` shadow 제거 + primary(#5E81F4)/destructive(#FF808B)/outline/secondary/ghost 업데이트, `badge.tsx` success/warning/danger/info 시맨틱 variant 추가, `input.tsx` bg-white + border #F0F0F3 + placeholder #8181A5 + focus #5E81F4, `select.tsx` SelectTrigger shadow 제거 + 동일 Input 스타일 적용. `npx tsc --noEmit` 0 errors. | ✅ 2026-03-05 |
| **Phase1-Session4** | P03 Data Table, Pagination, Facet Filters CRAFTUI flat 테마 표준화 — `table.tsx` TableHeader sticky(top-0 z-10 bg-white) + TableHead text-[#8181A5] font-bold + border-[#F0F0F3], TableRow hover:bg-[#F5F5FA], TableCell text-[#1C1D21] 적용. `DataTable.tsx` 래퍼 rounded-xl border-[#F0F0F3], 정렬 버튼 #8181A5→#1C1D21, 페이지네이션 border/text CRAFTUI 업데이트. `EmployeeFilterPanel.tsx` FilterChip bg-[#5E81F4]/10 text-[#5E81F4], 카운트 뱃지 #5E81F4, 패널 border-[#F0F0F3] 적용. `npx tsc --noEmit` 0 errors. | ✅ 2026-03-05 |
| **Phase1-Session5** | P01 Master-Detail 패턴 표준화 + Next.js URL Deep Linking 구현 — `src/components/shared/DetailPanel.tsx` 신규 (CRAFTUI slide-over: bg-white, border-l #F0F0F3, backdrop, Escape key, translate-x animation). `EmployeeListClient.tsx` 리팩토링: `usePathname`+`useSearchParams`로 `?selectedId=` URL 딥링크, 행 클릭 시 full navigate → query param 전환, `EmployeeQuickPanel` 인라인 컴포넌트(아바타+이름+직급+부서+입사일+상태+전체보기 버튼) 추가. `npx tsc --noEmit` 0 errors. | ✅ 2026-03-05 |
| **Phase1-Session6** | Mobile-First UX for Deskless Workers — `DashboardShell.tsx` Sidebar 를 `hidden md:flex` 래퍼로 감싸 모바일 숨김 + main에 `pb-16 md:pb-6` 추가. `MobileBottomNav.tsx` 신규 (CRAFTUI: bg-white border-t #F0F0F3 fixed bottom-0, 4탭: 홈/근태/승인함/내정보, active=#5E81F4 usePathname 기반). `MobilePunchCard.tsx` 신규 (원터치 GPS 출퇴근: navigator.geolocation + method=MOBILE_GPS, IN/OUT 상태 분기, 에러 핸들링 3종). `npx tsc --noEmit` 0 errors. | ✅ 2026-03-05 |
| **Phase2-Session1** | Bulk Approve/Reject in Unified Inbox — `AttendanceApprovalClient.tsx` 체크박스 컬럼 + Select All 헤더 + Floating Action Bar (일괄 승인/반려 CRAFTUI 버튼) 추가. `POST /api/v1/approvals/attendance/bulk` 신규 Route Handler (ids[] + action APPROVE/REJECT, 트랜잭션 처리, 권한 검증 per item). `npx tsc --noEmit` 0 errors. | ✅ 2026-03-05 |
| **Phase2-Session2** | Transformed static 52-hour warning into an Actionable Alert with Schedule Adjustment Modal — `AttendanceTab.tsx` 배너를 CRAFTUI warning(`bg-[#F4BE5E]/10 text-[#B45309]`)/danger(`bg-[#FF808B]/10 text-[#E11D48]`) 토큰으로 교체 + "근무 일정 조정" 버튼 추가. `src/components/attendance/ScheduleAdjustmentModal.tsx` 신규 생성 (4가지 조정 유형 라디오 선택 + 적용 요일 셀렉트 + 사유 입력 + 제출 로딩/성공 상태). `npx tsc --noEmit` 0 errors. | ✅ 2026-03-05 |
| **Phase2-Session3** | Upgraded ATS Kanban board with Job-based Swimlanes and strictly scoped Drag-and-Drop context — `GET /api/v1/recruitment/board` 신규 (OPEN 공고 최대 20개 + 각 지원자 목록 중첩 반환). `/recruitment/board/page.tsx` + `BoardClient.tsx` 신규 (CRAFTUI: bg-[#F5F5FA], 카드 bg-white border-[#F0F0F3]). DnD: `handleDragStart`에서 `posting-id`를 `dataTransfer`에 저장, `handleDrop`에서 `sourcePostingId !== targetPostingId` 조건으로 크로스 스윔레인 이동 엄격 차단. `navigation.ts` "칸반 보드" 메뉴 추가. `npx tsc --noEmit` 0 errors. | ✅ 2026-03-05 |
| **Phase2-Session4** | Implemented real-time duplicate candidate detection (onBlur) for ATS forms — `GET /api/v1/recruitment/candidates/check` 신규 (email/phone 쿼리파라미터, Applicant 정확 매칭, exists+candidate 반환). `ApplicantFormClient.tsx` 수정: `checkFieldDuplicate()` 헬퍼 + `handleEmailBlur`/`handlePhoneBlur` 추가, Email·Phone 인풋에 `onBlur` 연결, 중복 감지 시 CRAFTUI warning(`bg-[#F4BE5E]/10 text-[#B45309]`) 인라인 배너 즉시 표시. `npx tsc --noEmit` 0 errors. | ✅ 2026-03-05 |
| **Phase2-Session5** | Implemented global Cmd+K Command Palette for omni-navigation — `CommandPalette.tsx` 전면 재작성: cmdk/CommandDialog 의존 제거 → 커스텀 CRAFTUI 모달 (bg-white, border-[#F0F0F3], rounded-xl, shadow-2xl, backdrop bg-black/40). 단축키 Cmd+O → **Cmd+K / Ctrl+K** 변경, ArrowUp/ArrowDown/Enter 키보드 네비게이션, 검색 인풋 focus:outline-none focus:ring-0, 활성 항목 bg-[#F5F5FA] text-[#5E81F4]. ResultGroup/ResultItem 서브컴포넌트 분리. 메뉴 항목 21개 → 28개로 확충. `npx tsc --noEmit` 0 errors. | ✅ 2026-03-05 |
| **Phase2-Session6** | Implemented Visual Shift Roster with Drag-and-Drop grid UI — `src/components/attendance/ShiftRosterBoard.tsx` 신규 (CRAFTUI flat: bg-white, border-[#F0F0F3], 주간=`bg-[#5E81F4]/10 text-[#5E81F4]`, 야간=`bg-[#1C1D21]/10 text-[#1C1D21]`, 휴무=`bg-[#FF808B]/10 text-[#FF808B]`). Y축=직원(아바타+이름+부서), X축=날짜(1주 뷰, Sticky 헤더+첫 컬럼). Toolbar에서 Shift Block 드래그 → 셀에 Drop, 기존 셀 간 이동(Move), 낙관적 업데이트(optimistic). `src/app/api/v1/attendance/shifts/route.ts` 신규 (GET 보드 데이터 + POST 셀 단위 upsert/delete). `src/app/(dashboard)/attendance/shift-roster/page.tsx` 신규. `npx tsc --noEmit` 0 errors. | ✅ 2026-03-05 |
| **Phase2-Session7** | Created Org Studio split-view layout with mock Draggable Tree and Impact Analysis panel — `src/app/(dashboard)/org-studio/page.tsx` + `OrgStudioClient.tsx` 신규 (70/30 split, `bg-[#F5F5FA]` CRAFTUI 배경, 상단 시뮬레이션 모드 배너). `src/components/org-studio/DraggableOrgTree.tsx` 신규 (계층 트리 4단계, GripVertical 드래그 핸들, 3색 레벨 accent, 아코디언 expand/collapse, 109명 mock 데이터). `src/components/org-studio/ImpactAnalysisPanel.tsx` 신규 (3개 메트릭 카드: 총 인원/월 인건비/부서 수, Diff 섹션: 인원·비용·부서 변화, 선택 부서 상세, 시뮬레이션 안내). `npx tsc --noEmit` 0 errors. | ✅ 2026-03-05 |
| **Phase3-Session1** | Implemented `@tanstack/react-virtual` v3.13.19 for rendering optimization in large data tables — `DataTable.tsx`에 `virtualScroll`, `virtualScrollHeight`, `estimatedRowHeight` 3개 prop 추가. `virtualScroll=true` 시: 고정 높이 스크롤 컨테이너 + sticky thead + 상하 spacer `<tr>` 패턴으로 전체 스크롤 높이 유지, `overscan=5` 버퍼로 스크롤 찰진 렌더링. 기본 paginated 모드는 완전 하위 호환 (opt-in 설계). `npx tsc --noEmit` 0 errors. | ✅ 2026-03-05 |
| **Phase3-Session2&3** | CLS 방지 WidgetSkeleton + 폼 Auto-save UX — `src/components/shared/WidgetSkeleton.tsx` 신규 (CRAFTUI flat: bg-white, border-[#F0F0F3], rounded-xl, p-6, animate-pulse, `height`/`lines`/`showChart` props). `HrAdminHome.tsx` KPI 카드 그리드에 4개 스켈레톤 로딩 fallback 적용 (loading state). `src/hooks/useAutoSave.ts` 신규 (1초 디바운스 localStorage 자동 저장, `loadSaved`/`clearSaved`/`savedAt` 반환). `ApplicantFormClient.tsx` 통합: 마운트 시 저장 초안 복원, 제출 성공 시 `clearSaved()`, 액션 바에 "초안 자동 저장됨 HH:MM" 인디케이터(`text-xs text-[#8181A5]`). `npx tsc --noEmit` 0 errors. **마스터플랜 최종 완료.** | ✅ 2026-03-05 |

### FIX-1 보안 수정 주요 내용
| # | 심각도 | 파일 | 내용 |
|---|--------|------|------|
| C-1 | 🔴 Critical | `payroll/anomalies/route.ts` | companyId 필터 누락 → resolveCompanyId 적용 |
| C-2 | 🔴 Critical | `payroll/import-logs/route.ts` | IDOR → resolveCompanyId 적용 |
| C-3 | 🔴 Critical | `lib/vector-search.ts` | SQL Injection → 파라미터 바인딩 교체 |
| C-4 | 🔴 Critical | `analytics/calculate/route.ts` | 동시 쿼리 1000개 → BATCH_SIZE=50 순차 처리 |
| M-6 | 🟠 Medium | 14개 파일 | NextResponse.json() → apiSuccess/apiError 표준화 |

```ts
// src/lib/api/companyFilter.ts
export function resolveCompanyId(user: SessionUser, requestedId?: string | null): string
// SUPER_ADMIN → requestedId 허용, 그 외 → user.companyId 강제
```

### FIX-2 성능 최적화 주요 내용
| # | 심각도 | 대상 | 내용 |
|---|--------|------|------|
| M-3 | 🟠 Medium | 8개 API 라우트 | N+1 쿼리 → include/select 통합 |
| M-4 | 🟠 Medium | `payroll/payslips/route.ts` | 페이지네이션 누락 → apiPaginated 적용 |
| N-1 | 🟡 Low | 6개 모델 | 복합 인덱스 추가 (Employee, JobPosting, PerformanceEvaluation 등) |

---

## 공유 패턴/컴포넌트 레지스트리

| 컴포넌트/함수 | 생성 세션 | 경로 | 용도 |
|-------------|----------|------|------|
| CompanySelector | B1 | `components/company/` | 법인 전환 드롭다운 |
| GlobalOverrideBadge | B1 | `components/company/` | 글로벌/커스텀 뱃지 |
| useCompanySettings | B1 | `hooks/` | 법인별 설정 조회 |
| AssignmentTimeline | B2 [A] | `@/components/shared/AssignmentTimeline` | 직원 발령 타임라인 |
| EffectiveDatePicker | B2 [A] | `@/components/shared/EffectiveDatePicker` | 시점 조회 날짜 선택 |
| CandidateTimeline | B4 [B] | `@/components/recruitment/CandidateTimeline` | 후보자 히스토리 타임라인 |
| DuplicateWarningModal | B4 [B] | `@/components/recruitment/DuplicateWarningModal` | 중복 지원자 경고 모달 |
| triggerCrossboarding | B5 [B] | `@/lib/crossboarding` | 크로스보딩 트리거 헬퍼 |
| AttendanceTab | B6-1 [B] | `@/components/employees/tabs/AttendanceTab` | 직원 프로필 근태 탭 |
| workTypeEngine | B6-1 [B] | `@/lib/attendance/workTypeEngine` | FIXED/FLEXIBLE/SHIFT/REMOTE 엔진 |
| workHourAlert | B6-1 [B] | `@/lib/attendance/workHourAlert` | 52시간 경고 체커 |
| EmployeeInsightPanel | B3-2 [A] | `@/components/performance/EmployeeInsightPanel` | 직원 통합 사이드패널 |
| AiDraftModal | B3-2 [A] | `@/components/performance/AiDraftModal` | AI 평가 초안 모달 |
| BiasDetectionBanner | B3-2 [A] | `@/components/performance/BiasDetectionBanner` | 편향 감지 배너 |
| 통합 승인함 | B6-2 [A] | `/approvals/attendance/AttendanceApprovalClient` | AttendanceApprovalRequest 2-패널 UI |
| LeaveSettingsClient | B6-2 [A] | `/settings/leave/LeaveSettingsClient` | 3탭: 휴가 유형/부여 규칙/이월 소멸 |
| MyLeaveClient | B6-2 [A] | `/my/leave/MyLeaveClient` | 직원 휴가 현황 |
| accrualEngine | B6-2 [A] | `@/lib/leave/accrualEngine` | 법인별 휴가 부여 엔진 |
| MandatoryConfigTab | B9-1 [B] | `@/components/training/MandatoryConfigTab` | 법정 의무교육 설정 CRUD |
| MyTrainingClient | B9-1 [B] | `@/app/(dashboard)/my/training/MyTrainingClient` | 직원 교육 현황 뷰 |
| RestructureModal | B8-1 [B] | `@/components/org/RestructureModal` | 조직 개편 3-step 워크플로 |
| RestructureDiffView | B8-1 [B] | `@/components/org/RestructureDiffView` | 조직 개편 Diff 미리보기 |
| separateTaxableIncome | B7-1a [A] | `@/lib/payroll/kr-tax` | 비과세 한도 적용 |
| calculateProrated | B7-1a [A] | `@/lib/payroll/kr-tax` | 중도입사 일할계산 |
| detectPayrollAnomalies | B7-1a [A] | `@/lib/payroll/kr-tax` | 이상 항목 감지 |
| calculateYearEndSettlement | B7-1b [A] | `@/lib/payroll/yearEndCalculation` | 11단계 연말정산 계산 |
| calculateDeductibleAmount | B7-1b [A] | `@/lib/payroll/deductionCalculator` | 공제항목 한도 계산 |
| YearEndWizardClient | B7-1b [A] | `@/app/(dashboard)/my/year-end/YearEndWizardClient` | 직원용 4단계 연말정산 위저드 |
| YearEndHRClient | B7-1b [A] | `@/app/(dashboard)/payroll/year-end/YearEndHRClient` | HR 연말정산 관리 |
| useDebounce | B8-2 [B] | `@/hooks/useDebounce` | 디바운스 훅 |
| DirectoryClient | B8-2 [B] | `@/app/(dashboard)/directory/DirectoryClient` | People Directory |
| MySpaceClient | B8-2 [B] | `@/app/(dashboard)/my/MySpaceClient` | My Space 대시보드 |
| MyProfileClient | B8-2 [B] | `@/app/(dashboard)/my/profile/MyProfileClient` | Self-Service 프로필 편집 |
| MySkillsClient | B8-3 [B] | `@/app/(dashboard)/my/skills/MySkillsClient` | 자기평가 폼 |
| TeamSkillsClient | B8-3 [B] | `@/app/(dashboard)/team/skills/TeamSkillsClient` | 팀원별 역량 평가 |
| SkillMatrixClient | B8-3 [B] | `@/app/(dashboard)/organization/skill-matrix/SkillMatrixClient` | 스킬 매트릭스 히트맵 |
| ExchangeRateClient | B7-2 [A] | `@/app/(dashboard)/settings/exchange-rates/ExchangeRateClient` | 환율 관리 UI |
| GlobalPayrollClient | B7-2 [A] | `@/app/(dashboard)/payroll/global/GlobalPayrollClient` | 글로벌 급여 대시보드 |
| PayrollSimulationClient | B7-2 [A] | `@/app/(dashboard)/payroll/simulation/PayrollSimulationClient` | 급여 시뮬레이션 |
| PayrollAnomaliesClient | B7-2 [A] | `@/app/(dashboard)/payroll/anomalies/PayrollAnomaliesClient` | 급여 이상 탐지 |
| MyBenefitsClient | B9-2 [A] | `@/app/(dashboard)/my/benefits/MyBenefitsClient` | 직원 복리후생 신청 |
| BenefitsHRClient | B9-2 [A] | `@/app/(dashboard)/benefits/BenefitsHRClient` | HR 복리후생 관리 |
| PredictiveAnalyticsClient | B10-1 [B] | `@/app/(dashboard)/analytics/predictive/PredictiveAnalyticsClient` | HR 예측 애널리틱스 4탭 |
| EmployeeRiskDetailClient | B10-1 [B] | `@/app/(dashboard)/analytics/predictive/[employeeId]/EmployeeRiskDetailClient` | 개인 이직위험 상세 |
| turnoverRiskEngine | B10-1 [B] | `@/lib/analytics/predictive/turnoverRisk` | 이직 위험 예측 엔진 |
| burnoutEngine | B10-1 [B] | `@/lib/analytics/predictive/burnout` | 번아웃 감지 엔진 |
| teamHealthEngine | B10-1 [B] | `@/lib/analytics/predictive/teamHealth` | 팀 심리안전 지수 엔진 |
| KpiWidget | B10-2 [A] | `@/components/dashboard/KpiWidget` | 추상 위젯 컴포넌트 |
| KpiSummaryCard | B10-2 [A] | `@/components/dashboard/KpiSummaryCard` | 숫자형 KPI 카드 |
| WidgetSkeleton | B10-2 [A] | `@/components/dashboard/WidgetSkeleton` | 위젯 로딩 스켈레톤 |
| WidgetEmpty | B10-2 [A] | `@/components/dashboard/WidgetEmpty` | 위젯 빈 상태 |
| WidgetSkeleton (shared) | Phase3-S2 | `@/components/shared/WidgetSkeleton` | CLS 방지 범용 위젯 스켈레톤 (height/lines/showChart props) |
| useAutoSave | Phase3-S3 | `@/hooks/useAutoSave` | 폼 데이터 1초 디바운스 localStorage 자동 저장 훅 |
| resolveCompanyId | FIX-1 | `@/lib/api/companyFilter` | SUPER_ADMIN/법인 필터 유틸 |
| batchProcess | FIX-2 | `@/lib/api/batchProcess` | 대용량 배치 처리 청크 유틸 |
| formatToTz | Phase0-Step1 | `@/lib/timezone` | 날짜→타임존 문자열 포맷 |
| getStartOfDayTz | Phase0-Step1 | `@/lib/timezone` | 타임존 기준 하루 시작 (UTC Date) |
| getEndOfDayTz | Phase0-Step1 | `@/lib/timezone` | 타임존 기준 하루 끝 (UTC Date) |
| parseDateOnly | Phase0-Step1 | `@/lib/timezone` | YYYY-MM-DD → UTC Date (로컬타임존 무시) |
| ScheduleAdjustmentModal | Phase2-Session2 | `@/components/attendance/ScheduleAdjustmentModal` | 52시간 초과 시 근무 일정 조정 요청 모달 |
| ShiftRosterBoard | Phase2-Session6 | `@/components/attendance/ShiftRosterBoard` | 현장 근무자 교대 배정 DnD 그리드 (1주 뷰, 3가지 근무 유형, 낙관적 업데이트) |

---

## 확립된 공통 패턴

### apiSuccess vs apiPaginated
```ts
// ✅ 비배열 객체 응답
return apiSuccess({ members, evalSettings })

// ❌ 배열이 아닌 객체에 apiPaginated 사용 금지
```

### apiClient.get vs getList
```ts
// ✅ 비배열 응답: apiClient.get
const res = await apiClient.get<EvalPayload>(url, params)
setTeamMembers(res.data.members ?? [])

// ✅ 배열 응답: apiClient.getList
const res = await apiClient.getList<T>(url, params)
setItems(res.data)
```

### Bulk Replace 트랜잭션 패턴
```ts
const updated = await prisma.$transaction(async (tx) => {
  await tx.competencyIndicator.deleteMany({ where: { competencyId } })
  if (items.length > 0) {
    await tx.competencyIndicator.createMany({ data: items })
  }
  return tx.competencyIndicator.findMany({ where: { competencyId }, orderBy: { displayOrder: 'asc' } })
})
```

### Seed upsert — compound unique key
```ts
await prisma.competencyIndicator.upsert({
  where: { competencyId_displayOrder: { competencyId, displayOrder: i } },
  update: { indicatorText, isActive: true },
  create: { competencyId, indicatorText, displayOrder: i, isActive: true },
})
```

### @db.Uuid 사용 금지
```prisma
// ❌ 잘못됨
id String @id @default(uuid()) @db.Uuid

// ✅ 올바름
id String @id @default(uuid())
```

### AppError 패턴
```ts
// ✅ 올바름
throw badRequest('message')
throw handlePrismaError(err)

// ❌ 잘못됨 (return 사용)
return badRequest('message')
```

### Application 날짜 필드
```ts
// Application 모델은 createdAt 없음 → appliedAt 사용
orderBy: { appliedAt: 'desc' }
```

### apiClient 응답 처리
```ts
// apiClient.get<T>() returns ApiResponse<T>, not T
apiClient.get<T>(url).then(res => setData(res.data ?? null))
```

### Zod .issues vs .errors
```ts
// ✅ Zod v3+
parsed.error.issues.map((e) => e.message)
```

### Server Component → Client Component companies prop 패턴
```ts
// page.tsx (Server)
const companies = user.role === ROLE.SUPER_ADMIN
  ? await prisma.company.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } })
  : []
return <XxxDashboardClient user={user} companies={companies} />
```

### WHERE 절 — companyId 조건부 spread
```ts
const where: Prisma.XxxWhereInput = {
  ...(companyId
    ? { employee: { assignments: { some: { companyId, isPrimary: true, endDate: null } } } }
    : {}),
}
```

### LeaveYearBalance.remaining 계산
```ts
// remaining은 DB 컬럼이 아닌 계산값
remaining = entitled + carriedOver + adjusted - used - pending
```

### ACTION 상수 매핑
```ts
ACTION.VIEW   === 'read'    // ✅ (ACTION.READ 존재하지 않음)
ACTION.APPROVE === 'manage' // ✅ (ACTION.MANAGE 존재하지 않음)
```

### Zod z.record() 2개 인자
```ts
z.record(z.string(), z.number())  // ✅ Zod v3
```

### Prisma named export
```ts
import { prisma } from '@/lib/prisma'  // ✅
import prisma from '@/lib/prisma'      // ❌
```

### EmployeeLeaveBalance 접근 패턴
```ts
const remaining = Number(lb.grantedDays) - Number(lb.usedDays)
```

### BigInt 직렬화
```ts
JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
```

### 스킬 갭 계산
```ts
gap = expectedLevel - finalLevel
// gap > 0: 미달 / gap < 0: 강점 / gap === 0: 충족
```

### CompetencyRequirement key 패턴
```ts
const reqMap = new Map(requirements.map((r) => [`${r.competencyId}_${r.jobLevelCode ?? ''}`, r.expectedLevel]))
```

### Prisma 관계명 + Employee 필드명
```ts
// PayrollItem → PayrollRun 관계명: 'run' (not 'payrollRun')
prisma.payrollItem.findMany({ where: { run: { companyId } } })

// Employee 필드명
employee.name       // ✅ (nameKo ❌)
employee.employeeNo // ✅ (employeeNumber ❌)

// PayrollItem 필드명
item.baseSalary     // ✅ (basePay ❌)
```

### BenefitBudget usedAmount 트랜잭션
```ts
await prisma.$transaction(async (tx) => {
  await tx.benefitClaim.update({ where: { id }, data: { status: 'APPROVED' } })
  await tx.benefitBudget.updateMany({
    where: { companyId, category, year },
    data: { usedAmount: { increment: claim.requestAmount } },
  })
})
```

### Promise.allSettled 방어 코딩
```ts
const results = await Promise.allSettled([fetchWidget1(), fetchWidget2()])
const widget1 = results[0].status === 'fulfilled' ? results[0].value : null
```

### AnalyticsConfig 우선순위 패턴
```ts
const config = await prisma.analyticsConfig.findFirst({ where: { configType: 'turnover_risk' } })
const weights = config ? (config.config as WeightMap) : DEFAULT_WEIGHTS
// 가용 신호 3개 미만이면 insufficient_data 반환
if (availableSignals < 3) return { riskLevel: 'insufficient_data', overallScore: 0 }
```

### Attendance 모델 필드 구분
```ts
workDate   // Date 타입 — where/orderBy
clockIn    // DateTime 타입 — 시각 계산
clockOut   // DateTime 타입 — 시각 계산
```

### Prisma 마이그레이션 트랙 접두사
```bash
npx prisma migrate dev --name a_b2_core_hr  # [A] 트랙
npx prisma migrate dev --name b_b4_ats       # [B] 트랙
```

### buildPagination 인자 순서
```ts
buildPagination(page, limit, total)  // ✅
```

---

## 법인별 핵심 차이 요약

| 항목 | KR | US | CN | RU | VN | MX |
|------|----|----|----|----|----|-----|
| 통화 | KRW | USD | CNY | RUB | VND | MXN |
| 주당 법정상한 | 52h | 40h (FLSA) | 44h+36h/월OT | 40h | 48h | 48h |
| 연차 기본 | 근속기반 15~25일 | PTO 20일 | 근속 5~15일 | 28일(캘린더) | 12일+근속 | 12일+근속 |
| 4대보험 | 국민연금/건강/고용/산재 | Social Security/Medicare | 5险1금 | 연금/의료/사회 | 사회보험 | IMSS |
| 성과주기 | 반기 | 연간 | 반기 | 연간 | 반기 | 연간 |
| 언어 | 한국어 | 영어 | 중국어 | 러시아어 | 베트남어 | 스페인어 |
| 타임존 | Asia/Seoul | America/Chicago | Asia/Shanghai | Europe/Moscow | Asia/Ho_Chi_Minh | America/Mexico_City |

---

## Prisma 마이그레이션 병렬 운영 규칙

⚠️ 두 트랙이 동시에 `prisma migrate dev`를 실행하면 DB lock 충돌이 발생할 수 있습니다.

**규칙**:
1. 각 트랙의 마이그레이션 이름에 트랙 접두사 사용
2. **동시 migrate 금지** — 한 트랙이 완료 후 다른 트랙 시작
3. migrate 충돌 발생 시: `npx prisma migrate resolve` 또는 수동 병합
4. 양쪽 다 schema.prisma를 수정하므로, **모델 정의 영역을 분리** (`// === TRACK A: B2 ===` 주석 구간 표시)

---

## Architectural Decisions

### Leave Balance — Dual Model Design

두 테이블이 설계상 의도적으로 병렬 존재하며, 각각 명확한 역할이 다르다.

| 모델 | 역할 | 업데이트 주체 |
|------|------|--------------|
| `EmployeeLeaveBalance` | 휴가 사용량 추적 SSOT | 신청 / 승인 / 반려 / 취소 파이프라인 |
| `LeaveYearBalance` | Accrual 엔진 출력 전용 | `lib/leave/accrualEngine.ts` |

**규칙**:
- `EmployeeLeaveBalance` — `request / approve / reject / cancel` API만 수정한다.
- `LeaveYearBalance` — `accrualEngine.ts`만 수정한다. request 파이프라인에서는 **절대 건드리지 않는다**.
- 두 테이블 간 cross-update 로직을 추가하지 않는다.
- 이중 모델은 버그가 아니다 — 설계 결정이다.

