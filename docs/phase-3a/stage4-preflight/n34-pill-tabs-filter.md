# N+34 Pre-flight — pill-tabs 상태 필터 정합 (ON-012)

> **base SHA**: `1cd4a77c` · **트랙**: codebase 정합 · **우선**: MEDIUM
> **결정 (Stage 3)**: proto pill-tabs 4 상태 필터 (all/progress/done/delay) 정합 + count display SSOT
> **본 pre-flight 결과 (요약)**: 코드베이스 = `Filters` (rounded-full pill, line 245+) 패턴 이미 적용. count display 신규 + URL persist 보강.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### 코드베이스 현황

**`OnboardingDashboardClient.tsx`** Filters 영역 (line 245+):
```tsx
{FILTER_OPTIONS.map((opt) => (
  <button
    onClick={() => { setFilter(opt.value); setPage(1) }}
    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
      filter === opt.value
        ? 'bg-primary text-white border-primary'
        : 'bg-card text-muted-foreground border-border hover:border-primary'
    }`}
  >
    {opt.label}
  </button>
))}
```

→ **이미 pill 패턴 정합** (rounded-full border + active state). 다만:
- `role="tab"` / `aria-pressed` 부재 (informal button group)
- `<count-display><b>{filtered.length}</b>건</count-display>` SSOT 부재
- URL persist 부재
- 상태 4종 (all/progress/done/delay) 검증 필요

### Proto 패턴

```jsx
<div className="pill-tabs">
  <button aria-pressed={status === "all"}      onClick={...}>전체</button>
  <button aria-pressed={status === "progress"} onClick={...}>진행 중</button>
  <button aria-pressed={status === "done"}     onClick={...}>완료</button>
  <button aria-pressed={status === "delay"}    onClick={...}>지연</button>
</div>
<span className="count-display"><b>{filtered.length}</b>건</span>
```

→ `aria-pressed` + `count-display` 패턴 = codebase 추가 적용

### F14 임계 카운트 검증

현재 누적 (수동 tablist surface):
1. `LeaveClient.tsx` (PR-3 A.2 세그먼트)
2. `MyTasksClient.tsx:368`

**N+34 후 추가 surface**:
- OnboardingDashboardClient Filters (현재 `aria-pressed` 부재) → 추가 시 +1
- OffboardingDashboardClient Filters (동일) → +1
- N+32 ViewModeToggle (별도 surface) → +1

→ **임계 카운트 누적 2 → 5** (정확히 임계 도달!). **F14 별도 a11y 트랙 진입 임박** (메모 필수)

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 변경 파일

| 파일 | 변경 | line delta |
|---|---|---|
| `OnboardingDashboardClient.tsx` | `aria-pressed` 추가 + count display 추가 | +15 |
| `OffboardingDashboardClient.tsx` | 동일 | +15 |
| `src/components/shared/CountDisplay.tsx` | **신규** (~30 lines) SSOT — `<b>{count}</b>건` 패턴 | +30 |
| URL persist (next/navigation) | 2 dashboard에 useSearchParams + push 패턴 | +20 |
| `messages/*.json` | 4 status 라벨 (또는 기존 재사용) | 0~20 |

### (b) CountDisplay SSOT spec

```tsx
interface CountDisplayProps {
  count: number
  unit?: string  // "건", "명", "개"
  className?: string
}

function CountDisplay({ count, unit = '건' }: CountDisplayProps) {
  return (
    <span className="text-sm">
      <b className="font-bold text-foreground">{count.toLocaleString()}</b>
      <span className="text-muted-foreground ml-0.5">{unit}</span>
    </span>
  )
}
```

→ cross-batch 공통화 후보 (batch 04 employees count display 도 동일 패턴)

### (c) URL persist 패턴

```tsx
const router = useRouter()
const searchParams = useSearchParams()
const status = (searchParams.get('status') ?? 'all') as Status

const setStatus = (v: Status) => {
  const params = new URLSearchParams(searchParams.toString())
  if (v === 'all') params.delete('status')
  else params.set('status', v)
  router.push(`?${params.toString()}`)
}
```

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 4 status 라벨 기존 재사용 추정 (`onboarding.statusAll/InProgress/Done/Delayed`). 부재 시 신규 4 × 5 = 20 entries
- **DB**: 변경 0
- **API**: 변경 0 (client-side filter)

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (MEDIUM)**: F14 임계 카운트 도달 — 현재 2 + N+34 +2 (2 dashboard) + N+32 ViewModeToggle +1 = **5 임계 정확 도달**. F14 별도 a11y 트랙 자동 진입 트리거 가능성. **N+34 진입 전 가디언 합의 필요**
- **R2 (LOW)**: URL persist 도입 시 기존 deep link 회귀 (없음 — 새 feature)
- **R3 (LOW)**: CountDisplay SSOT cross-batch 공통화 결정 게이트 (N+34 단독 신설 vs SSOT 공통화)

### 의존성
- **PR-5A 머지** 후
- **F14 a11y 트랙 검토 게이트** — 임계 도달 시 분리 진입 권고
- **CountDisplay SSOT cross-batch 결정** — batch 04 count 패턴과 통합 여부

### 가드
- ❌ F14 임계 도달 무시 금지 (별도 트랙 메모 필수)
- ❌ `aria-pressed` 없이 button group 신설 금지
- ✅ 기존 i18n 키 재사용 우선

---

## §5. Implementation 단계 (PR-5A 머지 후)

1. **사전 합의 게이트**:
   - F14 임계 도달 처리 — N+34 동반 진입 vs 별도 a11y 트랙 분리
   - CountDisplay SSOT 단독 신설 vs cross-batch 공통화
2. **branch**: `feat/onboarding-pill-tabs-filter`
3. **commit 1 (CountDisplay SSOT, 선택)**:
   - `src/components/shared/CountDisplay.tsx` 신규 (~30 lines)
4. **commit 2 (Filters 정합 + URL persist)**:
   - 2 dashboard `aria-pressed` 추가 + count display + URL searchParams
5. **e2e**: `e2e/flows/onboarding-filter-persist.spec.ts` — 4 status × URL persist + count 정합
6. **gstack 시각**: pill 패턴 회귀 0
7. **codex Gate 1+2**: 표준
8. **PR open**: `feat/onboarding-pill-tabs-filter` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **e2e**: URL persist + count display + 4 status filter 시나리오
- ✅ **a11y**: `aria-pressed` axe-core 검사 PASS
- ✅ **F14 카운트**: 누적 5 도달 인정 + 별도 트랙 메모 추가
- ✅ **회귀 0**: 기존 filter 동작 무변동

---

## §7. F14 임계 도달 별도 트랙 메모

본 pre-flight 결과 F14 임계 도달 (누적 2 → 5):

| # | Surface | Pattern |
|---|---|---|
| 1 | `LeaveClient.tsx` | `<div role="tablist">` 수동 |
| 2 | `MyTasksClient.tsx:368` | 동일 |
| 3 | OnboardingDashboardClient Filters | rounded-full pill |
| 4 | OffboardingDashboardClient Filters | 동일 |
| 5 | N+32 ViewModeToggle (예정) | rounded button group |

→ **F14 별도 a11y batch 트랙 진입 임박**. PR-5A 머지 + N+32/N+34 머지 후 진입 우선순위 격상 권고.

---

**상태**: pre-flight 완료, F14 임계 도달 메모
**Stage 4 예상 PR 크기**: 2 commits, ~80 lines + 20 i18n entries, 4 file diff
