# Phase 3a · Batch 09 — WizardShell SSOT (격상 트랙)

> **격상 일자**: 2026-05-21 KST (Session 228)
> **격상 사유**: batch 05 N+27 pre-flight (`docs/phase-3a/stage4-preflight/n27-restructure-wizard-rework.md`) 부산물. 4 위저드 (Hire/Job/PerfCycle/Restructure) cross-batch SSOT 필요, N+27 scope 비대 회피
> **base SHA**: phase3a-audit `7c62b878`
> **사용자 결재**: 2026-05-21 KST (가디언 round 통과)

---

## §1. 격상 배경

### N+27 pre-flight finding 인용 (`docs/phase-3a/stage4-preflight/n27-restructure-wizard-rework.md`)

> **WizardShell SSOT grep 결과**: `src/components/wizards/` 또는 `WizardShell.tsx` 부재 (proto에만 존재)
> - codebase에 WizardShell SSOT 없음 → **신규 SSOT 신설 필요**
> - 또는 Modal 컨테이너에 step indicator + nav buttons 패턴 직접 적용

### 4 위저드 정합성 grep 결과 (batch 04/05 cross-ref)

| 위저드 | Proto 파일 | Codebase | 패턴 |
|---|---|---|---|
| HireWorkerWizard | `_design-reference/wizards.jsx` (proto) | `EmployeeNewClient.tsx` (701 lines, 6 step) | proto 패턴 정합 추정 |
| JobPostingWizard | proto | (검증 필요) | full-screen |
| PerfCycleWizard | proto | (검증 필요) | full-screen |
| OrgRestructureWizard | proto (`wizards.jsx:622-826`) | `RestructureModal.tsx` (676 lines, drawer) | ⚠️ **drawer 패턴 (proto 결렬)** |

→ **4 위저드 모두 SSOT 부재**. inline 패턴 + 각자 다른 step indicator / progress / footer 가능성.

### 격상 의제 (Session 228 사용자 결재 통과)

가디언 default 결정 근거:
1. **N+27 scope 비대 회피** — Restructure 단독 재작업 + 다른 3 위저드 후속 = 4번 PR. SSOT 신설 + 4 위저드 점진 마이그레이션 = 1번 PR (SSOT) + 4번 PR (각 위저드 reskin)
2. **cross-batch SSOT 정합** — batch 05 N+24 (PageHeader/StatusChips SSOT) 와 같은 cross-batch SSOT 신설 패턴

---

## §2. 예상 scope

### WizardShell SSOT 컴포넌트 신설

**파일**: `src/components/shared/WizardShell.tsx` (~150 lines)

```tsx
interface WizardShellProps {
  title: string
  description?: string
  steps: string[]              // 단계 라벨 array
  currentStep: number          // 0-indexed
  onCancel: () => void
  footer?: ReactNode           // 커스텀 footer (default = navigation buttons)
  children: ReactNode          // 현재 step content
  className?: string
}
```

**spec**:
- full-screen modal (Radix Dialog 기반)
- 상단: title + description + cancel button
- 좌측 또는 상단: step indicator (proto `wz-step` 패턴)
- 중앙: children (step content)
- 하단: footer (이전/다음/제출 button 기본 패턴, 커스텀 가능)
- 키보드: ESC = cancel, Tab/Shift+Tab focus management
- a11y: `role="dialog"` + `aria-labelledby` + focus trap

### 4 위저드 reskin 점진 마이그레이션

| Step | 위저드 | 작업 |
|---|---|---|
| 1 | OrgRestructureWizard (batch 05 N+27) | drawer → WizardShell (이미 N+27에서 진입) |
| 2 | HireWorkerWizard | inline → WizardShell |
| 3 | JobPostingWizard | inline → WizardShell |
| 4 | PerfCycleWizard | inline → WizardShell |

### 컨벤션 정합

- step indicator: proto `wz-step` 패턴 + 완료/현재/대기 3 status
- footer: 이전/다음 button + step counter (`{current+1} / {total} 단계`)
- progress: step indicator visual로 갈음 (별도 progress bar 0)
- cancel: 상단 close icon + footer cancel button + ESC 키
- 데모 한계 배너: batch 04 N+21 `<DemoLimitBanner>` SSOT cross-ref (위저드 4종 정합)

---

## §3. 의존성

### Cross-batch 선행 의존
- **batch 04 N+21 `<DemoLimitBanner>` SSOT** — 위저드 완료 step 데모 한계 배너
- **batch 05 N+24 PageHeader SSOT** — 동일 cross-batch SSOT 패턴 정합

### 선행/합본 게이트 결정
- **N+27 (RestructureModal 재작업)** 와 합본 진입 권고:
  - **(A) SSOT 선행 + N+27 합본 PR**: WizardShell 신설 PR 1 + RestructureModal reskin PR 1 (Restructure 만 1순위 마이그레이션)
  - **(B) SSOT + 4 위저드 일괄 PR**: 단일 대형 PR (scope 비대 위험)
  - **(C) SSOT 단독 + 4 위저드 점진**: SSOT PR 1 + 4 위저드 각 PR (총 5 PR, 안전)
  - **추천**: **C** (점진 마이그레이션, 회귀 위험 최소화)

