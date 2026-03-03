# SHARED.md — 글로벌 공유 컨텍스트

> **이 파일은 읽기 전용입니다.** 각 트랙 세션에서 수정하지 마세요.
> 주차 종료 후 TRACK_A.md + TRACK_B.md 내용을 여기로 머지합니다.

---

## 프로젝트 기본 정보

- **프로젝트**: CTR HR Hub v2.0
- **스택**: Next.js (App Router) + Supabase Auth/Storage/Realtime + PostgreSQL + **Prisma ORM** + Tailwind CSS
- **DB 규칙**: 모든 테이블 = `prisma/schema.prisma` → `prisma migrate dev`. Supabase는 Auth+Storage+Realtime만.
- **법인**: CTR-KR, CTR-CN, CTR-RU, CTR-US, CTR-VN, CTR-MX (6개국)

---

## Phase A 완료 산출물 (STEP 1~5)

### A1: 인증 + 역할 기반 접근제어
- Supabase Auth (이메일/비밀번호)
- 역할: super_admin, hr_admin, manager, employee
- RLS 정책 적용

### A2: Core HR 데이터 모델
- `companies` — 법인 마스터
- `departments` — 부서 (parent_id 계층)
- `positions` — 직위
- `job_levels` — 직급 (L1~L5, 추후 확장)
- `employee_profiles` — 직원 마스터 (status: active/inactive/on_leave/terminated)
- `employee_assignments` — 발령 이력 (Effective Dating: effective_from, effective_to)
- `employee_compensations` — 보상 이력

### A3: 기본 근태/휴가 (STEP 3)
- 출퇴근 기록 테이블 (기본 clock_in/clock_out)
- 휴가 신청/승인 (기본 leave_requests)
- 52시간 모니터링 (기본)

### A4: 온보딩 (STEP 4)
- Day 1/7/30/90 체크인 + 감정 펄스
- (B5에서 고도화 완료)

### A5: 채용 + 성과 (STEP 5)
- 채용 ATS 기본
- 성과평가 MBO 기본

---

## Phase B — B1 완료 (Week 3)

### B1: 법인별 커스터마이징 엔진

**DB 테이블**:
- `company_settings` — 법인별 모듈 설정 JSONB
  ```
  module 종류: 'general', 'attendance', 'leave', 'compensation',
               'performance', 'recruitment', 'onboarding', 'approval'
  ```
- `approval_flows` — 법인별 승인 플로우 (module + steps JSON)
- `exchange_rates` — 환율 (테이블만 생성, B7-2에서 본격 사용)

**핵심 컴포넌트**:
- `CompanySelector` — 법인 전환 드롭다운
- `GlobalOverrideBadge` — "글로벌 기본" vs "커스텀" 표시
- `useCompanySettings(module)` — 법인별 설정 훅

**B1 설정 JSONB 구조 (compensation_settings 예시)**:
```json
{
  "currency": "KRW",
  "pay_components": [
    { "code": "base", "name": "기본급", "isTaxable": true },
    { "code": "meal", "name": "식대", "isTaxable": false, "limit": 200000 }
  ],
  "salary_bands": [
    { "jobLevel": "S1", "min": 2400000, "mid": 3000000, "max": 3600000 }
  ]
}
```

**B1 시드 데이터**:
- 6개 법인별 general/attendance/leave/compensation/performance/recruitment/onboarding/approval 설정
- 승인 플로우: leave(매니저→HR), recruitment(HR→부서장→인사총괄)
- 환율: USD/CNY/RUB/VND/MXN → KRW

**설정 페이지 라우트**: `/settings/{module}` — 법인별 설정 관리 (B2~B11에서 각 모듈별 UI 구현)

---

## Prisma 마이그레이션 병렬 운영 규칙

⚠️ 두 트랙이 동시에 `prisma migrate dev`를 실행하면 DB lock 충돌이 발생할 수 있습니다.

**규칙**:
1. 각 트랙의 마이그레이션 이름에 트랙 접두사 사용:
   - [A] 트랙: `npx prisma migrate dev --name a_b2_core_hr`
   - [B] 트랙: `npx prisma migrate dev --name b_b4_ats`
2. **동시 migrate 금지** — 한 트랙이 migrate 완료 후 다른 트랙 시작
3. migrate 충돌 발생 시: `npx prisma migrate resolve` 또는 수동 병합
4. 양쪽 다 schema.prisma를 수정하므로, **모델 정의 영역을 분리**:
   - 파일 상단에 주석으로 `// === TRACK A: B2 ===` 구간 표시
   - 상대 트랙 구간은 수정하지 않음

---

## Phase B — B2 완료 (Week 4) [A 트랙]

### B2: Core HR 고도화 (직원 프로필 + Effective Dating UI)

**DB**: 신규 테이블 없음 (A2 테이블 위에 UI 구현)
- EmployeeAssignment에 (employeeId, effectiveDate) 복합 인덱스 추가 (해당 시)

**직원 프로필 탭 구조**:
- `/employees/[id]` → 5탭: `profile` / `assignment-history` / `compensation-info`(HR Admin) / `attendance`(→B6) / `performance`(→B3)

**재사용 컴포넌트**:
- `AssignmentTimeline` → B4(후보자 히스토리), B5(온보딩 타임라인)
  - import: `@/components/shared/AssignmentTimeline`
  - props: `events: TimelineEvent[], onEventClick?, loading?, emptyMessage?`
  - TimelineEvent: `{ id, date, type, title, description, details?, highlighted? }`
- `EffectiveDatePicker` → B8-1(조직도 시점조회)
  - import: `@/components/shared/EffectiveDatePicker`
  - props: `value, onChange, allowFuture?, employeeHireDate?, quickSelects?, label?`
  - helper export: `buildDefaultQuickSelects(hireDate)` — 기본 빠른선택 버튼 생성

**API Routes (신규)**:
- `GET /api/v1/employees/[id]/history` — EmployeeAssignment 기반 타임라인
- `GET /api/v1/employees/[id]/snapshot?date=YYYY-MM-DD` — Effective Dating 시점조회
- `GET /api/v1/employees/[id]/compensation` — 현재 급여 + SalaryBand 정보
- `GET /api/v1/employees/export` — 필터 적용 엑셀 다운로드 (HR Admin)
- `POST /api/v1/employees/bulk-upload` — 발령 일괄 등록 (Effective Dating 준수)

**스키마 발견 사항**:
- `Department.code`, `JobGrade.code` 필드 존재 → BulkUpload에서 코드 기반 조회 사용
- `AllowanceRecord`: `isTaxable` 없음, `yearMonth` 필드로 기간 관리
- `CompensationHistory` 관계명: `employee.compensationHistories`
- BulkUpload 템플릿 컬럼: 사번, 부서코드, 직급코드, 발효일 (코드 기반)

**다음 세션 주의사항**:
- B3: `/employees/[id]`의 `performance` 탭(ComingSoon)을 실제 컴포넌트로 교체
- B4: `AssignmentTimeline`을 후보자 히스토리에 재사용 (`@/components/shared/AssignmentTimeline`)
- B5: `AssignmentTimeline`을 온보딩 타임라인에 재사용
- B6: `/employees/[id]`의 `attendance` 탭(ComingSoon)을 실제 컴포넌트로 교체
- B8-1: `EffectiveDatePicker`를 조직도 시점조회에 재사용 (`allowFuture=true`)

---

## Phase B — B3-1 완료 (Week 5) [A 트랙]

### B3-1: Competency Framework + 법인별 리뷰 설정

> 검증: `tsc --noEmit` ✅ 0 errors

**DB Migration — 5개 신규 테이블 + grade 필드**:
- `CompetencyCategory` (competency_categories)
- `Competency` (competencies) — @@unique([categoryId, code])
- `CompetencyLevel` (competency_levels) — @@unique([competencyId, level])
- `CompetencyIndicator` (competency_indicators) — @@unique([competencyId, displayOrder])
- `CompetencyRequirement` (competency_requirements) — @@index([competencyId]), @@index([companyId])
- `PerformanceEvaluation.performanceGrade String?`, `competencyGrade String?` 추가
- 기존 `CompetencyLibrary` 병행 유지 (InterviewEvaluation 참조 보존)
- 마이그레이션 이름: `a_b3_competency_framework`, `a_b3_fix_competency_schema`, `a_b3_indicator_unique`

**시드 데이터**:
- 3개 카테고리: core_value / leadership / technical
- 핵심가치 4개 역량: 도전(4개 지표), 신뢰(3개), 책임(3개), 존중(3개) = 합계 13개 지표
- 리더십 3개: 전략적 사고, 팀 빌딩, 의사결정
- 직무전문 5개: 용접, 품질, 금형, 사출, PLC
- 역량 요건 22개 (핵심가치 16개 × S1~S4 + 리더십 6개 × S3,S4)

**구현 항목**:
- Competency API Routes (GET/POST/PUT/DELETE) — `/api/v1/competencies`, `/api/v1/competencies/[id]`, `/indicators`, `/levels`
- CompetencyListClient.tsx — 카테고리 탭(핵심가치/리더십/직무전문) + 역량 카드 + 사이드패널
- IndicatorEditor.tsx — 행동지표 추가/삭제/↑↓ 순서변경 + bulk save
- CompetencyLevelEditor.tsx — 숙련도 레벨 편집 + bulk save
- Manager Eval API 업데이트: `performanceGrade`, `competencyGrade`, `beiIndicatorScores` 수신
- ManagerEvalClient.tsx — 동적 등급 버튼 + BEI 체크박스

