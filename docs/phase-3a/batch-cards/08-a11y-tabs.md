# Phase 3a · Batch 08 — Tabs a11y (F14 격상)

> **범위**: 5 surface tabs/filter a11y 정합 트랙
> **격상 일자**: 2026-05-21 (Session 228)
> **Stage 1 audit**: `e3e6cb90` (`08-a11y-tabs-stage1.md`)
> **base proto SHA**: `HR Hub.html` 동결본
> **base codebase SHA**: `1260a95f` (main 동결)
> **batch ID 컨벤션**: `A11Y-001` ~ `A11Y-018` (Stage 1 inventory 재사용)

---

## §0. 1분 요약

- **5 surface F14** (LeaveClient/MyTasksClient/OnboardingFilter/OffboardingFilter/OrgViewModeToggle)
- **18 findings** (HIGH 6 / MED 8 / LOW 4) — Stage 1 cross-ref
- **Paradigm**: a11y 트랙 단독 (batch 04 proto leader / batch 05 codebase leader 어느 쪽도 아님)
- **Q1 ⭐ = C hybrid** (Radix Tabs 3건 + radiogroup 2건)
- **RECORD N+43~N+47** 5건 사양화
- **Cross-batch 의존성**: batch 07 N+34 + batch 05 N+25 + batch 07 N+32

---

## §1. Surface 인벤토리

Stage 1 §1 cross-ref (`08-a11y-tabs-stage1.md`). 압축 표:

| # | Surface | 파일 / 라인 | panel 전제 | Radix 적합 | Stage 4 접근 |
|---|---|---|---|---|---|
| 1 | LeaveClient Status filter | `src/app/(dashboard)/leave/LeaveClient.tsx:579` | ❌ 단일 DataTable | ❌ | radiogroup + hook |
| 2 | MyTasksClient View tab | `src/app/(dashboard)/my/tasks/MyTasksClient.tsx:368` | ✅ tasks/approvals 별도 | ✅ | Radix Tabs |
| 3 | OnboardingFilter | `OnboardingDashboardClient.tsx:247+` | ❌ 단일 list | ❌ | radiogroup + hook |
| 4 | OffboardingFilter | `OffboardingDashboardClient.tsx` | ❌ 단일 list | ❌ | radiogroup + hook |
| 5 | OrgViewModeToggle | `OrgClient.tsx:556` (TAB_STYLES) | ✅ tree/dir/list/grid 별도 | ✅ | Radix Tabs |

### Radix Tabs SSOT 정합 surface (참조)

- `src/components/ui/tabs.tsx` (`@radix-ui/react-tabs` 직접 사용 SSOT)
- 정합 surface 다수 (EmployeeDetailClient 등 — N+23 pre-flight 확정)

---

## §2. Findings (Stage 1 inventory 재사용)

Stage 1 §2 cross-ref (`08-a11y-tabs-stage1.md` 18 findings). 핵심 HIGH 6건 발췌:

| ID | Surface | 우선 | 핵심 |
|---|---|---|---|
| **A11Y-001** | cross-cutting | HIGH | F14 정의 결렬 — 공식 vs informal tablist (정의 명문화 필수) |
| **A11Y-002** | LeaveClient | HIGH | ARIA 전무 (role / aria-selected / aria-pressed / onKeyDown 0건) |
| **A11Y-003** | MyTasksClient | HIGH | role="tablist" + aria-selected ✅, 단 onKeyDown 부재 → 키보드 nav 불가 |
| **A11Y-004** | OnboardingFilter | HIGH | A11Y-002와 동일 패턴 |
| **A11Y-005** | OffboardingFilter | HIGH | A11Y-002와 동일 패턴 |
| **A11Y-006** | OrgViewModeToggle | HIGH | aria-label only, role="tablist" 부재 |

MEDIUM 8건 (Stage 1 A11Y-007~A11Y-014) + LOW 4건 (A11Y-015~A11Y-018) = Stage 1 audit 그대로 적용.

---

## §3. Cross-surface SSOT 결함

| ID | 항목 | 권고 |
|---|---|---|
| X1 | F14 정의 결렬 (informal vs 공식 tablist) | A11Y-001 + N+47 정의 명문화 |
| X2 | a11y 컨벤션 SSOT 부재 (5 surface 분산) | N+47 `docs/a11y-conventions.md` 또는 `.claude/rules/a11y.md` SSOT 신설 |
| X3 | useArrowKeyNavigation hook 부재 | N+43 신설 (`src/hooks/useArrowKeyNavigation.ts`) |
| X4 | FOCUS SSOT 적용 surface 별 차이 | A11Y-013 → N+43~N+46 동반 정합 |
| X5 | axe-core baseline 부재 | N+47 CI 통합 |

