# Phase 3a · Stage 4 · Phase B 진입 첫 PR 후보 사전 평가 audit

> **base SHA**: `166fbfc6` (Phase A 8/8 PR open 마일스톤 후속, README count 정정 commit)
> **작성일**: 2026-05-22 KST (Session 230)
> **목적**: Phase B (codebase SSOT 신설) 진입 4 RECORD 사전 평가 + Phase A → B 단방향 의존성 verify + 첫 PR 카나리 권고
> **트리거**: Phase A 8/8 PR open 마일스톤 (PR #64-#70, ~+224 LOC Pure proto only) 후속 HOLD 슬롯
> **작업 종류**: readonly audit (src/ + prisma/ + messages/ 변경 0, doc 신규 1 파일)
> **선행 audit**: [phase-a-entry-audit.md `5e063d37`](./phase-a-entry-audit.md) (Phase A SSOT layer 단일 진실 + §9.5 5-Phase 분류 기준)
> **보조 결정**: [n34-n47-phase-assignment.md `8e09a3f1`](./n34-n47-phase-assignment.md) (N+47 = Phase D 결정 cross-ref)

---

## §0. 1분 요약

1. **Phase B 4 RECORD** 확정 (audit §9.5 Phase B 단일 진실 정합): **N+24** (StatusChips + PageHeader 재사용) · **N+33** (OnboardingTemplate seed) · **N+43** (useArrowKeyNavigation hook) · **N+48** (WizardShell SSOT)
2. **Phase A → B 역의존 0** ✅ 단방향 verify 통과. Phase B 4 RECORD 모두 Phase A 7 PR (#64-#70) 머지 무관 단독 진입 가능 (proto SSOT layer는 design 청사진만, runtime 의존 0)
3. **SSOT 신설 위치 정합** ✅: `src/components/shared/` (N+24 StatusChips + N+48 WizardShell) · `src/hooks/` (N+43 useArrowKeyNavigation) · `prisma/` (N+33 seed). 모두 기존 codebase 패턴 cross-ref 정합
4. **첫 PR 카나리 권고 = N+43** (`useArrowKeyNavigation` hook): 가장 단순 (~+150 LOC hook + test), UI 영향 0, codebase mutation 최소, Phase B SSOT 패턴 검증 적격
5. **권고 진입 순서**: N+43 (carrier 의존 0, hook only) → N+24 (cross-batch 4 consumer, design SSOT) → N+33 (DB seed 12 법인) → N+48 (sizable ~+210 LOC, Phase D 위저드 migration consumer)
6. **cross-batch consumer 영향**: N+24 → Phase C N+31 + Phase D N+50 / N+33 → batch 06/07 OnboardingTemplate / N+43 → Phase D N+44/N+45 (a11y migration) / N+48 → Phase D N+49/N+50/N+53 (wizard migration)

---

## §1. Phase B 4 RECORD inventory + 분류

audit `5e063d37` §9.5 Phase B 정의 정합: **SSOT 신설 / 카나리 (의존성 0, cross-batch upstream)**.

| RECORD | batch | 우선 | 트랙 | 카운트 |
|---|---|---|---|---|
| **N+24** | 05 | HIGH | codebase shared SSOT (PageHeader 재사용 + StatusChips 신규) | 1 |
| **N+33** | 07 | MEDIUM | DB seed + proto data SSOT 양면 | 1 |
| **N+43** | 08 | HIGH | codebase hook SSOT | 1 |
| **N+48** | 09 | HIGH (⭐ critical 선행) | codebase shared SSOT | 1 |

**Phase B 합계 = 4 RECORD** ✅ (audit §9.5 카운트 정합).

### 1.1 4 RECORD 사양 요약 (사양 본문 인용)

#### N+24 — PageHeader 재사용 + StatusChips SSOT 신규

**source: `stage4-preflight/n24-page-h-status-chips.md`**:
> 결정 (Stage 3 Q5=A): OrgClient toolbar → page-h + wd-status-chips 4건 (root 법인 + 부서 카운트 + 내 팀 + 발효일)
> pre-flight: PageHeader SSOT 이미 존재 (재사용), wd-status-chips은 신규 SSOT 신설 필요

- `src/components/shared/PageHeader.tsx` 기존 (~28 LOC, 10+ surface 재사용) → 재사용만
- `src/components/shared/StatusChips.tsx` 신규 (~60-80 LOC) + OrgClient 통합 + i18n 5 locale (~20 entries)

#### N+33 — OnboardingTemplate default seed + proto data.js

**source: `batch-cards/07-onboarding-offboarding.md` §7 N+33 (L371-394)**:
> 트랙: DB seed + proto data.js
> 의존성: 0 (독립 진입 가능)
> Stage 4 입력: prisma/seed.ts 또는 prisma/seed-onboarding-default.ts 신규 + 6단계 (proto 정합) + 4 카테고리 enum + 12 법인 idempotent

- `prisma/seed.ts` 또는 신규 `prisma/seed-onboarding-default.ts` (~30 LOC, 12 법인 idempotent)
- `_design-reference/data.js` ONBOARD_STEPS SSOT 정합 (proto data 측)

#### N+43 — useArrowKeyNavigation hook

**source: `stage4-preflight/n43-arrow-key-hook.md`**:
> 결정 (Stage 3 Q1=C hybrid): Radix Tabs 부적합 2 surface (LeaveClient + Onboarding/Offboarding Filter) 공통 hook
> pre-flight: `src/hooks/` SSOT 디렉토리 12 hooks 정합. naming camelCase. WCAG roving tabindex 표준.

- `src/hooks/useArrowKeyNavigation.ts` 신규 (~80 LOC) + vitest test (~70 LOC)
- API: `useArrowKeyNavigation(itemCount, activeIndex, onIndexChange, options)` → `{ onKeyDown, itemProps }`

#### N+48 — WizardShell SSOT ⭐ critical 선행

**source: `stage4-preflight/n48-wizardshell-ssot-shared.md`**:
> 결정 (Stage 3 Q1=A): proto WizardShell prop 시그니처 채택, Radix Dialog 기반
> pre-flight: ✅ `src/components/shared/` SSOT 정합 (15+ shared SSOT 패턴)

- `src/components/shared/WizardShell.tsx` 신규 (~150 LOC) + vitest test (~60 LOC) + i18n 20 entries (선택)
- Radix Dialog 기반 + step indicator + footer override + banner slot (N+21 DemoLimitBanner cross-batch)

---

## §2. scope estimate (LOC + 파일 + test)

| RECORD | 신규 LOC | 정정 LOC | net | 파일 | test |
|---|---|---|---|---|---|
| **N+24** | ~+80 (StatusChips SSOT) + ~+20 (i18n 5 locale) + ~+10 (OrgClient 통합) | ~−10 (OrgClient toolbar 인라인 삭제) | **~+100 LOC** | 3 (`StatusChips.tsx` + `OrgClient.tsx` + `messages/*.json`) | vitest unit (StatusChips props) + e2e (OrgClient toolbar) |
| **N+33** | ~+30 (DB seed) + ~+5 (proto data.js) | 0 | **~+35 LOC** | 2 (`prisma/seed-onboarding-default.ts` + `data.js`) | unit (12 법인 idempotent) |
| **N+43** | ~+80 (hook) + ~+70 (test) | 0 | **~+150 LOC** | 2 (`useArrowKeyNavigation.ts` + `.test.ts`) | vitest 20+ case (5 키 × 2 orient × loop) |
| **N+48** | ~+150 (WizardShell) + ~+60 (test) + ~+20 (i18n 선택) | 0 | **~+210 LOC** | 2-3 (`WizardShell.tsx` + `.test.tsx` + `messages/*.json`) | vitest + axe-core (Dialog focus trap) |
| **합** | ~+555 | ~−10 | **~+495 LOC** (Phase B 전체) | ~10 files | 4 test suites |

**비교**: Phase A 8 RECORD 합 ~+224 LOC vs Phase B 4 RECORD 합 ~+495 LOC. Phase B = **LOC 2.2배** (codebase SSOT 신설 + test 인프라).

---

## §3. Phase A → Phase B 단방향 의존성 verify

### 3.1 Phase A (PR #64-#70) → Phase B 역의존 (verify 대상)

| Phase B RECORD | Phase A 역의존 (runtime) | Phase A 역의존 (design SSOT 청사진) |
|---|---|---|
| **N+24 StatusChips** | ❌ 없음 — `src/` 신규 codebase, proto 측 N+22 EmployeeStatusChip과 별 | ✅ N+22 `<EmployeeStatusChip>` (PR #68) STATUS_MAP 패턴이 N+24 design 청사진 (variant 정합) |
| **N+33 seed** | ❌ 없음 — `prisma/` 신규 codebase | ✅ N+19 (PR #66) `data.js` ONBOARD_STEPS 측 proto data SSOT 청사진 |
| **N+43 hook** | ❌ 없음 — `src/hooks/` 신규 codebase | ✅ N+23 (PR #69) `page-employee-detail.jsx` `handleTabKeyDown` proto 패턴이 hook 청사진 |
| **N+48 WizardShell** | ❌ 없음 — `src/components/shared/` 신규 codebase | ✅ N+21 (PR #64/#65) `DemoLimitBanner` banner slot prop 통합 (cross-batch slot pattern) + proto `WizardShell` (`wizards.jsx`) 청사진 |

→ **Phase A → Phase B runtime 역의존 = 0 확인** ✅ 단방향 verify 통과.

**design SSOT 청사진 측면**: Phase A proto SSOT (N+19/N+21/N+22/N+23)가 Phase B codebase SSOT의 design 참조. Phase A 머지 무관 Phase B 진입 가능 (runtime 격리). 다만 Phase A 머지 후 진입 시 design SSOT 일치 보장.

### 3.2 cross-batch consumer (Phase B → C/D/E 정방향)

| Phase B SSOT | Phase C/D/E consumer |
|---|---|
| **N+24** (StatusChips) | **Phase C N+31** (codebase 8 surface 적용, batch 07 dashboard) + Phase D N+50 cross-ref |
| **N+33** (seed) | batch 06 Phase E (employee career data) + batch 07 OnboardingTemplate consumer |
| **N+43** (hook) | **Phase D N+44** (MyTasks + Leave migration) + **Phase D N+45** (Onboarding/Offboarding Filter, batch 07 N+34 합본) |
| **N+48** (WizardShell) | **Phase D N+49** (HireWorker migration) + **Phase D N+50** (OrgRestructure migration) + **Phase D N+53** (BulkUpload migration) |

→ Phase B = **upstream SSOT layer** (Phase C/D/E consumer 진입의 전제). Phase B 4 RECORD 머지가 Phase D 위저드 migration 4건 + a11y 합본 2건 진입 트리거.

### 3.3 단방향 그래프 (audit §3.3 정합 + Phase B 갱신)

```
Phase A (proto SSOT layer, PR #64-#70 머지 후)
   ├─ N+21 (DemoLimitBanner) ──→ N+48 banner slot 통합 (cross-batch)
   ├─ N+22 (EmployeeStatusChip) ──→ N+24 STATUS_MAP 청사진
   ├─ N+19/N+20 (data.js SSOT) ──→ N+33 proto data ONBOARD_STEPS 측 + N+30 매핑 layer
   └─ N+23 (proto tablist) ──→ N+43 hook 청사진
   ↓
Phase B (codebase SSOT 신설, 의존성 0)
   ├─ N+24 (StatusChips + PageHeader 재사용) ──→ N+31 cross-batch + N+50 design
   ├─ N+33 (OnboardingTemplate seed) ──→ batch 06/07 consumer
   ├─ N+43 (useArrowKeyNavigation) ──→ N+44 / N+45 / N+47 consumer
   └─ N+48 (WizardShell) ──→ N+49 / N+50 / N+53 consumer
   ↓
Phase C (codebase 적용)
Phase D (codebase 대 블라스트 + a11y 합본 PR)
Phase E (격상 batch 풀스택, DB schema)
```

**단방향성 단언**: Phase A → B → C → D → E. 역방향 의존 0 (audit §3.2 정합).

---

## §4. SSOT 신설 위치 정합 (codebase 패턴 cross-ref)

각 RECORD WRITE path = 기존 codebase SSOT 패턴 정합 확인:

| RECORD | WRITE path | 정합 근거 |
|---|---|---|
| **N+24** | `src/components/shared/StatusChips.tsx` (신규) | `src/components/shared/` 20+ SSOT 컴포넌트 존재 (PageHeader/EmptyState/DetailPanel/DataTable 등). naming PascalCase. **PageHeader.tsx 단순 props 패턴 정합** (~28 LOC SSOT). 신규 StatusChips는 PageHeader 측근에 위치 |
| **N+33** | `prisma/seed-onboarding-default.ts` (신규) 또는 `prisma/seed.ts` 확장 | `prisma/seed.ts` + `prisma/seed-dev.ts` 기존 패턴 정합. **신규 seed 분리 또는 기존 확장 결정 게이트** (사양 본문 "또는" 명시, 가디언 default = 분리 — modular) |
| **N+43** | `src/hooks/useArrowKeyNavigation.ts` (신규) | `src/hooks/` 12 hooks 존재 (camelCase = `useAutoSave.ts` 패턴). 신규 hook naming `useArrowKeyNavigation` 정합 |
| **N+48** | `src/components/shared/WizardShell.tsx` (신규) | `src/components/shared/` SSOT 위치 정합 (PageHeader 패턴). Radix Dialog 기반 (`src/components/ui/dialog.tsx` 직접 사용) |

**SSOT 위치 결정 게이트** (가디언 default):
- N+24 StatusChips: `src/components/shared/` ✅ (사양 명시)
- N+33 seed: **신규 파일 분리** (`prisma/seed-onboarding-default.ts`) — modular, 기존 seed.ts 회귀 격리
- N+43 hook: `src/hooks/` ✅ (사양 명시 + camelCase naming)
- N+48 WizardShell: `src/components/shared/` ✅ (사양 명시 + Radix Dialog 직접 사용)

---

## §5. 위험도 평가 + 회귀 risk profile

| RECORD | 우선순위 | 위험도 | 회귀 risk | 비고 |
|---|---|---|---|---|
| **N+24** | HIGH | LOW~MED | StatusChips SSOT 신설 + OrgClient 통합 시 toolbar layout 회귀 가능. 모바일 reflow 검증 필수 | cross-batch 4 consumer (Phase C N+31 design SSOT 참조) |
| **N+33** | MEDIUM | MED | DB seed 12 법인 idempotent — 기존 OnboardingTemplate 회귀 위험 (overwrite 금지) | seed re-run safety + dev/prod 분리 |
| **N+43** | HIGH | LOW | hook 단독, UI 영향 0. vitest 단위만 | consumer N+44/N+45 합본 시 회귀 위험 |
| **N+48** | HIGH ⭐ | MEDIUM | Radix Dialog 신규 wrap + step indicator + footer override. 4 wizard consumer (Phase D) 모두 영향 | sizable SSOT, axe-core focus trap verify 필수 |

**전체 Phase B risk profile**: ⭐ **LOW~MED** — Phase A (LOW 모두)보다 약간 상승. SSOT 신설 + codebase mutation 본격 진입.

회귀 위험 가드:
1. **N+24**: 모바일 reflow + 10+ PageHeader surface 회귀 0 verify
2. **N+33**: idempotent seed 검증 (re-run 시 변동 0) + dev/prod 분리 + 기존 OnboardingTemplate overwrite 금지
3. **N+43**: vitest 20+ case + 단독 PR (consumer 없는 dead code 회피 위해 N+44/N+45 합본 또는 후속 PR 명확화)
4. **N+48**: axe-core focus trap + props spec finalize (4 consumer 회귀 위험 격리)

---

## §6. 권고 진입 순서 + 첫 PR 카나리 후보 ⭐

### 6.1 권고 진입 순서 (Phase B 4 RECORD)

```
1. N+43 (useArrowKeyNavigation hook, ~+150 LOC)  ⭐ 카나리 첫 PR
2. N+24 (StatusChips + PageHeader 재사용, ~+100 LOC)
3. N+33 (OnboardingTemplate seed + proto data, ~+35 LOC)
4. N+48 (WizardShell SSOT, ~+210 LOC)
```

권고 근거:
- **N+43 첫 카나리**: UI 영향 0 (hook only), vitest 20+ case, codebase mutation 최소 → Phase B SSOT 패턴 + test 인프라 검증 적격. consumer 부재 시 dead code 위험 가드 = N+44 합본 또는 후속 PR (Phase D N+44 LeaveClient migration) 명확화.
- **N+24 둘째**: cross-batch 4 consumer (batch 03/04/05/07) — 빠른 진입으로 Phase C N+31 (8 surface 적용) upstream 가속화. PageHeader 기존 재사용으로 LOC 효율.
- **N+33 셋째**: DB seed + proto data 양면. 12 법인 idempotent 검증 작업이 별도 — small LOC지만 운영 위험 (overwrite 회피).
- **N+48 마지막**: sizable (~+210 LOC) + Phase D 위저드 migration 4건 의존성 큼. 안정화 후 consumer 진입.

### 6.2 첫 PR 카나리 후보 ⭐ — N+43 단독 PR

#### N+43 — `useArrowKeyNavigation` hook 카나리 (Phase B 카나리)

- **PR 제목**: `feat(hooks): useArrowKeyNavigation SSOT — WAI-ARIA roving tabindex hook`
- **branch**: `feat/use-arrow-key-navigation`
- **scope**: `src/hooks/useArrowKeyNavigation.ts` (~80 LOC) + `src/hooks/useArrowKeyNavigation.test.ts` (~70 LOC)
- **acceptance**:
  - tsc 0 error (strict generic 정합)
  - vitest 20+ case PASS (5 키 × 2 orientation × loop on/off)
  - lint clean
  - 회귀 0 (다른 hook 시그니처 변동 0)
- **선택 근거**:
  1. Phase B 4 RECORD 중 **유일하게 UI 영향 0** (hook only) → 시각 회귀 가드 불요
  2. **vitest test 인프라 검증** = Phase B 후속 RECORD (N+24/N+48) test 인프라 패턴 참조
  3. **codebase mutation 최소** (~+150 LOC = src/hooks/ 추가만)
  4. consumer 부재 시 dead code 위험 = N+44 합본 또는 후속 PR 명확화 (Phase D 진입 시 consumer)

⚠️ **consumer dead code 위험 결정 게이트**:
- (A) **hook 단독 PR** (consumer 부재) — N+44/N+45 머지 후 자연 consumer (선호)
- (B) **hook + N+44 LeaveClient consumer 합본 PR** — runtime 검증 동시 진입 (안전, LOC 커짐)

→ **(A) 권고**: Phase B 카나리 = SSOT 신설 격리. consumer는 Phase D 진입 시.

### 6.3 진입 순서 거버넌스

- **카나리 진입 = N+43 단독 PR**. Codex Gate 1+2 + vitest PASS → N+24 진입
- **N+24 PageHeader 재사용 + StatusChips 신규**: N+43 후, 10+ PageHeader surface 회귀 0 verify
- **N+33 DB seed**: N+24 후, 12 법인 idempotent + dev/prod 분리
- **N+48 WizardShell**: 모든 Phase B 3 RECORD 머지 후 진입 — sizable + Phase D consumer 4건 의존성

---

## §7. cross-batch consumer 영향 (Phase C/D/E)

Phase B 각 SSOT가 후속 Phase 어디서 사용되는지 단언:

### 7.1 N+24 StatusChips → Phase C/D consumer

| Phase | RECORD | consumer 측면 |
|---|---|---|
| Phase C | **N+31** (batch 07 codebase 8 surface) | StatusChips SSOT 직접 reuse + chip data API 확장 |
| Phase D | N+50 (cross-ref) | OrgRestructure design 참조 |
| (proto) | N+22 (PR #68) | design 청사진 정방향 (역의존 0) |

### 7.2 N+33 seed → batch 06/07 consumer

| Phase | RECORD | consumer 측면 |
|---|---|---|
| Phase E | batch 06 (N+37~N+42, 직원 경력 데이터) | OnboardingTemplate seed default 참조 |
| Phase C/D | batch 07 (N+32 Hire Card + journey view) | 6단계 ONBOARD_STEPS 정합 |

### 7.3 N+43 hook → Phase D 합본 PR 4 consumer

| Phase | RECORD | consumer 측면 |
|---|---|---|
| Phase D | **N+44** (MyTasks + Leave migration) | LeaveClient.tsx:579 Status filter radiogroup |
| Phase D | **N+45** (Onboarding/Offboarding Filter, batch 07 N+34 합본 PR) | 2 dashboard radiogroup |
| Phase D | (N+46 OrgViewModeToggle — Radix Tabs 사용, hook 비대상) | — |
| Phase D | N+47 (a11y SSOT 확장 + axe-core baseline) | 본 hook 사용 surface axe-core 검증 |

### 7.4 N+48 WizardShell → Phase D 4 consumer

| Phase | RECORD | consumer 측면 |
|---|---|---|
| Phase D | **N+49** (HireWorker migration) | inline wizard → WizardShell SSOT migration (~−75 LOC) |
| Phase D | **N+50** (OrgRestructure migration) | drawer → full-screen WizardShell (~−70 LOC) |
| Phase D | **N+53** (BulkUpload migration) | inline → WizardShell (~−30 LOC) |
| (proto) | N+21 DemoLimitBanner (PR #64) | WizardShell `banner` slot prop 통합 (cross-batch slot pattern) |

**Phase B 머지 후 Phase D 진입 트리거**: WizardShell SSOT 머지 (N+48) → 4 위저드 migration 동시 진입 가능. a11y migration 4 surface (N+44/N+45/N+47) → N+43 머지 후 진입 가능.

---

## §8. N+47 axe-core baseline 사전 inventory (사양서 §6 의제)

audit `8e09a3f1` §2 = N+47 Phase D 결정 (batch 08 a11y 수렴 RECORD, 별 PR). Phase B 진입 시 axe-core CI 인프라 사전 inventory:

### 8.1 axe-core 현황 verify (Phase B 진입 시 결정 게이트)

**source: `stage4-preflight/n47-a11y-ssot-axe-baseline.md` §1**:
> axe-core 도입 여부 Stage 4 implementation 시 정확 확인 후 분기:
> - (A) 이미 도입 → baseline 캡처만
> - (B) 미도입 → @axe-core/playwright 신규 설치 + config 통합

**Phase B 사전 inventory**:
- `package.json` `@axe-core/playwright` dependency verify 필요 (본 audit readonly 가드로 미실행, **Phase B implementation 진입 시 first action**)
- `playwright.config.ts` axe-core fixture verify 필요
- `vitest.config.ts` a11y unit test 필요

### 8.2 Phase B 4 RECORD 와 axe-core 관계

| RECORD | axe-core 필요성 |
|---|---|
| N+24 (StatusChips) | OrgClient toolbar a11y 검사 (axe-core 도입 시 baseline 1 surface 추가) |
| N+33 (seed) | 무관 (DB seed) |
| N+43 (hook) | hook 자체는 무관, consumer (N+44/N+45) 진입 시 axe-core baseline |
| **N+48 (WizardShell)** | **Dialog focus trap a11y 검증 필수** (axe-core 또는 수동 + Radix 자체 정합) — 사양 본문 가드 명시 |

### 8.3 N+47 axe-core baseline Phase D 진입 시 사전 합의 의제

본 audit이 Phase B 진입 시 axe-core CI 인프라 inventory만 (사전 확인). Phase D N+47 implementation 시 **batch 08 a11y 트랙 수렴 baseline 캡처** (5 surface = N+43 consumer 4 + N+24 OrgClient 1):
- 분기 (A) axe-core 이미 도입 → baseline 캡처 (Phase B 진입 시 first action에서 결정)
- 분기 (B) 미도입 → `@axe-core/playwright` 설치 + CI gate 추가

→ **본 Phase B audit 진입 시 first action = axe-core dependency verify** (Phase B 첫 PR commit 전 별도 turn 또는 commit 1).

---

## §9. 가드 (본 audit 준수)

- ❌ src/ + prisma/ + messages/ 변경 0 (readonly audit)
- ❌ 기존 audit (`phase-a-entry-audit.md` 5e063d37 / `n34-n47-phase-assignment.md` 8e09a3f1) 본문 미터치
- ❌ 기존 batch 카드 / 23 pre-flight / 2 README 미터치
- ❌ 새 RECORD 번호 reserve 0
- ❌ Phase C/D/E entry audit 0 (Phase B 한정)
- ❌ Phase A 정정 / HANDOVER 정정 0 (별도 turn)
- ❌ N+47 axe-core baseline 실 작업 0 (사전 inventory만, §8)
- ❌ main / PR #64-#70 / admin-override 무관
- ✅ Phase A entry audit `180aceb1` `80a87ba2` `5e063d37` 패턴 정합
- ✅ phase3a-audit 워크트리 single commit + origin push
- ✅ PR #64-#70 와 충돌 0 (doc 영역)

---

## §10. Out of scope (별도 turn)

- **Phase C/D/E entry audit** (각 phase 별 entry audit 추가 문서)
- **실 implementation** (Phase B 첫 PR N+43 → 각 RECORD 사전 inquiry → implementation 인계 sequential)
- **audit count 정정** + N+23 spec 정정 (별도 turn 합본 의제)
- **HANDOVER §3 Phase B/C/D/E 단방향 그래프 본 audit 결과 반영** (가디언 own turn)
- **N+47 axe-core baseline 실 CI integration** (Phase D 진입 시)
- **PR #64-#70 머지** (정상 review, 사용자 결재 트랙)

---

**상태**: ACTIVE (Phase B 진입 input SSOT)
**다음 갱신**: Phase B 첫 PR (N+43) 진입 후 추후 RECORD 진입 시점에 cross-ref 갱신
**책임 단언**: 본 audit이 Phase B 카운트 / scope / 권고 순서 + SSOT 신설 위치 + 단방향 의존성 verify의 **단일 진실**. Phase A entry audit + n34-n47-phase-assignment.md cross-link.