**주의사항 (B8-3 의존성)**:
- `competency_requirements.expectedLevel` 필드: B8-3 스킬 갭 분석의 핵심 — 스키마 변경 금지
- `CompetencyLibrary` 구 테이블 유지 — `InterviewEvaluation.competencyLibraryId` 참조 존재

**생성/수정된 파일**:
```
# DB
prisma/schema.prisma                  — 5개 신규 모델 + PerformanceEvaluation 필드 추가
prisma/migrations/*/a_b3_*           — 3개 마이그레이션
prisma/seed.ts                        — B3-1 역량 라이브러리 시드

# API Routes (신규)
src/app/api/v1/competencies/route.ts
src/app/api/v1/competencies/[id]/route.ts
src/app/api/v1/competencies/[id]/indicators/route.ts
src/app/api/v1/competencies/[id]/levels/route.ts

# API Routes (수정)
src/app/api/v1/performance/evaluations/manager/route.ts

# UI Components (신규/수정)
src/app/(dashboard)/settings/competencies/CompetencyListClient.tsx  — 기존 교체
src/app/(dashboard)/settings/competencies/IndicatorEditor.tsx       — 신규
src/app/(dashboard)/settings/competencies/CompetencyLevelEditor.tsx — 신규
src/app/(dashboard)/performance/manager-eval/ManagerEvalClient.tsx  — 수정
```

---

## Phase B — B3-2 완료 (Week 5) [A 트랙]

### B3-2: AI 평가 초안 + 편향 감지 + 승계 고도화

> 완료일: 2026-03-02 | 검증: `tsc --noEmit` ✅ 0 errors

**DB Migration — 2개 신규 테이블 + 필드 추가**:
- `AiEvaluationDraft` (ai_evaluation_drafts) 신규
- `BiasDetectionLog` (bias_detection_logs) 신규
- `OneOnOne.sentimentTag` 필드 추가
- `SuccessionCandidate.ranking`, `developmentNote` 필드 추가
- `AiFeature` enum: `EVAL_DRAFT_GENERATION` 추가
- Migration: `a_b3_talent_review`, `a_b3_talent_review_fix`

**신규 API**:
- `POST/GET /api/v1/succession/readiness-batch` — 직원 readiness 일괄 조회
- `PUT /api/v1/succession/plans/[id]/candidates` — ranking, developmentNote 지원 추가
- `PUT /api/v1/succession/candidates/[id]` — ranking, developmentNote 지원 추가
- `GET /api/v1/employees/[id]/insights` — 직원 통합 사이드패널 데이터
- `POST/GET /api/v1/performance/evaluations/[id]/ai-draft` — AI 평가 초안 생성/조회
- `POST/GET /api/v1/performance/evaluations/bias-check` — 편향 감지 실행/조회
- `PUT /api/v1/cfr/one-on-ones/[id]` — sentimentTag 지원 추가

**신규 컴포넌트**:
- `src/components/performance/EmployeeInsightPanel.tsx` — 직원 통합 사이드패널
- `src/components/performance/AiDraftModal.tsx` — AI 평가 초안 모달
- `src/components/performance/BiasDetectionBanner.tsx` — 편향 감지 배너

**기존 컴포넌트 수정**:
- `CalibrationClient.tsx` — Readiness 뱃지 오버레이 + EmployeeInsightPanel + BiasDetectionBanner
- `ManagerEvalClient.tsx` — AI 초안 생성 버튼 + AiDraftModal
- `OneOnOneDetailClient.tsx` — sentimentTag 선택 UI
- `CandidateCard.tsx` — ranking Badge + developmentNote + EmployeeInsightPanel
- `navigation.ts` — succession href → /talent/succession

**신규 페이지**:
- `src/app/(dashboard)/talent/succession/page.tsx` — /talent/succession 라우트

**다음 세션 주의사항**:
- B10-1: `OneOnOne.sentimentTag` → 이직 예측 입력 데이터로 활용
- B10-1: `BiasDetectionLog` → HR 애널리틱스 대시보드 표시
- B10-2: AI 평가 초안 사용률 → HR KPI 위젯
- `AiEvaluationDraft.status` 값: draft|reviewed|applied|discarded
- 편향 감지 현재 central_tendency, leniency 2가지 — severity/recency/tenure/gender 확장 예정

---

## Phase B — B4 완료 (Week 4) [B 트랙]

### B4: ATS Enhancement (채용 고도화)

> 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ Compiled successfully

**구현 항목**:
- AI 스크리닝 API (`/api/v1/recruitment/applicants/[id]/ai-screen`) — Claude API 연동, stage → SCREENING 자동 전환
- 면접 일정 관리 (`/api/v1/recruitment/postings/[id]/interviews`) — InterviewSchedule CRUD
- 오퍼 관리 (`/api/v1/recruitment/applications/[id]/offer`) — OfferStatus: DRAFT/SENT/ACCEPTED/DECLINED/EXPIRED
- 내부 공고 (`/api/v1/recruitment/internal-jobs`) — 내부 지원자 → Application 생성
- 채용 요청 결재 (`/api/v1/recruitment/requisitions`) — ApprovalRecord 다중 결재 단계
- 후보자 히스토리 타임라인 (`GET /api/v1/recruitment/applicants/[id]/timeline`)
- 중복 감지 (`/api/v1/recruitment/applicants/check-duplicate`) — 3-tier: email(1.0) > phone(0.9) > name+birthDate(0.7)
- 공석 현황 대시보드 (`GET /api/v1/recruitment/positions/vacancies`)

**생성된 파일**:
```
src/app/api/v1/recruitment/applicants/[id]/ai-screen/route.ts
src/app/api/v1/recruitment/applicants/[id]/timeline/route.ts
src/app/api/v1/recruitment/applicants/check-duplicate/route.ts
src/app/api/v1/recruitment/applications/[id]/offer/route.ts
src/app/api/v1/recruitment/internal-jobs/route.ts
src/app/api/v1/recruitment/internal-jobs/[id]/route.ts
src/app/api/v1/recruitment/internal-jobs/[id]/apply/route.ts
src/app/api/v1/recruitment/postings/[id]/interviews/route.ts
src/app/api/v1/recruitment/positions/vacancies/route.ts
src/app/api/v1/recruitment/requisitions/route.ts
src/app/api/v1/recruitment/requisitions/[id]/route.ts
src/app/api/v1/recruitment/requisitions/[id]/approve/route.ts
src/app/api/v1/recruitment/talent-pool/route.ts
src/app/api/v1/recruitment/talent-pool/[id]/route.ts
src/components/recruitment/CandidateTimeline.tsx
src/components/recruitment/DuplicateWarningModal.tsx
```

**스키마 수정 사항**:
- `Application.createdAt` → `appliedAt` (여러 라우트 일괄 수정)
- `Employee.profilePhotoUrl` → `photoUrl`
- `InterviewSchedule.overallScore` 제거 (해당 필드는 InterviewEvaluation에 있음)

---

## Phase B — B5 완료 (Week 5) [B 트랙]

### B5: 온보딩/오프보딩 고도화

> 검증: `tsc --noEmit` ✅ 0 errors

**DB Migration — 모델 확장 + 크로스보딩 지원**:
- `OnboardingPlan.planType` 필드 추가 enum: `ONBOARDING / OFFBOARDING / CROSSBOARDING_DEPARTURE / CROSSBOARDING_ARRIVAL`
- `OnboardingCheckin.mood` 필드 추가 enum: `GREAT / GOOD / NEUTRAL / STRUGGLING / BAD`
- `ExitInterview` 필드 추가: `detailedReason`, `satisfactionDetail` (JSON), `suggestions`, `isConfidential`
- `CrossboardingRecord` 모델 신규 생성

**구현 항목**:
- Cross-boarding API (`POST /api/v1/onboarding/crossboarding`) + `triggerCrossboarding()` 헬퍼
  - 출발 법인: CROSSBOARDING_DEPARTURE 플랜 시작
  - 도착 법인: CROSSBOARDING_ARRIVAL 플랜 시작 (transferDate 기준)
- 온보딩 대시보드: Plan Type 탭 + SUPER_ADMIN 법인 필터 + 감정 펄스 컬럼
- 오프보딩 대시보드: SUPER_ADMIN 법인 필터 드롭다운
- 퇴직 면담 상세 만족도 폼 (카테고리별 별점 + `isConfidential` 토글)

**생성/수정된 파일**:
```
# 신규 생성
src/app/api/v1/onboarding/crossboarding/route.ts
src/lib/crossboarding.ts

# 수정
prisma/schema.prisma                                          — CrossboardingRecord, 신규 필드
prisma/seed.ts                                                — B5 시드 데이터
src/app/(dashboard)/onboarding/OnboardingDashboardClient.tsx  — Plan Type 탭 + 법인 필터 + 감정 펄스
src/app/(dashboard)/onboarding/page.tsx                       — companies prop 전달
src/app/(dashboard)/offboarding/OffboardingDashboardClient.tsx — 법인 필터 드롭다운
src/app/(dashboard)/offboarding/page.tsx                      — companies prop 전달
src/app/(dashboard)/offboarding/[id]/OffboardingDetailClient.tsx — 상세 퇴직면담 폼
src/app/api/v1/offboarding/dashboard/route.ts                 — WHERE 절 수정
src/app/api/v1/offboarding/[id]/exit-interview/route.ts       — satisfactionDetailSchema 추가
```

