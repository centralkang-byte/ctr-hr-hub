# B3-2: Talent Review + AI 평가 리포트 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** B3-1의 역량 프레임워크 위에 9-Block Readiness 오버레이, 승계계획 강화, 직원 통합 사이드패널, AI 평가 초안, 편향 감지를 추가한다.

**Architecture:** 기존 STEP 6A 코드를 교체하지 않고 확장. 기존 SuccessionPlan/Candidate 모델에 필드 추가. 신규 AiEvaluationDraft + BiasDetectionLog 모델 추가. 규칙 기반 편향 감지는 LLM 불사용.

**Tech Stack:** Next.js App Router, Prisma ORM, PostgreSQL, Tailwind CSS, Anthropic SDK (`src/lib/claude.ts`), Zod, `withPermission`

---

## 핵심 컨벤션 (반드시 지킬 것)

```
@db.Uuid 사용 금지 — 기존 모델 전체 패턴
throw badRequest/notFound — return 아님
apiSuccess — 비배열 응답, apiPaginated — 배열 응답
migrate 이름: a_ 접두사 필수 (a_b3_talent_review)
Zod: parsed.error.issues (errors 아님)
```

---

## Task 1: DB Migration — 4개 신규 필드 + 2개 신규 모델

**Files:**
- Modify: `prisma/schema.prisma` (기존 모델 필드 추가 + 신규 모델 2개)
- Modify: `src/types/index.ts` (AiFeature enum에 EVAL_DRAFT_GENERATION 추가)

### Step 1: TRACK_B.md 확인 후 schema.prisma 수정

`prisma/schema.prisma`에서 다음 3개 위치를 수정:

**1a. OneOnOne 모델에 sentimentTag 추가** (line ~2179):
```prisma
model OneOnOne {
  id          String         @id @default(uuid())
  employeeId  String         @map("employee_id")
  managerId   String         @map("manager_id")
  scheduledAt DateTime       @map("scheduled_at")
  completedAt DateTime?      @map("completed_at")
  status      OneOnOneStatus
  meetingType OneOnOneType   @default(REGULAR) @map("meeting_type")
  agenda      String?
  notes       String?
  aiGuide     String?        @map("ai_guide")
  aiSummary   String?        @map("ai_summary")
  actionItems Json?          @map("action_items")
  sentimentTag String?       @map("sentiment_tag")  // ← 추가: 'positive'|'neutral'|'negative'|'concerned'
  createdAt   DateTime       @default(now()) @map("created_at")

  employee  Employee @relation("OneOnOneEmployee", fields: [employeeId], references: [id])
  manager   Employee @relation("OneOnOneManager", fields: [managerId], references: [id])
  company   Company  @relation(fields: [companyId], references: [id])
  companyId String   @map("company_id")

  @@map("one_on_ones")
}
```

**1b. SuccessionCandidate 모델에 ranking, developmentNote 추가** (line ~2718):
```prisma
model SuccessionCandidate {
  id               String    @id @default(uuid())
  planId           String    @map("plan_id")
  employeeId       String    @map("employee_id")
  readiness        Readiness
  developmentAreas Json?     @map("development_areas")
  notes            String?
  ranking          Int       @default(0)                    // ← 추가
  developmentNote  String?   @db.Text @map("development_note") // ← 추가
  nominatedBy      String    @map("nominated_by")
  createdAt        DateTime  @default(now()) @map("created_at")

  plan      SuccessionPlan @relation(fields: [planId], references: [id])
  employee  Employee       @relation("SuccessionCandidateEmployee", fields: [employeeId], references: [id])
  nominator Employee       @relation("SuccessionNominator", fields: [nominatedBy], references: [id])

  @@map("succession_candidates")
}
```

**1c. 신규 모델 2개 추가** (schema.prisma 맨 아래, `// === TRACK A: B3-2 ===` 구간):
```prisma
// ================================================================
// === TRACK A: B3-2 Talent Review ===
// ================================================================

model AiEvaluationDraft {
  id           String   @id @default(uuid())
  evaluationId String   @map("evaluation_id")
  employeeId   String   @map("employee_id")
  reviewerId   String   @map("reviewer_id")
  draftContent Json     @map("draft_content")
  inputSummary Json     @map("input_summary")
  status       String   @default("draft") @map("status")
  managerEdits Json?    @map("manager_edits")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  employee Employee @relation("AiDraftEmployee", fields: [employeeId], references: [id])
  reviewer Employee @relation("AiDraftReviewer", fields: [reviewerId], references: [id])
  company  Company  @relation(fields: [companyId], references: [id])
  companyId String  @map("company_id")

  @@map("ai_evaluation_drafts")
}

model BiasDetectionLog {
  id              String   @id @default(uuid())
  evaluationCycle String   @map("evaluation_cycle")
  reviewerId      String   @map("reviewer_id")
  companyId       String   @map("company_id")
  biasType        String   @map("bias_type")
  severity        String   @map("severity")
  description     String   @db.Text
  details         Json?
  isAcknowledged  Boolean  @default(false) @map("is_acknowledged")
  createdAt       DateTime @default(now()) @map("created_at")

  reviewer Employee @relation("BiasLogReviewer", fields: [reviewerId], references: [id])
  company  Company  @relation(fields: [companyId], references: [id])

  @@map("bias_detection_logs")
}
```

**1d. Employee 모델에 relations 추가** (Employee 모델 relations 섹션):
```prisma
// 기존 Employee 모델에 추가:
aiDraftsAsEmployee   AiEvaluationDraft[] @relation("AiDraftEmployee")
aiDraftsAsReviewer   AiEvaluationDraft[] @relation("AiDraftReviewer")
biasLogsAsReviewer   BiasDetectionLog[]  @relation("BiasLogReviewer")
```

**1e. Company 모델에 relations 추가**:
```prisma
// 기존 Company 모델에 추가:
aiEvaluationDrafts AiEvaluationDraft[]
biasDetectionLogs  BiasDetectionLog[]
```

**1f. AiFeature enum에 신규 값 추가** (schema.prisma):
```prisma
enum AiFeature {
  // ... 기존 값들 ...
  EVAL_DRAFT_GENERATION  // ← 추가
}
```

### Step 2: Migrate 실행

```bash
cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub
npx prisma migrate dev --name a_b3_talent_review
npx prisma generate
```

Expected: Migration applied successfully, Prisma Client regenerated.

### Step 3: TypeScript 컴파일 확인

```bash
npx tsc --noEmit
```

Expected: 0 errors. Relation 오류 있으면 Employee/Company 모델 relations 재확인.

