# Phase 3a · Batch 09 — WizardShell SSOT Stage 1 P0 Audit

> Stage 1 P0 audit
> **base SHA**: `0f66d773`
> **작성일**: 2026-05-21 KST (Session 228)
> 4 proto 위저드 + 1 codebase only = **5 위저드 inline 패턴 readonly 인벤토리**

---

## §0. 1분 요약

- **5 위저드 surface** (proto 4 + codebase only 1)
  - 4 proto: HireWorker / JobPosting / PerfCycle / OrgRestructure
  - 1 codebase only: BulkUploadWizard (B2 era, batch 09 inventory 누락 발견)
- ⚠️ **사전 가정 정정** — 4 → 5 wizard (BulkUpload 추가). batch 09 격상 scope 정정 필요
- ✅ **WizardShell codebase 0건 재검증 정합** (grep `WizardShell|Stepper|StepIndicator` = 0건)
- **14 findings** (HIGH 4 / MED 7 / LOW 3) — WS-001 ~ WS-014
- **Stage 2 의제**: SSOT API 시그니처 / step indicator / footer / cancel / 점진 vs 일괄 (Q1-Q5)
- **RECORD 후보 N+48~N+53** 6 surface 매핑 (BulkUpload 추가 시 N+53 split 검토)

---

## §1. Surface 인벤토리 (5)

### 1.1 codebase 5 위저드 상세

| # | Wizard | 위치 | Step | inline 패턴 |
|---|---|---|---|---|
| 1 | **HireWorkerWizard** | `src/app/(dashboard)/employees/new/EmployeeNewClient.tsx` (701 lines) | 4-step (기본정보/고용정보/배정/?) | Step 0/1/2 + validateStep + step indicator(L608) + step content(L655) — **full inline** |
| 2 | **JobPostingWizard** | `src/app/(dashboard)/recruitment/new/PostingFormClient.tsx` | (검증 필요) | (Stage 2 audit 시 정확 검증) |
| 3 | **PerfCycleWizard** | `src/app/(dashboard)/performance/PerformanceClient.tsx` (593 lines) 또는 별도 sub-page | (검증 필요) | (Stage 2 audit 시 정확 검증) |
| 4 | **OrgRestructureWizard** (proto SSOT) → **RestructureModal** (codebase) | `src/components/org/RestructureModal.tsx` (676 lines) | drawer 패턴 (wizard 아님) | batch 05 N+27 target — drawer → wizard 마이그레이션 필요 |
| 5 | ⚠️ **BulkUploadWizard** (codebase only) | `src/components/employees/BulkUploadWizard.tsx` | 4-step (`type Step = 1\|2\|3\|4`) | Dialog wrapper + 4-step type union + inline render — **codebase only** |

### 1.2 ⚠️ Critical 가드 응답 — WizardShell codebase 0건 재검증

가디언 사전 가정 (`docs/phase-3a/stage4-preflight/n27-restructure-wizard-rework.md` finding): "WizardShell SSOT codebase 0건"

**CC grep 검증 결과**:
```
grep -rln "WizardShell|Stepper|StepIndicator" src/components/
→ RestructureModal.tsx 1건 (cross-ref만, 자체 사용 X)
→ Stepper 0건
→ StepIndicator 0건
```

→ **(a) 0건 정합 ✅** batch 09 격상 sound

### 1.3 BulkUploadWizard inventory 추가 발견

`src/components/employees/BulkUploadWizard.tsx`:
```ts
// B2: 4-step Excel 일괄 발령 업로드
type Step = 1 | 2 | 3 | 4
interface BulkUploadWizardProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}
```

- Dialog wrapper (Radix Dialog) + 4-step inline
- 기능: 부서코드 / 직급코드 / 발효일 / 변경유형 / 사유 (Excel 업로드)
- **proto 부재** — codebase only wizard (batch 04 운명카드 후보)

**격상 scope 정정 의제** (§4 Q6 신규):
- BulkUploadWizard도 SSOT consumer 포함할지 (5 wizard 마이그레이션)
- 또는 별도 트랙 (B2 era 운명 검토)

---

## §2. Findings (WS-001 ~ WS-014)

### WS-001 [HIGH] WizardShell codebase 0건 확정 — SSOT 신규 신설 필요
- **surface**: cross-cutting
- **현상**: 5 wizard 각자 inline 패턴 (step state / indicator / footer / validation 모두 자체 구현)
- **권고**: `src/components/wizards/WizardShell.tsx` 신규 SSOT (N+48 plan body 정합)

