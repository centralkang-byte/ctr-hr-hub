# N+44 Pre-flight — MyTasksClient (Radix Tabs) + LeaveClient (radiogroup) [F14 N+9 해소]

> **base SHA**: `1401e8ca` · **트랙**: codebase 독립 PR · **우선**: HIGH
> **결정 (Stage 3 Q1=C hybrid)**: MyTasksClient = Radix Tabs (panel 전제 적합), LeaveClient = radiogroup (panel 부재)
> **본 pre-flight 결과 (요약)**: ✅ Radix panel 전제 재검증 정합. F14 N+9 기존 RECORD 해소 명확. N+43 hook 의존, 독립 PR 권고.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### MyTasksClient.tsx:368 (View tab) 상세

```tsx
{canSeeApprovals && (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit" role="tablist">
        <button type="button" role="tab" aria-selected={viewTab === 'tasks'} onClick={...}>
            {t('tabTasks')}
        </button>
        <button type="button" role="tab" aria-selected={viewTab === 'approvals'} onClick={...}>
            {t('tabApprovals')}
        </button>
    </div>
)}

{/* ── Approval Tab Content ── */}
{viewTab === 'approvals' && canSeeApprovals ? (
    <ApprovalTabContent user={user} />
) : (
    <TaskListContent ... />
)}
```

**검증 결과**:
- `role="tablist"` ✅ 명시
- `role="tab"` ✅ 명시
- `aria-selected` ✅ 명시
- **panel 전제**: ✅ **적합** (tasks/approvals 별도 conditional render — TaskListContent / ApprovalTabContent)
- **onKeyDown**: ❌ 부재 (F14 N+9 결함)
- **aria-controls**: ❌ 부재 (panel 연결 미명시)
- **focus management**: ❌ 부재 (roving tabindex 0)
- **canSeeApprovals 권한 가드**: ✅ 정합 (HR_ADMIN+ 만 표시)
- **URL state**: ✅ 정합 (`updateParams({ tab: 'approvals', ... })`)

→ **Radix Tabs 마이그레이션 적합 확정**

### LeaveClient.tsx:579 (Status filter) 상세

```tsx
{/* ─── Section 3: Status filter + Request History ─── */}
<div className="flex items-center gap-2">
    {[
        { value: 'ALL', label: tc('all') },
        { value: 'PENDING', label: t('pending') },
        { value: 'APPROVED', label: t('approved') },
        { value: 'REJECTED', label: t('rejected') },
        { value: 'CANCELLED', label: t('cancelled') },
    ].map((f) => (
        <button onClick={() => setStatusFilter(f.value)} className={...}>
            {f.label}
        </button>
    ))}
</div>
<DataTable ... data={requests} />
```

**검증 결과**:
- `role` ✅ 부재 (모든 ARIA 결함)
- **panel 전제**: ❌ **부재** (단일 DataTable, status는 query filter)
- **panel 분리 불가**: 5 status × DataTable = 5 panel = 데이터 중복 (UX/성능 결함)
- → **radiogroup role + useArrowKeyNavigation hook** 적용

→ **radiogroup 적합 확정** (Radix Tabs 부적합)

### F14 N+9 RECORD 인용

원 RECORD (`01-myspace-leave.md:260-285`):
> **별도 a11y 트랙 옵션 (PR-3 비대상 확정)**:
>   - (a) 전 수동 tablist 일괄 Radix Tabs 교체 — panel 전제 필요, 필터 surface 부적합 가능성
>   - (b) `useArrowKeyNavigation` 훅 신설 — 수동 tablist 보존 + 키보드 보강
> 트리거 임계 = 5+ 누적 (D4 게이트 SSOT)
> 가디언 G4: (ii)+(iii) 현행 유지 확정

**N+44 = F14 N+9 해소**:
- 임계 도달 (5/5, batch 08 격상 결정)
- 옵션 (a) + (b) hybrid 채택 (Q1=C)
- MyTasksClient = (a) Radix / LeaveClient = (b) hook

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) MyTasksClient.tsx 마이그레이션

| 변경 | line delta |
|---|---|
| import `{ Tabs, TabsList, TabsTrigger, TabsContent }` 추가 | +1 |
| 수동 `<div role="tablist">` + 2 `<button>` → `<TabsList>` + 2 `<TabsTrigger>` (line 368-396) | -28 / +20 = -8 |
| Inline conditional render `{viewTab === 'approvals' ? <ApprovalTabContent /> : <TaskListContent />}` → `<TabsContent value="tasks"><TaskListContent /></TabsContent>` + `<TabsContent value="approvals"><ApprovalTabContent /></TabsContent>` (Radix Root 안에서) | +10 |
| `<Tabs value={viewTab} onValueChange={...}>` 래핑 | +5 |
| URL state 핸들러 정합 (`onValueChange` ↔ `updateParams`) | +5 |

