# Attendance & Org-change Policy Gates (S276)

> Created 2026-06-10 (S276). Source = S275 handover "Explicitly OUT of scope (CEO policy gates)" in
> `2026-06-10-attendance-orgchange-dogfood-fixes.md`, resolved via CEO decision gate (4 answers below).
> Status: **PLANNED — pending Codex Gate 1**.
> Branch: `feat/s276-attendance-policy-gates` stacked on `fix/s275-attendance-orgchange-dogfood` (PR #143 open;
> this work touches the same files #143 rewrote — execute route, attendance/[id], admin client — so stacking avoids conflicts).

## CEO decisions (2026-06-10 question gate)

1. **att-09 lateness judgment**: start with per-company base work hours — **default 08:30~17:30**. Shift workers
   judged against their assigned shift slot. Full flex-work settings UI = later.
2. **O3 bulk-movements execute deadlock**: **allow HR execution** (execution ≠ approval). Real submit→CEO-approve
   flow (like payroll #126/#128) = separate follow-up track.
3. **tr-01 dead single-transfer API**: **delete** (`/api/v1/employees/[id]/transfer` — 0 UI callers, in-place
   `updateMany` violates append-only assignments; bulk-movements covers transfers).
4. **ed-01 employee-detail silent no-op edit**: **remove the silently-stripped fields from the edit form**
   (dept/grade/status etc. change via 발령 only; add guidance note).

## Item 1 — att-09: wire lateness/early-leave judgment (largest)

Current state: `clock-in/route.ts:79` hardcodes `status:'NORMAL'`; `workTypeEngine.ts` has 0 importers; admin
anomaly list filters `LATE/EARLY_OUT/ABSENT` → pipeline never fires in live ops.

- **Schema (gated, migration required)**: `AttendanceSetting` (schema.prisma:5518) gains
  `workStartTime String @default("08:30")`, `workEndTime String @default("17:30")` (HH:mm). Non-breaking
  (defaults). Apply = migration file (record) + `db push` to shared DB per [[hrhub-migrations-no-zero-apply]].
- **New pure helper** `src/lib/attendance/judgeStatus.ts` (pure, unit-testable — per CLAUDE.md pure-function goal):
  `judgeAttendanceStatus({clockIn, clockOut, workDate, startHHmm, endHHmm, timezone}) → 'NORMAL'|'LATE'|'EARLY_OUT'`.
  - Scheduled start = workDate@startHHmm in company tz (absolute Date); scheduled end = workDate@endHHmm,
    **+1 day if endHHmm <= startHHmm** (night shift cross-midnight).
  - LATE if clockIn > scheduled start (no grace minutes for now — CEO chose minimal start).
  - EARLY_OUT if clockOut < scheduled end. Precedence when both: **LATE wins** (single enum column; note in code).
  - Timezone from `AttendanceSetting.timezone` (default Asia/Seoul) — partially pre-solves att-07.
- **Effective schedule resolution** (small helper in same file or sibling): `ShiftSchedule` row for
  (employeeId, workDate KST) → use slot `startTime/endTime`; else company `AttendanceSetting.workStartTime/EndTime`;
  else code defaults 08:30/17:30 (no AttendanceSetting row needed — avoids gated seed.ts).
- **clock-in route**: judge LATE at creation (status = LATE | NORMAL). `workType` stays `'NORMAL'`
  (Prisma WorkType = pay-category axis NORMAL/OVERTIME/NIGHT/HOLIDAY — NOT the engine's FIXED/FLEXIBLE/SHIFT/REMOTE;
  untouched in this PR).
- **clock-out route**: if record status is NORMAL and clockOut < scheduled end → EARLY_OUT (never downgrades LATE).
- **Manual correction PUT** (`attendance/[id]/route.ts`): when clockIn/clockOut changed and `status` NOT explicitly
  provided → recompute via the same helper (keeps HR corrections consistent). Explicit `status` wins.
  FE check: correction dialog must send `status` only when the user actually changed it.
- **Settings API + UI**: `settings/attendance/route.ts` zod + GET/PUT add the two fields;
  `AttendanceSettingsV2Client.tsx` basic work-hours section gains two `type="time"` inputs.
- **Out of scope**: ABSENT batch judgment (no-clock-in detection cron), retroactive re-judgment of existing rows,
  flex-work core-time UI, per-company tz beyond the existing `timezone` column, grace-minutes setting.

## Item 2 — O3: allow HR to execute bulk movements

`bulk-movements/execute/route.ts:43-60` derives an executor role-gate from `resolveApprovalFlow('personnel_order')`
(=[ceo]) → HR prepares on an HR-only page but cannot execute; only SUPER/EXECUTIVE pass, and EXECUTIVE can't open the
page → effective SUPER-only deadlock. Executor-must-be-approver conflates execution with approval.

- Remove the flow-derived role block. Keep: `withPermission perm(MODULE.EMPLOYEES, ACTION.APPROVE)` (HR_UP),
  `superAdminOnly` template gate, validation-token + server re-validation, audit log.
- Code comment + plan note: real submission→approval flow for personnel orders = separate track (payroll-style SoD).

## Item 3 — tr-01: delete dead transfer route

- Delete `src/app/api/v1/employees/[id]/transfer/route.ts` (148 lines). Verified zero references:
  no FE callers, no middleware/route-rule refs, no e2e refs (grep clean; `templates/transfer` hits are bulk-movements).

## Item 4 — ed-01: remove silent no-op fields from employee detail edit

`employees/[id]/route.ts` PUT strips 8 assignment-lived fields (companyId, departmentId, jobGradeId, titleId,
jobCategoryId, employmentType, status, managerId) but returns 200 → edit dialog shows fake success.

- `EmployeeDetailClient.tsx`: remove the stripped fields from the edit form + payload (read-only display stays).
  Add a short guidance note "부서·직급·재직상태 변경은 인사발령으로" (new i18n keys, 5 locales — key addition OK).
- API stays strict-strip (no behavior change server-side).

## Verification plan

- `tsc` 0 · `lint` 0 · unit: new tests for `judgeStatus` pure helper (normal/late/early/both/night-shift-cross-midnight/tz).
- Live dev dogfood: ① employee-a@ clock-in after 08:30 → admin anomaly row LATE + name/사번 visible;
  clock-out before 17:30 → EARLY_OUT (separate day or corrected row). ② hr@ completes bulk-movements 3-step
  wizard end-to-end (execute 200, no 403). ③ settings/attendance shows & saves 08:30/17:30. ④ employee detail
  edit: dept/status fields gone, guidance shown, remaining fields still save. ⑤ `/employees/[id]/transfer` → 404.
- e2e: targeted spec for clock-in LATE judgment (fixed-time injection not available → judge via corrected times
  on PUT recompute path), bulk-movements execute as HR fixture.

## Out of scope (carried separately)

- att-02 MANAGER/EXECUTIVE `attendance_create` seed (gated seed.ts — separate PR)
- att-04/05/13 RBAC scope design · att-08 52h break-deduction formula (legal)
- personnel_order real approval flow (SoD) · ABSENT batch · rs-03/04, att-07 full, att-10/11/14, bm-03, or-01, ui-02
