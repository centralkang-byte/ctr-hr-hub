# Wave 1 IA — Attendance / Leave Proto-Fidelity (full scope) — 2026-06-13

> **CEO decision (S301)**: full scope = frontend 정합 + 진짜 adopt + **backend builds** + in-cluster bug fixes.
> Sequence in the Wave 1 IA track, after employees-org (PR #174/#175). Governing principle (same as
> sidebar/employees): adopt proto IA where data exists; **build backend** where the proto shows data that
> genuinely doesn't exist (never fabricate mock); **keep-live, never delete** the live operational depth the
> single-persona proto can't express.

## Ground truth (recon `attendance-cluster-recon` wf_041487d2 + main-session verify)

The proto attendance/leave pages are **single-persona HR mocks with fabricated data**; live is far richer.
Verified facts (file:line):

- **Proto `page-attendance.jsx` = HR/admin view**; its 8-emp×7-day 주간 그리드 is `generateWeekGrid()` pseudo-random
  mock (lines 6-48); the entire 추세 view is hardcoded literals (371-385, 445-452, 483-493).
- Live attendance endpoints that touch multiple employees are **today-only**: `/api/v1/attendance/admin`
  (KPI + ≤20 anomalies, `admin/route.ts:55-101`), `/api/v1/attendance/team` (today, manager-dept,
  `team/route.ts:79-85`). Only `/api/v1/attendance/weekly-summary` returns a week — **self only**
  (`employeeId: user.employeeId`, `weekly-summary/route.ts:41`).
  → **multi-employee weekly matrix does not exist** = backend build (over existing `Attendance` columns).
- Proto `/leave` is **HR-admin-facing**; live `/leave` is the **personal** surface, admin = `/leave/admin`,
  team = `/leave/team` (intentional RBAC split). Target admin/team, not the personal page.
- Leave team data: `/api/v1/leave/team` returns per-member `requests[]{startDate,endDate,days,status}`
  (`team/route.ts:98-112`) — **Gantt data exists** (dept+month+pending/approved scope), rendered today as
  stacked text rows. 전사 multi-week = backend widen (defer).
- **LoA file-upload "frontend gap" is FALSE.** `proofFileUrl` is a string column (`schema:6700`); the apply
  route persists it (`leave-of-absence/route.ts:116`); but there is **no upload pipeline** — the generic
  presigned route (`files/presigned/route.ts`) has zero consumers, is perm-gated `EMPLOYEES.UPDATE`
  (`:47`, an EMPLOYEE self-applying is forbidden), takes a UUID `entityId` (no LoA id exists at apply time),
  no reusable FileUpload component, and **AWS creds are empty** in env. = backend+infra build.

### Confirmed bugs (independent of proto, fix in-program)
1. 🔴 **LoA requiresProof types un-submittable.** UI shows "증빙 필요" hint (`LoaClient.tsx:510-521`) but
   `handleRequest` never sends `proofFileUrl` (`:152-158`) → `route.ts:85` hard-400s. **8 of 9 KR statutory
   LoA types have `requiresProof:true`** (육아·출산·가족돌봄·질병·산재·병역·학업 — `default-types.ts`); only 개인사유 submits.
   **Dogfood blocker** — fixed by the file-upload PR (PR-5).
2. 🟠 **LeaveTeamClient malformed Tailwind** `bg-emerald-500/15/30`, `bg-orange-500/10/30`, `bg-destructive/10/30`
   (`LeaveTeamClient.tsx:322,324,326`) — double opacity, invalid → row highlight never renders. Fix in PR-1.
3. 🟡 **LB1 residual** — MySpace landing `my/page.tsx:40` reads legacy `EmployeeLeaveBalance` → stale 잔여 연차.
   Belongs to the separate leave-dual-table track; **out of scope here** (cross-ref only).

