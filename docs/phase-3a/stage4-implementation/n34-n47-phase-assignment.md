# N+34 / N+47 Phase 미할당 검증 + HANDOVER §3 그래프 정정 inventory

> **base SHA**: `80a87ba2` (audit §9.5 단일 진실 commit)
> **작성일**: 2026-05-22 KST (Session 230 HOLD 슬롯)
> **트랙**: readonly inquiry + 결정 문서 신설 (audit 본문 정정 0)
> **선행 audit**: [phase-a-entry-audit.md §9.5 5-Phase 분류 기준](./phase-a-entry-audit.md) (단일 진실)
> **HOLD 컨텍스트**: PR #64 (`fde915ef`) + PR #65 (`df2617f8`) 머지 대기

---

## §0. 1분 요약

audit §9.5 Phase 분류표에 미포함 2 RECORD (N+34 / N+47) 사양 본문 검증 + Phase 할당 결정:

- **N+34 = (b) batch 07 N+45 합본 PR 흡수 → Phase D** (사양 명시: N+45 §1 §4 "batch 07 N+34 cross-batch 합본 PR 권고 (A)")
- **N+47 = (b) Phase D 이동 (batch 08 a11y 트랙 수렴 RECORD, 별 PR)** (사양 명시: N+43~N+46 머지 후 진입 필수 + Phase D "a11y 합본 PR" 정의 정합)
- **§3 그래프 정정 inventory**: Phase B + N+33 / Phase C 내 N+32 sub-graph / Phase D + N+34·N+47 / batch 08 a11y 트랙 순서 명시 — 가디언 측 HANDOVER §3 정정용 dictate

---

## §1. N+34 Phase 결정 → (b) batch 07 N+45 합본 PR 흡수, Phase D

### 1.1 사양서 4 선택지 검증

| 선택지 | 채택 결정 |
|---|---|
| (a) Phase D 정합 누락 (단독 Phase D) | ❌ 거부 — 사양상 N+45와 합본 PR이지 단독 진입 아님 |
| (b) batch 07 N+45 합본 PR 흡수 | ✅ **채택** |
| (c) 별 Phase | ❌ 거부 — 5-Phase 정의 외 새 Phase 신설 over-engineering |
| (d) 기타 | ❌ 거부 |

### 1.2 (b) 채택 근거 — 사양 본문 인용

**N+45 사양 본문** (`docs/phase-3a/stage4-preflight/n45-onboarding-filter-batch07-merge.md` L4-5):

> **결정 (Stage 3 Q1=C hybrid)**: Onboarding/OffboardingFilter = radiogroup (panel 부재), **batch 07 N+34 (pill-tabs aria-pressed + count display + URL persist) 합본 PR 권고**
>
> **본 pre-flight 결과 (요약)**: ✅ 합본 PR scope 정합. batch 07 N+34 변경 + N+45 a11y 보강 단일 PR `feat/onboarding-pill-tabs-filter-a11y`.

**N+45 §1 합본 PR 결정 게이트** (L35-50):

> | 항목 | A 합본 PR | B 순차 PR |
> |---|---|---|
> | 변경 line | +110 (N+34) + +20 (N+45) = +130 | N+34 +110, N+45 +20 (별도) |
> | 회귀 위험 | 1회 머지 = 회귀 1회 검증 | 2회 머지 = 회귀 2회 검증 |
> | 권장도 | ⭐ **A 권장** (효율 + 회귀 최소) | 안전하지만 비효율 |
>
> → **A 합본 PR 권고**

→ N+34 = N+45 합본 PR 진입 (단일 PR `feat/onboarding-pill-tabs-filter-a11y`). audit §9.5 Phase D "N+45·N+46" 표기에 **N+34도 함께 포함** (N+34/N+45 합본).

### 1.3 audit §9.5 Phase D 정정 권고 (별도 turn)

현재 (`80a87ba2`):
```
| Phase D | ... | N+27 · N+44 · N+45·N+46 · N+49/N+50·N+53 |
```

권고 정정:
```
| Phase D | ... | N+27 · N+44 · N+34/N+45·N+46 · N+49/N+50·N+53 |
```

또는 N+34가 N+45 합본 PR scope에 흡수되어 implicit인 점 감안 시:
```
| Phase D | ... | N+27 · N+44 · N+45·N+46 (← N+34 합본) · N+49/N+50·N+53 |
```

