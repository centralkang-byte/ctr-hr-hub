# N+53 Pre-flight — BulkUploadWizard 마이그레이션 (Q6 결정 — 포함, codebase-only)

> ⚠️ **SUPERSEDED (2026-05-30) — N+53 = 죽은 코드 제거로 종결, 마이그레이션 아님.**
> 본 pre-flight 전제가 무효화됨: `BulkUploadWizard.tsx`는 커밋 `e86e6318`("Track B Phase 3 v2") 이후 **deprecated·미마운트 죽은 코드**이며(import·렌더 0), 구 API `/api/v1/employees/bulk-upload`도 **410 Gone 묘비석**임. 실 기능은 `/hr/bulk-movements` **페이지형 3-step 위저드**(모달 아님, 자체 step indicator + `useTranslations('bulkMovement')`)로 이전됨 → Radix Dialog 모달 SSOT인 **WizardShell 이식 대상 아님**. CEO 결재(2026-05-30): **`BulkUploadWizard.tsx` 삭제로 N+53 종결**. N+27↔N+50에 이은 2번째 audit↔코드 drift (Phase 3a 사전 audit이 옛 base SHA 기준 → 후속 코드 이동 미반영). 아래 §1~§7 원문은 역사적 기록으로 보존.

> **base SHA**: `4ff48de6` · **트랙**: codebase · **우선**: LOW
> **결정 (Stage 3 Q6=A)**: BulkUploadWizard 포함 (5번째 wizard SSOT 적용, batch 05 Q6 패턴 정합)
> **본 pre-flight 결과 (요약)**: ✅ BulkUploadWizard 4-step Dialog 패턴 정합. proto 부재 = visual SSOT 0 → WizardShell pattern 적용. 파일 업로드 step special handling 필요.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### BulkUploadWizard.tsx 상세

`src/components/employees/BulkUploadWizard.tsx` (Stage 1 audit 결과 발견):
```tsx
// B2: 4-step Excel 일괄 발령 업로드
type Step = 1 | 2 | 3 | 4

interface BulkUploadWizardProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

// Dialog wrapper + 4-step inline:
// Step 1: Template 다운로드 + 안내
// Step 2: 파일 업로드 (Excel)
// Step 3: Preview + validation
// Step 4: 확정 + 결과
```

**검증 결과**:
- Radix Dialog 기반 ✅ (WizardShell SSOT 컨테이너 정합)
- 4-step type union (`type Step = 1|2|3|4`) ✅
- proto WizardShell 패턴과 호환 (Dialog + step state)
- **특수 patternd**:
  - 파일 업로드 step (Excel) — useRef + file input
  - 파일 미리보기 step (PreviewRow array)
  - 에러 행 표시 (UploadError array)

### proto 부재 (codebase-only B2 era)

- proto `_design-reference/wizards.jsx` 4 wizard 중 BulkUploadWizard 부재
- → **visual SSOT 0**, proto WizardShell pattern 적용 (시각 통합)

### Q6=A 결정 정합 (batch 05 Q6 패턴)

**Stage 3 Q6=A**: BulkUploadWizard 포함 (5번째 wizard SSOT 적용)
- **근거**: batch 05 Q6 패턴 정합 — codebase only 기능 = production 실수요 → SSOT 적용
- **목적**: 5 wizard 컨테이너 일관성 (WizardShell SSOT consumer)

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 변경 파일

| 파일 | 변경 | line delta |
|---|---|---|
| `src/components/employees/BulkUploadWizard.tsx` | Dialog wrapper + inline step → WizardShell consumer | -60 / +30 = **-30 net** |
| (i18n) | 기존 키 재사용 (변경 0) | 0 |

### (b) 마이그레이션 spec

**Before (inline)**:
```tsx
export function BulkUploadWizard({ open, onClose, onSuccess }: BulkUploadWizardProps) {
  const [step, setStep] = useState<Step>(1)
  // ... file/preview/errors state
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>일괄 발령 업로드 ({step}/4 단계)</DialogTitle>
        </DialogHeader>
        {step === 1 && <Step1Template />}
        {step === 2 && <Step2Upload />}
        {step === 3 && <Step3Preview />}
        {step === 4 && <Step4Confirm />}
        {/* inline footer */}
      </DialogContent>
    </Dialog>
  )
}
```

