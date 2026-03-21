# Track A — B3-1: Competency Framework + 법인별 리뷰 설정 완료 보고

> 완료일: 2026-03-02
> 세션 수: 2 sessions (컨텍스트 초과로 분할)
> 검증: `tsc --noEmit` ✅ 0 errors

---

## B3-1 구현 완료 항목

### Task 1: DB Migration — 5개 신규 테이블 + grade 필드
- `CompetencyCategory` (competency_categories)
- `Competency` (competencies) — @@unique([categoryId, code])
- `CompetencyLevel` (competency_levels) — @@unique([competencyId, level])
- `CompetencyIndicator` (competency_indicators) — @@unique([competencyId, displayOrder])
- `CompetencyRequirement` (competency_requirements) — @@index([competencyId]), @@index([companyId])
- `PerformanceEvaluation.performanceGrade String?`, `competencyGrade String?` 추가
- 기존 `CompetencyLibrary` 병행 유지 (InterviewEvaluation 참조 보존)
- 마이그레이션 이름: `a_b3_competency_framework`, `a_b3_fix_competency_schema`, `a_b3_indicator_unique`

### Task 2: 시드 데이터
- 3개 카테고리: core_value / leadership / technical
- 핵심가치 4개 역량: 도전(4개 지표), 신뢰(3개), 책임(3개), 존중(3개) = 합계 13개 지표
- 리더십 3개: 전략적 사고, 팀 빌딩, 의사결정
- 직무전문 5개: 용접, 품질, 금형, 사출, PLC
- 숙련도 레벨 공통 5단계 (기초~전문가)
- 역량 요건 22개 (핵심가치 16개 × S1~S4 + 리더십 6개 × S3,S4)
- `upsertCompetency` 헬퍼 패턴 (nested async function inside main)

### Task 3: Competency API Routes
- `GET/POST /api/v1/competencies` — 카테고리별 목록 + 생성
- `GET/PUT/DELETE /api/v1/competencies/[id]` — 역량 상세/수정/삭제
- `GET/PUT /api/v1/competencies/[id]/indicators` — 행동지표 bulk replace
- `GET/PUT /api/v1/competencies/[id]/levels` — 숙련도 레벨 bulk replace

### Task 4: CompetencyLibraryAdmin UI (`/settings/competencies`)
- `CompetencyListClient.tsx` — 기존 flat UI 완전 교체
  - 카테고리 탭 (핵심가치 / 리더십 / 직무전문)
  - 역량 카드 목록 (_count.indicators 표시)
  - 사이드패널: add / detail 모드
- `IndicatorEditor.tsx` — 행동지표 추가/삭제/↑↓ 순서변경 + bulk save
- `CompetencyLevelEditor.tsx` — 숙련도 레벨 편집 + bulk save

### Task 5-9: Manager Eval API + Client 업데이트
- `GET /api/v1/performance/evaluations/manager` → `apiSuccess({ members, evalSettings, beiIndicators })`
  - `getCompanySettings('evaluationSetting', companyId)` 로드
  - methodology === 'MBO_BEI'일 때 core_value 지표 로드
- `POST /api/v1/performance/evaluations/manager` → `performanceGrade`, `competencyGrade`, `beiIndicatorScores` 수신
- `ManagerEvalClient.tsx` — 동적 등급 버튼 + BEI 체크박스
  - `apiClient.get<EvalPayload>` 사용 (apiPaginated 제거)
  - `Object.values(compScores)` 전송 (hardcoded `[]` 제거)
  - 사이클 변경 시 grade 상태 리셋

---

## 생성/수정된 파일 목록 (B3-1)

### DB
```
prisma/schema.prisma                  — 5개 신규 모델 + PerformanceEvaluation 필드 추가
prisma/migrations/*/a_b3_*           — 3개 마이그레이션
prisma/seed.ts                        — B3-1 역량 라이브러리 시드
```

### API Routes (신규)
```
src/app/api/v1/competencies/route.ts
src/app/api/v1/competencies/[id]/route.ts
src/app/api/v1/competencies/[id]/indicators/route.ts
src/app/api/v1/competencies/[id]/levels/route.ts
```

### API Routes (수정)
```
src/app/api/v1/performance/evaluations/manager/route.ts
```

### UI Components (신규/수정)
```
src/app/(dashboard)/settings/competencies/CompetencyListClient.tsx  — 기존 교체
src/app/(dashboard)/settings/competencies/IndicatorEditor.tsx       — 신규
src/app/(dashboard)/settings/competencies/CompetencyLevelEditor.tsx — 신규
src/app/(dashboard)/performance/manager-eval/ManagerEvalClient.tsx  — 수정
```

---

## 주요 패턴 확립 (B3-1)

### apiSuccess vs apiPaginated
```ts
// ✅ 올바름 — 비배열 객체 응답
return apiSuccess({ members, evalSettings, beiIndicators })

// ❌ 잘못됨 — 배열이 아닌 객체에 apiPaginated 사용
return apiPaginated({ members, ... } as unknown as never[], ...)
```

