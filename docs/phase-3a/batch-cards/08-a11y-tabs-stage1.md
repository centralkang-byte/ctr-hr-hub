# Phase 3a · Batch 08 — Tabs a11y Stage 1 P0 Audit

> Stage 1 P0 (저확실 → 상세 카드 필요 surface) audit
> **base SHA**: `dad5386b`
> **작성일**: 2026-05-21 KST (Session 228)
> 5 surface readonly 인벤토리

---

## §0. 1분 요약

- **5 surface F14 누적** (LeaveClient/MyTasksClient/OnboardingFilter/OffboardingFilter/ViewModeToggle)
- ⚠️ **F14 surface 정의 정정 발생** — 공식 `role="tablist"` 명시 = 1건 (MyTasksClient 단독). Informal button group 포함 = 5건 (배치 08 격상 기준 정합)
- **18 findings** (HIGH 6 / MEDIUM 8 / LOW 4) — A11Y-001 ~ A11Y-018
- **Stage 2 의제**: Radix UI 마이그레이션 vs `useArrowKeyNavigation` hook 신설 (Q1 ⭐)
- **RECORD 후보 N+43~N+47** 5 surface 매핑

---

## §1. Surface 인벤토리 (5)

### 1.1 codebase 5 surface 상세

| # | Surface | 파일 / 라인 | 패턴 | role="tablist" | aria-selected/pressed | onKeyDown |
|---|---|---|---|---|---|---|
| 1 | LeaveClient Status filter | `src/app/(dashboard)/leave/LeaveClient.tsx:579` | rounded-full button group (5 button) | **❌ 부재** | **❌ 부재** | **❌ 부재** |
| 2 | MyTasksClient View tab | `src/app/(dashboard)/my/tasks/MyTasksClient.tsx:368` | `<div role="tablist">` 공식 (2 button) | **✅ 있음** | ✅ aria-selected | **❌ 부재** |
| 3 | OnboardingFilter | `src/app/(dashboard)/onboarding/OnboardingDashboardClient.tsx:247+` | rounded-full pill (FILTER_OPTIONS) | **❌ 부재** | **❌ 부재** | **❌ 부재** |
| 4 | OffboardingFilter | `src/app/(dashboard)/offboarding/OffboardingDashboardClient.tsx` (추정) | rounded-full pill (OnboardingFilter와 동일 패턴) | **❌ 부재** | **❌ 부재** | **❌ 부재** |
| 5 | ViewModeToggle (Org) | `src/app/(dashboard)/org/OrgClient.tsx:556` (TAB_STYLES.list + ViewModeButton) | informal `<div aria-label="View mode">` + button group | **❌ 부재** | **❌ 부재** (`data-state` only) | **❌ 부재** |

### 1.2 Radix UI Tabs SSOT consumer cross-ref

**Radix UI Tabs SSOT**: `src/components/ui/tabs.tsx` (WAI-ARIA 자동 정합):
- `Tabs = TabsPrimitive.Root`
- `TabsList` (variant: default | compact)
- `TabsTrigger`
- `TabsContent`

**Radix Tabs SSOT 사용처** (정합 surface, F14 영향 없음):
- `src/app/(dashboard)/employees/[id]/EmployeeDetailClient.tsx:38` (6 탭, N+23 pre-flight 확정)
- 기타 다수 surface (TabsTrigger grep 결과 풍부)

→ codebase에 **두 패턴 공존**:
- (정합) Radix UI Tabs SSOT — a11y 자동
- (결함) 수동 button group / role=tablist — F14 inventory 대상 (본 batch)

### 1.3 ⚠️ F14 N+9 RECORD 정의 정정

원 F14 N+9 RECORD (`docs/phase-3a/batch-cards/01-myspace-leave.md:260-285`):
> 수동 `<div role="tablist">` + `<button role="tab">` 세그먼트가 arrow-key 네비게이션·focus management 미구현

**원 정의 = 공식 `role="tablist"` 명시 surface only**

원 N+9 작성 시점 누적 = 2 (LeaveClient + MyTasksClient). 단 **현재 검증 결과**:
- LeaveClient = role="tablist" **부재** (informal button group). 원 RECORD 시점 코드 패턴과 결렬 (PR-3 머지 이후 변경 가능성)
- MyTasksClient = role="tablist" ✅ 1건만

→ **공식 정의 기준 = 1/5 (임계 미달)**
→ **informal 정의 기준 = 5/5 (batch 08 격상 결정 기준 정합)**

