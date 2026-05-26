# N+46 Pre-flight — OrgViewModeToggle Radix Tabs (batch 05 N+25 + batch 07 N+32 3-way 합본) ⭐ critical

> **base SHA**: `1401e8ca` · **트랙**: codebase + 3-way cross-batch · **우선**: MEDIUM
> **결정 (Stage 3 Q1=C hybrid)**: OrgViewModeToggle = Radix Tabs (panel 전제 적합)
> **본 pre-flight 결과 (요약)**: ⭐ **3-way 합본 PR risk profile catch**. 권고 = **(b) 분할 진입** (Radix 마이그레이션 단독 분리, 회귀 가드 우선).

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### 3-way 의존 RECORD inventory

| RECORD | Batch | 변경 surface | 핵심 변경 |
|---|---|---|---|
| **batch 05 N+25** | 05 | `_design-reference/page-org.jsx` (proto) | view tab 3 → 4 mode (proto only) |
| **batch 07 N+32** | 07 | `OnboardingDashboardClient.tsx` 신규 ViewModeToggle | 4 view mode (grid/table/journey/analytics) 신설 |
| **N+46** | 08 | `OrgClient.tsx:556` (`TAB_STYLES.list` + ViewModeButton) | Radix Tabs 마이그레이션 + a11y |

### 의존성 분석

| RECORD | 트랙 | 코드베이스 변경 | 직접 의존 |
|---|---|---|---|
| batch 05 N+25 | **proto only** | 0 | — |
| batch 07 N+32 | **codebase 최대 변경** | OnboardingDashboardClient + 신규 컴포넌트 3개 | — |
| N+46 | codebase 중간 | OrgClient.tsx (line 556 영역) | N+43 (hook 불요, Radix 사용) |

**Critical 발견**:
- **batch 05 N+25 = proto only** (codebase 변경 0)
- 따라서 N+25 ↔ N+46 직접 코드베이스 의존성 = **0**
- N+46 와 batch 07 N+32 = **다른 surface** (Org vs Onboarding) — 직접 코드베이스 의존성 = **0**

→ **3-way 합본은 의존성 측면에서 불필요** (각 RECORD 독립 surface)

### OrgClient.tsx:556 영역 상세

```tsx
{/* OrgClient.tsx:556-580 추정 */}
<div className={TAB_STYLES.list} aria-label="View mode">
  <ViewModeButton mode="tree" current={viewMode} icon={...} label={t('viewTree')} onClick={...} />
  <ViewModeButton mode="directory" current={viewMode} icon={...} label={t('viewDirectory')} onClick={...} />
  <ViewModeButton mode="list" current={viewMode} icon={...} label={t('viewList')} onClick={...} />
  <ViewModeButton mode="grid" current={viewMode} icon={...} label={t('viewGrid')} onClick={...} />
</div>
```

```tsx
{/* ViewModeButton (line 397+) */}
function ViewModeButton({ mode, current, icon, label, onClick }: ViewModeButtonProps) {
  const active = mode === current
  return (
    <button onClick={onClick} title={label} data-state={active ? 'active' : 'inactive'} className={TAB_STYLES.trigger}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
```

**검증 결과**:
- `aria-label` ✅ ("View mode")
- `role="tablist"` ❌
- `role="tab"` ❌
- `aria-selected` ❌ (data-state만)
- **panel 전제**: ✅ **적합** (tree/directory/list/grid 각 별도 view conditional render)
- **conditional render**: `{viewMode === 'tree' ? ... : viewMode === 'directory' ? ... : ...}` 패턴

→ **Radix Tabs 마이그레이션 적합 확정**

---

## §2. ⭐ 3-way 합본 PR Risk Profile

### 합본 옵션 (a)/(b)/(c)