---

## Phase B — B6-1 완료 (Week 6) [B 트랙]

### B6-1: 근태 고도화 (교대+유연+52시간)

> 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ Compiled successfully

**DB Migration**:
- `AttendanceSetting` 확장: `alertThresholds`, `enableBlocking`, `timezone` 필드 추가
- `WorkHourAlert` 신규 모델: `employeeId_weekStart_alertLevel` 복합 유니크 키
- Migration: `b_b6_attendance` 적용 완료

**52시간 경고 체계**:
- **주의** (44h+): 노란 배너
- **경고** (48h+): 주황 배너
- **차단** (52h+): 빨간 배너 + KPI 카드 경고색
- HR Admin 대시보드에서 경고 해제 가능 (resolveNote 선택 입력)

**생성된 파일**:
```
src/lib/attendance/workTypeEngine.ts                          — 근무유형별 엔진 (FIXED/FLEXIBLE/SHIFT/REMOTE)
src/lib/attendance/workHourAlert.ts                           — 52시간 경고 체커 + DB upsert
src/app/api/v1/settings/attendance/route.ts                   — GET/PUT 근태 설정 API
src/app/api/v1/attendance/work-hour-alerts/route.ts           — GET 법인 경고 목록
src/app/api/v1/attendance/work-hour-alerts/[id]/route.ts      — PATCH 경고 해제
src/app/api/v1/attendance/employees/[id]/route.ts             — GET 직원별 근태 기록 목록
src/app/(dashboard)/settings/attendance/page.tsx              — 근태 설정 페이지
src/app/(dashboard)/settings/attendance/AttendanceSettingsClient.tsx — 3탭 설정 UI
src/components/employees/tabs/AttendanceTab.tsx               — 직원 프로필 근태 탭
```

**수정된 파일**:
```
src/app/api/v1/attendance/clock-out/route.ts                  — checkWorkHourAlert 연동, weeklyHours/alertLevel/isBlocked 응답 추가
src/app/(dashboard)/attendance/admin/AttendanceAdminClient.tsx — 52시간 위젯 + 경고 해제 기능
src/app/(dashboard)/employees/[id]/EmployeeDetailClient.tsx   — 근태 탭 comingSoon → AttendanceTab 교체
src/lib/api.ts                                                — ApiClient에 patch() 메서드 추가
```

---

## Phase B — B7-1a 완료 (Week 7) [A 트랙]

### B7-1a: 한국법인 급여 계산 엔진

> 완료일: 2026-03-03 | 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ 성공

**DB Migration — 3개 신규 모델**:
- `InsuranceRate` (insurance_rates) — 4대보험 요율 (연도별, @@unique([year, type]))
- `NontaxableLimit` (nontaxable_limits) — 비과세 한도 (연도별, @@unique([year, code]))
- `Payslip` (payslips) — 급여명세서 발급 추적 (@@unique([payrollItemId]))
- Migration: `a_b7_payroll_kr`
- Employee + Company에 `payslips` 관계 추가

**시드 데이터**:
- 2025년 4대보험 5종: national_pension, health_insurance, long_term_care, employment_insurance, industrial_accident
- 2025년 비과세 한도 4종: meal_allowance(20만), vehicle_allowance(20만), childcare(20만), research_allowance(20만)

**계산 엔진 강화** (`src/lib/payroll/kr-tax.ts`):
- `separateTaxableIncome()` — 비과세 한도 적용 후 과세/비과세 분리
- `calculateProrated()` — 중도입사/퇴사 일할계산 (주 5일 기준 평일 수)
- `detectPayrollAnomalies()` — 이상 항목 감지 (전월 >20% 변동, 초과근무 >기본급 50%)
- `getWeekdaysInMonth()`, `getWeekdaysBetween()` — 평일 수 계산 유틸

**calculator.ts 업데이트** (`src/lib/payroll/calculator.ts`):
- 비과세 한도 DB 조회 → `separateTaxableIncome()` 적용
- 중도입사 일할계산: hireDate 기반 `calculateProrated()` 적용
- 4대보험 계산 기준: 과세소득(taxableIncome) 기준으로 변경
- 전월 PayrollItem 참조 → `detectPayrollAnomalies()` 실행
- PayrollItemDetail에 `taxableIncome`, `nontaxableTotal`, `isProrated`, `prorateRatio`, `workDays`, `anomalies` 추가

**구현 항목**:
- Payslip 생성: `PUT /api/v1/payroll/runs/[id]/approve` — REVIEW→APPROVED 시 직원별 Payslip 자동 생성 (트랜잭션, upsert 중복 방지)
- `GET /api/v1/payroll/payslips` — 급여명세서 목록 (?year, ?month, ?employeeId) — HR: 법인 전체 / Employee: 본인만
- `PATCH /api/v1/payroll/payslips/[id]` — 열람 처리 (isViewed, viewedAt 업데이트)
- `GET /api/v1/payroll/me` — PAID → APPROVED|PAID 상태 모두 조회 가능으로 변경

**설계 결정**:
- 기존 `kr-tax.ts`의 하드코딩 요율(NATIONAL_PENSION_RATE 등) 유지 — DB에서 읽어오지 않고 fallback으로 사용
- PayrollItem.detail (JSON)에 B7-1a 필드 포함 — 기존 스키마 필드 추가 없음
- AllowanceRecord.allowanceType === 'MEAL_ALLOWANCE' → code: 'meal_allowance' 매핑
- 일할계산: 주 5일(평일) 기준, 공휴일 미반영 (추후 Holiday 테이블 연동 가능)

**생성/수정된 파일**:
```
# DB
prisma/schema.prisma                          — InsuranceRate, NontaxableLimit, Payslip 모델 추가
prisma/migrations/*/a_b7_payroll_kr/          — 마이그레이션
prisma/seed.ts                                — 2025년 4대보험/비과세 한도 시드

# 핵심 라이브러리 (수정)
src/lib/payroll/kr-tax.ts                     — separateTaxableIncome, calculateProrated, detectPayrollAnomalies 추가
src/lib/payroll/calculator.ts                 — 비과세 분리 + 일할계산 + 이상감지 통합
src/lib/payroll/types.ts                      — PayrollItemDetail에 B7-1a 필드 추가

# API Routes (수정)
src/app/api/v1/payroll/runs/[id]/approve/route.ts  — Payslip 자동 생성 추가
src/app/api/v1/payroll/me/route.ts                 — APPROVED 상태 포함

# API Routes (신규)
src/app/api/v1/payroll/payslips/route.ts           — 급여명세서 목록
src/app/api/v1/payroll/payslips/[id]/route.ts      — 열람 처리
```

**다음 세션 주의사항**:
- B7-1b: payroll_items.detail.taxableIncome → 연말정산 총급여 계산에 활용
- B7-1b: insurance_rates/nontaxable_limits 테이블을 연말정산에서도 참조 가능
- B7-2: 해외 법인은 별도 계산 엔진 (InsuranceRate 테이블에 국가코드 추가 고려)
- PayrollItem.detail의 anomalies 배열 → B10 애널리틱스에서 활용 가능
- Payslip PDF 경로(pdfPath)는 현재 미구현 — B7-1b 또는 별도 세션에서 Supabase Storage 연동 필요

---

## Phase B — B7-1b 완료 (Week 7) [A 트랙]

### B7-1b: 연말정산

> 완료일: 2026-03-03 | 검증: `tsc --noEmit` ✅ 0 errors (new files) | `npm run build` ✅ 성공

**DB Migration — 7개 신규 모델**:
- `YearEndDeductionConfig` (year_end_deduction_configs) — 공제항목 설정 (@@unique([year, code]))
- `IncomeTaxRate` (income_tax_rates) — 과세표준 세율구간 (@@unique([year, minAmount]))
- `YearEndSettlement` (year_end_settlements) — 직원별 연말정산 (@@unique([employeeId, year]))
- `YearEndDependent` (year_end_dependents) — 부양가족
- `YearEndDeduction` (year_end_deductions) — 공제항목 상세
- `YearEndDocument` (year_end_documents) — 제출서류
- `WithholdingReceipt` (withholding_receipts) — 원천징수영수증 (@@unique([settlementId]))
- Migration: `a_b7_year_end_settlement`
- 2025년 시드: 소득공제 6종 + 세액공제 6종 + 과세표준 8구간

**계산 엔진** (`src/lib/payroll/yearEndCalculation.ts`):
- `calculateYearEndSettlement(settlementId, employeeId, year)` — 11단계 연말정산 계산
- `sumAnnualGross(employeeId, year)` — B7-1a payroll_items 집계
- `sumPrepaidTax(employeeId, year)` — 기납부세액 집계
- `calcEarnedIncomeDeduction(totalSalary)` — 근로소득공제 구간별

**공제 계산기** (`src/lib/payroll/deductionCalculator.ts`):
- `calculateDeductibleAmount(code, inputAmount, totalSalary, year)` — DB rules 기반
- `calculateEarnedIncomeCredit(calculatedTax, totalSalary, rules)` — 근로소득세액공제
- `calculateChildCredit(childCount, rules)` — 자녀세액공제

