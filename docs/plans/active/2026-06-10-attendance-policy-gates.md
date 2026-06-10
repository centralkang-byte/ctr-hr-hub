# Attendance & Org-change Policy Gates (S276)

> Created 2026-06-10 (S276). Source = S275 handover "Explicitly OUT of scope (CEO policy gates)" in
> `2026-06-10-attendance-orgchange-dogfood-fixes.md`, resolved via CEO decision gate (4 answers below).
> Status: **✅ IMPLEMENTED (S276, bd51ae78)** — Codex Gate 1 **5라운드**(r1 P1×7+P2×4 → r2 P1×4+P2×2 →
> r3 doc P1×2+P2×1 → r4 P1×1 → **r5 GO**) 전부 반영. 검증: tsc 0 · lint 0 · unit 813/813(신규 19) ·
> e2e 36 pass(0 fail; attendance-core 갱신 + 신규 attendance-policy-judgment.spec 10) · 라이브 dogfood:
> 정다은 15:00 출근→LATE+admin 표시, 시간만 보정→자동 재판정 NORMAL, 설정 저장 toast, 상세 편집
> 읽기전용+안내문, HR execute 200+동일 tx audit row.
> **구현 중 발견**: ① 미들웨어가 모든 /api/*에 세션 강제 → 단말기 디바이스 트래픽 전면 401(기능 자체
> 불통, 기존 결함) → `/api/v1/terminals/clock` PUBLIC_PATHS carve-out(라우트 자체 DB 시크릿 인증, #128
> 선례) ② attendance-core.spec의 MANAGER admin 200 기대는 #143 deny-by-default 반영 누락 stale → 403로
> 갱신 ③ e2e 픽스처: EMPLOYEE_C(송현우) auth 신설 + e2e/helpers/db.ts(직접 pg 정리 — 1일1레코드로 API
> 정리 불가) ④ fullyParallel 경합 격리(judgment=employee-c·terminal=employee-b·bulk=employee-a·설정
> 테스트=CTR-CN/HOLD).
> Branch: `feat/s276-attendance-policy-gates` stacked on `fix/s275-attendance-orgchange-dogfood` (PR #143 open;
> this work touches the same files #143 rewrote — execute route, attendance/[id], admin client — so stacking avoids conflicts).

## Codex Gate 1 round 1 findings → resolutions

Measured facts (shared DB, 2026-06-10): `attendances` has **0 duplicate (employee_id, work_date) pairs** →
unique constraint safe; `shift_schedules` has **0 rows** → no legacy date-drift data, **no backfill needed**;
`logAuditSync` already exists (audit.ts:99); bulk templates = compensation/entity-transfer/promotion/termination/
transfer (**no demotion**); executor does NOT write EmployeeHistory.

1. **(P1) tz/date SSOT conflict** → clock-in/clock-out drop the hardcoded KST math. New resolver computes ONE
   company-local day context (tz from `AttendanceSetting.timezone` ?? Asia/Seoul) used for: existing-record check,
   `workDate`, shift lookup, judgment. `workDate` convention stays **UTC-midnight of the company-local calendar
   date** (current code already produces exactly this for KST — verified: `todayStart + kstOffset` = UTC midnight
   of the KST calendar date — so KR/CN rows are unchanged; US rows become correct).
2. **(P1) night shift can't clock out next day** → clock-out stops using a today-only window; finds the most
   recent un-clocked-out record with bounded lookback (`workDate >= localToday - 1 day`), judges against THAT
   record's workDate + its shift (shift end +1d when end <= start).
3. **(P1) same-day duplicate clock-in** → policy = one attendance record per work day. App guard: ANY existing
   record for the workDate rejects re-clock-in (clear message), + `@@unique([employeeId, workDate])` migration
   (dup count measured 0 → safe) with P2002 → badRequest fallback.
4. **(P1) correction recompute contract** → FE keeps the record's initial status and includes `status` in the
   payload ONLY when the user actually changed it. Server auto-recompute rules (explicit status always wins):
   `clockIn=null` → never auto-LATE; `clockOut=null` → never auto-EARLY_OUT; previous **manual ABSENT is sticky**
   (time edits alone never clear it); recompute only runs when times changed and status absent from payload.
5. **(P1) SUPER_ADMIN correction uses wrong company settings** → resolver contract fixed to
   **attendance.companyId + attendance.employeeId** (never `user.companyId`); unit test pins this.
6. **(P1) ShiftSchedule exact-date lookup unreliable** → shift write paths (`attendance/shifts` manual save,
   `shift-schedules/generate`) unify to `parseDateOnly()` UTC date-only storage; resolver looks up by the same
   convention. Backfill not needed (table measured empty).
7. **(P1) bulk execute audit not durable** → ~~`await logAuditSync`~~ **superseded by r2-2: audit row created
   INSIDE the executor transaction** (`tx.auditLog.create()`).
8. **(P2) transfer route not fully covered by bulk** → delete stands (CEO; pre-launch, no external API consumers,
   page/FE callers 0). PR body gets a feature-mapping table: transfer/promotion → bulk templates; DEMOTION → no
   template yet (future demotion path = grade-change template extension, separate track); EmployeeHistory write
   not replicated (assignments = SSOT).
9. **(P2) weak HH:mm / timezone validation** → zod `^([01]\d|2[0-3]):[0-5]\d$` + tz check ~~via
   `Intl.supportedValuesOf`~~ **superseded by r2-5: `try { new Intl.DateTimeFormat(...,{timeZone}) } catch`**;
   unit test for America/Chicago DST transition days.
10. **(P2) clock-in real path untested** → e2e drives the REAL POST. ~~set `workStartTime` = now − 5min~~
    **superseded by r2-4: fixed midnight-safe thresholds + edge-window guard** (see Verification plan).
    Night-shift e2e: seed yesterday 22:00–06:00 shift + un-clocked record → clock-out today succeeds.
11. **(P2) db push vs migrate status** → exact procedure documented: migration file = record-only, apply =
    `prisma db push` to shared DB ([[hrhub-migrations-no-zero-apply]], same as S269 #139 precedent); `prisma
    migrate status` will list it pending — known/accepted, stated in PR body.

## CEO decisions (2026-06-10 question gate)

1. **att-09 lateness judgment**: start with per-company base work hours — **default 08:30~17:30**. Shift workers
   judged against their assigned shift slot. Full flex-work settings UI = later.
2. **O3 bulk-movements execute deadlock**: **allow HR execution** (execution ≠ approval). Real submit→CEO-approve
   flow (like payroll #126/#128) = separate follow-up track.
3. **tr-01 dead single-transfer API**: **delete** (`/api/v1/employees/[id]/transfer` — 0 UI callers, in-place
   `updateMany` violates append-only assignments; bulk-movements covers transfers).
4. **ed-01 employee-detail silent no-op edit**: **remove the silently-stripped fields from the edit form**
   (dept/grade/status etc. change via 발령 only; add guidance note).

## Codex Gate 1 round 2 findings → resolutions (P1×4, P2×2 — ALL incorporated)

1. **(P1) terminal clock path bypasses everything** — `terminals/clock/route.ts` is a THIRD attendance
   create/update path (server-local midnight, `NORMAL` hardcode, auto-close-then-recreate that would P2002 under
   the new unique). Fix: terminal CLOCK_IN/OUT use the SAME `resolveDayContext` (tz/workDate from
   `terminal.companyId`) + judgment + one-record-per-day (existing record for workDate → 400, P2002 fallback);
   CLOCK_OUT uses the same bounded-lookback attach rule. The legacy "auto-close today's open record at 23:59 then
   recreate" block is REMOVED (replaced by the 400; stale open records = HR correction, status quo for web).
   Terminal e2e added.
2. **(P1) audit must be atomic with execution** — `await logAuditSync` after commit is not atomic (audit failure
   → 400 "rolled back" lie while movements applied; retry = duplicate risk). Fix: `executeMovements()` gains an
   audit context param and writes the audit row via `tx.auditLog.create()` INSIDE its existing transaction
   (movement type, effective dates, target employee IDs, row count, actor/ip/UA). Route drops its separate call.
3. **(P1) settings UI company ≠ API company** — V2 client's `companyId` selector is display-only; API always
   writes `user.companyId` (SUPER saving while viewing company A would silently edit own company). Fix: GET
   `?companyId=` / PUT body `companyId`, resolved via `resolveCompanyId()` (companyFilter SSOT, #131 pattern);
   e2e: SUPER saves A → only A changes, B unchanged.
4. **(P1) e2e reset vs one-record-per-day** — existing specs only clock out open records; under the new policy
   re-clock-in 400s on repeat runs, and `now−5min` start-time flips dates near midnight. Fix: dedicated fixture
   employee + explicit DB cleanup of that employee's today-record before/after (try/finally restores settings,
   attendance, shifts); midnight-safe fixed thresholds (`workStartTime='00:01'` → deterministic LATE;
   `'23:59'` → deterministic NORMAL) instead of now-relative values.
5. **(P2) `Intl.supportedValuesOf` rejects valid aliases (UTC, Etc/UTC)** — validate tz via
   `try { new Intl.DateTimeFormat('en-US', {timeZone}) } catch` instead.
6. **(P2) overnight worker clocking IN after midnight** (00:30 punch for a 22:00 shift) — clock-in also checks
   the PREVIOUS day's shift: if it is overnight (end <= start) and `now` < that shift's end instant, the record
   is attributed to the previous workDate (judged LATE against its start). Clock-out lookback attach rule
   hardened: attach to an open previous-day record only when `now − clockIn <= 24h` (a forgotten 09:00 punch from
   yesterday does NOT swallow tonight's clock-out — returns "출근 기록이 없습니다" for HR correction instead).

## Item 1 — att-09: wire lateness/early-leave judgment (largest)

Current state: `clock-in/route.ts:79` hardcodes `status:'NORMAL'`; `workTypeEngine.ts` has 0 importers; admin
anomaly list filters `LATE/EARLY_OUT/ABSENT` → pipeline never fires in live ops.

- **Schema (gated, migration required)**: `AttendanceSetting` (schema.prisma:5518) gains
  `workStartTime String @default("08:30")`, `workEndTime String @default("17:30")` (HH:mm), and `Attendance` gains
  `@@unique([employeeId, workDate])` (finding 3; measured dup count 0). Non-breaking defaults. Apply procedure
  (finding 11): migration file = record-only + `prisma db push` to shared DB ([[hrhub-migrations-no-zero-apply]]).
- **New module** `src/lib/attendance/judgeStatus.ts`:
  - `resolveDayContext({companyId, at})` (server helper): loads `AttendanceSetting` →
    `tz = setting?.timezone ?? 'Asia/Seoul'`, base HH:mm = setting ?? code defaults 08:30/17:30 (no seed change);
    returns `{tz, localDateStr, workDate}` where **workDate = UTC-midnight of the company-local calendar date**
    (`parseDateOnly(formatToTz(at, tz, 'yyyy-MM-dd'))`) — the single date SSOT for existing-record check, row
    creation, shift lookup, judgment (finding 1). KR rows keep identical values (current KST math already produces
    this instant — verified).
  - `resolveEffectiveSchedule({companyId, employeeId, workDate})`: `ShiftSchedule` findUnique
    (employeeId+workDate, company-verified) → slot `startTime/endTime`; else company base hours. Contract pinned to
    the **attendance row's** companyId/employeeId, never the caller's (finding 5).
  - `judgeAttendanceStatus(...)` (pure, unit-tested): scheduled start = workDate@startHHmm in tz via
    `fromZonedTime`; scheduled end same, **+1 day when endHHmm <= startHHmm** (night cross-midnight).
    LATE if clockIn > start; EARLY_OUT if clockOut < end; **LATE wins when both** (single enum; code comment).
    Null rules (finding 4): `clockIn=null` → never auto-LATE; `clockOut=null` → never auto-EARLY_OUT;
    manual ABSENT sticky.
- **clock-in route**: replace KST block with `resolveDayContext`; reject when ANY record exists for the workDate
  (one-record-per-day policy, finding 3; P2002 → badRequest fallback); judge LATE at create. `workType` stays
  `'NORMAL'` (pay-category axis — NOT the engine's FIXED/FLEXIBLE/SHIFT/REMOTE; untouched).
- **clock-out route**: find most recent un-clocked-out record with bounded lookback
  (`workDate >= localToday − 1d`, finding 2 — night shift clocks out next morning); judge EARLY_OUT against that
  record's workDate schedule; never downgrades LATE.
- **Manual correction PUT** (`attendance/[id]/route.ts`): recompute when times changed AND `status` absent from
  payload, using **attendance.companyId/employeeId** for the resolver (finding 5) + null/sticky rules (finding 4).
  Explicit `status` wins. FE (`AttendanceAdminClient`): keep initial status, include `status` only when user
  changed it (finding 4 — today it always sends, which would dead-code the recompute path).
- **Shift write-path normalization** (finding 6): `attendance/shifts` manual save + `shift-schedules/generate`
  store `workDate` via `parseDateOnly()` (UTC date-only); resolver reads the same convention. No backfill
  (table measured empty).
- **Terminal clock route** (`terminals/clock/route.ts`, r2-1): same `resolveDayContext` (tz/workDate from
  `terminal.companyId`) + judgment + one-record-per-day 400 + P2002 fallback; legacy auto-close-at-23:59-then-
  recreate block removed. Uses **`eventTime` consistently (never server now)**; CLOCK_OUT enforces
  `0 <= eventTime − clockIn <= 24h` (reversed/stale device events rejected — no negative work minutes) and all
  lookups carry `companyId: terminal.companyId` (r3-3).
- **Settings API + UI**: `settings/attendance/route.ts` zod adds the two fields with strict HH:mm range regex +
  tz validation via `try { new Intl.DateTimeFormat('en-US', {timeZone}) } catch` (r2-5 — `supportedValuesOf`
  rejects valid aliases like UTC). **Company scope (r2-3)**: GET `?companyId=` / PUT body `companyId` resolved via
  `resolveCompanyId()` (companyFilter SSOT, #131 pattern) — SUPER editing company A must write A, not own session
  company. `AttendanceSettingsV2Client.tsx` work-hours section gains two `type="time"` inputs **and the Save
  button gets wired passing the selected companyId** (currently a no-onClick mockup — S276 recon).
- **Out of scope**: ABSENT batch judgment (no-clock-in detection cron), retroactive re-judgment of existing rows,
  flex-work core-time UI, grace-minutes setting, half-day-leave interaction with EARLY_OUT (policy refinement).

## Item 2 — O3: allow HR to execute bulk movements

`bulk-movements/execute/route.ts:43-60` derives an executor role-gate from `resolveApprovalFlow('personnel_order')`
(=[ceo]) → HR prepares on an HR-only page but cannot execute; only SUPER/EXECUTIVE pass, and EXECUTIVE can't open the
page → effective SUPER-only deadlock. Executor-must-be-approver conflates execution with approval.

- Remove the flow-derived role block. Keep: `withPermission perm(MODULE.EMPLOYEES, ACTION.APPROVE)` (HR_UP),
  `superAdminOnly` template gate, validation-token + server re-validation.
- **Atomic audit (r2-2, supersedes r1-7's logAuditSync)**: `executeMovements()` gains an audit-context param
  (`{actorEmployeeId, ip, userAgent}`) and writes the audit row via **`tx.auditLog.create()` INSIDE its existing
  transaction** — movement type, effective dates, target employee IDs (from validatedRows), row count, fileName.
  Route drops its separate fire-and-forget call. Side benefit: executor's currently-unused `executedBy`/`fileName`
  params (3 standing eslint warnings) become used.
- Code comment + plan note: real submission→approval flow for personnel orders = separate track (payroll-style SoD).

## Item 3 — tr-01: delete dead transfer route

- Delete `src/app/api/v1/employees/[id]/transfer/route.ts` (148 lines). Verified zero references:
  no FE callers, no middleware/route-rule refs, no e2e refs (grep clean; `templates/transfer` hits are bulk-movements).
- **Coverage mapping (finding 8)**: transfer/promotion → bulk templates exist; DEMOTION → no bulk template
  (future grade-change extension, separate track); `EmployeeHistory` write not replicated by executor
  (append-only assignments = SSOT). Pre-launch internal product, API not public → no deprecation window needed
  (CEO decision); mapping table goes in the PR body.

## Item 4 — ed-01: remove silent no-op fields from employee detail edit

`employees/[id]/route.ts` PUT strips 8 assignment-lived fields (companyId, departmentId, jobGradeId, titleId,
jobCategoryId, employmentType, status, managerId) but returns 200 → edit dialog shows fake success.

- `EmployeeDetailClient.tsx`: remove the stripped fields from the edit form + payload (read-only display stays).
  Add a short guidance note "부서·직급·재직상태 변경은 인사발령으로" (new i18n keys, 5 locales — key addition OK).
- API stays strict-strip (no behavior change server-side).

## Verification plan

- `tsc` 0 · `lint` 0 · unit (**boundary correctness lives HERE — pure fn with injected dates, fully
  deterministic**): `judgeStatus` (normal/late/early/both→LATE/night cross-midnight/null rules/ABSENT sticky/
  exact-boundary clockIn == start), resolver contract (attendance.companyId not user.companyId), settings zod
  (HH:mm bounds, bad tz, UTC alias accepted), America/Chicago DST transition days, overnight attribution rule,
  terminal `0 <= eventTime − clockIn <= 24h` rule.
- e2e (REAL paths, r2-4 deterministic design — dedicated fixture employee; explicit DB cleanup of that employee's
  today-record before/after; `try/finally` restores settings/attendance/shifts; **expectations derived from one
  local-time reading at test start, with an explicit branch/skip guard for the 00:00–00:01 and 23:59 edge windows**
  — boundary semantics are NOT asserted in e2e, only wiring):
  ① clock-in POST with `workStartTime='00:01'` → LATE (guarded); `'23:59'` → NORMAL (guarded).
  ② night shift — seed yesterday 22:00–06:00 shift + un-clocked record → clock-out today succeeds and attaches.
  ③ duplicate clock-in same day → 400. ④ bulk-movements execute as HR fixture → 200 + audit row in same commit.
  ⑤ settings SUPER saves company A → only A changes, B unchanged. ⑥ terminal reversed event (eventTime < clockIn)
  → rejected.
- Live dev dogfood: ① employee-a@ clock-in after 08:30 → admin anomaly row LATE + name/사번 visible.
  ② hr@ completes bulk-movements 3-step wizard end-to-end (execute 200, no 403) + audit_logs row with target IDs.
  ③ settings/attendance shows & saves 08:30/17:30 (Save button now actually persists). ④ employee detail edit:
  dept/status fields gone, guidance shown, remaining fields still save. ⑤ `/employees/[id]/transfer` → 404.
  ⑥ correction dialog: time-only edit → status auto-recomputed; explicit status change → respected.

## Out of scope (carried separately)

- att-02 MANAGER/EXECUTIVE `attendance_create` seed (gated seed.ts — separate PR)
- att-04/05/13 RBAC scope design · att-08 52h break-deduction formula (legal)
- personnel_order real approval flow (SoD) · ABSENT batch · rs-03/04, att-07 full, att-10/11/14, bm-03, or-01, ui-02