### Cross-batch SSOT 가용성
- WizardShell → 4 위저드 + future 신규 위저드 (예: 직원 경력 등록 위저드, batch 06)
- DemoLimitBanner (batch 04 N+21) → WizardShell footer 통합 가능

---

## §4. 다음 액션

1. **Stage 1 P0 audit** (별도 turn)
   - 4 위저드 inline 패턴 inventory (각 위저드 step / footer / progress / cancel 정합)
   - WizardShell SSOT API 결정 (props spec finalize)
2. **SSOT 컴포넌트 design**
   - Radix Dialog 기반 vs custom modal
   - step indicator 시각 (가로 vs 세로)
   - footer 커스텀 가능성 (default + override)
3. **마이그레이션 우선순위 결정**
   - 옵션 A/B/C 게이트 (가디언 사전 권고 = C)
4. **Stage 2 카드 별도 작성** (batch 09 audit card)
5. **Stage 3 게이트 + Stage 4 pre-flight + implementation**

---

## §5. 가드

- ❌ **N+27 (RestructureModal) implementation 단독 진입 금지** (SSOT 합본 또는 선행 필수)
- ❌ WizardShell 신설 후 4 위저드 inline 패턴 신규 도입 금지 (SSOT only)
- ❌ Radix Dialog 시그니처 변경 금지 (다른 modal surface 회귀 위험)
- ❌ DemoLimitBanner SSOT 결렬 금지 (batch 04 N+21 정합)
- ✅ cross-batch SSOT 정합 (N+24 PageHeader 패턴 + N+21 DemoLimitBanner 패턴)
- ✅ Radix Dialog 기반 (a11y + focus trap 무료)
- ✅ Storybook entry (가능 시)

---

## §6. RECORD 번호 reserve

본 batch는 SSOT + 4 위저드 점진 마이그레이션. **N+48~** reserve (batch 08 N+43~N+47 사용 후).

예상 RECORD inventory (Stage 2 audit 후 확정):
- N+48: WizardShell SSOT 신설 (~150 lines + DemoLimitBanner 통합) [HIGH]
- N+49: OrgRestructureWizard → WizardShell 마이그레이션 (batch 05 N+27 동반) [HIGH]
- N+50: HireWorkerWizard → WizardShell [MEDIUM]
- N+51: JobPostingWizard → WizardShell [MEDIUM]
- N+52: PerfCycleWizard → WizardShell [MEDIUM]
- N+53: 위저드 컨벤션 SSOT 문서 (`docs/wizards.md` 신설) [LOW]
- (Stage 2 audit 시 추가)

---

## §7. cross-batch 영향 매트릭스

| 영향 받는 batch | RECORD | 영향 내용 |
|---|---|---|
| batch 04 (EmployeeNewClient) | N+50 | HireWorkerWizard 마이그레이션 |
| batch 04 N+21 (DemoLimitBanner) | N+48 | WizardShell footer 통합 |
| batch 05 N+27 (RestructureModal) | N+49 | OrgRestructureWizard 마이그레이션 (선행/합본) |
| batch 07 (배제) | — | 온보딩/오프보딩 = 위저드 아님, 영향 0 |
| 향후 batch 06 (직원 경력 등록 위저드) | (future) | WizardShell 즉시 활용 |

---

**상태**: ACTIVE — Stage 1 P0 audit done (`9289a792`) + Stage 2 카드 done + Stage 3 게이트 통과 (가디언 default, 사용자 결재 skip)
**다음 갱신**: Stage 4 pre-flight 별도 turn

## §6. 진행 이력

| Stage | 일자 | Commit | 산출물 |
|---|---|---|---|
| 격상 결정 | 2026-05-21 | `dad5386b` | inventory (본 파일) |
| Stage 1 P0 audit | 2026-05-21 | `9289a792` | `09-wizardshell-ssot-stage1.md` (5 wizard inventory + 14 findings + Q1-Q6 사전 의제) ⚠️ BulkUploadWizard 추가 발견 |
| Stage 2 카드 + Stage 3 게이트 + RECORD 사양화 | 2026-05-21 | (this commit) | `09-wizardshell-ssot.md` (Stage 2 본문 + Q1-Q6 결정 + N+48~N+53 plan body) |
| Stage 4 pre-flight | (예정) | — | `stage4-preflight/n48~n53-*.md` |
| Stage 4 implementation | (예정, PR-5A 머지 후) | — | 6 PR (점진 마이그레이션, N+50 = batch 05 N+27 분리 PR) |

## §7. Q6 결정 (BulkUploadWizard 포함)

Stage 1 audit 에서 BulkUploadWizard (codebase only B2 era) 추가 발견 → 격상 scope 정정.
Stage 3 게이트 통과 시 Q6=A 채택: 5번째 wizard SSOT 적용 (batch 05 Q6 패턴 정합 — codebase only 기능 전수 유지).
