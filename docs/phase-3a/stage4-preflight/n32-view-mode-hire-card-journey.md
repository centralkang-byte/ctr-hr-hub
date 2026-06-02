# N+32 Pre-flight — 4 view mode + OnboardingHireCard + OnboardingJourneyView (ON-001 + ON-003 + Q2/Q3) ⭐ critical

> **base SHA**: `1cd4a77c` · **트랙**: codebase 최대 변경 · **우선**: HIGH
> **결정 (Stage 3 Q2/Q3=A)**: codebase에 4 view mode 도입 + Hire Card + journey view 신규 컴포넌트 신설
> **본 pre-flight 결과 (요약)**: ✅ **schema migration 불필요** (OnboardingTask + EmployeeOnboardingTask 모델 완전 정합).

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### ⭐ Prisma 모델 검증 (CRITICAL — 가디언 사전 가정 검증)

**가디언 사전 가정**: "journey view = OnboardingTask 시계열 정합" — batch 04 N+18 / batch 05 N+27 사전 가정 정정 패턴 catch 목적

**검증 결과**: ✅ **완전 정합** (schema migration 불필요)

#### OnboardingTask (`prisma/schema.prisma:2021`)
```prisma
model OnboardingTask {
  id            String                 @id @default(uuid())
  templateId    String                 @map("template_id")
  title         String
  description   String?
  assigneeType  OnboardingAssignee     @map("assignee_type")
  dueDaysAfter  Int                    @map("due_days_after")  ← ⭐ timeline 위치
  sortOrder     Int                    @map("sort_order")       ← ⭐ 정렬
  isRequired    Boolean                @default(true)
  isSignOffTask Boolean                @default(false)
  category      OnboardingTaskCategory  ← ⭐ 4+ enum (proto 4 정합)
}
```

#### EmployeeOnboardingTask (`prisma/schema.prisma:2073`)
```prisma
model EmployeeOnboardingTask {
  id                   String
  employeeOnboardingId String
  taskId               String
  status               TaskProgressStatus     ← ⭐ timeline status
  completedById        String?
  completedAt          DateTime?              ← ⭐ 완료 시점
  note                 String?
  assigneeId           String?
  dueDate              DateTime?              ← ⭐ 실제 due
  blockedReason        String?                ← ⭐ 차단 정보
  blockedAt            DateTime?
  unblockedAt          DateTime?
}
```

#### OnboardingTaskCategory enum (`prisma/schema.prisma:233`)
```prisma
enum OnboardingTaskCategory {
  DOCUMENT
  TRAINING
  SETUP
  INTRODUCTION
  OTHER
  ADMIN
  COMPLIANCE
  ORIENTATION
}  // 8 enum
```

**Proto 4 카테고리 매핑**:
| proto | codebase enum | 상태 |
|---|---|---|
| DOCUMENT | DOCUMENT | ✅ 정합 |
| TRAINING | TRAINING | ✅ 정합 |
| MEETING | INTRODUCTION 또는 ORIENTATION | ⚠️ 라벨 차이 (의미 동일) |
| ACCESS | SETUP | ⚠️ 라벨 차이 (의미 동일) |

→ 8 enum 모두 proto 4 + codebase 4 = **enum 확장 0**, 매핑 layer만 (UI 카테고리 그룹화 로직)

### Codebase 현황

| 파일 | 라인 | 핵심 발견 |
|---|---|---|
| `OnboardingDashboardClient.tsx` | 220-280 | **view mode toggle 부재** (PageHeader + Plan Type Tabs + Filters만) |
| `OnboardingHireCard.tsx` | (부재) | 신규 컴포넌트 신설 필요 |
| `OnboardingJourneyView.tsx` | (부재) | 신규 컴포넌트 신설 필요 |
| Plan Type Tabs | line 226 | `border-b border-border` 패턴, 수동 tablist 가능성 (F14 surface) |
| Filters | line 245 | `rounded-full` pill 패턴, 수동 button group |

### batch 05 N+25 cross-ref

`docs/phase-3a/batch-cards/05-org.md` Q1 결정 = codebase 4 mode 키 SSOT 유지 (`tree/directory/list/grid`).

**N+32 vs N+25 view mode 키 정합 검토**:
- batch 05 (org): `tree / directory / list / grid`
- batch 07 (onboarding) proto: `grid / table / journey / analytics`
- **다른 mode 명명** — proto SSOT 정합 우선 (Q2=A 결정)
- **권고**: `grid / table / journey / analytics` 채택 (proto 정합) — batch 05 SSOT와 다른 mode set (각 batch 도메인별 mode 의미 차이)

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 핵심 변경