**After (WizardShell consumer)**:
```tsx
import { WizardShell } from '@/components/shared/WizardShell'

const BULK_UPLOAD_STEPS = [
  { key: 'template', label: '템플릿' },
  { key: 'upload', label: '업로드' },
  { key: 'preview', label: '미리보기' },
  { key: 'confirm', label: '확정' },
]

export function BulkUploadWizard({ open, onClose, onSuccess }: BulkUploadWizardProps) {
  const [step, setStep] = useState(0)  // 0-indexed
  // ... 동일 state
  
  return (
    <WizardShell
      open={open}
      title="일괄 발령 업로드"
      steps={BULK_UPLOAD_STEPS}
      currentStep={step}
      onCancel={onClose}
      onPrev={() => setStep(s => Math.max(0, s - 1))}
      onNext={() => setStep(s => s + 1)}
      onSubmit={handleSubmit}
      canProceed={validateStep(step)}
    >
      {step === 0 && <Step1Template />}
      {step === 1 && <Step2Upload />}
      {step === 2 && <Step3Preview />}
      {step === 3 && <Step4Confirm />}
    </WizardShell>
  )
}
```

### (c) 특수 patternd handling

| Special pattern | 처리 |
|---|---|
| 파일 업로드 step | Step2Upload 안에서 `useRef<HTMLInputElement>` + file input 유지 (WizardShell 무관) |
| 파일 미리보기 step | Step3Preview에서 PreviewRow array 렌더 (WizardShell content slot 안) |
| 에러 행 표시 | Step3Preview 안에서 UploadError 렌더 + canProceed = errors.length === 0 |
| 확정 step | Step4Confirm에서 mutation API + onSuccess 호출 |
| Dialog full-screen vs centered | WizardShell SSOT 결정 정합 (N+48 spec) |

### (d) 예상 총 line delta

- BulkUploadWizard: -30 net (Dialog/header/inline footer 제거, WizardShell consumer 보강)
- **순 총합**: -30 lines

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 0 (기존 키 재사용, "일괄 발령 업로드" 등)
- **DB**: 0
- **API**: 0 (mutation 패턴 무변경)

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (LOW)**: 파일 업로드 step (Step2Upload) = WizardShell children 안에서 useRef 정합 검증
- **R2 (LOW)**: BulkUpload 호출 caller (employees list 페이지) `open` prop 정합
- **R3 (LOW)**: step type union (`Step = 1|2|3|4`) → 0-indexed 변경 (WizardShell 정합)

### 의존성
- **N+48 (WizardShell SSOT)** 선행 필수
- **PR-5A 머지** 후
- 다른 batch RECORD 무관 (proto SSOT 결렬 = visual reference 0)

### 가드
- ❌ 파일 업로드 logic 변경 금지 (file/preview/errors state 유지)
- ❌ Excel template/upload mutation API 변경 금지
- ❌ step type union → 0-indexed 변경 시 caller 회귀 검증
- ✅ Workday wt 토큰 사용 (WizardShell SSOT 자동)
- ✅ axe-core 0 violation

---

## §5. Implementation 단계 (N+48 선행 후, 점진 마이그레이션 5번째)

1. **사전 합의 게이트**:
   - step type union → 0-indexed 변경 영향 (Step2Upload caller 검증)
   - canProceed 정책 (preview errors 시 disabled)
2. **branch**: `feat/bulkupload-wizardshell-migration`
3. **commit 1 (BulkUploadWizard 마이그레이션)**:
   - Dialog wrapper + inline footer 제거
   - WizardShell consumer 적용
   - step type union → 0-indexed
4. **e2e**: `e2e/flows/bulkupload-wizardshell.spec.ts` — 4-step 통과 (template/upload/preview/confirm) + 회귀
5. **gstack 시각**: Dialog 라이트 + Excel preview rendering
6. **axe-core**: 0 violation
7. **codex Gate 1+2**: 표준
8. **PR open**: `feat/bulkupload-wizardshell-migration` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **e2e**: 4-step (template/upload/preview/confirm) + 파일 업로드 + 미리보기 + 에러 행 + 확정 시나리오
- ✅ **axe-core**: Dialog focus trap + ARIA 0 violation
- ✅ **시각 회귀**: gstack 라이트 Dialog rendering
- ✅ **회귀 0**: Excel template download + file upload + preview validation + mutation API 동작 무변동

---

## §7. Q6=A 결정 정합 (batch 05 Q6 패턴 cross-ref)

본 N+53 = batch 05 Q6 패턴 정합:

| Batch | Q6 결정 | 패턴 |
|---|---|---|
| batch 05 | 전수 유지 | codebase only 기능 (Matrix/Snapshot/RestructurePlan/DnD/Multi-company) production 보존 + SSOT 적용 |
| batch 07 | 전수 유지 | codebase only B5 강화 (감정 펄스/체크인/ExitInterview) production 보존 |
| batch 09 N+53 | **A 포함** | BulkUploadWizard codebase only = production 실수요 + SSOT 적용 (5번째 wizard) |

→ **cross-batch Q6 일관성 정합** ✅

---

**상태**: pre-flight 완료, N+48 선행 의존, Q6=A 정합
**Stage 4 예상 PR 크기**: 1 commit, **-30 net lines** (코드 단순화), 1 file diff
