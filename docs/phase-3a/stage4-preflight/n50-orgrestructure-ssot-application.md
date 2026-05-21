# N+50 Pre-flight — OrgRestructureWizard SSOT 적용 (Q4 점진 2, batch 05 N+27 분리 PR cross-batch)

> **base SHA**: `4ff48de6` · **트랙**: codebase + cross-batch (N+27 분리) · **우선**: HIGH
> **결정 (Stage 3 Q5=B)**: batch 05 N+27 머지 후 분리 PR (batch 08 N+46 분할 패턴 정합)
> **본 pre-flight 결과 (요약)**: ✅ 분리 PR 정합. N+27 (drawer→wizard inline) 머지 후 N+50 (wizard inline→WizardShell consumer) 진입.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### batch 05 N+27 pre-flight cross-ref

`docs/phase-3a/stage4-preflight/n27-restructure-wizard-rework.md` (256 lines):
- **결정**: drawer (RestructureModal) → full-screen wizard 재작업
- **scope**: 4 step (변경유형/내용/영향분석/결재선) + 6 changeType
- **schema migration 불필요** ✅ (Json free-form)
- **WizardShell SSOT 신설 필요** (codebase 0건)

### N+27 ↔ N+50 분리 결정 (Q5=B)

**두 단계 분리** (Stage 3 결정 매트릭스 Q5=B):

| 단계 | RECORD | Batch | 내용 |
|---|---|---|---|
| 1 | **N+27** | batch 05 | RestructureModal drawer → wizard inline (자체 WizardShell or inline 구현) |
| 2 | **N+50** | batch 09 | wizard inline → WizardShell SSOT consumer 마이그레이션 |

### 분리 진입 정합 (batch 08 N+46 분할 패턴 cross-ref)

batch 08 N+46 pre-flight (`n46-orgviewmode-3way-merge.md`):
- 3-way 합본 권고 = **(b) 분할 진입** (의존성 0, 회귀 격리)
- 코드베이스 측 직접 의존성 0 → 별도 PR 권장

N+50 도 동일 패턴:
- N+27 = drawer → wizard inline (batch 05 트랙)
- N+50 = wizard inline → WizardShell SSOT (batch 09 트랙)
- 두 PR 각각 독립 회귀 검증 가능

### N+27 머지 후 N+50 진입 시점

**진입 순서 권고**:
```
1. N+48 (WizardShell SSOT 신설)
2. batch 05 N+27 (RestructureModal drawer → wizard inline, 자체 inline step)
3. (안정화 ~1주 — N+27 머지 후 회귀 관찰)
4. N+50 (wizard inline → WizardShell SSOT consumer)
```

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) N+50 변경 surface (N+27 머지 후)

| 파일 | 변경 | line delta |
|---|---|---|
| `src/components/org/RestructureModal.tsx` (N+27 후) | wizard inline → WizardShell consumer | -100 / +30 = **-70 net** |
| OrgClient.tsx | 변경 0 (caller 동일) | 0 |

### (b) 마이그레이션 spec

N+27 후 RestructureModal 가정 구조 (drawer → wizard inline):

```tsx
// RestructureModal.tsx (after N+27, before N+50)
export function RestructureModal({ companyId, onClose, onApplied }) {
  const [step, setStep] = useState(0)
  const [changes, setChanges] = useState<OrgChange[]>([])
  // wizard inline step indicator + footer + content (~100 lines)
  ...
}
```

N+50 적용 (WizardShell SSOT consumer):

```tsx
// RestructureModal.tsx (after N+50)
import { WizardShell } from '@/components/shared/WizardShell'

export function RestructureModal({ companyId, onClose, onApplied }) {
  const [step, setStep] = useState(0)
  const [changes, setChanges] = useState<OrgChange[]>([])
  
  return (
    <WizardShell
      open={true}
      title={t('orgRestructure.title')}
      sub={t('orgRestructure.sub')}
      steps={RESTRUCTURE_STEPS}
      currentStep={step}
      onCancel={onClose}
      onPrev={() => setStep(s => Math.max(0, s - 1))}
      onNext={() => setStep(s => s + 1)}
      onSubmit={() => handleApply()}
      canProceed={validateStep(step, changes)}
    >
      {step === 0 && <ChangeTypeSelector changes={changes} onChange={setChanges} />}
      {step === 1 && <ChangeContentEditor changes={changes} onChange={setChanges} />}
      {step === 2 && <ImpactAnalysis changes={changes} />}
      {step === 3 && <ApprovalLine changes={changes} />}
    </WizardShell>
  )
}
```

