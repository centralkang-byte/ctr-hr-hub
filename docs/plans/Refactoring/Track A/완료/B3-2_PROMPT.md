# B3-2: Talent Review + AI 평가 리포트

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A + B1(법인 엔진) + B3-1(역량 프레임워크 + 동적 평가 폼) 완료 상태.
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
cat context/TRACK_A.md      # 이전 A 트랙 작업 확인 (B3-1 결과 필수)
cat context/TRACK_B.md      # B 트랙이 뭘 하고 있는지 참고

# 쓰기: TRACK_A.md에만 기록하세요
# ❌ SHARED.md 수정 금지
# ❌ TRACK_B.md 수정 금지

# migrate 이름 규칙: a_ 접두사 사용
npx prisma migrate dev --name a_b3_talent_review
```

---

## 세션 목표

B3-1에서 구축한 역량 프레임워크와 동적 평가 폼 위에 **인재관리의 전략적 레이어**를 올립니다. 9-Block을 승계계획(Succession Planning)까지 확장하고, 목표-원온원-리뷰를 양방향으로 연결하며, AI가 평가 초안을 생성하고 편향을 감지합니다.

**주의**: 이 세션은 STEP 6A 기존 캘리브레이션 9-Block을 **확장**하는 세션입니다. 기존 기능을 파괴하지 마세요.

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. 컨텍스트 파일 3개 읽기 — B3-1 산출물 확인 필수
cat context/SHARED.md
cat context/TRACK_A.md      # ← B3-1 결과가 여기에 있어야 함
cat context/TRACK_B.md

# 2. STEP 6A 캘리브레이션 9-Block 현재 상태 확인
# - 어떤 2축을 사용하는지 (업적×역량? 성과×잠재력?)
# - 직원 배치 데이터가 어느 테이블에 저장되는지
# - 드래그앤드롭 동작 여부

# 3. STEP 6A 원온원(1-on-1) 기능 확인
# - 원온원 미팅 노트 저장 테이블
# - 감정 태그/펄스 데이터 존재 여부

# 4. B3-1 DynamicEvalForm의 데이터 저장 구조 확인
# - 평가 결과가 어느 테이블에 저장되는지
# - grade_scales에 따른 등급 저장 형태

# 5. Anthropic API 키 설정 여부 확인 (AI 기능용)
# .env에 ANTHROPIC_API_KEY 또는 유사 환경변수

# 6. [B] 트랙 상태 확인 — TRACK_B.md에서 DB 변경사항 확인
# B 트랙이 migrate를 실행했다면 먼저 pull 후 시작
npx prisma db pull  # 필요 시
```

### ⚠️ 기존 코드에서 잘못됐을 수 있는 부분

1. **9-Block 축 정의 불일치** — STEP 6A에서 "성과×잠재력"으로 구현했을 수 있지만, B3-2 스펙은 "업적(MBO)×역량(BEI)"입니다. 법인별 evaluation_settings에 따라 축이 달라져야 합니다.

2. **캘리브레이션 데이터 모델 미비** — STEP 6A에서 9-Block 배치만 있고, 캘리브레이션 세션(누가/언제/어떤 부서를 캘리브레이션했는지) 메타데이터가 없을 수 있습니다.

3. **원온원 감정 데이터 부재** — 원온원에 감정 태그(positive/neutral/negative)가 없으면 AI 평가 리포트의 감정 분석 입력이 불가합니다. 필요시 이번 세션에서 필드 추가.

---

## 핵심 설계 원칙

### 1. 9-Block → Talent Review는 "확장"이지 "교체"가 아님

```
[기존 STEP 6A]                    [B3-2 확장]
캘리브레이션 9-Block              → 9-Block + Readiness 레이어
  └ 드래그앤드롭 배치               └ Ready Now / 1-2Y / Development
                                  → 승계계획 연결
                                    └ 핵심 포지션 → 후보자 매핑
                                  → 사이드패널: 목표-원온원-리뷰 통합 뷰
```