**구현 항목**:
- 직원용 연말정산 UI (`/my/year-end`) — 4단계 위저드: 부양가족 확인 → 공제항목 입력 → 추가공제 → 결과 확인
- HR 관리 UI (`/payroll/year-end`) — 진행현황 카드 + 직원 목록 테이블 + 일괄 확정
- 원천징수영수증 HTML 생성 (`src/lib/payroll/yearEndReceiptPdf.ts`)
- Navigation: `/my/year-end` (badge:new, countryFilter:KR), `/payroll/year-end` (badge:new, countryFilter:KR)

**API Routes (신규)**:
```
src/app/api/v1/year-end/settlements/route.ts             — GET/POST
src/app/api/v1/year-end/settlements/[id]/route.ts        — GET/PUT
src/app/api/v1/year-end/settlements/[id]/submit/         — POST
src/app/api/v1/year-end/settlements/[id]/dependents/     — GET/PUT
src/app/api/v1/year-end/settlements/[id]/deductions/     — GET/PUT
src/app/api/v1/year-end/settlements/[id]/documents/      — POST/DELETE
src/app/api/v1/year-end/settlements/[id]/calculate/      — POST
src/app/api/v1/year-end/hr/settlements/route.ts          — GET
src/app/api/v1/year-end/hr/settlements/[id]/confirm/     — POST
src/app/api/v1/year-end/hr/settlements/[id]/receipt/     — POST
src/app/api/v1/year-end/hr/bulk-confirm/route.ts         — POST
```

**설계 결정**:
- BigInt: 과세표준/세액 계산에 BigInt 사용 (API 응답 시 string 직렬화)
- 공제항목 한도: `year_end_deduction_configs.rules` JSON에서 읽음 (코드 하드코딩 없음)
- 연도별 세율: `income_tax_rates` 테이블 (2026년 추가 시 코드 변경 불필요)
- 홈택스 간소화 PDF: 파싱 미지원, 수동입력 폼 대안 제공
- finalSettlement 양수=추가납부, 음수=환급
- WithholdingReceipt.pdfPath: HTML 기반 (브라우저 인쇄용)

**다음 세션 주의사항**:
- B7-2: 해외법인은 연말정산 없음 (CTR-KR only)
- B10-2: HR KPI에 연말정산 완료율 위젯 추가 가능
- 차감징수 → 급여반영은 B7-1a의 adjustments에 수동 추가 필요

---

## Phase B — B8-1 완료 (Week 8) [B 트랙]

### B8-1: 조직도 시각화 + 조직 개편

> 완료일: 2026-03-03 | 검증: `tsc --noEmit` ✅ 0 new errors | `npm run build` ✅ Compiled successfully

**DB Migration**:
- `OrgRestructurePlan` 모델 신규 추가:
  - 필드: id, companyId, title, description, effectiveDate, status(draft/review/approved/applied), changes(Json), createdBy, approvedBy, approvedAt, appliedAt
  - `Company` 모델에 `orgRestructurePlans OrgRestructurePlan[]` 역참조 추가
- Migration: `b_b8_org_chart` 적용 (`20260302154414_b_b8_org_chart`)

**구현 항목**:
- OrgClient.tsx 3가지 뷰 모드: Tree(기존 React Flow 유지) / List(계층 들여쓰기 테이블) / Grid(카드 뷰)
- EffectiveDatePicker 교체: `input[type=month]` → `EffectiveDatePicker` (Date 타입, `allowFuture=false`)
- 검색: 부서명/코드/영문명 실시간 필터 (Tree: 노드 opacity 0.2 dimming, List/Grid: 배열 필터)
- 스냅샷 모드: `isToday()` 헬퍼로 현재 vs 과거 자동 감지 + "현재" 리셋 버튼
- 조직 개편 버튼: HR_ADMIN / SUPER_ADMIN에게만 노출

**신규 컴포넌트**:
- `RestructureModal.tsx` — 6가지 변경 유형: create/move/merge/rename/close/transfer_employee, 3-step 워크플로 (편집→Diff 미리보기→최종 확인)
  - "초안 저장" → POST plans (status:draft), "즉시 적용" → POST plans (status:approved) → POST apply
- `RestructureDiffView.tsx` — 변경 유형별 DiffRow (색상 구분: 신설=초록/제거=빨강/변경=노랑/이동=파랑), 요약 카드, 영향도 분석, 경고 표시

**API Routes (4개)**:
- `GET /api/v1/org/restructure-plans` — 목록 (페이지네이션, companyId/status 필터)
- `POST /api/v1/org/restructure-plans` — 계획 생성
- `GET/PATCH/DELETE /api/v1/org/restructure-plans/[id]` — 단건 CRUD (appliedAt 보호)
- `POST /api/v1/org/restructure-plans/[id]/apply` — 계획 적용 ($transaction):
  - create: 신규 Department 생성 (level 자동 계산)
  - move: Department.parentId + level 업데이트
  - merge: source 직원 → target 부서로 EmployeeAssignment 이동 (changeType: REORGANIZATION)
  - rename: Department name/nameEn 업데이트
  - close: 직원 → 상위 부서 이동 후 isActive: false
  - transfer_employee: 개인 Assignment 이동 (changeType: TRANSFER)
  - OrgChangeHistory 레코드 생성 후 plan.status = 'applied'

**생성/수정된 파일**:
```
prisma/schema.prisma                                       — OrgRestructurePlan 모델 추가, Company 역참조
src/app/(dashboard)/org/OrgClient.tsx                      — 3 뷰모드 + EffectiveDatePicker + 검색 (전면 재작성)
src/components/org/RestructureModal.tsx                    — 신규
src/components/org/RestructureDiffView.tsx                 — 신규
src/app/api/v1/org/restructure-plans/route.ts              — 신규
src/app/api/v1/org/restructure-plans/[id]/route.ts         — 신규
src/app/api/v1/org/restructure-plans/[id]/apply/route.ts   — 신규
```

**TypeScript 수정 사항**:
- `snapshotDateStr ?? ''` — undefined → string 타입 안전 처리
- `z.record(z.string(), z.unknown())` — JSON 필드 대상 Zod 스키마 (2개 파일)

---

## Phase B — B9-1 완료 (Week 9) [B 트랙]

### B9-1: LMS Lite (법정 의무교육 + 스킬 갭 기반 추천)

> 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ Compiled successfully

**DB Migration — 스키마 확장**:
- `TrainingCourse` 확장: `format`, `linkedCompetencyIds`, `expectedLevelGain`, `provider` 필드 추가
- `MandatoryTrainingConfig` 신규: `targetGroup`, `frequency`, `deadlineMonth`, `isActive`
- `TrainingEnrollment` 확장: `source`(manual/mandatory_auto/system), `score`, `expiresAt` 추가
- `EmployeeSkillAssessment` 신규: `competencyId`, `currentLevel`, `assessedById`, `notes`
- `EnrollmentStatus` enum: `FAILED`, `EXPIRED` 추가
- Migration: `b_b9_lms_lite` 적용

**구현 항목**:
- 법정 의무교육 설정 CRUD (`GET/POST /api/v1/training/mandatory-config`, `PATCH/DELETE /[id]`)
- 연간 자동 등록 트리거 (`POST /api/v1/training/mandatory-config/enroll`) — HR Admin용
  - targetGroup 필터: all / manager(employeeRoles 기반) / new_hire(1년 미만) / production
  - 유효 이수이력 있으면 스킵, source='mandatory_auto' 태깅, deadlineMonth → expiresAt 자동 계산
- 법정 의무교육 이수율 집계 (`GET /api/v1/training/mandatory-status`)
- 스킬 갭 기반 과정 추천 (`GET /api/v1/training/recommendations`)
  - CompetencyRequirement.expectedLevel vs EmployeeSkillAssessment.currentLevel 비교
  - gap > 0인 역량의 linkedCompetencyIds 매핑으로 과정 필터링
- 내 교육 현황 (`GET /api/v1/training/my`) — 미이수+추천+이력+만료임박
- 역량 평가 등록/조회 (`GET/POST /api/v1/training/skill-assessments`)
- `/my/training` 직원 뷰 UI — 만료 임박 배너, KPI 4개, 탭(필수 미이수/직무 필수/추천/이력)
- `/training` HR 관리 UI — "법정 의무교육" 탭 추가 (ShieldCheck 아이콘), 이수율 progress bars

**시드 데이터**:
- 법정 의무교육 3개: LEG-001(산업안전보건), LEG-002(성희롱예방), LEG-003(개인정보보호)
- 직무 필수 5개: JOB-001~005 (리더십, 품질관리, 온보딩, 용접안전, HR담당자)
- 자기개발 4개: DEV-001~004 (데이터분석, 글로벌커뮤니케이션, PLC, 코칭)
- MandatoryTrainingConfig 6개 (LEG-001~003 × all/manager)