### Step 4: Commit

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(b3-2): add AiEvaluationDraft, BiasDetectionLog models; add sentimentTag, ranking fields"
```

---

## Task 2: 직원 통합 사이드패널 (EmployeeInsightPanel)

9-Block, 승계계획, 평가 폼 등 여러 진입점에서 사용할 공통 컴포넌트를 먼저 만든다.

**Files:**
- Create: `src/app/api/v1/employees/[id]/insights/route.ts`
- Create: `src/components/performance/EmployeeInsightPanel.tsx`

### Step 1: Insights API 작성

`src/app/api/v1/employees/[id]/insights/route.ts`:
```typescript
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Insights (통합 사이드패널 데이터)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }, user: SessionUser) => {
    const { id } = await context.params

    const employee = await prisma.employee.findFirst({
      where: { id },
      select: { id: true, name: true },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    // 1. 최근 활성 MBO 목표 (최대 5개)
    const goals = await prisma.performanceGoal.findMany({
      where: { employeeId: id, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, title: true, weight: true,
        targetValue: true, actualValue: true, achievementRate: true,
        status: true,
      },
    })

    // 2. 최근 원온원 (최근 6개월, 최대 5건)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const oneOnOnes = await prisma.oneOnOne.findMany({
      where: {
        employeeId: id,
        status: 'COMPLETED',
        scheduledAt: { gte: sixMonthsAgo },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 5,
      select: {
        id: true, scheduledAt: true, notes: true,
        aiSummary: true, sentimentTag: true, meetingType: true,
      },
    })

    // 3. 최근 평가에서 BEI 역량 점수 (최신 매니저 평가 1건)
    const latestEval = await prisma.performanceEvaluation.findFirst({
      where: { employeeId: id, evalType: 'MANAGER' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, performanceScore: true, competencyScore: true,
        performanceGrade: true, competencyGrade: true,
        competencyDetail: true, emsBlock: true, status: true,
        cycle: { select: { name: true } },
      },
    })

    // 4. Succession readiness (최신 후보 등록 정보)
    const successionEntry = await prisma.successionCandidate.findFirst({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        readiness: true,
        developmentNote: true,
        ranking: true,
        plan: { select: { positionTitle: true, priority: true } },
      },
    })

    return apiSuccess({
      employee: { id: employee.id, name: employee.name },
      goals,
      oneOnOnes,
      latestEval,
      successionEntry,
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.READ),
)
```

**주의**: `PerformanceGoal.achievementRate`, `SuccessionPlan.priority` 필드가 없을 수 있음. 없으면 해당 select 제거 후 클라이언트에서 계산.

### Step 2: EmployeeInsightPanel 컴포넌트 작성

`src/components/performance/EmployeeInsightPanel.tsx`:
```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Target, MessageSquare, Award, Star, ChevronRight } from 'lucide-react'
import { apiClient } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────

interface InsightData {
  employee: { id: string; name: string }
  goals: {
    id: string; title: string; weight: number
    targetValue?: number | null; actualValue?: number | null
    achievementRate?: number | null; status: string
  }[]
  oneOnOnes: {
    id: string; scheduledAt: string; notes?: string | null
    aiSummary?: string | null; sentimentTag?: string | null; meetingType: string
  }[]
  latestEval: {
    id: string; performanceScore?: number | null; competencyScore?: number | null
    performanceGrade?: string | null; competencyGrade?: string | null
    emsBlock?: string | null; status: string
    cycle: { name: string }
    competencyDetail?: unknown
  } | null
  successionEntry: {
    readiness: string; developmentNote?: string | null; ranking: number
    plan: { positionTitle: string }
  } | null
}

const READINESS_BADGE: Record<string, { label: string; color: string; icon: string }> = {
  READY_NOW: { label: 'Ready Now', color: 'bg-[#D1FAE5] text-[#047857]', icon: '🟢' },
  READY_1_2_YEARS: { label: '1-2년 후', color: 'bg-[#FEF3C7] text-[#B45309]', icon: '🟡' },
  READY_3_PLUS_YEARS: { label: '개발 필요', color: 'bg-[#FEE2E2] text-[#B91C1C]', icon: '🔴' },
}

const SENTIMENT_ICON: Record<string, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😞',
  concerned: '😟',
}

// ─── Component ────────────────────────────────────────────

interface Props {
  employeeId: string | null
  employeeName?: string
  onClose: () => void
}