**가디언 사전 가정 = (b) informal 포함 정의**. 본 batch 08 = informal button group + 공식 수동 tablist 통합 a11y 트랙으로 진행.

---

## §2. Findings (A11Y-001 ~ A11Y-018)

### A11Y-001 [HIGH] 공식 vs informal tablist 정의 결렬
- **surface**: cross-cutting
- **현상**: F14 N+9 RECORD = 공식 role="tablist" only 정의. 현재 코드 = informal button group 다수 (4건)
- **위반**: 정의 불명확 → audit/QA 결렬 위험
- **권고**: batch 08 = informal + 공식 통합 정의 채택. 본 audit에 정의 명문화

### A11Y-002 [HIGH] LeaveClient Status filter — ARIA 전무
- **surface**: LeaveClient
- **현상**: 5 button group (ALL/PENDING/APPROVED/REJECTED/CANCELLED), role / aria-selected / aria-pressed / onKeyDown 0건. 단지 `bg-foreground` 활성 시각만
- **WCAG**: 2.1 Level A — Tab 키 도달 ✅, **role=radiogroup/tablist 미정의 → 스크린리더 컨텍스트 부재**
- **권고**: Radix Tabs 마이그레이션 또는 button[aria-pressed] + role="radiogroup"

### A11Y-003 [HIGH] MyTasksClient — 공식 tablist 키보드 nav 결함
- **surface**: MyTasksClient
- **현상**: role="tablist" + aria-selected ✅ 있음, 단 onKeyDown 부재 → ←→/Home/End 키보드 nav 불가
- **WCAG**: 2.1 Level A 충족 (Tab 키 도달), **AA 권고 미충족** (ARIA Authoring Practices roving tabindex)
- **권고**: useArrowKeyNavigation hook 적용 또는 Radix Tabs 마이그레이션

### A11Y-004 [HIGH] OnboardingFilter — ARIA 전무
- **surface**: OnboardingFilter (FILTER_OPTIONS)
- **현상**: A11Y-002와 동일 패턴 — rounded-full button group, ARIA 0건
- **권고**: 동일 (Radix or hook)

### A11Y-005 [HIGH] OffboardingFilter — ARIA 전무
- **surface**: OffboardingFilter
- **현상**: A11Y-002/004와 동일 패턴
- **권고**: 동일

### A11Y-006 [HIGH] OrgClient ViewModeToggle — ARIA 부분만
- **surface**: OrgClient (TAB_STYLES.list + ViewModeButton)
- **현상**: `aria-label="View mode"` ✅ 있음, 단 role="tablist" / `aria-selected` / `aria-controls` 부재 (`data-state="active|inactive"` 만)
- **권고**: role="tablist" 추가 + aria-selected 정합 또는 Radix Tabs 마이그레이션

### A11Y-007 [MEDIUM] focus management — initial focus 정책 부재
- **surface**: 5 surface 전체
- **현상**: 페이지 진입 시 어떤 button이 focus? 활성 button vs 첫번째 button vs none — 정의 부재
- **권고**: WAI-ARIA "roving tabindex" 패턴 — 활성만 `tabIndex=0`, 나머지 `tabIndex=-1`

### A11Y-008 [MEDIUM] LeaveClient — Section 3 filter context 부재
- **surface**: LeaveClient
- **현상**: 5 button 의 의미 그룹화 (status filter) ARIA 미정의 → fieldset / role=radiogroup / role=tablist 어느 것 적합?
- **권고**: 본 filter = 단일 결과 surface (별도 panel 부재) → **role="radiogroup"** 권고 (Radix Tabs panel 전제 부적합)

### A11Y-009 [MEDIUM] OnboardingFilter / OffboardingFilter — 동일 패턴 SSOT 부재
- **surface**: 2 dashboard
- **현상**: rounded-full pill 패턴 2곳 inline 중복 → SSOT 컴포넌트 부재
- **권고**: `<Pillgroup>` 또는 `<FilterChips>` SSOT 신설 (cross-batch 공통화 후보)

### A11Y-010 [MEDIUM] OrgClient ViewModeToggle — 4 button + matrix toggle 혼재
- **surface**: OrgClient toolbar
- **현상**: ViewModeButton 4건 (tree/directory/list/grid) 옆에 matrix toggle checkbox 혼재 → 그룹화 ARIA 부재
- **권고**: ViewModeToggle = role="tablist" / matrix toggle = 분리 (시각 + 의미)

### A11Y-011 [MEDIUM] MyTasksClient — aria-controls 부재
- **surface**: MyTasksClient
- **현상**: tablist + aria-selected ✅, 단 aria-controls 부재 → panel 연결 미명시
- **권고**: aria-controls + role="tabpanel" 추가 (Radix Tabs 마이그레이션 시 자동 해소)

