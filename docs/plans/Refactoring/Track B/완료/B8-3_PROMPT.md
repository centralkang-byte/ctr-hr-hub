# B8-3: 스킬 매트릭스 + 갭 분석

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A + B3-1(역량 프레임워크 + competency_requirements) + B8-2(스킬 태그) 완료.

### DB 접근 규칙 (전 세션 공통)

- 모든 테이블 생성/변경은 `prisma/schema.prisma` → `prisma migrate dev`
- 쿼리는 Prisma Client 사용
- Supabase는 Auth + Storage + Realtime 용도만

---

## 세션 목표

B3-1의 역량 프레임워크(`competency_requirements` = 기대 수준)와 직원의 실제 역량 수준을 비교하여 **스킬 갭 분석**을 수행하고, **팀/부서 단위 스킬 매트릭스 히트맵**을 제공합니다.

**핵심 공식**: `스킬 갭 = competency_requirements.expectedLevel - employee_skill_assessments.currentLevel`

---

## ⚠️ 시작 전 필수 확인

### 컨텍스트 파일 규칙 (병렬 개발)

```bash
# 읽기: 3개 파일 모두 읽으세요
cat context/SHARED.md       # 공유 인프라 상태 확인
cat context/TRACK_A.md      # A 트랙 상태 참고
cat context/TRACK_B.md      # 이전 B 트랙 작업 확인 (이 세션은 [B] 트랙)

# 쓰기: TRACK_B.md에만 기록하세요
# 이 세션 결과는 context/TRACK_B.md에 기록하세요
# SHARED.md는 수정하지 마세요
```

### 선행 모듈 확인

```bash
# 1. B3-1 competency_requirements 구조 확인
# - competencyId + jobLevelCode + expectedLevel
# - 직무(jobId) 필터 사용 여부

# 3. B3-1 competencies 테이블 확인
# - 핵심가치(core_value) + 리더십(leadership) + 직무전문(technical)
# - code, name 필드

# 4. B8-2 employee_profile_extensions.skills 확인
# - 스킬 태그 (자유 텍스트 배열)
# - 이것을 역량 프레임워크와 어떻게 연결할지

# 5. B3-1 competency_levels 구조 확인
# - 숙련도 1~5 레벨 정의
```

---

## 핵심 설계 원칙

### 1. 역량 평가 = 자기평가 + 매니저 평가

```
직원: "나의 용접 기술은 3(우수)이라고 생각합니다"
  → self_assessment = 3

매니저: "김사원의 용접 기술은 2(보통)로 평가합니다"
  → manager_assessment = 2

최종: finalLevel = manager_assessment (매니저 평가 우선, 자기평가는 참고)

기대 수준: competency_requirements에서 김사원의 직급(S1)에 해당하는 expected_level = 3

갭: 3 - 2 = 1 (부족)
```

### 2. 스킬 매트릭스 = 히트맵 시각화

```
             용접  품질관리  PLC  사출성형  금형설계
김사원(S1)    🟢3   🟡2     🔴1   🟡2     ⬜-
이대리(S2)    🟢4   🟢3     🟡2   🟢3     🟡2
박과장(S3)    🔵5   🟢4     🟢3   🟢4     🟢3
기대(S1)      3     2       2     2       1
기대(S2)      4     3       3     3       2
기대(S3)      5     4       4     4       3

색상: 🔴 기대 미달 | 🟡 기대 수준 | 🟢 기대 이상 | 🔵 전문가 | ⬜ 미평가
```

---

## 작업 순서 (7 Tasks)

### Task 1: DB 마이그레이션 — Prisma 모델 추가

`prisma/schema.prisma`에 추가 후 `npx prisma migrate dev --name b_b8_skill_matrix` 실행.

```prisma
model EmployeeSkillAssessment {
  id                String   @id @default(uuid()) @db.Uuid
  employeeId        String   @db.Uuid
  competencyId      String   @db.Uuid
  assessmentPeriod  String   @db.VarChar(20)       // '2025-H1', '2025-Q1'
  selfLevel         Int?                           // 자기평가 레벨 (1~5)
  managerLevel      Int?                           // 매니저 평가 레벨 (1~5)
  finalLevel        Int?                           // 최종 레벨 (매니저 우선)
  selfComment       String?  @db.Text
  managerComment    String?  @db.Text
  assessedBy        String?  @db.Uuid              // 매니저 ID
  assessedAt        DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([employeeId, competencyId, assessmentPeriod])
  @@index([employeeId])
  @@map("employee_skill_assessments")
}

model SkillGapReport {
  id              String   @id @default(uuid()) @db.Uuid
  companyId       String   @db.Uuid
  departmentId    String?  @db.Uuid
  assessmentPeriod String  @db.VarChar(20)
  reportData      Json                             // 집계 결과 (부서별/직급별 갭 매트릭스)
  generatedAt     DateTime @default(now())
  generatedBy     String   @db.Uuid

  @@map("skill_gap_reports")
}
```

