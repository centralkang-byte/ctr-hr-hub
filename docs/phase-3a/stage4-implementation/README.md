# Phase 3a · Stage 4 Implementation 인덱스

> **base SHA**: `a147d919` (Stage 4 pre-flight 종결 직후)
> **작성일**: 2026-05-22 KST (Session 230 — PR-4/PR-5A 머지 직후)
> **트랙**: Phase 3a Stage 4 implementation 진입 (proto + codebase 적용)
> **상태**: ACTIVE — Phase A entry audit 작성 (첫 PR 후보 사전 평가)

---

> **⚠️ 정정 (Session 235, 2026-05-29 — 6-agent workflow 코드 검증 + Codex Gate 1 HIGH 반영)**
> 본 문서의 N+27/N+50 전제가 실제 코드와 불일치하여 정정합니다 (기존 결정 배경은 아래 본문에 보존):
> - **`src/components/org/RestructureModal.tsx` 는 drawer가 아니라 이미 centered-overlay 3-step wizard** (Step 타입 `'edit'|'diff'|'confirm'`, custom StepIndicator, inline footer, `MODAL_STYLES.container`). "drawer → full-screen wizard 재작업" 전제는 코드상 무의미.
> - **WizardShell SSOT는 N+48이 `src/components/shared/WizardShell.tsx` 에 신설·머지(#83 `90c88ac1`)** — N+27이 `src/components/wizards/` 에 자체 신설한다는 계획은 superseded.
> - **N+27 charter = A (순수 형태 정합, 거의 no-op → N+50 WizardShell wrap에 흡수)**. 기능 항목(`split` changeType / `CHANGE_TYPE_LABELS` i18n 추출 / N+30 mapping layer)은 폐기가 아니라 **별도 feature 트랙으로 재분류**.
> - 따라서 **N+50은 N+27 머지 의존 없이 순수 WizardShell wrap으로 진입 가능** (N+49 #85 모델). 실제 작업 = string-union step → numeric currentStep 매핑 + dual-action(저장 초안/즉시 적용) custom footer.
> 근거: workflow 판정 insufficient-evidence → 코드 검증 (RestructureModal.tsx:365/367/631-672, modal.ts:3), Codex Gate 1 HIGH(수정 범위) 반영. 정정 트랙 = `docs/n27-n50-drift-fix`.

---

## §0. 진입 조건 (Session 230 기준)

- ✅ **PR-4 #62 MERGED** (`37b68e77`, 2026-05-22 01:56 UTC) — AT-005 카나리 main 도착
- ✅ **PR-5A #63 MERGED** (`d868be4d`, 2026-05-22 01:59 UTC) — HR Admin Workday 대시보드 main 도착
- ✅ **Stage 4 pre-flight 종결** — 6 batch × 29 RECORD codebase + 8 proto only (cross-batch)
- ➡️ **implementation 진입 가능** (PR-5A 의존 해소)

---

## §1. 작업물 인덱스

| 문서 | 트랙 | 작성일 | 상태 |
|---|---|---|---|
| [phase-a-entry-audit.md](./phase-a-entry-audit.md) | Phase A 진입 첫 PR 후보 사전 평가 | 2026-05-22 | ACTIVE |

추가 entry audit (Phase B/C/D/E)은 별도 turn에서 합류.

---

## §2. Phase 분류 (본 인덱스 정의)

> 본 인덱스가 Phase 정의의 단일 진실로 작동. 기존 `batch-cards/README.md`(8건/11건) +
> `stage4-preflight/README.md`(8건) 간 카운트 inconsistency를 정정한다.

### Phase A — proto only 카나리 (codebase 0)

진입 조건: 코드베이스 mutation 0, `_design-reference/` 또는 `ui.jsx` 안에서만 변경.

| RECORD | 트랙 | 우선 | 비고 |
|---|---|---|---|
| N+21 | proto SSOT | HIGH | DemoLimitBanner `ui.jsx` 신설 — cross-batch consumer 진입 카나리 |
| N+19 | proto data.js | MED | `data.js` 5 SSOT 키 (mboHistory/praises/education 등) |
| N+20 | proto data.js | MED | 위저드 옵션 5 SSOT (departments/ranks/salaryBands/onboardingTemplates/employmentTypes) |
| N+22 | proto SSOT | MED | `<EmployeeStatusChip>` SSOT (proto `ui.jsx`) |
| N+23 | proto only (재분류) | MED | 코드베이스 작업 0 (Radix Tabs 정합). proto tablist a11y만 |
| N+25 | proto only | MED | view mode 3→4 정렬 (codebase 0) |
| N+28 | proto only | LOW | EffectiveDatePicker visual reskin |
| N+29 | proto only | LOW | zoom controls + opacity highlight |

**Phase A 인벤토리 = 8 RECORD** (사양서 "12 RECORD" 카운트 정정 결과).

### Phase B — SSOT 신설 / codebase 카나리

진입 조건: SSOT 신설 후 cross-batch consumer 진입 전 단독 카나리.

대표 RECORD: N+24 (StatusChips SSOT cross-batch 4 consumer) · N+43 (`useArrowKeyNavigation` hook) · N+48 (WizardShell SSOT) · N+44 (MyTasks/Leave a11y migration)

### Phase C — codebase 적용 (소~중 블라스트)

대표 RECORD: N+17 (`/directory` redirect) · N+26 (DeptFlowNode mine highlight) · N+18 (graceful empty) · N+30 (mapping layer) · N+31 (StatusChips 8 surface) · N+32 (view mode + Hire Card + journey)

### Phase D — codebase 적용 (대 블라스트)

대표 RECORD: N+27 (Restructure 순수 형태 정합 — RestructureModal은 이미 centered-overlay 3-step wizard, charter=A, 거의 no-op → N+50 WizardShell wrap에 흡수) · N+44 (MyTasks/Leave migration 합본) · N+45/N+46 batch 08 합본 PR · N+49/N+50/N+53 batch 09 위저드 migration (N+50은 N+27 머지 의존 없이 WizardShell wrap 독립 진입 가능 — N+49 #85 모델)

### Phase E — 격상 batch 풀스택

대표 RECORD: N+37~N+42 batch 06 (직원 경력 데이터 — Prisma 3 model + API + UI + i18n + 권한)

### DEFERRED

N+51 (RecruitmentJobPosting) · N+52 (Performance cycle) — 옵션 B, wizard 부재 사전 가정 정정 후 별도 트랙

---

## §3. 별도 트랙 cross-link

- **Phase 4 다크 트랙**: F19+F24+F26+EM-019+OG-018+ON-016+N+36 = 7 entry inventory (가디언 합의 미정)
- **batch 07 차순위 §4**: J 알림+업무 / H 인사이트 (Stage 1 audit 대기)
- **batch 10+ 후보**: S3 orphan 정리 · RecruitmentJobPosting wizard (DEFERRED → 격상 후보)

---

## §4. 변경 가드

- ❌ src/ / prisma/ / messages/ 변경 0 (본 인덱스는 docs only)
- ❌ 기존 batch-cards / stage4-preflight 23 파일 미터치
- ❌ 새 RECORD 번호 reserve 0
- ✅ `docs/phase-3a/stage4-implementation/` 신설 후 entry audit 누적
- ✅ `claude/phase3a-audit` 워크트리에서만 commit + origin push

---

**상태**: ACTIVE
**다음 갱신**: Phase A 첫 PR 진입 시 (또는 추가 Phase entry audit 합류 시)
