# Track B — HR 예측 애널리틱스 (B10-1) 완료 보고

> 완료일: 2026-03-03
> 세션 수: 1 session (B10-1 Predictive HR Analytics)
> 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ Compiled successfully

---

## B10-1 구현 완료 항목

### Task 1: Prisma 모델 5개 추가 + db push
- `TurnoverRiskScore` — 직원별 이직 위험 점수 (overallScore, riskLevel, signals, topFactors)
- `BurnoutScore` — 직원별 번아웃 점수 (overallScore, riskLevel, indicators)
- `TeamHealthScore` — 부서별 팀 건강 점수 (overallScore, riskLevel, metrics, memberCount)
- `AnalyticsSnapshot` — 일별 배치 계산 스냅샷 (companyId_snapshotDate_type unique)
- `AnalyticsConfig` — 가중치 설정 (configType, config JSON)
- Migration: `prisma db push` (b_analytics)

### Task 2: 이직 위험 예측 엔진
- 파일: `src/lib/analytics/predictive/turnoverRisk.ts`
- 10개 신호 가중합: 초과근무 지속(0.15), 연차 미사용(0.1), 원온원 감정 부정(0.15), 급여 밴드 하위(0.1), 승진 정체(0.1), 역량 갭(0.05), 교육 미이수(0.05), 퇴직 패턴(0.1), 평가 등급 하락(0.1), 재직기간(0.1)
- AnalyticsConfig 우선 → 없으면 DEFAULT_WEIGHTS
- 가용 신호 3개 미만 → `insufficient_data` 반환
- riskLevel: low / medium(35+) / high(55+) / critical(75+)

### Task 3: 번아웃 감지 엔진
- 파일: `src/lib/analytics/predictive/burnout.ts`
- 5개 지표: 초과근무 강도(0.3), 연차 미사용률(0.2), 원온원 감정 추이(0.2), 연속 근무일수(0.15), 야간/휴일 근무 빈도(0.15)
- Attendance 필드: `workDate` (where/orderBy), `clockIn`/`clockOut` (select)
- riskLevel: low / medium(30+) / high(50+) / critical(70+)

### Task 4: 팀 심리안전 지수 엔진
- 파일: `src/lib/analytics/predictive/teamHealth.ts`
- 5개 지표: 팀 평균 감정점수, 팀 이직률(12개월), 팀 연차 사용률, 초과근무 분산도, 퇴직자 만족도
- 동등 가중치 (available 지표 수로 나눔)
- ExitInterview 필드: `satisfactionScore` (1~10 스케일)

### Task 5: HR 애널리틱스 대시보드 UI
- 페이지: `src/app/(dashboard)/analytics/predictive/page.tsx`
- 클라이언트: `src/app/(dashboard)/analytics/predictive/PredictiveAnalyticsClient.tsx`
- 4탭: 이직예측 | 번아웃 | 팀건강 | 인력현황
- 요약 KPI 카드 4개 (고위험 이직/번아웃 인원, 위험 팀, 분석 대상)
- "배치 계산 실행" 버튼 → `POST /api/v1/analytics/calculate`
- recharts BarChart (위험도 분포), RadarChart (팀 건강 레이더)
- RiskBadge, ScoreBar 헬퍼 컴포넌트

### Task 6: 개인 이직위험 상세 분석 뷰
- 페이지: `src/app/(dashboard)/analytics/predictive/[employeeId]/page.tsx`
- 클라이언트: `src/app/(dashboard)/analytics/predictive/[employeeId]/EmployeeRiskDetailClient.tsx`
- SVG 게이지 차트, 10개 신호 RadarChart
- 번아웃 지표 바
- RecommendedActions 컴포넌트 (contextual HR 권고사항)
- "실시간 재계산" 버튼 (recalculate=true 파라미터)

### Task 7: 배치 계산 API + 스냅샷
- `POST /api/v1/analytics/calculate` — 전 직원 일괄 계산 + createMany + AnalyticsSnapshot upsert
- `GET /api/v1/analytics/turnover-risk` — 직원별 최신 이직 위험 목록
- `GET /api/v1/analytics/burnout` — 직원별 최신 번아웃 목록 (risk_level 필터)
- `GET /api/v1/analytics/team-health-scores` — 부서별 최신 팀 건강 스코어
- `GET /api/v1/analytics/employee-risk` — 개인 상세 조회 + 선택적 실시간 재계산

### TypeScript 수정 사항
- `import { prisma }` named export (turnoverRisk.ts 초기 default import 오류 수정)
- Employee 모델: `name` 필드 (firstName/lastName 없음) 대응
- Attendance 모델: `workDate`(날짜)/`clockIn`/`clockOut`(시각) 구분
- SalaryBand 모델: `isActive` → `deletedAt: null` 조건으로 대체
- ExitInterview 모델: `overallSatisfaction` → `satisfactionScore` 수정

