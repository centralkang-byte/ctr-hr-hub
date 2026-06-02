# N+36 Pre-flight — 카테고리 wt 토큰 (ON-013)

> **base SHA**: `1cd4a77c` · **트랙**: codebase 토큰화 · **우선**: LOW
> **결정 (Stage 3)**: OnboardingTaskCategory 8 enum → Workday wt 토큰 매핑 (batch 05 N+26 DeptFlowNode 패턴 정합)
> **본 pre-flight 결과 (요약)**: 8 enum × wt-1~8 토큰 매핑 가능. N+32 의존 (journey view + Hire Card 카테고리 색상). Phase 4 다크 합본 inventory entry 추가.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### OnboardingTaskCategory 8 enum

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
}
```

### Workday wt 토큰 inventory

batch 05 N+26 분석 결과 (`docs/phase-3a/stage4-preflight/n26-deptflownode-tokenize.md`):
- 현재 wt-1 ~ wt-8 (DeptFlowNode AVATAR_PALETTE 대체 대상)
- 다크 변형 정의 부재 → Phase 4 합본

### 카테고리 × wt 토큰 매핑 spec

| OnboardingTaskCategory | proto 매핑 | wt 토큰 (제안) | hex 인용 (라이트만) |
|---|---|---|---|
| DOCUMENT | proto DOCUMENT | `--wt-1` (sky/info) | `#0ea5e9` |
| TRAINING | proto TRAINING | `--wt-3` (green/success) | `#16a34a` |
| SETUP | proto ACCESS | `--wt-5` (amber/warning) | `#f59e0b` |
| INTRODUCTION | proto MEETING | `--wt-4` (accent) | `#7c3aed` |
| ORIENTATION | (별도) | `--wt-6` (cyan) | `#06b6d4` |
| COMPLIANCE | (별도) | `--wt-7` (rose) | `#e11d48` |
| ADMIN | (별도) | `--wt-2` (primary) | `#6366f1` |
| OTHER | fallback | `--wt-8` (pink/neutral) | `#ec4899` |

→ 8 enum 모두 매핑 가능. **신규 토큰 신설 불필요** (wt-1~8 충분).

### 코드베이스 현재 카테고리 색상 처리

| 파일 | 현재 패턴 |
|---|---|
| `OnboardingDashboardClient.tsx` | 카테고리 색상 인라인 미발견 (status badge 색상만) |
| (N+32 신설 컴포넌트) | OnboardingHireCard / OnboardingJourneyView 내부 — 본 RECORD 진입 시점에 추가 |

→ 본 RECORD는 **N+32 컴포넌트 신설 시 카테고리 색상 동시 적용** 가정.

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 변경 파일

| 파일 | 변경 | line delta |
|---|---|---|
| `src/lib/onboarding/category-color.ts` | **신규 SSOT** (~40 lines) — `categoryColor(cat: OnboardingTaskCategory) → string` (CSS variable name) | +40 |
| `src/components/onboarding/OnboardingJourneyView.tsx` (N+32 신설) | 카테고리 색상 = `var(--wt-N)` | +10 |
| `src/components/onboarding/OnboardingHireCard.tsx` (N+32 신설) | 카테고리 색상 (있다면) | +5 |
| `tailwind.config.ts` 또는 `globals.css` | wt-1~8 이미 정의 검증 (변경 0) | 0 |

### (b) category-color.ts SSOT spec

```ts
import type { OnboardingTaskCategory } from '@prisma/client'

const CATEGORY_TOKEN_MAP: Record<OnboardingTaskCategory, string> = {
  DOCUMENT: 'wt-1',
  TRAINING: 'wt-3',
  SETUP: 'wt-5',
  INTRODUCTION: 'wt-4',
  ORIENTATION: 'wt-6',
  COMPLIANCE: 'wt-7',
  ADMIN: 'wt-2',
  OTHER: 'wt-8',
}

export function categoryColorVar(cat: OnboardingTaskCategory): string {
  return `var(--${CATEGORY_TOKEN_MAP[cat]})`
}

export function categoryColorClass(cat: OnboardingTaskCategory): string {
  return `text-${CATEGORY_TOKEN_MAP[cat]}`
}
```

→ cross-batch 가용성: batch 04 EmployeeStatusChip, batch 05 DeptFlowNode와 같은 wt 토큰 SSOT 정합

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 0 (카테고리 라벨은 별도 — `onboarding.category.*` 5 locale, 본 RECORD 무관)
- **DB**: 0
- **API**: 0

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (LOW)**: 다크 변형 정의 부재 — Phase 4 합본 inventory에 ON-016 + N+36 entry 추가 필수
- **R2 (LOW)**: 8 enum 모두 색상 정합 시 단조로움 → 디자인 의도 검증 (가디언 sign-off)

### 의존성
- **N+32 (OnboardingHireCard + OnboardingJourneyView)** 선행 필수
- **PR-5A 머지** 후
- Phase 4 다크 트랙 — ON-016 + OG-018 + EM-019 + F19/F24/F26 합본

### 가드
- ❌ 인라인 hex 0건 (grep 검증)
- ❌ 신규 토큰 신설 금지 (wt-1~8 재사용)
- ✅ category-color.ts SSOT pure function
- ✅ Phase 4 다크 합본 entry 추가

---

## §5. Implementation 단계 (N+32 선행 후)

1. **사전 합의 게이트**:
   - 8 카테고리 × wt 매핑 디자인 sign-off (단조로움 검증)
2. **branch**: `feat/onboarding-category-color-tokens`
3. **commit 1 (SSOT 신설)**:
   - `src/lib/onboarding/category-color.ts` (~40 lines, pure function)
   - unit test (8 case)
4. **commit 2 (N+32 컴포넌트 적용)**:
   - OnboardingJourneyView + OnboardingHireCard 카테고리 색상 = SSOT 호출
5. **e2e**: 시각 회귀 (8 카테고리 색상 정합)
6. **gstack 시각**: 라이트 + 다크 known-deferred
7. **codex Gate 1+2**: 표준
8. **PR open**: `feat/onboarding-category-color-tokens` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **인라인 hex 0건**: grep `#[0-9a-f]{6}` in onboarding/* = 0
- ✅ **vitest**: 8 enum × wt 매핑 pure function 검증
- ✅ **시각 회귀**: 8 카테고리 visual 정합 (라이트)
- ✅ **Phase 4 다크 합본 inventory entry 추가**: F19/F24/F26 + EM-019 + OG-018 + ON-016 + **N+36** = **7 entry**

---

## §7. Phase 4 다크 트랙 누적 inventory 갱신

본 pre-flight 결과 Phase 4 다크 합본 inventory:

| # | RECORD | Surface | 다크 변형 부재 항목 |
|---|---|---|---|
| 1 | F19 | (legacy) | — |
| 2 | F24 | WorkdayHero | lavender |
| 3 | F26 | i18n date | — |
| 4 | EM-019 | EmployeeDetailClient perf 탭 | oklch light-tinted |
| 5 | OG-018 | DeptFlowNode + OrgClient | oklch purple |
| 6 | ON-016 | OnboardingHireCard + journey view | av-hue + status pill oklch |
| 7 | **N+36** | OnboardingJourneyView 카테고리 색상 (라이트만) | wt-1~8 다크 변형 미정의 |

→ **누적 6 → 7 entry**. Phase 4 다크 batch 트랙 진입 시 일괄 처리.

---

**상태**: pre-flight 완료, N+32 의존, Phase 4 다크 inventory +1
**Stage 4 예상 PR 크기**: 2 commits, ~55 lines, 3 file diff
