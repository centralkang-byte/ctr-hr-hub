# Wave 1 IA — PR-4 Attendance 추세 (Trends) tab — 2026-06-13 (rev2, post-Codex-Gate1)

> Stacked on **PR-3B (#180, branch `design/wave1-attendance-admin-weekly-ui`)** — adds a 3rd tab to the same
> `AttendanceAdminClient`. Program: S301 attendance/leave proto-fidelity (`2026-06-13-wave1-attendance-leave-fidelity.md`).
> **CEO decision (S302)**: ship the operational distribution metrics now; **defer attendance-rate % to PR-4b**.
> rev2 incorporates Codex Gate 1 (10× P1). The rate engine (P1-1..P1-5) is explicitly out of scope → PR-4b.

## Scope (Option A — operational metrics, no rate)

Three blocks, all aggregated **directly from `Attendance` / `LeaveRequest` rows that already carry `companyId`**
(authoritative tenant attribution → no eligibility/denominator engine, no cross-tenant mis-attribution):

- **Block A — 부서별 근태 비교 (최근 30일)**: per-dept 지각(회) / 결근(회) / 평균 출근 / 평균 퇴근 / 평균 OT.
  **No 출근율 column** (deferred to PR-4b).
- **Block B — 출근 시각 분포 (최근 30일)**: 15-min arrival-time histogram (clockIn local time-of-day).
- **Block C — 근태 유형 추이 (최근 6개월)**: monthly **counts** (건수) of 정상/지각/결근 (from Attendance) + 휴가
  (approved LeaveRequest days). Counts, **not** percentages (no denominator).

This makes "추세" honest: a temporal trend (C) + two 30-day distributions (A, B), every number traceable to a query.

### DEFERRED → PR-4b (attendance-rate % engine)
Monthly attendance-rate % (12-month) + per-dept rate column. Requires a per-employee-day **eligibility engine**:
assignment-history attribution (P1-2), per-employee `[hireDate, resignDate]` intersection (P1-1), current-month
cap at today (P1-3), leave clamp to [0,1] per employee-day (P1-4), shift/overseas work-week handling (P1-5).
Build as `src/lib/attendance/eligibility.ts` with unit fixtures. Out of scope here.

## Why direct row aggregation, not the analytics MV
Existing `src/lib/analytics/queries.ts` helpers all read `mv_attendance_weekly`, which is **unapplied**
([[hrhub-rls-mv-reapply-truth]]) → `safeMvQuery` returns `[]`. The live analytics page renders via the **direct**
`/api/v1/analytics/attendance/overview`. PR-4 mirrors the direct approach but aggregates in **grouped SQL**
(not `/overview`'s unbounded Node row-load). Keep-live: analytics page calls only `/overview` + `/companies`
→ PR-4 is a separate endpoint, zero regression.

## Locked definitions (Codex Gate 1 fixes applied)

### Shared conventions
- **Company-local calendar/tz** from `AttendanceSetting.timezone` (default `Asia/Seoul`). Use `src/lib/timezone.ts`
  + `resolveDayContext(companyId, now)`; never raw `new Date()` for tz math; never legacy KST+9.
- **Multitenant (P1 dim-1)**: EVERY query filters `company_id = resolveCompanyId(user, companyId)`. Dept attribution
  picks **exactly one** assignment per employee — `DISTINCT ON (ea.employee_id) ... ORDER BY ea.employee_id,
  ea.effective_date DESC` over `employee_assignments` scoped `company_id + is_primary + end_date IS NULL +
  effective_date ≤ now`, JOINed to `departments d ON d.id = ea.department_id AND d.company_id = $companyId`
  (r2-P1-4: prevents attendance double-count on duplicate active-primary rows + blocks any cross-tenant dept name).
  A dual-company concurrent-assignment employee is never attributed/leaked. Attendance/Leave rows are authoritative
  per `companyId` (transferred employees' old rows stay with the old company).
- **No raw-row load (P1-7)**: all aggregation in **grouped SQL** (`$queryRaw`), bounded output (per-dept / per-bucket
  / per-month). No `findMany` of raw attendance into Node.
- **TZ conversion (r2-P1-1)**: `clock_in`/`clock_out` are `timestamp(3)` (no tz) holding **UTC**. Convert to company
  wall-clock with `(clock_in AT TIME ZONE 'UTC') AT TIME ZONE $tz` (interpret-as-UTC, then to local) for BOTH the
  avg-in/out and the histogram bucket math. A single `AT TIME ZONE $tz` is wrong-direction.
- **Cohort suppression (P1-9, r2-P1-2)**: omit any dept with `COUNT(DISTINCT employee_id) < 5`. Additionally each
  averaged metric (avg-in / avg-out / avg-OT) is returned **only if `COUNT(DISTINCT employee_id with a non-null
  value for THAT metric) ≥ 5`, else `null`** (a 5-person dept where 1 person clocked in must not expose that person).
  UI shows "5인 이상 부서만 표시". Sparse histogram buckets merged into overflow.
- **No cache (P1-8)**: drop `withCache` — matches the uncached weekly sibling (`/attendance/admin`, `/admin/weekly`).
  Avoids the "cache-hit-skips-authorization" C3 violation. Performance handled by SQL aggregation + the new index.

### Block A — 부서별 근태 비교 (30일), per company-scoped active-primary-assignment dept
- 지각 = `COUNT(status='LATE')`, 결근 = `COUNT(status='ABSENT')` — labeled **"기록된 결근"** (ABSENT rows may be
  incomplete if no nightly no-show job exists — P2-4 caveat noted in PR + UI).
- 평균 출근 / 평균 퇴근 = mean of `clockIn`/`clockOut` **company-local time-of-day**. **Limitation (P2-3)**: night/
  mixed-shift depts (overnight wrap) are misrepresented by arithmetic mean → for `shiftEnabled` companies, omit
  avg-in/out (or label "교대 제외"). Documented; circular-mean deferred.
- 평균 OT = `AVG(overtime_minutes)/60` h.
- One grouped `$queryRaw`: JOIN assignments (company-scoped) → `GROUP BY department`, returns per-dept aggregates
  + `COUNT(DISTINCT employee_id)` for cohort gate.

### Block B — 출근 시각 분포 (30일)
- 15-min buckets of `clockIn` local time-of-day via `floor(extract(epoch from (clock_in AT TIME ZONE $tz)::time)/900)`,
  `GROUP BY bucket`. Overflow buckets for very-early / very-late; null clockIn excluded.
- **Reference line** at `AttendanceSetting.workStartTime` (default 08:30). **No per-individual on-time/late claim**
  (P1-10): real 지각 judging uses per-employee ShiftSchedule + grace; for `shiftEnabled` companies omit the line.
  Buckets after workStartTime may be tinted as a neutral cue labeled "기준시각 이후", not "지각".

### Block C — 근태 유형 추이 (6개월, counts)
- Attendance status counts: `SELECT date_trunc('month', work_date) m, status, COUNT(*) GROUP BY m, status`.
  **EARLY_OUT shown as its own 조퇴 series (r2-P1-6 — NOT folded into 정상)** → 4 series 정상(NORMAL)/지각(LATE)/
  조퇴(EARLY_OUT)/결근(ABSENT). `work_date` is UTC-midnight date-only → `date_trunc('month', work_date)` needs **no tz
  conversion** (Codex-confirmed safe).
- 휴가: **approved-leave REQUEST count by `startDate` month** (`LeaveRequest status='APPROVED'`, company-scoped) —
  NOT day-allocation (r2-P1-3: cross-month `days` allocation w/ half-day/weekend/holiday rules is ill-defined; a
  request-count by start month is well-defined and honest). Labeled "휴가 신청(건)".
- Counts labeled 건수 — no percentages. Multitenant clean: counts keyed by row `companyId`.

## RBAC
NEW `GET /api/v1/attendance/admin/trends`, gated **identically to PR-3A weekly**:
`withPermission(handler, perm(MODULE.ATTENDANCE, ACTION.APPROVE))` + explicit
`if (role !== HR_ADMIN && role !== SUPER_ADMIN) throw forbidden(...)`. EXECUTIVE excluded (att-05). SUPER may pass
`?companyId=` via `resolveCompanyId`. Param validation mirrors weekly (`isRealDate`, regex). NO cache. Reusing the
MANAGER_UP analytics endpoint rejected (wider role + MV-empty).

## Schema change (Codex P1-6, r2-P1-5) — index migration IN SCOPE (CEO-confirmed)
Add two additive indexes (company-scoped range queries currently seq-scan):
- **`@@index([companyId, workDate])`** on `Attendance` (only `[employeeId, workDate]` exists today).
- **`@@index([companyId, status, startDate])`** on `LeaveRequest` (only `[employeeId, status]` exists; Block C
  filters company+status+startDate).
Migration `migrations/<ts>_attendance_leave_trend_idx/migration.sql` (plain `CREATE INDEX`, hand-authored).
- 🚧 `prisma/schema.prisma` is a gate file — **additive indexes only**, no column/table change. Indexes do not
  change the generated Prisma client (code compiles/runs without them).
- **Application path (r2-P1-5)**: Vercel build does NOT run `prisma migrate deploy`, so "applied at deploy" is not
  automatic. Reality: this shared cluster ([[hrhub-shared-db-topology]]) already carries pending-apply migrations,
  and prod is **disposable pre-launch** ([[hrhub-prod-db-disposable-prelaunch]]) — the planned launch wipe+migrate
  applies all committed migrations together. So: commit schema+migration; the index lands at the next full migrate
  (launch rebuild) or via a manual `CREATE INDEX` op when scale warrants. At current dogfood data scale a seq scan
  is fine → **PR-4 code is correct and ships without the index applied**. `/verify` `migrate status` will list these
  as pending (expected/documented). Do NOT run `migrate dev` against the shared cluster from the worktree (no `.env`).

## Files (~10)
1. **NEW** `src/lib/attendance/trends.ts` — bucket/calendar helpers (pure, unit-testable) + aggregation orchestration.
2. **NEW** `src/app/api/v1/attendance/admin/trends/route.ts` — endpoint (grouped `$queryRaw`, HR-only, no cache).
3. **EDIT** `AttendanceAdminClient.tsx` — 3rd `TabsTrigger value="trend"` (`t('weekly.trendTab')`) + `<TabsContent>`.
4. **NEW** `AttendanceTrendsTab.tsx` — 3 blocks; full loading/error/empty 3-state; **fabricated-data guardrail**
   (empty backend → EmptyState, never generated points); mobile horizontal-scroll.
5. **EDIT** `messages/{ko,en,zh,es,vi}.json` — `attendance.weekly.trendTab` + `attendance.trend.*` (block titles,
   avgIn/avgOut, cohortNote, histogram axis/legend, status-type labels). Add-only; reuse `late`/`absent`/`overtime`.
6. **NEW** `e2e/api/attendance-trends.spec.ts` — tenant isolation, RBAC (HR-only; EXECUTIVE 403; EMPLOYEE 403),
   response shape, cohort suppression (<5 dept omitted), empty-company empty arrays.
7. **EDIT** `prisma/schema.prisma` (+migration) — `@@index([companyId, workDate])` on Attendance +
   `@@index([companyId, status, startDate])` on LeaveRequest.

## Design / visual (DESIGN.md Wave 0)
- Cards = `bg-card border border-border rounded-2xl` (match sibling tabs). Charts: recharts + `CHART_COLORS`
  (`@/lib/styles/chart`). **NO raw oklch** (proto used oklch → semantic tokens: success/`text-ctr-warning`/
  `text-destructive`, D17 bg/text split). Number = `TYPOGRAPHY.stat` + `AnimatedNumber`. Pixel Gate vs proto trend.

## Verification
tsc=0 · lint=0 · `prisma migrate status` = pending index migration (documented, not a code failure) · rules patterns · **Codex Gate 2**
(`/verify`) · **Pixel Gate** (proto trend side-by-side — note rate block intentionally absent) · multi-role dogfood
(super@ + hr@ render; employee-a@ 403) · E2E green. Confirm real data renders before claiming done.