### 신규 파일 목록
| 파일 | 설명 |
|------|------|
| `src/lib/analytics/predictive/turnoverRisk.ts` | 이직 위험 예측 엔진 |
| `src/lib/analytics/predictive/burnout.ts` | 번아웃 감지 엔진 |
| `src/lib/analytics/predictive/teamHealth.ts` | 팀 심리안전 지수 엔진 |
| `src/app/(dashboard)/analytics/predictive/page.tsx` | 대시보드 서버 페이지 |
| `src/app/(dashboard)/analytics/predictive/PredictiveAnalyticsClient.tsx` | 4탭 대시보드 클라이언트 |
| `src/app/(dashboard)/analytics/predictive/[employeeId]/page.tsx` | 개인 상세 서버 페이지 |
| `src/app/(dashboard)/analytics/predictive/[employeeId]/EmployeeRiskDetailClient.tsx` | 개인 상세 클라이언트 |
| `src/app/api/v1/analytics/calculate/route.ts` | 배치 계산 API |
| `src/app/api/v1/analytics/turnover-risk/route.ts` | 이직 위험 목록 API |
| `src/app/api/v1/analytics/burnout/route.ts` | 번아웃 목록 API |
| `src/app/api/v1/analytics/team-health-scores/route.ts` | 팀 건강 스코어 API |
| `src/app/api/v1/analytics/employee-risk/route.ts` | 개인 리스크 상세 API |

---

# Track B — 조직도 시각화 + 조직 개편 (B8-1) 완료 보고

> 완료일: 2026-03-03
> 세션 수: 2 sessions (B8-1 Org Chart + Restructuring)
> 검증: `tsc --noEmit` ✅ 0 new errors | `npm run build` ✅ Compiled successfully

---

## B8-1 구현 완료 항목

### Task 1: Prisma 스키마 확장 + Migration
- `OrgRestructurePlan` 모델 신규 추가:
  - 필드: id, companyId, title, description, effectiveDate, status(draft/review/approved/applied), changes(Json), createdBy, approvedBy, approvedAt, appliedAt
  - `Company` 모델에 `orgRestructurePlans OrgRestructurePlan[]` 역참조 추가
- Migration: `b_b8_org_chart` 적용 (`20260302154414_b_b8_org_chart`)

### Task 2-3: OrgClient.tsx 확장
- **3가지 뷰 모드**: Tree(기존 React Flow 유지) / List(계층 들여쓰기 테이블) / Grid(카드 뷰)
- **EffectiveDatePicker 교체**: `input[type=month]` → `EffectiveDatePicker` (Date 타입, `allowFuture=false`)
- **검색**: 부서명/코드/영문명 실시간 필터 (Tree: 노드 opacity 0.2 dimming, List/Grid: 배열 필터)
- **스냅샷 모드**: `isToday()` 헬퍼로 현재 vs 과거 자동 감지 + "현재" 리셋 버튼
- **조직 개편 버튼**: HR_ADMIN / SUPER_ADMIN에게만 노출

### Task 4: RestructureModal.tsx (신규)
- 파일: `src/components/org/RestructureModal.tsx`
- 6가지 변경 유형: create(부서 신설) / move(부서 이동) / merge(통합) / rename(명칭 변경) / close(폐지) / transfer_employee(인원 이동)
- 3-step 워크플로: 편집 → Diff 미리보기 → 최종 확인
- "초안 저장" → POST plans (status:draft), "즉시 적용" → POST plans (status:approved) → POST apply

### Task 5: RestructureDiffView.tsx (신규)
- 파일: `src/components/org/RestructureDiffView.tsx`
- 변경 유형별 DiffRow (색상 구분: 신설=초록 / 제거=빨강 / 변경=노랑 / 이동=파랑)
- 요약 카드: 신설/제거/변경/이동 건수
- 영향도 분석: 총 영향 인원, 변경 항목 수, 발효일
- 경고 표시: Assignment 재배치 필요 항목
- 부서 수 변화 예측: 현재 → 개편 후 예상

### Task 6: API Routes (4개)
- `GET /api/v1/org/restructure-plans` — 목록 (페이지네이션, companyId/status 필터)
- `POST /api/v1/org/restructure-plans` — 계획 생성 (Zod: `z.record(z.string(), z.unknown())`)
- `GET/PATCH/DELETE /api/v1/org/restructure-plans/[id]` — 단건 CRUD (appliedAt 보호)
- `POST /api/v1/org/restructure-plans/[id]/apply` — 계획 적용 (Prisma $transaction):
  - create: 신규 Department 생성 (level 자동 계산)
  - move: Department.parentId + level 업데이트
  - merge: source 직원 → target 부서로 EmployeeAssignment 이동 (changeType: REORGANIZATION)
  - rename: Department name/nameEn 업데이트
  - close: 직원 → 상위 부서 이동 후 isActive: false
  - transfer_employee: 개인 Assignment 이동 (changeType: TRANSFER)
  - OrgChangeHistory 레코드 생성 후 plan.status = 'applied'

