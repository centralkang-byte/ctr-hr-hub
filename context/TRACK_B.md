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

## 다음 세션: B6 (근태 관리 강화)