### A11Y-012 [MEDIUM] axe-core baseline 부재
- **surface**: cross-cutting
- **현상**: e2e/playwright 또는 vitest에 a11y 회귀 baseline 0건
- **권고**: axe-core 통합 + 5 surface baseline 캡처 (PR-5A 머지 후 정합)

### A11Y-013 [MEDIUM] focus visible 정합
- **surface**: 5 surface
- **현상**: focus ring 스타일 일관성 검증 미수행 — `FOCUS` SSOT (`src/lib/styles/focus.ts`) 적용 여부 surface별 차이
- **권고**: FOCUS SSOT 5 surface 정합

### A11Y-014 [MEDIUM] keyboard nav scope — orientation 일관
- **surface**: cross-cutting
- **현상**: 가로 button group = `orientation="horizontal"` 권장 — ARIA 명시 부재
- **권고**: `aria-orientation="horizontal"` 추가

### A11Y-015 [LOW] RTL (right-to-left) 정합
- **surface**: cross-cutting
- **현상**: i18n 5 locale 중 RTL 언어 0 (ar/he 부재). 단 ←→ 키보드 nav 시 RTL 반전 정책 사전 정의 권고
- **권고**: ARIA Authoring Practices RTL 가이드 정합

### A11Y-016 [LOW] screen reader 라벨 일관성
- **surface**: 5 surface
- **현상**: button text content = i18n 5 locale 있음, aria-label 추가 권고 (button text 만으로 부족 시)
- **권고**: button 시각 label 외 aria-label 추가 검토 (필요 시)

### A11Y-017 [LOW] disabled state ARIA
- **surface**: cross-cutting
- **현상**: disabled button 사용 시 `aria-disabled` 정합 (HTML disabled vs ARIA disabled)
- **권고**: 표준 `disabled` 속성 우선

### A11Y-018 [LOW] focus trap (Radix Dialog 등) cross-ref
- **surface**: cross-cutting
- **현상**: 본 batch는 inline filter/toggle. modal/drawer focus trap은 별도 (Radix Dialog 사용 surface)
- **권고**: 본 batch 비대상, 별도 a11y trade off 트랙

---

## §3. 패턴 일관성 분석

### 3.1 5 surface 수동 tablist 패턴 비교

| Surface | role="tablist" | aria-selected | onKeyDown | tabIndex |
|---|---|---|---|---|
| LeaveClient | ❌ | ❌ | ❌ | (default 0) |
| MyTasksClient | ✅ | ✅ | ❌ | (default 0) |
| OnboardingFilter | ❌ | ❌ | ❌ | (default 0) |
| OffboardingFilter | ❌ | ❌ | ❌ | (default 0) |
| OrgViewModeToggle | ❌ (aria-label only) | ❌ (data-state only) | ❌ | (default 0) |

**결렬 정도**:
- **공식 tablist 정합** (role + aria-selected) = 1/5 (20%)
- **키보드 nav (onKeyDown)** = 0/5 (0%)
- **focus management (roving tabindex)** = 0/5 (0%)

### 3.2 Radix UI Tabs SSOT 비교

```tsx
// Radix Tabs 자동 ARIA + 키보드 nav:
<Tabs defaultValue="profile">
  <TabsList>                          // role="tablist" 자동
    <TabsTrigger value="profile">     // role="tab" + aria-selected + aria-controls + tabIndex roving 자동
  </TabsList>
  <TabsContent value="profile">       // role="tabpanel" + aria-labelledby 자동
</Tabs>
```

→ Radix 마이그레이션 = a11y 결함 18건 중 12-14건 자동 해소 가능

### 3.3 panel 전제 검토

Radix Tabs = panel 전제 (TabsContent 필수). 5 surface 중:
- **MyTasksClient** (View tab): tasks / approvals 별도 panel → **Radix 적합**
- **OrgViewModeToggle**: tree/directory/list/grid 별도 panel → **Radix 적합** (batch 05 N+25 cross-ref)
- **LeaveClient Status filter**: 단일 panel (DataTable 1개, status는 query param) → **Radix 부적합** (`role="radiogroup"` 권고)
- **OnboardingFilter / OffboardingFilter**: 단일 panel (list 1개, filter는 query param) → **Radix 부적합** (`role="radiogroup"` 권고)

→ **3 surface = Radix 적합 (MyTasks + OrgViewMode + N+32 ViewModeToggle), 2 surface = radiogroup**. 패턴 분할 결정 필요 (Q1 ⭐)