### 클라이언트에서 apiClient.get 사용
```ts
// ✅ 비배열 응답: apiClient.get
const res = await apiClient.get<EvalPayload>(url, params)
setTeamMembers(res.data.members ?? [])

// ✅ 배열 응답: apiClient.getList
const res = await apiClient.getList<T>(url, params)
setItems(res.data)
```

### Bulk Replace (지표/레벨 업데이트)
```ts
const updated = await prisma.$transaction(async (tx) => {
  await tx.competencyIndicator.deleteMany({ where: { competencyId } })
  if (items.length > 0) {
    await tx.competencyIndicator.createMany({ data: items })
  }
  // findMany 반드시 트랜잭션 안에서 (TOCTOU 방지)
  return tx.competencyIndicator.findMany({ where: { competencyId }, orderBy: { displayOrder: 'asc' } })
})
```

### useEffect로 stale state 방지 (prop 변경 시)
```ts
useEffect(() => {
  setIndicators(initialIndicators.map(...))
}, [initialIndicators])
```

### Seed upsert 패턴 (compound unique key)
```ts
// CompetencyIndicator: @@unique([competencyId, displayOrder])
await prisma.competencyIndicator.upsert({
  where: { competencyId_displayOrder: { competencyId, displayOrder: i } },
  update: { indicatorText, isActive: true },
  create: { competencyId, indicatorText, displayOrder: i, isActive: true },
})
```

### @db.Uuid 사용 금지 (기존 프로젝트 컨벤션)
```prisma
// ❌ 잘못됨
id String @id @default(uuid()) @db.Uuid

// ✅ 올바름 (기존 모델 전체 패턴)
id String @id @default(uuid())
```

---

## 주의사항 (B8-3 의존성)

- `competency_requirements.expectedLevel` 필드: B8-3 스킬 갭 분석의 핵심 — 스키마 변경 금지
- `CompetencyLibrary` 구 테이블 유지 — `InterviewEvaluation.competencyLibraryId` 참조 존재

---

## 다음 세션: B4 (ATS Enhancement) — 이미 완료

> 참조: context/TRACK_B.md

## B3-2 완료 (2026-03-02)

### DB 변경 (migrate: a_b3_talent_review + a_b3_talent_review_fix)
- `ai_evaluation_drafts` 테이블 신규 (AiEvaluationDraft)
- `bias_detection_logs` 테이블 신규 (BiasDetectionLog)
- `OneOnOne.sentimentTag` 필드 추가
- `SuccessionCandidate.ranking`, `developmentNote` 필드 추가
- `AiFeature` enum: `EVAL_DRAFT_GENERATION` 추가

### 신규 API
- `POST/GET /api/v1/succession/readiness-batch` — 직원 readiness 일괄 조회
- `PUT /api/v1/succession/plans/[id]/candidates` — ranking, developmentNote 지원 추가
- `PUT /api/v1/succession/candidates/[id]` — ranking, developmentNote 지원 추가
- `GET /api/v1/employees/[id]/insights` — 직원 통합 사이드패널 데이터
- `POST/GET /api/v1/performance/evaluations/[id]/ai-draft` — AI 평가 초안 생성/조회
- `POST/GET /api/v1/performance/evaluations/bias-check` — 편향 감지 실행/조회
- `PUT /api/v1/cfr/one-on-ones/[id]` — sentimentTag 지원 추가

### 신규 컴포넌트
- `src/components/performance/EmployeeInsightPanel.tsx` — 직원 통합 사이드패널
- `src/components/performance/AiDraftModal.tsx` — AI 평가 초안 모달
- `src/components/performance/BiasDetectionBanner.tsx` — 편향 감지 배너

### 기존 컴포넌트 수정
- `CalibrationClient.tsx` — Readiness 뱃지 오버레이 + EmployeeInsightPanel + BiasDetectionBanner
- `ManagerEvalClient.tsx` — AI 초안 생성 버튼 + AiDraftModal
- `OneOnOneDetailClient.tsx` — sentimentTag 선택 UI
- `CandidateCard.tsx` — ranking Badge + developmentNote + EmployeeInsightPanel
- `navigation.ts` — succession href → /talent/succession

### 신규 페이지
- `src/app/(dashboard)/talent/succession/page.tsx` — /talent/succession 라우트

### 다음 세션 주의사항
- B10-1: `OneOnOne.sentimentTag` → 이직 예측 입력 데이터로 활용
- B10-1: `BiasDetectionLog` → HR 애널리틱스 대시보드 표시
- B10-2: AI 평가 초안 사용률 → HR KPI 위젯
- `AiEvaluationDraft.status` 값: draft|reviewed|applied|discarded
- 편향 감지 현재 central_tendency, leniency 2가지 — severity/recency/tenure/gender 확장 예정

---

