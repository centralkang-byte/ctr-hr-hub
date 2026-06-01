# N+25/N+28/N+29 합본 Implementation — page-org.jsx visual polish (Phase A 6-8순위)

> **⚠️ historical / superseded (Session 235, 2026-05-29)**
> 본 문서의 N+27·N+50 관련 서술은 이후 정정되었습니다: `RestructureModal`은 이미 wizard(drawer 아님), WizardShell SSOT는 N+48이 `src/components/shared/`에 신설, **N+50은 N+27 의존 없이 순수 wrap 진입 가능**, N+27 charter = A(순수 형태, 기능은 별 트랙 재분류). 최신 SSOT = `09-wizardshell-ssot.md` + 정정 트랙 `docs/n27-n50-drift-fix`.

> **base SHA**: `d868be4d` (main) — **main base 단독 PR** (PR #64-#69 충돌 0)
> **선행 PR**: PR #64-#69 (모두 OPEN, 무관 — page-org.jsx 미터치)
> **본 PR**: `feat/n25-n28-n29-org-visual-polish` — Phase A **마지막 합본 PR** (audit §6.3 정합)
> **작성일**: 2026-05-22 KST (Session 230)
> **선행 audit**: [phase-a-entry-audit.md §6.3](./phase-a-entry-audit.md) "N+23/N+25/N+28/N+29는 합본 가능"

---

## §1. 3 RECORD spec + 2 ambiguity 결정

### 1.1 N+25 — View tabs 4 mode 명명 정렬

**batch 05 §7 N+25 (L325-327)**:
- proto 4 view tab 시각 정합 (tree/directory/list/grid)
- dir/list/grid view 본문 placeholder OK (mock 한계)

**변경**:
- `dir` → `directory` (codebase SSOT 정합)
- `card` → `grid` (codebase SSOT 정합)
- **`list` view 신규 추가** (codebase 4 mode 정합)
- Card 본문 ternary: `view === "tree"` 시 tree fan-out / 그 외 placeholder

### 1.2 N+28 — EffectiveDatePicker visual reskin

**batch 05 §7 N+28 (L376-378)**:
- proto button visual = codebase EffectiveDatePicker 형태 정합 (캘린더 icon + 날짜 + chevron)
- dialog 구현 placeholder 유지 (mock 한계)

**변경** (L36 button):
```jsx
<button className="btn">
  <Icons.Calendar size={13} sw={2}/>
  <span>2026.05.16</span>
  <Icons.ChevD size={11} sw={2}/>
</button>
```

### 1.3 N+29 — Zoom controls + 검색 opacity

**batch 05 §7 N+29 (L391-393)**:
- proto eye/shield button 의미 명시 (fit/lock 정합)
- proto search 결과 opacity 0.2 시각 정합 (매칭 풀 opacity, 미매칭 0.2)

**변경**:
- 4 zoom buttons aria-label 추가 (확대 / 축소 / 전체 보기 (fit) / 잠금 (lock))
- `searchValue` state + input `value/onChange`
- OrgNode wrapper 2 location (depts map + hrTeam) opacity 조건부

### 1.4 2 ambiguity 결정 (가디언 default 채택)

| # | ambiguity | 결정 | 근거 |
|---|---|---|---|
| 1 | N+29 zoom Eye/Shield 폐기 vs icon 변경 | **icon 유지 + aria-label 의미 명시** | ui.jsx Icons inventory 부재 (`Maximize`/`Lock` 없음) + 가드 "ui.jsx 미터치" → Icons 그대로 유지하면서 aria-label로 의미 명시 (a11y 정합) |
| 2 | N+28 EffectiveDatePicker dialog | **placeholder 유지** | 사양 본문 "mock 한계" 명시 — onClick 미설정 (noop) |

### 1.5 Icons inventory verify 결과

| 사용 icon | 존재 verify | 채택 |
|---|---|---|
| `Icons.Org` (트리) | ✅ L40 | 그대로 |
| `Icons.Users` (디렉토리) | ✅ L20 | 그대로 |
| **`Icons.Receipt` (목록)** | ✅ L32 (rectangle with horizontal lines) | **N+25 list view icon — 가장 list-like** |
| `Icons.Grid` (카드) | ✅ L17 | 그대로 |
| `Icons.ChevD` (chevron-down) | ✅ L50 | **N+28 정합** |
| `Icons.Calendar` | ✅ L30 | N+28 정합 |
| `Icons.Eye` (fit) | ✅ L67 | **N+29 유지 + aria-label "전체 보기 (fit)"** |
| `Icons.Shield` (lock) | ✅ L66 | **N+29 유지 + aria-label "잠금 (lock)"** |
| `Icons.EmptyBox` (placeholder) | ✅ L64 | placeholder block 정합 |

---

## §2. 합본 시각 회귀 1축 (라이트)

**검증 시나리오**:

| 단계 | 검증 element | 검증 state |
|---|---|---|
| 1. **default state** (검색 미사용 + view=tree) | tree fan-out + zoom 4 buttons + EffectiveDatePicker | 시각 무변화 baseline (탭/zoom/date 자체 시각 보존) ⭐ |
| 2. **4 view tabs 클릭** | wd-tab-bar 4 buttons (트리/디렉토리/목록/카드) | tree → 본문 / directory/list/grid → placeholder block (EmptyBox + 메시지) |
| 3. **EffectiveDatePicker visual** | header right `<button>` | 캘린더 icon + "2026.05.16" + chevron 정합 |
| 4. **Zoom controls 4 buttons** | 좌하단 stack | aria-label tooltip on hover (확대/축소/전체 보기/잠금) |
| 5. **Search 입력** | 매칭 OrgNode 풀 opacity / 미매칭 0.2 | depts map + hrTeam 양면 |

**검증 도구**: HR Hub.html 직접 (Babel-in-browser proto playground).

---

## §3. 가드 (Phase A 정의 정합)

| 가드 | 결과 |
|---|---|
| `src/` diff empty | ✅ Pure proto only |
| `messages/` diff empty | ✅ 한국어 hardcoded |
| `prisma/` diff empty | ✅ DB 무관 |
| `_design-reference/ui.jsx` 미터치 | ✅ PR #64/#68 scope (Icons inventory read only) |
| `_design-reference/wizards.jsx` 미터치 | ✅ PR #65/#67 |
| `_design-reference/data.js` 미터치 | ✅ PR #66/#67 |
| `_design-reference/inspector.jsx` 미터치 | ✅ PR #66/#68 |
| `_design-reference/page-employees.jsx` 미터치 | ✅ PR #68 |
| `_design-reference/page-employee-detail.jsx` 미터치 | ✅ PR #66/#68/#69 |
| codebase DeptFlowNode 미터치 | ✅ N+26 Phase C 별도 트랙 |
| EffectiveDatePicker dialog 구현 0 | ✅ placeholder 유지 (mock 한계) |
| ReactFlow library 추가 0 | ✅ aria-label 의미 명시만 |
| list/grid view 실 데이터 mock 0 | ✅ placeholder block (EmptyBox + 한국어 메시지) |
| audit Phase A "codebase mutation 0" | ✅ |

---

## §4. Verification 결과

### acceptance — N+25

```text
$ grep -nE 'view === "(tree|directory|list|grid)"' page-org.jsx
47: <button aria-selected={view === "tree"}>...
48: <button aria-selected={view === "directory"}>...
49: <button aria-selected={view === "list"}>...
50: <button aria-selected={view === "grid"}>...
54: {view === "tree" ? (
101: {view === "directory" && "디렉토리 보기"}
102: {view === "list" && "목록 보기"}
103: {view === "grid" && "카드 보기"}
```

→ **4 view mode 정합 ✅** (codebase SSOT `tree/directory/list/grid` 일치). list/grid placeholder 본문 OK.

### acceptance — N+28

```text
$ grep -nE "2026.05.16|Icons.ChevD" page-org.jsx
29: <span className="sc zero">...발효일 <b>2026.05.16</b></span>  (chip cross-ref)
39: <span>2026.05.16</span>                                       (button text)
40: <Icons.ChevD size={11} sw={2}/>                                (chevron icon)
```

→ **button visual 정합 ✅** (캘린더 + 날짜 + chevron). dialog placeholder (onClick 미설정).

### acceptance — N+29

```text
$ grep -nE 'aria-label="(확대|축소|전체 보기|잠금)"' page-org.jsx
91: aria-label="확대"
92: aria-label="축소"
93: aria-label="전체 보기 (fit)"
94: aria-label="잠금 (lock)"

$ grep -nE "searchValue|opacity:.*1.*0\.2|matched" page-org.jsx
10: const [searchValue, setSearchValue] = useStateOR("");
35: <input ... value={searchValue} onChange={...}>
74: const matched = !searchValue || d.name.includes(searchValue);
76: style={{ opacity: matched ? 1 : 0.2, ... }}
84: style={{ opacity: (!searchValue || ...) ? 1 : 0.2, ... }}
```

→ **4 zoom button 의미 명시 ✅ + search opacity 매칭/미매칭 정합 ✅** (depts map + hrTeam 2 location)

### scope = +25 net LOC (XS PR)

```text
$ git diff --stat
_design-reference/page-org.jsx | 51 +++++++++++++++++++++++++++++++-----------
1 file changed, 38 insertions(+), 13 deletions(-)
```

분해:
- N+25 view tabs (3→4 button + key 변경): +1 line, key 인라인 변경 (LOC 0 net)
- N+25 Card content ternary wrap + placeholder block: +12 LOC
- N+28 EffectiveDatePicker button reskin: +3 LOC
- N+29 zoom 4 aria-label: +4 인라인 attr (LOC 0 net)
- N+29 searchValue state + input value/onChange: +2 LOC
- N+29 depts map opacity wrapper (`{depts.map((d, i) => (<OrgNode />))}` → `{depts.map((d, i) => { ... return <div style=...><OrgNode/></div>; })}`): +6 LOC
- N+29 hrTeam opacity wrapper: +2 LOC
- 삭제: -13 LOC (인라인 attr 변경 + map signature 변경)
- **net: +25 LOC** ✅ (audit ~40 정합 범위)

---

## §5. cross-batch carry-over (N+26 Phase C DeptFlowNode tokenize 청사진)

audit §3.3 단방향 그래프 정합 — N+25/N+28/N+29 proto only이라 cross-batch 의존 0:

| Phase | RECORD | 본 합본 PR과의 관계 |
|---|---|---|
| **N+26** (Phase C, batch 05 codebase) | DeptFlowNode mine highlight + 토큰화 | **proto OrgNode visual** (현재 highlight/mine/isRoot props) → N+26 codebase DeptFlowNode 시각 spec 청사진 |
| **N+27** (Phase D, batch 05 codebase) | RestructureModal drawer → full-screen wizard | 본 PR 무관 — N+27은 RestructureModal codebase 트랙 |
| **N+30** (Phase C, batch 05 codebase) | wizard mapping layer (pure functions) | 본 PR 무관 — N+30은 mapping layer 트랙 |

**design SSOT carry-over**:
- **N+25 view mode 4 (tree/directory/list/grid)** = codebase OrgClient view mode SSOT 일치 (사양 본문 명시)
- **N+28 EffectiveDatePicker visual** = codebase EffectiveDatePicker form 정합 (production 컴포넌트와 visual 일치)
- **N+29 zoom controls** = codebase ReactFlow Controls visual 청사진 (Eye/Shield는 mock placeholder, codebase는 ReactFlow standard 4 button)

**역의존 0** ✅ — Phase A SSOT layer (audit §3.2 정합).

---

## §6. 머지 의존성 (main base 단독)

**page-org.jsx 영향 PR**: **0** ✅

| PR | 같은 파일 | 충돌 | 머지 순서 |
|---|---|---|---|
| PR #64 (ui.jsx) | ❌ | 0 | 무관 |
| PR #65 (wizards.jsx) | ❌ | 0 | 무관 |
| PR #66 (data.js + page-employee-detail + inspector) | ❌ | 0 | 무관 |
| PR #67 (data.js + wizards.jsx) | ❌ | 0 | 무관 |
| PR #68 (ui.jsx + page-employee-detail + inspector + page-employees) | ❌ | 0 | 무관 |
| PR #69 (page-employee-detail.jsx) | ❌ | 0 | 무관 |

**main base 단독 PR** ✅ — page-org.jsx는 본 PR이 유일한 변경. 자동 merge 가능.

---

## §7. Out of Scope (별도 turn)

- **audit / batch 05 §7 spec 정정** — audit count 정정 + N+23 spec 합본 의제 (별도 turn)
- **N+26 (Phase C, DeptFlowNode tokenize codebase)** — 별도 트랙
- **EffectiveDatePicker dialog 실 구현** — codebase 별도
- **ReactFlow library 추가** — proto only 한정
- **N+27 (Phase D, RestructureModal drawer → wizard)** — 별도 PR
- **5 locale i18n** — N+25 codebase 측 별도 트랙
- **F14 임계 트래킹** — 별도 트랙
- PR #64-#69 머지 (정상 review)

---

## §8. Phase A 8/8 PR open 완료 단언 ⭐

본 합본 PR (PR #70) 완료 = **Phase A 8 RECORD 모두 PR open 달성**:

| RECORD | PR | base | 상태 |
|---|---|---|---|
| **N+21** SSOT (ui.jsx DemoLimitBanner) | #64 | main | OPEN |
| N+21 consumer (wizards.jsx) | #65 | main | OPEN |
| **N+19** (data.js 10 SSOT 키) | #66 | main | OPEN |
| **N+20** (wizards.jsx options SSOT) | #67 | main | OPEN |
| **N+22** (EmployeeStatusChip SSOT) | #68 | feat/n21-demo-limit-banner-proto (stacked) | OPEN |
| **N+23** (proto tablist a11y) | #69 | main | OPEN |
| **N+25 + N+28 + N+29** (page-org.jsx 합본) | **#70 (본 PR)** | main | OPEN |

**총 7 PR (N+21은 SSOT + consumer 2 PR) = 8 RECORD 모두 PR open**. Phase A 마일스톤 ⭐ 달성.

---

**상태**: ACTIVE (본 commit 직후 PR open)
**다음 갱신**: PR 머지 후 phase3a-audit 브랜치 N+25/N+28/N+29 entry "DONE" mark + Phase A 8/8 완료 단언
**책임 단언**: 본 합본 PR이 N+25/N+28/N+29 acceptance 모두 충족 + Phase A 8/8 마일스톤. N+26 Phase C DeptFlowNode tokenize 청사진.