### 2. AI = 초안 생성 + 편향 감지 (판단 대체 아님)

- AI가 평가 "초안"을 생성하면 매니저가 반드시 **검토/수정 후 확정**
- 편향 감지는 알림/경고 수준 — "이 매니저의 평가 분포가 편향되어 있습니다" 식
- 최종 평가 결정은 항상 사람이 함

### 3. 양방향 사이드패널 — 진입점 3곳

| 진입점 | 열리는 사이드패널 | 표시 내용 |
|--------|-----------------|----------|
| 9-Block 직원 클릭 | 직원 통합 뷰 패널 | 목표 달성률 + 최근 원온원 + BEI 점수 + Readiness |
| 평가 폼에서 "참고자료" 클릭 | 동일 패널 | 위와 동일 |
| 원온원 미팅에서 "평가 연결" 클릭 | 평가 요약 패널 | 현재 평가 상태 + 목표 진행률 |

---

## 작업 순서 (8 Tasks)

### Task 1: DB 마이그레이션 — Prisma 모델 4개 추가

`prisma/schema.prisma`에 추가 후 `npx prisma migrate dev --name a_b3_talent_review` 실행.

> **⚠️ migrate 전 확인**: `cat context/TRACK_B.md`에서 [B] 트랙이 미완료 migrate가 있는지 확인. 있으면 B 트랙 migrate 완료 후 진행.

```prisma
model SuccessionPlan {
  id            String                @id @default(uuid()) @db.Uuid
  positionId    String                @db.Uuid
  positionTitle String                @db.VarChar(200)     // 직책명 스냅샷
  departmentId  String?               @db.Uuid
  companyId     String                @db.Uuid
  company       Company               @relation(fields: [companyId], references: [id])
  priority      String                @default("medium") @db.VarChar(20)  // 'critical' | 'high' | 'medium'
  status        String                @default("active") @db.VarChar(20)  // 'active' | 'filled' | 'archived'
  notes         String?               @db.Text
  candidates    SuccessionCandidate[]
  createdBy     String                @db.Uuid
  createdAt     DateTime              @default(now())
  updatedAt     DateTime              @updatedAt

  @@map("succession_plans")
}

model SuccessionCandidate {
  id              String         @id @default(uuid()) @db.Uuid
  planId          String         @db.Uuid
  plan            SuccessionPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  employeeId      String         @db.Uuid
  readiness       String         @db.VarChar(30)  // 'ready_now' | 'ready_1_2_years' | 'development_needed'
  developmentNote String?        @db.Text         // 개발 필요사항 메모
  ranking         Int            @default(0)      // 후보 우선순위 (1=최우선)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@unique([planId, employeeId])
  @@map("succession_candidates")
}

model AiEvaluationDraft {
  id              String   @id @default(uuid()) @db.Uuid
  evaluationId    String   @db.Uuid            // 연결된 평가 레코드 ID
  employeeId      String   @db.Uuid
  reviewerId      String   @db.Uuid            // AI 초안 요청한 매니저
  draftContent    Json                         // AI 생성 초안 전문 (섹션별)
  inputSummary    Json                         // AI에 입력된 데이터 요약 (투명성)
  status          String   @default("draft") @db.VarChar(20)  // 'draft' | 'reviewed' | 'applied' | 'discarded'
  managerEdits    Json?                        // 매니저가 수정한 부분 diff
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("ai_evaluation_drafts")
}

model BiasDetectionLog {
  id              String   @id @default(uuid()) @db.Uuid
  evaluationCycle String   @db.VarChar(50)     // '2025-H1' 등
  reviewerId      String   @db.Uuid            // 평가자
  biasType        String   @db.VarChar(50)     // 'central_tendency' | 'leniency' | 'severity' | 'recency' | 'gender' | 'tenure'
  severity        String   @db.VarChar(20)     // 'info' | 'warning' | 'critical'
  description     String   @db.Text            // "이 평가자의 등급 분포가 M등급에 78% 집중되어 있습니다"
  details         Json?                        // 상세 통계 데이터
  isAcknowledged  Boolean  @default(false)     // HR이 확인 처리했는지
  createdAt       DateTime @default(now())

  @@map("bias_detection_logs")
}
```