### TypeScript 수정 사항
- `snapshotDateStr ?? ''` — undefined → string 타입 안전 처리
- `z.record(z.string(), z.unknown())` — Zod v4 breaking change 대응 (2개 파일)

### 신규/수정 파일 목록
| 파일 | 변경 |
|------|------|
| `prisma/schema.prisma` | OrgRestructurePlan 모델 추가, Company 역참조 |
| `src/app/(dashboard)/org/OrgClient.tsx` | 전면 재작성 (3 뷰모드 + EffectiveDatePicker + 검색) |
| `src/components/org/RestructureModal.tsx` | 신규 |
| `src/components/org/RestructureDiffView.tsx` | 신규 |
| `src/app/api/v1/org/restructure-plans/route.ts` | 신규 |
| `src/app/api/v1/org/restructure-plans/[id]/route.ts` | 신규 |
| `src/app/api/v1/org/restructure-plans/[id]/apply/route.ts` | 신규 |

---

# Track B — LMS Lite (B9-1) 완료 보고

> 완료일: 2026-03-02
> 세션 수: 2 sessions (B9-1 LMS Lite)
> 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ Compiled successfully

---

## B9-1 구현 완료 항목

### Task 1: Prisma 스키마 확장 + Migration
- `TrainingCourse` — format, linkedCompetencyIds, expectedLevelGain, provider 필드 추가
- `MandatoryTrainingConfig` — targetGroup, frequency, deadlineMonth, isActive
- `TrainingEnrollment` — source(manual/mandatory_auto/system), score, expiresAt 추가
- `EmployeeSkillAssessment` — competencyId, currentLevel, assessedById, notes
- `EnrollmentStatus` enum: FAILED, EXPIRED 추가
- Migration: `b_b9_lms_lite` 적용

### Task 2: API Routes (6개)
- `GET/POST /api/v1/training/mandatory-config` — 법정 의무교육 설정 CRUD
- `PATCH/DELETE /api/v1/training/mandatory-config/[id]` — 개별 설정 수정/삭제
- `POST /api/v1/training/mandatory-config/enroll` — 연간 자동 등록 (HR Admin 트리거)
- `GET /api/v1/training/mandatory-status` — 법정 의무교육 이수율 현황 집계
- `GET /api/v1/training/recommendations` — 스킬 갭 기반 과정 추천
- `GET /api/v1/training/my` — 내 교육 현황 (미이수+추천+이력+만료임박)
- `GET/POST /api/v1/training/skill-assessments` — 역량 평가 등록/조회

### Task 3: 법정 의무교육 자동 등록
- targetGroup 필터: all / manager(employeeRoles 기반) / new_hire(1년 미만) / production
- 유효한 이수이력 있으면 스킵, 중복 등록 방지(unique constraint 확인)
- deadlineMonth 기반 expiresAt 자동 계산
- source='mandatory_auto' 태깅

### Task 4: 스킬 갭 기반 추천
- CompetencyRequirement.expectedLevel vs EmployeeSkillAssessment.currentLevel 비교
- gap > 0인 역량의 linkedCompetencyIds 매핑으로 과정 필터링
- 추천 이유: 역량명 + gap 레벨 함께 반환

### Task 5: `/my/training` 직원 뷰 UI
- `src/app/(dashboard)/my/training/page.tsx` — Server component
- `src/app/(dashboard)/my/training/MyTrainingClient.tsx` — Client component
  - 만료 임박 알림 배너
  - KPI 카드 4개 (필수 미이수, 이수 완료, 추천, 이수율)
  - 탭: 필수 미이수 | 직무 필수 | 추천 과정 | 이수 이력

### Task 6: `/training` HR 관리 UI 강화
- `TrainingClient.tsx` — "법정 의무교육" 탭 추가 (ShieldCheck 아이콘)
- `src/components/training/MandatoryConfigTab.tsx`
  - 이수율 현황 대시보드 (progress bars)
  - 법정 의무교육 설정 CRUD 테이블
  - 자동 등록 트리거 버튼

### Task 7: 시드 데이터
- 법정 의무교육 3개: LEG-001(산업안전보건), LEG-002(성희롱예방), LEG-003(개인정보보호)
- 직무 필수 5개: JOB-001~005 (리더십, 품질관리, 온보딩, 용접안전, HR담당자)
- 자기개발 4개: DEV-001~004 (데이터분석, 글로벌커뮤니케이션, PLC, 코칭)
- MandatoryTrainingConfig 6개 (LEG-001~003 × all/manager)

### Task 8: tsc + build 검증 ✅
- 수정 사항:
  - `mandatory-config/[id]/route.ts`: `RouteContext` 커스텀 타입 → 인라인 `context: { params: Promise<Record<string, string>> }` 패턴으로 교체
  - `mandatory-config/enroll/route.ts`: `roles` → `employeeRoles` (Employee 모델 실제 관계명)

