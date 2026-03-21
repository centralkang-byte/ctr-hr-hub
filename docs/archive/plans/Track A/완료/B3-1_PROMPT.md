# B3-1: 역량 프레임워크 + 법인별 리뷰 설정

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A + B1(법인 엔진) 완료. STEP 6A(기존 성과관리 MBO+CFR+BEI+캘리브레이션) 존재.
> **트랙**: **[A] 트랙** — context/TRACK_A.md에만 기록

### DB 접근 규칙 (전 세션 공통)

- 모든 테이블 생성/변경은 `prisma/schema.prisma` → `prisma migrate dev`
- 쿼리는 Prisma Client 사용
- Supabase는 Auth + Storage + Realtime 용도만

---

## 컨텍스트 파일 규칙 (병렬 개발)

```bash
# 읽기: 3개 파일 모두 읽으세요
cat context/SHARED.md       # 공유 인프라 상태 확인
cat context/TRACK_A.md      # 이전 A 트랙 작업 확인
cat context/TRACK_B.md      # B 트랙이 뭘 하고 있는지 참고

# 쓰기: TRACK_A.md에만 기록하세요
# ❌ SHARED.md 수정 금지
# ❌ TRACK_B.md 수정 금지

# migrate 이름 규칙: a_ 접두사 사용
npx prisma migrate dev --name a_b3_competency_framework
```

---

## 세션 목표

CTR Value System 2.0(도전/신뢰/책임/존중)의 13개 행동지표를 체계적으로 관리하는 **Competency Framework(역량 라이브러리)**를 구축하고, B1에서 만든 법인별 평가 설정(`evaluation_settings`)이 **실제 성과관리 화면에서 동작**하도록 연결합니다.

이 세션은 **DB가 무거운(5개 테이블) + Admin UI** 작업이고, B3-2(Talent Review + AI)의 기반입니다.

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. 컨텍스트 파일 3개 읽기
cat context/SHARED.md
cat context/TRACK_A.md
cat context/TRACK_B.md

# 2. B1 evaluation_settings 구조 확인
# grade_scales.performance / grade_scales.competency / grade_scales.overall
# forced_distribution 설정
# 법인별 오버라이드 레코드 존재 여부

# 3. STEP 6A 기존 성과관리 코드 위치 확인
# 평가 폼, MBO 목표 관리, BEI 평가, 캘리브레이션 9-Block
# 어떤 라우트(/evaluations, /performance 등)에 있는지

# 4. B1의 getCompanySettings() 헬퍼 임포트 경로 확인

# 5. 기존 BEI 평가 구조 확인
# 현재 행동지표가 하드코딩되어 있는지, DB에 있는지
# 하드코딩이면 이번 세션에서 DB로 마이그레이션 필요

# 6. [B] 트랙 상태 확인 — TRACK_B.md에서 DB 변경사항 확인
# B 트랙이 migrate를 실행했다면 먼저 pull 후 시작
npx prisma db pull  # 필요 시
```

### ⚠️ STEP 6A에서 잘못됐을 수 있는 부분

1. **BEI 행동지표 하드코딩** — STEP 6A에서 CTR 4대 핵심가치의 행동지표를 코드에 직접 박아넣었을 가능성 높음. 이번 세션에서 DB로 이관하여 Admin이 편집 가능하게 변경.

2. **평가 등급이 고정** — STEP 6A에서 S/A/B/C 4등급을 하드코딩했을 수 있음. B1 `evaluation_settings.grade_scales`를 참조하도록 동적 렌더링으로 교체.

3. **법인 구분 없는 단일 평가 폼** — STEP 6A가 한국 기준으로만 만들어져 있을 수 있음. 법인에 따라 MBO만/MBO+BEI 병행을 분기해야 함.

---

## 핵심 설계 원칙

### 1. Competency Framework 3계층 구조

```
역량 프레임워크 (전체)
├── 핵심가치 역량 (CTR Value System) ← BEI 평가 대상
│   ├── 도전(Challenge) → 행동지표 3~4개 (Admin 편집 가능)
│   ├── 신뢰(Trust) → 행동지표 3~4개
│   ├── 책임(Responsibility) → 행동지표 3~4개
│   └── 존중(Respect) → 행동지표 3~4개
├── 리더십 역량 ← 승진 / Talent Review 참고
│   ├── 전략적 사고
│   ├── 팀 빌딩
│   └── ...
└── 직무 전문 역량 ← 채용 / 스킬 매트릭스 참고
    ├── 용접 기술
    ├── 품질 관리
    └── ...