가드 정합 (본 turn `audit §본문 정정 0`) — 정정은 별도 turn.

---

## §2. N+47 Phase 결정 → (b) Phase D 이동 (batch 08 a11y 트랙 수렴 RECORD, 별 PR)

### 2.1 사양서 4 선택지 검증

| 선택지 | 채택 결정 |
|---|---|
| (a) Phase E 미포함 정합 | ❌ 거부 — Phase E = "DB schema migration 동반". N+47은 docs + CI, schema 무관 |
| (b) Phase D 이동 | ✅ **채택** (batch 08 a11y 트랙 수렴 RECORD, 별 PR) |
| (c) 별 트랙 (Phase F?) | ❌ 거부 — 새 Phase 신설 over-engineering. audit §9.5 5-Phase 정의 유지 |
| (d) 기타 | ❌ 거부 |

### 2.2 (b) 채택 근거 — 사양 본문 인용

**N+47 사양 본문** (`docs/phase-3a/stage4-preflight/n47-a11y-ssot-axe-baseline.md` L1-5):

> # N+47 Pre-flight — a11y SSOT 문서 + axe-core baseline (최후)
>
> > **base SHA**: `1401e8ca` · **트랙**: docs + CI · **우선**: LOW
> > **결정 (Stage 3 Q5=A+B)**: A11Y-001 정의 명문화 + a11y SSOT 문서 + axe-core baseline CI
> > **본 pre-flight 결과 (요약)**: ⭐ **`.claude/rules/accessibility.md` 기존 존재** — 신규 SSOT 신설 X, 기존 확장 정합.

**N+47 §4 의존성** (L99-101):

> ### 의존성
> - **N+43 / N+44 / N+45 / N+46 머지 후 진입 필수** (최후 RECORD)
> - **PR-5A 머지** 후
> - 다른 RECORD 의존성 없음 (최후 RECORD)

**N+47 변경 surface** (L51-79):

| 변경 | 내용 | LOC |
|---|---|---|
| `.claude/rules/accessibility.md` 확장 | F14 정의 + Radix vs radiogroup 가이드 + hook 가이드 + 5 surface cross-ref | +110 |
| axe-core baseline (이미 도입 시) | 5 surface 0 violation 검증 + CI gate | +30 |
| axe-core 미도입 시 | `@axe-core/playwright` 설치 + config | +80 |

→ N+47 = **docs 비중 + CI baseline + SSOT 확장** (`.claude/rules/accessibility.md` 기존 확장, 신규 신설 X). src/ codebase mutation 거의 0.

### 2.3 (b) Phase D 이동 근거 — 정량 분석

| 기준 | (a) Phase E 거부 | (b) Phase D 채택 | (c) Phase F 거부 |
|---|---|---|---|
| DB schema migration | ❌ 무관 (Phase E 정의 위반) | ✅ 무관 (Phase D 무관) | — |
| audit §9.5 Phase D 정의 "a11y 합본 PR" 정합 | — | ✅ **batch 08 a11y 트랙 수렴** | — |
| N+43~N+46 머지 후 진입 | — | ✅ Phase D 내 최후 진입 정합 | — |
| 5-Phase 정의 유지 | — | ✅ | ❌ 새 Phase 신설 |
| over-engineering | — | ✅ 최소 | ❌ |

**(b) 채택 정합 단언**:

1. **batch 08 a11y 트랙 수렴 RECORD**: N+43 (hook 신설, Phase B) → N+44 (MyTasks/Leave migration, Phase D) → N+45/N+46 (Filter/Toggle a11y, Phase D 합본) → **N+47 (SSOT 확장 + baseline, Phase D 마지막)**
2. **audit §9.5 Phase D 정의 정합**: "codebase 대 블라스트 (위저드 4종 migration 등 SSOT consumer 합본 + **a11y 합본 PR**)" — N+47은 a11y 합본 트랙의 종결 RECORD
3. **합본 PR 아닌 별 PR**: N+43~N+46 머지 후 baseline 캡처 의미 발생 — 합본 PR scope 부적합. **별 PR로 진입** (`feat/a11y-conventions-axe-baseline`)
4. **LOC 작음 (~150)이나 cross-cutting**: docs 비중 + CI 인프라 = "대 블라스트" 정의와 미부합하지만 batch 08 a11y 트랙 종결 의미로 Phase D 정합

