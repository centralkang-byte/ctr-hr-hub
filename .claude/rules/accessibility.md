---
paths: ["src/components/**/*.tsx", "src/app/**/*.tsx"]
---

# Accessibility Rules

표준 원본:
- `src/lib/styles/status.ts` — WCAG AA 4.5:1 보장 색상 (`STATUS_BADGE_FG`)
- `src/components/ui/badge.tsx` — focus ring + 시맨틱 컬러
- `src/lib/styles/typography.ts` — 최소 12px 이상 본문
- `DESIGN.md §7 Mobile` — Strategy B Tier 1 (44px touch target)

## 필수 ARIA

### Icon-only Button
아이콘만 있는 버튼은 `aria-label` 필수:

```tsx
<Button size="icon" aria-label="직원 삭제">
  <Trash2 className="h-4 w-4" />
</Button>
```

### 진행률 (Progress Bar)
```tsx
<div
  role="progressbar"
  aria-valuenow={progress}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={`온보딩 진행률: ${completed}/${total} 작업 완료`}
>
  <div style={{ width: `${progress}%` }} />
</div>
```

### 리스트
`<ul>`/`<ol>` 대신 `<div>`로 리스트 만들 때:

```tsx
<div role="list">
  <article role="listitem">...</article>
</div>
```

### 섹션 헤딩
Card/Section은 `aria-labelledby`로 heading id 참조:

```tsx
<section aria-labelledby="onboarding-tracker-title">
  <h2 id="onboarding-tracker-title">온보딩 진행 현황</h2>
  ...
</section>
```

### aria-hidden (중복 노출 방지)
label과 value가 둘 다 노출될 때 스크린 리더가 두 번 읽지 않도록:

```tsx
<div aria-label={`승인 대기: ${count}건`}>
  <p aria-hidden="true">승인 대기</p>
  <p aria-hidden="true">{count}건</p>
</div>
```

## 키보드 접근

- **focus ring 필수** — `outline-none`만 쓰지 말 것. Tailwind `focus-visible:ring-2 focus-visible:ring-ring` 또는 shadcn 컴포넌트 기본값 유지
- **Radix 기본 키보드 내비게이션 보존** — 커스텀 `onKeyDown`으로 방향키/Enter/Esc 오버라이드 금지
- `tabindex` 임의 조작 금지 (0/-1 외 숫자 금지)
- Modal/Sheet: Radix `Dialog`/`Sheet` 사용 시 focus trap 자동

## 탭·세그먼트·필터 컨트롤 (단일선택 그룹)

탭/필터/세그먼트처럼 **단일 선택 그룹**을 만들 때의 기준. (N+43 `useArrowKeyNavigation` 훅 신설 + N+44 적용 결과를 SSOT로 고정)

### 결정 가이드

| 상황 | 선택 | 이유 |
|------|------|------|
| 콘텐츠 패널을 전환하는 탭 (연결된 `tabpanel` 존재) | **Radix `Tabs`** (`@/components/ui/tabs`) | roving tabindex·focus·`aria-controls` 자동. 직접 구현 불필요 |
| **신규** 패널 없는 단일선택 (필터·뷰 토글, 전환할 패널 없음) | `role="radiogroup"` + `role="radio"`(+`aria-checked`) **또는** `aria-pressed` 토글 버튼군 + `useArrowKeyNavigation` | `tabpanel` 없는 `tab`은 스크린리더가 "탭"으로 오해. 패널 없는 단일선택의 ARIA 표준은 radiogroup |
| **기존** 수동 `role="tablist"` 2곳 (MyTasks·Leave) | 현행 tablist 유지 (N+9 grandfather) | 신규엔 비권장이나 회귀 회피 위해 보존 (아래 노트) |

> **원칙 (하이브리드)**: ① 진짜 패널 전환 = Radix `Tabs`. ② 패널 없는 단일선택은 신규 구현부터 `radiogroup`/`aria-pressed`를 쓴다 — `tabpanel` 없는 수동 `tablist`는 WAI-ARIA상 부정확(SR이 "탭"으로 안내하나 전환 대상이 없음). ③ 키보드 내비는 어느 경우든 `useArrowKeyNavigation`(아래) 재사용. 위 "## 키보드 접근"의 *Radix 오버라이드 금지*는 **Radix 컴포넌트**에 한정 — 수동 그룹은 훅으로 키보드를 직접 구현하는 것이 정상이다.