---

## §4. Proto vs Codebase Gap

| 항목 | proto | codebase | gap |
|---|---|---|---|
| 공식 role="tablist" | `<div role="tablist">` + `<button aria-selected>` (page-onboarding/leave 등) | 1/5 (MyTasksClient만) | 4 surface 결함 |
| onKeyDown keyboard nav | ❌ 0 (toast/click만) | ❌ 0/5 | **양쪽 모두 결함** |
| Radix UI Tabs | ❌ (proto Babel inline) | ✅ SSOT (`@radix-ui/react-tabs`) | codebase 자원 가용 |
| focus management roving | ❌ | ❌ | 신규 도입 |

→ **양쪽 모두 결함, codebase Radix Tabs SSOT 가용** = codebase Q1=C hybrid 접근 최적.

---

## §5. i18n / a11y / 다크 cross-cutting

### i18n
- **무관** (Q4 결정: RTL 5 locale 검증 0 — ko/en/zh/vi/es 모두 LTR)
- Radix Tabs RTL default 정합 (향후 ar/he locale 추가 시 자동)

### a11y
- **본 batch 본질**
- WCAG 2.1 Level A 충족 (현재 Tab 키 도달 ✅) → AA 강화 (Arrow-key roving + focus management)
- axe-core baseline (N+47)

### 다크
- **무관** (a11y 토큰화 별도, Phase 4 다크 트랙 비대상)

---

## §6. Stage 3 게이트 통과 박스 + Q1-Q5 결정 매트릭스

> **Stage 3 게이트 통과 (2026-05-21 KST, 가디언 default 결정)**
> Q1-Q5 **전체 채택**. 사용자 결재 round skip — 5건 전부 **data-decidable** + Stage 1 audit 패턴 정합 분석 통과.
> Q1 ⭐ panel 전제 분석은 CC 자체 catch (가디언 추측 아닌 데이터 기반 — Stage 1 §3.3).
> 가디언 메타룰 "정합성 데이터로 결정 가능한 의제 = default 채택" 적용.
> 사용자 batch 04/05/07 round "전체 채택" 일관성 정합.

| Q | 결정 | Stage 4 입력 |
|---|---|---|
| Q1 ⭐ | **C hybrid** | Radix Tabs 3 surface (MyTasksClient + OrgViewModeToggle + N+32 ViewMode) + radiogroup 2 surface (LeaveClient + Onboarding/Offboarding Filter) |
| Q2 | **A** | roving tabindex (Radix default + radiogroup useArrowKeyNavigation hook) |
| Q3 | **A** | Radix default 키보드 nav (←/→/Home/End/PageUp/PageDown) |
| Q4 | **A** | RTL 무관 (5 locale 모두 LTR, Radix default 정합) |
| Q5 | **A+B** | axe-core baseline + gstack 시각 회귀 병행 |

---

## §7. RECORD N+43~N+47 plan body 사양화

**Stage 3 게이트 통과 후 promote 완료 (2026-05-21).**

| RECORD | 묶음 finding | 우선 | 트랙 | 의존성 |
|---|---|---|---|---|
| **N+43** | A11Y-001/007/014 + Q1 hook 신설 | HIGH | codebase (선행) | 0 |
| **N+44** | A11Y-002/003 (LeaveClient + MyTasksClient — 기존 F14 N+9) | HIGH | codebase | N+43 |
| **N+45** | A11Y-004/005 (Onboarding/Offboarding Filter) | MEDIUM | codebase + cross-batch | N+43 + batch 07 N+34 |
| **N+46** | A11Y-006 (OrgViewModeToggle) | MEDIUM | codebase + cross-batch | N+43 + batch 05 N+25 + batch 07 N+32 |
| **N+47** | A11Y-001 정의 명문화 + a11y SSOT 문서 + axe-core baseline | LOW | docs + CI | N+43~N+46 머지 후 |

---

### N+43 — `useArrowKeyNavigation` hook 신설 (Q1 결정 게이트) [HIGH]

