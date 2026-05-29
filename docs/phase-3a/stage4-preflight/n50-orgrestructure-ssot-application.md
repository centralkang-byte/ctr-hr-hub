# N+50 Pre-flight — OrgRestructureWizard SSOT 적용 (Q4 점진 2, batch 05 N+27 분리 PR cross-batch)

> **base SHA**: `4ff48de6` · **트랙**: codebase + cross-batch (N+27 분리) · **우선**: HIGH
> **결정 (Stage 3 Q5=B, Session 235 정정)**: 코드가 이미 wizard라 N+50은 N+27 선행 의존 없이 독립 PR 진입. (Q5=B 분리 배경은 아래 보존)
> **본 pre-flight 결과 (요약)**: ✅ 순수 WizardShell wrap. RestructureModal은 이미 centered-overlay 3-step wizard → N+27 선행 의존 없이 N+50 (wizard inline→WizardShell consumer) 독립 진입.

---

> **⚠️ 정정 (Session 235, 2026-05-29 — 6-agent workflow 코드 검증 + Codex Gate 1 HIGH 반영)**
> 본 문서의 N+27/N+50 전제가 실제 코드와 불일치하여 정정합니다 (기존 결정 배경은 아래 본문에 보존):
> - **`src/components/org/RestructureModal.tsx` 는 drawer가 아니라 이미 centered-overlay 3-step wizard** (Step 타입 `'edit'|'diff'|'confirm'`, custom StepIndicator, inline footer, `MODAL_STYLES.container`). "drawer → full-screen wizard 재작업" 전제는 코드상 무의미.
> - **WizardShell SSOT는 N+48이 `src/components/shared/WizardShell.tsx` 에 신설·머지(#83 `90c88ac1`)** — N+27이 `src/components/wizards/` 에 자체 신설한다는 계획은 superseded.
> - **N+27 charter = A (순수 형태 정합, 거의 no-op → N+50 WizardShell wrap에 흡수)**. 기능 항목(`split` changeType / `CHANGE_TYPE_LABELS` i18n 추출 / N+30 mapping layer)은 폐기가 아니라 **별도 feature 트랙으로 재분류**.
> - 따라서 **N+50은 N+27 머지 의존 없이 순수 WizardShell wrap으로 진입 가능** (N+49 #85 모델). 실제 작업 = string-union step → numeric currentStep 매핑 + dual-action(저장 초안/즉시 적용) custom footer.
> 근거: workflow 판정 insufficient-evidence → 코드 검증 (RestructureModal.tsx:365/367/631-672, modal.ts:3), Codex Gate 1 HIGH(수정 범위) 반영. 정정 트랙 = `docs/n27-n50-drift-fix`.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### batch 05 N+27 pre-flight cross-ref

`docs/phase-3a/stage4-preflight/n27-restructure-wizard-rework.md` (256 lines):
- **결정 (Session 235 정정)**: RestructureModal은 이미 centered-overlay 3-step wizard (`'edit'|'diff'|'confirm'`) → drawer 재작업 전제 무효. N+27 charter = A (순수 형태 정합, 거의 no-op → N+50 WizardShell wrap에 흡수)
- **scope**: 3 step (변경내용 edit / 영향분석 diff / 확인 confirm). proto split changeType 추가 등 기능 항목은 별도 feature 트랙으로 재분류
- **schema migration 불필요** ✅ (Json free-form)
- **WizardShell SSOT는 N+48이 `src/components/shared/WizardShell.tsx` 에 신설·머지 완료 (#83)** — N+27 자체 신설 불필요

### N+27 ↔ N+50 분리 결정 (Q5=B)

**두 단계 분리** (Stage 3 결정 매트릭스 Q5=B):

| 단계 | RECORD | Batch | 내용 |
|---|---|---|---|
| 1 | **N+27** | batch 05 | charter = A 순수 형태 정합 (거의 no-op → N+50에 흡수). 기능 항목은 별도 feature 트랙 재분류 |
| 2 | **N+50** | batch 09 | 기존 wizard inline → WizardShell SSOT consumer 마이그레이션 (N+27 선행 의존 없이 독립 진입) |

### 분리 진입 정합 (batch 08 N+46 분할 패턴 cross-ref)

batch 08 N+46 pre-flight (`n46-orgviewmode-3way-merge.md`):
- 3-way 합본 권고 = **(b) 분할 진입** (의존성 0, 회귀 격리)
- 코드베이스 측 직접 의존성 0 → 별도 PR 권장

N+50 도 동일 패턴:
- N+27 = 순수 형태 정합 (charter A, batch 05 트랙) — N+50에 흡수 가능
- N+50 = 기존 wizard inline → WizardShell SSOT (batch 09 트랙)
- 두 PR 각각 독립 회귀 검증 가능

### N+50 진입 시점 (Session 235 정정 — N+27 선행 의존 없음)

**진입 순서 권고**:
```
1. N+48 (WizardShell SSOT 신설) — #83 머지 완료
2. N+50 (기존 wizard inline → WizardShell SSOT consumer, N+49 #85 모델로 독립 진입)
   ※ N+27 구조작업 불필요 (코드가 이미 wizard). 기능 항목은 별도 feature 트랙
```

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) N+50 변경 surface (현재 코드 기준 — N+27 선행 의존 없음)

| 파일 | 변경 | line delta |
|---|---|---|
| `src/components/org/RestructureModal.tsx` (현재 wizard, 676줄) | wizard inline → WizardShell consumer (string-union step → numeric currentStep 매핑 + dual-action custom footer) | -100 / +30 = **-70 net** |
| OrgClient.tsx | 변경 0 (caller 동일) | 0 |

### (b) 마이그레이션 spec

현재 RestructureModal 구조 (이미 centered-overlay 3-step wizard, 676줄 — N+27 가정 불필요):

```tsx
// RestructureModal.tsx (현재 — before N+50)
export function RestructureModal({ companyId, onClose, onApplied }) {
  const [step, setStep] = useState<'edit' | 'diff' | 'confirm'>('edit')  // string-union
  const [changes, setChanges] = useState<OrgChange[]>([])
  // custom StepIndicator + inline footer(이전/다음/취소/즉시적용) + content (~100 lines)
  // root = MODAL_STYLES.container (fixed inset-0 flex items-center justify-center)
  ...
}
```

N+50 적용 (WizardShell SSOT consumer):

```tsx
// RestructureModal.tsx (after N+50)
import { WizardShell } from '@/components/shared/WizardShell'

const STEP_ORDER = ['edit', 'diff', 'confirm'] as const

export function RestructureModal({ companyId, onClose, onApplied }) {
  const [step, setStep] = useState<'edit' | 'diff' | 'confirm'>('edit')
  const [changes, setChanges] = useState<OrgChange[]>([])
  const currentStep = STEP_ORDER.indexOf(step)  // string-union → numeric 매핑

  return (
    <WizardShell
      open={true}
      title={t('orgRestructure.title')}
      sub={t('orgRestructure.sub')}
      steps={RESTRUCTURE_STEPS}
      currentStep={currentStep}
      onCancel={onClose}
      onPrev={() => setStep(STEP_ORDER[Math.max(0, currentStep - 1)])}
      onNext={() => setStep(STEP_ORDER[Math.min(STEP_ORDER.length - 1, currentStep + 1)])}
      // dual-action custom footer (저장 초안 / 즉시 적용) — default footer로 회귀 금지
      footer={<RestructureFooter onSaveDraft={handleSaveDraft} onApplyNow={handleApplyNow} />}
    >
      {step === 'edit' && <ChangeContentEditor changes={changes} onChange={setChanges} />}
      {step === 'diff' && <ImpactAnalysis changes={changes} />}
      {step === 'confirm' && <ConfirmStep changes={changes} />}
    </WizardShell>
  )
}
```

### (c) cross-batch 의존성 명시

| RECORD | 의존성 | 상태 |
|---|---|---|
| N+48 | 0 (선행 SSOT) | #83 머지 완료 ✅ |
| **N+27 (batch 05)** | charter A 형태 정합 (N+50에 흡수 가능) | N+50 선행 의존 아님 (코드가 이미 wizard) |
| N+50 | N+48 만 | N+27 선행 의존 없이 독립 진입 (N+49 #85 모델) |

### (d) 예상 총 line delta

- RestructureModal: -70 net
- **순 총합**: -70 lines (a11y 자동 보강 + 코드 단순화)

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 0 (기존 키 재사용, N+27 시점에 정합)
- **DB**: 0 (N+27에서 schema 무관 확정)
- **API**: 0

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (MEDIUM, Session 235 하향)**: string-union step(`'edit'|'diff'|'confirm'`) → numeric currentStep 매핑 정합 (off-by-one / 라벨 순서)
- **R2 (MEDIUM)**: WizardShell SSOT props ↔ 기존 wizard inline state 매핑 정합 (step state / validation / dual-action 저장초안·즉시적용 custom footer)
- **R3 (LOW)**: 3 step content(edit / diff / confirm) — 기존 코드 재사용, 신설 0

### 의존성
- **N+48 (WizardShell SSOT)** 선행 필수 — #83 머지 완료 ✅
- N+27 선행 의존 없음 (코드가 이미 wizard, charter A는 N+50에 흡수)

### 가드
- ✅ 코드가 이미 centered-overlay wizard라 drawer 회귀 불가 — N+27 구조작업 불필요, N+50 독립 진입 가능 (N+49 #85 모델)
- ❌ changeType enum 변경 금지 (proto split 추가는 별도 feature 트랙)
- ❌ OrgRestructurePlan schema 변경 금지 (Json free-form 유지)
- ✅ dual-action(저장 초안/즉시 적용) custom footer 유지 — default footer로 회귀 금지
- ✅ 3 step content 시그니처 정합

---

## §5. Implementation 단계 (N+48 머지 후 — N+27 선행 의존 없음)

1. **사전 합의 게이트**:
   - WizardShell props ↔ 기존 wizard inline state 매핑 정합 (string-union step → numeric currentStep)
   - dual-action(저장 초안/즉시 적용) custom footer 보존 확인
2. **branch**: `feat/orgrestructure-wizardshell-application`
3. **commit 1 (RestructureModal SSOT 마이그레이션)**:
   - wizard inline (~100 lines) → WizardShell consumer (~30 lines)
4. **e2e**: `e2e/flows/orgrestructure-wizardshell.spec.ts` — 3 step (edit/diff/confirm) + 저장 초안/즉시 적용 dual-action + redirect
5. **gstack 시각**: Dialog 라이트 + 모바일
6. **axe-core**: 0 violation
7. **codex Gate 1+2**: 표준
8. **PR open**: `feat/orgrestructure-wizardshell-application` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **e2e**: 3 step(edit/diff/confirm) + 저장 초안/즉시 적용 dual-action + apply 시나리오
- ✅ **axe-core**: Dialog 0 violation
- ✅ **시각 회귀**: gstack 라이트 + 모바일
- ✅ **회귀 0**: changes[] mutation + apply API + ImpactAnalysis 동작 무변동
- ✅ **wizard 회귀 0**: 기존 centered-overlay 3-step 동작·dual-action footer 무변동

---

## §7. 분리 PR 패턴 (Q5=B + batch 08 N+46 정합)

본 N+50 = batch 08 N+46 와 같은 **분리 PR 패턴**:

| Batch | RECORD | 패턴 |
|---|---|---|
| batch 08 N+46 | OrgViewModeToggle Radix 마이그레이션 | 3-way 합본 권고 안 함 → 단독 PR (batch 05 N+25 + batch 07 N+32 별도) |
| batch 09 N+50 | OrgRestructureWizard SSOT 적용 | 2-way 합본 권고 안 함 (Q5=B) → 단독 PR (batch 05 N+27 분리) |

→ **분리 PR 패턴 = batch 08/09 cross-batch 결정 정합**

---

**상태**: pre-flight 완료, N+48(#83) 선행 의존만 (N+27 선행 의존 없음 — 코드가 이미 wizard, Session 235 정정)
**Stage 4 예상 PR 크기**: 1 commit, **-70 net lines** (코드 단순화), 1 file diff