export default function EmployeeInsightPanel({ employeeId, employeeName, onClose }: Props) {
  const [data, setData] = useState<InsightData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchInsights = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await apiClient.get<InsightData>(`/api/v1/employees/${id}/insights`)
      setData(res.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (employeeId) fetchInsights(employeeId)
    else setData(null)
  }, [employeeId, fetchInsights])

  if (!employeeId) return null

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-[#E8E8E8] shadow-xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#E8E8E8] sticky top-0 bg-white">
        <div>
          <h2 className="text-base font-semibold text-[#1A1A1A]">
            {data?.employee.name ?? employeeName ?? '직원 정보'}
          </h2>
          <p className="text-xs text-[#999]">통합 인사이트</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-[#F5F5F5] rounded-lg">
          <X className="w-4 h-4 text-[#666]" />
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-[#999]">불러오는 중...</div>
      ) : !data ? (
        <div className="p-6 text-center text-sm text-[#999]">데이터를 불러올 수 없습니다.</div>
      ) : (
        <div className="p-4 space-y-5">

          {/* 1. 목표 달성률 */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-[#00C853]" />
              <span className="text-sm font-semibold text-[#333]">목표 달성률</span>
            </div>
            {data.goals.length === 0 ? (
              <p className="text-xs text-[#999]">등록된 목표 없음</p>
            ) : (
              <div className="space-y-1.5">
                {data.goals.map((goal) => (
                  <div key={goal.id} className="bg-[#FAFAFA] rounded-lg p-2.5">
                    <p className="text-xs font-medium text-[#333] truncate">{goal.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex-1 bg-[#E8E8E8] rounded-full h-1.5 mr-2">
                        <div
                          className="bg-[#00C853] h-1.5 rounded-full"
                          style={{ width: `${Math.min(goal.achievementRate ?? 0, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-[#333] whitespace-nowrap">
                        {goal.achievementRate != null ? `${Math.round(goal.achievementRate)}%` : '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2. 최근 원온원 */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-[#4338CA]" />
              <span className="text-sm font-semibold text-[#333]">
                최근 원온원 ({data.oneOnOnes.length}건)
              </span>
            </div>
            {data.oneOnOnes.length === 0 ? (
              <p className="text-xs text-[#999]">최근 6개월 원온원 없음</p>
            ) : (
              <div className="space-y-1.5">
                {data.oneOnOnes.map((o) => (
                  <div key={o.id} className="bg-[#FAFAFA] rounded-lg p-2.5 flex items-start gap-2">
                    <span className="text-base flex-shrink-0">
                      {SENTIMENT_ICON[o.sentimentTag ?? ''] ?? '💬'}
                    </span>
                    <div>
                      <p className="text-xs text-[#999]">
                        {new Date(o.scheduledAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                      </p>
                      <p className="text-xs text-[#333] line-clamp-2">
                        {o.aiSummary ?? o.notes ?? '노트 없음'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. 최근 평가 */}
          {data.latestEval && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-[#B45309]" />
                <span className="text-sm font-semibold text-[#333]">최근 평가</span>
                <span className="text-xs text-[#999]">({data.latestEval.cycle.name})</span>
              </div>
              <div className="bg-[#FAFAFA] rounded-lg p-2.5 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-[#999]">업적 등급</p>
                  <p className="text-sm font-semibold text-[#333]">
                    {data.latestEval.performanceGrade ?? '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#999]">역량 등급</p>
                  <p className="text-sm font-semibold text-[#333]">
                    {data.latestEval.competencyGrade ?? '-'}
                  </p>
                </div>
                {data.latestEval.emsBlock && (
                  <div className="col-span-2">
                    <p className="text-xs text-[#999]">EMS 블록</p>
                    <p className="text-sm font-semibold text-[#333]">{data.latestEval.emsBlock}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 4. Readiness */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-sm font-semibold text-[#333]">승계 준비도</span>
            </div>
            {data.successionEntry ? (
              <div className="bg-[#FAFAFA] rounded-lg p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${READINESS_BADGE[data.successionEntry.readiness]?.color ?? 'bg-[#F5F5F5] text-[#666]'}`}>
                    {READINESS_BADGE[data.successionEntry.readiness]?.icon}{' '}
                    {READINESS_BADGE[data.successionEntry.readiness]?.label ?? data.successionEntry.readiness}
                  </span>
                  <span className="text-xs text-[#999]">
                    {data.successionEntry.plan.positionTitle} 후보 #{data.successionEntry.ranking}
                  </span>
                </div>
                {data.successionEntry.developmentNote && (
                  <p className="text-xs text-[#666] mt-1">{data.successionEntry.developmentNote}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#999]">승계 계획 미등록</p>
            )}
          </section>

          {/* 5. 링크 버튼 */}
          <div className="pt-2 space-y-2">
            <a
              href={`/employees/${employeeId}`}
              className="flex items-center justify-between w-full px-3 py-2 bg-white border border-[#E8E8E8] rounded-lg hover:bg-[#FAFAFA] text-sm text-[#333]"
            >
              <span>직원 프로필 보기</span>
              <ChevronRight className="w-4 h-4 text-[#999]" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
```

### Step 3: TypeScript 확인

```bash
npx tsc --noEmit
```

Expected: 0 errors. `PerformanceGoal`에 `achievementRate` 필드가 없으면 schema에서 확인 후 select에서 제거.

### Step 4: Commit

```bash
git add src/app/api/v1/employees/[id]/insights/ src/components/performance/EmployeeInsightPanel.tsx
git commit -m "feat(b3-2): add EmployeeInsightPanel component and /employees/[id]/insights API"
```

---

## Task 3: 9-Block 확장 — Readiness 오버레이 + 사이드패널 연결

기존 `CalibrationClient.tsx`를 수정한다. 드래그앤드롭 동작을 건드리지 않는다.

**Files:**
- Modify: `src/app/(dashboard)/performance/calibration/CalibrationClient.tsx`

### Step 1: import 추가 + state 추가

파일 상단에:
```typescript
import EmployeeInsightPanel from '@/components/performance/EmployeeInsightPanel'
```

컴포넌트 state에:
```typescript
const [insightEmployeeId, setInsightEmployeeId] = useState<string | null>(null)
const [insightEmployeeName, setInsightEmployeeName] = useState<string>('')
const [readinessMap, setReadinessMap] = useState<Record<string, string>>({})  // employeeId → readiness
```

### Step 2: Readiness 데이터 로드

`loadSession` 함수 아래에 추가:
```typescript
const loadReadinessData = async (employeeIds: string[]) => {
  if (employeeIds.length === 0) return
  try {
    // succession_candidates에서 readiness 조회
    const res = await apiClient.post<{ employeeId: string; readiness: string }[]>(
      '/api/v1/succession/readiness-batch',
      { employeeIds },
    )
    const map: Record<string, string> = {}
    for (const item of res.data) map[item.employeeId] = item.readiness
    setReadinessMap(map)
  } catch {
    // Readiness 없으면 뱃지 미표시 (graceful)
  }
}
```

`loadSession` 함수 완료 후 `setSelectedSession` 바로 뒤에:
```typescript
setSelectedSession(res.data)
// Readiness 로드 (별도 API)
if (res.data.evaluations.length > 0) {
  loadReadinessData(res.data.evaluations.map((e) => e.employeeId))
}
```

### Step 3: 직원 칩 클릭 핸들러 추가

```typescript
const handleEmployeeChipClick = (ev: EvalItem) => {
  setInsightEmployeeId(ev.employeeId)
  setInsightEmployeeName(ev.employee.name)
}
```

### Step 4: buildBlockGrid 내 직원 칩 수정

기존 직원 이름 표시 부분을 찾아 클릭 이벤트 + Readiness 뱃지 추가:

```typescript
// 기존 직원 칩 (button 또는 div)을 찾아 수정
// 직원 이름 표시 요소 예시 (기존 코드 패턴에 맞게 수정):
<div
  key={ev.employeeId}
  className="group flex items-center gap-1 text-xs bg-white border border-[#E8E8E8] rounded-md px-1.5 py-0.5 cursor-pointer hover:border-[#00C853] hover:bg-[#E8F5E9] transition-colors"
  onClick={() => handleEmployeeChipClick(ev)}
>
  <span className="truncate max-w-[60px]">{ev.employee.name}</span>
  {readinessMap[ev.employeeId] && (
    <span className="flex-shrink-0">
      {readinessMap[ev.employeeId] === 'READY_NOW' ? '🟢'
        : readinessMap[ev.employeeId] === 'READY_1_2_YEARS' ? '🟡'
        : '🔴'}
    </span>
  )}
</div>
```

### Step 5: EmployeeInsightPanel 렌더링 추가

컴포넌트 JSX return 최상단(p-6 div 감싸기) 또는 반환 직전에:
```typescript
return (
  <>
    {/* 기존 JSX */}
    <div className="p-6 ...">
      ...
    </div>

    {/* 직원 통합 사이드패널 */}
    <EmployeeInsightPanel
      employeeId={insightEmployeeId}
      employeeName={insightEmployeeName}
      onClose={() => setInsightEmployeeId(null)}
    />
  </>
)
```

### Step 6: TypeScript 확인

```bash
npx tsc --noEmit
```

### Step 7: Commit

```bash
git add src/app/(dashboard)/performance/calibration/CalibrationClient.tsx
git commit -m "feat(b3-2): add Readiness overlay and EmployeeInsightPanel to 9-Block calibration"
```

---

## Task 4: Succession Readiness Batch API + 승계 후보 강화

**Files:**
- Create: `src/app/api/v1/succession/readiness-batch/route.ts`
- Modify: `src/app/api/v1/succession/plans/[id]/candidates/route.ts` (ranking, developmentNote 지원 추가)
- Modify: `src/components/succession/CandidateCard.tsx` (ranking, developmentNote 표시)

### Step 1: Readiness Batch API

`src/app/api/v1/succession/readiness-batch/route.ts`:
```typescript
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Succession Readiness Batch Query
// 직원 ID 목록으로 readiness 일괄 조회
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const bodySchema = z.object({
  employeeIds: z.array(z.string()).min(1).max(200),
})

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    const candidates = await prisma.successionCandidate.findMany({
      where: {
        employeeId: { in: parsed.data.employeeIds },
        plan: { companyId: user.companyId },
      },
      select: { employeeId: true, readiness: true, ranking: true },
      orderBy: { ranking: 'asc' },
      distinct: ['employeeId'],  // 직원당 최우선 후보 1건만
    })

    return apiSuccess(
      candidates.map((c) => ({
        employeeId: c.employeeId,
        readiness: c.readiness,
        ranking: c.ranking,
      })),
    )
  },
  perm(MODULE.SUCCESSION, ACTION.READ),
)
```

### Step 2: 후보자 API - ranking, developmentNote 지원 추가

기존 `src/app/api/v1/succession/plans/[id]/candidates/route.ts`의 POST 핸들러에서 Zod 스키마 수정:
```typescript
// 기존 스키마에 추가:
const createCandidateSchema = z.object({
  employeeId: z.string(),
  readiness: z.enum(['READY_NOW', 'READY_1_2_YEARS', 'READY_3_PLUS_YEARS']),
  ranking: z.number().int().min(0).default(0),              // ← 추가
  developmentNote: z.string().max(1000).optional(),         // ← 추가
  notes: z.string().max(1000).optional(),
})
```

Prisma create 호출에도 추가:
```typescript
await prisma.successionCandidate.create({
  data: {
    ...existing_fields,
    ranking: parsed.data.ranking ?? 0,
    developmentNote: parsed.data.developmentNote ?? null,
  },
})
```

### Step 3: CandidateCard에 ranking, developmentNote 표시

`src/components/succession/CandidateCard.tsx`에서 기존 카드에 추가:
```typescript
// ranking 표시 (기존 카드 제목 옆):
{candidate.ranking > 0 && (
  <span className="text-xs text-[#999] ml-1">#{candidate.ranking}</span>
)}

// developmentNote 표시 (카드 하단):
{candidate.developmentNote && (
  <p className="text-xs text-[#666] mt-1.5 border-t border-[#F5F5F5] pt-1.5">
    {candidate.developmentNote}
  </p>
)}
```

### Step 4: TypeScript 확인

```bash
npx tsc --noEmit
```

Expected: 0 errors. `distinct` 지원 확인 (Prisma 4.x+).

### Step 5: Commit

```bash
git add src/app/api/v1/succession/ src/components/succession/CandidateCard.tsx
git commit -m "feat(b3-2): add readiness-batch API; add ranking/developmentNote to succession candidates"
```

---

## Task 5: AI 평가 초안 생성

**Files:**
- Modify: `src/lib/claude.ts` (generateEvaluationDraft 함수 추가)
- Create: `src/app/api/v1/performance/evaluations/[id]/ai-draft/route.ts`
- Create: `src/components/performance/AiDraftModal.tsx`
- Modify: `src/app/(dashboard)/performance/manager-eval/ManagerEvalClient.tsx`

### Step 1: claude.ts에 generateEvaluationDraft 추가

`src/lib/claude.ts` 맨 아래에 추가:

```typescript
// ─── Evaluation Draft Generation ─────────────────────────

export interface EvalDraftInput {
  employee: {
    name: string
    jobLevel?: string | null
    department?: string | null
    tenureMonths?: number
  }
  mboGoals: { title: string; achievementRate?: number | null }[]
  oneOnOnes: { date: string; summary?: string | null; sentimentTag?: string | null }[]
  beiScores?: { competency: string; score?: number | null }[]
  previousEval?: { grade?: string | null; comment?: string | null } | null
  evalType: 'SELF' | 'MANAGER'
}

export interface EvalDraftResult {
  performanceComment: string
  competencyComment?: string
  strengths: string[]
  developmentAreas: string[]
  overallOpinion: string
  recommendedGrade?: string
  reviewNeededTags: string[]
}

export async function generateEvaluationDraft(
  input: EvalDraftInput,
  companyId: string,
  reviewerId: string,
): Promise<EvalDraftResult> {
  const goalLines = input.mboGoals.length > 0
    ? input.mboGoals.map((g) => `- ${g.title}: 달성률 ${g.achievementRate != null ? `${Math.round(g.achievementRate)}%` : '미입력'}`).join('\n')
    : '- 목표 없음'

  const oneOnOneLines = input.oneOnOnes.length > 0
    ? input.oneOnOnes.map((o) => `- ${o.date}${o.sentimentTag ? ` [${o.sentimentTag}]` : ''}: ${o.summary ?? '요약 없음'}`).join('\n')
    : '- 원온원 기록 없음'

  const beiLines = input.beiScores && input.beiScores.length > 0
    ? input.beiScores.map((b) => `- ${b.competency}: ${b.score != null ? `${b.score}/5` : '미평가'}`).join('\n')
    : null

  const prevEvalLine = input.previousEval
    ? `전기 평가: ${input.previousEval.grade ?? '미기재'} / ${input.previousEval.comment ?? '코멘트 없음'}`
    : null

  const prompt = `당신은 CTR Holdings의 HR 전문가입니다. 아래 데이터를 바탕으로 공정하고 구체적인 평가 초안을 작성하세요.
판단이 아닌 사실 기반으로 작성하고, 주관적 해석 또는 데이터 부족 부분은 "[매니저 검토 필요]" 태그를 붙여주세요.

직원: ${input.employee.name}${input.employee.jobLevel ? ` (${input.employee.jobLevel})` : ''}${input.employee.department ? ` · ${input.employee.department}` : ''}${input.employee.tenureMonths != null ? ` · 재직 ${input.employee.tenureMonths}개월` : ''}
평가 유형: ${input.evalType === 'MANAGER' ? '매니저 평가' : '자기 평가'}

목표 달성 현황:
${goalLines}

최근 원온원 요약:
${oneOnOneLines}

${beiLines ? `BEI 역량 점수:\n${beiLines}\n` : ''}
${prevEvalLine ? `${prevEvalLine}\n` : ''}

아래 JSON 형식으로만 응답하세요:
{
  "performanceComment": "업적 평가 코멘트 (200자 이내)",
  "competencyComment": "역량 평가 코멘트 (200자 이내, BEI 데이터 없으면 null)",
  "strengths": ["강점 1", "강점 2", "강점 3"],
  "developmentAreas": ["개발 영역 1", "개발 영역 2"],
  "overallOpinion": "종합 소견 (300자 이내)",
  "recommendedGrade": "추천 등급 코드 또는 null (참고용)",
  "reviewNeededTags": ["[매니저 검토 필요] 태그가 붙은 항목 목록"]
}`

  const result = await callClaude({
    feature: 'EVAL_DRAFT_GENERATION',
    prompt,
    systemPrompt: 'You are an HR performance evaluation specialist for CTR Holdings. Respond only in Korean with valid JSON.',
    maxTokens: 1536,
    companyId,
    employeeId: reviewerId,
  })

  try {
    return JSON.parse(result.content) as EvalDraftResult
  } catch {
    throw serviceUnavailable('AI 평가 초안 생성에 실패했습니다.')
  }
}
```

### Step 2: AI Draft API Route 작성

`src/app/api/v1/performance/evaluations/[id]/ai-draft/route.ts`:
```typescript
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AI Evaluation Draft
// POST: 초안 생성 | GET: 초안 조회
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { generateEvaluationDraft } from '@/lib/claude'
import type { SessionUser } from '@/types'

// GET: 기존 초안 조회
export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }, user: SessionUser) => {
    const { id: evaluationId } = await context.params

    const draft = await prisma.aiEvaluationDraft.findFirst({
      where: { evaluationId, companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
    })

    return apiSuccess(draft)
  },
  perm(MODULE.PERFORMANCE, ACTION.READ),
)

// POST: AI 초안 생성
export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }, user: SessionUser) => {
    const { id: evaluationId } = await context.params

    // 평가 레코드 확인
    const evaluation = await prisma.performanceEvaluation.findFirst({
      where: { id: evaluationId, companyId: user.companyId },
      select: {
        id: true, employeeId: true, evaluatorId: true, cycleId: true,
        employee: {
          select: {
            name: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: {
                jobGrade: { select: { name: true } },
                department: { select: { name: true } },
              },
            },
          },
        },
        cycle: { select: { name: true } },
      },
    })
    if (!evaluation) throw notFound('평가를 찾을 수 없습니다.')

    // 매니저만 생성 가능 (evaluatorId = 요청자)
    if (evaluation.evaluatorId !== user.id && user.role !== 'HR_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw forbidden('AI 초안은 평가자만 생성할 수 있습니다.')
    }

    const assignment = evaluation.employee.assignments[0]

    // 입력 데이터 수집
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const [goals, oneOnOnes, prevEval] = await Promise.all([
      prisma.performanceGoal.findMany({
        where: { employeeId: evaluation.employeeId, cycleId: evaluation.cycleId },
        select: { title: true, achievementRate: true },
        take: 10,
      }),
      prisma.oneOnOne.findMany({
        where: {
          employeeId: evaluation.employeeId,
          managerId: evaluation.evaluatorId,
          status: 'COMPLETED',
          scheduledAt: { gte: sixMonthsAgo },
        },
        orderBy: { scheduledAt: 'desc' },
        take: 6,
        select: { scheduledAt: true, aiSummary: true, notes: true, sentimentTag: true },
      }),
      prisma.performanceEvaluation.findFirst({
        where: { employeeId: evaluation.employeeId, evalType: 'MANAGER', id: { not: evaluationId } },
        orderBy: { createdAt: 'desc' },
        select: { performanceGrade: true, comment: true },
      }),
    ])

    const draftInput = {
      employee: {
        name: evaluation.employee.name,
        jobLevel: assignment?.jobGrade?.name ?? null,
        department: assignment?.department?.name ?? null,
      },
      mboGoals: goals.map((g) => ({
        title: g.title,
        achievementRate: g.achievementRate != null ? Number(g.achievementRate) : null,
      })),
      oneOnOnes: oneOnOnes.map((o) => ({
        date: o.scheduledAt.toLocaleDateString('ko-KR'),
        summary: o.aiSummary ?? o.notes ?? null,
        sentimentTag: o.sentimentTag ?? null,
      })),
      previousEval: prevEval ? { grade: prevEval.performanceGrade, comment: prevEval.comment } : null,
      evalType: 'MANAGER' as const,
    }

    // AI 초안 생성
    const draftContent = await generateEvaluationDraft(draftInput, user.companyId, user.id)

    // DB 저장
    const saved = await prisma.aiEvaluationDraft.create({
      data: {
        evaluationId,
        employeeId: evaluation.employeeId,
        reviewerId: user.id,
        companyId: user.companyId,
        draftContent,
        inputSummary: {
          goalCount: goals.length,
          oneOnOneCount: oneOnOnes.length,
          hasPrevEval: !!prevEval,
          generatedAt: new Date().toISOString(),
        },
        status: 'draft',
      },
    })

    return apiSuccess(saved)
  },
  perm(MODULE.PERFORMANCE, ACTION.UPDATE),
)
```

**주의**: `PerformanceGoal.achievementRate`, `cycleId` 필드 존재 여부 확인. 없으면 where 조건 수정.

### Step 3: AiDraftModal 컴포넌트 작성

`src/components/performance/AiDraftModal.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { X, Sparkles, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface DraftContent {
  performanceComment: string
  competencyComment?: string | null
  strengths: string[]
  developmentAreas: string[]
  overallOpinion: string
  recommendedGrade?: string | null
  reviewNeededTags: string[]
}

interface AiDraftData {
  id: string
  draftContent: DraftContent
  inputSummary: { goalCount: number; oneOnOneCount: number; hasPrevEval: boolean; generatedAt: string }
  status: string
}

interface Props {
  evaluationId: string
  onClose: () => void
  onApply: (draft: DraftContent) => void
}

export default function AiDraftModal({ evaluationId, onClose, onApply }: Props) {
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<AiDraftData | null>(null)
  const [generated, setGenerated] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await apiClient.post<AiDraftData>(
        `/api/v1/performance/evaluations/${evaluationId}/ai-draft`,
        {},
      )
      setDraft(res.data)
      setGenerated(true)
    } catch {
      alert('AI 초안 생성에 실패했습니다. 잠시 후 다시 시도하세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (draft) {
      onApply(draft.draftContent)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E8E8E8]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#4338CA]" />
            <h2 className="text-lg font-semibold text-[#1A1A1A]">AI 평가 초안 생성</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#F5F5F5] rounded-lg">
            <X className="w-4 h-4 text-[#666]" />
          </button>
        </div>

        {/* Disclaimer */}
        <div className="mx-5 mt-4 p-3 bg-[#E0E7FF] rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#4338CA] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#4338CA]">
            이 초안은 AI가 생성한 참고 자료이며, 매니저의 검토와 수정이 필요합니다.
            <strong> AI 추천 등급은 최종 결정이 아닙니다.</strong>
          </p>
        </div>

        <div className="p-5">
          {!generated ? (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 text-[#E0E7FF] mx-auto mb-3" />
              <p className="text-sm text-[#666] mb-6">
                목표 달성률, 원온원 기록, BEI 점수를 분석하여 평가 초안을 생성합니다.
              </p>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4338CA] hover:bg-[#3730A3] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    생성 중... (약 5초 소요)
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    AI 초안 생성
                  </>
                )}
              </button>
            </div>
          ) : draft ? (
            <div className="space-y-4">
              {/* 입력 데이터 요약 */}
              <div className="bg-[#FAFAFA] rounded-lg p-3 text-xs text-[#666] flex gap-3">
                <span>목표 {draft.inputSummary.goalCount}개</span>
                <span>원온원 {draft.inputSummary.oneOnOneCount}건</span>
                <span>{draft.inputSummary.hasPrevEval ? '전기 평가 참조' : '전기 평가 없음'}</span>
              </div>

              {/* 업적 평가 */}
              <div>
                <label className="text-xs font-semibold text-[#333] mb-1 block">업적 평가</label>
                <p className="text-sm text-[#333] bg-[#FAFAFA] rounded-lg p-3 whitespace-pre-wrap">
                  {draft.draftContent.performanceComment}
                </p>
              </div>

              {/* 역량 평가 (있을 때만) */}
              {draft.draftContent.competencyComment && (
                <div>
                  <label className="text-xs font-semibold text-[#333] mb-1 block">역량 평가</label>
                  <p className="text-sm text-[#333] bg-[#FAFAFA] rounded-lg p-3 whitespace-pre-wrap">
                    {draft.draftContent.competencyComment}
                  </p>
                </div>
              )}

              {/* 강점 / 개발 영역 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#047857] mb-1 block">강점</label>
                  <ul className="space-y-1">
                    {draft.draftContent.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-[#333] flex items-start gap-1">
                        <span className="text-[#00C853]">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#B45309] mb-1 block">개발 영역</label>
                  <ul className="space-y-1">
                    {draft.draftContent.developmentAreas.map((d, i) => (
                      <li key={i} className="text-xs text-[#333] flex items-start gap-1">
                        <span className="text-[#F59E0B]">•</span> {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 종합 소견 */}
              <div>
                <label className="text-xs font-semibold text-[#333] mb-1 block">종합 소견</label>
                <p className="text-sm text-[#333] bg-[#FAFAFA] rounded-lg p-3 whitespace-pre-wrap">
                  {draft.draftContent.overallOpinion}
                </p>
              </div>

              {/* 추천 등급 (흐린 색으로) */}
              {draft.draftContent.recommendedGrade && (
                <div className="bg-[#F5F5F5] rounded-lg p-3 flex items-center gap-2">
                  <span className="text-xs text-[#999]">AI 추천 등급 (참고용):</span>
                  <span className="text-sm text-[#999] line-through">
                    {draft.draftContent.recommendedGrade}
                  </span>
                  <span className="text-xs text-[#999]">(매니저가 직접 선택)</span>
                </div>
              )}

              {/* 검토 필요 태그 */}
              {draft.draftContent.reviewNeededTags.length > 0 && (
                <div className="bg-[#FEF3C7] rounded-lg p-3">
                  <p className="text-xs font-semibold text-[#B45309] mb-1">검토 필요 항목</p>
                  <ul className="space-y-0.5">
                    {draft.draftContent.reviewNeededTags.map((tag, i) => (
                      <li key={i} className="text-xs text-[#B45309]">• {tag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex justify-between pt-2">
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-4 py-2 border border-[#FCA5A5] text-[#DC2626] rounded-lg text-sm hover:bg-[#FEE2E2]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  폐기
                </button>
                <button
                  onClick={handleApply}
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-sm font-medium"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  초안 적용
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
```

### Step 4: ManagerEvalClient에 AI 초안 버튼 추가

`src/app/(dashboard)/performance/manager-eval/ManagerEvalClient.tsx`에서:

1. import 추가: `import AiDraftModal from '@/components/performance/AiDraftModal'`
2. state 추가: `const [showAiDraft, setShowAiDraft] = useState(false)`
3. `handleApplyDraft` 함수 추가:
```typescript
const handleApplyDraft = (draft: { performanceComment: string; overallOpinion: string }) => {
  setOverallComment(draft.overallOpinion)
  // 필요시 추가 필드 적용
}
```
4. 평가 폼의 저장/제출 버튼 옆에 AI 초안 버튼 추가:
```typescript
{selectedEmployee && (
  <button
    onClick={() => setShowAiDraft(true)}
    className="flex items-center gap-1.5 px-3 py-2 border border-[#C7D2FE] bg-[#E0E7FF] text-[#4338CA] rounded-lg text-sm"
  >
    <Sparkles className="w-4 h-4" />
    AI 초안 생성
  </button>
)}
```
5. 모달 렌더링 (현재 선택된 팀원의 평가 ID를 넘겨야 함):
```typescript
{showAiDraft && selectedEvaluationId && (
  <AiDraftModal
    evaluationId={selectedEvaluationId}
    onClose={() => setShowAiDraft(false)}
    onApply={handleApplyDraft}
  />
)}
```
**주의**: `selectedEvaluationId`는 기존 코드에서 어떻게 추적하는지 확인 후 연결.

### Step 5: TypeScript 확인

```bash
npx tsc --noEmit
```

### Step 6: Commit

```bash
git add src/lib/claude.ts src/app/api/v1/performance/evaluations/ src/components/performance/AiDraftModal.tsx src/app/(dashboard)/performance/manager-eval/ManagerEvalClient.tsx
git commit -m "feat(b3-2): add AI evaluation draft generation with AiDraftModal and generateEvaluationDraft"
```

---

## Task 6: 편향 감지 시스템

**Files:**
- Create: `src/app/api/v1/performance/evaluations/bias-check/route.ts`
- Create: `src/components/performance/BiasDetectionBanner.tsx`
- Modify: `src/app/(dashboard)/performance/calibration/CalibrationClient.tsx`

### Step 1: Bias Check API

`src/app/api/v1/performance/evaluations/bias-check/route.ts`:
```typescript
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bias Detection (규칙 기반, LLM 불사용)
// POST: 분석 실행 + 저장 | GET: 로그 조회
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// GET: 편향 로그 목록 조회
export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const cycleId = params.cycleId as string | undefined
    const acknowledged = params.acknowledged === 'false' ? false : undefined

    const logs = await prisma.biasDetectionLog.findMany({
      where: {
        companyId: user.companyId,
        ...(acknowledged !== undefined ? { isAcknowledged: acknowledged } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return apiSuccess(logs)
  },
  perm(MODULE.PERFORMANCE, ACTION.READ),
)

const checkSchema = z.object({
  cycleId: z.string(),
  reviewerIds: z.array(z.string()).optional(), // 특정 평가자만 분석 (없으면 전체)
})

// POST: 편향 감지 실행
export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = await req.json()
    const parsed = checkSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    const { cycleId, reviewerIds } = parsed.data

    // 해당 사이클의 MANAGER 평가 목록 조회
    const evaluations = await prisma.performanceEvaluation.findMany({
      where: {
        cycleId,
        companyId: user.companyId,
        evalType: 'MANAGER',
        ...(reviewerIds ? { evaluatorId: { in: reviewerIds } } : {}),
      },
      select: {
        evaluatorId: true,
        performanceGrade: true,
        competencyGrade: true,
        employeeId: true,
        employee: {
          select: {
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: { startDate: true },
            },
          },
        },
      },
    })

    // 평가자별 그룹화
    const byReviewer: Record<string, typeof evaluations> = {}
    for (const ev of evaluations) {
      if (!byReviewer[ev.evaluatorId]) byReviewer[ev.evaluatorId] = []
      byReviewer[ev.evaluatorId].push(ev)
    }

    // 사이클 이름 조회
    const cycle = await prisma.performanceCycle.findUnique({
      where: { id: cycleId },
      select: { name: true },
    })
    const cycleName = cycle?.name ?? cycleId

    const detectedLogs: {
      reviewerId: string; biasType: string; severity: string
      description: string; details: object
    }[] = []

    // 편향 감지 임계값 (기본값 — evaluation_settings에서 override 가능)
    const THRESHOLDS = {
      centralTendency: { warning: 0.6, critical: 0.8 },
      leniency: { warning: 0.7, critical: 0.85 },
      severity: { warning: 0.7, critical: 0.85 },
    }

    for (const [reviewerId, evals] of Object.entries(byReviewer)) {
      if (evals.length < 3) continue // 최소 3개 이상 평가 시에만 분석

      const grades = evals.map((e) => e.performanceGrade).filter(Boolean) as string[]
      if (grades.length === 0) continue

      // 등급 분포 계산
      const gradeCounts: Record<string, number> = {}
      for (const g of grades) gradeCounts[g] = (gradeCounts[g] ?? 0) + 1

      const total = grades.length
      const maxGradeRatio = Math.max(...Object.values(gradeCounts)) / total

      // 1. Central Tendency (중심화 경향)
      if (maxGradeRatio >= THRESHOLDS.centralTendency.warning) {
        const topGrade = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1])[0]
        const severity = maxGradeRatio >= THRESHOLDS.centralTendency.critical ? 'critical' : 'warning'
        detectedLogs.push({
          reviewerId,
          biasType: 'central_tendency',
          severity,
          description: `이 평가자의 등급 분포가 '${topGrade[0]}' 등급에 ${Math.round(maxGradeRatio * 100)}% 집중되어 있습니다.`,
          details: { gradeCounts, total, topGrade: topGrade[0], ratio: maxGradeRatio },
        })
      }

      // 2. Leniency (관대화) — 상위 2개 등급 집중
      // 등급 코드 정렬: S, A, B, C, D 또는 E, M, P 등 — 임시로 알파벳 역순 상위 2개
      const sortedGrades = Object.keys(gradeCounts).sort().reverse()
      const top2Grades = sortedGrades.slice(0, 2)
      const top2Count = top2Grades.reduce((sum, g) => sum + (gradeCounts[g] ?? 0), 0)
      const top2Ratio = top2Count / total
      if (top2Ratio >= THRESHOLDS.leniency.warning && total >= 5) {
        const severity = top2Ratio >= THRESHOLDS.leniency.critical ? 'critical' : 'warning'
        detectedLogs.push({
          reviewerId,
          biasType: 'leniency',
          severity,
          description: `상위 등급(${top2Grades.join(', ')})에 ${Math.round(top2Ratio * 100)}% 집중 — 관대화 경향이 의심됩니다.`,
          details: { gradeCounts, top2Grades, top2Ratio, total },
        })
      }
    }

    // 감지된 로그 저장 (기존 로그 먼저 삭제 후 재저장)
    if (detectedLogs.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.biasDetectionLog.deleteMany({
          where: {
            companyId: user.companyId,
            evaluationCycle: cycleName,
          },
        })
        await tx.biasDetectionLog.createMany({
          data: detectedLogs.map((log) => ({
            ...log,
            companyId: user.companyId,
            evaluationCycle: cycleName,
            details: log.details as object,
          })),
        })
      })
    }

    return apiSuccess({
      analyzed: Object.keys(byReviewer).length,
      detected: detectedLogs.length,
      logs: detectedLogs,
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.MANAGE),
)
```

### Step 2: BiasDetectionBanner 컴포넌트

`src/components/performance/BiasDetectionBanner.tsx`:
```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface BiasLog {
  id: string; reviewerId: string; biasType: string; severity: string
  description: string; isAcknowledged: boolean; createdAt: string
}

interface Props {
  cycleId: string
  onRunCheck?: () => void
}

const BIAS_TYPE_LABEL: Record<string, string> = {
  central_tendency: '중심화 경향',
  leniency: '관대화',
  severity: '엄격화',
  recency: '최근 편향',
  tenure: '재직기간 편향',
  gender: '성별 편향',
}

const SEVERITY_STYLE: Record<string, string> = {
  info: 'bg-[#E0E7FF] text-[#4338CA]',
  warning: 'bg-[#FEF3C7] text-[#B45309]',
  critical: 'bg-[#FEE2E2] text-[#B91C1C]',
}

export default function BiasDetectionBanner({ cycleId, onRunCheck }: Props) {
  const [logs, setLogs] = useState<BiasLog[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)

  const fetchLogs = useCallback(async () => {
    if (!cycleId) return
    setLoading(true)
    try {
      const res = await apiClient.get<BiasLog[]>('/api/v1/performance/evaluations/bias-check', {
        acknowledged: 'false',
      })
      setLogs(Array.isArray(res.data) ? res.data : [])
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [cycleId])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const handleRunCheck = async () => {
    setChecking(true)
    try {
      await apiClient.post('/api/v1/performance/evaluations/bias-check', { cycleId })
      await fetchLogs()
      onRunCheck?.()
    } catch {
      alert('편향 감지 분석에 실패했습니다.')
    } finally {
      setChecking(false)
    }
  }

  if (loading) return null
  if (logs.length === 0) return (
    <div className="flex items-center justify-between bg-[#D1FAE5] rounded-lg px-4 py-2.5 mb-4">
      <p className="text-xs text-[#047857]">편향 감지: 현재 경고 없음</p>
      <button
        onClick={handleRunCheck}
        disabled={checking}
        className="text-xs text-[#047857] underline"
      >
        {checking ? '분석 중...' : '재분석'}
      </button>
    </div>
  )

  const criticalCount = logs.filter((l) => l.severity === 'critical').length
  const warningCount = logs.filter((l) => l.severity === 'warning').length

  return (
    <div className={`rounded-lg border mb-4 ${criticalCount > 0 ? 'border-[#FCA5A5] bg-[#FEE2E2]' : 'border-[#FCD34D] bg-[#FEF3C7]'}`}>
      {/* 배너 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${criticalCount > 0 ? 'text-[#B91C1C]' : 'text-[#B45309]'}`} />
          <span className={`text-sm font-medium ${criticalCount > 0 ? 'text-[#B91C1C]' : 'text-[#B45309]'}`}>
            편향 감지 알림 ({logs.length}건)
            {criticalCount > 0 && <span className="ml-1 text-xs">— Critical {criticalCount}건</span>}
            {warningCount > 0 && <span className="ml-1 text-xs">— Warning {warningCount}건</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunCheck}
            disabled={checking}
            className="text-xs text-[#666] underline"
          >
            {checking ? '분석 중...' : '재분석'}
          </button>
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-4 h-4 text-[#666]" /> : <ChevronDown className="w-4 h-4 text-[#666]" />}
          </button>
        </div>
      </div>

      {/* 상세 목록 */}
      {expanded && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-[#E8E8E8]">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 py-1.5">
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${SEVERITY_STYLE[log.severity] ?? ''}`}>
                {log.severity.toUpperCase()}
              </span>
              <div>
                <span className="text-xs font-medium text-[#333]">
                  {BIAS_TYPE_LABEL[log.biasType] ?? log.biasType}
                </span>
                <p className="text-xs text-[#666]">{log.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Step 3: CalibrationClient에 BiasDetectionBanner 연결

`CalibrationClient.tsx`에서:
```typescript
import BiasDetectionBanner from '@/components/performance/BiasDetectionBanner'
```

캘리브레이션 세션 상세 뷰 상단에 추가:
```typescript
{selectedSession && selectedCycleId && (
  <BiasDetectionBanner
    cycleId={selectedCycleId}
    onRunCheck={() => loadSession(selectedSession.id)}
  />
)}
```

### Step 4: TypeScript 확인

```bash
npx tsc --noEmit
```

### Step 5: Commit

```bash
git add src/app/api/v1/performance/evaluations/bias-check/ src/components/performance/BiasDetectionBanner.tsx src/app/(dashboard)/performance/calibration/CalibrationClient.tsx
git commit -m "feat(b3-2): add bias detection system with BiasDetectionBanner and bias-check API"
```

---

## Task 7: OneOnOne sentimentTag UI 연결

**Files:**
- Modify: `src/app/(dashboard)/performance/one-on-one/[id]/OneOnOneDetailClient.tsx`

### Step 1: sentimentTag 선택 UI 추가

기존 원온원 상세 폼에서 `notes` 입력 아래에 추가:
```typescript
{/* 감정 태그 */}
<div>
  <label className="text-sm font-medium text-[#333] mb-2 block">미팅 분위기</label>
  <div className="flex gap-2">
    {[
      { value: 'positive', label: '긍정적', emoji: '😊' },
      { value: 'neutral', label: '보통', emoji: '😐' },
      { value: 'negative', label: '부정적', emoji: '😞' },
      { value: 'concerned', label: '우려됨', emoji: '😟' },
    ].map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => setSentimentTag(opt.value)}
        className={`flex flex-col items-center px-3 py-2 rounded-lg border text-xs transition-colors ${
          sentimentTag === opt.value
            ? 'border-[#00C853] bg-[#E8F5E9] text-[#00A844]'
            : 'border-[#E8E8E8] hover:border-[#D4D4D4] text-[#666]'
        }`}
      >
        <span className="text-base mb-0.5">{opt.emoji}</span>
        {opt.label}
      </button>
    ))}
  </div>
</div>
```

state 추가: `const [sentimentTag, setSentimentTag] = useState<string | null>(null)`

API 호출 시 sentimentTag 포함: `{ ...existingData, sentimentTag }`

기존 원온원 PUT/PATCH API에서 sentimentTag 수신:
```typescript
// 기존 oneOnOne update API에 sentimentTag 추가
sentimentTag: z.string().max(20).optional().nullable(),
```

### Step 2: TypeScript 확인

```bash
npx tsc --noEmit
```

### Step 3: Commit

```bash
git add src/app/(dashboard)/performance/one-on-one/
git commit -m "feat(b3-2): add sentimentTag selection to OneOnOne detail form"
```

---

## Task 8: 승계계획 /talent/succession 라우트 + 사이드패널 연결

**Files:**
- Create: `src/app/(dashboard)/talent/succession/page.tsx` (기존 컴포넌트 재사용)
- Modify: `src/app/(dashboard)/succession/page.tsx` (리다이렉트 추가)
- Modify: `src/config/navigation.ts` (href 수정)
- Modify: `src/components/succession/CandidateCard.tsx` (EmployeeInsightPanel 연결)

### Step 1: /talent/succession 신규 페이지

`src/app/(dashboard)/talent/succession/page.tsx`:
```typescript
// 기존 /succession/page.tsx를 그대로 복사하거나 import로 재사용
// 기존 /succession/page.tsx 내용을 확인 후 동일한 구조로 작성
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import SuccessionClient from '@/app/(dashboard)/succession/SuccessionClient'

export default async function TalentSuccessionPage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')
  return <SuccessionClient />
}
```

### Step 2: 기존 /succession 리다이렉트 (선택)

기존 `/succession/page.tsx`에 redirect 추가 (선택사항 — 사이드바 href 변경으로 대체 가능):

`src/config/navigation.ts`에서 succession href 수정:
```typescript
// 기존:
href: '/succession',
// 변경:
href: '/talent/succession',
```

### Step 3: CandidateCard에 EmployeeInsightPanel 연결

```typescript
import { useState } from 'react'
import EmployeeInsightPanel from '@/components/performance/EmployeeInsightPanel'

// 카드 내부:
const [showInsight, setShowInsight] = useState(false)

// 카드 클릭 시:
<button onClick={() => setShowInsight(true)} className="text-xs text-[#00C853] underline">
  상세 보기
</button>

{showInsight && (
  <EmployeeInsightPanel
    employeeId={candidate.employeeId}
    employeeName={candidate.employee.name}
    onClose={() => setShowInsight(false)}
  />
)}
```

### Step 4: TypeScript 확인

```bash
npx tsc --noEmit
```

### Step 5: Commit

```bash
git add src/app/(dashboard)/talent/succession/ src/config/navigation.ts src/components/succession/CandidateCard.tsx
git commit -m "feat(b3-2): add /talent/succession route; connect EmployeeInsightPanel to succession"
```

---

## Task 9: 최종 검증 + TRACK_A.md 업데이트

### Step 1: TypeScript 전체 확인

```bash
cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub
npx tsc --noEmit
```

Expected: 0 errors.

### Step 2: Build 확인

```bash
npm run build
```

Expected: Build succeeded.

### Step 3: TRACK_A.md 업데이트

`context/TRACK_A.md`에 B3-2 완료 내용 추가:
```markdown
## B3-2 완료 (2026-03-02)

### DB 테이블
- ai_evaluation_drafts (AiEvaluationDraft)
- bias_detection_logs (BiasDetectionLog)
- OneOnOne.sentimentTag 필드 추가
- SuccessionCandidate.ranking, developmentNote 필드 추가
- migrate 이름: a_b3_talent_review

### 핵심 기능
- 9-Block: Readiness 뱃지 오버레이 + 직원 클릭 → EmployeeInsightPanel
- 승계계획: /talent/succession (기존 /succession 재사용)
- 직원 통합 사이드패널: GET /api/v1/employees/[id]/insights
- AI 평가 초안: POST /api/v1/performance/evaluations/[id]/ai-draft
- 편향 감지: POST/GET /api/v1/performance/evaluations/bias-check
- OneOnOne: sentimentTag 선택 UI

### 신규 컴포넌트
- src/components/performance/EmployeeInsightPanel.tsx
- src/components/performance/AiDraftModal.tsx
- src/components/performance/BiasDetectionBanner.tsx

### 다음 세션 주의사항 (A 트랙)
- B10-1: OneOnOne.sentimentTag → 이직 예측 입력 데이터
- B10-1: BiasDetectionLog → HR 애널리틱스 대시보드 표시
- B10-2: AI 평가 초안 사용률 → HR KPI 위젯
- AiEvaluationDraft.status 값: draft|reviewed|applied|discarded
```

### Step 4: Final Commit

```bash
git add context/TRACK_A.md
git commit -m "chore(b3-2): update TRACK_A.md with B3-2 completion summary"
```

---

## 트러블슈팅 가이드

### PerformanceGoal.achievementRate 없을 경우
```typescript
// insights route.ts에서 achievementRate select 제거
// 클라이언트에서 (actualValue / targetValue * 100)으로 계산
```

### AiEvaluationDraft relation 오류
Employee 모델에 relation이 없으면:
```prisma
// Employee 모델에 추가
aiDraftsAsEmployee AiEvaluationDraft[] @relation("AiDraftEmployee")
aiDraftsAsReviewer AiEvaluationDraft[] @relation("AiDraftReviewer")
```

### EVAL_DRAFT_GENERATION AiFeature 오류
```bash
npx prisma generate  # 재생성
```

### BiasDetectionLog relation 오류
Employee / Company 모델에 `biasLogsAsReviewer`, `biasDetectionLogs` relation 추가 후 `npx prisma generate`.

### distinct 미지원
Prisma 4.x 이상에서 지원. 미지원 시 groupBy로 대체:
```typescript
// groupBy로 대체
const candidates = await prisma.successionCandidate.groupBy({
  by: ['employeeId'],
  where: { plan: { companyId: user.companyId }, employeeId: { in: employeeIds } },
  _min: { ranking: true },
})
```