| 파일 | 변경 | line delta |
|---|---|---|
| `src/components/onboarding/OnboardingHireCard.tsx` | **신규** (~150 lines): 배너 status pill + avatar + meta + progress bar + 2 actions | +150 |
| `src/components/onboarding/OnboardingJourneyView.tsx` | **신규** (~120 lines): 단계별 timeline + status icon + 차단 표시 | +120 |
| `src/components/onboarding/ViewModeToggle.tsx` | **신규** (~50 lines): 4 mode toggle (grid/table/journey/analytics) | +50 |
| `OnboardingDashboardClient.tsx` | view mode state + ViewModeToggle invoke + 조건부 render | +80 |
| `src/app/api/v1/onboarding/instances/route.ts` | response에 OnboardingTask + EmployeeOnboardingTask join (timeline data) — 또는 별도 endpoint | +30 |
| `messages/{ko,en,zh,vi,es}.json` | view mode 4 라벨 + Hire Card meta + journey 라벨 | +50 entries |

### (b) OnboardingHireCard spec

```tsx
interface OnboardingHireCardProps {
  instance: EmployeeOnboarding & {
    employee: Employee
    template: OnboardingTemplate
    buddy?: Employee | null
    tasksProgress: { completed: number, total: number }
  }
  onJourneyClick: (id: string) => void
  onForceCompleteOrRemind: (id: string) => void
}
```

- 배너 status pill (delay/progress/done/offboarding)
- avatar (av-hue: charCodeSum hash) + name + role
- 3-meta: joinDate/D-day/buddy (proto 정합)
- progress bar (`completed/total · pct%`)
- 2 actions:
  - "여정 보기" → onJourneyClick(id) → view mode = 'journey' + selectedPerson 설정
  - "강제 완료" (delay status) / "리마인드" (other) → mutation API

### (c) OnboardingJourneyView spec

```tsx
interface OnboardingJourneyViewProps {
  instance: EmployeeOnboarding & {
    tasks: (EmployeeOnboardingTask & {
      task: OnboardingTask  // includes title, category, dueDaysAfter, sortOrder
    })[]
  }
  onBack: () => void
}
```

- 단계 정렬: `tasks.sort((a, b) => a.task.sortOrder - b.task.sortOrder)`
- 각 단계 row:
  - 좌측: 카테고리 icon + 색상 (N+36 토큰)
  - 중앙: title + sub (assigneeType + dueDate)
  - 우측: status icon (TaskProgressStatus → checkmark/clock/x/exclamation)
  - 차단 시: blockedReason 표시 (red border)
- 좌측 vertical line (`border-l border-border`) — timeline visual

### (d) ViewModeToggle spec

```tsx
const VIEW_MODES = ['grid', 'table', 'journey', 'analytics'] as const
type ViewMode = typeof VIEW_MODES[number]
```

- batch 05 `ViewModeButton` 패턴 재사용 가능 (TAB_STYLES.trigger, `data-state="active"`)
- analytics view = chart variant (별도 컴포넌트 또는 placeholder)

### (e) 예상 총 line delta

- 신규 컴포넌트 3개: +320 lines
- Dashboard 통합: +80 lines
- API 확장: +30 lines
- i18n: +50 entries
- **순 총합**: +430 lines + 50 i18n entries

---

## §3. i18n / DB / API 영향 평가

### ⭐ DB 영향 — schema migration 불필요 (CRITICAL 확정)
- OnboardingTask + EmployeeOnboardingTask 모델 완전 정합
- 4 카테고리 enum 매핑 layer만 (UI 그룹화 로직, schema 무관)
- TaskProgressStatus enum 기존 사용 (status icon 매핑)

### i18n
- view mode 4 라벨: `onboarding.view{Grid,Table,Journey,Analytics}` × 5 locale = 20
- Hire Card meta: `joinDate / dDay / buddy` × 5 = 15
- journey 라벨: `currentStep / blocked / overdue` × 5 = 15
- 총 ~50 entries

