# N+48 Pre-flight — WizardShell SSOT 신설 (Q1 결정 게이트) ⭐ critical 선행

> **base SHA**: `4ff48de6` · **트랙**: codebase 선행 SSOT · **우선**: HIGH
> **결정 (Stage 3 Q1=A)**: proto WizardShell prop 시그니처 채택, Radix Dialog 기반
> **본 pre-flight 결과 (요약)**: ✅ **`src/components/shared/` SSOT 정합** (가디언 사전 가정 정합). PageHeader/StatusBadge/EmptyState 등 15+ shared SSOT 패턴 정합.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### ⭐ N+48 SSOT location 결정 (CRITICAL 가드 응답)

**가디언 사전 가정** (Stage 2 카드 §7 N+48 entry): `src/components/shared/WizardShell.tsx`

**CC grep 검증 결과**:
```
src/components/shared/   ✅ 존재 (15+ SSOT 컴포넌트)
  - AiGeneratedBadge.tsx / AssignmentTimeline.tsx / BrandProvider.tsx
  - CompanySelector.tsx / CustomFieldsSection.tsx / DataTable.tsx
  - DetailPanel.tsx / EffectiveDatePicker.tsx / EmptyState.tsx
  - HelpTooltip.tsx / LoadingSpinner.tsx / ModuleGate.tsx
  - PageHeader.tsx / PageSkeleton.tsx / PermissionGate.tsx ...

src/components/wizards/  ❌ 부재
src/components/forms/    ❌ 부재
```

→ **(a) shared/ 정합 확정 ✅** (가디언 사전 가정 정합)

### Radix Dialog SSOT 검증

- `src/components/ui/dialog.tsx` 존재 (`@radix-ui/react-dialog` SSOT)
- `DialogContent / DialogHeader / DialogTitle / DialogFooter / DialogDescription` 노출
- WizardShell = Radix Dialog 직접 import 또는 wrapper layer 결정 게이트

### Proto WizardShell SSOT cross-ref

`_design-reference/wizards.jsx` WizardShell (~50 lines):
```jsx
<WizardShell title sub steps currentStep onCancel footer>
  {children}
</WizardShell>
```
- 4 proto wizard 모두 동일 호출 패턴
- step indicator inline (done/current/upcoming dot + 체크)
- progress text inline (`{currentStep+1} / {steps.length} 단계`)
- footer = navigation buttons (이전/다음/제출)

### batch 04 N+24 PageHeader SSOT 패턴 cross-ref

`docs/phase-3a/stage4-preflight/n24-page-h-status-chips.md`:
- `src/components/shared/PageHeader.tsx` (~28 lines, 10+ surface 재사용)
- 단순 props (title / description / actions)
- variant 미지원 (단일 패턴)

→ **N+48 = PageHeader 패턴 SSOT 정합** (shared/ 위치 + 단순 props + 단일 호출 패턴)

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 신규 파일

| 파일 | 변경 | line delta |
|---|---|---|
| `src/components/shared/WizardShell.tsx` | **신규** SSOT (~150 lines) | +150 |
| `src/components/shared/WizardShell.test.tsx` 또는 (Storybook entry) | **신규** vitest unit (~60 lines) | +60 |

### (b) WizardShell SSOT spec (proto 정합)

```tsx
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'

interface WizardStep {
  key: string
  label: string
}

interface WizardShellProps {
  title: string
  sub?: string
  steps: WizardStep[]
  currentStep: number              // 0-indexed
  onCancel: () => void
  onPrev?: () => void              // default: noop (caller 측 제공)
  onNext?: () => void              // default: noop
  onSubmit?: () => void            // 마지막 step에서 사용
  canProceed?: boolean             // default true (caller validation)
  footer?: ReactNode               // 커스텀 footer override
  banner?: ReactNode               // batch 04 N+21 DemoLimitBanner 통합 슬롯
  open: boolean                    // Radix Dialog control
  children: ReactNode
  className?: string
}

export function WizardShell(props: WizardShellProps) {
  // Radix Dialog 기반
  // step indicator (steps array iterate + currentStep highlight)
  // progress text (`{currentStep+1} / {steps.length} 단계`)
  // default footer = 이전/다음/제출 (이전 disabled = currentStep === 0)
  // banner slot = footer 위 (마지막 step에서만 권장)
}
```

