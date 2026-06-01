# Phase 3a · Batch 09 — WizardShell SSOT (격상 트랙)

> **범위**: 5 wizard SSOT 신설 + 점진 마이그레이션
> **격상 일자**: 2026-05-21 (Session 228)
> **Stage 1 audit**: `9289a792` (`09-wizardshell-ssot-stage1.md`)
> **base proto SHA**: `HR Hub.html` 동결본
> **base codebase SHA**: `1260a95f` (main 동결)
> **batch ID 컨벤션**: `WS-001` ~ `WS-014` (Stage 1 inventory 재사용)

---

## §0. 1분 요약

- **5 wizard surface** (proto 4 + codebase only 1 — BulkUploadWizard 포함)
- **14 findings** (HIGH 4 / MED 7 / LOW 3) — Stage 1 cross-ref
- **Paradigm**: SSOT 신설 트랙 (batch 08 a11y SSOT 패턴 정합)
- **Q1-Q6 결정**: SSOT proto 시그니처 채택 + 점진 마이그레이션 + N+27 분리 + BulkUpload 포함
- **RECORD N+48~N+53** 사양화 (N+51/N+52 옵션 B = DEFERRED, actual **4 RECORD**)
- **Cross-batch 의존성**: N+49 ← batch 04 N+21 (DemoLimitBanner). N+50 = Q5=B 분리 PR (⚠️ S235 정정: N+27 머지 의존 무효 — 코드가 이미 wizard라 독립 진입)

---