**기존 테이블 수정 필요 여부 확인**:
- 원온원 테이블에 `sentimentTag` 필드가 없으면 추가: `sentimentTag String? @db.VarChar(20)` (positive/neutral/negative/concerned)
- 캘리브레이션 9-Block 배치 테이블에 `readiness` 필드가 없으면 추가 (또는 SuccessionCandidate에서 관리)

### Task 2: 9-Block 확장 — Readiness 레이어 + 법인별 축 동적화

기존 STEP 6A 9-Block 위에 확장합니다.

**법인별 축 동적화**:
```typescript
// B1 evaluation_settings에서 법인별 축 결정
const evalSettings = await getCompanySettings<EvaluationSetting>(
  'evaluationSetting', companyId
);

// methodology에 따라 9-Block 축 결정
const xAxis = 'performance';  // MBO 업적 — 항상 존재
const yAxis = evalSettings.methodology === 'mbo_bei' 
  ? 'competency'    // BEI 역량 (MBO+BEI 법인)
  : 'potential';     // 잠재력 (MBO만 법인은 매니저 수동 평가)
```

**Readiness 오버레이**:
```
9-Block 셀 내 직원 칩에 Readiness 뱃지 추가:

┌──────────┬──────────┬──────────┐
│ 7        │ 8        │ 9 ⭐     │
│          │ 김과장🟢  │ 이부장🟢  │  🟢 Ready Now
│          │          │ 박차장🟡  │  🟡 1-2 Years
├──────────┼──────────┼──────────┤
│ 4        │ 5        │ 6        │  🔴 Development
│          │ 최대리🟡  │ 정과장🟢  │
│          │ 한사원🔴  │          │  (뱃지 없음 = 미평가)
├──────────┼──────────┼──────────┤
│ 1        │ 2        │ 3        │
│ 신입🔴   │          │          │
└──────────┴──────────┴──────────┘
```

**직원 칩 클릭 → 통합 사이드패널** (Task 4)

### Task 3: 승계계획 (Succession Planning)

**라우트**: `/talent/succession` (인재관리 섹션)

**UI 구조**:
```
┌────────────────────────────────────────────────────────┐
│ 승계계획                                    [+ 계획 추가] │
├────────────────────────────────────────────────────────┤
│ 🔴 핵심 포지션 (Critical)                                │
│ ┌─────────────────────────────────────────────────┐    │
│ │ CTO · 기술연구소 · CTR-KR                        │    │
│ │ 후보: 이부장🟢(#1) · 박차장🟡(#2)                  │    │
│ └─────────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────────┐    │
│ │ 품질본부장 · 품질관리부 · CTR-KR                    │    │
│ │ 후보: 정과장🟢(#1) · ⚠️ 후보 1명 (최소 2명 권장)     │    │
│ └─────────────────────────────────────────────────┘    │
├────────────────────────────────────────────────────────┤
│ 🟡 주요 포지션 (High)                                   │
│ ...                                                    │
└────────────────────────────────────────────────────────┘
```

**후보자 추가 방법**:
1. 직접 검색: 직원 이름/사번 검색 → 추가
2. 9-Block에서: 9번 셀(High Performance + High Competency) 직원 → "승계 후보 추가" 액션

**후보자 카드**:
- 이름, 직급, 부서
- Readiness 뱃지 (🟢🟡🔴)
- 최근 평가 등급
- 개발 필요사항 메모 (인라인 편집)