### (c) step indicator sub-component 분리

`WizardStepIndicator` (내부 컴포넌트, export 없음):
- proto pattern: done = 체크 아이콘 + success token / current = 채워진 dot + primary token / upcoming = 빈 dot + border token
- `aria-current="step"` + `aria-label`
- 가로 배치 (모바일 = 압축 dot only)

### (d) batch 04 N+21 DemoLimitBanner 통합

**가디언 사전 가정**: N+48 SSOT에 DemoLimitBanner slot 통합 (footer 위)

**CC 검증 결과**: 
- `DemoLimitBanner` codebase 0건 (batch 04 N+21 신설 예정)
- N+48 spec에 `banner?: ReactNode` prop 추가 → caller가 `<DemoLimitBanner />` 전달
- N+21 머지 후 또는 동반 (cross-batch 정합)

### (e) 예상 총 line delta

- WizardShell.tsx: +150
- unit test: +60
- **순 총합**: +210 lines

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 0 (SSOT 자체 무관, caller 측 props로 전달)
- **DB**: 0
- **API**: 0
- **default footer 버튼 라벨**: 5 locale 신규 키 (`wizard.prev/next/submit/cancel`) = 20 entries — 또는 caller 측 i18n 위임

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (MEDIUM)**: Radix Dialog focus trap = HireWorker (현재 page 패턴) 와 결렬 위험 → N+49 진입 시 page → Dialog 컨테이너 변경 검증
- **R2 (LOW)**: step indicator 시각 시그니처 변경 시 5 consumer 회귀 위험 — props spec 사전 finalize
- **R3 (LOW)**: 모바일 reflow — Dialog full-screen vs centered modal 결정 게이트 (proto = full-screen 가정)

### 의존성
- **PR-5A 머지** 후 진입
- **batch 04 N+21 DemoLimitBanner** = banner slot 통합 (cross-batch 정합, 머지 순서 무관 — slot prop)
- **N+49~N+53 consumer 선행 의존**

### 가드
- ❌ Radix Dialog 시그니처 변경 금지 (다른 modal surface 회귀 위험)
- ❌ WizardShell SSOT 신규 hex / oklch 0건 (wt 토큰만)
- ❌ 다른 wizard pattern (drawer / page) 신규 도입 금지 — SSOT only
- ✅ shared/ 디렉토리 정합 (PageHeader 패턴)
- ✅ Radix Dialog 직접 사용 (wrapper layer 0)
- ✅ vitest 단위 (props + step state + footer override)
- ✅ axe-core 0 violation (Dialog focus trap + ARIA)

---

## §5. Implementation 단계 (PR-5A 머지 후, 선행 SSOT)

1. **사전 합의 게이트**:
   - WizardShell props spec finalize
   - Dialog full-screen vs centered modal 결정
   - 모바일 reflow 정책
2. **branch**: `feat/shared-wizardshell-ssot`
3. **commit 1 (WizardShell SSOT 신설)**:
   - `src/components/shared/WizardShell.tsx` (~150 lines)
   - import Radix Dialog + Button + lucide-react icons
4. **commit 2 (vitest unit test)**:
   - props validation + step state + footer override + banner slot
5. **commit 3 (i18n 신규 키 선택)**:
   - `wizard.prev/next/submit/cancel` × 5 locale = 20 entries
6. **codex Gate 1+2**: 표준
7. **PR open**: `feat/shared-wizardshell-ssot` → main (consumer 부재 시 SSOT only PR)

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **vitest**: props + step state + footer override + banner slot 케이스
- ✅ **axe-core**: Dialog focus trap + ARIA 0 violation
- ✅ **회귀 0**: 다른 modal surface 변동 0

---

**상태**: pre-flight 완료, 가디언 사전 가정 정합 (shared/ SSOT)
**Stage 4 예상 PR 크기**: 2-3 commits, ~210 lines + 20 i18n entries, 2-3 file diff
