# N+27 Pre-flight — RestructureModal WizardShell 형태 정합 (OG-002 + X2 + Q2=A) ⭐ critical path

> **base SHA**: `ac243446` · **트랙**: codebase (최대 변경) · **우선**: HIGH
> **결정 (Stage 3 Q2=A)**: proto WizardShell full-screen 채택, RestructureModal을 WizardShell SSOT로 형태 정합 (코드가 이미 centered-overlay wizard라 drawer 재작업은 무의미 — 아래 정정 박스 참조). 위저드 4종 (Hire/Job/PerfCycle/Org) 패턴 SSOT 정합 (정합성 우선 결정).
> **본 pre-flight 결과 (요약)**: ✅ **schema migration 불필요** (Json free-form 사용). TypeScript ChangeType union 매핑만 정리.

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

### ⭐ Prisma enum 검증 (CRITICAL — 가디언 사전 가정 검증 결과)

**가디언 사전 가정**: "N+27 = UI 변경, schema 무관" — batch 04 N+18 패턴 (DB 무관 정정 발생) 같은 위험 catch 목적.

**검증 결과**: ✅ **schema migration 불필요**

```prisma
// prisma/schema.prisma:1281-1300
model OrgRestructurePlan {
  id            String    @id @default(uuid())
  companyId     String    @map("company_id")
  title         String    @db.VarChar(200)
  description   String?   @db.Text
  effectiveDate DateTime  @map("effective_date") @db.Date
  status        String    @default("draft") @db.VarChar(20)
  changes       Json     ← free-form JSON, action enum 부재
  createdById   String    @map("created_by")
  ...
}
```

**근거**:
- `OrgRestructurePlan.changes` = `Json` 자유 형식. 6 changeType 또는 어느 ChangeType이든 JSON 구조로 저장 가능
- `action` enum 또는 별도 enum 컬럼 부재 → 추가/제거 시 schema migration 불필요
- 코드 레벨 `ChangeType` TypeScript union (`src/components/org/RestructureModal.tsx:19-26`)이 실 enum 역할

### ChangeType 매핑 (proto vs codebase) — 정합성 검증

**Proto 6 changeType** (`_design-reference/wizards.jsx:637-644`):
```js
types = [
  { id: "merge",   title: "부서 통합" },
  { id: "split",   title: "부서 분리" },
  { id: "new",     title: "부서 신설" },
  { id: "move",    title: "부서 이동" },
  { id: "close",   title: "부서 폐지" },
  { id: "rename",  title: "부서 명칭 변경" },
]
```

**Codebase 6 ChangeType** (`src/components/org/RestructureModal.tsx:19-26 + CHANGE_TYPE_LABELS:79-86`):
```ts
type ChangeType =
  | 'create'              // "부서 신설"     ← proto "new"
  | 'move'                // "부서 이동"     ← proto "move"
  | 'merge'               // "부서 통합"     ← proto "merge"
  | 'rename'              // "부서 명칭 변경" ← proto "rename"
  | 'close'               // "부서 폐지"     ← proto "close"
  | 'transfer_employee'   // "인원 이동"     ← proto 부재 (codebase only)
```

| proto changeType | codebase ChangeType | 상태 |
|---|---|---|
| merge | merge | ✅ |
| split | (부재) | ❌ **proto only — codebase union에 추가 필요** |
| new | create | ⚠️ 라벨/키 차이, 의미 동일 |
| move | move | ✅ |
| close | close | ✅ |
| rename | rename | ✅ |
| (부재) | transfer_employee | ✅ **codebase only — 추가 기능, 유지** |

### 코드베이스 RestructureModal 구조