**생성된 파일**:
```
# API Routes
src/app/api/v1/training/mandatory-config/route.ts
src/app/api/v1/training/mandatory-config/[id]/route.ts
src/app/api/v1/training/mandatory-config/enroll/route.ts
src/app/api/v1/training/mandatory-status/route.ts
src/app/api/v1/training/recommendations/route.ts
src/app/api/v1/training/my/route.ts
src/app/api/v1/training/skill-assessments/route.ts

# Pages & Components
src/app/(dashboard)/my/training/page.tsx
src/app/(dashboard)/my/training/MyTrainingClient.tsx
src/components/training/MandatoryConfigTab.tsx
```

**수정된 파일**:
```
src/app/(dashboard)/training/TrainingClient.tsx  — 법정 의무교육 탭 추가
prisma/seed.ts                                   — B9-1 교육 데이터 추가
prisma/schema.prisma                             — 스키마 확장
```

**tsc 수정 사항**:
- `mandatory-config/[id]/route.ts`: `RouteContext` 커스텀 타입 → 인라인 `context: { params: Promise<Record<string, string>> }` 패턴으로 교체
- `mandatory-config/enroll/route.ts`: `roles` → `employeeRoles` (Employee 모델 실제 관계명)

---

## Phase B — B6-2 완료 (Week 6) [A 트랙]

### B6-2: 휴가 고도화 (정책엔진 + 통합 승인함)

> 완료일: 2026-03-03 | 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ 성공

**DB Migration — 5개 신규 모델**:
- `LeaveTypeDef` (leave_type_defs) — 법인별 휴가 유형 정의
- `LeaveAccrualRule` (leave_accrual_rules) — 부여 규칙 (JSON 티어 구조)
- `LeaveYearBalance` (leave_year_balances) — 직원 연도별 잔여 집계
- `AttendanceApprovalRequest` (attendance_approval_requests) — 통합 승인 요청
- `AttendanceApprovalStep` (attendance_approval_steps) — 다단계 승인 스텝
- Migration: `a_b6_leave_policy_engine`, `a_b6_varchar_fix` (VarChar 20→30, accrualBasis='hire_date_anniversary' 21자)

**시드 데이터**:
- 6개 법인 LeaveTypeDef: KR(연차·경조사·병가·출산육아), US(Vacation·Sick·PTO), CN(연차·병가·출산) — 총 28개
- KR 연차 accrualRule: hire_date_anniversary + monthly (한국 근로기준법)
- US Vacation accrualRule: calendar_year + annual — 총 4개 LeaveAccrualRule

**Accrual Engine** (`src/lib/leave/accrualEngine.ts`):
- `calculateEntitlement(employeeId, leaveTypeDefId, year)` — 근속 구간별 부여일 계산
- `processAnnualAccrual(companyId, year)` — 법인 전체 일괄 부여
- `getEmployeeLeaveBalance(employeeId, year)` — 잔여 조회 (remaining 계산 포함)
- 한국 근로기준법: 첫 해 월 1일(최대 11일), 1년+ 15일/년, 3년+ 2년마다 +1일(최대 25일)
- calendar_year / hire_date_anniversary 두 accrualBasis 지원

**구현 항목**:
- Leave Settings Admin UI (`/settings/leave`) — 3탭: 휴가 유형 CRUD / 부여 규칙 편집 / 이월·소멸 설정
- 통합 승인 API (`GET/POST /api/v1/approvals/attendance`, `GET/PUT /[id]`) — view=mine|pending-approval|team
- Leave TypeDef CRUD API (`GET/POST /api/v1/leave/type-defs`, `/[id]`, `/[id]/accrual-rules`)
- 통합 승인함 UI (`/approvals/attendance`) — 뷰 토글 + 요청 유형 필터 + 2-패널 레이아웃
- 직원 휴가 현황 UI (`/my/leave`) — 연도 선택 + KPI 4개 + 유형별 progress bar + 이력 테이블

**생성/수정된 파일**:
```
# DB
prisma/schema.prisma                         — 5개 신규 모델 추가
prisma/migrations/*/a_b6_leave_policy_engine/ — 신규 마이그레이션
prisma/migrations/*/a_b6_varchar_fix/         — VarChar 수정

# 라이브러리
src/lib/leave/accrualEngine.ts               — 휴가 부여 엔진

# API
src/app/api/v1/leave/type-defs/route.ts
src/app/api/v1/leave/type-defs/[id]/route.ts
src/app/api/v1/leave/type-defs/[id]/accrual-rules/route.ts
src/app/api/v1/leave/accrual/route.ts
src/app/api/v1/leave/year-balances/route.ts
src/app/api/v1/approvals/attendance/route.ts
src/app/api/v1/approvals/attendance/[id]/route.ts

# UI
src/app/(dashboard)/settings/leave/page.tsx
src/app/(dashboard)/settings/leave/LeaveSettingsClient.tsx
src/app/(dashboard)/approvals/attendance/page.tsx
src/app/(dashboard)/approvals/attendance/AttendanceApprovalClient.tsx
src/app/(dashboard)/my/leave/page.tsx
src/app/(dashboard)/my/leave/MyLeaveClient.tsx
```

**다음 세션 주의사항**:
- `LeaveTypeDef` — 기존 `LeaveType` enum과 별개 (enum은 LeaveRequest.leaveType에서 사용)
- `AttendanceApprovalRequest.requestType` — leave/overtime/attendance_correction/shift_change
- `LeaveYearBalance.remaining` = entitled + carriedOver + adjusted - used - pending (DB 컬럼 아님, 계산값)
- `ACTION.VIEW` = 'read', `ACTION.APPROVE` = 'manage' (ACTION.READ/MANAGE 존재하지 않음)
- Zod v3: `z.record()` 는 `z.record(keySchema, valueSchema)` 2개 인자 필요
- Prisma JSON 필드: `(data.details ?? {}) as object` 캐스트로 타입 오류 회피
- `{ prisma }` named export (default export 아님)

---

## Phase B — B8-2 완료 (Week 8) [B 트랙]

### B8-2: People Directory + Self-Service

> 완료일: 2026-03-03 | 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ Compiled successfully

**DB Migration**:
- `ProfileVisibility` 모델: 개인정보 공개 범위 설정 (4-level: public/team/manager/private)
  - 필드: personalPhone, personalEmail, birthDate, address, emergencyContact, bio, skills
- `EmployeeProfileExtension` 확장: `avatarPath` 필드 추가
- `ProfileChangeRequest` 확장: `reason`(변경 사유), `documentPath`(증빙 서류 경로) 필드 추가
- Migration: `b_b8_2_people_dir_self_service`

**구현 항목**:
- People Directory (`/directory`) — 카드뷰/테이블뷰 토글, 필터, 키워드 검색, ProfileVisibility 기반 컬럼 마스킹
- Self-Service (`/my/profile`) — 4탭: 기본정보 / 연락처(변경요청) / 비상연락처 / 공개설정
- Avatar Upload — `POST /api/v1/employees/me/avatar` — S3 Presigned URL 생성 (avatars/{employeeId}/{ts}.{ext})
- Profile Change Request: ALLOWED_FIELDS = phone, emergencyContact, emergencyContactPhone, name
- My Space Dashboard (`/my`) — 프로필 요약, KPI 4개, 바로가기 6개, 휴가 잔여 현황
- Navigation: my-space-home(`/my`), people-directory(`/directory`) 추가, my-profile href 변경 `/employees/me` → `/my/profile`

**API Routes (신규)**:
```
src/app/api/v1/directory/route.ts                              — GET (검색/필터/페이지네이션)
src/app/api/v1/employees/me/profile-extension/route.ts        — GET/PUT
src/app/api/v1/employees/me/emergency-contacts/route.ts       — GET/POST
src/app/api/v1/employees/me/emergency-contacts/[id]/route.ts  — DELETE
src/app/api/v1/employees/me/visibility/route.ts               — GET/PUT
src/app/api/v1/employees/me/avatar/route.ts                   — POST (S3 Presigned URL)
```

**신규 파일**:
```
src/hooks/useDebounce.ts
src/app/(dashboard)/directory/page.tsx + DirectoryClient.tsx
src/app/(dashboard)/my/page.tsx + MySpaceClient.tsx
src/app/(dashboard)/my/profile/page.tsx + MyProfileClient.tsx
```

**TypeScript 수정 사항**:
- `z.unknown()` → `z.any()` (Prisma InputJsonValue 호환)
- SessionUser 타입 캐스트, ecForm 캐스트 수정
- LeaveBalance 인터페이스 → grantedDays/usedDays/policy 구조로 업데이트

**EmployeeLeaveBalance 접근 패턴 (확정)**:
```ts
prisma.employeeLeaveBalance.findMany({
  where: { employeeId },
  include: { policy: { select: { name: true, leaveType: true } } },
})
// lb.grantedDays, lb.usedDays (Decimal), lb.policy.name, lb.policy.leaveType
const remaining = Number(lb.grantedDays) - Number(lb.usedDays)
```

---

## Phase B — B8-3 완료 (Week 8) [B 트랙]

### B8-3: 스킬 매트릭스 + 갭 분석

> 완료일: 2026-03-03 | 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ Compiled successfully

**DB Migration**:
- `EmployeeSkillAssessment` 확장 (B9-1에서 추가된 모델):
  - 신규 필드: `selfLevel`, `managerLevel`, `finalLevel`, `expectedLevel` (Int?), `managerComment`
  - 기존 `currentLevel` 유지, `assessmentPeriod` 유니크 키 추가