- **트랙**: codebase (선행 RECORD)
- **우선**: HIGH
- **의존성**: 0 (선행, 다른 N+44/45/46 의존)
- **Stage 4 입력**:
  - **신규 파일**: `src/hooks/useArrowKeyNavigation.ts` (~80 lines)
  - **spec**:
    ```ts
    interface Options {
      orientation?: 'horizontal' | 'vertical'  // default 'horizontal'
      loop?: boolean                            // default true
      rtl?: boolean                             // default detected from html.dir
    }
    function useArrowKeyNavigation<T extends HTMLElement>(
      itemsRef: RefObject<T[]>,
      activeIndex: number,
      onIndexChange: (idx: number) => void,
      options?: Options
    ): { onKeyDown: KeyboardEventHandler<T> }
    ```
  - 키 핸들러: `←/→ (horizontal) 또는 ↑/↓ (vertical)` + `Home/End` + `PageUp/PageDown`
  - WCAG 2.1 roving tabindex 표준 (활성만 `tabIndex=0`, 나머지 `-1`)
  - Radix Tabs 미적용 surface (LeaveClient + Onboarding/Offboarding Filter) 공통 SSOT
- **Stage 4 검증**:
  - vitest 단위 (5 키 × 2 orientation × loop on/off = 20+ case)
  - 5 surface 각 사용처 통합 검증 (N+44/45 진입 시)
  - axe-core baseline (N+47 진입 시)
- **블로커**: PR-5A 머지 후 진입

---

### N+44 — MyTasksClient + LeaveClient a11y 보강 (기존 F14 N+9) [HIGH]

- **트랙**: codebase
- **우선**: HIGH
- **의존성**: **N+43 선행 필수** (LeaveClient hook 사용)
- **Stage 4 입력**:
  - **MyTasksClient.tsx:368** (View tab, 공식 tablist):
    - **Radix Tabs 마이그레이션** (panel 전제 적합 — tasks/approvals 별도)
    - `role="tablist"` + manual `<button role="tab">` → `<TabsList>` + `<TabsTrigger>`
    - `<TabsContent>` 추가 (현재 inline conditional render → TabsContent로 분리)
    - 키보드 nav + aria-controls + focus management 자동 (Radix 자체)
  - **LeaveClient.tsx:579** (Status filter, informal):
    - `<div role="radiogroup">` + 5 `<button role="radio" aria-checked>`
    - `useArrowKeyNavigation` hook 적용
    - tabIndex roving (active 0, 나머지 -1)
    - 시각 패턴 유지 (rounded-full, batch 01 SSOT 회귀 0)
  - i18n: 무관 (기존 키 재사용)
- **Stage 4 검증**:
  - axe-core 0 violation (양 surface)
  - playwright 키보드 nav 시나리오 (←/→/Home/End)
  - 시각 회귀 0 (gstack 라이트)
  - F14 N+9 기존 RECORD 해소 명시 (정의 명문화 후)

---

### N+45 — Onboarding/Offboarding Filter radiogroup (batch 07 N+34 cross-batch) [MEDIUM]

- **트랙**: codebase + cross-batch 합본
- **우선**: MEDIUM
- **의존성**: **N+43 선행** + **batch 07 N+34 implementation 동반**
- **Stage 4 입력**:
  - **OnboardingDashboardClient.tsx:247+** + **OffboardingDashboardClient.tsx**:
    - rounded-full pill button group → `role="radiogroup"` + `role="radio"` + `aria-checked`
    - useArrowKeyNavigation hook 적용
    - tabIndex roving + focus management
    - batch 07 N+34 (`aria-pressed` + count display + URL persist)와 합본 PR
  - 시각 패턴 유지 (rounded-full pill — proto SSOT)
- **Stage 4 검증**:
  - axe-core 0 violation
  - playwright 키보드 nav + URL persist 시나리오 (batch 07 N+34 e2e 합본)
  - 시각 회귀 0
- **PR 합본 권고**: batch 07 N+34 = `feat/onboarding-pill-tabs-filter` + N+45 = 1 PR (효율 + 회귀 최소화)

---

### N+46 — OrgViewModeToggle Radix Tabs (batch 05 N+25 + batch 07 N+32 cross-batch) [MEDIUM]