### Task 4: 직원 통합 사이드패널 — 목표/원온원/리뷰 양방향 연결

9-Block, 승계계획, 평가 폼에서 직원 클릭 시 열리는 통합 뷰.

```
┌────────────────────────────────┐
│ 김과장 · 개발팀 · S3            │
│ ─────────────────────────────  │
│                                │
│ 📊 목표 달성률                  │
│ ┌────────────────────────────┐ │
│ │ 목표 1: 신규 모듈 개발  80%  │ │
│ │ 목표 2: 품질 개선       95%  │ │
│ │ 전체 달성률: 87%            │ │
│ └────────────────────────────┘ │
│                                │
│ 💬 최근 원온원 (3건)            │
│ ┌────────────────────────────┐ │
│ │ 02/15 😊 "프로젝트 순조로움" │ │
│ │ 01/20 😐 "업무량 부담 언급"  │ │
│ │ 12/18 😊 "승진 의욕 높음"   │ │
│ └────────────────────────────┘ │
│                                │
│ 📋 BEI 역량 점수                │
│ ┌────────────────────────────┐ │
│ │ 도전: 4/5 | 신뢰: 3/5      │ │
│ │ 책임: 4/5 | 존중: 5/5      │ │
│ └────────────────────────────┘ │
│                                │
│ ⭐ Readiness: Ready Now        │
│                                │
│ [평가 상세 보기] [원온원 기록]   │
└────────────────────────────────┘
```

**데이터 소스**:
- 목표 달성률: 기존 MBO 목표 테이블
- 최근 원온원: 원온원 미팅 테이블 + sentimentTag
- BEI 역량: B3-1 competency 관련 테이블 + 평가 결과
- Readiness: succession_candidates 또는 매니저 수동 입력

### Task 5: AI 평가 초안 생성

**진입점**: 평가 폼에서 "AI 초안 생성" 버튼 (매니저만 표시)

**AI 입력 데이터 수집**:
```typescript
// 평가 대상 직원의 데이터를 수집
const aiInput = {
  employee: { name, jobLevel, department, tenure },
  mboGoals: [{ title, targetValue, actualValue, achievementRate }],  // 목표 달성률
  oneOnOnes: [{ date, summary, sentimentTag }],   // 최근 6개월 원온원
  peerFeedback: [{ from, content, date }],         // 동료 피드백 (있으면)
  beiScores: [{ competency, indicators, score }],  // BEI 점수 (있으면)
  previousEval: { grade, comment },                // 전기 평가 결과 (있으면)
};
```

**API Route**: `POST /api/v1/evaluations/[id]/ai-draft`

**AI 프롬프트 구조**:
```
시스템: 당신은 HR 전문가입니다. 아래 데이터를 바탕으로 공정하고 구체적인 
평가 초안을 작성하세요. 판단이 아닌 사실 기반으로 작성하고, 
주관적 해석은 "[매니저 검토 필요]" 태그를 붙여주세요.

입력: {aiInput JSON}

출력 형식:
1. 업적 평가 코멘트 (200자 이내)
2. 역량 평가 코멘트 (200자 이내, BEI 법인만)
3. 강점 요약 (3개)
4. 개발 영역 (2개)
5. 종합 소견 (300자 이내)
6. 추천 등급 + 근거 (참고용, 매니저가 최종 결정)
```

**UI 플로우**:
```
[AI 초안 생성] 클릭
  → 로딩 (3-5초)
  → 초안 미리보기 (편집 가능 텍스트 영역)
  → "[매니저 검토 필요]" 태그 하이라이트
  → "초안 적용" → 평가 폼에 반영 (매니저가 수정 가능)
  → "폐기" → 초안 삭제
```

**투명성**: `inputSummary` 필드에 AI에 입력된 데이터 요약을 저장. 나중에 "이 AI 초안은 어떤 데이터를 기반으로 생성됐는지" 확인 가능.

### Task 6: 편향 감지 시스템

