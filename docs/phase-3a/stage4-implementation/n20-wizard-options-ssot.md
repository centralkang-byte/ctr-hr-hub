# N+20 Implementation — wizards.jsx HireWorker 옵션 5 SSOT 키 (Phase A 3순위)

> **base SHA**: `d868be4d` (main, PR-5A #63 머지 직후)
> **선행 PR**: [#64](https://github.com/centralkang-byte/centralkang-byte/ctr-hr-hub/pull/64) (`fde915ef`, N+21 ui.jsx) + [#65](https://github.com/centralkang-byte/ctr-hr-hub/pull/65) (`df2617f8`, N+21 wizards 통합) + [#66](https://github.com/centralkang-byte/ctr-hr-hub/pull/66) (`dce7d7f6`, N+19 data.js 10 SSOT)
> **본 PR**: `feat/n20-wizard-options-ssot` — Phase A 3번째 PR (audit §6.1 3순위)
> **작성일**: 2026-05-22 KST (Session 230)
> **선행 audit**: [phase-a-entry-audit.md §6.2 #③](./phase-a-entry-audit.md) + §2/§5 (`5e063d37`)
> **선행 doc**: N+20 사전 inquiry (4 ambiguity 가디언 default 채택)

---

## §1. 5 SSOT 키 list (batch 04 §7 N+20 단일 진실)

| # | 키 | 종류 | wizard surface |
|---|---|---|---|
| 1 | `data.departments` | **기존 11 entries 유지 (확장 0)** | HireWorker step 2 dept (L170-178) — 인라인 6 → **동적 10 부서** (sentinel "전체 부서" filter) |
| 2 | `data.ranks[]` | **신설 7 entries** | HireWorker step 2 직급 (L186-189) — 인라인 7 → 동적 |
| 3 | `data.salaryBands[]` | **신설 9 entries** | HireWorker step 3 연봉 밴드 (L204-207) — 인라인 9 → 동적 |
| 4 | `data.onboardingTemplates[]` | **신설 4 entries** | HireWorker step 4 (L219-222) — 인라인 4 → 동적 |
| 5 | `data.employmentTypes` | **기존 5 entries 유지 (확장 0)** | acceptance #3 매핑 검증만 (HireWorker step 1 인라인은 X3 별도 트랙) |
| (보조) | `data.salaryBandMapping` | **신설 매핑 layer** | 단일 체계 채택 (L vs R)은 X4 cross-surface 별도 트랙 |

---

## §2. 4 ambiguity 결정 근거 (가디언 default 채택)

| # | ambiguity | 결정 | 근거 |
|---|---|---|---|
| 1 | departments 카운트 (audit "15") | **실제 11 entries** | data.js L153 grep 검증, audit 본문 typo (별도 turn 정정 의제) |
| 2 | JobPosting dept 인라인 scope | **본 PR 미포함** (X2 별도 트랙) | 사양 본문 HireWorker step 2/3/4 명시, JobPosting은 별 cross-surface |
| 3 | wizard 6 dept "인라인 제거" 의도 | **(b) 동적 생성** (`filter` "전체 부서" sentinel → 10 부서) | acceptance #2 "departments = data.directory 100% 일치" 정합 |
| 4 | salaryBandMapping 본 PR scope | **포함** (매핑 layer만, 단일 체계 채택 X4 별도) | 사양 본문 "매핑 layer 추가" 명시 |

---

## §3. 가드 (Phase A 정의 정합)

| 가드 | 결과 |
|---|---|
| `src/` diff empty | ✅ Pure proto only |
| `messages/` diff empty | ✅ 한국어 hardcoded |
| `prisma/` diff empty | ✅ DB schema 무관 |
| `_design-reference/ui.jsx` 미터치 | ✅ PR #64 SSOT 단일 source |
| `_design-reference/page-employee-detail.jsx` 미터치 | ✅ PR #66 scope |
| `_design-reference/inspector.jsx` 미터치 | ✅ PR #66 scope |
| HireWorker step 1/5 + 다른 3 위저드 미터치 | ✅ HireWorker step 2/3/4 한정 |
| review step `<DemoLimitBanner />` (PR #65) 미터치 | ✅ |
| data.departments / employmentTypes 확장 0 | ✅ 기존 11 / 5 entries 그대로 |
| 단일 체계 채택 (L vs R) 0 | ✅ 매핑 layer만, X4 별도 트랙 |
| 신규 4 키 명명 conflict | ✅ 사전 grep 부재 확인 |

---

## §4. Verification 결과

### employmentTypes step 1 grep 결과 (사용자 사양서 작업단계 2)

```text
$ sed -n '147,150p' wizards.jsx
<select value={f.employment} onChange={(e) => set("employment", e.target.value)}>
  <option>정규직</option><option>계약직</option><option>인턴</option><option>파견</option>
</select>
```

**HireWorker step 1 employment = 인라인 4 entries** (SSOT 미사용). data.employmentTypes 5 entries (정규직/계약직/수습/파트타임)와 **불일치** (인턴/파견은 인라인만, 수습/파트타임은 SSOT만).

**본 PR scope 외** (사양 가드 "step 1 미터치") — **X3 cross-surface 별도 트랙** 진입 의제. acceptance #3는 directory ↔ data.employmentTypes 매핑만 검증 (자동 정합 — directory 18 entries 모두 SSOT 포함 부서로 매핑).

### acceptance #1: HireWorker step 2/3/4 인라인 `<option>` 0건 ✅

```text
$ sed -n '170,225p' wizards.jsx | grep -nE "<option>[^<]+</option>"
(0 matches — sentinel `<option value="">선택</option>`만 잔존, list 인라인 0)
```

### acceptance #2: departments ↔ data.directory 매핑 100% ✅

- data.departments = 11 entries (sentinel 포함, 10 실 부서)
- data.directory 18 entries 각 dept = data.departments 부분집합 (사전 grep)
- HireWorker step 2 dept dropdown = `data.departments.filter((d) => d !== "전체 부서").map(...)` = **10 부서 동적 생성**
- wizard 선택 폭 6 → 10 부서 확장 (사용자 결정 (b) 정합)

### acceptance #3: employmentTypes ↔ data.directory.employment 매핑 100% ✅

- data.directory 18 entries `employment` 값 = "정규직" (다수) / "수습" (CTR-KR-3081 유서아)
- data.employmentTypes = ["전체 고용형태", "정규직", "계약직", "수습", "파트타임"]
- **정규직 + 수습 모두 SSOT 포함** ✅ (acceptance #3 자동 정합)

### acceptance #4: HireWorker 6 step 시각 (proto only, 시각 갈음)

`_design-reference/`는 Babel-in-browser JSX, dev server 표면 아니라 자동화 verify N/A. HR Hub.html 직접 열어 6 step 통과 + dropdown 항목 정합 시각 검증.

### scope = +5 net LOC (XS PR)

```text
$ git diff --stat
_design-reference/data.js     |  7 +++++++
_design-reference/wizards.jsx | 14 ++++++--------
2 files changed, 13 insertions(+), 8 deletions(-)
```

net = **+5 LOC** (audit §2 ~50 LOC 예상보다 훨씬 작음 — sentinel placeholder + ranks/salaryBands 한 줄 array 사용으로 LOC 절약). XS PR 분류.

---

## §5. cross-batch carry-over (Phase C/D consumer 단언)

audit §3.3 단방향 그래프 정합 — N+20 data.js SSOT는 **upstream**, 후속 Phase C/D가 정방향 consumer:

| 후속 RECORD | Phase | N+20 SSOT 키 reuse |
|---|---|---|
| **N+18** | C | `employeeDetail.career` 데이터 (`education`/`certifications`/`trainings`/`activities`)와 별개 — N+20은 wizard 옵션만 |
| **N+30** | C | `data.salaryBandMapping` 매핑 layer 직접 reuse (proto L 체계 ↔ codebase R 체계 변환 입력) |
| **N+27** (Restructure full-screen) | D | wizard 옵션 SSOT 패턴 정합 (changeType 6, depth/parent dropdown 등 SSOT 변환 가능성) |
| **N+49** (HireWorker codebase migration) | D | `data.ranks` / `salaryBands` / `onboardingTemplates` → codebase enum/seed 청사진 |

**역의존 0** ✅ — N+20은 Phase A SSOT layer (audit §3.2 단방향 verify 정합).

---

## §6. 머지 의존성 (단독 진입 가능 단언)

| PR | 같은 파일 변경 | 충돌 위험 | 머지 순서 |
|---|---|---|---|
| PR #64 (ui.jsx) | ❌ | 0 | 무관 |
| PR #65 (wizards.jsx 4 review step) | ✅ | **0 (다른 hunk)** — review step 마지막 child vs HireWorker step 2/3/4 가운데 영역 | 무관 |
| PR #66 (data.js employeeDetail/directoryStats + 2 JSX) | ✅ (data.js) | **0 (다른 hunk)** — employeeDetail/directoryStats 끝 vs employmentTypes 다음 | 무관 |

**자동 merge 가능** — N+20 PR main 기반 open, PR #64/#65/#66 머지 후 자동 rebase. runtime self-contained (data.js + wizards.jsx 함께 변경).

---

## §7. Out of scope (별도 turn)

- **audit 본문 "departments 15" → "11" 정정** (m0036 추가 의제 + N+19 audit count 정정과 합본 가능, 별도 turn)
- **JobPosting dept 인라인** (X2 cross-surface 별도 트랙)
- **HireWorker step 1 employment 인라인** (X3 cross-surface 별도 트랙, acceptance #3 자동 정합이므로 본 PR 미포함)
- **단일 체계 채택 (L vs R)** (X4 cross-surface 별도 트랙, salaryBandMapping은 매핑 layer만)
- **N+22 / N+23 진입** (Phase A 후속 sequential)
- **PR #64 / PR #65 / PR #66 머지** (정상 review)

---

**상태**: ACTIVE (본 commit 직후 PR open)
**다음 갱신**: PR 머지 후 phase3a-audit 브랜치 N+20 entry "DONE" mark + audit count 정정 turn
**책임 단언**: 본 PR이 N+20 acceptance (인라인 0 + departments↔directory + employmentTypes↔directory + 시각 갈음) 충족. 5 SSOT cascading + 매핑 layer.
