# N+30 Pre-flight — 4 step + 6 changeType 매핑 layer (OG-010 + X7)

> **base SHA**: `ac243446` · **트랙**: codebase · **우선**: MEDIUM
> **결정 (Stage 3)**: proto 4 step + 6 changeType ↔ codebase `OrgRestructurePlan` 모델 매핑 pure functions 신설
> **본 pre-flight 결과 (요약)**: schema migration 불필요 (N+27 cross-ref), pure functions 단순 매핑 ~80 lines + unit test.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### N+27 cross-ref

N+27 검증 결과 (`n27-restructure-wizard-rework.md`):
- `OrgRestructurePlan.changes` = `Json` free-form
- TypeScript ChangeType union 6종 (`create / move / merge / rename / close / transfer_employee`)
- proto 6 changeType (`merge / split / new / move / close / rename`)

→ **N+30 = 두 set 사이의 양방향 매핑 layer**

### 코드베이스 API endpoint 영향

| endpoint | payload schema | N+30 영향 |
|---|---|---|
| `POST /api/v1/org/restructure-plans` | `{ title, description, effectiveDate, changes: OrgChange[] }` | 0 (Json free-form, ChangeType 확장 시 무변경) |
| `PATCH /api/v1/org/restructure-plans/[id]` | 동일 | 0 |
| `POST /api/v1/org/restructure-plans/[id]/apply` | 0 payload (id만) | 0 |
| `GET /api/v1/org/change-history` | `{ changeType: 'REORGANIZATION' \| 'TRANSFER' \| 'RESTRUCTURE' }` | **별도 enum** (OrgChangeHistory.changeType ≠ OrgChange.type) — 매핑 layer 영향 0 |

### proto 4 step → ChangeType 흐름

```
step 0: 변경 유형 선택      → changeType ∈ { merge, split, new, move, close, rename }
step 1: 변경 내용 입력      → changeType별 필드 differential
step 2: 영향 분석           → 미리보기 (DB 조회)
step 3: 결재선 + 제출       → ApprovalFlow + 토스트
```

→ step 1의 필드 differential이 매핑 layer의 핵심:

| changeType | step 1 필드 | OrgChange data |
|---|---|---|
| new (proto) / create (cb) | newName / newParent | newDeptName / newDeptParentId |
| merge | sourceDept / targetDept | sourceDeptId / targetDeptId |
| split (proto) | sourceDept / newName / newParent? | **부재 (cb)** — 신규 OrgChange.type 필드 |
| move | sourceDept (=deptId) / targetParent | deptId / targetParentId |
| rename | sourceDept / newName | renameDeptId / newName |
| close | sourceDept | closeDeptId |
| transfer_employee (cb only) | employee / from / to | employeeId / fromDeptId / toDeptId |

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 신규 pure functions

**파일**: `src/lib/org/restructure-mapping.ts` (~80 lines)

```ts
// ─── Types ────────────────────────────────────────────────
export type ProtoChangeType = 'merge' | 'split' | 'new' | 'move' | 'close' | 'rename'

// 코드베이스 ChangeType은 RestructureModal.tsx export
import type { ChangeType, OrgChange } from '@/components/org/RestructureModal'

// ─── proto → codebase ────────────────────────────────────
export function protoToCodeChangeType(proto: ProtoChangeType): ChangeType {
  switch (proto) {
    case 'new':    return 'create'
    case 'merge':  return 'merge'
    case 'split':  return 'split' as ChangeType  // 신규 추가 (N+27 확장)
    case 'move':   return 'move'
    case 'close':  return 'close'
    case 'rename': return 'rename'
  }
}

// ─── codebase → proto ────────────────────────────────────
export function codeToProtoChangeType(code: ChangeType): ProtoChangeType | null {
  switch (code) {
    case 'create':           return 'new'
    case 'merge':            return 'merge'
    case 'move':             return 'move'
    case 'rename':           return 'rename'
    case 'close':            return 'close'
    case 'transfer_employee': return null  // proto 부재
    case 'split':            return 'split'  // N+27 확장
  }
}

// ─── changeType별 필드 builder ───────────────────────────
export function buildOrgChange(
  type: ChangeType,
  formData: Record<string, unknown>
): OrgChange {
  // changeType별 OrgChange interface 필드 채움
  // 예: type='create' → { id, type:'create', newDeptName, newDeptCode, newDeptParentId }
  ...
}

// ─── i18n 라벨 (i18n key 매핑) ──────────────────────────
export function changeTypeLabelKey(type: ChangeType): string {
  return `org.restructure.changeType.${type}`
}
```