### 2.4 audit §9.5 Phase D 정정 권고 (별도 turn)

현재 (`80a87ba2`):
```
| Phase D | ... | N+27 · N+44 · N+45·N+46 · N+49/N+50·N+53 |
```

권고 정정 (N+34 + N+47 합):
```
| Phase D | ... | N+27 · N+44 · N+34/N+45·N+46 · N+47 (별 PR) · N+49/N+50·N+53 |
```

---

## §3. HANDOVER §3 cross-batch 그래프 정정 항목 inventory (가디언 측 dictate)

`HANDOVER_PHASE3A.md` 부재 (Stage 4 pre-flight 종결 SHA `a147d919` 시점). audit `phase-a-entry-audit.md` §3.3 단방향 그래프 (`180aceb1`) 가 단일 진실.

본 §3은 가디언 측 HANDOVER §3 신설 시 단방향 그래프 dictate 인용. audit `80a87ba2` 정정 후 추가 사항 + 본 turn 결정 (N+34/N+47) 반영.

### 3.1 audit §3.3 현재 그래프 (단일 진실, `180aceb1`)

```
Phase A (proto SSOT layer)
   ├─ N+21 (DemoLimitBanner) ──────→ N+27 / N+49 / N+50 / N+53 (위저드 4종 consumer)
   ├─ N+22 (EmployeeStatusChip) ───→ N+31 (StatusChips 8 surface codebase 측)
   ├─ N+19 / N+20 (data.js SSOT) ──→ Phase A 후속 + 후속 N+18/N+30 매핑 의존
   ├─ N+23 / N+25 / N+28 / N+29 ──→ (proto only, downstream 없음)
   ↓
Phase B (SSOT 신설 codebase)
   ├─ N+24 (StatusChips + PageHeader) ─→ N+31 cross-batch
   ├─ N+43 (useArrowKeyNavigation hook) ─→ N+44 / N+45 / N+46
   ├─ N+44 (MyTasks + Leave migration) ─→ N+45 / N+46 합본
   └─ N+48 (WizardShell SSOT) ─→ N+49 / N+50 / N+53
   ↓
Phase C/D/E (codebase 적용)
```

### 3.2 정정 inventory (총 6 항목)

| # | 정정 항목 | 출처 |
|---|---|---|
| 1 | **Phase B에 N+33 추가** (DB seed + proto data SSOT 양면, 의존성 0, cross-batch upstream — OnboardingTemplate default seed) | audit §9.1 (`80a87ba2`) |
| 2 | **Phase C 내 sub-graph 추가**: `N+32 ─→ N+35 (필수) / N+36 (권고)` (Hire Card actions area + 카테고리 색상 토큰화) | audit §9.2 + §9.3 (`80a87ba2`) |
| 3 | **Phase D에 N+34 추가 (N+45 합본 PR 흡수)**: `N+43 (hook) ─→ N+44 / N+34·N+45 / N+46 / N+47` (batch 08 a11y 트랙 순서) | 본 §1 (N+45 사양 §1·§4 인용) |
| 4 | **Phase D에 N+47 추가 (별 PR, batch 08 a11y 수렴 RECORD)**: `N+44 / N+45·N+46 머지 후 → N+47 진입 (최후 RECORD)` | 본 §2 (N+47 사양 §4 의존성 인용) |
| 5 | **N+33 cross-batch consumer 화살표 추가**: `N+33 (OnboardingTemplate seed default) ─→ batch 06/07/Hire Card consumer` (cross-batch upstream 가능성) | audit §9.1 단언 |
| 6 | **batch 08 a11y 트랙 진입 순서 명시**: `N+43 → N+44 → (N+34/N+45)/N+46 합본 → N+47 (별 PR, 최후)` (Phase D 내 sub-graph) | N+47 사양 §4 + N+45 사양 §1 합 |

### 3.3 정정 후 단방향 그래프 (dictate, HANDOVER §3 신설 시 인용)