**트리거**: 캘리브레이션 세션 시작 시 / 평가 확정 전 자동 분석

**감지 유형 6가지**:

| 편향 유형 | 감지 로직 | 심각도 기준 |
|----------|----------|----------|
| 중심화 경향 (Central Tendency) | 한 등급에 60%+ 집중 | warning: 60%, critical: 80% |
| 관대화 (Leniency) | 상위 2개 등급에 70%+ | warning: 70%, critical: 85% |
| 엄격화 (Severity) | 하위 2개 등급에 70%+ | warning: 70%, critical: 85% |
| 최근 편향 (Recency) | 최근 3개월 원온원 감정과 등급 상관 > 0.8 | warning |
| 재직기간 편향 (Tenure) | 재직기간-등급 상관 > 0.7 | warning |
| 성별 편향 (Gender) | 성별 간 등급 분포 통계적 유의차 | critical |

**API Route**: `POST /api/v1/evaluations/bias-check`

```typescript
// 입력: reviewerId + evaluationCycle
// 출력: BiasDetectionLog[] — 감지된 편향 목록

// 감지 로직은 서버사이드에서 SQL 집계로 처리
// LLM 불필요 — 규칙 기반 통계 분석
```

**UI**: 캘리브레이션 페이지 상단 경고 배너
```
⚠️ 편향 감지 알림 (2건)
├── 김팀장: 중심화 경향 — M등급에 78% 집중 (warning)
└── 이부장: 관대화 경향 — O/E등급에 85% 집중 (critical)
[상세 보기] → 편향 상세 모달 (분포 차트 + 비교 데이터)
```

### Task 7: 기존 STEP 6A 연결 작업

이미 있는 STEP 6A 기능과 B3-2 신규 기능을 연결합니다.

**연결 포인트**:
1. **9-Block → 사이드패널**: 기존 9-Block 직원 클릭 이벤트에 Task 4 사이드패널 연결
2. **평가 폼 → AI 초안**: 기존 평가 폼에 "AI 초안 생성" 버튼 추가
3. **캘리브레이션 → 편향 감지**: 기존 캘리브레이션 페이지에 편향 감지 배너 추가
4. **원온원 → sentimentTag**: 기존 원온원 폼에 감정 태그 선택 추가 (없으면)

**주의**: 기존 코드를 큰 폭으로 리팩토링하지 마세요. 최소한의 연결만 수행하고, 대규모 리팩토링은 C phase에서.

### Task 8: 검증

```bash
# 1. 9-Block 기존 기능 미파괴 확인
#    - 드래그앤드롭 배치 동작
#    - 법인 전환 시 축 변경 (MBO+BEI vs MBO만)

# 2. Readiness 뱃지 표시 확인
#    - 9-Block 셀 내 직원 칩에 뱃지

# 3. 승계계획 CRUD
#    - 핵심 포지션 생성 → 후보자 추가 → Readiness 설정

# 4. 직원 통합 사이드패널
#    - 9-Block에서 클릭 → 패널 열림
#    - 목표/원온원/BEI 데이터 표시

# 5. AI 평가 초안
#    - "AI 초안 생성" → 로딩 → 초안 표시
#    - 초안 편집 → "초안 적용" → 평가 폼 반영
#    - inputSummary 저장 확인

# 6. 편향 감지
#    - 캘리브레이션 페이지에서 경고 배너 표시
#    - 상세 모달에서 분포 차트

# 7. [B] 트랙과의 충돌 확인
#    - TRACK_B.md 확인하여 겹치는 테이블/라우트 없는지 검증

npx tsc --noEmit
npm run build
# context/TRACK_A.md 업데이트 (SHARED.md, TRACK_B.md 수정 금지)
```

---

## 산출물 체크리스트

