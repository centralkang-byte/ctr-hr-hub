# N+43 Pre-flight — useArrowKeyNavigation hook 신설 (Q1 결정 게이트)

> **base SHA**: `1401e8ca` · **트랙**: codebase 선행 SSOT · **우선**: HIGH
> **결정 (Stage 3 Q1=C hybrid)**: Radix Tabs 부적합 2 surface (LeaveClient + Onboarding/Offboarding Filter) 공통 hook
> **본 pre-flight 결과 (요약)**: `src/hooks/` SSOT 디렉토리 12 hooks 정합. naming camelCase. WCAG roving tabindex 표준. consumer 2 surface (N+44 LeaveClient + N+45 Onboarding/Offboarding Filter).

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### `src/hooks/` SSOT 현황

`src/hooks/` 12 hooks 존재 (camelCase naming):

```
use-mobile.ts          (kebab-case 예외)
use-toast.ts           (kebab-case 예외)
useAutoSave.ts
useDebounce.ts
useFavorites.ts
useNavigation.ts
useProcessSetting.ts
useRecentPages.ts
useSidebarCounts.ts
useSubmitGuard.ts
useTimeOfDay.ts
useUnsavedChanges.ts
```

→ **naming SSOT = camelCase** (`useAutoSave.ts` 패턴 정합). 신규 hook = `useArrowKeyNavigation.ts`.

### Consumer surface 2건 (Q1 hybrid 결정)

- **N+44 LeaveClient.tsx:579** — Status filter (radiogroup 적용 시점)
- **N+45 Onboarding/OffboardingDashboardClient** — Filter (radiogroup 적용 시점)
- **N+46 OrgViewModeToggle** = Radix Tabs 마이그레이션 (hook 비대상)
- **MyTasksClient** = Radix Tabs 마이그레이션 (hook 비대상)
- **N+32 ViewModeToggle (예정)** = Radix Tabs 마이그레이션 (hook 비대상)

→ **Hook consumer = 2 surface** (LeaveClient + Onboarding/Offboarding Filter)

### Radix Tabs 내부 패턴 cross-ref

`src/components/ui/tabs.tsx` = `@radix-ui/react-tabs` 직접 사용. 내부 hook은 외부 노출 없음. **신규 hook은 Radix Tabs 미적용 surface에만 적용** (panel 전제 부재 — radiogroup).

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 신규 파일

| 파일 | 변경 | line delta |
|---|---|---|
| `src/hooks/useArrowKeyNavigation.ts` | **신규** (~80 lines) | +80 |
| `tests/unit/hooks/useArrowKeyNavigation.test.ts` | **신규** (vitest, ~70 lines, `vitest.config.ts` `include` 정합) | +70 |

### (b) Hook API spec

```ts
import { type KeyboardEventHandler, type RefObject, useCallback } from 'react'

interface UseArrowKeyNavigationOptions {
  orientation?: 'horizontal' | 'vertical'  // default 'horizontal'
  loop?: boolean                            // default true (Home 다음 = 마지막, End 다음 = 처음)
  rtl?: boolean                             // default false (LTR — Q4 결정 정합, RTL 추가 시 enable)
}

interface UseArrowKeyNavigationReturn {
  onKeyDown: KeyboardEventHandler<HTMLElement>
  itemProps: (index: number) => {
    ref: (el: HTMLElement | null) => void
    tabIndex: 0 | -1                        // active만 0, 나머지 -1 (roving tabindex)
  }
}

export function useArrowKeyNavigation(
  itemCount: number,
  activeIndex: number,
  onIndexChange: (idx: number) => void,
  options: UseArrowKeyNavigationOptions = {}
): UseArrowKeyNavigationReturn {
  // ...
}
```

**키 핸들러**:

| 키 | orientation=horizontal | orientation=vertical |
|---|---|---|
| ArrowLeft | prev (rtl 시 next) | — |
| ArrowRight | next (rtl 시 prev) | — |
| ArrowUp | — | prev |
| ArrowDown | — | next |
| Home | 0 | 0 |
| End | itemCount - 1 | itemCount - 1 |
| PageUp | -5 (또는 처음) | -5 |
| PageDown | +5 (또는 마지막) | +5 |