### (b) unit test

**파일**: `src/lib/org/restructure-mapping.test.ts` (~60 lines)

- 6 + 'split' + 'transfer_employee' = 8 cases × bidirectional = 16 케이스
- 'transfer_employee' → null 케이스 명시
- buildOrgChange differential 필드 검증

### (c) i18n 신규 키

`messages/{ko,en,zh,vi,es}.json` `org.restructure.changeType.*`:
- create / merge / split / move / close / rename / transfer_employee = 7 × 5 = **35 entries**

### (d) 사용처 (N+27 진입 시)

- `RestructureModal.tsx` 의 `CHANGE_TYPE_LABELS` → i18n key 참조
- 위저드 step 1 의 changeType button grid → `protoToCodeChangeType` 매핑
- 위저드 form data → `buildOrgChange` 변환 → API payload

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 35 entries (위 (c))
- **DB**: 변경 0 (N+27 검증 결과 schema migration 불필요)
- **API**: payload schema 무변경
- **OrgChangeHistory.changeType** (`REORGANIZATION/TRANSFER/RESTRUCTURE`) = 별도 enum, N+30 영향 0

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (LOW)**: pure function 100% testable, 위험 작음
- **R2 (MEDIUM)**: 'split' ChangeType 신설은 N+27 진입 시 동반 (UI 분기 추가 ~40 lines). N+30 단독 진입 시 union에 추가만 + UI 비활성화 placeholder OK
- **R3 (LOW)**: `transfer_employee` → null 매핑 — UI에서 처리 (위저드 진입 시 proto에 없음을 안내 또는 비활성화)

### 의존성
- **N+27 선행 권고** — RestructureModal 재작업 후 mapping layer 사용처 명확
- **PR-5A 머지** 필요 (모든 codebase 트랙)
- **WizardShell SSOT (N+27 의존)** — 단독 SSOT vs cross-batch 결정 따라 변동

### 가드
- ❌ `OrgChangeHistory.changeType` enum 변경 금지 (별도 audit 트랙)
- ❌ schema migration 0
- ✅ pure function 100% testable
- ✅ unit test (vitest) 신규 16+ 케이스

---

## §5. Implementation 단계 (N+27 선행 후 또는 독립 진입)

1. **사전 합의 게이트**: N+27 선행 vs N+30 독립 진입 결정
2. **branch**: `feat/org-restructure-mapping`
3. **commit 1 (mapping layer)**:
   - `src/lib/org/restructure-mapping.ts` (~80 lines, pure functions)
   - `src/lib/org/restructure-mapping.test.ts` (~60 lines, 16 케이스)
4. **commit 2 (i18n 신규 키)**:
   - `messages/{ko,en,zh,vi,es}.json` `org.restructure.changeType.*` 35 entries
5. **commit 3 (선택, N+27 동반)**:
   - RestructureModal.tsx `CHANGE_TYPE_LABELS` → `t(changeTypeLabelKey(type))` 적용
6. **codex Gate 1+2**: 표준
7. **PR open**: `feat/org-restructure-mapping` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **vitest**: 16+ 매핑 케이스 PASS (`npm test src/lib/org/restructure-mapping.test.ts`)
- ✅ **회귀 0**: RestructureModal 기존 동작 무변동 (N+27 진입 전)
- ✅ **i18n**: 35 entries × 5 locale = 175 total entries 정합

---

## §7. N+27 cross-ref 권고

본 mapping layer는 N+27 RestructureModal 재작업의 **선행 또는 동반** 트랙:

- **선행 진입 시**: N+30 단독 PR + N+27 진입 시 mapping function 사용
- **동반 진입 시**: 하나의 PR에서 mapping + UI 재작업 (~250 lines)
- **추천**: **선행 진입** — N+30이 작고 안전, 독립 unit test 가능, N+27 진입 시 활용 즉시 가능

---

**상태**: pre-flight 완료
**Stage 4 예상 PR 크기**: 2-3 commits, ~140 lines (코드+테스트) + 35 i18n entries, 3 file diff