### Task 2: 자기평가 + 매니저 평가 UI

**직원용 — 자기평가** (`/my/skills`):
```
┌─────────────────────────────────────────────────┐
│ 나의 역량 자기평가              2025 상반기        │
├─────────────────────────────────────────────────┤
│ 📊 직무 전문 역량                                │
│                                                 │
│ 용접 기술                                        │
│ 기대 수준: 3 (우수)   내 평가: [1][2][③][4][5]    │
│ 코멘트: [현장 용접 경험 3년, TIG 용접 가능      ]  │
│                                                 │
│ 품질 관리                                        │
│ 기대 수준: 2 (보통)   내 평가: [1][②][3][4][5]    │
│ 코멘트: [SPC 기본 교육 이수                     ]  │
│                                                 │
│ 📊 핵심가치 역량                                  │
│ 도전                                             │
│ 기대 수준: 2 (보통)   내 평가: [1][2][③][4][5]    │
│ ...                                             │
│                                                 │
│ [임시저장]  [제출]                                │
└─────────────────────────────────────────────────┘
```

**매니저용 — 팀원 역량 평가** (`/team/skills`):
```
┌─────────────────────────────────────────────────┐
│ 팀원 역량 평가 — 개발팀         2025 상반기        │
├─────────────────────────────────────────────────┤
│ 김사원 (S1)                                      │
│                                                 │
│ 용접 기술   자기: 3   매니저: [1][②][3][4][5]     │
│ 품질 관리   자기: 2   매니저: [1][②][3][4][5]     │
│ PLC        자기: 1   매니저: [①][2][3][4][5]     │
│                                                 │
│ [다음 팀원 →]  [저장]                             │
└─────────────────────────────────────────────────┘
```

### Task 3: 스킬 매트릭스 히트맵

**라우트**: `/organization/skill-matrix`

```
┌─────────────────────────────────────────────────────┐
│ 스킬 매트릭스             [부서: 생산1팀 ▼] [2025-H1]│
├─────────────────────────────────────────────────────┤
│                                                     │
│ (히트맵 테이블 — Recharts 또는 Custom Grid)           │
│                                                     │
│          용접  품질  PLC  사출  금형  도전  신뢰  책임 │
│ 기대(S1)  3    2    2    2    1    2    2    2     │
│ ─────────────────────────────────────────────────── │
│ 김사원    🟡2  🟡2  🔴1  🟡2  ⬜-  🟢3  🟡2  🟡2  │
│ 이사원    🟢3  🔴1  🟡2  🔴1  ⬜-  🟡2  🟡2  🟢3  │
│ 한사원    🔴1  🟡2  🟡2  🟢3  🔴1  🟡2  🟢3  🟡2  │
│                                                     │
│ 기대(S2)  4    3    3    3    2    3    3    3     │
│ ─────────────────────────────────────────────────── │
│ 최대리    🟡4  🟢4  🟡3  🟡3  🟡2  🟢4  🟡3  🟡3  │
│ ...                                                 │
│                                                     │
│ 범례: 🔴 미달(-2이상) 🟡 적정(-1~0) 🟢 우수(+1이상)   │
│       🔵 전문가(5) ⬜ 미평가                          │
│                                                     │
│ 📊 부서 스킬 갭 요약                                  │
│ 가장 큰 갭: PLC (-1.5 평균) → 교육 추천: PLC 기초과정  │
│ 강점 영역: 도전 (+0.8 평균)                           │
└─────────────────────────────────────────────────────┘
```

### Task 4: 개인 스킬 갭 분석 (레이더 차트)

**직원 프로필(B2) 또는 /my/skills에서 표시**:

```
┌────────────────────────────────────────────────┐
│ 김사원 — 역량 레이더 차트                         │
│                                                │
│        용접(3)                                 │
│         ╱╲                                     │
│   도전(3)    품질(2)      ── 기대 수준 (점선)    │
│       │    ╲│╱            ── 실제 수준 (실선)    │
│   책임(2)    PLC(1)                            │
│         ╲╱                                     │
│        신뢰(2)                                 │
│                                                │
│ 갭 요약:                                       │
│ ├── 🔴 PLC: 기대 2 → 실제 1 (갭 -1)            │
│ ├── 🟡 용접: 기대 3 → 실제 2 (갭 -1)            │
│ └── 🟢 도전: 기대 2 → 실제 3 (초과 +1)          │
│                                                │
│ 💡 추천 개발 계획:                               │
│ ├── PLC 기초과정 수강 (우선순위 1)               │
│ └── 용접 심화 OJT (우선순위 2)                   │
└────────────────────────────────────────────────┘
```

**레이더 차트**: Recharts `RadarChart` 사용. 기대 수준(점선) vs 실제 수준(실선) 오버레이.

