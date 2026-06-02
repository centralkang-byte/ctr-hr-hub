# N+45 Pre-flight — Onboarding/Offboarding Filter radiogroup (batch 07 N+34 cross-batch 합본)

> **base SHA**: `1401e8ca` · **트랙**: codebase + cross-batch 합본 PR · **우선**: MEDIUM
> **결정 (Stage 3 Q1=C hybrid)**: Onboarding/OffboardingFilter = radiogroup (panel 부재), batch 07 N+34 (pill-tabs aria-pressed + count display + URL persist) 합본 PR 권고
> **본 pre-flight 결과 (요약)**: ✅ 합본 PR scope 정합. batch 07 N+34 변경 + N+45 a11y 보강 단일 PR `feat/onboarding-pill-tabs-filter-a11y`.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### batch 07 N+34 pre-flight cross-ref

`docs/phase-3a/stage4-preflight/n34-pill-tabs-filter.md` (186 lines) finding:
- OnboardingDashboardClient Filters: `rounded-full pill button` 패턴
- OffboardingDashboardClient Filters: 동일 패턴
- 신규 SSOT `<CountDisplay>` 컴포넌트 (~30 lines)
- URL persist (useSearchParams)
- `aria-pressed` 추가 (n34 §4 권고)

### N+45 추가 작업 inventory

batch 07 N+34 변경분 + N+45 a11y 보강:

| 변경 | batch 07 N+34 | N+45 (a11y) |
|---|---|---|
| `aria-pressed` 추가 | ✅ | ✅ (필수) |
| count display | ✅ | — |
| URL persist | ✅ | — |
| `role="radiogroup"` | — | ✅ (신규) |
| `role="radio"` + `aria-checked` | — | ✅ (신규, `aria-pressed` 대체 또는 병행) |
| `useArrowKeyNavigation` hook | — | ✅ (신규) |
| tabIndex roving | — | ✅ (신규) |
| `aria-label` 그룹 라벨 | — | ✅ (신규) |

**합본 PR 결정 게이트**:
- **(A) 합본 PR `feat/onboarding-pill-tabs-filter-a11y`** — batch 07 N+34 + N+45 단일 PR
- **(B) 순차 PR**: N+34 먼저 머지 → N+45 후속

### 합본 PR scope 분석

| 항목 | A 합본 PR | B 순차 PR |
|---|---|---|
| 변경 line | +110 (N+34) + +20 (N+45) = +130 | N+34 +110, N+45 +20 (별도) |
| 회귀 위험 | 1회 머지 = 회귀 1회 검증 | 2회 머지 = 회귀 2회 검증 |
| 머지 순서 | 단일 | N+34 선행 필수 (N+45 의존) |
| 시각 검증 | 1회 (gstack) | 2회 (gstack) |
| e2e 시나리오 | URL persist + count + a11y 통합 | 분리 검증 |
| 권장도 | ⭐ **A 권장** (효율 + 회귀 최소) | 안전하지만 비효율 |

→ **A 합본 PR 권고**

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 합본 PR scope

| 파일 | 변경 (batch 07 N+34) | 변경 (N+45 a11y) | line delta |
|---|---|---|---|
| `OnboardingDashboardClient.tsx:247+` | aria-pressed + count + URL persist | role=radiogroup + radio + hook + roving | +30 |
| `OffboardingDashboardClient.tsx` | 동일 | 동일 | +30 |
| `OnboardingDashboardClient.tsx` API | response 4 chip data 필드 | — | +20 |
| `OffboardingDashboardClient.tsx` API | 동일 | — | +20 |
| `src/components/shared/CountDisplay.tsx` (N+34 신설) | +30 | — | +30 |
| i18n 5 locale | chips 라벨 + aria-label | aria-label 라벨 | +30 entries |

### (b) 합본 PR commit 분할 권고