# Track A — B6-2: 휴가 고도화 (정책엔진 + 통합 승인함) 완료 보고

> 완료일: 2026-03-03
> 세션 수: 2 sessions (컨텍스트 초과로 분할)
> 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ 성공

---

## B6-2 구현 완료 항목

### Task 1: DB Migration — 5개 신규 모델
- `LeaveTypeDef` (leave_type_defs) — 법인별 휴가 유형 정의
- `LeaveAccrualRule` (leave_accrual_rules) — 부여 규칙 (JSON 티어 구조)
- `LeaveYearBalance` (leave_year_balances) — 직원 연도별 잔여 집계
- `AttendanceApprovalRequest` (attendance_approval_requests) — 통합 승인 요청
- `AttendanceApprovalStep` (attendance_approval_steps) — 다단계 승인 스텝
- 마이그레이션 이름: `a_b6_leave_policy_engine`, `a_b6_varchar_fix`
- VarChar(20) → VarChar(30) 수정 (accrualBasis = 'hire_date_anniversary' 21자)

### Task 2: 시드 데이터
- 6개 법인 LeaveTypeDef: KR(연차·경조사·병가·출산육아), US(Vacation·Sick·PTO), CN(연차·병가·출산)
- 총 28개 LeaveTypeDef 생성
- KR 연차 accrualRule: hire_date_anniversary + monthly (한국 근로기준법)
- US Vacation accrualRule: calendar_year + annual
- 총 4개 LeaveAccrualRule 생성

### Task 3: Accrual Engine (`src/lib/leave/accrualEngine.ts`)
- `calculateEntitlement(employeeId, leaveTypeDefId, year)` — 근속 구간별 부여일 계산
- `processAnnualAccrual(companyId, year)` — 법인 전체 일괄 부여 처리
- `getEmployeeLeaveBalance(employeeId, year)` — 잔여 조회 (remaining 계산 포함)
- 한국 근로기준법: 첫 해 월 1일(최대 11일), 1년+ 15일/년, 3년+ 2년마다 +1일(최대 25일)
- calendar_year / hire_date_anniversary 두 accrualBasis 지원

### Task 4: Leave Settings Admin UI (`/settings/leave`)
- `src/app/(dashboard)/settings/leave/page.tsx` — 서버 컴포넌트
- `src/app/(dashboard)/settings/leave/LeaveSettingsClient.tsx` — 3탭 클라이언트
  - 탭1 (휴가 유형): CRUD, 반일 허용 여부, 유급/무급, 법정휴가 표시
  - 탭2 (부여 규칙): accrualBasis/Type 선택, 티어 편집, 연간 일괄 부여 실행
  - 탭3 (이월·소멸): carryOverType (none/limited/unlimited), maxDays, expiryMonths
- API 연동: LeaveTypeDef CRUD + LeaveAccrualRule upsert + 일괄 부여 POST

### Task 5: 통합 승인 API
- `GET/POST /api/v1/approvals/attendance` — 목록(view=mine|pending-approval|team) + 생성
- `GET/PUT /api/v1/approvals/attendance/[id]` — 상세 조회 + 승인/반려 처리
- `GET /api/v1/leave/type-defs`, `POST /api/v1/leave/type-defs`
- `GET/PUT/DELETE /api/v1/leave/type-defs/[id]`
- `GET/PUT /api/v1/leave/type-defs/[id]/accrual-rules`
- `POST /api/v1/leave/accrual` — 연간 일괄 부여 실행
- `GET /api/v1/leave/year-balances` — 직원 연도별 잔여 조회

### Task 6: 통합 승인함 UI (`/approvals/attendance`)
- `src/app/(dashboard)/approvals/attendance/page.tsx`
- `src/app/(dashboard)/approvals/attendance/AttendanceApprovalClient.tsx`
  - 뷰 토글: 결재 대기 / 내 신청 / 팀 전체
  - 요청 유형 필터 칩 (leave/overtime/attendance_correction/shift_change)
  - 좌측 목록 + 우측 상세 2-패널 레이아웃
  - 승인/반려 액션 + 코멘트 입력

### Task 7: 직원 휴가 현황 (`/my/leave`)
- `src/app/(dashboard)/my/leave/page.tsx`
- `src/app/(dashboard)/my/leave/MyLeaveClient.tsx`
  - 연도 선택 (좌우 화살표)
  - KPI 카드: 총 부여 / 사용 / 대기중 / 잔여
  - 유형별 사용률 Progress Bar (green=사용, yellow=대기)
  - 신청 이력 테이블 (기존 /api/v1/leave/requests 활용)

---

## 생성/수정된 파일 목록 (B6-2)

### DB
```
prisma/schema.prisma                         — 5개 신규 모델 추가
prisma/migrations/*/a_b6_leave_policy_engine/ — 신규 모델 마이그레이션
prisma/migrations/*/a_b6_varchar_fix/         — VarChar 길이 수정
```