---

## 생성된 파일 목록 (B9-1)

### API Routes
```
src/app/api/v1/training/mandatory-config/route.ts
src/app/api/v1/training/mandatory-config/[id]/route.ts
src/app/api/v1/training/mandatory-config/enroll/route.ts
src/app/api/v1/training/mandatory-status/route.ts
src/app/api/v1/training/recommendations/route.ts
src/app/api/v1/training/my/route.ts
src/app/api/v1/training/skill-assessments/route.ts
```

### Pages & Components
```
src/app/(dashboard)/my/training/page.tsx
src/app/(dashboard)/my/training/MyTrainingClient.tsx
src/components/training/MandatoryConfigTab.tsx
```

### 수정된 파일
```
src/app/(dashboard)/training/TrainingClient.tsx  (법정 의무교육 탭 추가)
prisma/seed.ts                                   (B9-1 교육 데이터 추가)
prisma/schema.prisma                             (스키마 확장)
```

---

# Track B — ATS Enhancement (B4) 완료 보고

> 완료일: 2026-03-02
> 세션 수: 3 sessions (B4 ATS Enhancement)
> 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ Compiled successfully

---

## B4 구현 완료 항목

### Task 1: AI 스크리닝 API (`/api/v1/recruitment/applicants/[id]/ai-screen`)
- Claude API 연동 (aiScreeningScore, aiScreeningSummary 저장)
- Application.stage → SCREENING 자동 전환
- perm(RECRUITMENT, ACTION.UPDATE)

### Task 2: 면접 일정 관리 (`/api/v1/recruitment/postings/[id]/interviews`)
- InterviewSchedule CRUD
- GET(목록) + POST(생성) 구현

### Task 3: 오퍼 관리 (`/api/v1/recruitment/applications/[id]/offer`)
- GET(오퍼 조회) + POST(오퍼 생성/업데이트)
- OfferStatus: DRAFT / SENT / ACCEPTED / DECLINED / EXPIRED

### Task 4: 내부 공고 (`/api/v1/recruitment/internal-jobs`)
- GET(목록) + GET([id]) + POST([id]/apply)
- 내부 지원자 → Application 생성

### Task 5: 채용 요청 결재 (`/api/v1/recruitment/requisitions`)
- GET(목록) + POST(생성) + GET/PATCH([id]) + POST([id]/approve)
- ApprovalRecord 다중 결재 단계 지원
- draft 상태에서만 수정 가능

### Task 6: 후보자 히스토리 타임라인
- API: `GET /api/v1/recruitment/applicants/[id]/timeline`
- 컴포넌트: `src/components/recruitment/CandidateTimeline.tsx`
- 지원→스크리닝→면접→결과 이벤트 시계열 구성
- Talent Pool 등록 이벤트 포함

### Task 7: 중복 감지 (`/api/v1/recruitment/applicants/check-duplicate`)
- 3-tier: email(1.0) > phone(0.9) > name+birthDate(0.7)
- 컴포넌트: `src/components/recruitment/DuplicateWarningModal.tsx`
- 지원 등록 전 중복 확인 UI

### Task 8: A2 Position 연결 강화 (공석 현황 대시보드)
- API: `GET /api/v1/recruitment/positions/vacancies`
- isFilled=false 포지션 목록 + 법인별 집계
- 평균 채용 소요일(HIRED 기준) + 최근 30일 채용 완료 수
- SUPER_ADMIN: 전체 법인 / 일반: 소속 법인만

### Task 9: tsc + build 검증 ✅
- 수정 사항 목록:
  - `Application.createdAt` → `appliedAt` (check-duplicate Tier1/2/3, talent-pool, timeline, vacancies)
  - `Employee.profilePhotoUrl` → `photoUrl` (requisitions/[id])
  - `InterviewSchedule.overallScore` 제거 (timeline — 해당 필드는 InterviewEvaluation에 있음)
  - `return handlePrismaError(err)` → `throw handlePrismaError(err)` (6개 라우트)
  - `CandidateTimeline.tsx`: `@/lib/api-client` → `@/lib/api`
  - `apiClient.get().then(setData)` → `.then(res => setData(res.data ?? null))`
  - `buildPagination(total, page, limit)` → `(page, limit, total)` (올바른 인자 순서)
  - `return badRequest/notFound` → `throw badRequest/notFound` (AppError는 throw 해야 함)
  - `npx prisma generate` 실행 (Applicant relations 타입 재생성)

---

## 생성된 파일 목록 (B4)

### API Routes
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
```

### Components
```
src/components/recruitment/CandidateTimeline.tsx
src/components/recruitment/DuplicateWarningModal.tsx
```

---

## 주요 패턴 확립 (B4)

### AppError 패턴
```ts
// ❌ 잘못됨 (return type 오염)
return badRequest('message')
return notFound('message')
return handlePrismaError(err)

