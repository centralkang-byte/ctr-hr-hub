# N+21 Implementation — DemoLimitBanner SSOT 신설 (Phase A 카나리 ⭐)

> **base SHA**: `d868be4d` (main, PR-5A #63 머지 직후)
> **작성일**: 2026-05-22 KST (Session 230)
> **트랙**: Phase 3a Stage 4 implementation Phase A 첫 PR
> **분류**: proto only SSOT (codebase mutation 0)
> **선행 audit**: [Phase A entry audit `180aceb1`](../stage4-implementation/phase-a-entry-audit.md) §6 권고 1순위
> **본래 spec**: [batch 04 §7 N+21](../batch-cards/04-employees.md#n21)

---

## §1. 결정 요약

`_design-reference/ui.jsx` 에 `<DemoLimitBanner>` SSOT 컴포넌트 신설. 위저드 4종(Hire/JobPosting/PerfCycle/OrgRestructure) 완료 화면 cross-batch consumer 진입의 upstream SSOT.

**Phase A 분류 정합 가드**:
- ✅ `_design-reference/ui.jsx` 1 파일 + 본 보고서 1 파일 = **2 files diff**
- ✅ `src/` 변경 0 (Phase A "Pure proto only" 정의 정합)
- ✅ `messages/` 변경 0 (한국어 hardcoded — proto 패턴 정합)
- ✅ vitest / Storybook / axe-core 신규 0 (proto 패턴 정합)

---

## §2. API surface

```jsx
<DemoLimitBanner
  icon={Icons.Alert}     // optional — default Icons.Alert
  message="..."          // optional — default 데모 한계 카피
  className=""           // optional — additional class
  style={{}}             // optional — inline style override
/>
```

### Props

| prop | type | default | 용도 |
|---|---|---|---|
| `icon` | `(p) => ReactNode` | `Icons.Alert` | leading icon 컴포넌트 reference (proto Icons table 참조) |
| `message` | `string` | `"데모 화면이라 새로고침하면 입력한 내용이 사라져요."` | 본문 카피, 친근 톤 (CLAUDE.md 정합) |
| `className` | `string` | `""` | 추가 CSS class — 위저드별 카피 색조 변형 옵션 |
| `style` | `object` | `undefined` | inline style override |

### a11y baseline

- `role="status"` — 스크린리더에 정보성 영역으로 anonounce
- `aria-live="polite"` — 위저드 step 진입 시 자연스러운 안내 announce (interruption 회피)
- icon SVG는 `<Ico>` 패턴이 `aria-hidden="true"` 자동 부여 (장식 SVG)

---

## §3. proto 패턴 정합 근거

본 컴포넌트가 따른 기존 `_design-reference/ui.jsx` 패턴:

| 패턴 항목 | 적용 근거 | 비교 대상 |
|---|---|---|
| Function declaration + props destructure | `function DemoLimitBanner({ icon: IconCmp = Icons.Alert, message = ..., className = "", style }) {...}` | `EmptyState` L217 동일 패턴 |
| className 합성 (`.trim()`) | `const cls = \`demo-limit-banner ${className}\`.trim();` | `EmptyState` L219 동일 패턴 |
| 기본 icon = Icons table reference | `icon: IconCmp = Icons.Alert` (default fallback) | `EmptyState` L217 `icon: IconCmp = Icons.EmptyBox` 동일 |
| Object.assign(window, {...}) 글로벌 export | `Object.assign(window, { ..., DemoLimitBanner, ... });` (L231) | 기존 SSOT 컴포넌트 등록 패턴 (Card / Sparkline / EmptyState 등) |
| 한국어 hardcoded copy | "데모 화면이라 새로고침하면 입력한 내용이 사라져요." | EmptyState 예시 카피 "결과가 없어요" 등 동일 톤 |
| CSS class string (`demo-limit-banner`) | hyphen-cased BEM | `empty` / `card` / `card-head` / `em-title` 등 동일 표기 |

**a11y 강화**: 기존 SSOT (EmptyState 등) 보다 `role="status"` + `aria-live="polite"` 명시 추가 — 본 컴포넌트가 **상태 안내 영역** (decorative 아님)이라 정량적 a11y 보강.

---

## §4. 다음 단계 (out of scope)

본 PR scope는 **SSOT 신설만**. 후속 작업은 별도 PR/트랙.

### 4.1 proto 측 후속 (별도 PR — batch 04 §7 N+21 acceptance 충족)

`_design-reference/wizards.jsx` 4 위저드 완료 step 에 `<DemoLimitBanner />` 호출 추가:

```jsx
// HireWorkerWizard onComplete
<DemoLimitBanner />
toast(`${f.nameKo} 신규 등록 완료`);
onComplete();
```

대상 4 위저드 (정합성 grep 검증 후 추가):
- HireWorkerWizard (직원 등록)
- JobPostingWizard (채용 공고 등록)
- PerfCycleWizard (평가 사이클 생성)
- OrgRestructureWizard (조직 개편)

**acceptance 기준**: 4 위저드 완료 화면 모두 동일 배너 컴포넌트 호출. 인라인 0건.

### 4.2 codebase 측 (Phase D — 별도 트랙)

[N+49 HireWorker codebase migration](../stage4-preflight/n49-hire-wizard-migration.md) 진입 시:
- `src/components/ui/DemoLimitBanner.tsx` codebase SSOT mirror 신설 (또는 단순 `<Alert>` 패턴 활용)
- 5 locale i18n (`banner.demo.*` 키)
- vitest + axe-core
- 4 codebase wizard consumer 통합

본 proto SSOT는 codebase SSOT 측의 디자인 spec 참조용 SSOT 역할.

---

## §5. Verification 결과 (선행 가드 검증)

| 가드 | 결과 |
|---|---|
| `git diff src/` empty | ✅ src/ touched 0 |
| `git diff messages/` empty | ✅ messages/ touched 0 |
| `_design-reference/ui.jsx` diff scope | ✅ EmptyState 다음 + Object.assign export 라인만 |
| proto 기존 컴포넌트 패턴 정합 | ✅ EmptyState 패턴과 1:1 정합 (function decl / props default / className `.trim()` / Object.assign export) |
| 한국어 hardcoded copy (i18n 미사용) | ✅ "데모 화면이라 새로고침하면 입력한 내용이 사라져요." (CLAUDE.md 친근 톤 정합) |
| a11y baseline | ✅ `role="status"` + `aria-live="polite"` 명시. SVG `aria-hidden` (Ico 패턴) |
| vitest / Storybook / axe-core 신규 0 | ✅ proto 측 인프라 부재 — 신규 추가 0 (사양서 가드 정합) |
| feature branch + PR open | ⏳ 본 commit 직후 진행 |

---

## §6. 결정 책임 단언

- 본 PR은 **Phase A entry audit `180aceb1` §6 권고 1순위** 정합.
- batch 04 §7 N+21 본래 spec의 "SSOT 신설" 부분 (~20 LOC) 만 본 PR이 흡수, "4 위저드 통합" 부분 (~4 LOC × 4)은 별도 PR.
- N+21 RECORD 번호는 본 PR 머지 후 phase3a-audit 브랜치에서 "implementation 완료" 상태 update 별도 turn.

---

**상태**: ACTIVE (본 PR commit 직후 open)
**다음 갱신**: PR merge 후 phase3a-audit 브랜치 N+21 entry "DONE" mark