### 라이브러리
```
src/lib/leave/accrualEngine.ts               — 휴가 부여 엔진
```

### API
```
src/app/api/v1/leave/type-defs/route.ts
src/app/api/v1/leave/type-defs/[id]/route.ts
src/app/api/v1/leave/type-defs/[id]/accrual-rules/route.ts
src/app/api/v1/leave/accrual/route.ts
src/app/api/v1/leave/year-balances/route.ts
src/app/api/v1/approvals/attendance/route.ts
src/app/api/v1/approvals/attendance/[id]/route.ts
```

### UI
```
src/app/(dashboard)/settings/leave/page.tsx
src/app/(dashboard)/settings/leave/LeaveSettingsClient.tsx
src/app/(dashboard)/approvals/attendance/page.tsx
src/app/(dashboard)/approvals/attendance/AttendanceApprovalClient.tsx
src/app/(dashboard)/my/leave/page.tsx
src/app/(dashboard)/my/leave/MyLeaveClient.tsx
```

---

## 다음 세션 주의사항
- `LeaveTypeDef` — 기존 `LeaveType` enum과 별개 (enum은 LeaveRequest.leaveType에서 사용)
- `AttendanceApprovalRequest.requestType` — leave/overtime/attendance_correction/shift_change
- `LeaveYearBalance.remaining` = entitled + carriedOver + adjusted - used - pending (DB 컬럼 아님, 계산값)
- `ACTION.VIEW` = 'read', `ACTION.APPROVE` = 'manage' (ACTION.READ/MANAGE 존재하지 않음)
- Zod v3: `z.record()` 는 `z.record(keySchema, valueSchema)` 2개 인자 필요
- Prisma JSON 필드: `(data.details ?? {}) as object` 캐스트로 타입 오류 회피
- `{ prisma }` named export (default export 아님)

---

# Track A — B7-1a: 한국법인 급여 계산 엔진 완료 보고

> 완료일: 2026-03-03
> 세션 수: 1 session
> 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ 성공

---

## B7-1a 구현 완료 항목

### Task 1: DB Migration — 3개 신규 모델
- `InsuranceRate` (insurance_rates) — 4대보험 요율 (연도별, @@unique([year, type]))
- `NontaxableLimit` (nontaxable_limits) — 비과세 한도 (연도별, @@unique([year, code]))
- `Payslip` (payslips) — 급여명세서 발급 추적 (@@unique([payrollItemId]))
- Migration: `a_b7_payroll_kr`
- Employee + Company 에 `payslips` 관계 추가

### Task 2: 시드 데이터 (prisma/seed.ts)
- 2025년 4대보험 5종: national_pension, health_insurance, long_term_care, employment_insurance, industrial_accident
- 2025년 비과세 한도 4종: meal_allowance(20만), vehicle_allowance(20만), childcare(20만), research_allowance(20만)

### Task 3: 계산 엔진 강화 (src/lib/payroll/kr-tax.ts)
- `separateTaxableIncome()` — 비과세 한도 적용 후 과세/비과세 분리
- `calculateProrated()` — 중도입사/퇴사 일할계산 (주 5일 기준 평일 수)
- `detectPayrollAnomalies()` — 이상 항목 감지 (전월 >20% 변동, 초과근무 >기본급 50%)
- `getWeekdaysInMonth()`, `getWeekdaysBetween()` — 평일 수 계산 유틸

### Task 4: calculator.ts 업데이트 (src/lib/payroll/calculator.ts)
- 비과세 한도 DB 조회 → `separateTaxableIncome()` 적용
- 중도입사 일할계산: hireDate 기반 `calculateProrated()` 적용
- 4대보험 계산 기준: 과세소득(taxableIncome) 기준으로 변경
- 전월 PayrollItem 참조 → `detectPayrollAnomalies()` 실행
- PayrollItemDetail에 `taxableIncome`, `nontaxableTotal`, `isProrated`, `prorateRatio`, `workDays`, `anomalies` 추가

### Task 5: Payslip 생성 (approve route 강화)
- `PUT /api/v1/payroll/runs/[id]/approve` — REVIEW→APPROVED 시 직원별 Payslip 자동 생성 (트랜잭션)
- 이미 존재하는 경우 upsert로 중복 방지

### Task 6: Payslip API (신규)
- `GET /api/v1/payroll/payslips` — 급여명세서 목록 (?year, ?month, ?employeeId)
  - HR: 법인 전체 / Employee: 본인만
- `PATCH /api/v1/payroll/payslips/[id]` — 열람 처리 (isViewed, viewedAt 업데이트)

### Task 7: 직원 명세서 접근 범위 확대
- `GET /api/v1/payroll/me` — PAID → APPROVED|PAID 상태 모두 조회 가능으로 변경

---

## 생성/수정된 파일 목록 (B7-1a)

