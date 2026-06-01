# N+22 Implementation — EmployeeStatusChip SSOT + employeeStatusColor 헬퍼 (Phase A 4순위)

> **base SHA**: `fde915ef` (`feat/n21-demo-limit-banner-proto` HEAD, PR #64 branch — stacked PR)
> **선행 PR**: [#64](https://github.com/centralkang-byte/ctr-hr-hub/pull/64) (`fde915ef`, N+21 ui.jsx DemoLimitBanner) — **base** + [#65](https://github.com/centralkang-byte/ctr-hr-hub/pull/65) / [#66](https://github.com/centralkang-byte/ctr-hr-hub/pull/66) / [#67](https://github.com/centralkang-byte/ctr-hr-hub/pull/67) (병렬, 충돌 0)
> **본 PR**: `feat/n22-employee-status-chip` — Phase A 4번째 PR (audit §6.1 4순위, stacked PR)
> **작성일**: 2026-05-22 KST (Session 230)
> **선행 audit**: [phase-a-entry-audit.md §6 + §2/§5](./phase-a-entry-audit.md) (`5e063d37`)

---

## §1. SSOT 정의 + 4 ambiguity 결정

### 1.1 `<EmployeeStatusChip>` (ui.jsx 신설)

```jsx
function EmployeeStatusChip({ status, size, className = "", style }) {
  const variant = ({ 재직: "success", 휴직: "warning", 퇴사예정: "danger" }[status]) || "default";
  const sizeStyle = size === "sm" ? { fontSize: 10 } : null;
  const cls = `chip ${variant} ${className}`.trim();
  return <span className={cls} style={{ ...sizeStyle, ...style }}>{status}</span>;
}
```

| prop | type | default | 용도 |
|---|---|---|---|
| `status` | `"재직" \| "휴직" \| "퇴사예정"` | (필수) | 직원 한국어 status |
| `size` | `"sm" \| undefined` | undefined | inspector mini card (fontSize 10) |
| `className` | string | `""` | 추가 class |
| `style` | object | undefined | inline style override |

**STATUS_MAP (사양 본문 명시)**: 재직 → success / 휴직 → warning / 퇴사예정 → danger

### 1.2 `employeeStatusColor(status)` 헬퍼 (wb-status 전용)

```js
function employeeStatusColor(status) {
  return ({
    재직: "oklch(76% 0.16 145)",
    휴직: "oklch(76% 0.16 75)",
    퇴사예정: "oklch(70% 0.18 25)",
  }[status]) || "oklch(70% 0.05 280)";
}
```

→ **사용자 결재 = 옵션 B 정합** (wb-status dot+label 패턴 시각 무변화, 색상만 SSOT 헬퍼 호출)

### 1.3 4 ambiguity 결정 (가디언 default 채택)

| # | ambiguity | 결정 | 근거 |
|---|---|---|---|
| 1 | inspector.jsx 2 location (fontSize 10) | **둘 다 변환** + `size="sm"` prop | acceptance #1 "if-else 0건" 정합 |
| 2 | wb-status 처리 | **(b) 색상만 SSOT** ⭐ 사용자 결재 | dot+label 패턴 시각 무변화, header banner 회귀 0 |
| 3 | PR #64 Object.assign trivial conflict | **stacked PR (base = PR #64 branch)** | runtime self-contained + PR #64 머지 시 자동 rebase to main |
| 4 | X3 finding (HireWorker step 1 employment) | **본 PR 무관** | N+49 Phase D 흡수 default 유지 |

---

## §2. 4 location 변환 결과

| # | 파일 | line | 변환 |
|---|---|---|---|
| 1 | `page-employees.jsx` | L287 | if-else 3 분기 (3 lines) → `<EmployeeStatusChip status={e.status} />` (1 line) |
| 2 | `inspector.jsx` (mini card) | L57 | if-else 3 분기 (3 lines, fontSize 10 inline) → `<EmployeeStatusChip status={employee.status} size="sm" />` (1 line) |
| 3 | `inspector.jsx` (main panel) | L101 | sections list entry → `<EmployeeStatusChip status={employee.status} />` (1 line, `<>...</>` fragment 제거) |
| 4 | `page-employee-detail.jsx` (wb-status) | L51 | 인라인 oklch ternary (3 lines) → `style={{ background: employeeStatusColor(employee.status) }}` (1 line, wb-status block + dot+label **유지**) |

---

## §3. 가드 (Phase A 정의 정합)

| 가드 | 결과 |
|---|---|
| `src/` diff empty | ✅ Pure proto only |
| `messages/` diff empty | ✅ 한국어 hardcoded (STATUS_MAP) |
| `prisma/` diff empty | ✅ DB schema 무관 |
| `_design-reference/wizards.jsx` 미터치 | ✅ PR #65/#67 scope |
| `_design-reference/data.js` 미터치 | ✅ PR #66/#67 scope |
| ui.jsx PR #64 DemoLimitBanner block 미터치 | ✅ EmployeeStatusChip은 DemoLimitBanner 다음 별도 영역 |
| wb-status block 구조 무변화 | ✅ dot+label 패턴 유지, 색상만 SSOT 헬퍼 호출 |
| 다른 chip surface 미터치 | ✅ 직원 status 한정 (학력/자격증/교육 chip 등 별 의미는 무관) |
| audit Phase A "codebase mutation 0" | ✅ |

---

## §4. Verification 결과

### acceptance #1: 상태 chip if-else 0건 ✅

```text
$ grep -nE '\.status === "재직"' \
    page-employees.jsx inspector.jsx page-employee-detail.jsx
(0 matches)
```

### acceptance #2: 색상 mapping 단일 진실 ✅

```text
$ grep -nE "<EmployeeStatusChip" page-employees.jsx inspector.jsx page-employee-detail.jsx
page-employees.jsx:287:                    <EmployeeStatusChip status={e.status} />
inspector.jsx:57:            <EmployeeStatusChip status={employee.status} size="sm" />
inspector.jsx:101:    { k: "상태",       v: <EmployeeStatusChip status={employee.status} /> },

$ grep -nE "employeeStatusColor" page-employee-detail.jsx ui.jsx
ui.jsx:258:// employeeStatusColor — page-employee-detail.jsx wb-status dot 색상 SSOT (N+22 옵션 B)
ui.jsx:260:function employeeStatusColor(status) {
ui.jsx:269:  Icons, ..., EmployeeStatusChip, employeeStatusColor, useEscClose,
page-employee-detail.jsx:51:                <span className="d" style={{ background: employeeStatusColor(employee.status) }} />
```

→ **인라인 색상/variant 0건**, SSOT 호출만 ✅

### acceptance #3: wb-status 시각 무변화 ✅

```jsx
// before (PR #64 base)
<span className="wb-status">
  <span className="d" style={{
    background: employee.status === "재직" ? "oklch(76% 0.16 145)" :
               employee.status === "휴직" ? "oklch(76% 0.16 75)" :
               "oklch(70% 0.18 25)"
  }} />
  {employee.status}
</span>

// after (N+22)
<span className="wb-status">
  <span className="d" style={{ background: employeeStatusColor(employee.status) }} />
  {employee.status}
</span>
```

→ **wb-status 외부 구조 무변화** (className/dot+label/oklch 색상 모두 동일) — header banner 시각 무변화 ✅

### scope = +9 net LOC (S~XS PR, audit ~-3 예상보다 약간 큼)

```text
$ git diff --stat
_design-reference/inspector.jsx            | 12 ++----------
_design-reference/page-employee-detail.jsx |  6 +-----
_design-reference/page-employees.jsx       |  4 +---
_design-reference/ui.jsx                   | 25 ++++++++++++++++++++++++-
4 files changed, 28 insertions(+), 19 deletions(-)
```

audit §2 표 "S (~−10 LOC net)" 예상보다 약간 더 큼 (+9 vs −10). 차이 ~19 LOC = ui.jsx 신설 SSOT 컴포넌트 (~8) + 헬퍼 함수 (~7) + 주석 (~7) + Object.assign 1줄 = ~+23 LOC ui.jsx 추가. 3 JSX는 −14 LOC 감소. 가드 정합.

---

## §5. cross-batch carry-over (N+24 / N+31 design SSOT 청사진)

audit §3.3 단방향 그래프 정합:

```
Phase A N+22 (proto EmployeeStatusChip ui.jsx, STATUS_MAP 3 variant)
    ─→ Phase B N+24 (codebase StatusChips SSOT 신설, 8 variant 확장)
    ─→ Phase C N+31 (codebase 8 surface 적용, batch 07 dashboard)
```

**N+22 design SSOT가 N+24/N+31의 청사진**:

| Phase | 컴포넌트 | scope | N+22 inherit |
|---|---|---|---|
| Phase A N+22 (proto) | `<EmployeeStatusChip>` | 직원 status 3 variant (success/warning/danger) | STATUS_MAP 단일 진실 |
| Phase B N+24 (codebase) | `<StatusChips>` SSOT | 8 variant (info/accent/success/warning/danger/zero 등, batch 05 wd-status-chips 정합) | STATUS_MAP 패턴 + chip 패턴 정합 |
| Phase C N+31 (codebase) | 8 surface 적용 | onboarding dashboard 등 8 surface | N+24 SSOT consumer |

**역의존 0** ✅ — N+22는 Phase A SSOT layer (audit §3.2 정합).

추가 cross-batch 의제:
- **batch 05 `<DeptChip>` 패턴 정합**: N+22 STATUS_MAP 패턴을 batch 05 부서 chip 적용 시 재사용 권고
- **shadcn `<Badge>` variant 매핑** (acceptance 별도 트랙): N+24 진입 시 codebase `<Badge>` `success` → `wt-success` token 매핑 (X4 cross-surface)

---

## §6. 머지 의존성 (stacked PR)

| PR | 같은 파일 | 충돌 위험 | 머지 순서 |
|---|---|---|---|
| **PR #64** (ui.jsx — base) | ✅ | base = `feat/n21-demo-limit-banner-proto`, **runtime self-contained** | PR #64 머지 시 본 PR base auto-rebase to main |
| PR #65 (wizards.jsx) | ❌ | 0 | 무관 |
| PR #66 (data.js + page-employee-detail + inspector) | ✅ inspector + page-employee-detail (2 파일) | **다른 hunk** (PR #66 = quickStats/recentActivity/career/perf vs N+22 = status chip 영역) | 자동 merge 가능 |
| PR #67 (data.js + wizards.jsx) | ❌ | 0 | 무관 |

**stacked PR base**: `feat/n21-demo-limit-banner-proto` (PR #64 branch). PR #64 머지 시 **GitHub auto-rebase to main** (gh pr base auto-update).

---

## §7. Out of Scope (별도 turn)

- audit count 정정 (N+19 "5/7→10" + N+20 "15→11" 합본 별도 turn)
- N+24 codebase StatusChips SSOT (Phase B)
- N+31 codebase 8 surface 도입 (Phase C, batch 07)
- shadcn `<Badge>` variant 매핑 (별도 트랙)
- 다른 chip surface (학력/자격증/교육) 별 의미 chip 미터치
- X3 HireWorker step 1 employment (N+49 흡수 default)
- N+23 / N+25 / N+28 / N+29 진입 (sequential)
- PR #64-#67 머지 (정상 review)

---

**상태**: ACTIVE (본 commit 직후 PR open, base = `feat/n21-demo-limit-banner-proto`)
**다음 갱신**: PR #64 머지 후 N+22 base auto-rebase to main + 머지 review
**책임 단언**: 본 PR이 N+22 acceptance (if-else 0 + 색상 mapping 단일 + wb-status 시각 무변화) 충족. N+24/N+31 design SSOT 청사진.