| 옵션 | 내용 | scope | risk | 권고 |
|---|---|---|---|---|
| **(a) 3-way 합본 PR** | batch 05 N+25 + batch 07 N+32 + N+46 단일 PR | ~600+ lines (3 batch 합계) | **HIGH** — 3 batch 동시 회귀 위험 | ❌ |
| **(b) Radix 마이그레이션 단독 분리** | N+46 = OrgViewMode 단독 PR. batch 05 N+25 + batch 07 N+32 별도 진입 | ~30 lines (N+46 단독) | LOW | ⭐ **권고** |
| **(c) 순차 PR** | batch 05 N+25 → batch 07 N+32 → N+46 순차 | 각 단독 | LOW | 안전, 느림 |

### (a) 3-way 합본 PR — 권고 안 함

**근거**:
1. **의존성 측면**: 세 RECORD 가 코드베이스 측에서 **직접 의존성 0** (batch 05 N+25 = proto only, batch 07 N+32 = onboarding surface, N+46 = org surface)
2. **회귀 위험**: 3 batch 동시 머지 = 회귀 격리 어려움 (한 batch 결함 발견 시 전체 revert)
3. **scope 과대**: ~600+ lines 단일 PR = codex Gate 2 / e2e / 시각 검증 부담 과중

### (b) Radix 마이그레이션 단독 분리 — ⭐ 권고

**근거**:
1. **N+46 단독 = 작은 scope** (~30 lines, OrgClient.tsx 단일 surface)
2. **batch 05 N+25** 는 proto only → 별도 PR (코드베이스 무관)
3. **batch 07 N+32** 는 onboarding 신규 컴포넌트 — N+46 OrgViewMode 와 독립
4. **회귀 격리**: 3 batch 각각 독립 머지 = 결함 발견 시 단독 revert 가능
5. 단 **N+32 ViewModeToggle (Onboarding) 신설 시 Radix Tabs 패턴 동일 적용 권고** (코드베이스 a11y 일관성)

### (c) 순차 PR — 차선

**근거**: (b)와 유사하나 머지 순서 강제 = 느림. (b) 가 더 효율.

→ **권고 = (b) 분할 진입**

---

## §3. 변경 surface 인벤토리 + 예상 line delta (N+46 단독 PR 기준)

### (a) N+46 단독 PR scope

| 파일 | 변경 | line delta |
|---|---|---|
| `src/app/(dashboard)/org/OrgClient.tsx` | import `{Tabs, TabsList, TabsTrigger, TabsContent}` 추가 | +1 |
| (line 556 영역) | `<div className={TAB_STYLES.list}>` → `<TabsList>` | -1 / +1 = 0 |
| (line 397+ ViewModeButton) | `<button data-state>` → `<TabsTrigger value={mode}>` | -10 / +5 = -5 |
| (conditional render 영역) | inline `{viewMode === 'tree' ? <TreeView /> : ...}` → `<TabsContent value="tree"><TreeView /></TabsContent>` × 4 | +20 |
| `<Tabs value={viewMode} onValueChange={setViewMode}>` 래핑 | +5 |
| `TAB_STYLES.list` / `TAB_STYLES.trigger` 시그니처 유지 (Tabs 시각 className override) | 0 |

**총 line delta**: **+20 net** (a11y 자동 보강)

### (b) batch 07 N+32 cross-ref (별도 PR)

batch 07 N+32 = 신규 OnboardingViewModeToggle 컴포넌트 — Radix Tabs 패턴 동일 적용 권고 (a11y 일관성). 단 본 N+46 PR과 **별도 진입**.

### (c) i18n

기존 `org.viewTree/viewDirectory/viewList/viewGrid` 키 재사용 (변경 0)

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (HIGH if 3-way 합본)**: 3 batch 회귀 격리 어려움 → (b) 분할 진입으로 회피
- **R2 (MEDIUM)**: `TAB_STYLES.list/trigger` 시그니처 = Radix `TabsList`/`TabsTrigger` className override 정합 — 시각 회귀 위험
- **R3 (MEDIUM)**: matrix toggle (line 595+) 영역 OrgClient.tsx 내부 — `viewMode === 'tree'` 조건부 표시. Radix Tabs로 옮길 때 location 검토
- **R4 (LOW)**: ReactFlow `<Controls>` 등 라이브러리 컴포넌트는 TabsContent 안에 그대로 옮김 (회귀 0)