### DB
```
prisma/schema.prisma           — InsuranceRate, NontaxableLimit, Payslip 모델 추가
prisma/migrations/*/a_b7_payroll_kr/  — 마이그레이션
prisma/seed.ts                 — 2025년 4대보험/비과세 한도 시드
```

### 핵심 라이브러리 (수정)
```
src/lib/payroll/kr-tax.ts      — separateTaxableIncome, calculateProrated, detectPayrollAnomalies 추가
src/lib/payroll/calculator.ts  — 비과세 분리 + 일할계산 + 이상감지 통합
src/lib/payroll/types.ts       — PayrollItemDetail에 B7-1a 필드 추가
```

### API Routes (수정)
```
src/app/api/v1/payroll/runs/[id]/approve/route.ts  — Payslip 자동 생성 추가
src/app/api/v1/payroll/me/route.ts                 — APPROVED 상태 포함
```

### API Routes (신규)
```
src/app/api/v1/payroll/payslips/route.ts           — 급여명세서 목록
src/app/api/v1/payroll/payslips/[id]/route.ts      — 열람 처리
```

---

## 주요 설계 결정

### 기존 인프라 재활용
- PayrollRun, PayrollItem은 기존 스키마 그대로 활용 (필드 추가 없음)
- 상세 데이터는 `PayrollItem.detail` (JSON)에 저장 — B7-1a 필드도 동일 JSON에 포함
- 기존 `kr-tax.ts`의 하드코딩 요율(NATIONAL_PENSION_RATE 등) 유지 — DB에서 읽어오지 않고 fallback으로 사용

### 비과세 분리 방식
- AllowanceRecord.allowanceType === 'MEAL_ALLOWANCE' → code: 'meal_allowance'로 매핑
- NontaxableLimit 테이블에서 연도별 한도 조회
- 한도 초과분은 taxableIncome에 포함

### 일할계산 기준
- 주 5일(평일) 기준 — 공휴일 미반영 (추후 Holiday 테이블 연동 가능)
- 입사월에만 적용 (퇴사월은 별도 처리 필요 시 resignDate 파라미터 추가)

### 이상감지 저장
- PayrollItem.detail.anomalies 배열에 저장
- Review UI의 AnomalyPanel에서 summary.anomalies로 집계하여 표시

---

## 다음 세션 주의사항 (A 트랙)
- B7-1b: payroll_items.detail.taxableIncome → 연말정산 총급여 계산에 활용
- B7-1b: insurance_rates/nontaxable_limits 테이블을 연말정산에서도 참조 가능
- B7-2: 해외 법인은 별도 계산 엔진 (InsuranceRate 테이블에 국가코드 추가 고려)
- PayrollItem.detail의 anomalies 배열 → B10 애널리틱스에서 활용 가능
- Payslip PDF 경로(pdfPath)는 현재 미구현 — B7-1b 또는 별도 세션에서 Supabase Storage 연동 필요

---

# Track A — B7-1b: 연말정산 완료 보고

> 완료일: 2026-03-03
> 세션 수: 1 session
> 검증: `tsc --noEmit` ✅ 0 errors (new files) | `npm run build` ✅ 성공

---

## B7-1b 구현 완료 항목

### Task 1+2: DB Migration + Seed Data
- `YearEndDeductionConfig` (year_end_deduction_configs) — 공제항목 설정 (@@unique([year, code]))
- `IncomeTaxRate` (income_tax_rates) — 과세표준 세율구간 (@@unique([year, minAmount]))
- `YearEndSettlement` (year_end_settlements) — 직원별 연말정산 (@@unique([employeeId, year]))
- `YearEndDependent` (year_end_dependents) — 부양가족
- `YearEndDeduction` (year_end_deductions) — 공제항목 상세
- `YearEndDocument` (year_end_documents) — 제출서류
- `WithholdingReceipt` (withholding_receipts) — 원천징수영수증 (@@unique([settlementId]))
- Migration: `a_b7_year_end_settlement`
- 2025년 시드: 소득공제 6종 + 세액공제 6종 + 과세표준 8구간

### Task 3+5: 계산 엔진 + 공제한도
- `src/lib/payroll/yearEndCalculation.ts` — 11단계 연말정산 계산
  - `calculateYearEndSettlement(settlementId, employeeId, year)` — 메인 계산
  - `sumAnnualGross(employeeId, year)` — B7-1a payroll_items 집계
  - `sumPrepaidTax(employeeId, year)` — 기납부세액 집계
  - `calcEarnedIncomeDeduction(totalSalary)` — 근로소득공제 구간별
- `src/lib/payroll/deductionCalculator.ts` — 항목별 한도 적용
  - `calculateDeductibleAmount(code, inputAmount, totalSalary, year)` — DB rules 기반
  - `calculateEarnedIncomeCredit(calculatedTax, totalSalary, rules)` — 근로소득세액공제
  - `calculateChildCredit(childCount, rules)` — 자녀세액공제

