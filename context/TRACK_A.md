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