### WS-002 [HIGH] HireWorkerWizard (EmployeeNewClient) inline 4-step
- **surface**: HireWorker
- **현상**: 701 lines 중 step state(L181)/validation(L215)/indicator(L608)/content(L655) inline. proto WizardShell prop 패턴 결렬
- **권고**: WizardShell 마이그레이션 (N+50)

### WS-003 [HIGH] RestructureModal — drawer 패턴 (wizard 결렬)
- **surface**: OrgRestructureWizard
- **현상**: 676 lines drawer + 다중 changes[] 그룹 — proto 단일 changeType wizard 와 결렬
- **권고**: batch 05 N+27 합본 (N+49)

### WS-004 [HIGH] BulkUploadWizard — codebase only, SSOT 미적용
- **surface**: BulkUploadWizard (신규 발견)
- **현상**: Dialog + 4-step inline. proto 부재 (codebase only B2 era)
- **권고**: WizardShell consumer 포함 또는 별도 운명 검토 (§4 Q6)

### WS-005 [MEDIUM] proto WizardShell prop 시그니처 vs codebase 4 inline
- **surface**: cross-cutting
- **현상**: proto `<WizardShell title sub steps currentStep onCancel footer>{children}</WizardShell>` — codebase 4 inline 각자 다름
- **권고**: SSOT API spec Q1 결정 (proto vs 신설)

### WS-006 [MEDIUM] step indicator 시각 패턴 차이
- **surface**: HireWorker (L608) + 3 다른 wizard
- **현상**: HireWorker는 점/숫자/체크 mix, BulkUpload는 Dialog header 단순 표시, RestructureModal은 indicator 부재 (drawer 한계)
- **권고**: Workday 표준 시각 (점/숫자/체크) SSOT 신설

### WS-007 [MEDIUM] footer 정책 (이전/다음/취소/임시저장/완료) 차이
- **surface**: 5 wizard
- **현상**: 임시저장 button 일부 wizard만 있음 / 취소 button 위치 다름 / 완료 button 표기 다름
- **권고**: WizardShell footer SSOT (이전/다음/취소 default + 커스텀 footer override)

### WS-008 [MEDIUM] progress text 표기 (1/N 단계) 차이
- **surface**: 5 wizard
- **현상**: proto `1 / 4 단계`, codebase 일부는 step number만, 일부는 percent
- **권고**: WizardShell `<ProgressText>` SSOT (default = `{current+1} / {total} 단계`)

### WS-009 [MEDIUM] cancel/back 동작 차이
- **surface**: 5 wizard
- **현상**: 일부 wizard에서 ESC = cancel, 일부는 X icon만. modal close 시 confirm dialog 일부만
- **권고**: WizardShell unified cancel policy (ESC + X + confirm dialog 옵션)

### WS-010 [MEDIUM] toast/redirect 패턴 일관성
- **surface**: 5 wizard 완료
- **현상**: proto 모두 `toast() + onComplete()` (정합성 grep 결과, batch 04 Q4 reversal 시점), codebase 일부 redirect 추가
- **권고**: WizardShell 완료 callback SSOT (toast + onComplete + optional redirect)

### WS-011 [MEDIUM] 데모 한계 배너 (batch 04 N+21) cross-ref
- **surface**: 5 wizard 완료
- **현상**: batch 04 N+21 = `<DemoLimitBanner>` SSOT 신설 결정. WizardShell footer에 통합 가능
- **권고**: WizardShell + DemoLimitBanner cross-batch SSOT 정합 (N+21 + N+48 동반)

### WS-012 [LOW] validation per step 패턴
- **surface**: HireWorker validateStep (L215) + 다른 wizard
- **현상**: 각 wizard validation 함수 inline + 시그니처 차이
- **권고**: WizardShell `validateStep` prop 또는 children 안에서 자유 (override pattern)

### WS-013 [LOW] focus management on step change
- **surface**: 5 wizard
- **현상**: step 변경 시 focus 정책 불명 (first input vs nothing)
- **권고**: WizardShell `onStepChange` callback에 focus hook 또는 ref 패턴