> **기존 2곳 N+9 grandfather**: `MyTasksClient.tsx:381`(viewTab) + `LeaveClient.tsx:578`(statusFilter)는 패널 없는 필터인데도 `role="tablist"`를 쓴다. N+9(2026-05, 가디언 G4)에서 radiogroup 전환을 검토 후 **거부**(`DESIGN.md §5.5 "Segmented Control = Tabs"` 선례 + 코드 분기 회피)하고 tablist 유지를 채택했기 때문. **이 2곳은 보존하되, 신규 surface는 위 표대로 radiogroup/aria-pressed를 쓴다.** 두 컨벤션 통합은 별도 a11y 트랙(인프라 트랙 합류) 후보.

### F14 — 수동 단일선택 그룹 정의

수동 단일선택 그룹 = `<div role="tablist|radiogroup">` + `<button role="tab|radio">` 세그먼트 (rounded-pill 같은 informal 형태 포함). 이런 수동 surface가 누적 **5개 이상**이면 개별 보강 대신 cross-cutting a11y 트랙으로 일괄 처리한다.

### useArrowKeyNavigation (수동 단일선택 그룹 공통)

수동 단일선택 그룹(radiogroup·tablist 무관)에는 반드시 `useArrowKeyNavigation`(`src/hooks/useArrowKeyNavigation.ts`)을 써서 WAI-ARIA roving tabindex를 구현한다. 직접 `onKeyDown`을 새로 짜지 말 것 (SSOT 훅 재사용). 아래 예제는 **신규 권장 패턴(`radiogroup`)** 기준.

```tsx
import { useArrowKeyNavigation } from '@/hooks/useArrowKeyNavigation'

// positional 시그니처: (itemCount, activeIndex, onIndexChange, options?)
const nav = useArrowKeyNavigation(
  options.length,         // itemCount
  active,                 // activeIndex — 현재 선택 (상태/URL 등에서)
  (i) => setActive(i),    // onIndexChange — focus follows selection
  // 4번째 인자(선택): { orientation?: 'horizontal'(기본) | 'vertical', loop?: true(기본), rtl?: false }
)

<div role="radiogroup" aria-label="상태 필터" onKeyDown={nav.onKeyDown}>
  {options.map((o, i) => (
    <button
      key={o.value}
      type="button"
      role="radio"
      aria-checked={i === active}
      {...nav.itemProps(i)}      // ref + tabIndex (선택=0, 그 외=-1)
      onClick={() => setActive(i)}
    >
      {o.label}
    </button>
  ))}
</div>
```

- 선택 동작은 기존 `onClick`을 유지하고, 훅은 **키보드 내비게이션만** 더한다 (기존 동작 무변경).
- 순수 계산은 `computeNextIndex(key, activeIndex, itemCount, { orientation, loop, rtl })`로 분리돼 단위 테스트 가능.
- 기존 grandfather 소비처(`tablist`/`tab` 마크업)는 동일 훅을 그대로 쓴다 — 훅은 role 비의존: `MyTasksClient.tsx:295` (`viewNav`), `LeaveClient.tsx:140` (`statusNav`).

### WAI-ARIA roving tabindex 원칙

- 선택 항목 `tabIndex=0`, 나머지 `-1` → Tab 키로 그룹에 한 번만 진입하고, 그룹 내부는 화살표로 이동.
- `←/→`(horizontal) 또는 `↑/↓`(vertical) + `Home`/`End`. focus follows selection (automatic activation).
- 참고: [WAI-ARIA APG — Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)

### 현 surface (as of `ec33d961` · 2026-05-31)

| 분류 | surface | 패턴 | 키보드 a11y | ARIA semantics |
|------|---------|------|-------------|----------------|
| 수동 단일선택 (N+9 grandfather) | `MyTasksClient.tsx:381`(viewTab), `LeaveClient.tsx:578`(statusFilter) | `role="tablist"` + `useArrowKeyNavigation` | ✅ N+44 | panel 없는 tablist (N+9 보존) |
| Radix Tabs + 패널 (9곳) | EmployeeDetailClient(`:632`)·benefits·compensation·compliance(Hub+Country)·offboarding 상세·performance/admin·succession·training | Radix `Tabs` + `TabsContent` | ✅ 자동 | ✅ 정상 (`tabpanel` 연결) |
| Radix Tabs, **패널 없음** (2곳) | `OffCycleListClient`·`OffboardingDashboardClient` (status 필터, `TabsContent` 0) | Radix `Tabs` (panel 미연결) | ✅ Radix 자동 | ⚠ panel 없는 tab — 신규 규칙상 radiogroup 후보 |