### API
- `/api/v1/onboarding/instances` 응답 확장 (employee + template + buddy + tasks join)
- 또는 신규 `/api/v1/onboarding/instances/[id]/journey` endpoint (timeline 전용)
- prisma `include: { tasks: { include: { task: true } } }` 패턴

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (MEDIUM)**: N+31 (StatusChips) 선행 권고 — Hire Card 안의 status pill이 N+22 (batch 04) status SSOT 정합 필요
- **R2 (MEDIUM)**: ViewModeToggle 가 수동 button group → F14 임계 카운트 +1 가능 (현재 2 → 3, 임계 5+ 미달이지만 누적 추적)
- **R3 (MEDIUM)**: journey view tasks join 성능 — N instance × M tasks fetch. 페이지네이션 / lazy load 검토
- **R4 (LOW)**: analytics view = chart variant — 별도 chart 라이브러리 필요? 또는 기존 Recharts 재사용

### 의존성
- **N+31 (StatusChips)** 선행 권고 — Hire Card status pill SSOT 정합
- **N+22 (batch 04 EmployeeStatusChip)** cross-ref — status 색상 변형 통합
- **N+36 (카테고리 wt 토큰)** 동반 진입 권고 — journey view 카테고리 색상
- **N+25 (batch 05 view mode 명명)** cross-ref — 단, 도메인별 mode set 다름 (정합 0)
- **PR-5A 머지** 필요

### 가드
- ❌ schema migration 0
- ❌ raw `new Date()` 금지 (`src/lib/timezone.ts`)
- ❌ analytics view chart 라이브러리 신규 도입 금지 (Recharts 재사용)
- ✅ Hire Card / Journey View 컴포넌트 SSOT 신설
- ✅ ViewModeToggle = batch 05 ViewModeButton 패턴 재사용 가능 검토

---

## §5. Implementation 단계 (N+31 선행 후)

1. **사전 합의 게이트**:
   - 4 카테고리 매핑 (MEETING → INTRODUCTION/ORIENTATION 결정)
   - analytics view 범위 (chart 종류, placeholder OK)
2. **branch**: `feat/onboarding-view-modes-hire-card`
3. **commit 1 (신규 컴포넌트 — ViewModeToggle + HireCard + JourneyView)**:
   - 3 컴포넌트 신설
   - 4 mode toggle + Hire Card layout + journey timeline
4. **commit 2 (API 확장)**:
   - `/api/v1/onboarding/instances` join tasks
   - 또는 신규 journey endpoint
5. **commit 3 (Dashboard 통합)**:
   - OnboardingDashboardClient view mode state
   - 조건부 render (grid Hire Cards / table 기존 / journey view / analytics)
6. **commit 4 (i18n)**:
   - 5 locale × 50 entries
7. **e2e**: `e2e/flows/onboarding-view-modes.spec.ts` — 4 view mode 통과 + Hire Card 클릭 → journey 진입 + analytics placeholder
8. **gstack 시각**: 라이트 모바일 reflow (Hire Card 1-col)
9. **codex Gate 1+2**: 표준
10. **PR open**: `feat/onboarding-view-modes-hire-card` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **e2e**: 4 view mode 토글 + Hire Card 클릭 → journey + URL persist (?view=...)
- ✅ **시각 회귀**: Hire Card grid 모바일 1-col, journey vertical timeline
- ✅ **N+24 SSOT 정합**: Hire Card 안의 chips (있다면) 변경 0
- ✅ **schema migration 0**: prisma migrate status 변동 0
- ✅ **회귀 0**: 기존 table view (default) 무변동, Plan Type Tabs + Filters 정합

---

## §7. 비상 분기 결과 (가디언 사전 가정 검증)

**가디언 가정**: "journey view = OnboardingTask 시계열 정합, schema 무관"

**CC 검증 결과**: ✅ **가정 완전 정합**

근거:
1. `OnboardingTask.{sortOrder, dueDaysAfter, category, title}` = timeline render 충분
2. `EmployeeOnboardingTask.{status, completedAt, blockedReason, dueDate}` = 단계별 status + 차단 정보 가용
3. `OnboardingTaskCategory` 8 enum = proto 4 카테고리 매핑 (확장 불필요)
4. tasks join은 prisma `include` 1줄 추가

→ **비상 분기 트리거 안 됨**. batch 04 N+18 / batch 05 N+27 같은 정정 발생 0. N+32 단독 PR 진행 가능.

---

## §8. 별도 트랙 후보

- **analytics view chart variant**: Recharts 재사용 vs 신규 chart 라이브러리 결정 게이트
- **카테고리 매핑 cross-batch SSOT**: 8 enum × Workday wt 토큰 매핑 SSOT 신설 (N+36 cross-ref)

---

**상태**: pre-flight 완료 (CRITICAL schema 검증 완료, 정합)
**Stage 4 예상 PR 크기**: 4 commits, +430 lines + 50 i18n entries, 6-7 file diff