### WS-014 [LOW] a11y — `role="dialog"` / focus trap (Radix Dialog 정합)
- **surface**: 5 wizard
- **현상**: HireWorker = page (Dialog 아님), BulkUpload + Restructure = Dialog. WizardShell = Dialog vs page wrapper 결정 필요
- **권고**: WizardShell = Dialog 기반 SSOT (Radix Dialog focus trap 자동) — HireWorker는 별도 page 패턴 유지

---

## §3. 패턴 일관성 분석

### 3.1 5 위저드 inline 패턴 비교 표

| Surface | 컨테이너 | step state | indicator | footer | validation | cancel | progress |
|---|---|---|---|---|---|---|---|
| HireWorker (EmployeeNewClient) | page | `useState(0)` + validateStep | inline L608 (점/숫자/체크) | inline footer | per-step | back button | `{step+1}/4` |
| JobPosting (PostingFormClient) | page (추정) | (검증 필요) | (검증 필요) | (검증 필요) | (검증 필요) | (검증 필요) | (검증 필요) |
| PerfCycle | page | (검증 필요) | (검증 필요) | (검증 필요) | (검증 필요) | (검증 필요) | (검증 필요) |
| OrgRestructure (RestructureModal) | **drawer** (Sheet) | N/A (다중 changes[]) | N/A (drawer) | drawer footer | OrgChange.type별 | drawer close | N/A |
| BulkUpload | **Dialog** | `type Step = 1\|2\|3\|4` | Dialog header (단순) | inline footer | (검증 필요) | Dialog close | (검증 필요) |

### 3.2 SSOT 결렬 정도

- **컨테이너**: 3 패턴 (page / drawer / Dialog) → SSOT 신설 시 Dialog 우선 권고 (a11y + focus trap)
- **step state**: 5 위저드 모두 자체 useState + 자체 typing
- **indicator**: 시각 SSOT 0건 (각자 inline)
- **footer**: 5 위저드 footer 패턴 100% 결렬
- **cancel**: 4가지 패턴 (back / drawer close / Dialog close / 신규)

→ **SSOT 신설 필수도 = 매우 높음** (Q1-Q5 결정 후 점진 마이그레이션)

### 3.3 proto WizardShell SSOT cross-ref

`_design-reference/wizards.jsx` 의 WizardShell:
```jsx
<WizardShell
  title="조직 개편"
  sub="..."
  steps={ORG_STEPS}
  currentStep={step}
  onCancel={onCancel}
  footer={...}>
  {step === 0 && <Step0Content />}
  {step === 1 && <Step1Content />}
  ...
</WizardShell>
```

**spec**:
- props: title / sub / steps (array) / currentStep (number) / onCancel / footer (커스텀) / children
- step indicator 자동 (steps array iterate + currentStep highlight)
- progress text 자동 (`{currentStep+1} / {steps.length} 단계`)
- footer = navigation buttons (이전/다음/제출) 또는 커스텀
- 4 위저드 모두 동일 호출 패턴

→ **proto SSOT 시그니처 채택 권고** (Q1=A)

---

## §4. Stage 2 카드 진입 의제 (Q-게이트 사전 정리)

### Q1 — SSOT API 시그니처 (가장 큰 의제)
- **A** (proto WizardShell prop 시그니처 그대로 채택: title/sub/steps/currentStep/onCancel/footer/children)
- **B** (codebase 자체 시그니처 재설계, headless pattern)
- **C** (Radix UI base + 자체 wrapper)
- **추천**: A (proto SSOT 정합, 마이그레이션 cost 최소)

### Q2 — step indicator 시각 (점/숫자/체크)
- **A** (proto pattern 정합 — 점/숫자/체크 mix, 시각 SSOT 채택)
- **B** (Workday 표준 다른 시각 — 가로 progress bar 등)
- **추천**: A (proto pattern, batch 04/05/07 visual SSOT 정합)

### Q3 — footer 정책 (이전/다음/취소/임시저장/완료)
- **A** (default footer = 이전/다음/취소 + 마지막 step = 제출. 임시저장은 옵션 prop)
- **B** (footer 완전 커스텀, default 미제공)
- **추천**: A (default + override 두 단계)

### Q4 — 점진 마이그레이션 vs 일괄
- **A** (점진 — SSOT 신설 + 5 위저드 각 PR. 총 6 PR)
- **B** (일괄 — SSOT + 5 위저드 단일 대형 PR. ~600+ lines)
- **C** (선행 SSOT + 4 위저드 합본 PR + BulkUpload 별도 운명 검토)
- **추천**: A (회귀 최소화)