> 재현: `grep -rn 'role="tablist"' src` (수동) / `grep -rln "from '@/components/ui/tabs'" src` (Radix, **홑따옴표**) → 각 파일 `grep -c TabsContent` 로 패널 유무 분류.
> 수동 단일선택은 **2곳**(F14 임계 5+ 미만 → cross-cutting 트랙 불요). panel 없는 Radix Tabs 2곳은 키보드 a11y는 정상(Radix roving)이나 ARIA semantics만 개선 후보(별도 a11y 트랙). batch 08 audit "5 surface"는 미구현 pill·미신설 토글 포함한 과대추정.

## 색상 & 대비

### Badge (status.ts SSOT)
StatusBadge 컴포넌트 또는 `Badge` variant를 사용. 직접 hex 지정 금지.

```tsx
import { StatusBadge } from '@/components/ui/StatusBadge'

<StatusBadge status="APPROVED" />   // status.ts의 STATUS_MAP 기반
```

또는 raw variant:
```tsx
<Badge variant="warning">대기</Badge>
```

- `STATUS_BADGE_FG`의 색상은 WCAG AA 4.5:1 대비비 보장됨
- 임의로 밝은 색 (tertiary #16a34a 등) 쓰면 10px 텍스트에서 AA 미달

### D17/D18 원칙 (bg/text 분리)
bright bg + AA-safe text 색상 분리:

| 용도 | bg | text |
|------|-----|------|
| Warning | `bg-warning-bright/15` (#f59e0b) | `text-ctr-warning` (#B45309) |
| Alert | `bg-alert-red/10` (#ef4444) | `text-destructive` (#e11d48) |
| Success | `bg-tertiary/10` (#16a34a) | `text-[#15803d]` |

### Body Text
`typography.ts` TYPOGRAPHY 상수 사용 — 모두 12px 이상.
- 10px/11px 텍스트는 uppercase 라벨, 테이블 헤더 등 **비본문**에만

## 터치 타겟 (모바일)

Strategy B Tier 1 페이지(출퇴근, 휴가, 결재, 알림, 대시보드)에서 interactive 요소는 최소 44px:

```tsx
<Button className="min-h-[44px]">제출</Button>
```

- MobileBottomNav 기준: `md` breakpoint (768px)
- 데스크톱에서는 기본 크기 유지 가능

## 시맨틱 HTML

- 구조: `<section>`, `<article>`, `<nav>`, `<aside>`, `<header>`, `<footer>`
- 리스트: `<ul>/<ol>/<li>` 우선, 불가 시 `role="list"`
- Form: `<label htmlFor>` 또는 shadcn `FormField` 래퍼
- Button type 명시: `<button type="button">` (form 안에서 기본값이 submit이라 의도치 않은 제출 방지)

## 에러/상태 전달

- 색상만으로 상태 구분 금지 — 아이콘 또는 텍스트 **병행**:
  - ✅ `<AlertCircle className="text-destructive" /> 오류`
  - ❌ `<div className="text-destructive">오류</div>` (색맹 사용자 못 봄)
- Form 에러: inline 메시지 + `aria-invalid` + `aria-describedby`
- Toast: `role="alert"` 자동 (shadcn useToast 사용 시)

## 이미지

- 의미 있는 이미지: `alt="..."` 필수 (Korean OK)
- 장식용: `alt=""` (비워두기 — 스크린 리더 스킵)
- 아바타 폴백: 사용자 이름 `aria-label`

## 금지

- `aria-label` 없는 icon-only button
- 의미 있는 이미지에 `alt=""` 또는 alt 누락
- 색상만으로 상태 전달 (아이콘/텍스트 병행 필수)
- `<div onClick>` (`<button>` 또는 `<Link>` 사용)
- `outline-none` 단독 사용 (focus-visible ring 병행)
- 커스텀 `onKeyDown`으로 Radix 컴포넌트 키보드 내비게이션 오버라이드
- 10px/11px 텍스트를 본문에 사용 (uppercase 라벨 전용)