**파일**: `src/components/org/RestructureModal.tsx` (676 lines)
**현재 패턴**: ✅ **이미 centered-overlay 3-step wizard** — root = `MODAL_STYLES.container` (`fixed inset-0 flex items-center justify-center`, `src/lib/styles/modal.ts:3`), Step 타입 `'edit'|'diff'|'confirm'` (L365), custom StepIndicator (L367), inline footer 이전/다음/취소/즉시적용 (L631-672). WizardShell import 없음. drawer/Sheet 아님.
**주요 컴포넌트**:
- `ChangeType` union (6종)
- `CHANGE_TYPE_LABELS` (한국어 literal 6건 — i18n 미적용)
- `CHANGE_TYPE_COLORS` (Tailwind hex tinted, 6 variant)
- `OrgChange` interface (각 ChangeType별 데이터 필드)
- `ChangeEditor` (per-change row editor)
- 한 모달 안에서 changes[] 배열 관리 (proto의 단일 changeType 위저드와 다름)

**proto와 핵심 차이**:
- proto = **단일** changeType 위저드 (한 번에 1개 변경)
- codebase = **다중** changes 배열 편집기 (한 번에 N개 변경 그룹)

**→ 정합성 해석** (정정 후):
- 코드가 **이미 centered-overlay wizard** 이므로 "drawer → full-screen wizard 재작업" 은 무의미. 남은 작업은 **N+48 WizardShell SSOT(`src/components/shared/WizardShell.tsx`)로의 형태 정합** (N+50 wrap) 뿐:
  - **순수 형태 정합** (자체 StepIndicator/inline footer → WizardShell 12 props) — N+27 charter A
  - **데이터 모델은 불변** (다중 changes[] 유지)
- **권고**: 다중 changes[] 데이터 모델은 **유지** (production 실수요). WizardShell wrap 시에도 그 안에 다중 ChangeEditor 배치 (proto의 단일 위저드와는 데이터 모델 차이 명시)

### WizardShell SSOT