```

### 2. BEI = 역량 프레임워크의 "핵심가치" 카테고리 필터

BEI 평가는 별도 시스템이 아니라, 역량 프레임워크에서 `category = 'core_value'`인 항목만 필터하여 평가하는 것입니다. 이렇게 하면:
- BEI 기준이 변경되어도 Admin이 역량 라이브러리에서 수정하면 평가 폼에 자동 반영
- 채용 면접 질문 생성에도 동일 프레임워크 활용 가능 (B4)
- 스킬 매트릭스(B8-3)와 데이터 구조 통일

### 3. 숙련도 레벨 = 직급 연동

직급별로 기대 수준이 다릅니다. 법인별 직급체계가 다르므로 기대레벨도 법인별로 달라질 수 있습니다.

```
예시 — "리더십" 역량:
- S1(사원): "팀 목표를 이해하고 자기 업무에 반영"
- S2(대리): "후배 업무 가이드, 팀 내 협업 주도"
- S3(과장): "팀 비전 수립, 구성원 역량 개발 코칭"
- S4(차장): "부서 간 협업 리드, 조직 변화 관리"
```

---

## 작업 순서 (7 Tasks)

### Task 1: DB 마이그레이션 — Prisma 모델 5개 추가

`prisma/schema.prisma`에 추가 후 `npx prisma migrate dev --name a_b3_competency_framework` 실행.

> **⚠️ migrate 전 확인**: `cat context/TRACK_B.md`에서 [B] 트랙이 미완료 migrate가 있는지 확인. 있으면 B 트랙 migrate 완료 후 진행.

```prisma
model CompetencyCategory {
  id           String       @id @default(uuid()) @db.Uuid
  code         String       @unique @db.VarChar(50)        // 'core_value', 'leadership', 'technical'
  name         String       @db.VarChar(100)               // '핵심가치 역량'
  nameEn       String?      @db.VarChar(100)               // 'Core Value Competency'
  description  String?      @db.Text
  displayOrder Int          @default(0)
  isActive     Boolean      @default(true)
  competencies Competency[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@map("competency_categories")
}

model Competency {
  id           String               @id @default(uuid()) @db.Uuid
  categoryId   String               @db.Uuid
  category     CompetencyCategory   @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  code         String               @db.VarChar(50)        // 'challenge', 'trust', 'welding'
  name         String               @db.VarChar(100)       // '도전'
  nameEn       String?              @db.VarChar(100)       // 'Challenge'
  description  String?              @db.Text
  displayOrder Int                  @default(0)
  isActive     Boolean              @default(true)
  levels       CompetencyLevel[]
  indicators   CompetencyIndicator[]
  requirements CompetencyRequirement[]
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt

  @@unique([categoryId, code])
  @@map("competencies")
}

model CompetencyLevel {
  id           String     @id @default(uuid()) @db.Uuid
  competencyId String     @db.Uuid
  competency   Competency @relation(fields: [competencyId], references: [id], onDelete: Cascade)
  level        Int                                         // 1, 2, 3, 4, 5
  label        String     @db.VarChar(100)                 // '기초', '보통', '우수', '탁월', '전문가'
  description  String?    @db.Text                         // 해당 레벨 기대 행동 기술
  createdAt    DateTime   @default(now())

  @@map("competency_levels")
}

model CompetencyIndicator {
  id              String     @id @default(uuid()) @db.Uuid
  competencyId    String     @db.Uuid
  competency      Competency @relation(fields: [competencyId], references: [id], onDelete: Cascade)
  indicatorText   String     @db.Text                      // "새로운 방법을 시도하며..."
  indicatorTextEn String?    @db.Text
  displayOrder    Int        @default(0)
  isActive        Boolean    @default(true)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  @@map("competency_indicators")
}

model CompetencyRequirement {
  id           String     @id @default(uuid()) @db.Uuid
  competencyId String     @db.Uuid
  competency   Competency @relation(fields: [competencyId], references: [id], onDelete: Cascade)
  jobId        String?    @db.Uuid                         // NULL = 전 직무 공통
  jobLevelCode String?    @db.VarChar(20)                  // 직급 코드
  expectedLevel Int                                        // 기대 숙련도 레벨
  companyId    String?    @db.Uuid
  company      Company?   @relation(fields: [companyId], references: [id])
  createdAt    DateTime   @default(now())

  @@unique([competencyId, jobId, jobLevelCode, companyId])
  @@map("competency_requirements")
}
```

### Task 2: 시드 데이터

**핵심가치 역량 (core_value) — CTR Value System 2.0**:

> **중요**: 현재 CTR은 4개 핵심가치 × 13개 행동지표를 운영 중입니다. 하지만 행동지표의 **갯수와 문구는 언제든 변경될 수 있으므로** 절대 하드코딩하지 마세요. 아래는 초기 시드일 뿐이고, Admin이 IndicatorEditor에서 자유롭게 추가/삭제/수정할 수 있어야 합니다. 가치당 행동지표 갯수가 고정 3~4개가 아니라 **0~N개 가변**입니다.

```
카테고리: 핵심가치 역량 (core_value)
├── 도전(Challenge) — 4개
│   ├── "현재에 안주하지 않고 더 높은 목표를 설정한다"
│   ├── "새로운 방법을 시도하며 실패를 학습 기회로 활용한다"
│   ├── "변화에 능동적으로 대응하고 개선을 주도한다"
│   └── "도전적 과제를 자발적으로 수행한다"
├── 신뢰(Trust) — 3개
│   ├── "약속을 지키고 일관된 행동으로 신뢰를 쌓는다"
│   ├── "투명하게 정보를 공유하고 솔직하게 소통한다"
│   └── "동료의 역량을 믿고 적절히 위임한다"
├── 책임(Responsibility) — 3개
│   ├── "맡은 업무에 대해 끝까지 책임지고 완수한다"
│   ├── "문제 발생 시 원인을 찾고 해결책을 제시한다"
│   └── "조직의 목표를 개인 업무에 연결하여 실행한다"
└── 존중(Respect) — 3개
    ├── "다양한 의견을 경청하고 건설적으로 반응한다"
    ├── "동료의 기여를 인정하고 감사를 표현한다"
    └── "다른 문화와 배경을 이해하고 존중한다"
→ 합계: 13개 (시드 기준. Admin이 자유롭게 변경 가능)
```

**리더십 역량 (leadership)** — 샘플 3개:
- 전략적 사고, 팀 빌딩, 의사결정

**직무 전문 역량 (technical)** — CTR 자동차부품 맥락 샘플 5개:
- 용접 기술, 품질 관리, 금형 설계, 사출성형, PLC 프로그래밍

**숙련도 레벨** — 공통 5단계:
- 1: 기초 (Basic), 2: 보통 (Intermediate), 3: 우수 (Advanced), 4: 탁월 (Expert), 5: 전문가 (Master)

**competency_requirements 시드**:
- 핵심가치 4개 × 직급 4단계(S1~S4) → 16개 레코드 (전 직무 공통, company_id NULL)
- 리더십 3개 × S3, S4만 → 6개 레코드

### Task 3: CompetencyLibraryAdmin — 역량 카테고리/역량 CRUD

**라우트**: `/settings/competencies` (설정 섹션)

```
┌─────────────────────────────────────────────────────┐
│ 역량 라이브러리 관리                                    │
├─────────────────────────────────────────────────────┤
│ [핵심가치 역량]  [리더십 역량]  [직무 전문 역량]         │  ← 카테고리 탭
├─────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐        │
│ │ 🔥 도전 (Challenge)              [편집][삭제] │        │
│ │   행동지표 3개 | 기대레벨 설정됨            │        │
│ │   > 클릭하여 상세 보기                    │        │
│ ├──────────────────────────────────────────┤        │
│ │ 🤝 신뢰 (Trust)                  [편집][삭제] │        │
│ │   행동지표 3개 | 기대레벨 설정됨            │        │
│ └──────────────────────────────────────────┘        │
│                                                     │
│ [+ 역량 추가]                                        │
└─────────────────────────────────────────────────────┘
```

**역량 클릭 → 상세 사이드패널**:
- 역량 기본정보 (이름/코드/설명) 편집
- 행동지표 편집기 (Task 5)
- 숙련도 레벨 편집기 (Task 4)

### Task 4: CompetencyLevelEditor — 직급별 숙련도 정의

역량별로 숙련도 레벨(1~5)의 각 단계가 어떤 행동을 의미하는지 정의하는 편집기.

```
┌────────────────────────────────────────┐
│ "도전" 역량 — 숙련도 레벨 정의          │
├────────────────────────────────────────┤
│ Level 1 (기초)                         │
│ [팀 목표를 이해하고 자기 업무에 반영]     │
│                                        │
│ Level 2 (보통)                         │
│ [주도적으로 개선 과제를 발굴하고 실행]     │
│                                        │
│ Level 3 (우수)                         │
│ [팀 차원의 혁신을 기획하고 주도]          │
│                                        │
│ Level 4 (탁월)                         │
│ [조직 전체의 변화를 설계하고 이끌어감]     │
└────────────────────────────────────────┘
```

- 인라인 텍스트 편집 (textarea)
- 레벨 추가/삭제 가능 (기본 5단계지만 조정 가능)

### Task 5: IndicatorEditor — 행동지표 편집기 (Admin)

핵심가치 역량의 행동지표를 Admin이 편집할 수 있는 UI. **BEI 기준이 변경될 수 있으므로 하드코딩 금지**가 이 편집기의 존재 이유입니다.

```
┌────────────────────────────────────────┐
│ "도전" 역량 — 행동지표                   │
├────────────────────────────────────────┤
│ 1. [현재에 안주하지 않고...] [↑][↓][🗑]  │
│ 2. [새로운 방법을 시도하며...] [↑][↓][🗑] │
│ 3. [변화에 능동적으로...] [↑][↓][🗑]     │
│                                        │
│ [+ 행동지표 추가]                        │
└────────────────────────────────────────┘
```

- 순서 변경 (↑↓ 버튼, 추후 C3에서 DnD로 교체 가능)
- 인라인 텍스트 편집
- 추가/삭제
- 한국어 + 영어 병기 (indicator_text + indicator_text_en)

### Task 6: DynamicEvalForm — 법인별 설정에 따른 동적 평가 폼

**이 Task가 B3-1의 핵심**입니다. B1의 `evaluation_settings`를 읽어 법인에 따라 다른 평가 폼을 렌더링합니다.

**동작 원리**:
```typescript
// 1. 법인별 평가 설정 조회
const evalSettings = await getCompanySettings<EvaluationSettings>(
  'evaluation_settings',
  employee.companyId
);

// 2. 설정에 따라 폼 구성 결정
const showBEI = evalSettings.methodology === 'mbo_bei';
const gradeOptions = evalSettings.grade_scales.performance.grades;
const showOverall = evalSettings.grade_scales.overall?.enabled;

// 3. BEI 섹션이 활성이면 → competency_indicators에서 핵심가치 행동지표 로드
if (showBEI) {
  const indicators = await getIndicatorsByCategory('core_value');
}
```

**렌더링 분기**:

| 설정 | CTR-KR | CTR-US |
|------|--------|--------|
| 방법론 | MBO + BEI | MBO만 |
| 업적 등급 | O/E/M/S (4등급) | O/E/M/B/U (5등급) |
| 역량 등급 | O/E/M/S (4등급) | — (없음) |
| 종합등급 | ✅ (업적60% + 역량40%) | ❌ |
| 강제배분 | soft, 업적+역량 | 비활성 |

**평가 폼 구조**:
```
┌────────────────────────────────────────┐
│ [법인: CTR-KR] 의 평가 폼               │
├────────────────────────────────────────┤
│ 1. 업적 평가 (MBO)                      │
│    목표 1: [...] 달성률: [80%]           │
│    목표 2: [...] 달성률: [90%]           │
│    업적 등급: [O] [E] [M] [S]           │  ← grade_scales.performance
├────────────────────────────────────────┤
│ 2. 역량 평가 (BEI)  ← showBEI=true일 때만 │
│    ┌ 도전 (Challenge) ──────────────┐   │
│    │ □ 현재에 안주하지 않고...        │   │  ← competency_indicators
│    │ □ 새로운 방법을 시도하며...      │   │
│    │ □ 변화에 능동적으로...          │   │
│    │ 역량 등급: [O] [E] [M] [S]     │   │  ← grade_scales.competency
│    └────────────────────────────────┘   │
│    ┌ 신뢰 (Trust) ─────────────────┐   │
│    │ ...                           │   │
│    └────────────────────────────────┘   │
├────────────────────────────────────────┤
│ 3. 종합 등급  ← showOverall=true일 때만  │
│    자동계산: 업적(60%) + 역량(40%) = [E]  │
│    또는 매니저 수동 선택                  │
└────────────────────────────────────────┘
```

**기존 STEP 6A 코드와의 통합**:
- STEP 6A의 평가 폼을 **교체**하는 것이 아니라, 설정 기반 동적 렌더링으로 **확장**
- 기존 MBO 목표 관리 UI는 유지
- BEI 섹션만 `evaluation_settings.methodology`에 따라 표시/숨김
- 등급 선택 UI만 `grade_scales`에 따라 동적 생성

### Task 7: 검증

```bash
# 1. 역량 라이브러리 CRUD 동작
#    - 카테고리 탭 전환
#    - 역량 추가/편집/삭제
#    - 행동지표 추가/편집/삭제/순서변경
#    - 숙련도 레벨 편집

# 2. 법인별 동적 평가 폼 확인
#    - CTR-KR: MBO + BEI + 종합등급 표시
#    - CTR-US: MBO만 표시, BEI 섹션 없음, 종합등급 없음
#    - 등급 옵션이 각 법인 설정에 맞게 동적 렌더링

# 3. 기존 STEP 6A 기능 미파괴 확인
#    - MBO 목표 관리 정상 동작
#    - 캘리브레이션 9-Block 정상 동작 (B3-2에서 확장 예정)

# 4. [B] 트랙과의 충돌 확인
#    - TRACK_B.md 확인하여 겹치는 테이블/라우트 없는지 검증

npx tsc --noEmit
npm run build
# context/TRACK_A.md 업데이트 (SHARED.md, TRACK_B.md 수정 금지)
```

---

## 산출물 체크리스트

- [ ] DB 테이블 5개 생성 (competency_categories, competencies, competency_levels, competency_indicators, competency_requirements)
- [ ] 시드 데이터: 핵심가치 4개 + 행동지표 13개 + 리더십 3개 + 직무전문 5개
- [ ] CompetencyLibraryAdmin — 역량 카테고리/역량 CRUD
- [ ] CompetencyLevelEditor — 숙련도 레벨 편집기
- [ ] IndicatorEditor — 행동지표 편집기 (Admin)
- [ ] DynamicEvalForm — 법인별 동적 평가 폼 렌더링
- [ ] 기존 STEP 6A 평가 폼에 법인별 설정 연결
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] **context/TRACK_A.md 업데이트** (아래 내용 기록)

---

## context/TRACK_A.md 업데이트 내용 (세션 종료 시)

```markdown
## B3-1 완료 (날짜)

### DB 테이블
- competency_categories, competencies, competency_levels
- competency_indicators, competency_requirements
- migrate 이름: a_b3_competency_framework

### 핵심 데이터 구조
- BEI 평가 = competency_categories.code = 'core_value' 필터
- 숙련도 레벨: competency_levels (역량별 1~5단계)
- 기대 역량: competency_requirements (직무×직급별)

### 컴포넌트
- CompetencyLibraryAdmin → /settings/competencies
- CompetencyLevelEditor → 숙련도 편집
- IndicatorEditor → 행동지표 편집
- DynamicEvalForm → 법인별 평가 폼 동적 렌더링

### [B] 트랙 참고사항
- 이 세션의 테이블은 [B] 트랙과 독립적 (충돌 없음)
- competency_requirements는 B8-3(스킬 갭 분석)에서 참조 예정

### 다음 세션 주의사항 (A 트랙)
- B3-2: DynamicEvalForm 위에 사이드패널(목표-원온원-리뷰 연결) 추가
- B3-2: competency_requirements를 Talent Review 9-Block → 승계계획에서 참조
- B4: 채용 면접 질문 생성 시 competencies 테이블 참조 가능
- B8-3: competency_requirements를 스킬 갭 분석에서 참조 (expected_level vs actual)
- B10-2: 배지 카테고리가 핵심가치와 연결될 수 있음
```

---

## 주의사항

1. **기존 STEP 6A를 파괴하지 마세요** — BEI가 이미 어떤 형태로든 구현되어 있을 겁니다. 하드코딩된 행동지표를 DB로 이관하되, 기존 평가 데이터(이미 입력된 BEI 점수)는 유지해야 합니다. 마이그레이션 스크립트에서 기존 데이터를 새 테이블로 매핑하세요.

2. **competency_requirements는 B8-3의 핵심 의존성** — 이 테이블의 `expected_level`이 스킬 갭 분석의 "기대 수준"이 됩니다. 스키마를 변경하면 B8-3에 영향이 있으므로, 지금 확정한 구조를 TRACK_A.md에 명확히 기록하세요.

3. **DynamicEvalForm의 타입 안전성** — B1 `evaluation_settings`의 JSONB 구조와 이 폼의 렌더링 로직이 타입으로 연결되어야 합니다. `types/settings.ts`에 정의된 `EvaluationSettings` 인터페이스를 반드시 사용하세요.

4. **행동지표 변경 이력 관리** — Admin이 행동지표를 수정하면 이미 진행 중인 평가에는 영향을 주지 않아야 합니다. 평가 시작 시점에 해당 시점의 행동지표를 스냅샷하는 방식을 고려하세요 (또는 평가 레코드에 indicator 스냅샷 JSONB 저장).

5. **숙련도 레벨과 평가 등급을 혼동하지 마세요**:
   - 숙련도 레벨 (competency_levels): "이 역량을 얼마나 잘 하는가" (1~5)
   - 평가 등급 (grade_scales): "이번 평가 기간에 얼마나 잘 했는가" (O/E/M/S)
   - 둘은 다른 축입니다.

6. **migrate 이름에 `a_` 접두사 필수** — [B] 트랙과의 migrate lock 충돌을 방지합니다. 두 트랙이 동시에 migrate를 돌리면 안 됩니다.
