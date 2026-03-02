# B3-1: Competency Framework + 법인별 리뷰 설정 — 설계 문서

> 작성일: 2026-03-02
> 트랙: A (TRACK_A.md에만 기록)
> 스택: Next.js (App Router) + Prisma ORM + PostgreSQL

---

## 1. 컨텍스트 요약

### 현황
- 기존 `CompetencyLibrary` 테이블: flat 구조 (JSONB로 행동지표 저장) — **유지**
- 기존 `/settings/competencies` 페이지: 구 모델 기반 `CompetencyListClient.tsx` — **새 UI로 교체**
- 기존 매니저 평가폼: 숫자 1~5 점수 방식 — **O/E/M/S 등급 선택으로 전환**
- `EvaluationSetting` (B1): `mboGrades`, `beiGrades` JSON 배열 — **타입 이미 정의됨**
- B4 완료, B5가 다음 B트랙 — DB 충돌 없음

### 설계 결정
1. 기존 `CompetencyLibrary` 병행 유지 (InterviewEvaluation 참조 보존)
2. 신규 5개 테이블: BEI 평가는 새 테이블 기반으로 동작
3. `PerformanceEvaluation`에 `performanceGrade`, `competencyGrade` (String?) 추가
4. 등급 버튼은 `evaluation_settings.mboGrades`/`beiGrades`에서 동적 렌더링

---

## 2. DB 변경사항

### 신규 테이블 5개

```prisma
// competency_categories
model CompetencyCategory {
  code         String @unique  // 'core_value', 'leadership', 'technical'
  name         String
  displayOrder Int
  isActive     Boolean
  competencies Competency[]
}

// competencies
model Competency {
  categoryId   String (FK)
  code         String          // 'challenge', 'trust'
  name         String          // '도전'
  nameEn       String?
  displayOrder Int
  levels       CompetencyLevel[]
  indicators   CompetencyIndicator[]
  requirements CompetencyRequirement[]
}

// competency_levels
model CompetencyLevel {
  competencyId String (FK)
  level        Int             // 1~5
  label        String          // '기초', '보통'
  description  String?
}

// competency_indicators
model CompetencyIndicator {
  competencyId    String (FK)
  indicatorText   String      // "새로운 방법을 시도하며..."
  indicatorTextEn String?
  displayOrder    Int
  isActive        Boolean
}

// competency_requirements
model CompetencyRequirement {
  competencyId String (FK)
  jobId        String?         // NULL = 전 직무 공통
  jobLevelCode String?         // 직급 코드
  expectedLevel Int            // 기대 숙련도 레벨
  companyId    String?         // NULL = 전 법인 공통
}
```

### 기존 테이블 변경
```
PerformanceEvaluation:
  + performanceGrade String?  // 'O', 'E', 'M', 'S'
  + competencyGrade  String?  // 'O', 'E', 'M', 'S'
```

### migrate 이름
`a_b3_competency_framework`

---

## 3. 시드 데이터

### 핵심가치 역량 (core_value)
- 도전(Challenge) × 4개 지표
- 신뢰(Trust) × 3개 지표
- 책임(Responsibility) × 3개 지표
- 존중(Respect) × 3개 지표
→ 합계 13개

### 리더십 역량 (leadership) — 3개
- 전략적 사고, 팀 빌딩, 의사결정

### 직무 전문 역량 (technical) — 5개
- 용접 기술, 품질 관리, 금형 설계, 사출성형, PLC 프로그래밍

### 숙련도 레벨 공통 5단계
- 1:기초, 2:보통, 3:우수, 4:탁월, 5:전문가

### competency_requirements (직급별 기대)
- 핵심가치 4개 × S1~S4 = 16개 (companyId NULL)
- 리더십 3개 × S3~S4 = 6개

---

## 4. API 엔드포인트

### 신규 API
```
GET  /api/v1/competencies                  → 카테고리별 역량 목록
POST /api/v1/competencies                  → 역량 생성
GET  /api/v1/competencies/[id]             → 역량 상세
PUT  /api/v1/competencies/[id]             → 역량 수정
DEL  /api/v1/competencies/[id]             → 역량 삭제

GET  /api/v1/competencies/[id]/indicators  → 행동지표 목록
PUT  /api/v1/competencies/[id]/indicators  → 행동지표 전체 교체 (bulk upsert)

GET  /api/v1/competencies/[id]/levels      → 숙련도 레벨 목록
PUT  /api/v1/competencies/[id]/levels      → 숙련도 레벨 전체 교체
```

### 수정 API
```
GET  /api/v1/performance/evaluations/manager  → mboGrades/beiGrades 포함
POST /api/v1/performance/evaluations/manager  → performanceGrade/competencyGrade 받기
```

---

## 5. UI 컴포넌트

### `/settings/competencies`
- `CompetencyLibraryAdmin` (기존 `CompetencyListClient.tsx` 교체)
  - 카테고리 탭 (핵심가치 / 리더십 / 직무전문)
  - 역량 카드 목록 (CRUD)
  - 사이드패널: 상세/편집

### 서브 컴포넌트 (신규)
- `IndicatorEditor` — 행동지표 추가/삭제/순서변경
- `CompetencyLevelEditor` — 숙련도 레벨 편집

### `/performance/manager-eval`
- `DynamicEvalForm` (기존 ManagerEvalClient 내부에 삽입)
  - `evaluation_settings.methodology === 'MBO_BEI'`일 때 BEI 섹션 표시
  - BEI 섹션: `competency_indicators`에서 핵심가치 지표 로드
  - 등급 버튼: `mboGrades`/`beiGrades`에서 동적 렌더링

---

## 6. 타입 안전성

`types/settings.ts`의 기존 `EvaluationSettings` 인터페이스 재사용:
```typescript
interface EvaluationSettings {
  methodology: 'MBO_ONLY' | 'MBO_BEI'
  mboGrades: GradeItem[]      // [{code, label, order}]
  beiGrades: GradeItem[]
  overallGradeEnabled: boolean
  mboWeight: number
  beiWeight: number
}
```

행동지표 스냅샷: `competencyDetail` JSONB에 제출 시점 지표 스냅샷 저장 (기존 필드 활용).

---

## 7. 주의사항

1. BEI 스냅샷: 제출 시 `competencyDetail`에 `{ indicators: [...], gradeCode: string }` 형태로 저장
2. `competency_requirements.expectedLevel`은 B8-3 스킬 갭 분석의 핵심 의존성 — 스키마 변경 금지
3. migrate 이름 `a_` 접두사 필수
4. `CompetencyLibrary` 구 테이블 유지 — InterviewEvaluation.competencyLibraryId 참조 있을 수 있음