**MyTasksClient 합계**: +12 / -28 = **-16 net** (코드 단순화 + a11y 자동)

### (b) LeaveClient.tsx 마이그레이션

| 변경 | line delta |
|---|---|
| import `useArrowKeyNavigation` 추가 | +1 |
| useState + ref pattern (activeIndex) | +10 |
| `<div className="flex items-center gap-2">` → `<div role="radiogroup" onKeyDown={...} aria-label="...">` | +5 |
| 5 `<button>` → 5 `<button role="radio" aria-checked={...} {...itemProps(i)}>` | +15 |
| i18n: `statusFilter` aria-label 키 5 locale (또는 기존 재사용) | +5 (또는 0) |

**LeaveClient 합계**: **+36 net** (a11y 보강)

### (c) i18n

- MyTasksClient: 기존 키 재사용 (`tabTasks`, `tabApprovals`)
- LeaveClient: 신규 `statusFilter` aria-label × 5 locale = **5 entries** (또는 기존 재사용)

### (d) 예상 총 line delta

- MyTasksClient: -16 net
- LeaveClient: +36 net
- **순 총합**: +20 lines
- i18n: 0~5 entries

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 0~5 entries (LeaveClient aria-label, 기존 재사용 시 0)
- **DB**: 0
- **API**: 0 (URL state 패턴 유지)

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (HIGH)**: LeaveClient Section 3 (status filter) URL persist 부재 — 본 batch에서 추가 도입 검토 (radiogroup 일관성)
- **R2 (MEDIUM)**: MyTasksClient `updateParams` 핸들러 = Next.js router URL persist. Radix `onValueChange` ↔ updateParams 호출 정합 (회귀 위험)
- **R3 (MEDIUM)**: 시각 회귀 — `bg-muted p-1 w-fit` 스타일 유지 (TabsList variant 설정 또는 className override)
- **R4 (LOW)**: 모바일 reflow — 2 button = 모바일 가로 정합 유지

### 의존성
- **N+43 (useArrowKeyNavigation hook)** 선행 필수 (LeaveClient consumer)
- **PR-5A 머지** 후

### 가드
- ❌ `TabsList` variant 시그니처 변경 금지 (다른 surface 회귀)
- ❌ `<TabsContent>` 안에 conditional render 그대로 옮기기 (TaskListContent / ApprovalTabContent 사용 boundary 변경 금지)
- ❌ URL persist 회귀 — `updateParams` 핸들러 시그니처 유지
- ✅ axe-core 0 violation 검증
- ✅ playwright 키보드 nav 시나리오 (←/→/Home/End/PageUp/PageDown)
- ✅ 시각 회귀 0 (gstack 라이트)

---

## §5. Implementation 단계 (N+43 선행 후, 독립 PR)

1. **사전 합의 게이트**:
   - LeaveClient URL persist 추가 여부 (radiogroup 일관성)
   - TabsList 시각 SSOT (`variant="compact"` 또는 className override)
2. **branch**: `feat/mytasks-leave-a11y` (또는 N+43 합본)
3. **commit 1 (MyTasksClient Radix 마이그레이션)**:
   - `<div role="tablist">` → `<Tabs>` + `<TabsList>` + `<TabsTrigger>` + `<TabsContent>`
   - URL state 핸들러 정합
4. **commit 2 (LeaveClient radiogroup + hook)**:
   - `<div role="radiogroup">` + 5 `<button role="radio">` + `useArrowKeyNavigation`
   - tabIndex roving + aria-label
   - 기존 시각 패턴 유지
5. **e2e**: `e2e/flows/mytasks-leave-a11y.spec.ts` — 양 surface 키보드 nav + 시각 회귀 + URL persist
6. **axe-core**: 양 surface 0 violation 검증
7. **gstack 시각**: 라이트 회귀 0 확인
8. **codex Gate 1+2**: 표준
9. **PR open**: `feat/mytasks-leave-a11y` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **axe-core**: 0 violation (양 surface)
- ✅ **e2e**: 키보드 nav (←/→/Home/End) + URL persist + 시각 회귀
- ✅ **시각 회귀**: gstack 라이트 양 surface
- ✅ **F14 N+9 해소**: 정의 명문화 후 (N+47) cross-ref
- ✅ **회귀 0**: TaskListContent / ApprovalTabContent / DataTable 동작 무변동

---

**상태**: pre-flight 완료, F14 N+9 해소 트랙
**Stage 4 예상 PR 크기**: 2 commits, +20 lines (net), 2 file diff + N+43 hook 의존
