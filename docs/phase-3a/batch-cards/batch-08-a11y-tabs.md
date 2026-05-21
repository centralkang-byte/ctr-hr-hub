# Phase 3a · Batch 08 — Tabs a11y (F14 격상 트랙)

> **격상 일자**: 2026-05-21 KST (Session 228)
> **격상 사유**: N+34 pre-flight (`docs/phase-3a/stage4-preflight/n34-pill-tabs-filter.md`) 임계 카운트 **5/5 도달**. F14 N+9 RECORD 임계치 정확 도달, 별도 a11y 트랙 진입 임박 명시
> **base SHA**: phase3a-audit `7c62b878`
> **사용자 결재**: 2026-05-21 KST (가디언 round 통과)

---

## §1. 격상 배경

### F14 N+9 RECORD 인용 (`docs/phase-3a/batch-cards/01-myspace-leave.md:260-285`)

> ### N+9. F14 수동 tablist keyboard-nav 부재 (별도 a11y 트랙 — PR-3 외)
> - 격차: 수동 `<div role="tablist">` + `<button role="tab">` 세그먼트가 arrow-key 네비게이션·focus management 미구현
> - 트리거 임계 = 코드베이스 수동 tablist surface 누적 **5+** (D4 게이트 SSOT 5+ 동형 표준)
> - 현 누적 = 2 (LeaveClient + MyTasksClient) → 미달, 인프라 트랙 미진입
> - 가디언 G4: (ii)+(iii) 현행 유지 확정

### 임계 카운트 누적 검증 (2026-05-21 기준)

| # | Surface | 발견 위치 | F14 영향 |
|---|---|---|---|
| 1 | `LeaveClient.tsx` (PR-3 A.2 세그먼트) | 기존 RECORD F14 N+9 | 수동 tablist |
| 2 | `MyTasksClient.tsx:368` | 기존 RECORD F14 N+9 | 수동 tablist |
| 3 | **OnboardingDashboardClient Filters** | batch 07 N+34 pre-flight | rounded-full pill (informal) |
| 4 | **OffboardingDashboardClient Filters** | batch 07 N+34 pre-flight | 동일 |
| 5 | **N+32 ViewModeToggle** (예정) | batch 07 N+32 pre-flight | rounded button group |

→ **누적 5/5 정확 도달**. F14 임계 트리거 충족.

### 격상 의제 (Session 228 사용자 결재 통과)

가디언 default 결정: "F14 임계 도달 무시 금지" (가드 위반 위험). N+34 implementation 전 a11y 트랙 신설 → cross-cutting 일괄 처리 권고.

---

## §2. Surface 인벤토리 (5 누적)

### Tier A — 기존 RECORD F14 N+9 (2 surface)

| # | Surface | 파일 | 패턴 |
|---|---|---|---|
| 1 | LeaveClient | `src/app/(dashboard)/leave/LeaveClient.tsx` | `<div role="tablist">` + `<button role="tab">` segmented filter |
| 2 | MyTasksClient | `src/app/(dashboard)/my/tasks/MyTasksClient.tsx:368` | 동일 패턴 |

### Tier B — batch 07 pre-flight 신규 (3 surface)

| # | Surface | 파일 | 패턴 |
|---|---|---|---|
| 3 | OnboardingDashboardClient Filters | `src/app/(dashboard)/onboarding/OnboardingDashboardClient.tsx:245+` | `rounded-full` pill (role=tab 부재) |
| 4 | OffboardingDashboardClient Filters | `src/app/(dashboard)/offboarding/OffboardingDashboardClient.tsx` | 동일 |
| 5 | ViewModeToggle (예정) | `src/components/onboarding/ViewModeToggle.tsx` (N+32 신설 시) | 4 button group (role=tab 부재) |

### 추가 audit 후보 (Stage 1 P0 확정)

Stage 1 audit 진입 시 추가 surface 발견 가능성:
- `src/app/(dashboard)/org/OrgClient.tsx:556` (`TAB_STYLES.list` + ViewModeButton)
- batch 04 EmployeeDetailClient Tabs (Radix UI 적용 ✅ — N+23 pre-flight 결과)
- 기타 segmented filter 패턴

---

## §3. 진입 우선순위