### Task 4: 직원용 연말정산 UI
- `src/app/(dashboard)/my/year-end/page.tsx` — 서버 컴포넌트
- `src/app/(dashboard)/my/year-end/YearEndWizardClient.tsx` — 4단계 위저드
  - Step 1: 부양가족 확인 (CRUD)
  - Step 2: 공제항목 입력 (직접입력 폼 + 홈택스 PDF 업로드)
  - Step 3: 추가공제 (주택마련저축, 주택임차차입금)
  - Step 4: 결과 확인 (11단계 계산 결과 + 제출)

### Task 6+7: HR 관리 + 원천징수영수증
- `src/app/(dashboard)/payroll/year-end/page.tsx` — 서버 컴포넌트
- `src/app/(dashboard)/payroll/year-end/YearEndHRClient.tsx` — HR 대시보드
  - 진행현황 카드 (상태별 카운트)
  - 직원 목록 테이블 (검토/확정/영수증)
  - 일괄 확정 기능
- `src/lib/payroll/yearEndReceiptPdf.ts` — 원천징수영수증 HTML 생성

### API Routes (신규)
```
src/app/api/v1/year-end/settlements/route.ts         — GET/POST
src/app/api/v1/year-end/settlements/[id]/route.ts    — GET/PUT
src/app/api/v1/year-end/settlements/[id]/submit/     — POST
src/app/api/v1/year-end/settlements/[id]/dependents/ — GET/PUT
src/app/api/v1/year-end/settlements/[id]/deductions/ — GET/PUT
src/app/api/v1/year-end/settlements/[id]/documents/  — POST/DELETE
src/app/api/v1/year-end/settlements/[id]/calculate/  — POST
src/app/api/v1/year-end/hr/settlements/route.ts      — GET
src/app/api/v1/year-end/hr/settlements/[id]/confirm/ — POST
src/app/api/v1/year-end/hr/settlements/[id]/receipt/ — POST
src/app/api/v1/year-end/hr/bulk-confirm/route.ts     — POST
```

### Navigation
- 나의 공간: `/my/year-end` (연말정산, payroll module, countryFilter: KR, badge: new)
- 인사 운영: `/payroll/year-end` (연말정산, payroll module, countryFilter: KR, badge: new)

---

## 다음 세션 주의사항 (A 트랙)
- B7-2: 해외법인은 연말정산 없음 (CTR-KR only)
- B10-2: HR KPI에 연말정산 완료율 위젯 추가 가능
- finalSettlement 값이 양수=추가납부, 음수=환급 (주의)
- WithholdingReceipt.pdfPath는 HTML 기반 (브라우저 인쇄용)
- 홈택스 PDF 파싱은 미구현 — 직접 입력만 지원
- 차감징수 → 급여반영은 B7-1a의 adjustments에 수동 추가 필요

---

## 설계 결정 사항
- BigInt: 과세표준/세액 계산에 BigInt 사용 (API 응답 시 string 직렬화)
- 공제항목 한도: `year_end_deduction_configs.rules` JSON에서 읽음 (코드 하드코딩 없음)
- 연도별 세율: `income_tax_rates` 테이블 (2026년 추가 시 코드 변경 불필요)
- 홈택스 간소화 PDF: 파싱 미지원, 수동입력 폼 대안 제공

---

# Track A — B9-2: 복리후생 신청·승인 완료 보고

> 완료일: 2026-03-03
> 검증: `tsc --noEmit` ✅ 0 errors (B9-2 파일) | `npm run build` ✅ 성공

## B9-2 구현 완료 항목

### Task 1: DB Migration
- `BenefitPlan` (benefit_plans) — 법인별 복리후생 항목
- `BenefitClaim` (benefit_claims) — 직원 신청 + 승인 워크플로
- `BenefitBudget` (benefit_budgets) — 법인/카테고리별 연간 예산
- 마이그레이션: `a_benefit_claims`

### Task 2: 시드 데이터
- CTR-KR: 10개 (family 5, education 2, health 2, lifestyle 1)
- CTR-US: 5개 (financial 2, health 2, lifestyle 1)
- 나머지 법인(CN/RU/VN/MX): 기본 2개씩 (health + family) = 8개
- 합계: 23개 benefit_plans
- 예산 2025: KR 4카테고리(₩50M), US 3카테고리($90K) = 7개 benefit_budgets

### 직원용 UI
- `/my/benefits` — 사용현황 프로그레스 + 신청 모달 + 이력 리스트
- 네비게이션 "나의 공간 > 복리후생" → `/my/benefits`로 업데이트

### HR 관리 UI
- `/benefits` (기존 교체) — 승인대기/전체내역/예산관리 3탭 HR 뷰

### API Routes (신규)
- `GET /api/v1/benefit-plans` — 법인별 활성 플랜 목록
- `GET/POST /api/v1/benefit-claims` — 직원 신청 + HR 목록(view=mine|pending|all)
- `GET/PATCH /api/v1/benefit-claims/[id]` — 상세 + 승인/반려/취소
- `GET /api/v1/benefit-claims/summary` — 직원 연간 사용 현황 집계
- `GET/PUT /api/v1/benefit-budgets` — 예산 조회/수정