**정정**: WizardShell SSOT는 **이미 존재** — N+48이 `src/components/shared/WizardShell.tsx` 에 신설·머지 (PR #83, `90c88ac1`). `src/components/wizards/` 경로는 존재하지 않으며, N+27이 자체 신설한다는 계획은 superseded.

- codebase에 WizardShell SSOT **존재** (`src/components/shared/WizardShell.tsx`, 12 props, Radix Dialog + pure helpers) → **신규 신설 불필요**
- N+50이 RestructureModal을 이 SSOT로 wrap (N+49 HireWorker #85 모델). N+27은 wrap에 흡수되는 순수 형태 정합(charter A)

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 핵심 변경

| 파일 | 변경 | line delta |
|---|---|---|
| `src/components/shared/WizardShell.tsx` | **재사용** (N+48 신설·머지 #83) — 신규 신설 불필요 | 0 |
| `src/components/org/RestructureModal.tsx` | 자체 StepIndicator/inline footer → WizardShell wrap (N+50, string-union step → numeric currentStep 매핑 + dual-action custom footer) | +50 / -80 |
| ⟂ `ChangeType` union 확장 **(별도 feature 트랙 — N+50 wrap scope 외)** | `'split'` 추가, 'create' ↔ 'new' 라벨 정합 결정 | +5 |
| ⟂ i18n 6 changeType 라벨 **(별도 feature 트랙 — N+50 wrap scope 외)** | `CHANGE_TYPE_LABELS` 한국어 literal → i18n 키 (5 locale) | -10 in src + 30 i18n entries |
| `src/app/(dashboard)/org/OrgClient.tsx` | RestructureModal invoke 패턴 미변경 (caller 동일) | ~0 |

### (b) 4 step 구조 (proto 정합)

| Step | 내용 | codebase 적용 |
|---|---|---|
| 1 | 변경 유형 선택 (6 changeType button grid) | ChangeEditor type select 그대로 활용 + button grid UI 보강 |
| 2 | 변경 내용 입력 (changeType별 필드) | ChangeEditor per-type fields 재사용 |
| 3 | 영향 분석 (`RestructureDiffView` 활용) | 기존 컴포넌트 SSOT 재사용 |
| 4 | 결재선 지정 + 제출 | 신규 — `ApprovalFlow` 컴포넌트 재사용 검토 |

### (c) Modal 컨테이너 패턴

```tsx
<WizardShell
  title="조직 개편"
  description="부서 구조 변경을 단계별로 정의하고 결재선을 지정해요."
  steps={['변경 유형', '변경 내용', '영향 분석', '결재선']}
  currentStep={step}
  onCancel={onClose}
  footer={
    <NavButtons step={step} totalSteps={4} onNext={next} onPrev={prev} onSubmit={submit} />
  }
>
  {/* Step별 content */}
</WizardShell>
```

### (d) 예상 총 line delta

- WizardShell SSOT: 0 (N+48 #83 재사용, 신설 불필요)
- **N+50 wrap scope (순수 형태 정합)**: RestructureModal `+50 / -80 = net -30` + OrgClient invoke 미변경 `~0`. i18n/ChangeType 무관.
- **별도 feature 트랙 (N+50 wrap scope 외, 각 독립 진입)**: `ChangeType 'split'` 확장 `+5` / `CHANGE_TYPE_LABELS` i18n `30 entries` / N+30 mapping layer
- **순 총합**: N+50 wrap = **net -30** (형태 정합, 본 트랙) · feature 트랙 = `+5 + 30 i18n` (별도)

---

## §3. i18n / DB / API 영향 평가

### ⭐ DB 영향 — schema migration 불필요 (CRITICAL 확정)
- `changes Json` 자유 형식, 어떤 ChangeType이든 저장 가능
- 'split' 신규 추가 시도 schema 무관 (코드 union만 확장)
- **결론**: **비상 분기 트리거 안 됨** — N+27 단독 진행 가능, schema migration PR 의존성 0

### i18n
- 6 changeType 라벨 5 locale = 30 entries
- 4 step 라벨 5 locale = 20 entries
- 위저드 sub copy / 결재선 라벨 5 locale = ~20 entries
- **총 ~70 entries**

### API
- 변경 0 (POST `/api/v1/org/restructure-plans` 기존 schema 유지)
- `changes Json` payload 구조: 코드베이스 ChangeType 정합만 보장

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (HIGH)**: 데이터 모델 차이 — proto는 1 change per wizard, codebase는 N changes per modal. UX 결정 필요:
  - (a) 단일 changeType wizard로 단순화 (codebase 다중 기능 손실)
  - (b) WizardShell + 다중 ChangeEditor (codebase 모델 유지, proto 시각만)
  - **추천**: (b) — production 다중 변경 실수요 유지
- **R2 (LOW, 해소)**: WizardShell SSOT는 N+48 #83에서 기 신설·머지 — cross-batch 신설 리스크 없음. 각 위저드(Hire/Job/PerfCycle/Restructure)는 consumer-side wrap을 독립 진행 (N+49 HireWorker #85 = 첫 consumer)
- **R3 (LOW)**: proto 'split' (부서 분리) 추가 — codebase에 없는 기능. data model + UI 신규 (~40 lines)

### 의존성
- **PR-5A 머지** 후 진입
- **N+27 선행 의존 없음** — 코드가 이미 wizard라 drawer 회귀 불가. N+27 구조작업 불필요, N+50은 순수 WizardShell wrap으로 독립 진입 가능 (N+49 #85 모델)
- **N+30 (mapping layer)·`split` changeType·`CHANGE_TYPE_LABELS` i18n 추출은 별도 feature 트랙으로 재분류** — N+50 형태 정합의 선행 아님
- WizardShell SSOT는 N+48 #83에서 이미 신설·머지 — 신설/trade-off 게이트 불필요

### 가드
- ❌ `OrgRestructurePlan` schema 변경 금지 (Json free-form 정합)
- ❌ `transfer_employee` ChangeType 제거 금지 (production 기능)
- ❌ `RestructureDiffView` 재사용 (별도 컴포넌트 신설 금지)
- ✅ N+48 WizardShell SSOT (`src/components/shared/WizardShell.tsx`) 재사용 — 신규 신설 금지
- ✅ ChangeType union 'split' 추가·i18n·ChangeEditor 분기는 별도 feature 트랙 (N+50 형태 정합과 분리)

---

## §5. Implementation 단계 (PR-5A 머지 후)

1. **사전 합의 게이트**:
   - 데이터 모델 결정: 단일 vs 다중 changes[] (추천 = 다중 유지)
   - (WizardShell SSOT는 N+48 #83 기 신설 — 게이트 불필요. 'split' ChangeType·i18n 추출은 별도 feature 트랙으로 분리)
2. **선행 의존 없음**: N+30 mapping layer·'split'·i18n 추출은 별도 feature 트랙 (N+50 형태 정합과 독립). N+50은 N+27 머지 의존 없이 바로 진입 가능
3. **branch**: `feat/org-restructure-wizard-wrap` (N+50)
4. **commit 1 (WizardShell SSOT)**:
   - 신설 불필요 — `src/components/shared/WizardShell.tsx` (N+48 #83) 재사용
5. **commit 2 (RestructureModal WizardShell wrap, N+50)**:
   - 자체 StepIndicator/inline footer → WizardShell 적용
   - string-union step (`'edit'|'diff'|'confirm'`) → numeric `currentStep` 매핑
   - dual-action(저장 초안 `handleSaveDraft` / 즉시 적용 `handleApplyNow`) custom footer
   - ChangeEditor 재사용 (per-type fields, 다중 changes[] 모델 유지)
   - (caller state 유지 — N+49 #85 모델)
8. **e2e**: `e2e/flows/restructure-wizard.spec.ts` — 6 (or 7) changeType 각각 4 step 통과 + 영향 분석 + 결재선 + 제출 + toast
9. **gstack 시각**: full-screen 모달 라이트/모바일 (다크 known-deferred)
10. **codex Gate 1+2**: 표준
11. **PR open**: `feat/org-restructure-wizard-wrap` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error (ChangeType union 정합)
- ✅ **lint**: clean
- ✅ **e2e**: 6+ changeType × 4 step × toast + onComplete 시나리오
- ✅ **시각 회귀**: full-screen 모달 라이트 PASS, 모바일 reflow PASS, 다크 = Phase 4 known-deferred
- ✅ **회귀 0**: 기존 `/api/v1/org/restructure-plans` 응답 schema 무변동, B3I matrix unaffected
- ✅ **데이터 정합**: 다중 changes[] 그룹 제출 → DB Json 정합 유지

---

## §7. 비상 분기 결과 (가디언 사전 가정 검증)

**가디언 가정**: "schema 무관, UI 변경 only"

**CC 검증 결과**: ✅ **가정 정합** (batch 04 N+18 같은 정정 발생 안 함)

근거:
1. `OrgRestructurePlan.changes` = `Json` 자유 형식 → ChangeType 추가/제거 시 schema migration 0
2. 코드 union (TypeScript) 확장만 ~5 lines + i18n
3. 'split' 추가는 free-form Json 안에 새 type field로 저장 가능

→ **비상 분기 트리거 안 됨**. N+27 단독 PR 진행 가능 (schema migration PR 의존성 0). batch 06 격상 후보 신설 불필요.

---

## §8. 별도 트랙 후보

- **WizardShell SSOT cross-batch 공통화**: SSOT는 N+48 #83에서 기 신설 (`src/components/shared/WizardShell.tsx`). Hire/Job/PerfCycle/Restructure 4 위저드의 consumer-side wrap을 순차 진행 (N+49 HireWorker #85 = 첫 consumer, N+50 = Restructure)
- **'split' ChangeType 추가의 production 실수요 검증**: 사용자 실 사용 패턴 (proto 6종 vs codebase 6종 중 'transfer_employee' vs 'split' 선호도) — 사용자 결정 필요

---

**상태**: pre-flight 완료 (CRITICAL 비상 분기 검증 완료, 정합)
**Stage 4 예상 PR 크기**: 3-4 commits, +130 lines + 70 i18n entries, 5-6 file diff