## Guardrails
- `src/config/navigation.ts` FROZEN — no structural sidebar change in this program.
- `messages/*.json` add-only (ko tone only; other locales untouched).
- All new endpoints: `resolveCompanyId` + `withPermission` (HR scope for admin weekly/roster/trend; self/manager otherwise) + cache where read-heavy.
- AttendanceStatus enum stays NORMAL/LATE/EARLY_OUT/ABSENT — leave/반차 cells = derived overlay (leave-table join), never an enum value.
- Keep-live (NEVER delete): 52h alert resolution, shift-roster/calendar/swap, #144 correction WdDrawer, approvals inbox, payroll close-attendance, LOA 7-state lifecycle, accrual/promotion/designated settings, negative-balance table, burndown forecast, balance-preview drawer.

---

## PR sequence (revised per Codex Gate 1, 2026-06-13)

> Codex withheld approval until 5 specs are written into the plan: LoA interim behavior, weekly-endpoint
> contract, leave-overlay semantics, cache isolation, upload ownership model. All added below.
> Sequencing change: **interim LoA unblock first (no S3)**; split PR-3 (contract vs UI) and PR-5 (infra vs integration).

### PR-0 — LoA submission recovery (interim, NO S3) — unblock the dogfood blocker first
The blocker (8/9 statutory types un-submittable) must not wait for the heavy upload pipeline.
- **Decision (CEO)**: move `requiresProof` enforcement from the SUBMIT step to the APPROVE step — employee can
  submit a requiresProof request; HR cannot APPROVE until proof is on file (flag "증빙 미제출" in the queue).
  Alternative (weaker): accept a proof URL/note text field at submit. Recommend the submit-allowed/approve-gated path.
- Files: `src/app/api/v1/leave-of-absence/route.ts:85` (relax submit 400), `[id]/route.ts` approve handler
  (add proof gate), `LoaClient.tsx` (hint copy + approve-side warning). E2E: each requiresProof type submits.
- Effort S. No infra. Fixes the blocker independently of PR-5/6.

### PR-1 — Visual 정합 sweep (split: correctness fixes vs subjective swaps)
Mirrors #167/#169/#171 but Codex P1-9: do NOT call it "mechanical" wholesale.
- **PR-1a (correctness, ship-first)**: fix malformed double-opacity classes (`LeaveTeamClient.tsx:322,324,326`);
  kill 2 banned `border-l-4` urgency cards (`AttendanceTeamClient.tsx:159`+raw `#FF9800`, `LoaClient.tsx:692-711`);
  deprecated `STATUS_VARIANT` span → `<StatusBadge>` (`LeaveTeamClient.tsx`). These are real defects, not taste.
- **PR-1b (token/radius)**: ~60 raw palette literals → semantic tokens; ~18 `rounded-xl` → `rounded-2xl`.
  Separate protected/high-risk pages from simple swaps; require light/dark × role screenshots (no contrast/hierarchy regress).