// ✅ 올바름
throw badRequest('message')
throw notFound('message')
throw handlePrismaError(err)
```

### Application 날짜 필드
```ts
// Application 모델은 createdAt이 없음
// ✅ 올바름
orderBy: { appliedAt: 'desc' }
select: { appliedAt: true }
app.appliedAt.getTime()
```

### apiClient 응답 처리
```ts
// apiClient.get<T>() returns ApiResponse<T>, not T
apiClient.get<T>(url).then(res => setData(res.data ?? null))
```

---

## 다음 세션: B5 (온보딩 강화)

---

# Track B — 온보딩/오프보딩 고도화 (B5) 완료 보고

> 완료일: 2026-03-02
> 세션 수: 2 sessions (컨텍스트 초과로 분할)
> 검증: `tsc --noEmit` ✅ 0 errors

---

## B5 구현 완료 항목

### Task 1: DB Migration — 모델 확장 + 크로스보딩 지원
- `OnboardingPlan.planType` 필드 추가 enum: `ONBOARDING / OFFBOARDING / CROSSBOARDING_DEPARTURE / CROSSBOARDING_ARRIVAL`
- `OnboardingCheckin.mood` 필드 추가 enum: `GREAT / GOOD / NEUTRAL / STRUGGLING / BAD`
- `ExitInterview` 필드 추가: `detailedReason`, `satisfactionDetail` (JSON), `suggestions`, `isConfidential`
- `CrossboardingRecord` 모델 신규 생성

### Task 2: Company-specific Seed Data
- CTR-KR, CTR-US 온보딩 체크리스트 시드
- 오프보딩/크로스보딩 플랜 타입별 시드 데이터

### Task 3: Cross-boarding API + triggerCrossboarding()
- `POST /api/v1/onboarding/crossboarding` — 크로스보딩 트리거
- `src/lib/crossboarding.ts` — `triggerCrossboarding()` 헬퍼 함수
  - 출발 법인: CROSSBOARDING_DEPARTURE 플랜 시작
  - 도착 법인: CROSSBOARDING_ARRIVAL 플랜 시작 (transferDate 기준)

### Task 4: 온보딩 대시보드 강화
- Plan Type 탭 추가 (전체 / 온보딩 / 오프보딩 / 크로스보딩 출발 / 도착)
- SUPER_ADMIN 법인 필터 드롭다운 추가
- 감정 펄스(emotion pulse) 컬럼 추가 — 최근 체크인 무드 아이콘 표시
- `onboarding/page.tsx` Server Component → companies prop 전달

### Task 5: 오프보딩 대시보드 강화
- `offboarding/dashboard/route.ts` — company filter WHERE 절 수정 (spread 패턴)
- `OffboardingDashboardClient.tsx` — SUPER_ADMIN 법인 필터 드롭다운 추가
- `offboarding/page.tsx` — companies prop 전달

### Task 6: 퇴직 면담 상세 만족도 폼
- API (`/api/v1/offboarding/[id]/exit-interview`):
  - `satisfactionDetailSchema` Zod 추가 (compensation, culture, management, growth 1~5)
  - 신규 필드 검증 및 DB 저장
- `OffboardingDetailClient.tsx` — 퇴직 면담 폼 확장:
  - `detailedReason` 텍스트영역
  - 카테고리별 만족도 별점 (5개 항목)
  - `suggestions` 텍스트영역
  - `isConfidential` 토글
  - 결과 표시 영역에 신규 필드 렌더링

### Task 7: tsc + build 검증 ✅
- 수정 사항:
  - `crossboarding/route.ts`: `parsed.error.errors` → `parsed.error.issues` (Zod v4 패턴)

---

## 생성/수정된 파일 목록 (B5)

### 신규 생성
```
src/app/api/v1/onboarding/crossboarding/route.ts
src/lib/crossboarding.ts
```

### 수정
```
prisma/schema.prisma                                    — CrossboardingRecord, OnboardingPlan.planType, 신규 필드
prisma/seed.ts                                          — B5 시드 데이터
src/app/(dashboard)/onboarding/OnboardingDashboardClient.tsx  — Plan Type 탭 + 법인 필터 + 감정 펄스
src/app/(dashboard)/onboarding/page.tsx                 — companies prop 전달
src/app/(dashboard)/offboarding/OffboardingDashboardClient.tsx — 법인 필터 드롭다운
src/app/(dashboard)/offboarding/page.tsx                — companies prop 전달
src/app/(dashboard)/offboarding/[id]/OffboardingDetailClient.tsx — 상세 퇴직면담 폼
src/app/api/v1/offboarding/dashboard/route.ts           — WHERE 절 수정
src/app/api/v1/offboarding/[id]/exit-interview/route.ts — satisfactionDetailSchema 추가
```

---

## 주요 패턴 확립 (B5)

### Zod `.issues` vs `.errors`
```ts
// ✅ Zod v3+ 표준
parsed.error.issues.map((e) => e.message)