| Commit | 내용 |
|---|---|
| 1 | CountDisplay SSOT 신설 (N+34 부속) |
| 2 | OnboardingDashboardClient + OffboardingDashboardClient: pill-tabs + count + URL persist + a11y radiogroup + hook 통합 적용 |
| 3 | API response 4 chip data 추가 (N+31 cross-ref) |
| 4 | i18n 5 locale 정합 |

### (c) 예상 총 line delta

- src code: ~+130 lines (합본 PR)
- i18n: ~+30 entries
- 4 file diff (또는 5 with CountDisplay)

---

## §3. i18n / DB / API 영향 평가

- **i18n**: ~30 entries (4 chip 라벨 + aria-label + count display unit)
- **DB**: 0
- **API**: `/api/v1/onboarding/dashboard` + `/api/v1/offboarding/dashboard` response 확장 (N+31 cross-ref, 무손실)

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (MEDIUM)**: 합본 PR scope = 130+ lines, 변경 surface 4개. 회귀 위험 분산
- **R2 (MEDIUM)**: `aria-pressed` (toggle button 의미) vs `aria-checked` (radio 의미) — 단일 선택 필터는 radio 정합. N+34 권고 `aria-pressed` → **N+45에서 `aria-checked` 우선** 권고
- **R3 (LOW)**: hook + URL persist 통합 — `activeIndex` state ↔ URL searchParams 양방향 동기 필요

### 의존성
- **N+43 (hook)** 선행 필수
- **N+31 (StatusChips dashboard 도입)** 와 별도 (N+31 = chips, N+34/N+45 = filter)
- **PR-5A 머지** 후

### 가드
- ❌ batch 07 N+34 + N+45 분리 머지 시 N+34 (a11y 없는 aria-pressed) 임시 상태로 머지 위험 — 합본 PR 권고
- ❌ `aria-pressed` vs `aria-checked` 결정 사전 합의 (radio 정합)
- ✅ CountDisplay SSOT 단독 commit (cross-batch 가용성)
- ✅ axe-core 0 violation
- ✅ playwright URL persist + 키보드 nav + count 정합

---

## §5. Implementation 단계 (N+43 선행 후, 합본 PR)

1. **사전 합의 게이트**:
   - `aria-pressed` vs `aria-checked` 결정 (radio 정합 = `aria-checked`)
   - 합본 PR vs 순차 PR (A 권고)
2. **branch**: `feat/onboarding-pill-tabs-filter-a11y` (cross-batch 합본)
3. **commit 1 (N+34 부속 — CountDisplay SSOT)**:
   - `src/components/shared/CountDisplay.tsx` 신설 (~30 lines)
4. **commit 2 (N+34 + N+45 통합 — Filter a11y + URL persist + count)**:
   - OnboardingDashboardClient + OffboardingDashboardClient
   - role="radiogroup" + role="radio" + aria-checked + useArrowKeyNavigation + URL persist + count display
5. **commit 3 (API 확장)**:
   - dashboard API response chip data 4 필드 (N+31 cross-ref)
6. **commit 4 (i18n 5 locale)**:
   - ~30 entries
7. **e2e**: `e2e/flows/onboarding-filter-a11y.spec.ts` — URL persist + 키보드 nav + count + axe-core
8. **gstack 시각**: pill 패턴 회귀 0
9. **codex Gate 1+2**: 표준
10. **PR open**: `feat/onboarding-pill-tabs-filter-a11y` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **axe-core**: 0 violation (2 dashboard)
- ✅ **e2e**: URL persist + count + 키보드 nav + 4 status filter 통합 시나리오
- ✅ **시각 회귀**: pill 패턴 라이트 무변동
- ✅ **F14 카운트**: 누적 5 → +1 = 6 (Onboarding) + 7 (Offboarding) — 단 본 batch 진입 시점에서 임계 추적 의미 0 (정의 명문화 + 해소 트랙)

---

**상태**: pre-flight 완료, batch 07 N+34 cross-batch 합본 PR 권고
**Stage 4 예상 PR 크기**: 4 commits, ~130 lines + 30 i18n entries, 4-5 file diff
