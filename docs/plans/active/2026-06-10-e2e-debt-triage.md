# 2026-06-10 — main e2e 14-failure debt triage & fix (S281)

> **Context**: e2e CI was dead 5/28–6/10 (Node 24.16.0 hang, fixed by #146). The first
> revived baseline run (27262733060: 1756 pass / 14 fail) exposed 13 blind days of debt.
> This plan fixes the full set. Every verdict below was confirmed first-hand on a local
> CI replica (disposable postgres@17 `e2e_triage_db` + `NODE_ENV=test` prod server +
> seed identical to `.github/workflows/e2e.yml`) — 9 of the api failures and all 3
> browser failures reproduced exactly.

## Root causes (4 classes)

### Class 1 — Shared-seed contamination (3 tests, the big one)
`loa-discipline-lifecycle.spec.ts` runs the full LOA lifecycle (approve → return →
complete) on **이민준 (employee-a)**, the shared seed employee from `resolveSeedData`.
The LOA flow closes his primary assignment (`endDate=2026-07-09`) and leaves only a
future-dated return assignment (`effectiveDate=tomorrow`). DB forensics after a full
local run:

```
HIRE          2024-01-01 → endDate 2026-07-09   (closed)
STATUS_CHANGE 2026-06-11 → endDate null          (future — not yet effective)
STATUS_CHANGE 2026-07-10 → endDate 2026-06-10   (ON_LEAVE, closed)
```

Every multitenant 재직 guard merged in the blind window (#133/#134:
`isPrimary AND endDate IS NULL AND effectiveDate <= now()`) then rejects him.
Fresh-DB SQL proves the guard passes pre-contamination (guard_match=1).

Failing tests: `offboarding-training.spec.ts:382` (batch enroll 400),
`:487` (recommendations 403), `performance-goals-reviews.spec.ts:284` (candidates 400).

**Fix (test)**: both LOA describes create a dedicated employee via
`createTestEmployee()` (hireDate 2026-01-01 → past effectiveDate assignment confirmed
in `POST /employees` → `createAssignment({effectiveDate: hireDate})`). 이민준 stays
pristine for every other spec.

**Note (product, deferred)**: the `endDate: null` convention makes an employee with a
*scheduled* LOA invisible to guards even while still 재직 today. Real product question
(guards may want `endDate IS NULL OR endDate >= now()`), but it is a convention-wide
decision — flagged as a separate track, NOT changed here.

### Class 2 — Tests not updated for intentional blind-window policy changes (5 tests)
| Test | New product behavior | Fix (test) |
|---|---|---|
| `onboarding-lifecycle.spec.ts:276/:287` (crossboarding 400/404) | #133: crossboarding = 비-SUPER 전면 403 (temporary until HQ stage 2) | HR_ADMIN expects 403; move the 400/404 validation assertions into a new SUPER_ADMIN describe (auth state exists) |
| `payroll-adjustments-anomalies.spec.ts:626/:639` (/payroll/global as HR) | #130: SUPER_ADMIN-only gate | Replace HR describe with single "HR_ADMIN → 403" guard test (SUPER success block already exists at :665) |
| `payroll-operations.spec.ts:281` (submit-for-approval setup 409) | #139: duplicate-run prevention `@@unique(companyId,yearMonth,runType)` — spec creates 2099-01 twice in the same file | Submit test uses unique `yearMonth: '2099-03'` (2099-01 used at :26 via buildPayrollRun, 2099-02 at :75) |

### Class 3 — Test bugs that never ran in CI (born during the blind window) (4 tests)
| Test | Bug | Fix |
|---|---|---|
| `residual-cross-tenant.spec.ts:195` (ai-recommend expects 404, gets 400) | Spec sends `budgetConstraint: 0` but `aiRecommendSchema` has `.positive()` → zod 400 fires before the tenant-scoped 404 it is trying to assert | Drop `budgetConstraint`/`companyAvgRaise` (both optional) → scoped-notFound assertion becomes real again |
| `peer-review-succession-competency.spec.ts:288/:344` (+:397 same class) | `resolveCycleId()` = `cycles[0]` — reuses *another spec's* test cycle (local DB shows nominations landing in "E2E GoalRevision …" cycle owned by performance-goals-reviews). Cross-file duplicate (cycle, 이민준, 정다은) → P2002 409; also exposed to that spec's afterAll cycle deletion | Both peer-review describes create their own cycle (`createTestCycle`, unique name) + `cleanupTestCycle` in afterAll |
| `hire-wizard.spec.ts:54` (added 5/26, never green in CI) | `dialog.getByRole('button').last()` = Radix Dialog X-close (DOM-last, always enabled), not the wizard primary | `dialog.getByRole('button', { name: '다음' })` (wizard ko label; e2e locale pinned ko) |
| `onboarding.spec.ts:24` | `/퇴직처리/` now matches 2 elements (page title "퇴직처리 현황" + empty-state "퇴직처리 데이터가 없습니다") → strict mode violation in `.or()` | Narrow regex to `/데이터가 없|No offboarding data/` + `.first()` on the or-locator |

### Class 4 — Real product bugs found by the debt (2 fixes)
**4a. `GET /api/v1/leave/team` RBAC fail-open** (`leave-requests.spec.ts:174`)
Page rule `/leave/team` = MANAGER_UP exists in `ROUTE_ACL`, but **no API rule** —
middleware passes any authenticated role, and the handler's `perm(LEAVE, VIEW)` is
satisfied by EMPLOYEE's `leave_read` (self-service permission). Net: any employee can
read the department leave calendar API (colleague names + leave dates/types).
**Fix (code)**: add `{ prefix: '/api/v1/leave/team', allowedRoles: ROLE_GROUPS.MANAGER_UP }`
to the API section of `src/lib/rbac/rbac-spec.ts` (mirror of the page rule).
Spec already asserts 401/403 — turns green with no spec change.

**4b. my-result page crash — API/client contract mismatch** (`evaluation-forms.spec.ts:49`)
`GET /performance/reviews/my-result` returns `{ review: {...}, mboGoals: [...] }`;
`MyResultClient` stores it raw and renders a flat `ReviewResult` →
`result.goals.length` → `TypeError: Cannot read properties of undefined (reading 'length')`
→ error boundary (reproduced in headless browser; pageerror captured). **Any employee
with a review row in a result-phase cycle hits a dead page** — latent since the page
was built, exposed once blind-window specs started leaving qualifying cycles/reviews.
S272's flat↔nested class.
**Fix (code)**:
- Route: expose `cycle.mboWeight/beiWeight` (fields exist on PerformanceCycle) and
  `id` in the mboGoals select (client uses it as React key).
- Client `fetchResult`: map `{review, mboGoals}` → flat `ReviewResult`
  (`performanceScore←mboScore`, `competencyScore←beiScore`,
  `finalGradeEnum←finalGrade`, `reviewId←review.id`, `goals←mboGoals`).
- Codex Gate-1 P1: the API exposes only a single `score` (achievementScore) per goal,
  NOT separate self/manager scores. The goal row markup is corrected to show one
  "달성도" score (existing i18n key `achievement`) instead of mislabeling it as
  self/manager. The old self/manager/comment columns rendered undefined data.
- Codex Gate-1 P1 / Gate-2 P1: reset `result`/`peerResult` on cycle change AND guard
  against out-of-order responses with a `fetchSeqRef` sequence token (stale response
  from a previous cycle no longer overwrites the current view or leaks a prior reviewId).

### Flaky (observed, cheap hardening only)
`attendance-core.spec.ts:48/:79/:124` — S276 1-day-1-record vs cleanup ordering;
passed on retries in CI. Harden: delete employee-a's today-record in a `beforeEach`
of the two clock tests (was beforeAll-only). `golden-paths.spec.ts:98`
(net::ERR_ABORTED, one run) — observe only.

## Out of scope
- Local-only failures (ai-smoke ×4, off-cycle:213, onboarding:328) — pass in CI; local env artifacts (no redis etc.).
- `endDate:null` vs scheduled-LOA semantics (Class 1 note) — separate product track.
- main e2e 14건 칩(task_563b21fd)은 본 작업이 해소 — PR 후 dismiss.

## Files touched
Tests (8): loa-discipline-lifecycle, onboarding-lifecycle, payroll-adjustments-anomalies,
payroll-operations, peer-review-succession-competency, residual-cross-tenant (api) ·
hire-wizard, onboarding (flows) · attendance-core (hardening).
Code (3): `src/lib/rbac/rbac-spec.ts` (1 rule), `performance/reviews/my-result/route.ts`,
`performance/my-result/MyResultClient.tsx`.

## Verification
1. Reseed local replica → re-run all touched api specs + the 3 browser specs (must be green).
2. Full local api project run — no NEW failures vs today's baseline (locally-green set unchanged).
3. `npx tsc --noEmit` 0 · `npm run lint` 0.
4. Codex Gate 2 (`/verify`).
5. PR vs origin/main; CI e2e is the authoritative gate (now alive again).

## ⚠️ Session coordination (2026-06-10, two sessions converged)

A second session (CEO direct prompt, same 14-failure goal, branch
`fix/e2e-main-green-baseline` checked out in this worktree) independently reached the
identical triage and contributed the **test-file hunks now in the tree**: attendance-core
(racy edge test moved into serial flow — stronger than beforeEach hardening),
loa-discipline (state-machine describe → createTestEmployee; reject/cancel describe left
as-is — it never activates so it cannot fence assignments), onboarding-lifecycle
(per-test SUPER contexts + new HR_ADMIN→403 guard test + transferDate added so the
same-company 400 path is actually exercised), payroll-global (HR describe → 403; shape
asserts moved into SUPER test), payroll 2099-03/04 split via buildPayrollRun(prefix,
yearMonth), peer-review both sections → own cycles (2097 H1/H2; NOTE: no
cleanupTestCycle in afterAll — `request` fixture unavailable there, needs manual context
like perf-goals if you want it), residual payload fix, hire-wizard '다음', onboarding
.first(). MyResultClient + my-result route + rbac-spec final wording = first session's.
- Independent cross-checks that may save you time: e2e/.auth <1h cache reuses sessions
  minted by whatever server ran last on this machine (3002 dev ≠ 3102 replica secrets)
  → mass-401; `rm e2e/.auth/*.json` before local runs.
- Whichever session reaches the commit step first lands the PR; the other stands down
  (tree is shared, so commit serializes us). Verification results from either replica
  are interchangeable.