// ❌ 구버전 (TS 오류 발생)
parsed.error.errors.map((e) => e.message)
```

### Server Component → Client Component companies prop 패턴
```ts
// page.tsx (Server)
const companies = user.role === ROLE.SUPER_ADMIN
  ? await prisma.company.findMany({ select: { id, code, name }, orderBy: { code: 'asc' } })
  : []
return <XxxDashboardClient user={user} companies={companies} />

// Client Component
const isSuperAdmin = user.role === 'SUPER_ADMIN'
{isSuperAdmin && companies.length > 0 && (
  <Select ...> {/* 법인 필터 드롭다운 */} </Select>
)}
```

### Offboarding WHERE 절 — companyId 조건부 spread
```ts
const where: Prisma.EmployeeOffboardingWhereInput = {
  ...(status ? { status } : { status: { in: ['IN_PROGRESS', 'COMPLETED'] } }),
  ...(companyId
    ? { employee: { assignments: { some: { companyId, isPrimary: true, endDate: null } } } }
    : {}),
}
```

---

## B6-1 세션 완료: 근태 고도화 (교대+유연+52시간)

**날짜**: 2026-03-02
**상태**: ✅ 완료 (tsc clean + build 통과)

### 구현 내용

#### DB/Prisma
- `AttendanceSetting` 확장: `alertThresholds`, `enableBlocking`, `timezone` 필드 추가
- `WorkHourAlert` 신규 모델: `employeeId_weekStart_alertLevel` 복합 유니크 키
- Migration: `b_b6_attendance` 적용 완료

#### 신규 파일
| 파일 | 설명 |
|------|------|
| `src/lib/attendance/workTypeEngine.ts` | 근무유형별 엔진 (FIXED/FLEXIBLE/SHIFT/REMOTE) |
| `src/lib/attendance/workHourAlert.ts` | 52시간 경고 체커 + DB upsert |
| `src/app/api/v1/settings/attendance/route.ts` | GET/PUT 근태 설정 API |
| `src/app/api/v1/attendance/work-hour-alerts/route.ts` | GET 법인 경고 목록 |
| `src/app/api/v1/attendance/work-hour-alerts/[id]/route.ts` | PATCH 경고 해제 |
| `src/app/api/v1/attendance/employees/[id]/route.ts` | GET 직원별 근태 기록 목록 |
| `src/app/(dashboard)/settings/attendance/page.tsx` | 근태 설정 페이지 |
| `src/app/(dashboard)/settings/attendance/AttendanceSettingsClient.tsx` | 3탭 설정 UI |
| `src/components/employees/tabs/AttendanceTab.tsx` | 직원 프로필 근태 탭 |

#### 수정 파일
| 파일 | 변경사항 |
|------|---------|
| `src/app/api/v1/attendance/clock-out/route.ts` | checkWorkHourAlert 연동, 응답에 weeklyHours/alertLevel/isBlocked 추가 |
| `src/app/(dashboard)/attendance/admin/AttendanceAdminClient.tsx` | 52시간 위젯 + 경고 해제 기능 |
| `src/app/(dashboard)/employees/[id]/EmployeeDetailClient.tsx` | 근태 탭 comingSoon → AttendanceTab 교체 |
| `src/lib/api.ts` | ApiClient에 `patch()` 메서드 추가 |

### 52시간 경고 체계
- **주의** (44h+): 노란 배너
- **경고** (48h+): 주황 배너
- **차단** (52h+): 빨간 배너 + KPI 카드 경고색
- HR Admin 대시보드에서 경고 해제 가능 (resolveNote 선택 입력)

### 다음 세션: B7 (급여 처리 강화)

---

## 다음 세션: B7 (급여 처리 강화) → 완료

---

# Track B — People Directory + Self-Service (B8-2) 완료 보고

> 완료일: 2026-03-03
> 세션 수: 2 sessions (컨텍스트 초과로 분할)
> 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ Compiled successfully

---

## B8-2 구현 완료 항목

### Task 1: DB Migration
- `ProfileVisibility` 모델: 개인정보 공개 범위 설정 (4-level: public/team/manager/private)
  - 필드: personalPhone, personalEmail, birthDate, address, emergencyContact, bio, skills
- `EmployeeProfileExtension` 확장: avatarPath 필드 추가
- `ProfileChangeRequest` 확장: reason(변경 사유), documentPath(증빙 서류 경로) 필드 추가
- Migration: `b_b8_2_people_dir_self_service` 적용

### Task 2: People Directory `/directory`
- API: `GET /api/v1/directory` — 검색/필터/페이지네이션 + ProfileVisibility 기반 컬럼 마스킹
- `src/app/(dashboard)/directory/DirectoryClient.tsx` — 카드뷰/테이블뷰 토글, 필터, 키워드 검색

### Task 3: Self-Service `/my/profile`
- 4개 API: profile-extension GET/PUT, emergency-contacts GET/POST/DELETE, visibility GET/PUT
- `MyProfileClient.tsx` — 4탭: 기본정보 / 연락처(변경요청) / 비상연락처 / 공개설정

### Task 4: Avatar Upload (S3)
- `POST /api/v1/employees/me/avatar` — S3 Presigned URL 생성 (avatars/{employeeId}/{ts}.{ext})

### Task 5: Profile Change Request + HR Approval
- ALLOWED_FIELDS: phone, emergencyContact, emergencyContactPhone, name
- reason + documentPath 필드 추가; review route에 name 필드 지원 추가

### Task 6: My Space Dashboard `/my`
- `MySpaceClient.tsx` — 프로필 요약, KPI 4개, 바로가기 6개, 휴가 잔여 현황

### Task 7: Navigation Updates
- my-space-home (`/my`), people-directory (`/directory`) 추가
- my-profile href: `/employees/me` → `/my/profile`

### Task 8: TypeScript 수정 사항
- `useDebounce.ts` 신규 생성
- `z.unknown()` → `z.any()` (Prisma InputJsonValue 호환)
- SessionUser 타입 캐스트, ecForm 캐스트 수정
- LeaveBalance 인터페이스 → grantedDays/usedDays/policy 구조로 업데이트

---

## EmployeeLeaveBalance 접근 패턴 (확정)

```ts
prisma.employeeLeaveBalance.findMany({
  where: { employeeId },
  include: { policy: { select: { name: true, leaveType: true } } },
})
// lb.grantedDays, lb.usedDays (Decimal), lb.policy.name, lb.policy.leaveType
const remaining = Number(lb.grantedDays) - Number(lb.usedDays)
```

---

## 신규 파일 목록 (B8-2)
```
src/hooks/useDebounce.ts
src/app/api/v1/directory/route.ts
src/app/api/v1/employees/me/profile-extension/route.ts
src/app/api/v1/employees/me/emergency-contacts/route.ts
src/app/api/v1/employees/me/emergency-contacts/[id]/route.ts
src/app/api/v1/employees/me/visibility/route.ts
src/app/api/v1/employees/me/avatar/route.ts
src/app/(dashboard)/directory/page.tsx + DirectoryClient.tsx
src/app/(dashboard)/my/page.tsx + MySpaceClient.tsx
src/app/(dashboard)/my/profile/page.tsx + MyProfileClient.tsx
```

---

# Track B — 스킬 매트릭스 + 갭 분석 (B8-3) 완료 보고

> 완료일: 2026-03-03
> 세션 수: 2 sessions (컨텍스트 초과로 분할)
> 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ Compiled successfully

---

## B8-3 구현 완료 항목

### Task 1: Prisma 스키마 확장 + Migration
- `EmployeeSkillAssessment` 확장 (B9-1에서 추가된 모델):
  - 신규 필드: `selfLevel`, `managerLevel`, `finalLevel`, `expectedLevel` (Int?), `managerComment`
  - 기존 `currentLevel` 유지, `assessmentPeriod` 유니크 키 추가
- `SkillGapReport` 신규 모델:
  - 필드: id, companyId, departmentId?, assessmentPeriod, reportData(Json), generatedBy, createdAt
- `CompetencyRequirement` 신규 모델:
  - 필드: id, competencyId, companyId?, jobLevelCode, expectedLevel, createdAt
  - 복합 유니크: `competencyId_companyId_jobLevelCode`
- Migration: `b_b8_3_skill_matrix` 적용 완료

### Task 2: API Routes (5개)
- `GET /api/v1/skills/self-assessment` — 내 역량 자기평가 현황 (expectedLevel 포함)
- `POST /api/v1/skills/self-assessment` — 자기평가 upsert (bulk)
- `GET /api/v1/skills/team-assessments` — 팀원 목록 + 역량 현황 (매니저용)
- `POST /api/v1/skills/team-assessments` — 매니저 역량 평가 (단건 + 일괄)
- `GET /api/v1/skills/matrix` — 스킬 매트릭스 히트맵 데이터 (부서/법인)
- `GET /api/v1/skills/radar` — 개인 역량 레이더 차트 데이터
- `GET /api/v1/skills/gap-report` — 법인/부서별 스킬 갭 집계
- `POST /api/v1/skills/gap-report` — 갭 리포트 스냅샷 저장

### Task 3: `/my/skills` 자기평가 UI
- `src/app/(dashboard)/my/skills/page.tsx` — Server component (EMPLOYEE 이상 접근)
- `src/app/(dashboard)/my/skills/MySkillsClient.tsx` — 자기평가 폼
  - 카테고리 그룹핑 + 1~5 레벨 선택 버튼
  - 기대 레벨 표시 + GAP 뱃지 (미달/부족/충족/초과)
  - 전체 저장 버튼

### Task 4: `/team/skills` 매니저 평가 UI
- `src/app/(dashboard)/team/skills/page.tsx` — Server component (MANAGER 이상 접근)
- `src/app/(dashboard)/team/skills/TeamSkillsClient.tsx` — 팀원별 역량 평가
  - 팀원 탭 네비게이션 (저장 완료 체크마크)
  - 자기평가 참고 표시 (주황 닷)
  - 이전/다음 네비게이션 + 저장 버튼

### Task 5: `/organization/skill-matrix` 히트맵 + 레이더 차트
- `src/app/(dashboard)/organization/skill-matrix/page.tsx` — Server component (HR_ADMIN 이상)
- `src/app/(dashboard)/organization/skill-matrix/SkillMatrixClient.tsx`
  - 3탭: 개인 매트릭스 | 부서 히트맵 | 갭 리포트
  - 히트맵: 역량×직원 그리드, 상태별 색상 (critical/below/meets/exceeds/expert/unassessed)
  - 레이더 차트 모달: Recharts RadarChart (클릭 시 개인 역량 레이더 표시)
  - 부서 히트맵: 부서×역량 평균 갭
  - 갭 리포트: Top5 갭/강점, 역량별 평가율, 부서별 히트맵

### Task 6: 시드 데이터
- CompetencyRequirement: G3~G6 직급별 기대레벨 (핵심가치 + 기술역량 5종)
- CTR-KR MFG 직원 6명 (김현식/이태준/박재홍/최민준/정수현/홍기영)
- EmployeeSkillAssessment 54건 (period: 2026-H1)
- 시나리오: PLC 프로그래밍 큰 갭, 도전 가치 강점

### Task 7: TypeScript 수정 사항
- `SkillMatrixClient.tsx`: `apiClient.get<T>().then(setData)` → `.then(res => setData(res.data))`
- `TeamSkillsClient.tsx`: 동일 패턴 수정
- `matrix/route.ts`, `radar/route.ts`, `team-assessments/route.ts`: `Employee.avatarPath` 제거 (Prisma 타입 미존재)
- `team-assessments/route.ts`: 중복 `id` 프로퍼티 → `AND: [...]` 배열로 통합
- `training/skill-assessments/route.ts`: `a.currentLevel ?? 0` null 안전 처리

---

## 신규 파일 목록 (B8-3)

### API Routes
```
src/app/api/v1/skills/self-assessment/route.ts
src/app/api/v1/skills/team-assessments/route.ts
src/app/api/v1/skills/matrix/route.ts
src/app/api/v1/skills/radar/route.ts
src/app/api/v1/skills/gap-report/route.ts
```

### Pages & Clients
```
src/app/(dashboard)/my/skills/page.tsx
src/app/(dashboard)/my/skills/MySkillsClient.tsx
src/app/(dashboard)/team/skills/page.tsx
src/app/(dashboard)/team/skills/TeamSkillsClient.tsx
src/app/(dashboard)/organization/skill-matrix/page.tsx
src/app/(dashboard)/organization/skill-matrix/SkillMatrixClient.tsx
```

### 수정된 파일
```
prisma/schema.prisma                  — CompetencyRequirement, SkillGapReport 추가, EmployeeSkillAssessment 확장
prisma/seed.ts                        — B8-3 시드 데이터 추가 (CompetencyRequirements + 6 MFG employees + 54 assessments)
src/config/navigation.ts              — 스킬 관련 메뉴 추가 (/my/skills, /team/skills, /organization/skill-matrix)
src/app/api/v1/training/skill-assessments/route.ts  — currentLevel null 안전 처리
```

---

## 주요 패턴 확립 (B8-3)

### 스킬 갭 계산
```ts
gap = expectedLevel - finalLevel
// gap > 0: 미달 (needs improvement)
// gap < 0: 강점 (exceeds expectation)
// gap === 0: 충족 (meets expectation)
```

### CompetencyRequirement 키 패턴
```ts
// reqMap key: `${competencyId}_${jobLevelCode}`
// jobLevelCode는 EmployeeAssignment.jobGrade.code 사용 (G3~G6)
const reqMap = new Map(requirements.map((r) => [`${r.competencyId}_${r.jobLevelCode ?? ''}`, r.expectedLevel]))
const expectedLevel = reqMap.get(`${c.id}_${grade}`) ?? null
```

### apiClient 언래핑 패턴
```ts
// apiClient.get<T>() returns ApiResponse<T> = { data: T }
// ✅ 올바른 사용
const res = await apiClient.get<MyType>(url)
setData(res.data)

// ❌ 틀린 사용
setData(res) // type error: ApiResponse<T> is not T
```