### (c) Consumer 사용 패턴 sample (radiogroup)

```tsx
function LeaveStatusFilter() {
  const [activeIndex, setActiveIndex] = useState(0)
  const { onKeyDown, itemProps } = useArrowKeyNavigation(
    OPTIONS.length,
    activeIndex,
    setActiveIndex,
    { orientation: 'horizontal', loop: true }
  )

  return (
    <div role="radiogroup" onKeyDown={onKeyDown} aria-label={t('statusFilter')}>
      {OPTIONS.map((opt, i) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={activeIndex === i}
          {...itemProps(i)}
          onClick={() => setActiveIndex(i)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

### (d) 예상 총 line delta

- hook: +80
- test: +70
- consumer 적용 (N+44 + N+45) = 별도 RECORD 본문에 포함

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 0 (hook은 i18n 무관, consumer 측에서 처리)
- **DB**: 0
- **API**: 0
- **a11y label**: consumer 측 `aria-label` 필수 (`role="radiogroup"` 사용 시 라벨 필수)

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (LOW)**: PageUp/PageDown 처리 — `Radix Tabs default` 정합 (Q3 결정) vs 단순화 (skip). 추천: Radix default 정합 (5/-5 step)
- **R2 (LOW)**: RTL 처리 — Q4=A (RTL 무관) 결정. `rtl` option은 future-proof 만 (기본 false)
- **R3 (LOW)**: loop=false 정책 — 일반적 horizontal tabs는 loop=true, hierarchical menu는 loop=false. 본 hook = horizontal 위주 → default true

### 의존성
- **PR-5A 머지** 후 진입
- **N+44/N+45 후속 의존** (consumer, Phase D 진입 시 — audit §6.2 (A) 단독 PR 권고 정합)

### 가드
- ❌ DOM 접근 raw `document.querySelector` 금지 (ref pattern only)
- ❌ event.preventDefault() 조건부 (Home/End는 brower default와 충돌 가능)
- ✅ 단독 PR 진행 시 audit §7.3 N+44/N+45 consumer 후속 PR commitment 의무 (Phase D 진입 시 자연 consumer — audit §6.2 (A) 권고 정합). commitment 부재 시 dead code 위험
- ✅ TypeScript strict 정합 (`KeyboardEvent<HTMLElement>` generic)
- ✅ vitest 단위 5+ 키 × 2 orientation × loop on/off = 20+ case
- ✅ WCAG 2.1 + WAI-ARIA Authoring Practices 정합

---

## §5. Implementation 단계 (PR-5A 머지 후, 선행 RECORD)

1. **사전 합의 게이트**: hook API spec 확정 (PageUp/PageDown step size + loop default)
2. **branch**: `feat/use-arrow-key-navigation`
3. **commit 1 (hook 신설)**:
   - `src/hooks/useArrowKeyNavigation.ts` (~80 lines)
4. **commit 2 (vitest unit test)**:
   - `src/hooks/useArrowKeyNavigation.test.ts` (~70 lines)
   - 20+ case (5 키 × 2 orientation × loop on/off)
5. **commit 3 (consumer 첫 적용 — N+44 LeaveClient 합본 가능)**:
   - 또는 별도 PR 분리 (선행 hook + consumer 후속)
6. **codex Gate 1+2**: 표준
7. **PR open**: `feat/use-arrow-key-navigation` → main (consumer 합본 시 N+44 동반)

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error (strict generic 정합)
- ✅ **vitest**: 20+ case PASS (`npx vitest run tests/unit/hooks/useArrowKeyNavigation.test.ts`)
- ✅ **lint**: clean
- ✅ **TypeScript export**: hook API 명시
- ✅ **회귀 0**: 다른 hook 시그니처 변동 0

---

**상태**: pre-flight 완료, 선행 RECORD (N+44/N+45 consumer 의존성)
**Stage 4 예상 PR 크기**: 2-3 commits, ~150 lines (hook + test), 2 file diff
