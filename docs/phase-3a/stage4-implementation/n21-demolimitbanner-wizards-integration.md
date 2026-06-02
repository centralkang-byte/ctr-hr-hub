# N+21 후속 — wizards.jsx 4 위저드 DemoLimitBanner 통합 (acceptance 충족)

> **base SHA**: `d868be4d` (main, PR-5A #63 머지 직후)
> **선행 PR**: [#64](https://github.com/centralkang-byte/ctr-hr-hub/pull/64) (`fde915ef`, SSOT 신설 — DemoLimitBanner `_design-reference/ui.jsx`)
> **본 PR**: `feat/n21-demo-limit-banner-wizards`
> **작성일**: 2026-05-22 KST (Session 230)
> **선행 audit**: [phase-a-entry-audit.md §6 + §9](./phase-a-entry-audit.md) (`80a87ba2`)

---

## §1. 4 위저드 정확한 list + 통합 위치

### 1.1 4 위저드 (사양 본문 인용)

`docs/phase-3a/batch-cards/04-employees.md` §7 N+21 본문 + Q4 정합성 grep 증거:

```js
HireWorker:        toast(`${f.nameKo} 신규 등록 완료`); onComplete();
JobPosting:        toast(`${f.title} 공고 등록`);       onComplete();
PerfCycle:         toast(`${f.name} 사이클 생성`);      onComplete();
OrgRestructure:    toast("조직 개편 결재 요청 완료");      onComplete();
```

| # | 위저드 | 함수 위치 (wizards.jsx) | 마지막 step | submit 라인 |
|---|---|---|---|---|
| 1 | `HireWorkerWizard` | L55 | step 5 (L233) | L70 |
| 2 | `JobPostingWizard` | L270 | step 4 (L408) | L283 |
| 3 | `PerfCycleWizard` | L440 | step 4 (L584) | L452 |
| 4 | `OrgRestructureWizard` | L622 | step 4 (L805) | L635 |

### 1.2 통합 위치 — section 마지막 child (4 위저드 동일)

**사양 명시** (batch 04 §7 N+21):
> 4 위저드 완료 화면 (`wizards.jsx`) 토스트 호출 직전/직후에 배너 1줄 노출

**해석**: "완료 화면" = 위저드 마지막 step (검토 step). "토스트 호출 직전" = submit() 클릭 직전 = 사용자가 review 정보 확인 후 마지막 인지 시점.

**위치 채택**: 각 위저드 마지막 step `<div className="wz-section">` 안 **section 마지막 child** (review grid 또는 accent box 다음).

**4 위저드 동일 패턴**:
- HireWorker step 5 → grid + 기존 accent box(등록 완료 시...) 다음에 `<DemoLimitBanner />` (L258)
- JobPosting step 4 → grid 다음 (`<DemoLimitBanner />` = section 마지막 child) (L429)
- PerfCycle step 4 → grid 다음 (`<DemoLimitBanner />` = section 마지막 child) (L610)
- OrgRestructure step 4 → grid 다음 (`<DemoLimitBanner />` = section 마지막 child) (L826)

**대안 검토**:
- (A) `<h3>` 직후 (section 시작) — review 정보 위에 배너. 거부: review 정보 인지 → 마지막에 한계 인지 UX flow가 자연
- (B) wizard wrapper level (모든 step persist) — 첫 step부터 배너 노출. 거부: 사양 "완료 화면 토스트 호출 직전/직후" 명시 위반
- **(C) section 마지막 child** ⭐ — 채택 (사양 정합 + 4 위저드 통일)

---

## §2. 동일 패턴 단언 (props / 위치 / copy)

| 항목 | 4 위저드 통일 |
|---|---|
| 컴포넌트 호출 | `<DemoLimitBanner />` (props 없음 — 모두 default copy 사용) |
| 위치 | section 마지막 child |
| 들여쓰기 | 10 spaces (review grid `</div>`와 동일 indent) |
| 기타 props (icon/className/style) | 없음 (모두 default) |
| copy | default `"데모 화면이라 새로고침하면 입력한 내용이 사라져요."` — PR #64 SSOT 단일 source |

**SSOT 의존**: PR #64이 `_design-reference/ui.jsx`에 `<DemoLimitBanner>` 신설 + `Object.assign(window, {..., DemoLimitBanner, ...})` 로 global export. 본 PR은 global namespace에서 참조.

---

## §3. Verification 결과

| 가드 | 결과 |
|---|---|
| `git diff src/` empty | ✅ src/ touched 0 |
| `git diff messages/` empty | ✅ messages/ touched 0 |
| `git diff _design-reference/ui.jsx` empty | ✅ ui.jsx 미터치 (PR #64 SSOT 단일 source 유지) |
| wizards.jsx 4 위저드 동일 패턴 | ✅ L258/L429/L610/L826 동일 `<DemoLimitBanner />` |
| 다른 `_design-reference/` 파일 미터치 | ✅ wizards.jsx 1 파일 변경 |
| feature branch + PR open | ⏳ 본 commit 직후 진행 |
| PR #64과 충돌 | ✅ 0 (다른 파일: ui.jsx vs wizards.jsx) |

**diff 규모**: 4 위저드 × 1 line `<DemoLimitBanner />` = **+4 lines** (wizards.jsx) + 본 보고서.

---

## §4. acceptance 충족 단언

batch 04 §7 N+21 **수락 기준** (`docs/phase-3a/batch-cards/04-employees.md` L364-368):

> - 4 위저드 완료 화면 모두 동일 배너 컴포넌트 호출 ✅
> - 배너 디자인 inline 0건 (SSOT만) ✅ (`<DemoLimitBanner />` 호출만, inline 디자인 0)
> - **Hire 단독 persist 시도 0** (정합성 가드) ✅ (4 위저드 동일 패턴, persist/auto-navigate 추가 0)
> - 토스트 + 배너 + onComplete() 패턴 4종 모두 정합 ✅ (배너 = review step JSX, 토스트 + onComplete = submit() 함수 미변경)

**Phase A acceptance ⭐ 충족** — PR #64 SSOT 신설 + 본 PR consumer 통합 = N+21 RECORD 완료.

### 머지 순서 권고

1. PR #64 (SSOT 신설) 먼저 머지 → `<DemoLimitBanner>` `_design-reference/ui.jsx` 등록
2. 본 PR (consumer 통합) 머지 → 4 위저드 `<DemoLimitBanner />` 호출 활성

**runtime 검증**: PR #64 머지 안 된 상태에서 본 PR 단독 머지 시 `_design-reference/ui.jsx`에 `<DemoLimitBanner>` 없음 → browser proto 런타임 에러. **PR #64 우선 머지 필수**.

---

## §5. Out of scope (별도 트랙)

- **N+49 codebase consumer migration** (Phase D, audit §9.5 정합) — `src/components/employees/Hire*` 등 codebase wizard 측 `<DemoLimitBanner>` mirror 신설 + 5 locale i18n + vitest
- **N+19 진입** (PR #64 + 본 PR 머지 후) — data.js 5 SSOT 키 보강
- **batch-cards/README + stage4-preflight/README RECORD count inconsistency 정정** (별도 turn)

---

**상태**: ACTIVE (본 commit 직후 PR open)
**다음 갱신**: PR 머지 후 phase3a-audit 브랜치 N+21 entry "DONE (PR #64 + 본 PR)" mark
**책임 단언**: 본 PR이 N+21 acceptance (4 위저드 동일 배너)의 SSOT 적용. PR #64 + 본 PR 합본이 N+21 RECORD 완료.
