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
- **Cross-batch 의존성**: N+49 ← batch 04 N+21 (DemoLimitBanner), N+50 ← batch 05 N+27 (분리 PR)

---

## §1. Surface 인벤토리

Stage 1 §1 cross-ref (`09-wizardshell-ssot-stage1.md`). 압축 표:

| # | Wizard | 위치 | inline 패턴 | 마이그레이션 RECORD |
|---|---|---|---|---|
| 1 | HireWorkerWizard | `src/app/(dashboard)/employees/new/EmployeeNewClient.tsx` (701 lines) | 4-step inline (step state/validation/indicator L608/content L655) | N+49 |
| 2 | JobPostingWizard | `src/app/(dashboard)/recruitment/new/PostingFormClient.tsx` | (Stage 4 정확 검증) | N+51 |
| 3 | PerfCycleWizard | `src/app/(dashboard)/performance/PerformanceClient.tsx` (593) 또는 sub-page | (Stage 4 정확 검증) | N+52 |
| 4 | OrgRestructureWizard → RestructureModal | `src/components/org/RestructureModal.tsx` (676 lines, drawer) | drawer 패턴 (batch 05 N+27 target) | N+50 (N+27 분리) |
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
| **WS-003** | OrgRestructureWizard | HIGH | drawer 패턴 (wizard 결렬) — batch 05 N+27 cross-batch |
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
| X5 | 컨테이너 패턴 3가지 (page / drawer / Dialog) | N+48 SSOT = Radix Dialog 기반 (HireWorker page 패턴은 별도 검토) |

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
| Q5 N+27 합본 | **B** | 분리 (N+50 = OrgRestructure 마이그레이션 단독 PR, N+27 머지 후) |
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
| **N+50** | WS-003 + Q5 (OrgRestructure 마이그레이션, N+27 분리 PR) | HIGH | codebase + cross-batch | N+48 + batch 05 N+27 머지 |
| **N+51** | JobPostingWizard — ⚠️ wizard 패턴 부재 (옵션 B) | **DEFERRED** | **N/A** | **N/A** |
| **N+52** | PerfCycleWizard — ⚠️ wizard 패턴 부재 (옵션 B) | **DEFERRED** | **N/A** | **N/A** |
| **N+53** | WS-004 + Q6 (BulkUploadWizard 마이그레이션) | LOW | codebase | N+48 |

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
  - **DemoLimitBanner 통합 슬롯** (batch 04 N+21 SSOT): footer 위 영역 또는 prop
- **Stage 4 검증**:
  - vitest 단위 (props + step state + footer override)
  - Storybook entry (있으면) 또는 dev test page
  - axe-core 0 violation (Dialog focus trap + ARIA)
- **블로커**: PR-5A 머지 후 진입

---

### N+49 — HireWorkerWizard 마이그레이션 (Q4 점진 1) [HIGH]

- **트랙**: codebase
- **우선**: HIGH
- **의존성**: **N+48 선행 필수** + **batch 04 N+21 (DemoLimitBanner) 정합 검증**
- **Stage 4 입력**:
  - `src/app/(dashboard)/employees/new/EmployeeNewClient.tsx` (701 lines) 마이그레이션:
    - L181 `useState(0)` + L215 `validateStep` 유지 (caller 측 state)
    - L608 inline step indicator → `<WizardShell steps={...} currentStep={step}>` 제거
    - L655 inline step content → `<WizardShell>` children 안
    - footer (이전/다음/제출) → `<WizardShell footer={...}>` 또는 default 사용
  - **DemoLimitBanner 통합** (batch 04 N+21 SSOT): footer 위 영역 (마지막 step에서만 표시)
  - i18n: caller 측 t() 기존 키 재사용
- **Stage 4 검증**:
  - 기존 HireWorker 회귀 0 (validation + toast + redirect 패턴 정합)
  - DemoLimitBanner 표시 (마지막 step)
  - 시각 회귀 (gstack 라이트)
  - e2e: 4-step 통과 시나리오

---

### N+50 — OrgRestructureWizard 마이그레이션 (Q4 점진 2, Q5 분리) [HIGH, cross-batch]

- **트랙**: codebase + cross-batch (N+27 분리 PR)
- **우선**: HIGH
- **의존성**: **N+48 선행** + **batch 05 N+27 머지 완료** 후 진입 (Q5=B 분리)
- **Stage 4 입력**:
  - batch 05 N+27 implementation 결과: RestructureModal drawer → full-screen wizard 재작업 완료
  - N+50 = N+27 결과물(WizardShell 자체 구현) → 본 batch 09 WizardShell SSOT consumer 로 마이그레이션 (분리 PR)
  - 두 단계로 분리:
    - 단계 1 (batch 05 N+27): drawer → wizard inline
    - 단계 2 (batch 09 N+50): wizard inline → WizardShell SSOT
  - 회귀 격리 명확 (각 단계 e2e 시나리오 별도)
- **Stage 4 검증**:
  - N+27 머지 + 1주 안정화 후 N+50 진입 (회귀 가드)
  - WizardShell SSOT props 정합 (proto 6 changeType + 4 step)
  - batch 05 N+27 RestructureModal 회귀 0

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

### Phase 4 다크 트랙 합본 (배제)

본 batch = SSOT 신설 트랙. 다크 토큰화 무관 (별도 Phase 4 트랙).

---

## §8. 다음 액션

1. **Stage 4 pre-flight** (별도 turn)
   - N+48 SSOT 신설 위치 + props 시그니처 finalize
   - 5 위저드 consumer 마이그레이션 line delta 정확 추정 (JobPosting / PerfCycle 정확 검증)
   - N+50 cross-batch 머지 순서 게이트 (N+27 → N+50)
2. **Stage 4 implementation** (PR-5A 머지 후) — 권고 순서:
   - N+48 (SSOT 선행) → N+49 (Hire) → N+27 (batch 05 분리 PR) → N+50 (OrgRestructure SSOT 적용) → N+51 (JobPosting) → N+52 (PerfCycle) → N+53 (BulkUpload)
3. **cross-batch 의존성**:
   - **N+49 ← batch 04 N+21**: DemoLimitBanner SSOT 통합 (N+21 머지 후 또는 동반)
   - **N+50 ← batch 05 N+27**: drawer→wizard 머지 후 분리 PR (Q5=B)

---

**상태**: ACTIVE (Stage 3 게이트 통과 2026-05-21, RECORD N+48~N+53 사양화 완료, 가디언 default 결정)
**다음 갱신**: Stage 4 pre-flight 별도 turn