```
Phase A (proto SSOT layer)
   ├─ N+21 (DemoLimitBanner) ──────→ N+27 / N+49 / N+50 / N+53 (위저드 4종 consumer)
   ├─ N+22 (EmployeeStatusChip) ───→ N+31 (StatusChips 8 surface codebase 측)
   ├─ N+19 / N+20 (data.js SSOT) ──→ Phase A 후속 + 후속 N+18/N+30 매핑 의존
   ├─ N+23 / N+25 / N+28 / N+29 ──→ (proto only, downstream 없음)
   ↓
Phase B (SSOT 신설 codebase, 의존성 0)
   ├─ N+24 (StatusChips + PageHeader) ─→ N+31 cross-batch
   ├─ N+33 (OnboardingTemplate seed) ──→ batch 06/07 consumer + Hire Card default (cross-batch upstream) ⭐ 신규
   ├─ N+43 (useArrowKeyNavigation hook) ─→ N+44 / N+34·N+45 / N+46 / N+47
   ├─ N+44 (MyTasks + Leave migration) ─→ N+45 / N+46 합본
   └─ N+48 (WizardShell SSOT) ─→ N+49 / N+50 / N+53
   ↓
Phase C (codebase 적용, 소~중 블라스트)
   ├─ N+32 (view mode + Hire Card + journey) ─→ N+35 (필수) / N+36 (권고) ⭐ 신규 sub-graph
   ├─ N+17 / N+18 / N+26 / N+30 / N+31 (독립 또는 SSOT consumer)
   ↓
Phase D (codebase 대 블라스트 + a11y 합본 PR)
   ├─ N+27 (Restructure full-screen) ← N+21 + N+48 consumer
   ├─ N+44 (MyTasks/Leave migration) ← N+43 consumer
   ├─ N+34/N+45 (Onboarding/Offboarding Filter 합본 PR) ← N+43 + N+22 consumer ⭐ N+34 추가
   ├─ N+46 (ViewModeToggle a11y) ← N+43 consumer
   ├─ N+47 (a11y SSOT 확장 + axe-core baseline, 별 PR 최후) ← N+43~N+46 머지 후 ⭐ 신규
   └─ N+49 / N+50 / N+53 (위저드 migration) ← N+21 + N+48 consumer
   ↓
Phase E (격상 batch 풀스택, DB schema migration 동반)
   └─ N+37 ~ N+42 (batch 06 직원 경력 데이터)
```

**단방향성 단언**: Phase A → B → C → D → E. 역방향 의존 0 (audit §3.2/§3.3 정합).

### 3.4 batch 08 a11y 트랙 순서 (Phase D 내 sub-graph 명시)

```
N+43 (hook 신설, Phase B 카나리, 의존성 0)
   ↓
N+44 (MyTasks + Leave migration, Phase D 첫 consumer)
   ↓
N+34/N+45 (Onboarding/Offboarding Filter 합본 PR, Phase D)
   ↓
N+46 (ViewModeToggle a11y, Phase D)
   ↓
N+47 (a11y SSOT 확장 + axe-core baseline, 별 PR 최후) ⭐ baseline 캡처 의미 = 위 4 PR 머지 후
```

---

## §4. 본 turn 결정 단언

| RECORD | 채택 Phase | 사양 본문 인용 |
|---|---|---|
| **N+34** | **Phase D (N+45 합본 PR 흡수)** ✅ | N+45 §1 §4 "batch 07 N+34 cross-batch 합본 PR 권고 (A)" |
| **N+47** | **Phase D (batch 08 a11y 수렴 RECORD, 별 PR)** ✅ | N+47 §4 "N+43~N+46 머지 후 진입 필수 (최후 RECORD)" |

---

## §5. Out of scope (가드 정합)

- **audit `80a87ba2` §본문 정정** — 본 결정 반영 §9.5 정정은 별도 turn (가드 명시)
- **HANDOVER 본 정정** — 가디언 own turn (본 §3 inventory 인용 dictate만)
- **batch-cards/README + stage4-preflight/README count inconsistency 정정** — 별도 turn
- **PR #64 / PR #65 머지** — 정상 review (본 turn 무관)
- **새 Phase F 신설** — over-engineering, 5-Phase 정의 유지

---

**상태**: ACTIVE (HOLD 슬롯 결정 SSOT)
**다음 갱신**: 가디언 측 HANDOVER §3 신설 시 본 §3.3 그래프 인용. audit §9.5 정정은 별도 turn.
**책임 단언**: 본 결정 문서가 N+34/N+47 Phase 할당 + §3 그래프 정정 inventory의 **단일 진실** (audit §9.5 정정 전까지).
