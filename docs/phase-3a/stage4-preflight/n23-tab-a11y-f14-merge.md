# N+23 Pre-flight — 탭 키보드 a11y + Session 227 F14 합본 (EM-016)

> **base SHA**: `9a940408` · **트랙**: proto only (코드베이스 작업 0) · **우선**: HIGH→MEDIUM 재평가
> **결정 (Stage 3)**: 탭 7개에 WAI-ARIA tablist 패턴 + ←→/Home/End 키보드 핸들러
> **본 pre-flight 결과 (요약)**: ⚠️ **F14 합본 부적합 확정**. EmployeeDetailClient Tabs = Radix UI (a11y free). F14 N+9 임계치 미달 (현재 2/5) + 가디언 G4 "현행 유지 확정". **코드베이스 작업 0, proto만 작업**.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### 코드베이스 Tabs 라이브러리

```
src/components/ui/tabs.tsx:
  "use client"
  import * as TabsPrimitive from "@radix-ui/react-tabs"
  const Tabs = TabsPrimitive.Root
  ...
```

**확정**: shadcn `@/components/ui/tabs` = **Radix UI Tabs primitive 직접 사용**.

Radix UI Tabs는 WAI-ARIA Authoring Practices 정합 자체 구현:
- `role="tablist"` / `role="tab"` / `role="tabpanel"` 자동
- ←→/Home/End 키보드 네비 자동
- `aria-selected` / `aria-controls` / `aria-labelledby` 자동
- focus management (roving tabindex) 자동

→ **EmployeeDetailClient 탭 7개 (또는 6개) = a11y 무료**, 추가 작업 0.

### Session 227 F14 RECORD (card-01 N+9)

핵심 인용 (`01-myspace-leave.md` L260-285):

> ### N+9. F14 수동 tablist keyboard-nav 부재 (별도 a11y 트랙 — PR-3 외)
> - 격차: 수동 `<div role="tablist">` + `<button role="tab">` 세그먼트가 arrow-key 네비게이션·focus management 미구현
> - 현 구현 = 수동 div tablist (단일 필터 결과 surface = 별도 패널 부재 → Radix Tabs panel 전제 부적합)
> - **WCAG 2.1: 기능 키(Tab 키)로 도달·작동 = Level A 충족**. Arrow-key roving = ARIA Authoring Practices 권고 (AA 추가 강화 — Level A 차단 아님)
> - 트리거 임계 = 코드베이스 수동 tablist surface 누적 **5+** (D4 게이트 SSOT 5+ 동형 표준)
> - 현 누적 = **2** (LeaveClient + MyTasksClient) → **미달**, 인프라 트랙 미진입
> - 우선순위 = **P3** (핵심 기능 무영향, 별도 a11y batch)
> - 가디언 G4: (ii)+(iii) **현행 유지 확정**

### 수동 tablist surface (현재 누적)

| # | 파일 | 라인 | 패턴 |
|---|---|---|---|
| 1 | `src/app/(dashboard)/leave/LeaveClient.tsx` | (PR-3 A.2) | 수동 `<div role="tablist">` 세그먼트 |
| 2 | `src/app/(dashboard)/my/tasks/MyTasksClient.tsx` | 368 | 수동 `<div role="tablist">` |

**누적 2 < 임계 5+** → 자동 합본 트랙 진입 부적합.

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 본 N+23 정확한 spec 재정의 (Stage 3 사양화 vs pre-flight 결과)

**Stage 3 N+23 spec 인용**:
> - 코드베이스 `EmployeeDetailClient.tsx` 의 shadcn `Tabs` 는 Radix UI 기반 = 이미 WAI-ARIA 정합 → **검증만**
> - **Session 227 F14 inventory entry 1건 해소**

**pre-flight 정정**:
- 코드베이스 검증만: ✅ Radix Tabs 사용 확정으로 검증 단계 axe-core 1회만 진행, 추가 작업 0
- F14 inventory 해소: ❌ **부적합** — F14 자체가 "현행 유지 확정" 상태이고 임계치 미달. N+23이 F14를 "해소" 한다는 표현은 의미가 없음 (F14는 현행 유지 = 무해소 = 임계 도달 시 별도 트랙)

→ N+23 의 실 작업 surface = **proto 측 page-employee-detail.jsx 수동 tablist 패턴만**

### (b) proto 측 수동 tablist 패턴 분석 (`_design-reference/page-employee-detail.jsx`)

L63-78 (탭 영역):
```jsx
<div className="wd-tab-bar">
  {[
    ["summary",    "요약",       Icons.User],
    ["job",        "직무 정보",  Icons.Briefcase],
    ...7 entries...
  ].map(([id, label, Icon]) => (
    <button key={id} aria-selected={tab === id} onClick={() => setTab(id)}>
      <Icon size={14} sw={1.8} /> {label}
    </button>
  ))}
</div>
```