### 의존성
- **PR-5A 머지** 후
- **batch 07 N+32 신설 시 Radix Tabs 패턴 동일 적용 권고** (cross-batch a11y 일관성, 단 별도 PR)
- N+43 hook = **불요** (Radix Tabs 자체 키보드 nav, hook 의존성 없음)

### 가드
- ❌ **3-way 합본 PR 금지** (회귀 위험)
- ❌ `TAB_STYLES.list` / `TAB_STYLES.trigger` 시그니처 변경 금지 (다른 surface 회귀)
- ❌ matrix toggle 위치 변경 금지 (현행 유지)
- ✅ Radix Tabs 마이그레이션 단독 PR
- ✅ ReactFlow / DirectoryView / RestructureModal 등 sub 컴포넌트 TabsContent 안에 그대로
- ✅ batch 07 N+32 신설 시 동일 Radix 패턴 적용 cross-ref

---

## §5. Implementation 단계 (N+46 단독 PR, 권고 옵션 b)

1. **사전 합의 게이트**:
   - (a)/(b)/(c) 옵션 결정 — **(b) 권고 채택**
   - matrix toggle location 결정 (현행 유지)
2. **branch**: `feat/org-viewmode-radix-migration`
3. **commit 1 (OrgClient Radix 마이그레이션)**:
   - `<div className={TAB_STYLES.list}>` → `<TabsList>` + `<TabsTrigger>` × 4
   - inline conditional render → `<TabsContent>` × 4
   - ViewModeButton 컴포넌트 폐기 (TabsTrigger로 흡수)
4. **e2e**: `e2e/flows/org-viewmode-radix.spec.ts` — 4 view mode 키보드 nav + 시각 회귀 + matrix toggle 회귀
5. **axe-core**: OrgClient 0 violation
6. **gstack 시각**: 라이트 회귀 0
7. **codex Gate 1+2**: 표준
8. **PR open**: `feat/org-viewmode-radix-migration` → main

**batch 05 N+25 (proto only) 별도 PR**: `_design-reference/page-org.jsx` 갱신
**batch 07 N+32 별도 PR**: `feat/onboarding-view-mode-hire-card` (Radix Tabs 패턴 동일 적용)

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **axe-core**: OrgClient 0 violation
- ✅ **e2e**: 4 view mode 키보드 nav + URL persist + matrix toggle 정합
- ✅ **시각 회귀**: gstack 라이트 OrgClient 전체 무변동
- ✅ **회귀 0**: ReactFlow Controls / DirectoryView / DetailPanel / RestructureModal 동작 정합
- ✅ **TAB_STYLES SSOT 정합**: list/trigger 시그니처 변경 0 (다른 surface 회귀 0)

---

## §7. 권고 옵션 결정 결과 (Critical 가드 응답)

| 옵션 | 결과 | 근거 |
|---|---|---|
| (a) 3-way 합본 PR | ❌ 권고 안 함 | 의존성 0, scope 600+ lines, 회귀 격리 어려움 |
| (b) Radix 마이그레이션 단독 분리 | ⭐ **권고** | scope 30 lines, 의존성 0, 회귀 격리 명확 |
| (c) 순차 PR | 차선 | (b)와 유사, 머지 순서 강제 = 느림 |

→ **최종 권고 = (b)**. batch 05 N+25 / batch 07 N+32 / N+46 = **3개 별도 PR**.

---

**상태**: pre-flight 완료, 3-way 합본 권고 = **(b) 분할 진입**
**Stage 4 예상 PR 크기**: 1 commit, +20 lines (net), 1 file diff