### Task 5: 부서/법인 스킬 갭 리포트

HR Admin용 집계 뷰.

```
┌─────────────────────────────────────────────────┐
│ 스킬 갭 리포트              [법인: CTR-KR ▼]      │
│                            [기간: 2025-H1 ▼]     │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🔴 조직 전체 Top 5 갭 역량                        │
│ ├── PLC 프로그래밍: 평균 갭 -1.8                  │
│ ├── 금형 설계: 평균 갭 -1.2                       │
│ ├── 영어: 평균 갭 -0.9                           │
│ ├── 전략적 사고: 평균 갭 -0.7                     │
│ └── 데이터 분석: 평균 갭 -0.6                     │
│                                                 │
│ 🟢 조직 전체 Top 5 강점 역량                       │
│ ├── 도전: 평균 +0.8                              │
│ ├── 용접 기술: 평균 +0.5                          │
│ ├── 책임: 평균 +0.3                              │
│ └── ...                                          │
│                                                 │
│ 📊 부서별 갭 히트맵                               │
│ (부서 × 역량 히트맵 — 평균 갭 기준 색상)            │
│                                                 │
│ [리포트 다운로드 (Excel)]                          │
└─────────────────────────────────────────────────┘
```

### Task 6: 스킬 매트릭스 시드 데이터

CTR-KR 생산1팀 기준 샘플:
- 직원 5~8명 × 역량 8~10개 × 자기평가/매니저평가
- 의미 있는 갭이 발생하도록 데이터 설계 (PLC 갭 크게, 도전 강점으로)

### Task 7: 검증

```bash
# 1. 자기평가 + 매니저 평가
#    - 직원: 레벨 선택 + 코멘트 → 제출
#    - 매니저: 자기평가 참고하며 레벨 선택 → 저장

# 2. 히트맵
#    - 부서 선택 → 매트릭스 표시
#    - 색상 정확성 (기대 대비 레벨)

# 3. 레이더 차트
#    - 기대(점선) vs 실제(실선) 오버레이

# 4. 갭 리포트
#    - Top 5 갭/강점 정확성
#    - 부서별 히트맵

# 5. competency_requirements 연동
#    - expectedLevel이 없는 역량은 미평가(⬜) 표시
#    - 직급 변경 시 기대 수준 변동 반영

npx tsc --noEmit
npm run build
# context/TRACK_B.md 업데이트
```

---

## 산출물 체크리스트

- [ ] Prisma 모델 2개 (EmployeeSkillAssessment, SkillGapReport)
- [ ] 자기평가 UI (/my/skills)
- [ ] 매니저 평가 UI (/team/skills)
- [ ] 스킬 매트릭스 히트맵 (/organization/skill-matrix)
- [ ] 개인 레이더 차트 (기대 vs 실제)
- [ ] 부서/법인 스킬 갭 리포트
- [ ] 시드 데이터 (생산1팀 5~8명)
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] context/TRACK_B.md 업데이트

---

## context/TRACK_B.md 업데이트 내용 (세션 종료 시)

```markdown
## B8-3 완료 (날짜) — [B] 트랙

### DB 테이블
- employee_skill_assessments, skill_gap_reports

### 핵심 공식
- 스킬 갭 = competency_requirements.expectedLevel - employee_skill_assessments.finalLevel
- finalLevel = managerLevel (매니저 우선) ?? selfLevel (자기평가 fallback)

### 다음 세션 주의사항
- B4: Internal Mobility 스킬 매칭 고도화 가능 (employee_skill_assessments 참조)
- B10-1: 부서별 스킬 갭 → 팀 역량 지표
- B10-2: HR KPI에 평가 완료율, 갭 해소율 위젯
```

---

## 주의사항

1. **B8-2 스킬 태그(자유 텍스트) vs B3-1 역량(정형 데이터)** — 이 둘은 다릅니다. 스킬 태그는 직원이 자유롭게 입력("React", "3D프린팅"), 역량은 Admin이 관리하는 정형 목록. 스킬 매트릭스는 **B3-1 역량 기반**으로 평가합니다. B8-2 스킬 태그는 People Directory 검색/필터용.

2. **평가 주기와 스냅샷** — `assessmentPeriod`로 시점 관리. 같은 역량을 '2025-H1'과 '2025-H2'에 각각 평가하면 성장 추이를 볼 수 있습니다.

3. **미평가 역량 처리** — `competency_requirements`에 기대 수준이 있지만 `employee_skill_assessments`에 평가가 없으면 ⬜(미평가)로 표시. 갭 계산에서 제외하거나 "평가 필요" 경고를 표시하세요.

4. **레이더 차트 축 수 제한** — 역량이 15개 이상이면 레이더 차트가 읽기 어렵습니다. 카테고리별로 분리하거나, 핵심 역량 6~8개만 표시하세요.