- [ ] Prisma 모델 4개 (SuccessionPlan, SuccessionCandidate, AiEvaluationDraft, BiasDetectionLog)
- [ ] 9-Block 확장: 법인별 축 동적화 + Readiness 오버레이
- [ ] 승계계획 UI: 포지션 CRUD + 후보자 관리
- [ ] 직원 통합 사이드패널: 목표/원온원/BEI/Readiness 통합 뷰
- [ ] AI 평가 초안 생성: API + UI 플로우 + 투명성(inputSummary)
- [ ] 편향 감지: 6가지 감지 로직 + 캘리브레이션 페이지 경고 배너
- [ ] 기존 STEP 6A 연결 (9-Block 사이드패널, 평가 폼 AI 버튼, 캘리브레이션 편향 배너)
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] **context/TRACK_A.md 업데이트** (아래 내용 기록)

---

## context/TRACK_A.md 업데이트 내용 (세션 종료 시)

```markdown
## B3-2 완료 (날짜)

### DB 테이블
- succession_plans, succession_candidates
- ai_evaluation_drafts, bias_detection_logs
- (기존 원온원 테이블에 sentimentTag 추가 여부)
- migrate 이름: a_b3_talent_review

### 핵심 기능
- 9-Block: Readiness 오버레이 + 법인별 축 동적화
- 승계계획: /talent/succession
- AI 평가 초안: POST /api/v1/evaluations/[id]/ai-draft
- 편향 감지: POST /api/v1/evaluations/bias-check

### [B] 트랙 참고사항
- 이 세션의 테이블은 [B] 트랙과 독립적 (충돌 없음)
- 원온원 sentimentTag 추가 시 TRACK_B.md에도 기록하여 B 트랙이 인지하도록 함

### 다음 세션 주의사항 (A 트랙)
- B4: succession_plans의 positionId가 A2 positions 테이블 참조
- B8-3: competency_requirements 기반 스킬 갭 분석 시 이 세션의 역량 평가 데이터 참조 가능
- B10-1: 원온원 sentimentTag → 이직 예측 입력 데이터
- B10-1: bias_detection_logs → HR 애널리틱스 대시보드 표시
- B10-2: AI 평가 초안 사용률 → HR KPI 위젯 가능
```

---

## 주의사항

1. **AI 평가 초안은 "제안"이지 "결정"이 아님** — UI에서 반드시 "이 초안은 AI가 생성한 참고 자료이며, 매니저의 검토와 수정이 필요합니다" 면책 문구를 표시하세요. AI 추천 등급은 흐린 색으로 표시하고 매니저가 직접 선택하도록.

2. **편향 감지의 임계값은 하드코딩하지 마세요** — B1의 evaluation_settings에 bias_thresholds JSONB를 추가하거나, 별도 설정 테이블을 사용. HR Admin이 "중심화 경향 60% → 70%"로 조정할 수 있어야 합니다.

3. **승계계획은 민감 데이터** — 접근 권한을 HR Admin + 해당 부서장으로 제한. 일반 직원은 물론, 다른 팀 매니저도 볼 수 없어야 합니다.

4. **원온원 sentimentTag 추가 시 기존 데이터 처리** — 기존 원온원 레코드에는 sentimentTag가 NULL입니다. AI 평가 초안에서 NULL인 원온원은 감정 분석 없이 텍스트만 참조하도록 처리하세요.

5. **9-Block 축 변경 시 기존 배치 데이터** — CTR-US가 "MBO×잠재력"이고 CTR-KR이 "MBO×BEI"면, 같은 캘리브레이션 뷰에서 법인 전환 시 축 라벨과 데이터가 모두 바뀌어야 합니다. 데이터가 축과 불일치하면 "이 법인은 아직 BEI 평가가 완료되지 않았습니다" 메시지를 표시하세요.

6. **migrate 이름에 `a_` 접두사 필수** — [B] 트랙과의 migrate lock 충돌을 방지합니다. 두 트랙이 동시에 migrate를 돌리면 안 됩니다.