> **⚠️ 정정 (Session 235, 2026-05-29 — 6-agent workflow 코드 검증 + Codex Gate 1 HIGH 반영)**
> 본 문서의 N+27/N+50 전제가 실제 코드와 불일치하여 정정합니다 (기존 결정 배경은 아래 본문에 보존):
> - **`src/components/org/RestructureModal.tsx` 는 drawer가 아니라 이미 centered-overlay 3-step wizard** (Step 타입 `'edit'|'diff'|'confirm'`, custom StepIndicator, inline footer, `MODAL_STYLES.container`). "drawer → full-screen wizard 재작업" 전제는 코드상 무의미.
> - **WizardShell SSOT는 N+48이 `src/components/shared/WizardShell.tsx` 에 신설·머지(#83 `90c88ac1`)** — N+27이 `src/components/wizards/` 에 자체 신설한다는 계획은 superseded.
> - **N+27 charter = A (순수 형태 정합, 거의 no-op → N+50 WizardShell wrap에 흡수)**. 기능 항목(`split` changeType / `CHANGE_TYPE_LABELS` i18n 추출 / N+30 mapping layer)은 폐기가 아니라 **별도 feature 트랙으로 재분류**.
> - 따라서 **N+50은 N+27 머지 의존 없이 순수 WizardShell wrap으로 진입 가능** (N+49 #85 모델). 실제 작업 = string-union step → numeric currentStep 매핑 + dual-action(저장 초안/즉시 적용) custom footer.
> 근거: workflow 판정 insufficient-evidence → 코드 검증 (RestructureModal.tsx:365/367/631-672, modal.ts:3), Codex Gate 1 HIGH(수정 범위) 반영. 정정 트랙 = `docs/n27-n50-drift-fix`.

## §1. Surface 인벤토리

Stage 1 §1 cross-ref (`09-wizardshell-ssot-stage1.md`). 압축 표:

| # | Wizard | 위치 | inline 패턴 | 마이그레이션 RECORD |
|---|---|---|---|---|
| 1 | HireWorkerWizard | `src/app/(dashboard)/employees/new/EmployeeNewClient.tsx` (701 lines) | 4-step inline (step state/validation/indicator L608/content L655) | N+49 |
| 2 | JobPostingWizard | `src/app/(dashboard)/recruitment/new/PostingFormClient.tsx` | (Stage 4 정확 검증) | N+51 |
| 3 | PerfCycleWizard | `src/app/(dashboard)/performance/PerformanceClient.tsx` (593) 또는 sub-page | (Stage 4 정확 검증) | N+52 |
| 4 | OrgRestructureWizard → RestructureModal | `src/components/org/RestructureModal.tsx` (676 lines, 이미 centered-overlay 3-step wizard) | inline 3-step wizard (Step `'edit'|'diff'|'confirm'`, custom StepIndicator, inline footer) — drawer 회귀 불가 | N+50 (순수 WizardShell wrap, N+27 의존 없음) |
| 5 | BulkUploadWizard (codebase only) | `src/components/employees/BulkUploadWizard.tsx` | Dialog + 4-step type union | N+53 |

### Proto WizardShell SSOT (참조)

`_design-reference/wizards.jsx` WizardShell (~50 lines):
```jsx
<WizardShell title sub steps currentStep onCancel footer>{children}</WizardShell>
```
- 4 proto wizard 모두 동일 호출 패턴
- step indicator 자동 (steps array + currentStep highlight)
- progress text 자동 (`{currentStep+1} / {steps.length} 단계`)

---

## §2. Findings (Stage 1 inventory 재사용)

Stage 1 §2 cross-ref. 핵심 HIGH 4건 발췌:

| ID | Surface | 우선 | 핵심 |
|---|---|---|---|
| **WS-001** | cross-cutting | HIGH | WizardShell codebase 0건 확정 — SSOT 신규 신설 필요 |
| **WS-002** | HireWorkerWizard | HIGH | inline 4-step (EmployeeNewClient L181~L660), proto WizardShell prop 결렬 |
| **WS-003** | OrgRestructureWizard | HIGH | 이미 centered-overlay 3-step wizard (`'edit'|'diff'|'confirm'`) — N+50 순수 WizardShell wrap (N+27 구조작업 불필요) |
| **WS-004** | BulkUploadWizard | HIGH | codebase only, SSOT 미적용 (Dialog + inline 4-step) |

MED 7건 (WS-005~WS-011) + LOW 3건 (WS-012~WS-014) = Stage 1 audit 그대로 적용.

---

## §3. Cross-surface SSOT 결함

| ID | 항목 | 권고 |
|---|---|---|
| X1 | WizardShell codebase 0건 (Stage 1 재검증 통과) | N+48 신규 SSOT 신설 |
| X2 | 5 위저드 inline 패턴 차이 (컨테이너/step/indicator/footer/progress/cancel) | N+48 SSOT API spec 정합 |
| X3 | 4 위저드 proto SSOT, BulkUploadWizard 는 codebase only | Q6=A 결정 → 5 wizard 통합 SSOT |
| X4 | batch 04 N+21 DemoLimitBanner cross-batch | N+48 footer 통합 (N+49 진입 시 정합) |
| X5 | 컨테이너 패턴 (page / centered-overlay `MODAL_STYLES.container` / Dialog) | N+48 SSOT = Radix Dialog 기반 (HireWorker page 패턴은 별도 검토). ⚠️ S235 정정: RestructureModal = drawer 아님, centered-overlay wizard |

---

## §4. Proto vs Codebase Gap

| 항목 | proto | codebase | 결렬 |
|---|---|---|---|
| WizardShell SSOT | ✅ wizards.jsx (~50 lines) | ❌ 0건 | 신설 필요 |
| 4 proto wizard caller | 동일 호출 패턴 | 4 inline 다양화 | 통합 마이그레이션 |
| BulkUploadWizard | ❌ | ✅ B2 era | proto 부재 = visual SSOT 0 → proto pattern 적용 |
| 데모 한계 배너 (DemoLimitBanner) | proto에 명시 (batch 04 N+21) | ❌ | N+48 footer 통합 |
| step indicator 시각 | 점/숫자/체크 mix | 각자 다름 | proto pattern 채택 |

---

## §5. i18n / a11y / 다크 cross-cutting

### i18n
- wizard 라벨 5 locale 정합 필요 (proto SSOT 패턴 적용 시 caller 측 i18n 자동 propagate)
- N+48 SSOT 자체는 i18n 무관 (caller props로 받음)

### a11y
- **batch 08 hook 무관** (wizard 는 form, tablist 아님)
- Radix Dialog 기반 SSOT = focus trap + ESC + role="dialog" 자동
- step indicator a11y = `aria-current="step"` + `aria-label="단계 N/M"` 패턴

### 다크
- 색상 토큰화 별도 (Phase 4 다크 트랙 비대상)
- WizardShell 자체는 wt 토큰 사용 (인라인 hex 0)

---

## §6. Stage 3 게이트 통과 박스 + Q1-Q6 결정 매트릭스

> **Stage 3 게이트 통과 (2026-05-21 KST, 가디언 default 결정)**
> Q1-Q6 **전체 채택** (Q6 = A 포함). 사용자 결재 round skip — 6건 전부 **data-decidable** + Stage 1 audit 패턴 정합 분석 통과.
> Q6 ⭐ BulkUploadWizard 포함 결정 = batch 05 Q6 패턴 정합 (codebase only 기능 전수 유지 + SSOT 적용).
> 가디언 메타룰 "정합성 데이터로 결정 가능한 의제 = default 채택" 적용.
> 사용자 batch 04/05/07/08 round "전체 채택" 일관성 정합.

| Q | 결정 | Stage 4 입력 |
|---|---|---|
| Q1 SSOT API | **A** | proto WizardShell prop 시그니처 채택 (`title/sub/steps/currentStep/onCancel/footer/children`) |
| Q2 step indicator | **A** | proto pattern 정합 (done/current/upcoming dot + 체크 아이콘) |
| Q3 footer 정책 | **A** | proto pattern unify (이전/다음/취소/임시저장/완료, progress text "N/N 단계") |
| Q4 마이그레이션 | **C** | 점진 (Hire → OrgRestructure → JobPosting → PerfCycle → BulkUpload 순) |
| Q5 N+27 합본 | **B** | 분리 (N+50 = OrgRestructure 마이그레이션 단독 PR). ⚠️ 정정(S235): N+27 머지 선행 의존 무효 — 코드가 이미 wizard라 N+50 독립 진입 가능 |
| Q6 BulkUpload | **A** ⭐ | 포함 (5번째 wizard SSOT 적용, batch 05 Q6 패턴 정합) |

---

## §7. RECORD N+48~N+53 plan body 사양화

**Stage 3 게이트 통과 후 promote 완료 (2026-05-21).**

> **사전 가정 정정 (2026-05-21 KST, 가디언 default, `51b1b712` pre-flight 결과)**
> N+51 (PostingFormClient = 단일 form) + N+52 (CreateCycleModal = 단일 modal) → wizard 패턴 부재 catch.
> WizardShell SSOT 적용 부적합 — **옵션 B (현행 유지)** 채택.
> batch 09 actual scope: 6 → **4 RECORD** (N+48 + N+49 + N+50 + N+53).
> batch 05 Q6 "codebase only 기능 전수 유지" 패턴 정합.

| RECORD | 묶음 finding | 우선 | 트랙 | 의존성 |
|---|---|---|---|---|
| **N+48** | WS-001 + X1 + X2 + X5 (WizardShell SSOT 신설) + Q1/Q2/Q3 | HIGH | codebase (선행) | 0 |
| **N+49** | WS-002 (HireWorkerWizard 마이그레이션) + X4 (DemoLimitBanner 정합) | HIGH | codebase | N+48 + batch 04 N+21 |
| **N+50** | WS-003 + Q5 (OrgRestructure 마이그레이션, 순수 WizardShell wrap) | HIGH | codebase | N+48 (N+27 의존 없음 — S235 정정) |
| **N+51** | JobPostingWizard — ⚠️ wizard 패턴 부재 (옵션 B) | **DEFERRED** | **N/A** | **N/A** |
| **N+52** | PerfCycleWizard — ⚠️ wizard 패턴 부재 (옵션 B) | **DEFERRED** | **N/A** | **N/A** |
| **N+53** | WS-004 + Q6 (BulkUploadWizard 마이그레이션) | LOW | codebase | N+48 |
| **N+55** | codebase `<DemoLimitBanner />` SSOT 신설 + N+49 consumer wire (옵션 β 별 PR, 2026-05-26 Session 233 결재) | LOW | codebase | N+49 머지 후 |
| **N+56** | WizardShell SSOT default footer mobile sticky-bottom variant — N+49 PR #85 D1 결재 follow-up (Session 234) | LOW | shared | N+49 머지 후 (Phase 4 mobile polish 또는 mobile complaint 발생 시) |

---

### N+48 — WizardShell SSOT 컴포넌트 신설 (Q1 결정 게이트) [HIGH, 선행]

- **트랙**: codebase 선행 SSOT
- **우선**: HIGH
- **의존성**: 0 (선행, N+49~N+53 consumer 의존)
- **Stage 4 입력**:
  - **신규 파일**: `src/components/shared/WizardShell.tsx` (~150 lines)
  - **spec** (proto 정합):
    ```tsx
    interface Step { key: string; label: string }
    interface WizardShellProps {
      title: string
      sub?: string
      steps: Step[]
      currentStep: number              // 0-indexed
      onCancel: () => void
      footer?: ReactNode               // 커스텀 footer override (default = 이전/다음/제출)
      children: ReactNode              // 현재 step content
      className?: string
    }
    ```
  - **base**: Radix Dialog (focus trap + ESC + role="dialog" 자동)
  - **step indicator** (proto pattern):
    - done = 체크 아이콘 (success token)
    - current = 채워진 dot (primary token)
    - upcoming = 빈 dot (border token)
    - `aria-current="step"` + `aria-label`
  - **progress text**: `{currentStep+1} / {steps.length} 단계`
  - **default footer**: 이전 / 다음 / 취소 (마지막 step = 제출)
  - **footer slot**: caller 정의 시 default override
  - **DemoLimitBanner consumer-driven** (N+48 inquiry 1 옵션 c 결재, 2026-05-26 Session 233): banner prop 채택 안 함 — consumer 측 children 안 inline render (N+55 별 PR 머지 후 wire). actual main `90c88ac1` WizardShell.tsx grep `banner` = 0건
- **Stage 4 검증**:
  - vitest 단위 (props + step state + footer override)
  - Storybook entry (있으면) 또는 dev test page
  - axe-core 0 violation (Dialog focus trap + ARIA)
- **블로커**: PR-5A 머지 후 진입

---

### N+49 — HireWorkerWizard 마이그레이션 (Q4 점진 1) [HIGH]

- **트랙**: codebase
- **우선**: HIGH
- **의존성**: **N+48 선행 필수** (✅ main `90c88ac1` 도착) — banner 처리는 N+55 별 PR (옵션 β, Session 233 결재). 본 N+49 PR scope = HireWorker migration only
- **Stage 4 입력**:
  - `src/app/(dashboard)/employees/new/EmployeeNewClient.tsx` (701 lines) 마이그레이션:
    - L181 `useState(0)` + L215 `validateStep` 유지 (caller 측 state)
    - L608 inline step indicator → `<WizardShell steps={...} currentStep={step}>` 제거
    - L655 inline step content → `<WizardShell>` children 안
    - footer (이전/다음/제출) → `<WizardShell footer={...}>` 또는 default 사용
  - **DemoLimitBanner 처리 X** (Session 233 결재): N+55 (codebase SSOT) 별 PR 머지 후 consumer 측 children 안 inline wire — 본 N+49 PR scope 외
  - i18n: caller 측 t() 기존 키 재사용
- **Stage 4 검증**:
  - 기존 HireWorker 회귀 0 (validation + toast + redirect 패턴 정합)
  - DemoLimitBanner 검증 X (N+49 scope 외, N+55 머지 후 별 turn verify)
  - 시각 회귀 (gstack 라이트)
  - e2e: 4-step 통과 시나리오

---

### N+50 — OrgRestructureWizard 마이그레이션 (Q4 점진 2, Q5 분리) [HIGH]

- **트랙**: codebase (순수 WizardShell wrap)
- **우선**: HIGH
- **의존성**: **N+48 선행만** (✅ main `90c88ac1` 도착). ⚠️ 정정(S235): N+27 머지 선행 의존 무효 — `RestructureModal.tsx` 가 이미 centered-overlay 3-step wizard라 drawer 회귀 불가, N+27 구조작업 불필요. N+49 #85 모델로 독립 진입 가능
- **Stage 4 입력**:
  - `src/components/org/RestructureModal.tsx` (676 lines) = 이미 centered-overlay 3-step wizard (Step 타입 `'edit'|'diff'|'confirm'` L365, custom StepIndicator L367, inline footer 이전/다음/취소/즉시적용 L631-672, root = `MODAL_STYLES.container` = `fixed inset-0 flex items-center justify-center` `src/lib/styles/modal.ts:3`)
  - 실제 작업 = 기존 wizard 골격을 WizardShell SSOT consumer 로 wrap:
    - string-union step (`'edit'|'diff'|'confirm'`) → numeric `currentStep` 매핑
    - dual-action custom footer (`handleSaveDraft` 저장 초안 / `handleApplyNow` 즉시 적용) → `<WizardShell footer={...}>` slot
    - custom StepIndicator → WizardShell 내장 step indicator
  - N+27 기능 항목(`split` changeType / 하드코딩 `CHANGE_TYPE_LABELS` i18n 추출 / N+30 mapping layer)은 **별도 feature 트랙**으로 재분류 — N+50 wrap scope 외
- **Stage 4 검증**:
  - WizardShell SSOT props 정합 (3 step + dual-action footer)
  - 기존 RestructureModal 회귀 0 (edit/diff/confirm 단계 + 저장 초안/즉시 적용 동작 정합)
  - e2e: 3-step 통과 시나리오

---

### N+51 — JobPostingWizard ⚠️ 옵션 B (현행 유지) [DEFERRED]

- **트랙**: **N/A (옵션 B 채택)**
- **우선**: **DEFERRED**
- **의존성**: N/A
- **Stage 4 입력**:
  - **사전 가정 정정 (pre-flight `51b1b712`)**: PostingFormClient = 단일 form (`useForm + zodResolver`, multi-step wizard 패턴 부재). grep `step|wizard` = 0건 확인.
  - **WizardShell SSOT 적용 부적합** — 단일 form → wizard 강제 변환 시 UX 회귀 위험 (HR 채용 운영팀 작업 흐름 큰 변경).
  - **옵션 B 채택**: 현행 단일 form 유지, codebase paradigm leader (batch 05 Q6 패턴 정합).
  - proto SSOT 결렬 인정 (visual reference 외 UX paradigm 강제 X).
- **Stage 4 검증**: **회귀 0** (변경 0)
- **별도 트랙 후보**: batch 10+ "Recruitment JobPosting wizard UX 도입" (사용자 합의 필수)

---

### N+52 — PerfCycleWizard ⚠️ 옵션 B (현행 유지) [DEFERRED]

- **트랙**: **N/A (옵션 B 채택)**
- **우선**: **DEFERRED**
- **의존성**: N/A
- **Stage 4 입력**:
  - **사전 가정 정정 (pre-flight `51b1b712`)**: PerfCycleWizard 파일 codebase 0건. 대신 `CyclesClient.tsx:152` `CreateCycleModal` 단일 modal form 확인 (multi-step wizard 패턴 부재).
  - **WizardShell SSOT 적용 부적합** — 사이클 생성 단순 작업 (이름/기간/weights) → wizard 분할 시 과설계.
  - **옵션 B 채택**: 현행 단일 modal 유지, codebase paradigm leader.
  - proto SSOT 결렬 인정.
- **Stage 4 검증**: **회귀 0** (변경 0)
- **별도 트랙 후보**: batch 10+ "Performance cycle wizard UX 도입" (사이클 생성 복잡도 증가 시)

---

### N+53 — BulkUploadWizard 마이그레이션 (Q6 결정 — 포함) [LOW]

- **트랙**: codebase
- **우선**: LOW
- **의존성**: N+48 선행
- **Stage 4 입력**:
  - `src/components/employees/BulkUploadWizard.tsx` 마이그레이션
  - Dialog wrapper → WizardShell SSOT (Radix Dialog 기반 동일)
  - `type Step = 1|2|3|4` → `steps` array (4 step) + currentStep state
  - codebase-only wizard = visual SSOT 0 → proto WizardShell pattern 적용 (시각 통합)
- **Stage 4 검증**:
  - 기존 BulkUpload Excel 업로드 회귀 0
  - 4-step 통과 (template 다운로드 → 파일 업로드 → preview → 확정)
  - Dialog → WizardShell 컨테이너 전환 시각 회귀 검증

---

### N+55 — codebase `<DemoLimitBanner />` SSOT 신설 + N+49 consumer wire (옵션 β 별 PR) [LOW]

- **트랙**: codebase
- **우선**: LOW
- **의존성**: N+49 머지
- **Stage 4 입력 (예약, 본문 작성 X)**: codebase 측 `<DemoLimitBanner />` 실 컴포넌트 신설 + N+49 EmployeeNewClient consumer wire (마지막 step children 안 inline). proto SSOT 컨벤션 (batch 04 N+21, `_design-reference/ui.jsx:361`) 정합.
- **Stage 4 검증 (예약)**: N+48 inquiry 1 옵션 c 결재 결과 (consumer-driven, banner prop 부재) 정합 + visual 회귀 0
- **블로커**: N+49 머지 후

---

### N+56 — WizardShell SSOT default footer mobile sticky-bottom variant (N+49 D1 결재 follow-up) [LOW]

- **트랙**: shared (codebase WizardShell SSOT evolve)
- **우선**: LOW
- **의존성**: N+49 머지 (회귀 발효 시점)
- **Stage 4 입력 (예약, 본문 작성 X)**: WizardShell SSOT default footer 에 mobile sticky-bottom variant prop 추가 (e.g. `footerVariant?: 'default' | 'sticky-mobile'`). 회귀 source: N+49 PR #85 D1 결재 (default footer 채택 → StickyActionBar 제거). Phase 4 mobile polish 트랙 또는 mobile UX complaint 발생 시 진입.
- **Stage 4 검증 (예약)**: mobile sticky-bottom UX 회귀 0 + WizardShell SSOT props 정합 (13→14 prop 추가 시 후속 consumer N+50/N+53 회귀 0)
- **블로커**: Phase 4 mobile polish 트랙 진입 또는 mobile complaint
- **회귀 surface**: HireWorker (PR #85 머지 후 발효), 후속 N+50/N+53 머지 시 추가

---

### Phase 4 다크 트랙 합본 (배제)

본 batch = SSOT 신설 트랙. 다크 토큰화 무관 (별도 Phase 4 트랙).

---

## §8. 다음 액션

1. **Stage 4 pre-flight** (별도 turn)
   - N+48 SSOT 신설 위치 + props 시그니처 finalize
   - 5 위저드 consumer 마이그레이션 line delta 정확 추정 (JobPosting / PerfCycle 정확 검증)
   - N+50 cross-batch 머지 순서 게이트 (N+27 → N+50)
2. **Stage 4 implementation** (PR-5A 머지 후) — 권고 순서:
   - N+48 (SSOT 선행) → N+49 (Hire) → N+50 (OrgRestructure 순수 WizardShell wrap, N+27 의존 없음 — S235 정정) → N+53 (BulkUpload). N+51/N+52 = DEFERRED(옵션 B)
3. **cross-batch 의존성**:
   - **N+49 → N+55 별 PR** (옵션 β, Session 233): N+49 머지 후 codebase `<DemoLimitBanner />` SSOT 신설 + consumer wire (banner prop 부재, consumer-driven)
   - **N+49 → N+56 follow-up** (Session 234, D1 결재): mobile sticky-bottom variant — N+49 default footer 채택으로 StickyActionBar 제거 → Phase 4 mobile polish 트랙 또는 mobile complaint 발생 시 진입
   - **N+50** (Q5=B 분리 PR): ⚠️ 정정(S235) — N+27 머지 의존 무효. `RestructureModal.tsx` 가 이미 centered-overlay 3-step wizard라 순수 WizardShell wrap으로 독립 진입. N+27 기능 항목은 별도 feature 트랙 재분류

---

**상태**: ACTIVE (Stage 3 게이트 통과 2026-05-21, RECORD N+48~N+53 사양화 완료, 가디언 default 결정)
**다음 갱신**: Stage 4 pre-flight 별도 turn