- `SkillGapReport` 신규 모델:
  - 필드: id, companyId, departmentId?, assessmentPeriod, reportData(Json), generatedBy, createdAt
- `CompetencyRequirement` 신규 모델:
  - 필드: id, competencyId, companyId?, jobLevelCode, expectedLevel, createdAt
  - 복합 유니크: `competencyId_companyId_jobLevelCode`
- Migration: `b_b8_3_skill_matrix`

**API Routes (5개)**:
- `GET /api/v1/skills/self-assessment` — 내 역량 자기평가 현황 (expectedLevel 포함)
- `POST /api/v1/skills/self-assessment` — 자기평가 upsert (bulk)
- `GET /api/v1/skills/team-assessments` — 팀원 목록 + 역량 현황 (매니저용)
- `POST /api/v1/skills/team-assessments` — 매니저 역량 평가 (단건 + 일괄)
- `GET /api/v1/skills/matrix` — 스킬 매트릭스 히트맵 데이터 (부서/법인)
- `GET /api/v1/skills/radar` — 개인 역량 레이더 차트 데이터
- `GET /api/v1/skills/gap-report` — 법인/부서별 스킬 갭 집계
- `POST /api/v1/skills/gap-report` — 갭 리포트 스냅샷 저장

**구현 항목**:
- `/my/skills` 자기평가 UI — 카테고리 그룹핑 + 1~5 레벨 선택 + 기대 레벨 표시 + GAP 뱃지 (미달/부족/충족/초과)
- `/team/skills` 매니저 평가 UI — 팀원 탭 네비게이션 (저장 완료 체크마크) + 자기평가 참고 표시 + 이전/다음 네비게이션
- `/organization/skill-matrix` 히트맵 — 3탭: 개인 매트릭스 | 부서 히트맵 | 갭 리포트
  - 히트맵: 역량×직원 그리드, 상태별 색상 (critical/below/meets/exceeds/expert/unassessed)
  - 레이더 차트 모달: Recharts RadarChart (클릭 시 개인 역량 레이더 표시)
  - 부서 히트맵: 부서×역량 평균 갭
  - 갭 리포트: Top5 갭/강점, 역량별 평가율, 부서별 히트맵

**시드 데이터**:
- CompetencyRequirement: G3~G6 직급별 기대레벨 (핵심가치 + 기술역량 5종)
- CTR-KR MFG 직원 6명 (김현식/이태준/박재홍/최민준/정수현/홍기영)
- EmployeeSkillAssessment 54건 (period: 2026-H1)
- 시나리오: PLC 프로그래밍 큰 갭, 도전 가치 강점

**신규 파일**:
```
# API Routes
src/app/api/v1/skills/self-assessment/route.ts
src/app/api/v1/skills/team-assessments/route.ts
src/app/api/v1/skills/matrix/route.ts
src/app/api/v1/skills/radar/route.ts
src/app/api/v1/skills/gap-report/route.ts

# Pages & Clients
src/app/(dashboard)/my/skills/page.tsx
src/app/(dashboard)/my/skills/MySkillsClient.tsx
src/app/(dashboard)/team/skills/page.tsx
src/app/(dashboard)/team/skills/TeamSkillsClient.tsx
src/app/(dashboard)/organization/skill-matrix/page.tsx
src/app/(dashboard)/organization/skill-matrix/SkillMatrixClient.tsx
```

**수정된 파일**:
```
prisma/schema.prisma                  — CompetencyRequirement, SkillGapReport 추가, EmployeeSkillAssessment 확장
prisma/seed.ts                        — B8-3 시드 데이터 추가 (CompetencyRequirements + 6 MFG employees + 54 assessments)
src/config/navigation.ts              — /my/skills, /team/skills, /organization/skill-matrix 메뉴 추가
src/app/api/v1/training/skill-assessments/route.ts  — currentLevel null 안전 처리 (a.currentLevel ?? 0)
```

**TypeScript 수정 사항**:
- `SkillMatrixClient.tsx`, `TeamSkillsClient.tsx`: `apiClient.get<T>().then(setData)` → `.then(res => setData(res.data))`
- `matrix/route.ts`, `radar/route.ts`, `team-assessments/route.ts`: `Employee.avatarPath` 제거 (Prisma 타입 미존재)
- `team-assessments/route.ts`: 중복 `id` 프로퍼티 → `AND: [...]` 배열로 통합

---

## Phase B — B7-2 완료 (Week 7) [A 트랙]

### B7-2: 해외 급여 통합 + 글로벌 분析

> 완료일: 2026-03-03 | 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ 성공

**DB Migration — 5개 신규 모델**:
- `ExchangeRate` — 법인통화 → KRW 환율 (year, month, fromCurrency, toCurrency 복합 유니크)
- `PayrollImportMapping` — 파일 헤더 매핑 설정 (법인별, JSON mappings 필드)
- `PayrollImportLog` — 업로드 이력 (파일명, 행수, 성공/실패 카운트)
- `PayrollSimulation` — 시뮬레이션 결과 저장 (type: transfer|raise|promotion)
- `PayrollAnomaly` — 이상 탐지 결과 (severity: low|medium|high|critical)

**이상 탐지 4가지 규칙**:
1. **급여 급등** — 전월 대비 50% 초과 증가
2. **마이너스 급여** — netPay < 0
3. **평균 이탈** — 법인 평균 ±3σ (표준편차 3배 초과)
4. **중복 처리** — 같은 yearMonth, 같은 직원 2건 이상

**구현 항목**:
- 환율 관리 UI + API (`/settings/exchange-rates`) — GET(조회) + PUT(일괄저장)
- 해외 급여 업로드 + 매핑 설정 (`/payroll/import`) — GET + POST + PATCH/DELETE
- 글로벌 급여 대시보드 (`/payroll/global`) — GET(글로벌 집계)
- 급여 시뮬레이션 (`/payroll/simulation`) — 전출/인상/승진 시나리오 (GET이력 + POST실행)
- 이상 탐지 (`/payroll/anomalies`) — GET목록 + POST탐지 실행 + PATCH상태변경
- 시드 데이터: `prisma/seeds/foreign-payroll.ts` — 5법인 × 30명 급여 시드 (환율 포함)

**생성된 파일**:
```
# API Routes
src/app/api/v1/payroll/exchange-rates/route.ts
src/app/api/v1/payroll/import-mappings/route.ts
src/app/api/v1/payroll/import-logs/route.ts
src/app/api/v1/payroll/global/route.ts
src/app/api/v1/payroll/simulation/route.ts
src/app/api/v1/payroll/anomalies/route.ts

# Pages & Clients
src/app/(dashboard)/settings/exchange-rates/page.tsx
src/app/(dashboard)/settings/exchange-rates/ExchangeRateClient.tsx
src/app/(dashboard)/payroll/import/page.tsx
src/app/(dashboard)/payroll/import/PayrollImportClient.tsx
src/app/(dashboard)/payroll/global/page.tsx
src/app/(dashboard)/payroll/global/GlobalPayrollClient.tsx
src/app/(dashboard)/payroll/simulation/page.tsx
src/app/(dashboard)/payroll/simulation/PayrollSimulationClient.tsx
src/app/(dashboard)/payroll/anomalies/page.tsx
src/app/(dashboard)/payroll/anomalies/PayrollAnomaliesClient.tsx

# Seed
prisma/seeds/foreign-payroll.ts
```

**TypeScript 수정 패턴** (B7-2에서 확립):
| 패턴 | 잘못된 코드 | 올바른 코드 |
|------|-----------|-----------|
| apiClient 반환 타입 | `setResult(res)` | `setResult(res.data)` |
| ACTION 상수 | `ACTION.READ` | `ACTION.VIEW` |
| apiError 인자 수 | `apiError(message, 400)` | `apiError(badRequest(message))` |
| Prisma 관계명 | `payrollRun: { companyId }` | `run: { companyId }` |
| PayrollItem 필드 | `basePay` | `baseSalary` |
| Employee 필드 | `nameKo`, `employeeNumber` | `name`, `employeeNo` |
| aggregate _avg | `_avg.grossPay` | `_avg?.grossPay ?? 0` |

**다음 세션 연동 포인트**:
- B10 HR 애널리틱스: ExchangeRate + PayrollRun 데이터로 글로벌 인건비 KPI
- B11 알림: PayrollAnomaly 생성 시 HR_ADMIN 알림
- 해외법인 급여 실제 연동 시: PayrollImportLog → PayrollRun 자동 생성 파이프라인

---

## Phase B — B9-2 완료 (Week 9) [A 트랙]

### B9-2: 복리후생 신청·승인

> 완료일: 2026-03-03 | 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ 성공

**DB Migration — 3개 신규 모델**:
- `BenefitPlan` (benefit_plans) — 법인별 복리후생 항목
- `BenefitClaim` (benefit_claims) — 직원 신청 + 승인 워크플로
- `BenefitBudget` (benefit_budgets) — 법인/카테고리별 연간 예산
- Migration: `a_benefit_claims`

**시드 데이터**:
- CTR-KR: 10개 (family 5, education 2, health 2, lifestyle 1)
- CTR-US: 5개 (financial 2, health 2, lifestyle 1)
- 나머지 법인(CN/RU/VN/MX): 기본 2개씩 (health + family) = 8개
- 합계: 23개 benefit_plans
- 예산 2025: KR 4카테고리(₩50M), US 3카테고리($90K) = 7개 benefit_budgets