Mirrors #167/#169/#171. IA-preserving, mechanical.
- ~60 raw named-palette literals (`text-red-500`/`bg-emerald-500/15`/`text-amber-500`…) → semantic tokens
  (`text-destructive`/`text-ctr-warning`/success token) across attendance/* + leave/* + leave-of-absence/*.
- ~18 card `rounded-xl` → `rounded-2xl` (3-tier rule).
- **Kill 2 banned `border-l-4` urgency cards**: `AttendanceTeamClient.tsx:159` (+ raw `#FF9800`),
  `LoaClient.tsx` KpiCard `:692-711` → icon-tint KPI.
- Deprecated `STATUS_VARIANT` raw `<span>` badge → `<StatusBadge>` (`LeaveTeamClient.tsx:29,76-81,344-350`).
- **Fix malformed double-opacity classes** (`LeaveTeamClient.tsx:322,324,326`).
- Files: ~15-20 client files. **No data/IA change.** Effort L (mechanical). Pixel Gate + visual snapshot.

### PR-2 — Leave team-calendar Gantt + LoA paid/unpaid (frontend adopt, data exists)
- `LeaveTeamClient.tsx`: rebuild stacked text rows → proto positioned-bar day-grid (leftPct/widthPct) from
  existing `/api/v1/leave/team` payload. Dept+month scope (matches RBAC). 전사 multi-week = deferred.
- `LoaClient.tsx`: render `payType`/`payRate` (already in schema `:6653-54,6695-96` + types API) as badge in
  list + type-picker. (S, pure frontend.)
- Effort M. Pixel Gate.

### PR-3A — Attendance admin backend: weekly endpoint + roster endpoint (contracts, no UI)
- **NEW** `GET /api/v1/attendance/admin/weekly` — see **Contract C1** below. HR_ADMIN/SUPER (EXECUTIVE? decide),
  resolveCompanyId, cursor-paginated, 2–3 bulk queries + in-memory merge, leave overlay per **Contract C2**.
- **NEW** `GET /api/v1/attendance/admin/roster?date=` (do NOT mutate `/attendance/admin` anomaly contract — Codex P1-2):
  full today roster (active-per-date employees + today attendance + leave overlay), additive endpoint.
- Cache per **Contract C3**. E2E for both endpoints (tenant isolation, RBAC, pagination, overlay correctness).
- Effort L. Codex per-PR (Gate 2). No frontend.

### PR-3B — Attendance admin UI: 3-tab shell + roster + weekly grid (+ keep-live regression tests)
- `AttendanceAdminClient.tsx`: 3-tab shell (오늘/주간/추세 — 추세 lands in PR-4), today stat-strip (4 cards; 휴가/외근
  from roster leave overlay), full roster list (from roster endpoint), weekly grid (from weekly endpoint) +
  **page-scoped** outlier cards (labeled, client-derived from current page — Codex P1-1). Wire #144 correction
  drawer onto roster row click. **Weekly grid mobile**: horizontal-scroll/card-reflow defined upfront (Codex P2-2).
- **KEEP-LIVE acceptance = explicit tests** (Codex P1-8): correction drawer #144 reachable, 52h alert resolve,
  loading/error/empty states, RBAC routes, existing mutations — assert, don't eyeball.
- Effort L. Pixel Gate + visual snapshot (light/dark × roles).

### PR-4 — Attendance 추세 tab (backend aggregations) — heaviest, define metrics first
- Metrics: monthly attendance-RATE % (present-days/expected-work-days), per-dept comparison
  (rate/late/absent/avg-in/avg-out/OT), arrival-time histogram (15-min buckets from raw clockIn).
- **Decision**: prefer **direct aggregation queries** (cached) over new MV columns — `mv_attendance_weekly`
  is "awaiting first apply" ([[hrhub-rls-mv-reapply-truth]]); `safeMvQuery` swallows 42P01 → []. Avoid an
  MV-apply dependency. Reuse existing `getOvertimeByDepartment`/`getAttendanceIssues` where they already work.
- Keep-live: analytics page weekday×hour heatmap + leaveUsage/negativeBalance KPIs (don't regress).
- Effort L-XL. **Risk: confirm MV/analytics data renders before claiming done.** Candidate to split/defer if MV story blocks.

### PR-5 — File-upload infrastructure (S3 provisioning + self-scoped presigned) — independent of LoA
- Provision S3 (AWS creds empty → blocker for end-to-end; or a local/blob fallback for dogfood). Confirm
  `getPresignedUploadUrl`/`buildS3Key`/`validateFile` path. Add upload ownership model per **Contract C4**.
- Self-scoped presigned path: LoA/LEAVE self-service (not `EMPLOYEES.UPDATE`). Reusable `FileUpload`
  component/hook (presigned-PUT). Security review (touches perm + upload). Orphan-cleanup + scan policy noted.
- Effort M (+infra). **Gated on S3 provisioning decision (CEO).**

### PR-6 — LoA proof upload integration (depends on PR-5)
- Wire `FileUpload` into LoA request dialog (`LoaClient.tsx:497-539`); flow fix per **Contract C4** (no LoA id at
  apply time → client UUID/employeeId as `entityId`, upload→get URL→submit with `proofFileUrl`). Re-tighten
  `requiresProof` to submit-time once upload works (reverts the PR-0 interim). E2E: each requiresProof type
  uploads + submits.
- Effort S-M. Security review.

---

## Contracts (Codex Gate 1 — write before building)

### C1 — Weekly endpoint `GET /api/v1/attendance/admin/weekly`
- Exactly 7 local work-dates (company-tz), `?week=YYYY-MM-DD` (week-start) param.
- **Cursor pagination** by stable employee ordering (NOT offset — roster shifts). Hard page size 25–50. Optional `?departmentId=`.
- Exactly **2–3 bulk queries** then in-memory merge: (1) page of employees (active-per-date, ordered), (2) bulk
  `Attendance.findMany` for those IDs × week range, (3) bulk approved-leave for same IDs × overlapping range. **No per-employee queries.**
- Outlier cards are **page-scoped** unless a separate full-population aggregate is added; label accordingly.
- Instrument response size + query duration. `totalCount` only if UI needs it.

### C2 — Leave overlay semantics (grid + roster cells)
- Approved leave only (exclude cancelled/rejected). Inclusive start/end. **Company-local calendar dates**, not UTC truncation.
- Overlap query: leave.start ≤ weekEnd AND leave.end ≥ weekStart. Handle: half-day AM/PM, attendance+leave same day,
  multiple overlapping leaves, weekends + company holidays, overnight shifts, employee joining/leaving mid-week.
- A cell carries **multiple facts** (attendance state + leave overlay + non-working-day), never forced into `AttendanceStatus`.

### C3 — Cache isolation
- Key includes: resolved `companyId`, effective role/scope, department/manager scope, week/date, filters, cursor.
- **Authorize before cache; never cache-then-filter.** HR endpoints must not accidentally widen to MANAGER scope. Decide EXECUTIVE inclusion explicitly.

### C4 — Upload ownership model (PR-5/6)
- Presigned key must bind to `{companyId}/{self employeeId}/loa-proof/...`; reject cross-tenant/cross-employee
  entityId. entityId-before-record-exists: client UUID or self employeeId, validated server-side against the caller.
- EMPLOYEE may presign only their OWN proof; no read of others' keys.

### C5 — Trend metric definitions (PR-4, write before building)
- Attendance-rate denominator (expected work-days, excluding weekends/holidays/future/pre-join); leave/holiday treatment.
- Dept attribution for transferred employees; arrival-time tz + overnight; min cohort size for dept comparison;
  corrected-vs-original attendance. Direct cached queries; verify query plans/indexes; don't load company-wide raw rows into Node.

### Fabricated-data guardrail (Codex P2-4)
Every displayed aggregate must cite its API/query source in the PR. Empty backend → empty state; never generated
trend points, placeholder employees, or client-randomized values.

### Deferred (deferral register, not built here)
- Leave 사용 패턴 분석 tab (weekday/reason/monthly/dept-quartile) — XL, needs `LeaveRequest.reasonCategory` schema.
- Leave 전사 multi-week calendar; 미소진 알림 발송; leave/attendance excel export endpoints (verify-or-build later).
- Leave substitute(대체자) field. LB1 dual-table migration (separate leave track).
- Weekly-grid leave overlay edge cases beyond 휴가/반차 (출장/외근) if no source.

## Verification per PR
tsc=0, lint=0, `prisma migrate status` clean (no migration unless schema touched — none planned except possibly
none; weekly endpoint uses existing columns), rules patterns, **Codex Gate 2** (`/verify`), **Pixel Gate**
(proto side-by-side) for PR-1/2/3/4, multi-role dogfood (super@ + hr@ + employee-a@), E2E for new endpoints/flows.