### 핵심 비즈니스 로직
- 승인 시 `BenefitBudget.usedAmount` 자동 증가 (트랜잭션)
- 연간 한도 초과 신청 차단 (annual frequency 항목)
- 증빙 필수 항목 검증 (서버사이드)
- 예산 80% 초과 시 경고 배지 표시

## 다음 세션 연동 포인트
- B10-1 애널리틱스: 복리후생 활용률(`BenefitClaim` 집계) 데이터 참조
- B10-2 HR KPI: 복리후생 활용률 위젯
- B11 알림: 승인/반려 알림, 예산 80% 소진 알림, 연간 미사용 안내
- B7-1b 연말정산: 과세 대상 복리후생(학자금 등) 참고 데이터 — 직접 포함 X

## 주요 설계 결정
- 복리후생 지급은 급여와 완전 분리 (별도 지급)
- 파일 업로드: 경로 메타데이터만 저장 (S3 실제 업로드는 추후 연동)
- 승인 플로우: 단순 1-step HR 직접 승인 (AttendanceApprovalRequest 패턴 미사용)
- BenefitBudget.usedAmount: 승인 트랜잭션에서 자동 증가

---

# B7-2: 해외 급여 통합 + 글로벌 분析

**완료일:** 2026-03-03
**소요:** 2 세션 (컨텍스트 초과로 분리)

## 구현 범위 (8개 Task)

| Task | 내용 | 상태 |
|------|------|------|
| 1 | DB migration — Prisma 모델 5개 신규 추가 | ✅ |
| 2 | 환율 관리 UI + API + 시드 (`/settings/exchange-rates`) | ✅ |
| 3 | 해외 급여 업로드 + 매핑 설정 (`/payroll/import`) | ✅ |
| 4 | 글로벌 급여 대시보드 (`/payroll/global`) | ✅ |
| 5 | 급여 시뮬레이션 (전출/인상/승진) (`/payroll/simulation`) | ✅ |
| 6 | 이상 탐지 4가지 규칙 (`/payroll/anomalies`) | ✅ |
| 7 | 해외법인 시드 데이터 (5법인 × 30명) | ✅ |
| 8 | TypeScript 검증 (tsc --noEmit) + Build | ✅ |

## 신규 Prisma 모델

```
ExchangeRate         — 법인통화 → KRW 환율 (year, month, fromCurrency, toCurrency 복합 유니크)
PayrollImportMapping — 파일 헤더 매핑 설정 (법인별, JSON mappings 필드)
PayrollImportLog     — 업로드 이력 (파일명, 행수, 성공/실패 카운트)
PayrollSimulation    — 시뮬레이션 결과 저장 (type: transfer|raise|promotion)
PayrollAnomaly       — 이상 탐지 결과 (severity: low|medium|high|critical)
```

## 신규 파일 목록

### API Routes
```
src/app/api/v1/payroll/exchange-rates/route.ts      — GET(조회) + PUT(일괄저장)
src/app/api/v1/payroll/import-mappings/route.ts     — GET + POST + PATCH/DELETE [id]
src/app/api/v1/payroll/import-logs/route.ts         — GET + POST(업로드 처리)
src/app/api/v1/payroll/global/route.ts              — GET(글로벌 대시보드 집계)
src/app/api/v1/payroll/simulation/route.ts          — GET(이력) + POST(시뮬레이션 실행)
src/app/api/v1/payroll/anomalies/route.ts           — GET(목록) + POST(탐지 실행) + PATCH(상태변경)
```

### Pages & Clients
```
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
```

### Seed
```
prisma/seeds/foreign-payroll.ts    — 5법인 × 30명 급여 시드 (환율 포함)
```

## TypeScript 에러 수정 (Task 8)

25+ 에러를 9개 파일에서 수정:

| 패턴 | 잘못된 코드 | 올바른 코드 |
|------|-----------|-----------|
| apiClient 반환 타입 | `setResult(res)` | `setResult(res.data)` — `apiClient.post<T>()` returns `ApiResponse<T>` |
| ACTION 상수 | `ACTION.READ` | `ACTION.VIEW` — `constants.ts`에 `READ` 없음 |
| apiError 인자 수 | `apiError(message, 400)` | `apiError(badRequest(message))` — 1 arg only |
| Zod record | `z.record(z.string())` | `z.record(z.string(), z.string())` — v3는 2 arg 필수 |
| Prisma 관계명 | `payrollRun: { companyId }` | `run: { companyId }` — 관계 이름이 `run` |
| PayrollItem 필드 | `basePay` | `baseSalary` |
| Employee 필드 | `nameKo`, `employeeNumber` | `name`, `employeeNo` |
| Prisma JSON 필드 | `{ mappings: data.mappings }` | `{ mappings: JSON.parse(JSON.stringify(data.mappings)) }` |
| aggregate _avg | `_avg.grossPay` | `_avg?.grossPay ?? 0` — possibly undefined |
| Recharts PieLabel | `name: string` | `name?: string` — PieLabelRenderProps.name is `string \| undefined` |