- **트랙**: codebase + cross-batch 합본
- **우선**: MEDIUM
- **의존성**: **N+43 선행** + **batch 05 N+25 implementation 동반** + **batch 07 N+32 implementation 동반**
- **Stage 4 입력**:
  - **OrgClient.tsx:556** (`TAB_STYLES.list` + ViewModeButton):
    - **Radix Tabs 마이그레이션** (panel 전제 적합 — tree/directory/list/grid 별도 view)
    - `<div aria-label="View mode">` + 4 ViewModeButton → `<TabsList>` + `<TabsTrigger>`
    - `data-state="active|inactive"` → Radix 자동 (`data-state` Radix 기본 attr)
    - `<TabsContent>` 4개 추가 (현재 inline conditional → TabsContent 분리)
  - **batch 05 N+25** 동반: view mode 명명 정렬 (`tree/directory/list/grid` 키 정합)
  - **batch 07 N+32** 동반: ViewModeToggle 신설 (onboarding 4 view mode `grid/table/journey/analytics`) 동일 Radix Tabs 패턴 적용
- **Stage 4 검증**:
  - axe-core 0 violation
  - playwright 키보드 nav + matrix toggle 회귀 (OrgClient 특유)
  - 시각 회귀 0 (TAB_STYLES SSOT 유지)
  - batch 05 N+25 e2e 시나리오 합본
- **PR 합본 권고**: batch 05 N+25 + batch 07 N+32 + N+46 = 1 PR 또는 2 PR (cross-batch 머지 순서 게이트)

---

### N+47 — a11y SSOT 문서 + axe-core baseline (A11Y-001/012) [LOW]

- **트랙**: docs + CI
- **우선**: LOW
- **의존성**: **N+43~N+46 머지 후 (최후)**
- **Stage 4 입력**:
  - **A11Y-001 정의 명문화**:
    - F14 정의 = "수동 button group 포함 (informal + 공식 tablist 통합)"
    - 임계 = 5+ (5 surface 합본 처리 트리거)
  - **a11y 컨벤션 SSOT 문서**:
    - `docs/a11y-conventions.md` 또는 `.claude/rules/a11y.md` 신규 (~150 lines)
    - 5 surface 패턴 정합 표 (Radix Tabs vs radiogroup 결정 게이트)
    - useArrowKeyNavigation hook 사용 가이드
    - WAI-ARIA roving tabindex 표준 인용
  - **axe-core CI 통합**:
    - playwright + `@axe-core/playwright` 통합 (이미 도입된 경우 baseline 캡처만)
    - 5 surface baseline 0 violation 검증
    - CI gate (PR 차단 — violation > 0 시)
  - **F14 N+9 기존 RECORD 정정 commit** (별도 turn 가능):
    - 01-myspace-leave.md §7 N+9 정의 명문화 (informal 포함 5 surface 누적 5/5 도달 명시)
- **Stage 4 검증**:
  - axe-core CI green (5 surface)
  - a11y SSOT 문서 cross-batch 참조 가능 (batch 09 WizardShell SSOT + batch 06 등)
  - F14 정의 결렬 finding (A11Y-001) 해소

---

### Phase 4 다크 트랙 합본 (배제)

본 batch = a11y 트랙. 다크 토큰화 무관 (별도 Phase 4 트랙 = F19/F24/F26/EM-019/OG-018/ON-016/N+36 = 7 entry).

---

## §8. 다음 액션

1. **Stage 4 pre-flight** (별도 turn)
   - N+43 hook 신설 위치 + 5 surface impact pre-flight
   - cross-batch 합본 PR 머지 순서 결정 게이트 (N+45 ↔ N+44 vs N+45 ↔ batch 07 N+34)
2. **Stage 4 implementation** (PR-5A 머지 후) — 권고 순서:
   - N+43 (hook) → N+44 (MyTasks+Leave) → N+45 (Onboard-Offboard, batch 07 N+34 합본) → N+46 (OrgViewMode, batch 05 N+25 + batch 07 N+32 합본) → N+47 (SSOT + axe)
3. **cross-batch 의존성 합본 PR 검토**:
   - N+45 + batch 07 N+34 = `feat/onboarding-pill-tabs-filter-a11y` 합본
   - N+46 + batch 05 N+25 + batch 07 N+32 = `feat/view-mode-radix-migration` 합본

---

**상태**: ACTIVE (Stage 3 게이트 통과 2026-05-21, RECORD N+43~N+47 사양화 완료, 가디언 default 결정)
**다음 갱신**: Stage 4 pre-flight 별도 turn