### (c) cross-batch 의존성 명시

| RECORD | 의존성 | 상태 |
|---|---|---|
| N+48 | 0 (선행 SSOT) | N+50 진입 전 머지 완료 필수 |
| **N+27 (batch 05)** | N+48 무관 (자체 wizard 구현) | N+50 진입 전 머지 완료 필수 |
| N+50 | N+48 + N+27 | N+27 안정화 후 진입 |

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
- **R1 (HIGH)**: N+27 머지 후 회귀 발견 시 N+50 진입 지연 (안정화 기간 필요)
- **R2 (MEDIUM)**: WizardShell SSOT props ↔ N+27 wizard inline state 매핑 정합 (step state / validation)
- **R3 (LOW)**: 4 step sub-component (ChangeTypeSelector / ChangeContentEditor / ImpactAnalysis / ApprovalLine) — N+27에서 신설 후 N+50 재사용

### 의존성
- **N+48 (WizardShell SSOT)** 선행 필수
- **batch 05 N+27 (RestructureModal drawer→wizard)** 선행 + 안정화 ~1주 권고
- **PR-5A 머지** 후

### 가드
- ❌ N+27 미머지 시 N+50 단독 진입 금지 (drawer wrapper로 회귀)
- ❌ ChangeType 6 enum 변경 금지 (N+27 결정 정합)
- ❌ OrgRestructurePlan schema 변경 금지 (Json free-form 유지)
- ✅ N+27 안정화 후 진입 권고 (회귀 격리)
- ✅ 4 step sub-component 시그니처 정합

---

## §5. Implementation 단계 (N+27 머지 + N+48 머지 후, 안정화 후)

1. **사전 합의 게이트**:
   - N+27 안정화 기간 (1주 권고)
   - WizardShell props ↔ wizard inline state 매핑 정합
2. **branch**: `feat/orgrestructure-wizardshell-application`
3. **commit 1 (RestructureModal SSOT 마이그레이션)**:
   - wizard inline (~100 lines) → WizardShell consumer (~30 lines)
4. **e2e**: `e2e/flows/orgrestructure-wizardshell.spec.ts` — 4 step + 6 changeType + apply + redirect
5. **gstack 시각**: Dialog 라이트 + 모바일
6. **axe-core**: 0 violation
7. **codex Gate 1+2**: 표준
8. **PR open**: `feat/orgrestructure-wizardshell-application` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **e2e**: 4 step + 6 changeType × 4 step + apply + cross-changeType 시나리오
- ✅ **axe-core**: Dialog 0 violation
- ✅ **시각 회귀**: gstack 라이트 + 모바일
- ✅ **회귀 0**: changes[] mutation + apply API + ImpactAnalysis 동작 무변동
- ✅ **N+27 회귀 검증**: drawer→wizard 안정화 확인

---

## §7. 분리 PR 패턴 (Q5=B + batch 08 N+46 정합)

본 N+50 = batch 08 N+46 와 같은 **분리 PR 패턴**:

| Batch | RECORD | 패턴 |
|---|---|---|
| batch 08 N+46 | OrgViewModeToggle Radix 마이그레이션 | 3-way 합본 권고 안 함 → 단독 PR (batch 05 N+25 + batch 07 N+32 별도) |
| batch 09 N+50 | OrgRestructureWizard SSOT 적용 | 2-way 합본 권고 안 함 (Q5=B) → 단독 PR (batch 05 N+27 분리) |

→ **분리 PR 패턴 = batch 08/09 cross-batch 결정 정합**

---

**상태**: pre-flight 완료, batch 05 N+27 + N+48 선행 의존
**Stage 4 예상 PR 크기**: 1 commit, **-70 net lines** (코드 단순화), 1 file diff