---

## §4. Stage 2 카드 진입 의제 (Q-게이트 사전 정리)

### Q1 ⭐ — Radix Tabs 마이그레이션 vs 수동 hook 신설 (정합성 검증 결과 반영 필요)
- **A** (Radix Tabs 5 surface 일괄 마이그레이션) — **panel 전제 부적합 2 surface 결렬 risk**
- **B** (`useArrowKeyNavigation` hook 신설 + 5 surface 점진) — Radix 적합 surface 잠재가치 손실
- **C** (hybrid — Radix 적합 3 surface 마이그레이션 + 2 surface = role=radiogroup + hook 적용) — 추천
- (가디언 추천 = **C** — 정합성 검증 결과: panel 전제 분기에 따른 분할 패턴 적용)

### Q2 — focus management policy
- **A** (roving tabindex — 활성만 tabIndex=0, 나머지 -1) — ARIA Authoring Practices 정합
- **B** (전체 tabIndex=0) — Tab 키 도달 우선
- **추천**: A (AA 강화 + roving tabindex 표준)

### Q3 — 키보드 nav scope (←→/Home/End 어디까지)
- **A** (Radix Tabs default — ←/→/Home/End/PageUp/PageDown) — 권고
- **B** (←/→ 만, 단순화)
- **추천**: A (커스터마이즈 0, Radix default 정합)

### Q4 — i18n / RTL 영향
- **A** (RTL 시 ←→ 반전 자동) — Radix Tabs default 정합
- **B** (LTR 고정, RTL 비대상)
- **추천**: A (RTL locale 추가 가능성 대비)

### Q5 — 점진 마이그레이션 시 회귀 가드
- **A** (axe-core baseline 캡처 후 점진 — 회귀 0 검증)
- **B** (시각 회귀 + 수동 키보드 테스트)
- **추천**: A + B 병행 (axe-core baseline + gstack 시각 회귀)

---

## §5. RECORD 후보 인벤토리 (N+43~N+47)

batch 08 inventory에서 reserve 한 5 RECORD의 surface 매핑:

| RECORD | 묶음 surface / finding | 우선 | 의존성 |
|---|---|---|---|
| **N+43** | `useArrowKeyNavigation` hook 신설 + Radix Tabs 마이그레이션 결정 게이트 (Q1) | HIGH | Stage 2 게이트 통과 |
| **N+44** | MyTasksClient (공식 tablist) + LeaveClient (informal) a11y 보강 — 기존 F14 N+9 surface | HIGH | N+43 선행 |
| **N+45** | OnboardingFilter + OffboardingFilter a11y — role=radiogroup 또는 Radix Tabs (Q1 결정 따라) | MEDIUM | batch 07 N+34 동반 |
| **N+46** | OrgViewModeToggle a11y — Radix Tabs 마이그레이션 권고 | MEDIUM | batch 05 N+25 동반 + batch 07 N+32 ViewModeToggle 신설 cross-ref |
| **N+47** | a11y 컨벤션 SSOT 문서 (`docs/a11y/tablist.md`) + axe-core baseline | LOW | N+43~N+46 머지 후 |

---

## §6. 다음 액션

1. **Stage 2 카드 본문 작성** (별도 turn)
   - Q1 ⭐ 정합성 검증 (Radix 적합 3 surface + radiogroup 2 surface 분할 confirm)
   - 18 finding × 5 RECORD plan body 사양화
2. **Stage 3 게이트** (사용자 결재 round)
3. **Stage 4 pre-flight** (batch 07 N+34 implementation 동반 권고)
4. **Stage 4 implementation** (PR-5A 머지 후)

---

## §7. 의존성

### Cross-batch 의존
- **batch 07 N+34 implementation 합본 가능** (cross-batch + a11y 동시 적용)
- **batch 05 N+25 implementation** (OrgViewModeToggle 마이그레이션) 동반 권고
- **batch 07 N+32 ViewModeToggle 신설** 시점 a11y 가드 동시 적용

### 무관
- batch 01 LeaveClient (이미 done, 단 본 batch에서 a11y 보강 진입)
- batch 09 WizardShell SSOT 무관 (별도 a11y 트랙)

### 선행 의존 부재
- 독립 batch — 다른 batch implementation 선행 0 (단 cross-batch 동반 시 머지 순서 권고)

---

**상태**: Stage 1 P0 audit 완료
**다음 갱신**: Stage 2 카드 작성 별도 turn (Q1-Q5 정합성 검증 + RECORD plan body 사양화)