## 최종 검증 결과
```
npx tsc --noEmit  → 0 errors ✅
npm run build     → success ✅ (Node.js 내부 deprecation warning만, 프로젝트 코드 오류 없음)
```

## 이상 탐지 4가지 규칙
1. **급여 급등** — 전월 대비 50% 초과 증가
2. **마이너스 급여** — netPay < 0
3. **평균 이탈** — 법인 평균 ±3σ (표준편차 3배 초과)
4. **중복 처리** — 같은 yearMonth, 같은 직원 2건 이상

## 다음 세션 연동 포인트
- B10 HR 애널리틱스: ExchangeRate + PayrollRun 데이터로 글로벌 인건비 KPI
- B11 알림: PayrollAnomaly 생성 시 HR_ADMIN 알림
- 해외법인 급여 실제 연동 시: PayrollImportLog → PayrollRun 자동 생성 파이프라인

---

# Track A — B10-2: HR KPI 대시보드 완료 보고

> 완료일: 2026-03-03
> 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ 성공

## DB 테이블
- `kpi_dashboard_configs` — 사용자별 대시보드 레이아웃 저장
- 마이그레이션: `a_kpi_dashboard`

## 주요 라우트
- `/dashboard` — HR KPI 메인 대시보드 (HR_ADMIN/SUPER_ADMIN/EXECUTIVE)
- `/dashboard/compare` — 글로벌 법인 비교 뷰

## API Routes
- `GET /api/v1/dashboard/summary` — 6개 핵심 KPI (Promise.allSettled 방어 코딩)
- `GET /api/v1/dashboard/widgets/[widgetId]` — 탭별 위젯 데이터 (15개 widgetId)
- `GET /api/v1/dashboard/compare` — 법인 비교 + 추이

## 위젯 목록 (widgetId: 데이터소스: 차트타입)
- workforce-grade: EmployeeAssignment groupBy jobGradeId: bar-horizontal
- workforce-company: EmployeeAssignment groupBy companyId: donut
- workforce-trend: AnalyticsSnapshot (headcount): line
- workforce-tenure: EmployeeAssignment + Employee.hireDate: bar
- recruit-pipeline: Application groupBy stage: bar
- recruit-ttr: Application (HIRED) avg sojourn: bar
- recruit-talent-pool: TalentPoolEntry count: number
- perf-grade: PerformanceEvaluation groupBy performanceGrade: bar
- perf-skill-gap: EmployeeSkillAssessment gap 상위 5: bar-horizontal
- attend-52h: WorkHourAlert groupBy alertLevel: bar
- attend-leave-trend: LeaveRequest 월별 count: line
- attend-burnout: BurnoutScore groupBy riskLevel: bar
- payroll-cost: PayrollRun + ExchangeRate KRW 환산 (payrollItems relation): bar
- training-mandatory: TrainingEnrollment (mandatory_auto): bar
- training-benefit: BenefitClaim groupBy category: bar

## 컴포넌트
- `src/components/dashboard/KpiWidget.tsx` — 추상 위젯 (bar/bar-horizontal/line/donut/number)
- `src/components/dashboard/KpiSummaryCard.tsx` — 숫자형 KPI 카드 + 전월 변동
- `src/components/dashboard/WidgetSkeleton.tsx` — 로딩 스켈레톤
- `src/components/dashboard/WidgetEmpty.tsx` — 빈 상태

## 스키마 주의사항 (다음 세션용)
- TalentPool 모델 = `TalentPoolEntry` (companyId 필드 없음)
- TrainingEnrollment status enum = `ENROLLMENT_COMPLETED` (not 'COMPLETED')
- EmployeeAssignment 시작일 = `effectiveDate` (not `startDate`)
- PayrollRun → PayrollItem 관계명 = `payrollItems` (not `items`)

## 설계 결정
- 클라이언트 완전 독립 위젯 방식 (위젯별 독립 fetch, Promise.allSettled)
- 탭별 lazy mount — 요약 탭 6개 KPI만 초기 로드
- 법인 필터: SUPER_ADMIN → 전체, HR_ADMIN/EXECUTIVE → 자기 법인
- 방어 코딩: 위젯 실패 시 null 반환 → WidgetEmpty 표시, 전체 영향 없음

## 다음 세션 연동 포인트
- B11 ([B] 트랙): 시스템 설정에 대시보드 위젯 설정 통합
- B11 (후반부): 위험 KPI 알림 배지 (이직위험/번아웃 기준 초과 시)
- 9-Block 위젯 (perf-9block): CalibrationSession 데이터 구조 확인 후 추가 예정