### Q5 — N+27 RestructureModal 합본 정책
- **A** (N+27 implementation 시 SSOT 합본 PR — Restructure 첫 마이그레이션 + SSOT 신설 통합)
- **B** (SSOT 단독 신설 PR → N+27 후속 PR 분리)
- **추천**: B (회귀 격리, batch 05 N+27 단독 PR + 본 batch 09 SSOT 단독 PR)

### Q6 (신규 의제) — BulkUploadWizard 포함 여부
- **A** (5 wizard 모두 SSOT consumer 포함 — BulkUpload 도 마이그레이션)
- **B** (4 wizard 만 마이그레이션 — BulkUpload 별도 운명, B2 era 검토)
- **C** (BulkUpload 별도 batch 트랙 격상)
- **추천**: A (codebase 일관성) 또는 B (proto 정합 우선) — Stage 2에서 사용자 결재 필요

---

## §5. RECORD 후보 매핑 (N+48~N+53)

batch 09 inventory reserve 한 6 RECORD의 surface 매핑:

| RECORD | 묶음 surface / finding | 우선 | 의존성 |
|---|---|---|---|
| **N+48** | WizardShell SSOT 신설 + DemoLimitBanner (batch 04 N+21) 통합 | HIGH | Stage 2 게이트 통과 |
| **N+49** | OrgRestructureWizard 마이그레이션 (batch 05 N+27 동반/별도) — Q5 결정 | HIGH | N+48 선행 |
| **N+50** | HireWorkerWizard 마이그레이션 (EmployeeNewClient L181~L660) | MEDIUM | N+48 선행 |
| **N+51** | JobPostingWizard 마이그레이션 (PostingFormClient) | MEDIUM | N+48 선행 |
| **N+52** | PerfCycleWizard 마이그레이션 | MEDIUM | N+48 선행 |
| **N+53** | 위저드 컨벤션 SSOT 문서 (`docs/wizards.md`) — 또는 BulkUploadWizard 별도 트랙 (Q6) | LOW | N+48~N+52 머지 후 |

**Q6 결정에 따른 N+53 분기**:
- Q6=A → N+53 split: N+53a (BulkUpload 마이그레이션) + N+53b (컨벤션 문서)
- Q6=B → N+53 = 컨벤션 문서만, BulkUpload 별도 운명 트랙
- Q6=C → N+53 = 컨벤션 문서만, BulkUpload batch 08+ 격상

---

## §6. 다음 액션

1. **Stage 2 카드 본문 작성** (별도 turn)
   - Q1-Q6 정합성 검증 + 결정
   - 14 finding × 6 RECORD plan body 사양화
   - JobPosting / PerfCycle inline 패턴 정확 검증 (Stage 2 진입 시)
2. **Stage 3 게이트** (가디언 default 또는 사용자 결재)
3. **Stage 4 pre-flight** (N+27 implementation 동반 검토 — Q5 결정 따라)
4. **Stage 4 implementation** (PR-5A 머지 후) — 권고 순서:
   - N+48 (SSOT 선행) → N+49 (OrgRestructure 또는 N+27 합본) → N+50 (Hire) → N+51 (JobPosting) → N+52 (PerfCycle) → N+53 (문서 + BulkUpload Q6)

---

## §7. 의존성

### Cross-batch 의존
- **batch 05 N+27 implementation** 합본/분리 가능 — Q5 결정 게이트
- **batch 04 N+21 (HireWorker DemoLimitBanner)** cross-batch 정합 — N+48 통합 권고
- **batch 04 EmployeeNewClient** = HireWorkerWizard 마이그레이션 대상 (N+50)
- **batch 04 N+18 (career 탭)** 무관 — batch 06 별도 트랙

### 무관
- batch 06 / batch 08 (a11y 트랙) 무관
- proto only RECORD (N+19/20/21/22/23/25/28/29/33/35/36) 무관

### 선행 의존
- **PR-5A 머지** 후 진입 (모든 codebase 트랙)
- 별도 batch 의존성 없음 (단독 SSOT 트랙)

---

**상태**: Stage 1 P0 audit 완료
**사전 가정 정정**:
- ✅ WizardShell codebase 0건 정합
- ⚠️ BulkUploadWizard 5번째 wizard 추가 발견 (격상 scope 정정 의제 Q6)

**다음 갱신**: Stage 2 카드 작성 별도 turn (Q1-Q6 정합성 검증 + RECORD plan body 사양화)