**구현 항목**:
- 직원용 UI (`/my/benefits`) — 사용현황 프로그레스 + 신청 모달 + 이력 리스트
- HR 관리 UI (`/benefits`) — 승인대기/전체내역/예산관리 3탭 (기존 교체)
- Navigation: 나의 공간 > 복리후생 → `/my/benefits`

**API Routes (신규)**:
```
src/app/api/v1/benefit-plans/route.ts               — GET (법인별 활성 플랜 목록)
src/app/api/v1/benefit-claims/route.ts              — GET/POST (view=mine|pending|all)
src/app/api/v1/benefit-claims/[id]/route.ts         — GET/PATCH (승인/반려/취소)
src/app/api/v1/benefit-claims/summary/route.ts      — GET (직원 연간 사용 현황 집계)
src/app/api/v1/benefit-budgets/route.ts             — GET/PUT (예산 조회/수정)
```

**핵심 비즈니스 로직**:
- 승인 시 `BenefitBudget.usedAmount` 자동 증가 (트랜잭션)
- 연간 한도 초과 신청 차단 (annual frequency 항목)
- 증빙 필수 항목 검증 (서버사이드)
- 예산 80% 초과 시 경고 배지 표시

**설계 결정**:
- 복리후생 지급은 급여와 완전 분리 (별도 지급)
- 파일 업로드: 경로 메타데이터만 저장 (S3 실제 업로드 추후 연동)
- 승인 플로우: 단순 1-step HR 직접 승인 (AttendanceApprovalRequest 패턴 미사용)

**다음 세션 연동 포인트**:
- B10-1 애널리틱스: `BenefitClaim` 집계 → 복리후생 활용률
- B10-2 HR KPI: 복리후생 활용률 위젯
- B11 알림: 승인/반려 알림, 예산 80% 소진 알림, 연간 미사용 안내

---

## 공유 패턴/컴포넌트 레지스트리

다른 트랙에서 만든 컴포넌트를 참조할 때 이 목록을 확인하세요.

| 컴포넌트/함수 | 생성 세션 | 경로 | 용도 |
|-------------|----------|------|------|
| CompanySelector | B1 | `components/company/` | 법인 전환 드롭다운 |
| GlobalOverrideBadge | B1 | `components/company/` | 글로벌/커스텀 뱃지 |
| useCompanySettings | B1 | `hooks/` | 법인별 설정 조회 |
| AssignmentTimeline | B2 [A] | `@/components/shared/AssignmentTimeline` | 직원 발령 타임라인 — B4(후보자 히스토리), B5(온보딩 타임라인) 재사용 가능 |
| EffectiveDatePicker | B2 [A] | `@/components/shared/EffectiveDatePicker` | 시점 조회 날짜 선택 — B8-1(조직도) `allowFuture=true` |
| CandidateTimeline | B4 [B] | `@/components/recruitment/CandidateTimeline` | 후보자 히스토리 타임라인 |
| DuplicateWarningModal | B4 [B] | `@/components/recruitment/DuplicateWarningModal` | 중복 지원자 경고 모달 |
| triggerCrossboarding | B5 [B] | `@/lib/crossboarding` | 크로스보딩 트리거 헬퍼 함수 |
| AttendanceTab | B6-1 [B] | `@/components/employees/tabs/AttendanceTab` | 직원 프로필 근태 탭 |
| workTypeEngine | B6-1 [B] | `@/lib/attendance/workTypeEngine` | 근무유형별 엔진 (FIXED/FLEXIBLE/SHIFT/REMOTE) |
| workHourAlert | B6-1 [B] | `@/lib/attendance/workHourAlert` | 52시간 경고 체커 + DB upsert |
| EmployeeInsightPanel | B3-2 [A] | `@/components/performance/EmployeeInsightPanel` | 직원 통합 사이드패널 (성과+승계+1:1) |
| AiDraftModal | B3-2 [A] | `@/components/performance/AiDraftModal` | AI 평가 초안 모달 |
| BiasDetectionBanner | B3-2 [A] | `@/components/performance/BiasDetectionBanner` | 편향 감지 배너 |
| 통합 승인함 | B6-2 [A] | `/approvals/attendance/AttendanceApprovalClient` | AttendanceApprovalRequest 2-패널 UI |
| LeaveSettingsClient | B6-2 [A] | `/settings/leave/LeaveSettingsClient` | 3탭: 휴가 유형/부여 규칙/이월 소멸 |
| MyLeaveClient | B6-2 [A] | `/my/leave/MyLeaveClient` | 직원 휴가 현황 (연도별 KPI + progress bar) |
| accrualEngine | B6-2 [A] | `@/lib/leave/accrualEngine` | 법인별 휴가 부여 엔진 (한국 근로기준법 포함) |
| MandatoryConfigTab | B9-1 [B] | `@/components/training/MandatoryConfigTab` | 법정 의무교육 설정 CRUD + 이수율 progress bars |
| MyTrainingClient | B9-1 [B] | `@/app/(dashboard)/my/training/MyTrainingClient` | 직원 교육 현황 뷰 (미이수+추천+이력+만료임박) |
| RestructureModal | B8-1 [B] | `@/components/org/RestructureModal` | 조직 개편 3-step 워크플로 (6가지 변경 유형) |
| RestructureDiffView | B8-1 [B] | `@/components/org/RestructureDiffView` | 조직 개편 Diff 미리보기 + 영향도 분석 |
| separateTaxableIncome | B7-1a [A] | `@/lib/payroll/kr-tax` | 비과세 한도 적용 후 과세/비과세 분리 |
| calculateProrated | B7-1a [A] | `@/lib/payroll/kr-tax` | 중도입사 일할계산 (주 5일 기준 평일 수) |
| detectPayrollAnomalies | B7-1a [A] | `@/lib/payroll/kr-tax` | 전월 대비 이상 항목 감지 |
| calculateYearEndSettlement | B7-1b [A] | `@/lib/payroll/yearEndCalculation` | 11단계 연말정산 계산 엔진 |
| calculateDeductibleAmount | B7-1b [A] | `@/lib/payroll/deductionCalculator` | DB rules 기반 공제항목 한도 적용 |
| YearEndWizardClient | B7-1b [A] | `@/app/(dashboard)/my/year-end/YearEndWizardClient` | 직원용 4단계 연말정산 위저드 |
| YearEndHRClient | B7-1b [A] | `@/app/(dashboard)/payroll/year-end/YearEndHRClient` | HR 연말정산 관리 대시보드 |
| useDebounce | B8-2 [B] | `@/hooks/useDebounce` | 디바운스 훅 |
| DirectoryClient | B8-2 [B] | `@/app/(dashboard)/directory/DirectoryClient` | People Directory (카드뷰/테이블뷰, ProfileVisibility 마스킹) |
| MySpaceClient | B8-2 [B] | `@/app/(dashboard)/my/MySpaceClient` | My Space 대시보드 (프로필 요약, KPI, 바로가기) |
| MyProfileClient | B8-2 [B] | `@/app/(dashboard)/my/profile/MyProfileClient` | Self-Service 프로필 편집 4탭 |
| MySkillsClient | B8-3 [B] | `@/app/(dashboard)/my/skills/MySkillsClient` | 자기평가 폼 (카테고리 그룹핑 + 레벨 선택 + GAP 뱃지) |
| TeamSkillsClient | B8-3 [B] | `@/app/(dashboard)/team/skills/TeamSkillsClient` | 팀원별 역량 평가 (탭 네비게이션 + 자기평가 참고) |
| SkillMatrixClient | B8-3 [B] | `@/app/(dashboard)/organization/skill-matrix/SkillMatrixClient` | 스킬 매트릭스 히트맵 + 레이더 차트 + 갭 리포트 |
| ExchangeRateClient | B7-2 [A] | `@/app/(dashboard)/settings/exchange-rates/ExchangeRateClient` | 환율 관리 UI (법인통화→KRW 일괄 저장) |
| GlobalPayrollClient | B7-2 [A] | `@/app/(dashboard)/payroll/global/GlobalPayrollClient` | 글로벌 급여 대시보드 (법인별 집계) |
| PayrollSimulationClient | B7-2 [A] | `@/app/(dashboard)/payroll/simulation/PayrollSimulationClient` | 급여 시뮬레이션 (전출/인상/승진) |
| PayrollAnomaliesClient | B7-2 [A] | `@/app/(dashboard)/payroll/anomalies/PayrollAnomaliesClient` | 급여 이상 탐지 대시보드 |
| MyBenefitsClient | B9-2 [A] | `@/app/(dashboard)/my/benefits/MyBenefitsClient` | 직원 복리후생 현황 + 신청 모달 |
| BenefitsHRClient | B9-2 [A] | `@/app/(dashboard)/benefits/BenefitsHRClient` | HR 복리후생 관리 (승인대기/전체내역/예산) |

**AssignmentTimeline props**:
```ts
events: TimelineEvent[], onEventClick?, loading?, emptyMessage?
// TimelineEvent: { id, date, type, title, description, details?, highlighted? }
```

**EffectiveDatePicker props**:
```ts
value, onChange, allowFuture?, employeeHireDate?, quickSelects?, label?
// helper: buildDefaultQuickSelects(hireDate) — 기본 빠른선택 버튼 생성
```

