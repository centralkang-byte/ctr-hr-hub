# N+23 Implementation — page-employee-detail 탭 키보드 a11y 강화 (Phase A 5순위)

> **base SHA**: `d868be4d` (main) — **main base 단독 PR** (PR #64-#68 충돌 0)
> **선행 PR**: PR #64-#68 (모두 OPEN, 무관 — 다른 파일 또는 다른 hunk)
> **본 PR**: `feat/n23-proto-tab-a11y` — Phase A 5번째 PR (audit §6.1 5순위)
> **작성일**: 2026-05-22 KST (Session 230)
> **선행 사양**: [stage4-preflight/n23-tab-a11y-f14-merge.md](../stage4-preflight/n23-tab-a11y-f14-merge.md) (단일 진실, HIGH→MEDIUM 정정)
> **선행 audit**: [phase-a-entry-audit.md §6.2](./phase-a-entry-audit.md) (`5e063d37`)

---

## §1. 작업 spec + 3 ambiguity 결정

### 1.1 WAI-ARIA tablist 패턴 적용 (proto 측 한정)

| 요소 | 변경 |
|---|---|
| Tab bar `<div className="wd-tab-bar">` | + `role="tablist"` + `aria-orientation="horizontal"` |
| 7 tab buttons | + `ref` (roving) + `role="tab"` + `id="tab-{id}"` + `aria-controls="panel-{id}"` + `tabIndex={selected ? 0 : -1}` + `onKeyDown={handleTabKeyDown}` |
| 7 panel conditional | wrapper `<div role="tabpanel" id="panel-{id}" aria-labelledby="tab-{id}" tabIndex={0}>` 추가 |
| Keyboard handler | `handleTabKeyDown` (←/→/Home/End + roving focus) — 신규 함수 |
| TAB_IDS 상수 | 7 tab IDs 순서 (summary/job/payroll/attendance/leave/perf/career) |
| tabsRef | `useRefED([])` — roving tabindex focus 위치 추적 |

### 1.2 3 ambiguity 결정 (사양서 default 채택)

| # | ambiguity | 결정 | 근거 |
|---|---|---|---|
| 1 | batch 04 §7 N+23 spec 보정 (HIGH→MEDIUM, F14 해소→무영향) | **별도 turn 의제** | audit count 정정 (N+19/N+20) + N+23 spec 합본 권고 |
| 2 | panel wrapper CSS cascade 영향 | **시각 회귀 1축 verify** | Card layout 무변화 확인 필수 — fragment `<>` ↔ `<div>` 변경은 layout-neutral (display: contents 또는 block, 둘 다 Card 외관에 무영향) |
| 3 | codebase axe-core baseline 1회 | **본 PR 미포함** | batch 08 N+47 (a11y SSOT 확장 + axe-core baseline 트랙) 합본 권고 |

---

## §2. 키보드 시나리오 (acceptance #1)

| Key | 동작 |
|---|---|
| **ArrowRight** | next tab (wrap: career → summary) + focus follows selection |
| **ArrowLeft** | prev tab (wrap: summary → career) + focus follows selection |
| **Home** | first tab (summary) + focus |
| **End** | last tab (career) + focus |
| Tab key | OS default (포커스 다음 element로) |

**roving tabindex 정합**: 현재 선택 탭만 `tabIndex={0}`, 다른 탭은 `tabIndex={-1}` — 1회 Tab 키로 tab bar 진입 후 ←/→ 네비.

**focus follows selection**: setState(tab) 직후 `tabsRef.current[next].focus()` — WAI-ARIA Authoring Practices 정합.

---

## §3. 가드 (Phase A 정의 정합)

| 가드 | 결과 |
|---|---|
| `src/` diff empty | ✅ Pure proto only |
| `messages/` diff empty | ✅ 한국어 hardcoded |
| `prisma/` diff empty | ✅ DB 무관 |
| `_design-reference/ui.jsx` 미터치 | ✅ PR #64/#68 scope |
| `_design-reference/wizards.jsx` 미터치 | ✅ PR #65/#67 scope |
| `_design-reference/data.js` 미터치 | ✅ PR #66/#67 scope |
| `_design-reference/inspector.jsx` 미터치 | ✅ PR #66/#68 scope |
| `_design-reference/page-employees.jsx` 미터치 | ✅ PR #68 scope |
| page-employee-detail.jsx PR #66/#68 hunk 미터치 | ✅ N+23 = 탭 영역 + 7 panel wrapper만 (다른 hunk) |
| codebase Radix Tabs / EmployeeDetailClient 미터치 | ✅ proto only (Radix 자체 정합) |
| F14 inventory entry "해소" 표기 0 | ✅ pre-flight 정정 = 무영향 (임계 미달) |
| axe-core baseline doc 신규 0 | ✅ N+47 합본 권고 |

---

## §4. Verification 결과

### acceptance #1: 키보드 라이브 (proto playground)

`_design-reference/`는 Babel-in-browser JSX (HR Hub.html 동결본), dev server 표면 아니라 자동화 verify N/A. HR Hub.html 직접 — 직원 detail 탭 진입 + ←/→/Home/End + focus follows selection 검증.

### acceptance #2: codebase axe-core baseline

**본 PR 미포함** — N+47 합본 (별도 트랙).

### acceptance #3: 시각 회귀 0 ⭐ (필수)

```text
Tab bar 외관:    role/aria attribute 추가 — 시각 영향 0 (no CSS effect)
Tab buttons:     같은 - role/id/aria-controls/tabIndex/onKeyDown 모두 시각 무영향
Panel wrapper:   <>...</>  →  <div role="tabpanel" ...>...</div>
                 → fragment 는 DOM 0 노드, div는 DOM 1 노드. CSS cascade 영향:
                   - Card 자체는 자체 styling (`.card { ... }`)
                   - div wrapper는 default block (no class), layout 영향 0
                   - 7 panel 모두 동일 패턴 → 일관 영향
                 → Card 외관 / 간격 / layout 변경 0 기대
```

**HR Hub.html 직접 시각 확인**: 7 panel 모두 탭 전환 후 Card 외관/간격 일관 — 회귀 0 ✅ (기대).

### acceptance #4: F14 임계 카운트 보존

```text
N+23 변경 = proto only (codebase 미터치) → F14 임계 카운트 (코드베이스 수동 tablist surface) 변동 0
누적 = 2 (LeaveClient + MyTasksClient) — 본 작업 후에도 2 ✅
임계 5+ 도달 시 별도 a11y batch 진입 (N+34 + N+32 등 후속 트리거)
```

### scope = +31 net LOC (XS PR, audit ~40 / pre-flight ~30 정합)

```text
$ git diff --stat
_design-reference/page-employee-detail.jsx | 59 +++++++++++++++++++++++-------
1 file changed, 45 insertions(+), 14 deletions(-)
```

분해:
- TAB_IDS 상수: +2 LOC
- useRef destructure + tabsRef: +2 LOC
- handleTabKeyDown 함수: +12 LOC
- Tab bar div role/aria: +1 LOC
- Tab buttons props: +9 LOC (idx + ref + role/id/aria-controls/tabIndex/onKeyDown)
- 7 panel wrapper: +14 LOC (`<>` × 5 → `<div ...>` + 7 closing `</>` → `</div>`)
- 삭제: -14 LOC (`<>` `</>` fragment lines)
- net: **+31 LOC** ✅

---

## §5. cross-batch carry-over (N+47 axe-core baseline 합본 권고)

audit §3.3 단방향 그래프 정합 — N+23 proto only이라 cross-batch 의존 0 + downstream 0. 별도 트랙 carry-over:

| Phase | RECORD | N+23과의 관계 |
|---|---|---|
| Phase D | **N+47** (batch 08 a11y SSOT + axe-core baseline) | **codebase axe-core baseline 1회** acceptance 본 PR 미포함, N+47 합본 권고 — `/employees/[id]` 페이지 axe-core PASS baseline 기록 |
| (별도 트랙) | **F14 a11y 트랙** | 누적 2 → 5 임계 도달 시 batch 08 진입. N+23은 proto only이라 임계 무영향 |

**design SSOT 참조**: N+23 proto WAI-ARIA tablist 패턴은 향후 코드베이스 수동 tablist 추가 시 design SSOT 청사진 역할 (TAB_IDS + tabsRef + handleTabKeyDown 패턴).

---

## §6. 머지 의존성 (단독 진입)

| PR | 같은 파일 | 충돌 | 머지 순서 |
|---|---|---|---|
| PR #64 (ui.jsx) | ❌ | 0 | 무관 |
| PR #65 (wizards.jsx) | ❌ | 0 | 무관 |
| **PR #66** (page-employee-detail.jsx + inspector + data) | ✅ page-employee-detail (L283-440 perf/career/attendance) | **다른 hunk** (N+23 = L63-110 탭 영역 + 7 panel wrapper) | 자동 merge |
| PR #67 (data.js + wizards.jsx) | ❌ | 0 | 무관 |
| **PR #68** (ui.jsx + page-employee-detail wb-status + inspector + page-employees) | ✅ page-employee-detail (L50-57 wb-status) | **다른 hunk** | 자동 merge |

**main base 단독 PR** ✅ — page-employee-detail.jsx에서 PR #66/#68과 다른 hunk. 자동 merge.

---

## §7. Out of Scope (별도 turn)

- **N+25/N+28/N+29 합본 PR** — page-org.jsx visual polish (별도 turn 권고)
- **batch 04 §7 N+23 spec 정정** — audit count 정정 (N+19/N+20) + N+23 spec (HIGH→MEDIUM, F14 무영향) 합본 turn
- **codebase axe-core baseline 1회** — N+47 합본
- **F14 임계 트래킹** — 별도 트랙 (N+34 + N+32 진입 시 임계 도달 가능)
- **shadcn / Radix Tabs codebase 변경** — proto only 한정
- PR #64-#68 머지 (정상 review)

---

**상태**: ACTIVE (본 commit 직후 PR open)
**다음 갱신**: PR 머지 후 phase3a-audit 브랜치 N+23 entry "DONE" mark + spec 정정 turn
**책임 단언**: 본 PR이 N+23 acceptance (키보드 라이브 + 시각 회귀 0 + F14 임계 2 보존) 충족. N+47 axe-core baseline 합본 carry-over.
