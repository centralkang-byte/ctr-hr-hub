# Wave 1 — My Space Profile Rich-Fidelity (S311)

> **Branch**: `feat/wave1-myspace-richfidelity` (off main incl. #189)
> **Scope**: 1 bounded PR. Page = `/my/profile`. Prototype-100% fidelity using REAL data.
> **Prototype SSOT**: `_design-reference/page-my-profile.jsx`
> **Date**: 2026-06-14 · **Status**: design approved (CEO), pending Codex Gate 1

---

## Goal

PR #188 shipped `/my/profile` v1: worker banner + attendance/leave/performance **summary** tabs (KPI strips only). This follow-up lifts the page to prototype fidelity with four rich-fidelity additions, all backed by **real data** (no mock):

1. **받은 칭찬** (received recognitions feed)
2. **30일 출근 히트맵** (30-day attendance heatmap)
3. **다주기 평가이력** (multi-cycle evaluation history — grade, scores, **evaluator name + comment**, MBO achievement table)
4. **직무이력 분리** (full job/assignment history, separated from the career/education tab)

## Key discovery (drives the design)

Backend readiness is **better than the design assumption**. Three of four items are frontend-only against existing endpoints; the evaluator comment that the prototype shows already exists in the DB and only needs surfacing:

| Item | Endpoint (existing) | Verdict |
|------|--------------------|---------|
| Received recognitions | `cfr/recognitions/employee/[id]` → `recent[]` (senderName, coreValue, message, createdAt) | READY (bump take 5→6) |
| 30-day heatmap | `attendance/monthly/[year]/[month]` already returns per-day `days[]` (date, status…) — **the tab fetches it and discards `days`** | READY (frontend-only) |
| Multi-cycle history (grade/scores) | `performance/reviews/my-history` (all `notifiedAt!=null` cycles) | READY |
| Evaluator name + comment | `PerformanceEvaluation` (evalType=MANAGER): `evaluator.name` + `comment` — already authored at EVAL_OPEN, never surfaced | SURFACE (join, no new field) |
| MBO achievement table | `MboGoal` (title, weight, achievementScore, status) per cycle | EXTEND `my-history` with aggregation |
| Job/assignment history | `employees/[id]/history` (full `assignments[]` + relations, self-scoped) | READY |

**CEO decisions (2026-06-14):**
- Prototype 100% fidelity, **1 bounded PR**.
- Evaluator/comment = **surface existing `PerformanceEvaluation`(MANAGER)** (NOT a new field — would be redundant with the manager's `overallComment`).
- Heatmap window = **current calendar month** (zero extra fetch; render the `days[]` already returned by `monthly`).

---

## Backend changes (multi-tenant → Codex Gate 2 mandatory)

### B1. Extend `GET /api/v1/performance/reviews/my-history`
`src/app/api/v1/performance/reviews/my-history/route.ts`

Current: returns one item per published review (`notifiedAt!=null`) with cycle + scores + grade.

First compute `publishedCycleIds = reviews.map(r => r.cycle.id)` (already gated to `notifiedAt!=null`). **If `publishedCycleIds` is empty, skip the two queries below entirely.** Both queries are scoped to `cycleId: { in: publishedCycleIds }` (Gate-1 P1-2: defense-in-depth so unpublished comments/goals never enter app memory, and the "published-only" boundary is explicit in the query, not just the mapping).

- **`evaluatorName` + `comment`** (Gate-1 P1-1, P1-2): single batched query —
  `prisma.performanceEvaluation.findMany({ where: { employeeId: user.employeeId, companyId: user.companyId, evalType: 'MANAGER', status: { in: ['SUBMITTED','CONFIRMED'] }, cycleId: { in: publishedCycleIds } }, select: { cycleId, comment, status, submittedAt, id, evaluator: { select: { name } } } })`
  → **deterministic reducer per cycle** (no `@@unique` on (cycleId,employeeId,evalType); manager reassignment can yield multiple): pick CONFIRMED over SUBMITTED → then `submittedAt` DESC (nulls last) → then `id` DESC → take first. Attach to the matching published item. Null-safe (`comment` may be null / no manager eval → omit gracefully).
- **MBO aggregation** (Gate-1 P1-2, P1-3): single batched query —
  `prisma.mboGoal.findMany({ where: { employeeId: user.employeeId, companyId: user.companyId, cycleId: { in: publishedCycleIds } }, select: { cycleId, title, weight, achievementScore, id } })`
  → group by `cycleId`; compute:
  - `mboGoalCount` = goals in cycle
  - `mboAchievement` = `Σ(achievementScore × weight) / Σ(weight)` **over goals where `achievementScore != null` AND `weight > 0`**. If no valid goal or `Σweight == 0` → **`null`** ("해당없음"). **Do NOT fall back to `review.mboScore`** — mboScore is a calculated evaluation score, not an achievement %, and conflating them is dishonest. If a separate "MBO 평가 점수" display is wanted it stays the existing `mboScore` field with its own label.
  - `mboKeyGoals` = top 2 titles, sorted `weight` DESC then `id` (deterministic tie-break)

**N+1 avoidance**: two `findMany` calls total (not per-cycle), keyed/grouped in memory. Prisma `Decimal` math stays Decimal/number internally; convert at the response boundary only. No new masking concern — the route has its own `select`; `calibrationNote`/`originalGrade` are never selected. The manager `comment` is the manager's overall evaluation feedback (the employee-private field is `calibrationNote`, which stays unselected). **Policy note**: surfacing `PerformanceEvaluation(MANAGER).comment` to the employee is the explicit intent of this PR (CEO-approved); it is gated identically to scores (only `notifiedAt!=null` cycles).

Response item shape (additive):
```ts
{ cycleId, cycleName, year, half, label, mboScore, beiScore, totalScore, finalGrade, finalGradeLabel,
  evaluatorName: string | null, comment: string | null,
  mboGoalCount: number, mboAchievement: number | null, mboKeyGoals: string[] }
```

### B2. `GET /api/v1/cfr/recognitions/employee/[id]`
`src/app/api/v1/cfr/recognitions/employee/[id]/route.ts`

- Bump `take: 5` → `take: 6` on the `recent` query (prototype "최근 6건"). No other change; self-scope IDOR guard (#187) untouched.

**Out of scope (backend)**: no schema migration, no new field, no new route. `attendance/monthly`, `employees/[id]/history` unchanged.

---

## Frontend changes

### F1. Performance tab — `src/app/(dashboard)/my/profile/ProfilePerformanceTab.tsx`
Keep the current latest-cycle KPI strip; **add three sections below it** (prototype `perf` tab):

- **평가 이력** (`page-my-profile.jsx:357-381`): list from `my-history` — large grade badge + `period` + `evaluatorName` + `comment` (italic) + "상세" link to `/performance/my-result`. Render only items where data exists; comment optional.
- **MBO 달성 이력** (`:384-416`): table from `my-history` MBO agg — cols: cycle period, `mboGoalCount`, `mboAchievement%` (right, colored), `mboKeyGoals` joined. Last ~4 cycles.
- **받은 칭찬** (`:419-444`): feed from `cfr/recognitions/employee/{user.employeeId}` → `recent[]` — Heart-icon avatar + "{senderName} 님이 칭찬했어요" + message (italic) + `coreValue` chip + relative date.

Loading/error/empty 3-state per `rules/components.md` (reuse `KpiCardsSkeleton`, `EmptyState`).

### F2. Attendance tab — `src/app/(dashboard)/my/profile/ProfileAttendanceTab.tsx`
Keep KPI strip. **Add current-calendar-month heatmap** from the `days[]` already in the `monthly` response (currently discarded):

- Grid `repeat(10, 1fr)` square tiles, color by status (present/late/absent/leave). Status→token map (NOT raw hex — use semantic tokens per `rules/design.md`). Legend row below.
- Status color via SSOT (`status.ts` / semantic tokens); `aria` per-day title; color+text legend (not color-only — a11y).
- No extra fetch. Days with `status===null` render as neutral/empty tiles.
- **Label = "이번 달" / "this month", NOT "최근 30일"** (Gate-1 P2 — current-month ≠ rolling-30 per CEO decision; copy must match reality).
- **Timezone (Gate-1 P2 + [[hrhub-attendance-naive-timestamp-tz]])**: the `monthly` response `days[].date` are `YYYY-MM-DD` strings already KST-corrected by the server. Use the date string **directly as the tile key/label** — do NOT `new Date('YYYY-MM-DD')` (parses as UTC → off-by-one). Month selection uses `formatToTz(..., 'Asia/Seoul')` (already done in the tab) so UI month == endpoint month.
- **Display rules**: unknown/unmapped status → neutral tile; future dates in the current month → empty/neutral (no data); empty month → keep the existing `empty` EmptyState (no heatmap).

### F3. Job history separation — `MyProfileClient.tsx` (+ reuse `src/components/shared/AssignmentTimeline.tsx`)
Current "career" tab uses `employeeHistories` (max 10, server-fetched). Replace the assignment-timeline portion with the full history from `employees/[id]/history` (`id = user.employeeId`), matching prototype "직무 발령 이력" (`:156-182`): type → date → from→to → reason. Reuse `AssignmentTimeline`. Keep education/cert/skills where they are (the "분리" = job assignments get their own complete, real timeline rather than the truncated 10-row history).
- Decide fetch site during impl: client fetch in the tab (consistent with other tabs) vs extend `page.tsx` server fetch. Lean client-fetch for tab-lazy consistency.
- **Tenant check (Gate-1 P2)**: `employees/[id]/history` is called with `id = user.employeeId` (self) so cross-employee leak is impossible. Verify during impl that the route's self path returns the employee's own assignments only (a self career history that spans company transfers is correct for the subject; confirm it does not widen to other employees).

### F4. i18n — `messages/{ko,en,zh,vi,es}.json`
Add-only keys under `mySpace.profile` (existing `attendanceTab`/`performanceTab`/`leaveTab` siblings):
- `performanceTab.history*` (evalHistory title, evaluator label, viewDetail, mboHistory title, col headers, recognitions title, "{name} 님이 칭찬했어요", empty states)
- `attendanceTab.heatmap*` (title, legend: present/late/absent/leave)
- `profile.jobHistory*` (if new labels needed beyond existing `careerTimeline`/`changeType`)
Korean = friendly tone; other 4 locales translated. **No edits/deletes to existing keys** (i18n lock).

---

## Data integrity & security (Codex Gate 2 focus)

- **Publication gate**: `my-history` already filters `notifiedAt: {not:null}`; comment + MBO derive only from those cycles → no pre-publication leak. Recognitions feed is self-scoped (#187 IDOR guard).
- **Multi-tenant**: every added query carries `companyId: user.companyId` (+ employeeId self-scope). No `companyId` from query param. No cross-tenant read.
- **Masking**: manager `comment` is feedback intended for the employee; `calibrationNote` (HR calibration reasoning) remains unselected/masked.
- **Self-scope only**: `/my/profile` always renders the logged-in employee; `employees/[id]/history` called with `user.employeeId`.

## Tests (Gate-1 P1-4 — publication boundary is a former P0 class)
Add API tests for the extended `my-history` (mirror existing performance e2e/spec style):
- Unpublished cycle's MANAGER comment is **absent** from the response.
- Mixed published/unpublished cycles → only published cycles returned (and only their comments/MBO).
- Multiple MANAGER evals for one cycle → **deterministic** selection (CONFIRMED > submittedAt DESC > id DESC).
- MBO edges: all-null `achievementScore` → `mboAchievement=null`; zero/blank weight; partial scores; empty goals (`mboGoalCount=0`).
- Payload never contains `calibrationNote` / `originalGrade` / unpublished review fields.

## Verification gates
1. **Codex Gate 1** ✅ done (verdict: Request Changes → 4 P1 + P2 incorporated above).
2. Implement → `/verify` (tsc 0 · lint 0 · `prisma migrate status` — no migration here · pattern rules · **Codex Gate 2**).
3. **Pixel Gate**: serve prototype, side-by-side the `perf`/`attendance`/`job` tabs; record intended deltas (real data vs mock — e.g. heatmap = this-month not rolling-30).
4. Multi-role dogfood: `employee-a@ctr.co.kr` (own published cycle, recognitions, heatmap, job history) + cross-check a role with no published result → graceful empty. `super@ctr.co.kr` sanity.

## Files
**Modify (backend)**: `performance/reviews/my-history/route.ts`, `cfr/recognitions/employee/[id]/route.ts`
**Modify (frontend)**: `ProfilePerformanceTab.tsx`, `ProfileAttendanceTab.tsx`, `MyProfileClient.tsx`, `messages/{ko,en,zh,vi,es}.json`
**Reuse**: `AssignmentTimeline.tsx`, `WdStatStrip`, `EmptyState`, `Badge`/`StatusBadge`, `status.ts` tokens
**Possibly new**: small presentational components for heatmap grid / recognition item / eval-history item (co-located or `src/components/shared/`)

## Risks / open items (resolve during impl)
- **MBO achievement semantics**: `achievementScore` unit (0–100 vs 0–1 vs can-exceed-100). Confirm against seed/real data so the `%` renders correctly. **No `mboScore` fallback** (Gate-1 P1-3) — `null`/"해당없음" when no valid per-goal score.
- **Job history fetch site** (client vs server) — lean client.
- **Heatmap tile tokens**: must use semantic status tokens, not prototype raw `oklch`/hex (design rule).
- Prototype "career" tab also lists education/certs/training; those are separate data (profileExtension) — keep as-is, only the assignment timeline is upgraded.