> 각 주차 머지 시 이 테이블을 업데이트하세요.

---

## 확립된 공통 패턴

### apiSuccess vs apiPaginated (B3-1에서 확립)
```ts
// ✅ 올바름 — 비배열 객체 응답
return apiSuccess({ members, evalSettings, beiIndicators })

// ❌ 잘못됨 — 배열이 아닌 객체에 apiPaginated 사용
return apiPaginated({ members, ... } as unknown as never[], ...)
```

### apiClient.get vs getList (B3-1에서 확립)
```ts
// ✅ 비배열 응답: apiClient.get
const res = await apiClient.get<EvalPayload>(url, params)
setTeamMembers(res.data.members ?? [])

// ✅ 배열 응답: apiClient.getList
const res = await apiClient.getList<T>(url, params)
setItems(res.data)
```

### Bulk Replace 트랜잭션 패턴 (B3-1에서 확립)
```ts
// 지표/레벨 bulk update — TOCTOU 방지 위해 findMany도 트랜잭션 내에서
const updated = await prisma.$transaction(async (tx) => {
  await tx.competencyIndicator.deleteMany({ where: { competencyId } })
  if (items.length > 0) {
    await tx.competencyIndicator.createMany({ data: items })
  }
  return tx.competencyIndicator.findMany({ where: { competencyId }, orderBy: { displayOrder: 'asc' } })
})
```

### useEffect로 stale state 방지 (B3-1에서 확립)
```ts
// prop 변경 시 내부 state 동기화
useEffect(() => {
  setIndicators(initialIndicators.map(...))
}, [initialIndicators])
```

### Seed upsert 패턴 — compound unique key (B3-1에서 확립)
```ts
// @@unique([competencyId, displayOrder]) 사용 시
await prisma.competencyIndicator.upsert({
  where: { competencyId_displayOrder: { competencyId, displayOrder: i } },
  update: { indicatorText, isActive: true },
  create: { competencyId, indicatorText, displayOrder: i, isActive: true },
})
```

### @db.Uuid 사용 금지 (프로젝트 컨벤션)
```prisma
// ❌ 잘못됨
id String @id @default(uuid()) @db.Uuid

// ✅ 올바름 (기존 모델 전체 패턴)
id String @id @default(uuid())
```

### AppError 패턴 (B4에서 확립)
```ts
// ❌ 잘못됨
return badRequest('message')
return handlePrismaError(err)

// ✅ 올바름
throw badRequest('message')
throw handlePrismaError(err)
```

### Application 날짜 필드
```ts
// Application 모델은 createdAt 없음 → appliedAt 사용
orderBy: { appliedAt: 'desc' }
app.appliedAt.getTime()
```

### apiClient 응답 처리
```ts
// apiClient.get<T>() returns ApiResponse<T>, not T
apiClient.get<T>(url).then(res => setData(res.data ?? null))
```

### buildPagination 인자 순서
```ts
buildPagination(page, limit, total)  // ✅ 올바른 순서
```

### Zod `.issues` vs `.errors` (B5에서 확립)
```ts
// ✅ Zod v3+ 표준
parsed.error.issues.map((e) => e.message)

// ❌ 구버전 (TS 오류 발생)
parsed.error.errors.map((e) => e.message)
```

### Server Component → Client Component companies prop 패턴 (B5에서 확립)
```ts
// page.tsx (Server)
const companies = user.role === ROLE.SUPER_ADMIN
  ? await prisma.company.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } })
  : []
return <XxxDashboardClient user={user} companies={companies} />

// Client Component
const isSuperAdmin = user.role === 'SUPER_ADMIN'
{isSuperAdmin && companies.length > 0 && (
  <Select ...> {/* 법인 필터 드롭다운 */} </Select>
)}
```

### WHERE 절 — companyId 조건부 spread 패턴 (B5에서 확립)
```ts
const where: Prisma.XxxWhereInput = {
  ...(status ? { status } : { status: { in: ['IN_PROGRESS', 'COMPLETED'] } }),
  ...(companyId
    ? { employee: { assignments: { some: { companyId, isPrimary: true, endDate: null } } } }
    : {}),
}
```

### LeaveTypeDef vs LeaveType enum 구분 (B6-2에서 확립)
```ts
// LeaveTypeDef — 법인별 커스텀 휴가 유형 (DB 테이블, B6-2 신규)
// LeaveType enum — LeaveRequest.leaveType에서 사용하는 기존 enum
// 두 개는 별개 — 혼용하지 않음
```

### LeaveYearBalance.remaining 계산 (B6-2에서 확립)
```ts
// remaining은 DB 컬럼이 아닌 계산값
remaining = entitled + carriedOver + adjusted - used - pending
```

### ACTION 상수 매핑 (B6-2에서 확립)
```ts
// ACTION.READ/MANAGE 존재하지 않음
ACTION.VIEW   === 'read'    // ✅ 올바름
ACTION.APPROVE === 'manage' // ✅ 올바름
```

### Zod z.record() 2개 인자 (B6-2에서 확립)
```ts
// Zod v3: z.record()는 반드시 keySchema, valueSchema 2개 인자 필요
z.record(z.string(), z.number())  // ✅ 올바름
z.record(z.number())              // ❌ Zod v3에서 오류
```

### Prisma JSON 필드 타입 캐스트 (B6-2에서 확립)
```ts
// JSON 필드 타입 오류 회피
(data.details ?? {}) as object   // ✅ 올바름
```

### Prisma named export 패턴
```ts
// prisma는 default export가 아닌 named export
import { prisma } from '@/lib/prisma'  // ✅ 올바름
import prisma from '@/lib/prisma'      // ❌ 잘못됨
```

### EmployeeLeaveBalance 접근 패턴 (B8-2에서 확정)
```ts
prisma.employeeLeaveBalance.findMany({
  where: { employeeId },
  include: { policy: { select: { name: true, leaveType: true } } },
})
// lb.grantedDays, lb.usedDays (Decimal), lb.policy.name, lb.policy.leaveType
const remaining = Number(lb.grantedDays) - Number(lb.usedDays)
```

### BigInt 직렬화 (B7-1b에서 확립)
```ts
// 과세표준/세액 계산에 BigInt 사용 — API 응답 시 string으로 직렬화 필요
JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
```

### 스킬 갭 계산 (B8-3에서 확립)
```ts
gap = expectedLevel - finalLevel
// gap > 0: 미달 (needs improvement)
// gap < 0: 강점 (exceeds expectation)
// gap === 0: 충족 (meets expectation)
```

### CompetencyRequirement key 패턴 (B8-3에서 확립)
```ts
// reqMap key: `${competencyId}_${jobLevelCode}`
// jobLevelCode는 EmployeeAssignment.jobGrade.code 사용 (G3~G6)
const reqMap = new Map(requirements.map((r) => [`${r.competencyId}_${r.jobLevelCode ?? ''}`, r.expectedLevel]))
const expectedLevel = reqMap.get(`${c.id}_${grade}`) ?? null
```

### Prisma 관계명 + Employee 필드명 주의 (B7-2에서 확립)
```ts
// PayrollItem → PayrollRun 관계명은 'run' (not 'payrollRun')
prisma.payrollItem.findMany({ where: { run: { companyId } } })  // ✅

// Employee 필드명
employee.name       // ✅ (nameKo ❌)
employee.employeeNo // ✅ (employeeNumber ❌)

// PayrollItem 필드명
item.baseSalary     // ✅ (basePay ❌)
```

### BenefitBudget usedAmount 트랜잭션 패턴 (B9-2에서 확립)
```ts
// 복리후생 승인 시 예산 자동 증가 — 반드시 트랜잭션 내에서
await prisma.$transaction(async (tx) => {
  await tx.benefitClaim.update({ where: { id }, data: { status: 'APPROVED' } })
  await tx.benefitBudget.updateMany({
    where: { companyId, category, year },
    data: { usedAmount: { increment: claim.requestAmount } },
  })
})
```

### Prisma 마이그레이션 트랙 접두사
```bash
# [A] 트랙
npx prisma migrate dev --name a_b2_core_hr

# [B] 트랙
npx prisma migrate dev --name b_b4_ats
```

---

## 법인별 핵심 차이 요약 (전 모듈 공통 참조)

| 항목 | KR | US | CN | RU | VN | MX |
|------|----|----|----|----|----|----|
| 통화 | KRW | USD | CNY | RUB | VND | MXN |
| 주당 법정상한 | 52h | 40h (FLSA) | 44h+36h/월OT | 40h | 48h | 48h |
| 연차 기본 | 근속기반 15~25일 | PTO 20일 | 근속 5~15일 | 28일(캘린더) | 12일+근속 | 12일+근속 |
| 4대보험 | 국민연금/건강/고용/산재 | Social Security/Medicare | 5险1금 | 연금/의료/사회 | 사회보험 | IMSS |
| 성과주기 | 반기 | 연간 | 반기 | 연간 | 반기 | 연간 |
| 언어 | 한국어 | 영어 | 중국어 | 러시아어 | 베트남어 | 스페인어 |
| 타임존 | Asia/Seoul | America/Chicago | Asia/Shanghai | Europe/Moscow | Asia/Ho_Chi_Minh | America/Mexico_City |