**격차** (a11y 강화):
- `<div className="wd-tab-bar">` → `role="tablist"` / `aria-orientation="horizontal"` 추가
- `<button>` → `role="tab"` + `aria-controls={panelId}` + `tabindex={selected ? 0 : -1}` 추가
- 키보드 핸들러: `onKeyDown` (←/→/Home/End) + focus follows selection
- 패널 → `role="tabpanel"` + `aria-labelledby={tabId}` + `tabindex={0}` 추가

**예상 line delta (proto)**: ~30 lines (tab bar 4줄 + 패널 7개 wrapper + onKeyDown 핸들러 ~15줄 + utility)

### (c) 코드베이스 측 작업

| surface | 작업 | line delta |
|---|---|---|
| `EmployeeDetailClient.tsx` Tabs | **axe-core 검증만** (라이브 1회) | **0** |
| 다른 수동 tablist surface | **N+23 비대상** (F14 임계치 미달) | **0** |

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 변경 0
- **DB**: 변경 0
- **API**: 변경 0
- **proto data.js**: 변경 0

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (LOW)**: proto a11y 강화 자체는 위험 없음 (mock 환경)
- **R2 (HIGH)**: F14 inventory "해소" 표기를 batch 04 §7 RECORD body에 그대로 둘 시 **부정확** → Stage 4 진입 시 본 pre-flight 결과 인용해 N+23 spec 보정 필요

### 의존성
- **PR-5A 머지** 무관 — proto only 작업, PR-5A 머지 전 진입 가능 (단 우선순위는 proto only 묶음 내)

### 가드
- ❌ F14 자동 합본 금지 (임계치 미달)
- ❌ 코드베이스 EmployeeDetailClient 추가 작업 금지 (Radix 정합)
- ❌ 다른 수동 tablist surface 동반 진입 금지 (별도 a11y batch 후보)
- ✅ proto `page-employee-detail.jsx` 탭 a11y 강화
- ✅ 코드베이스 axe-core 검증 (1회, 회귀 baseline)

---

## §5. Implementation 단계 (proto only 트랙, PR-5A 머지 전 진입 가능)

1. **branch**: `feat/proto-tab-a11y` (또는 N+19/N+20/N+22와 묶어서 proto-batch 진입)
2. **commit**: `_design-reference/page-employee-detail.jsx` 탭 영역 + 패널 영역 a11y 강화 (~30 lines)
3. **검증**:
   - 키보드 ←→/Home/End 라이브 시뮬레이션
   - axe-core 또는 수동 a11y check (proto 환경 한정)
4. **별도 commit (선택)**: 코드베이스 axe-core 검증 결과 (text-only docs, src 무변경) — baseline 기록
5. **PR open**: proto only 묶음 batch 또는 단독

---

## §6. Verification (verify 계획)

- ✅ **proto 검증**: 브라우저에서 키보드 ←→ 탭 이동 + Home/End + focus follows selection 라이브
- ✅ **코드베이스 axe-core (1회)**: `/employees/[id]` 페이지 a11y 검사 PASS baseline 기록
- ✅ **회귀 0**: proto 시각 회귀 (탭 외관 변경 0)
- ✅ **F14 임계 카운트 보존**: 누적 2 → 본 작업 후에도 2 (변동 0, 임계 5 도달 시 별도 a11y batch 진입)

---

## §7. Stage 4 진입 시 batch 04 §7 N+23 spec 보정 권고

본 pre-flight 결과 반영하여 batch 04 §7 N+23 spec 다음 정정:

```diff
- ### N+23 — 탭 키보드 네비 a11y (EM-016 + Session 227 F14 합본) [HIGH]
+ ### N+23 — proto 탭 키보드 a11y 강화 (EM-016) [MEDIUM]
+ > F14 합본 부적합 확정 (pre-flight n23-tab-a11y-f14-merge.md §1).

- 코드베이스 `EmployeeDetailClient.tsx` 의 shadcn `Tabs` 는 Radix UI 기반 = 이미 WAI-ARIA 정합 → 검증만
+ 코드베이스 = Radix UI Tabs 자체 정합 → axe-core 1회 baseline 만, 추가 작업 0

- Session 227 F14 inventory entry 1건 해소
+ F14 인벤토리 무영향 (임계 미달 + 가디언 G4 현행 유지 확정)
```

**RECORD 보정은 본 pre-flight 와 별도 commit, 사용자 확인 게이트 통과 후 진입.**

---

**상태**: pre-flight 완료, RECORD spec 보정 권고
**Stage 4 예상 PR 크기**: 1-2 commits, ~30 line delta, proto only