**우선순위 = HIGH** (5 surface 일괄 audit + plan)

### Stage 4 implementation 트랙 진입 시점
- **PR-5A 머지 후** (모든 codebase 트랙 정합)
- **batch 07 N+34 implementation 동시 진행** 권고 (a11y patch 합본)
- **batch 07 N+32 ViewModeToggle 신설 시점** 와 cross-ref (5번째 surface 신설 + a11y 동시 적용)

### 진입 접근법 결정 게이트 (Stage 1 P0 audit 의제)
- **(A) Radix UI Tabs 일괄 마이그레이션** — 5 surface 전수 Radix 교체 (a11y free)
- **(B) `useArrowKeyNavigation` hook 신설** — 수동 tablist 보존 + 키보드 보강 (F14 N+9 옵션 b 정합)
- **(C) hybrid** — Radix 적합 surface 만 마이그레이션 + 나머지 수동 hook 적용

---

## §4. 다음 액션

1. **Stage 1 P0 audit** (별도 turn)
   - 5 surface 별 ARIA / 키보드 nav 결함 inventory
   - WCAG 2.1 Level A 충족 여부 (Tab 키 도달 vs Arrow-key roving)
   - Radix UI 마이그레이션 vs 수동 hook 정합 trade-off
2. **`useArrowKeyNavigation` hook spec (옵션 B 진입 시)**
   - Props: ref array, current index, onIndexChange, orientation
   - 키보드: ←/→/Home/End + focus follows selection
3. **Stage 2 카드 별도 작성** (batch 08 audit card)
4. **Stage 3 게이트 + Stage 4 pre-flight + implementation**

---

## §5. 의존성

### 선행 의존
- **batch 04 N+23 보정** (`ed297fec` — N+23 = proto only, 코드베이스 작업 0 확정) cross-ref
- **batch 07 N+34 pre-flight** (F14 임계 5/5 검증 결과) cross-ref

### 동반 진입 권고
- **batch 07 N+32** (ViewModeToggle 신설 시 a11y 동시 적용)
- **batch 07 N+34** (pill-tabs filter a11y 보강 동시 적용)

### Cross-batch SSOT 가용성
- `useArrowKeyNavigation` hook → 5 surface 공통 SSOT (옵션 B 진입 시)
- WAI-ARIA tablist 컨벤션 SSOT 문서 (`docs/a11y/tablist.md` 신설 후보)

---

## §6. RECORD 번호 reserve

본 batch는 a11y 트랙 = 5 surface × 패턴별 RECORD. **N+43~** reserve (batch 06 N+37~N+42 사용 후).

예상 RECORD inventory (Stage 2 audit 후 확정):
- N+43: `useArrowKeyNavigation` hook 신설 (또는 Radix 마이그레이션 결정 게이트) [HIGH]
- N+44: LeaveClient + MyTasksClient (기존 F14 N+9 surface) a11y 보강 [HIGH]
- N+45: OnboardingDashboardClient + OffboardingDashboardClient Filters a11y [MEDIUM]
- N+46: ViewModeToggle a11y (batch 07 N+32 동반) [MEDIUM]
- N+47: a11y 컨벤션 SSOT 문서 + axe-core 회귀 baseline [LOW]
- (Stage 2 audit 시 추가)

---

## §7. 가드

- ❌ **5 surface 단독 진입 금지** (cross-cutting 일괄 처리 — surface 별 회귀 위험)
- ❌ Radix UI 마이그레이션 결정 사전 합의 게이트 통과 전 진입 금지
- ❌ batch 07 N+32 ViewModeToggle 신설 시 a11y 가드 누락 금지 (동시 적용)
- ❌ `aria-pressed` / `role=tab` 정합 시 시각 회귀 위험 — gstack 시각 검증 필수
- ✅ WCAG 2.1 Level A 최소 충족 (Tab 키 도달 + Enter/Space 작동)
- ✅ AA 강화 = Arrow-key roving + focus follows selection (옵션 B 권고)
- ✅ axe-core 회귀 baseline (Stage 4 implementation 진입 시점)

---

**상태**: 격상 결정 (Stage 1 P0 audit 대기)
**다음 갱신**: batch 08 Stage 1 audit 별도 turn (5 surface 결함 inventory + Radix vs hook 결정 게이트)
