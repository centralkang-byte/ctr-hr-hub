# Employee Attendance Correction Request — Design and Implementation Plan

> Date: 2026-07-17
> Session: S342
> Status: S346 implementation and release preflight complete — local release candidate; push and Preview pending explicit approval
> Source: launch UAT candidate P1 #5 and CEO decision recorded in
> `2026-07-12-launch-readiness-audit-triage.md`

## 1. Outcome

Employees can request a correction to their own clock-in or clock-out record. An HR administrator in the same company reviews the before/requested values and either approves or rejects the request. Final approval updates attendance-derived values and the audit log in one transaction.

The attendance feature reuses the existing `AttendanceApprovalRequest` and
`AttendanceApprovalStep` tables, so it needs no attendance-specific table or model change.
The same release candidate separately contains the reviewed S343 relation clarifications
and shared-DB repair migration described in
`2026-07-17-migration-history-reconciliation.md`.

## 2. Product decisions

1. **Approval owner:** active `HR_ADMIN` roles are scoped to the target attendance company; an active `SUPER_ADMIN` role is a global fallback regardless of its role-assignment company. The requester can never approve their own request.
2. **Employee-editable fields:** requested clock-in, requested clock-out, and reason only. Status, work type, total minutes, and overtime are server-derived.
3. **One pending request per attendance row:** duplicate pending requests return `409`.
4. **Payroll lock:** only a month with no `MONTHLY` payroll run, or a `DRAFT` run with `attendanceClosedAt = null`, is editable. Every other payroll state is locked. `BONUS` runs do not lock attendance.
5. **Stale request protection:** approval compares the current attendance row with the immutable snapshot stored at request time. A mismatch returns `409` and applies nothing.
6. **Individual review only:** attendance corrections are excluded from bulk approval because HR must compare before/requested values.
7. **No destructive cancellation in this slice:** employees can see pending/approved/rejected history; request cancellation is a follow-up.
8. **Pending corrections block payroll close:** a `MONTHLY` attendance close returns `409` while the target month has a reference-matched pending correction, even if its legacy JSON is malformed. This prevents a request from becoming un-actionable immediately after submission.
9. **Stable conflict codes:** duplicate, payroll lock, stale attendance, and decision-race conflicts have distinct API error codes so the UI can offer the correct recovery action.

## 3. Pre-implementation gaps closed by this work

All gaps below are resolved in the implementation and verification record in section 11.

- Generic approval creation accepts client-selected approvers and currently accepts `attendance_correction`.
- Approval detail lookup is not participant- or tenant-scoped.
- `view=team` can expose company requests to roles that should not receive them.
- Final approval only changes request status; it does not apply the attendance correction.
- Bulk approval can mark a correction approved without applying it.
- HR direct correction does not enforce payroll-period locking.
- Payroll close and correction approval do not share a concurrency lock.
- Web clock-in/out and terminal clock events can race payroll close or overwrite a newly approved correction.
- The employee monthly attendance response omits record IDs, so there is no safe correction target.
- The active One Hub approval tab does not surface attendance-correction work.

## 4. Data contract

`AttendanceApprovalRequest`:

- `requestType = 'attendance_correction'`
- `referenceId = Attendance.id`
- `requesterId = session employeeId`
- `companyId = Attendance.companyId`
- `details` is server-built JSON; clients cannot submit original values or approver IDs.

```ts
interface AttendanceCorrectionDetailsV1 {
  version: 1
  workDate: string
  timezone: string
  schedule: {
    startHHmm: string
    endHHmm: string
    source: 'shift' | 'base'
  }
  reason: string
  before: {
    clockIn: string | null
    clockOut: string | null
    totalMinutes: number | null
    overtimeMinutes: number | null
    status: string
    workType: string
    note: string | null
  }
  requested: {
    clockIn: string | null
    clockOut: string | null
  }
}
```

The create body contains only:

```ts
{
  clockIn: string | null
  clockOut: string | null
  reason: string
}
```

`clockIn` and `clockOut` are absolute ISO-8601 instants with an explicit `Z` or offset. The request schema is `.strict()`. Validation rejects unchanged values, `clockOut < clockIn`, durations above 24 hours, both values being null, invalid/offset-free timestamps, and any client-supplied ownership, status, or approver field.

### Company-timezone validation

The server resolves the effective timezone from `AttendanceSetting.timezone ?? Company.timezone` for the attendance company through one transaction-client-injectable resolver. When creating an attendance-settings row, the service explicitly seeds `timezone` from `Company.timezone` rather than allowing the Prisma field default to silently insert `Asia/Seoul`; an existing explicit setting remains authoritative. The legacy `Asia/Seoul` default is used only when both values are absent. `Attendance.workDate` remains the company-local calendar date stored as UTC midnight. The resolver itself rejects unsupported effective values before formatting, schedule resolution, scanner, or mutation; unsupported runtime data fails atomically with no request, attendance, or audit mutation.

The server also resolves the row's effective shift/base schedule. For a work date `D`, requested values use field-specific bounds:

1. For a normal schedule, each non-null value must be in `[D 00:00, D+1 00:00)`.
2. For an overnight schedule, a non-null clock-in must be in `[D 00:00, scheduledEnd)`. A non-null clock-out paired with a proposed clock-in must be from that clock-in through the earlier of `clockIn + 24h` and `D+2 00:00`. If proposed clock-in is null, clock-out must be in `[D 00:00, scheduledStart + 24h]` so a lone value cannot point to the end of an unrelated next day.
3. Every non-null value is independently no later than server `now + 5 minutes`; the tolerance is only for terminal/browser clock skew.
4. When both values are present, elapsed absolute time is between 0 and 24 hours inclusive.
5. Both null is rejected. One null is allowed only after the remaining field passes its own bound and future checks.

Window boundaries are built from date strings with `addDaysToDateStr()` and `fromZonedTime()`; code must not add a fixed 24-hour millisecond duration or call `getStartOfDayTz(parseDateOnly(D), timezone)`. Schedule start/end wall times use the same candidate scanner; a DST gap or fold boundary rejects the correction with `ATTENDANCE_CORRECTION_INVALID` rather than implicit normalization. Create and final approval repeat this validation.

The API returns the company timezone with monthly records. The drawer formats stored instants using `formatToTz(instant, companyTimezone, "yyyy-MM-dd'T'HH:mm")` and converts edited `datetime-local` values with `fromZonedTime(value, companyTimezone).toISOString()`. It never uses `new Date(datetimeLocalValue)`, which would silently use the browser timezone. The original absolute ISO is retained separately; if the wall value is unchanged, submission reuses the original ISO so seconds, milliseconds, and the selected side of a DST fold are not lost.

For an edited wall value, a pure client helper scans absolute candidates from three hours before through three hours after the `fromZonedTime` candidate at one-minute resolution and formats each candidate back in the company timezone. Zero matches means a DST gap; more than one match means a DST fold; both are rejected. Exactly one match is submitted as absolute ISO.

The scan bound is backed by an enforced attendance-timezone contract, not a comment-only assumption. `src/lib/timezone.ts` exports one `SUPPORTED_ATTENDANCE_TIMEZONES` tuple for the six CTR company zones: `Asia/Seoul`, `Asia/Shanghai`, `Europe/Moscow`, `America/Chicago`, `Asia/Ho_Chi_Minh`, and `Europe/Warsaw`. The attendance-settings API accepts only this tuple, while retaining its IANA validity check. A unit audit over the supported-zone transition fixtures proves that no supported offset transition reaches the three-hour scan bound. The deployment audit also reports existing setting/company mismatches; a foreign company with legacy `AttendanceSetting.timezone = Asia/Seoul` is blocking unless explicitly allowlisted as an intentional override.

Before enabling the narrower settings validation, `scripts/audit-attendance-timezones.ts` performs a read-only audit over every non-deleted company, computes the same effective timezone (`AttendanceSetting.timezone ?? Company.timezone`), and prints company code plus unsupported value. Zero unsupported effective zones is a deployment gate; an unsupported `Company.timezone` fails even when no settings row exists. If any exist, deployment stops; an operator must explicitly map each company to the supported tuple and back up/update those rows before retrying. This feature performs no silent fallback or automatic production data rewrite, and still requires no Prisma schema migration. API tests prove that every supported non-default zone is accepted, a valid-but-unsupported IANA zone such as `Pacific/Apia` is rejected, and a settings-row-missing overseas company uses its Company timezone for create/approve/DST validation.

The candidate scanner is a client/server shared pure module. Request creation and final approval repeat the ambiguity check server-side whenever a requested absolute ISO differs from that field's `before` ISO. Therefore a malicious or older client cannot bypass the edited-fold policy by posting an explicit offset directly. Unchanged original instants remain allowed and preserve their exact fold side.

## 5. Authorization matrix

| Operation | Allowed scope |
|---|---|
| Create correction request | Any authenticated role, own attendance row only |
| List `mine` | Requester only |
| List `pending-approval` | Non-corrections: same-tenant current assigned step. Corrections: current pending step plus active target-company HR/global-SUPER role |
| List `team` | Target-company HR only; global SUPER may view all companies |
| Read detail | Requester; same-tenant assigned approver for non-corrections; active target-company HR or global SUPER for corrections |
| Approve/reject correction | Assigned active target-company HR or global SUPER; never the requester |
| Claim correction | Active target-company HR or global SUPER not already assigned; never the requester |
| Apply attendance update | Server only, inside final-approval transaction |

Cross-company and other-employee attempts return `404` where revealing record existence would create an IDOR oracle; role failures return `403`.

Wrapper and role contract:

- Dedicated correction create uses `withAuth`; this keeps self-service available to MANAGER and EXECUTIVE roles that do not hold `attendance_create`, while the endpoint enforces own-row scope.
- List/detail use `MODULE.ATTENDANCE + ACTION.VIEW` and participant/role query predicates. All supported roles currently hold attendance read access.
- Generic create changes from the leave module to `MODULE.ATTENDANCE + ACTION.CREATE` and always rejects `attendance_correction`.
- The `[id]` decision route uses `withAuth` so a DB-active HR/SUPER whose session is pinned to another role can reach current-role validation. After participant-scoped lookup, correction claim/decision uses the DB role/step contract below; non-correction decisions explicitly call `requirePermission(user, ATTENDANCE + APPROVE)`. Bulk excludes corrections and retains `MODULE.ATTENDANCE + ACTION.APPROVE`.

For `HR_ADMIN`, the current primary assignment must also match `request.companyId`; only global `SUPER_ADMIN` may be assigned to another company. Fallback approver selection applies the same company match. Every correction `team`, detail, claim, approve, and reject role check queries active DB assignments directly with this predicate:

```text
employeeId = actor
AND startDate <= now
AND endDate IS NULL
AND employee.deletedAt IS NULL
AND (
  (companyId = request.companyId AND role.code = HR_ADMIN)
  OR role.code = SUPER_ADMIN
)
```

The correction path never unions `user.role` or `buildEffectiveRoleCodes()` into this result. A stale session role therefore cannot retain HR/SUPER access after its DB assignment expires. Every path also validates the actor's current primary assignment with `effectiveDate <= now`, `endDate IS NULL`, and `status IN (ACTIVE, ON_LEAVE)`; future roles, deleted employees, and retired assignments are rejected consistently, including fallback approver selection.

List query input is one strict Zod contract: `view` is `mine | pending-approval | team`, `requestType` is one of the four supported request types, `status` is `pending | approved | rejected`, `page` is a positive integer, and `limit` is an integer from 1 through 100. Unknown or malformed values return `400`; they never fall through to a company-wide query. `team` is rejected before querying unless the actor is HR/SUPER.

Detail lookup carries participant and tenant predicates into the database query. A correction requester can read their own row; every non-requester correction reader must satisfy the active target-company HR/global-SUPER DB predicate above, and a legacy step alone grants no access. For a non-correction, an assigned approver step is accepted only when `request.companyId = user.companyId`, except an active global SUPER. The same separation applies to `pending-approval` list predicates, so an external employee or HR inserted as a legacy approver cannot list, read, claim, or decide the correction. Bulk lookup carries company scope, current assigned-approver scope, and `requestType != attendance_correction` into the database query itself; supplying a correction ID directly cannot reach the mutation loop. The remaining generic create types validate that every client-selected approver is a distinct, active same-company employee and is not the requester.

Role churn recovery is explicit. An active target-company HR or global SUPER may atomically **claim** a pending correction that was created before they entered the approver pool. Claim row-locks the request and loads all actor steps in deterministic `stepOrder, createdAt, id` order. It then applies exactly one rule:

1. If any actor step is already `pending`, return the first one unchanged and write no audit row.
2. Otherwise, if an actor `waiting` step exists, promote the first one to `pending` at `request.currentStep` and write one claim audit row; duplicate waiting rows remain inert.
3. Otherwise, including when only terminal actor steps exist, preserve the terminal history and create one new `pending` step at `request.currentStep` plus one claim audit row.

The request row lock makes a double claim idempotent even though the legacy schema has no `(requestId, approverId)` unique constraint. Different active HRs may join the parallel pool. Claim never changes attendance. Approval still requires strict V1 validation and the newly assigned pending step. A malformed legacy request is displayed as invalid and is reject-only after claim. This prevents an inactive former approver or a fabricated old row from permanently blocking payroll close.

## 6. Concurrency and transaction contract

Use one PostgreSQL transaction-level advisory lock key per `companyId + yearMonth`. Attendance writers acquire the transaction-level **shared** form; payroll close/reopen acquire the **exclusive** form. This lets different employees clock in/out concurrently while still making payroll state transitions wait for every in-flight writer. The helper derives `yearMonth` from the attendance `workDate`, not from requested clock timestamps, and acquires the lock inside the same database transaction as all guarded reads and writes.

Runtime writers covered by the contract:

- web clock-in create
- web clock-out update
- terminal clock-in create
- terminal clock-out update
- HR direct correction update
- employee correction request create
- employee correction approval
- payroll attendance close
- payroll attendance reopen
- GP#3 payroll calculation start/terminal transition (`ATTENDANCE_CLOSED -> CALCULATING -> ADJUSTMENT`)
- legacy batch calculation start/terminal transition (`DRAFT | ATTENDANCE_CLOSED -> CALCULATING -> REVIEW`)
- payroll adjustment completion (`ADJUSTMENT -> REVIEW`)
- payroll adjustment create/delete while `ADJUSTMENT`
- payroll item edit and anomaly resolve/bulk-resolve while `REVIEW`
- payroll anomaly whitelist removal while `REVIEW`
- payroll submit-for-approval while `REVIEW`
- `MONTHLY` PayrollRun creation plus initial active-LOA adjustment injection
- LOA activation and return reconciliation that create/update/delete payroll adjustments across one or more months

Every path that changes or snapshots an existing attendance row additionally re-reads that row with `SELECT ... FOR UPDATE` after acquiring the shared period lock. Clock-out intentionally rebases its calculation on that locked, fresh row. HR direct correction retains its initial snapshot and returns stale `409` if the row changed while it waited. Final approval keeps both the row lock and immutable-snapshot CAS.

Lock ordering is mandatory and never inverted. Attendance mutation/approval uses period advisory lock first, then attendance row lock, then approval/request CAS. Payroll phase mutation uses exclusive period lock, then the `PayrollRun` row, then child tables. Request-only claim/reject uses only the approval-request row. No attendance, payroll-run, or child row holder may subsequently request the period lock.

### Service and test seam

Routes are thin authentication/validation adapters. Transaction ownership lives in server-only services that accept explicit dependencies:

```ts
interface PeriodServiceDeps {
  db: PrismaClient
  afterCandidateRead?: (context: { operation: string; attendanceId?: string; runId?: string }) => Promise<void>
  afterPeriodLock?: (context: { operation: string; key: string; mode: 'shared' | 'exclusive' }) => Promise<void>
  afterAttendanceRowLock?: (context: { operation: string; attendanceId: string }) => Promise<void>
  afterPayrollRunLock?: (context: { operation: string; runId: string; status: string }) => Promise<void>
}
```

Production passes the singleton `prisma` and no callbacks. Tests pass two independent Prisma clients and operation-specific promise barriers. `afterCandidateRead` coordinates stale pre-lock snapshots; `afterPeriodLock` coordinates writer-vs-payroll ordering; `afterAttendanceRowLock` pauses the actual row winner for approval/clock-out/direct-edit races. Hooks are never reachable from an HTTP parameter or production environment flag. Clock event, direct correction, correction request/approve, close/reopen, both live calculation entry points, and adjustment-complete services use this dependency contract, making the §9 races deterministic rather than timing-based. Request-only claim/reject uses the request-row contract below.

Every payroll mutation whose allowed source overlaps `DRAFT`, `ATTENDANCE_CLOSED`, `CALCULATING`, `ADJUSTMENT`, or `REVIEW` uses one transaction and one lock order: exclusive period advisory lock, `PayrollRun` row lock/re-read, source-status validation, then child-table reads/writes. The locked `PayrollRun` row serializes operations for a run, so child tables are never locked before their parent. This contract covers close/reopen, both calculation entry points and their terminal/failure transitions, adjustment create/delete/complete, REVIEW item edits, anomaly single/bulk resolve/whitelist removal, and submit-for-approval. It removes the existing `children -> PayrollRun` versus `PayrollRun -> children` inversion between reopen and submission.

The LOA state row is a second concurrency boundary. Every LOA transition, including approve, reject, activate, return request, return completion, and cancellation, acquires the required registry/period locks, row-locks and re-reads the `LeaveOfAbsence` record, requires the exact source status, and performs a status-predicated CAS inside the transaction before assignments or payroll children. Approve/reject therefore cannot overwrite a concurrent `REQUESTED → CANCELLED`; a stale double-activate, approve-vs-cancel, reject-vs-cancel, complete-vs-cancel, or return-vs-cancel request rolls back all mutations. Run creation acquires the same registry lock before its duplicate lookup, so LOA reconciliation and creation share one no-phantom keyspace.

All deferred obligations are also consumed when an existing run becomes editable (`CALCULATING → ADJUSTMENT`, calculation failure → `DRAFT`, or reopen → `DRAFT`), before the terminal CAS. These transitions use registry exclusive → sorted period locks → PayrollRun FOR UPDATE → children/obligations → aggregate → CAS, with exactly-once consumed markers and no reverse lock acquisition.

### LOA payroll-adjustment writers

LOA-generated adjustments use the same locked-run primitive; `status NOT IN (PAID, CANCELLED)` is removed as an authorization-by-state shortcut. Their explicit policy is:

- An LOA adjustment may be inserted, changed, or deleted only on a `MONTHLY` run whose post-lock state is `DRAFT + attendanceClosedAt = null` or `ADJUSTMENT`.
- `ATTENDANCE_CLOSED`, `CALCULATING`, `REVIEW`, `PENDING_APPROVAL`, `APPROVED`, `PAID`, and `CANCELLED` runs are immutable to the LOA writer.
- `ACTIVE` and `RETURN_REQUESTED` are the only LOA states that contribute an automatic deduction to a new `MONTHLY` run. Cancellation from either state reconciles open eligible runs and, for a paid source, creates a compensation obligation; it never leaves a cancelled LOA deduction silently active. Cancellation from either source state also ends the LOA assignment and restores exactly one primary `ACTIVE` assignment in the same transaction; cancel-vs-complete uses the LOA CAS so the loser cannot leave assignment mutations behind.
- Existing paid/locked-period return or cancellation reconciliation may create a compensating row only in the earliest later `MONTHLY` run that is post-lock `DRAFT + attendanceClosedAt = null` or `ADJUSTMENT`. A completed LOA whose affected month has no run yet must instead persist a `BASE_DEDUCTION` obligation for that same source month; a locked source persists `COMPENSATION`, and an editable run mutates immediately. Every obligation has `kind: BASE_DEDUCTION | COMPENSATION`, `sourceYearMonth`, amount, stable idempotency key, and consumed marker. The complete sorted candidate-run set is fixed under the shared company registry lock, so a later run cannot be created outside the selection window. Registry-lock serialization makes creation and consumption idempotent despite the lack of an AuditLog uniqueness constraint; consumption creates the adjustment and marker atomically. `BASE_DEDUCTION` may be consumed by the same-yearMonth MONTHLY run; `COMPENSATION` must be strictly later. Neither is consumed by backdated or BONUS runs. The LOA response and audit log include a structured deferred warning.
- `BONUS` and other run types never receive automatic LOA adjustments.

PayrollRun creation itself acquires the company run-registry lock, then the target period lock, before the duplicate lookup. A shared `createMonthlyRunWithInitialLoaChildren()` primitive performs registry exclusive → period exclusive → duplicate re-read → DRAFT create → MONTHLY active-LOA plus `BASE_DEDUCTION`/`COMPENSATION` obligation consumption → DRAFT return. `/payroll/runs` preserves that DRAFT result. Only attendance-close's missing-run branch calls the primitive and then, after its pending-correction/attendance checks, performs a DRAFT → ATTENDANCE_CLOSED status-predicated CAS in the same transaction. No path creates ATTENDANCE_CLOSED directly or acquires registry after period. The route no longer launches `injectLoaAdjustmentsForNewRun()` fire-and-forget; callers never observe a created run whose initial LOA child set is still racing calculation or close.

LOA activation, return, and cancellation stop using fire-and-forget payroll writes. Under the registry lock they derive a complete finite candidate `(companyId, yearMonth)` set from LOA impact months, existing LOA-adjustment source months, every existing later MONTHLY run that could receive compensation, existing future MONTHLY runs for open-ended ACTIVE LOAs, and unconsumed deferred-obligation candidate months. They de-duplicate and sort by `companyId + yearMonth`, then acquire every exclusive period lock in that order, row-lock the LOA source and existing `PayrollRun` rows only after those locks, and revalidate run type/status before child mutation. No path adds a new out-of-order period lock after the set is fixed. Salary/settings reads used by the calculation receive the same transaction client. The LOA state change and its eligible payroll mutations commit in the caller's one transaction; skipped locked months are returned as deferred warnings and persisted obligations rather than silently modified. Run-create-vs-activation, run-create-vs-return, run-create-vs-cancel, and cancel-vs-complete therefore serialize through the shared registry lock.

Every LOA or generic payroll-adjustment create, amount update, cancellation-to-zero, deletion, and compensation insertion finishes by recomputing both `adjustmentCount` and `adjustmentTotal` from the post-mutation `PayrollAdjustment` child set in the same transaction. Increment/decrement shortcuts are forbidden because they drift under retries, duplicate legacy rows, and zero-amount cancellation. The aggregate helper is transaction-client injected and is also used by the interactive adjustment routes.

### Request creation transaction

1. Acquire the shared company/month lock.
2. Re-read and row-lock the attendance with self + company scope.
3. Resolve and allowlist-validate effective timezone with the same transaction client before any write, then verify that the payroll month is editable.
4. Verify there is no pending correction for the attendance row.
5. Resolve active target-company HR approvers, exclude the requester, and de-duplicate employees. If none remain, use active global SUPER role holders, again excluding the requester and de-duplicating dual-role employees.
6. Create the request and one parallel step (`stepOrder = 1`) per eligible approver.

Lock acquisition, scoped attendance re-read, pending lookup, approver resolution, request creation, and step creation are one transaction. The generic POST cannot create this type. Zero eligible approvers fails the transaction and creates no orphan request. The duplicate check runs after the lock and matches `companyId + requestType + referenceId + status=pending`.

### Final approve transaction

1. Fetch only a participant-scoped candidate to identify the referenced attendance and lock key; do not mutate from this pre-lock read.
2. Acquire the shared company/month lock, row-lock the attendance, resolve and allowlist-validate effective timezone with the same transaction client before any write, then row-lock and re-read the request plus its steps, roles, attendance, and payroll state inside the transaction.
3. Check request status immediately after its row lock. If it is no longer `pending`, return `ATTENDANCE_CORRECTION_DECISION_RACE` before details or immutable-snapshot validation. Only a still-pending request continues to strict V1, non-null `referenceId`, ownership/tenant, work-date, timezone, schedule, requested-instant, and before-snapshot checks. Thus a pending request changed by a clock/HR writer is stale, while the loser of an already completed decision is always a decision race.
4. Require the actor to still satisfy the direct DB role predicate, differ from the requester, and own an actual pending pool step on the request.
5. CAS the request and acting step from `pending` so concurrent HR decisions have one winner. Mark sibling pool steps `skipped` only after the winner is known.
6. Re-check the payroll lock and use the immutable before snapshot as the `Attendance.updateMany()` CAS predicate. A clock event or HR edit that committed first produces `count = 0` and rolls the whole transaction back.
7. Recompute total minutes, overtime, and attendance status with transaction-injected attendance SSOT helpers. An approved employee correction deliberately re-judges an `ABSENT` row instead of retaining the direct-HR correction path's sticky-ABSENT behavior.
8. Update attendance, acting step, sibling pool steps, and request status.
9. Insert `AuditLog` with `tx.auditLog.create()` in the same transaction.

If any step fails, attendance, approval state, and audit state all roll back.

Pre-existing or fabricated rows created through the formerly permissive generic endpoint are inert unless every V1, ownership, tenant, work-date, approver, and active-role invariant passes inside the final transaction.

### Reject and claim transactions

Reject and claim never need or trust an attendance row, `referenceId`, or `details`, so they do not calculate a period key. They row-lock `AttendanceApprovalRequest` first, require `status=pending`, validate the actor against the request's own `companyId`, requester inequality, and current DB roles, then mutate request/step state and `AuditLog` only.

- **Reject:** requires an actor pending step, CASes request and acting step to rejected, skips sibling steps, and writes the audit row. It never touches attendance or payroll state.
- **Claim:** requires the direct active target-company HR/global-SUPER DB predicate, applies the deterministic pending/waiting/terminal actor-step rules from §5 under the request row lock, and writes an audit row only for a promotion or new assignment.

For a malformed legacy request, an eligible actor claims first and then rejects. Approval can never use this recovery path. A concurrent approve holds period/attendance locks before waiting on the request row; claim/reject hold only the request row and never wait on period/attendance locks, so the ordering has no cycle.

HR direct correction row-locks the target attendance and resolves/allowlist-validates effective timezone with the same transaction client before its first write. Unsupported Company or AttendanceSetting values leave attendance and audit unchanged.

### Clock event and payroll-close ordering

- **Approval wins before clock-out:** clock-out waits on the attendance row lock, re-reads the corrected row, and recomputes from the corrected clock-in. If the correction supplied a clock-out, the event returns `ATTENDANCE_CLOCK_RACE` without overwriting it.
- **Clock-out wins before approval:** the approval snapshot CAS fails with `ATTENDANCE_CORRECTION_STALE`.
- **Approval vs HR direct correction:** both keep their pre-lock snapshot; after serialization exactly one applies and the loser returns stale `409`.
- **Two clock-outs:** both share the period lock but serialize on the row. The first completes the row; the second re-read finds no open row and returns `ATTENDANCE_CLOCK_RACE`.
- **Clock-in/out wins before payroll close:** close reads the committed attendance state and closes consistently.
- **Payroll close wins first:** the later attendance writer returns `ATTENDANCE_PERIOD_LOCKED`.
- **Correction create vs payroll close:** close checks month-attributable pending corrections after locking. Exactly one operation succeeds; the loser returns a conflict.

Payroll close acquires the exclusive lock, then moves its `MONTHLY` run lookup, closeability check, pending-correction check, confirmed-attendance query, and run update/create inside the transaction. The confirmed query filters directly on `Attendance.companyId`. It must not reuse the pre-transaction `existing` value. Payroll reopen acquires the same exclusive lock and re-reads/revalidates the run before cleanup and a source-status-predicated `updateMany()` transition to `DRAFT`; a zero-count CAS throws and rolls back every cleanup mutation. The existing reopenable-state policy itself is unchanged.

The other payroll transitions that can overlap reopen call a common editable-run obligation helper. It acquires registry exclusive before sorted period locks, then PayrollRun FOR UPDATE; adjustment creation, consumed marker, both aggregate recomputations, and state CAS commit in one transaction. GP success `CALCULATING → ADJUSTMENT`, legacy failure back to remembered `DRAFT`, and reopen to `DRAFT` consume; legacy failure back to `ATTENDANCE_CLOSED` and legacy success to `REVIEW` do not. Retry, concurrent consumer, and CAS-loss rollback tests assert exactly one adjustment and one marker.

The other payroll transitions that can overlap reopen use that registry-first helper and post-lock state contract:

- **Calculation start:** the codebase has two live entry points and neither may bypass the service. `/api/v1/payroll/calculate` allows only `ATTENDANCE_CLOSED` and targets `ADJUSTMENT`; `/api/v1/payroll/runs/[id]/calculate` preserves its legacy `DRAFT | ATTENDANCE_CLOSED` source policy and `REVIEW` target. After a tenant-scoped candidate read identifies `companyId + yearMonth`, each acquires the exclusive period lock, re-reads the run, revalidates its own allowed source state, runs the reference-matched pending-correction guard, and CASes that exact source state to `CALCULATING` in one transaction. The calculation uses only the returned post-lock snapshot and remembers the exact source state for failure recovery.
- **Calculation terminal transition:** after computation, success reacquires the exclusive period lock and row-locks/revalidates the run. Calculated `PayrollItem` upserts, aggregate totals, and the `CALCULATING -> ADJUSTMENT | REVIEW` status-predicated CAS then commit in that one transaction. A zero-count CAS throws and rolls the item/aggregate writes back. Failure recovery separately reacquires the same exclusive lock and run row, then uses `updateMany({ id, status: 'CALCULATING' })` to return to the exact remembered source (`DRAFT` or `ATTENDANCE_CLOSED`), never an unconditional status update. The operation-labeled `afterPeriodLock` and `afterPayrollRunLock` seams can pause success or failure before their terminal writes. Therefore neither terminal path can overwrite a concurrently reached `DRAFT` or later state.
- **Adjustment completion:** the service acquires the exclusive period lock, re-reads the run, revalidates `ADJUSTMENT`, runs anomaly deletion/detection/insertion through the same injected transaction client, and CASes `ADJUSTMENT -> REVIEW` before commit. If reopen wins first, completion observes `DRAFT`, fails, and creates no anomalies. If completion wins first, a subsequent reopen from `REVIEW` remains allowed by the existing policy and atomically cleans the newly generated anomalies before reaching `DRAFT`.

Adjustment create/delete, REVIEW item edit, anomaly single/bulk resolution/whitelist removal, and submit-for-approval become thin adapters over the same locked-run transaction primitive. Their pre-lock candidate reads establish only tenant scope and the lock key; every source-state check, target-child ownership check, aggregate recomputation, child mutation, and run mutation is repeated after the `PayrollRun` row lock. This makes adjustment completion's anomaly snapshot final for the transition and makes reopen/submit cleanup serializable with all child writers.

`detectAnomalies()` accepts an optional Prisma transaction client for every payroll/anomaly/employee read and anomaly write; existing callers retain the singleton default. Configurable threshold reads are resolved before entering the exclusive transaction and passed as detector input, so the period lock is not held while an unrelated settings connection is queried.

The close guard does not parse untrusted `details`. Under the exclusive lock it runs a parameterized `EXISTS` query joining pending `attendance_correction` rows to `Attendance` on `referenceId = Attendance.id` and equal `companyId`, then filters `Attendance.workDate` to the closing month. Any match blocks close, including malformed JSON or inactive approvers. Null, missing, or cross-company references cannot be attributed to the month and do not block it; they remain visible in the HR team list for claim and reject-only cleanup.

Stable conflict codes:

| Code | Meaning | UI recovery |
|---|---|---|
| `ATTENDANCE_CORRECTION_DUPLICATE` | Pending request already exists | Refresh row and open mine history |
| `ATTENDANCE_PERIOD_LOCKED` | MONTHLY payroll is no longer editable | Close form and explain HR/payroll follow-up |
| `ATTENDANCE_CORRECTION_STALE` | Attendance differs from request snapshot | Refresh detail; HR cannot approve this request |
| `ATTENDANCE_CORRECTION_DECISION_RACE` | Another reviewer already decided | Refresh approval list/detail |
| `ATTENDANCE_CLOCK_RACE` | A clock-out target was completed while waiting | Refresh current attendance |
| `ATTENDANCE_CORRECTION_PENDING` | Payroll close found a month-attributable pending correction | Open correction inbox and resolve it first |
| `ATTENDANCE_CORRECTION_INVALID` | Legacy/fabricated data failed strict apply validation | Disable approve; offer claim/reject cleanup |
| `ATTENDANCE_CORRECTION_CLAIM_REQUIRED` | Active HR is not yet assigned to the request | Claim, then decide |

## 7. UI flow

### Employee `/attendance`

- Add an accessible monthly record list below the existing heat grid; the heat-map cells remain non-interactive because they are too small for mobile touch targets.
- Each real attendance row shows date, clock-in, clock-out, status, and correction state.
- `보정 신청` opens a `WdDrawer` with requested clock-in, requested clock-out, and required reason.
- A pending row shows a pending badge and a link to `/approvals/attendance?view=mine&requestType=attendance_correction`.
- Drawer controls use labels, `aria-invalid`, inline error text, a 44px mobile target, and submission-close protection.

### HR One Hub and `/approvals/attendance`

- The active `/my/tasks?tab=approvals` surface gets a pending-attendance-correction count banner using the existing requisition-banner pattern.
- The banner deep-links to `/approvals/attendance?view=pending-approval&requestType=attendance_correction`.
- The dedicated page honors `view` and `requestType` query parameters.
- Correction detail renders structured before/requested values and the reason; raw JSON key/value rendering is not used.
- Invalid legacy detail renders an explicit invalid-request state with claim/reject-only actions; it never falls back to raw JSON.
- A target-company HR or global SUPER who joined after request creation can claim the request, after which the normal decision-step requirement applies.
- Detail responses include a server-derived correction state: `ready | stale | payroll_locked | invalid`. For stale, payroll-locked, or invalid pending requests, Approve is disabled while Reject remains available, so the pending row can be resolved and payroll close is not permanently blocked.
- Correction rows cannot be selected for bulk approval.
- Duplicate, payroll-lock, stale, decision-race, and clock-race codes render distinct localized guidance and the corresponding refresh/close action.

### Payroll close

- `ATTENDANCE_CORRECTION_PENDING` renders localized guidance and a link to `/approvals/attendance?view=team&requestType=attendance_correction&status=pending`.
- HR resolves or reject-cleans the pending rows, returns to close attendance, and retries. No generic failure toast hides the required action.

## 8. Initial planned files and final scope

### New

- `src/lib/attendance/period-lock.ts` — shared/exclusive period lock, company run-registry lock, row locks, payroll guard, and injectable post-lock test seam
- `src/lib/attendance/correction-time.ts` — client/server pure timezone conversion and gap/fold candidate detection
- `src/lib/attendance/correction.ts` — strict schemas, schedule window, stable conflicts, snapshot and derived update helpers
- `src/lib/attendance/correction-service.ts` — request create, claim, decide, and direct-HR correction transactions
- `src/lib/attendance/clock-event-service.ts` — web/terminal create and fresh-row clock-out transactions
- `src/lib/payroll/attendance-period-service.ts` — attendance close/reopen, both calculate-start/terminal contracts, adjustment-complete, and the pending-request guard
- `scripts/audit-attendance-timezones.ts` — read-only deployment preflight for unsupported existing attendance timezones
- `src/app/api/v1/attendance/[id]/correction-requests/route.ts` — self-service create endpoint
- `src/app/(dashboard)/attendance/AttendanceCorrectionDrawer.tsx` — employee request form
- `tests/unit/attendance/correction.test.ts` — pure policy and calculation tests
- `e2e/api/attendance-correction-requests.spec.ts` — authorization, validation, lock, and atomicity coverage
- `e2e/api/attendance-period-concurrency.spec.ts` — opt-in two-client barrier-controlled transaction races; the default Playwright `api` project collects but skips them unless the isolated-DB gate is explicitly enabled
- `e2e/harness/attendance-period-concurrency-harness.ts` — server-side child-process harness with JSON-lines scenario/barrier/release/result/teardown IPC and two independent Prisma clients

### Modified

- `src/lib/attendance/judgeStatus.ts` — allow transaction client injection into settings/shift/status reads without changing existing callers
- `src/lib/timezone.ts` — supported CTR attendance-timezone tuple and validator SSOT
- `src/app/api/v1/settings/attendance/route.ts` — enforce the supported attendance-timezone tuple
- `src/app/api/v1/attendance/[id]/route.ts` — thin HR adapter over the shared direct-correction service
- `src/app/api/v1/attendance/clock-in/route.ts` — thin web adapter over guarded clock-event create
- `src/app/api/v1/attendance/clock-out/route.ts` — thin web adapter over fresh-row clock-event update
- `src/app/api/v1/terminals/clock/route.ts` — terminal adapter plus the missing `workDate <= event local day` bound
- `src/app/api/v1/attendance/monthly/[year]/[month]/route.ts` — company-scoped attendance query, effective timezone, and correction summary matched by company/requester/type/reference
- `src/app/api/v1/payroll/attendance-close/route.ts` — thin adapter over locked close service
- `src/app/api/v1/payroll/attendance-reopen/route.ts` — thin adapter over locked reopen service without changing reopenable states
- `src/app/api/v1/payroll/calculate/route.ts` — locked `ATTENDANCE_CLOSED -> CALCULATING` start and status-predicated terminal transitions
- `src/app/api/v1/payroll/runs/[id]/calculate/route.ts` — thin legacy adapter over the locked batch calculation service
- `src/lib/payroll/batch.ts` — preserve legacy source/target states while using locked start and atomic item-plus-terminal transitions
- `src/app/api/v1/payroll/[runId]/adjustments/complete/route.ts` — thin adapter over locked anomaly-detection and `ADJUSTMENT -> REVIEW` service
- `src/app/api/v1/payroll/[runId]/adjustments/route.ts` — locked adjustment creation and aggregate refresh
- `src/app/api/v1/payroll/[runId]/adjustments/[adjustmentId]/route.ts` — locked adjustment deletion and aggregate refresh
- `src/app/api/v1/payroll/runs/[id]/items/[itemId]/route.ts` — locked REVIEW item edit and run total refresh
- `src/app/api/v1/payroll/[runId]/anomalies/[anomalyId]/resolve/route.ts` — locked single-anomaly resolution
- `src/app/api/v1/payroll/[runId]/anomalies/bulk-resolve/route.ts` — locked bulk anomaly resolution
- `src/app/api/v1/payroll/whitelist/[anomalyId]/route.ts` — locked whitelist removal and tenant/run-state revalidation
- `src/app/api/v1/payroll/[runId]/submit-for-approval/route.ts` — locked REVIEW validation, run transition, and approval-child creation
- `src/app/api/v1/payroll/runs/route.ts` — locked run creation and transaction-bound initial `MONTHLY` LOA injection
- `src/app/api/v1/payroll/attendance-close/route.ts` — same locked run-creation primitive for the missing-run branch
- `src/lib/loa/payroll-adjustment.ts` — transaction-client injection, explicit `ACTIVE | RETURN_REQUESTED` policy, sorted registry/period/run locks, deferred-settlement persistence/consumption, and aggregate recomputation
- `src/app/api/v1/leave-of-absence/[id]/route.ts` — row-locked source-state CAS, await atomic LOA activation/return/cancel reconciliation instead of fire-and-forget
- `src/lib/loa/service.ts` (or equivalent) — strict action schemas; date-only `actualEndDate` validation (`startDate <= actualEndDate <= company-local today`); transaction-local non-deleted same-company `returnPositionId` validation; cancellation assignment restoration for both `ACTIVE` and `RETURN_REQUESTED`
- `src/lib/payroll/anomaly-detector.ts` — transaction-client injection and pre-resolved threshold input for atomic adjustment completion
- `src/app/api/v1/approvals/attendance/route.ts` — scoped list and dedicated-create enforcement
- `src/app/api/v1/approvals/attendance/[id]/route.ts` — scoped detail and atomic correction decision
- `src/app/api/v1/approvals/attendance/bulk/route.ts` — correction exclusion
- `src/app/(dashboard)/attendance/AttendanceClient.tsx` — record list and request/history entry points
- `src/app/(dashboard)/attendance/page.tsx` — resolve company timezone/current local month for the client
- `src/app/(dashboard)/approvals/attendance/AttendanceApprovalClient.tsx` — query state and structured comparison
- `src/app/(dashboard)/my/tasks/ApprovalTabContent.tsx` — HR pending-count deep link
- `src/app/(dashboard)/payroll/close-attendance/CloseAttendanceClient.tsx` — pending-correction guidance and inbox recovery link
- `messages/{ko,en,zh,vi,es}.json` — append-only attendance/myTasks keys only
- `e2e/flows/attendance.spec.ts` — employee-to-HR browser flow

Gate 1, Gate 2, and the S343 preflight expanded the initial inventory with the final
transaction-boundary implementation and verification files: `correction-roles.ts`,
`timezone-resolver.ts`, the payroll/LOA period and phase services, the LOA concurrency
spec/harness, their unit tests, `prisma/schema.prisma`, and
`prisma/migrations/20260717224500_reconcile_shared_db_migration_drift/migration.sql`.
The release inventory is the reviewed `origin/main...HEAD` diff; this section preserves
the implementation plan and records why the scope expanded.

The attendance-correction implementation does not modify protected navigation, middleware,
company-filter, or RLS files. The follow-up S343 release-preflight reconciliation updates
`prisma/schema.prisma` and adds a forward migration; see
`2026-07-17-migration-history-reconciliation.md`.

## 9. Verification

### Unit

- Payroll lock matrix including inconsistent `DRAFT + attendanceClosedAt` and all non-DRAFT states
- UTC date-only month boundary
- company-timezone normal/overnight duty windows for Seoul, Chicago, and Warsaw
- local midnight boundary and overnight-only next-day acceptance
- overnight clock-in/single-clock-out field bounds prevent an unrelated late next-day instant
- unrelated date and future-instant rejection when either side is null
- 23/25-hour DST calendar windows, spring-gap rejection, unchanged fold ISO preservation, and edited-fold rejection
- every supported CTR timezone passes the transition-size audit; valid-but-unsupported `Pacific/Apia` is outside the scanner contract
- 12h work to 180 overtime minutes
- null times clear derived minutes
- reverse time and over-24h rejection
- employee correction re-judges and can clear a previous `ABSENT`
- LOA source-row state CAS rejects duplicate activation and complete-vs-cancel races

### API

- Own request `201`; other employee/cross-company `404`
- generic approval POST rejects `attendance_correction` and creates neither request nor step
- generic approval POST rejects foreign-company, inactive, duplicate, and requester-self approvers; a distinct active same-company approver succeeds
- generic approval POST is guarded by `ATTENDANCE + CREATE`, with an authorization regression test that would fail under the former LEAVE wrapper
- attendance settings accept every supported CTR zone and reject a valid-but-unsupported IANA zone
- settings-row-missing overseas company resolves `Company.timezone` consistently; timezone-less attendance-settings PUT creates with Company timezone (never Prisma Seoul default), GET returns it, and unsupported Company timezone fails the deployment audit
- direct DB fixtures with unsupported Company timezone and unsupported AttendanceSetting timezone make create write zero request/step/audit rows, keep approve pending with attendance/audit unchanged, and leave direct correction attendance/audit unchanged
- Two truly concurrent creates produce exactly one `201`, one `ATTENDANCE_CORRECTION_DUPLICATE`, and one pending row
- locked `MONTHLY` `409`; `BONUS` only allowed
- direct API request with an edited ambiguous-fold instant returns `400`; unchanged original fold ISO remains valid
- same-company HR approve applies attendance and creates exactly one audit row
- target company with no eligible HR assigns active global SUPER fallback; requester exclusion and dual-role de-duplication leave no duplicate step
- global SUPER can claim/decide across companies after current active-role revalidation
- a DB-active target-company HR or global SUPER can claim/decide while their session is pinned to a different active role; the same session cannot bypass permission checks for a non-correction decision
- a session still labeled HR/SUPER after its DB role is future-dated, expired, employee-deleted, or its primary assignment is retired cannot use correction access or receive global fallback
- reject leaves attendance unchanged
- foreign HR denied
- A→B transferred HR with a stale A role is denied in A and allowed only in B; fallback excludes the stale role
- legacy overseas Seoul setting fails the audit until explicitly corrected, then corrected timezone is used end-to-end
- Chicago/Warsaw schedule start/end gap or fold rejects correction atomically and status re-judging uses no implicit instant
- a foreign employee/HR already inserted as an approver on a legacy correction still cannot list, read, claim, approve, or reject it
- fabricated/legacy details, reference, requester, work-date, timezone, schedule, approver-step, and inactive-role mismatches can never approve or touch attendance
- newly active same-company HR can claim a request; malformed legacy rows are claimable and reject-only with an audit entry
- null, nonexistent, and cross-company legacy references can each be claimed and rejected without reading or changing any `Attendance` row
- claim promotes exactly one deterministic legacy `waiting` actor step; pending claim is audit-free/idempotent, while terminal-only history is preserved beside one new pending assignment
- concurrent duplicate claim creates exactly one actor step and one audit row
- employee `view=team` is `403`; invalid view/filter/page input is `400`
- unrelated same-company employee and foreign employee/HR cannot list/read a correction
- monthly attendance excludes prior-company attendance and fabricated cross-company correction summaries for an employee who changed companies
- correction IDs sent directly to bulk are excluded at query time and skipped
- payroll close with any same-company/month reference-matched pending correction, including malformed details, returns `ATTENDANCE_CORRECTION_PENDING`; resolving the request then permits a close retry
- new `MONTHLY` run includes `ACTIVE | RETURN_REQUESTED` LOA adjustments atomically and never injects into `BONUS`/locked runs
- `/payroll/runs` and attendance-close missing-run creation share registry→period ordering; concurrent create/close and LOA activate/return/cancel barriers produce one run with complete initial LOA children
- deferred settlement with no eligible target creates one obligation; concurrent/retried consumption creates one compensation adjustment and one consumed marker, skips backdated/BONUS runs, and is reusable after rollback only
- completed LOA before run creation persists a `BASE_DEDUCTION`; same-month MONTHLY creation consumes exactly one, including reverse-order multi-month run creation and completion-vs-creation barriers
- GP success to ADJUSTMENT, legacy failure to remembered DRAFT, and each reopen-to-DRAFT source consume exactly once; concurrent retry/CAS loss leaves one adjustment and one marker, while ATTENDANCE_CLOSED recovery consumes none
- cancellation from both `ACTIVE` and `RETURN_REQUESTED` ends the LOA assignment and restores exactly one primary active assignment; cancel-vs-complete leaves no orphan assignment
- approve-vs-cancel, reject-vs-cancel, and duplicate approve/reject barriers allow exactly one source-state transition; a cancelled LOA can never be revived
- invalid, pre-start, future, malformed `actualEndDate`, and foreign/deleted `returnPositionId` are rejected atomically with no LOA, assignment, or payroll mutation
- every LOA adjustment mutation leaves `adjustmentCount` and `adjustmentTotal` equal to the post-mutation child aggregate, including zeroed and compensating rows
- whitelist removal is tenant- and REVIEW-scoped and cannot race reopen or anomaly regeneration
- stale before snapshot returns `ATTENDANCE_CORRECTION_STALE`
- concurrent approval has one success and one `ATTENDANCE_CORRECTION_DECISION_RACE`
- after the first approval commits, the second approval checks request status before snapshot equality and therefore cannot misreport the decision loser as stale
- existing HR direct correction is blocked for closed periods
- detail state disables approval but permits rejection for stale, payroll-locked, and invalid pending requests

### Barrier-controlled integration races

- approval first vs web/terminal clock-out: clock-out re-reads corrected clock-in and derives fresh minutes/status
- web/terminal clock-out first vs approval: approval is stale and applies nothing
- approval vs HR direct correction: exactly one attendance mutation and one stale loser
- payroll close vs correction create: exactly one succeeds; no closed-month orphan request
- payroll close vs correction approval: the pending guard prevents close; approval applies, then a close retry includes it
- payroll close vs web/terminal clock-in and clock-out: lock ordering yields a state consistent with the winner
- each live payroll calculate-start route vs reopen from `ATTENDANCE_CLOSED`: the exclusive lock and post-lock CAS allow one transition; the loser observes the winner's state and cannot overwrite it
- legacy `DRAFT` calculate vs correction create: the period lock plus pending guard prevents calculation from orphaning a pending correction, and calculation-first makes the later writer observe the locked period
- payroll adjustment-complete vs reopen from `ADJUSTMENT`: reopen-first creates no anomalies; completion-first reaches `REVIEW`, after which a policy-allowed reopen atomically cleans the anomalies and reaches `DRAFT`
- adjustment create/delete vs completion/reopen: each result is serializable, no child write can commit from a stale source-state read, and completion's anomaly snapshot includes every earlier committed adjustment
- REVIEW item edit and anomaly resolve vs reopen/submit: run-row-first locking prevents orphan child state and submit observes the final open-anomaly count
- whitelist removal vs adjustment completion/reopen/submit: anomaly state changes serialize with the locked PayrollRun phase
- submit-for-approval vs REVIEW reopen completes without deadlock; one source-state CAS wins and the loser's entire child mutation rolls back
- new `MONTHLY` run creation commits its initial active-LOA adjustments atomically; the run is never visible without them
- LOA activation/return/cancel adjustment writes vs calculate-start, adjustment-complete, reopen, and submit: locked-state writers defer, eligible-state writers serialize after source-row CAS
- duplicate LOA activation and complete-vs-cancel use source-row CAS; exactly one assignment/reconciliation wins
- run creation vs LOA activation/return/cancel uses the shared registry lock, including later-run compensation selection without a phantom/missed candidate
- two overlapping multi-month LOA reconciliations acquire registry, sorted period, source-row, and run locks without deadlock or duplicate adjustment/count/total drift
- calculation success/failure terminal CAS cannot overwrite a run whose status is no longer `CALCULATING`, and a forced CAS loss leaves existing PayrollItems and run totals byte-for-byte unchanged
- closed historical-month terminal event is rejected, terminal CLOCK_OUT cannot attach to a future attendance row, and concurrent clock-outs have one winner

These tests use two independent Prisma clients and the dependency-only candidate-read,
period-lock, attendance-row-lock, and payroll-run-lock hooks described in §6. The
Playwright worker starts the harness as a separate Node child process, asserts a ready
handshake, sends barrier commands, and force-kills it on timeout; it never imports
`server-only`/Prisma modules directly. Harness owns connect/disconnect for both clients.
Production HTTP routes expose no delay, environment switch, or test-only parameter.
The default `test:api` command only proves collection because these destructive-isolated
tests skip without both `RUN_DB_CONCURRENCY_TESTS=1` and a safe `TEST_DATABASE_URL`.
S343 ran both specs with one worker and a dedicated Playwright config containing no app
server or shared-DB global setup.

### Browser

- Employee drawer submit -> mine pending -> HR before/requested review -> approve -> employee record reflects change
- Rejection flow
- Mobile-width drawer and touch targets
- HR and employee role surfaces

### Required gates

- `npx tsc --noEmit`
- `npm run lint`
- `npx tsx scripts/audit-attendance-timezones.ts` (must report zero unsupported rows)
- targeted unit tests
- targeted API and browser E2E
- `npm run build`
- both concurrency specs with `RUN_DB_CONCURRENCY_TESTS=1`, a dedicated
  `TEST_DATABASE_URL`, one worker, and no app-server/shared-DB global setup
- Codex Gate 2

## 10. Explicitly out of scope

- Full `UnifiedTask` mapper integration for attendance approvals
- Employee cancellation and request editing
- New retroactive payroll adjustment generation for attendance corrections in locked/paid months; existing LOA compensation behavior is only transactionally hardened
- Changing the existing payroll reopen state machine, which currently allows `ADJUSTMENT` and `REVIEW` despite the product specification saying reopen is only allowed before calculation
- Global attendance timezone cleanup outside touched correction display paths

## 11. Completion record

Implementation and the S343 database preflight are complete on
`codex/attendance-correction-request`. S345 subsequently resolved the cross-module
primary-assignment writer blocker documented below. Commit, PR, and deploy remain pending.

### Verified

- Production build passed after the final Gate 2 fixes.
- TypeScript and targeted ESLint passed after the final Gate 2 fixes; the earlier full lint run also passed with only pre-existing unrelated warnings.
- Full unit suite passed: 66 files, 1,018 tests.
- i18n parity passed for 5,300 keys across all five locales.
- Attendance-correction API authorization suite passed: 5 tests.
- Employee request -> HR review -> approval -> employee reflection browser flow passed.
- The initial API authorization, attendance UI, and payroll/LOA reviews cleared their
  scoped findings. A final release-closure review then found one additional P1 in the LOA
  assignment timeline: activate/complete/cancel could close a scheduled future primary
  assignment. The transition now locks the employee-wide primary-assignment timeline and
  fails atomically with a conflict whenever a future assignment exists. This preserves both
  the scheduled assignment and the existing current-assignment semantics until the wider
  codebase can migrate away from `endDate = null` current-assignment lookups.
- Codex Gate 2 found one P1 and two P2 issues. All were fixed: DB-active correction reviewers no longer depend on a pinned session role, the correction banner count and destination both use the team inbox, and intentional supported timezone overrides require an explicit `ATTENDANCE_TIMEZONE_OVERRIDE_ALLOWLIST` company-code allowlist.
- The earlier focused correction-flow review found no remaining P0/P1/P2 issues in that
  scope. The later release-wide assignment review found the blocker recorded below.
- Advisory-lock behavior was smoke-tested against the connected PostgreSQL database. The
  database concurrency suites remain opt-in behind a dedicated test database and passed
  16/16 after the final LOA timeline fix with zero retained fixtures.

### Release preflight resolution (S343)

1. **Resolved:** the shared database now records all 50 migrations as applied, and Prisma
   reports no schema difference. The targeted reconciliation is documented in
   `2026-07-17-migration-history-reconciliation.md`.
2. **Resolved:** `CTR-CN` attendance settings now use `Asia/Shanghai`; the timezone audit
   passes for all 12 companies.
3. **Resolved:** both two-client concurrency suites ran against the isolated
   `ctr_hr_hub_test_s342` database and passed 16/16 with zero retained fixtures, including
   activate/complete/cancel rollback coverage for a preserved cross-company future primary
   assignment.

No protected navigation, middleware, company-filter, or RLS file was modified. The S343
schema and migration changes are limited to the reviewed shared-DB reconciliation scope.

### S344 release blocker diagnosis (resolved in S345)

The static future-assignment corruption is fail-closed and covered, but the repository has
multiple independent primary-assignment writers. Row locks cannot prevent a concurrent
writer from inserting a new future assignment after the LOA timeline read. Entity transfer,
bulk movement, organization restructure, generic assignment creation, offboarding, contract
conversion, and LOA transitions do not yet share one employee-level transaction lock and
fresh in-transaction timeline revalidation. A concurrent writer can therefore bypass the
static future-assignment conflict and leave overlapping open primary rows. Resolving this
requires a coordinated cross-module assignment-writer protocol; it is intentionally not
hidden inside this release commit without a separate scope decision and regression plan.

## 12. Primary-assignment writer serialization closure (S345)

### Decision

All runtime mutations of a primary `EmployeeAssignment` use one PostgreSQL
transaction-level advisory lock keyed by `employeeId`. Multi-employee writers acquire the
deduplicated keys in lexical order before reading or mutating any affected assignment. The
lock is held by the same transaction that performs the fresh timeline read and mutation.

Writers that add an employee to, remove an employee from, or move an employee between
departments also acquire advisory locks for the complete source/target department set before
employee locks. The canonical department key is
`companyId + ':' + (departmentId ?? '<null>')`; writers deduplicate and sort this complete
final key, never the raw `departmentId` or request order. Predicate-based organization
restructure locks every referenced
department before discovering its final employee candidate set. This prevents a concurrent
assignment insert from entering a merge/close source department after the candidate query.

After department lock acquisition, every membership writer re-reads each non-null source
and target department and requires the exact `id`, expected `companyId`, and
`deletedAt = null`. A delete-first race therefore makes the later writer fail; a writer-first
race keeps the department live until the writer commits and makes the later delete re-check
active membership. A null-department key has no row to validate.

The fresh post-lock timeline is also the source-of-truth for the employee's current source
department. Its canonical source key, including the null sentinel, must already be present
in the pre-acquired department lock set. If it is not, the writer must not acquire a late
department lock: it rolls back with a retryable conflict and re-runs the entire bounded
transaction from its outer domain lock and department-set discovery. The retry has the same
finite attempt limit as other transaction conflicts and surfaces a conflict after exhaustion.

After the locks, a writer must re-read the employee's complete primary-assignment timeline.
A row
selected before the lock is authorization/candidate context only. Closing or changing an
existing assignment uses its exact `id` plus the state predicates relied upon by the writer
and requires a one-row CAS result. Broad `updateMany({ employeeId, isPrimary: true,
endDate: null })` mutations are not allowed in participating writers.

The canonical assignment interval is half-open: `[effectiveDate, endDate)`. This matches the
existing `getAssignmentAtDate` SSOT, every persisted primary transition in the shared DB,
and the general/bulk/restructure/entity-transfer writers. A normal replacement closes the
previous row on `newEffectiveDate`. A business-domain inclusive last day is converted to the
exclusive assignment boundary: termination closes and starts the terminal row on
`lastWorkingDate + 1 day`; LOA activation closes the active row at leave `startDate`; LOA
completion closes the LOA row and restores ACTIVE at `actualEndDate + 1 day`. Active LOA
cancellation uses the cancellation date as both exclusive LOA end and ACTIVE start; a
same-day activation/cancellation leaves an auditable zero-length LOA row but exactly one
effective ACTIVE row. A zero-length `[D,D)` row is an audit tombstone and does not occupy
any effective date. The timeline validator permits same-effective rows only when all but one
are zero-length tombstones; two effective rows with the same start still conflict. A
subsequent normal assignment must succeed after this case. REQUESTED/APPROVED cancellation
does not mutate assignments.

The protocol applies to generic assignment creation, bulk movement, organization
restructure, entity transfer, offboarding start/complete/cancel, contract conversion,
recruitment conversion, and LOA activate/complete/cancel. Non-primary concurrent
assignments remain outside this lock because they cannot create a second primary timeline.

### Lock order

1. Existing domain lock first when present.
2. Primary-assignment department advisory locks, deduplicated and sorted by the complete
   canonical `companyId:normalizedDepartmentId` key, for membership-changing writers.
3. Employee primary-assignment advisory locks, sorted by `employeeId` for batches.
4. Fresh complete primary-assignment timeline read and invariant validation.
5. Exact assignment-row CAS.
6. New primary assignment and remaining domain writes.

No participating assignment writer may acquire a domain or department lock after acquiring
an employee assignment lock. This preserves the existing payroll/LOA lock hierarchy and
prevents batch deadlocks.

Path-specific outer locks are:

- LOA: payroll registry lock -> sorted payroll period locks -> LOA row lock -> assignment
  department lock when membership changes -> employee lock.
- Entity transfer: transfer row `EXEC_APPROVED` state lock/CAS -> sorted source/target
  department locks -> employee lock.
- Offboarding complete/cancel: offboarding row state lock/CAS -> employee lock (completion
  also locks the source department before removing active membership).
- Offboarding start: employee lock before the assignment status CAS and new offboarding row.
- Organization restructure: plan row unapplied-state lock/CAS -> all sorted referenced
  department locks -> fresh predicate candidates -> all sorted employee locks.
- Recruitment conversion: application unconverted-state row lock -> target department lock
  -> new employee lock.
- Generic and bulk assignment creation: all sorted source/target department locks -> all
  sorted employee locks. Contract conversion uses the employee lock before its assignment
  state CAS.
- Direct department update/delete and the legacy organization-restructure route acquire the
  same department lock before checking active membership or changing lifecycle state. A
  department delete therefore cannot race a primary writer into the deleted department.

Every writer re-reads and validates its domain state after lock wait. Organization
restructure acquires the complete plan lock set once, never per change.

### Implementation plan

1. Add a shared assignment-writer helper for sorted department/employee advisory locks,
   half-open timeline validation, date-boundary selection, and exact-state CAS.
2. Replace broad or pre-lock primary-assignment mutations in every runtime writer with the
   shared protocol while preserving each route's authorization and product semantics.
3. For organization restructure, lock the plan and all referenced departments first,
   discover the final predicate candidates, acquire all employee locks in sorted order, then
   re-read each timeline. For bulk movement, acquire the request's complete department and
   employee sets in the same global order before per-row execution.
4. Replace LOA's row-lock-only phantom protection with the employee advisory lock before its
   existing timeline row locks.
5. Add unit tests for lock ordering, half-open timeline validation, and CAS. Add deterministic
   two-client races in both orders: writer-first makes LOA reject the fresh future row;
   LOA-first makes the writer reject its stale candidate. Assert one winner and a non-
   overlapping final timeline.
6. Add boundary regressions for normal replacement (old end D/new start D), one-day LOA,
   completion (LOA end/new ACTIVE start E+1), active same-day cancellation with one effective
   ACTIVE row followed by a successful later assignment, and a future row exactly on the
   boundary.
7. Audit primary-assignment temporal readers: active-at-date/overlap predicates use the
   half-open `endDate > boundary`; analytics that intentionally treat `endDate` as an event
   timestamp remain event queries and are documented as such. Correct the employee/LOA
   manuals that currently describe D-1 storage.
8. Add lock-controlled deterministic two-client PostgreSQL integration races for both
   delete-first and writer-first department orders. The former rejects the writer after
   post-lock lifecycle validation; the latter makes delete re-check membership and reject.
   Assert the barrier-observed wait order and final department/assignment state. Include
   reverse input order, multi-company, and null-sentinel lock-order unit cases.
9. Re-run targeted tests, both isolated concurrency suites, TypeScript, lint, unit, i18n,
   build, and Codex Gate 2 before commit/PR/deploy.

### Compatibility boundary

This closes concurrent phantom inserts and aligns runtime assignment writers/temporal
readers to the existing half-open effective-dating behavior without adding a schema
constraint. A future exclusion constraint remains separate because the database currently
has no range column/constraint and many current-state readers still use `endDate = null`.

### Existing-data preflight

The shared database read-only audit found 182 primary rows for 178 employees, zero inverted
ranges, zero future open rows, and zero half-open overlaps. The four rows that appear to
overlap under an inclusive interpretation are all exact
`old.endDate = next.effectiveDate` boundaries and are valid under the chosen canonical
interval. No data migration is required or allowed for S345.

### Temporal-reader audit closure

The unambiguous period-owned readers are part of S345. Attendance rosters, shift schedules,
payroll run detail/exports/anomalies, employee pay-item ownership, payroll self-service,
social insurance recalculation, and KR/RU statutory period reports resolve the assignment
that overlaps the requested business period and keep the persisted fact table's `companyId`
as the tenant fence. They must not project a later current assignment onto historical data.

`YearEndSettlement` has no company snapshot. Until that schema debt is resolved, ownership
is the one distinct company represented by primary assignments overlapping the settlement
year. Zero-company and multi-company years fail closed; they are never guessed from the
employee's current assignment.

The following reader findings remain explicit product/schema decisions and are not folded
into the S345 writer protocol:

- mandatory-training reporting must define a course-deadline population separately from
  current operational expiry metrics;
- annual leave accrual must choose whether the population is active on January 1, overlaps
  the calendar year, or is active on the processing date;
- gender pay-gap reporting must define the selected-year snapshot date;
- `mv_attendance_weekly` must persist company/time attribution before historical analytics
  can be exact across an intra-month entity transfer.

These items require a separate decision and, where noted, a schema/materialized-view change.
They do not relax any S345 assignment lock, half-open interval, CAS, or tenant-fence invariant.

## 13. Master-data lifecycle and release closure (S346)

S346 extended the primary-assignment writer protocol to the lifecycle of every master row
that a primary assignment can reference. Assignment writers lock the target company and
non-null JobGrade, EmployeeTitle, JobCategory, Position, and WorkLocation rows with
tenant-scoped `FOR SHARE` checks before the employee lock and final timeline write. Master
deletion locks the row with `FOR UPDATE`, then re-checks current or future assignment
references using the company-local date. Job grade, title, grade-title mapping, work
location, and Position deletion therefore cannot pass concurrently with a writer that has
already validated the same row.

Position lifecycle protection also covers non-assignment references. Active child reporting
lines, DRAFT/OPEN job postings, and draft/pending/approved requisitions block Position soft
deletion. Position POST/PUT, requisition POST/PATCH, and final requisition approval use one
tenant-exact Position reference helper. Position PUT locks source and target IDs in canonical
order, using `FOR UPDATE` for the source and `FOR SHARE` for targets, so reciprocal reporting
line edits cannot create a lock-order cycle. Requisition PATCH and approve/reject decisions
lock the fresh requisition row before their Position or approval-step locks; stale status,
step, company, and Position snapshots fail with a conflict.

Bulk movement now marks a stale primary-assignment hint with the shared retry code, so its
bounded outer retry rebuilds the hint and lock set. LOA return overrides, organization
restructure candidates, and all other audited primary writers validate the exact final
master IDs recorded by the new assignment.

### S346 verification

- Unit: 73 files / 1,060 tests pass.
- Isolated PostgreSQL concurrency: 22/22 pass, including writer-first Position deletion and
  delete-first hierarchy creation; retained company, employee, and Position fixtures are 0.
- TypeScript, full lint, Prisma validation, `git diff --check`, and the 368-page production
  build pass. Lint reports only pre-existing warnings outside this change set.
- i18n: 5,300 keys across all locales pass; shared DB migration status is 50/50 current;
  attendance timezone audit passes for all 12 companies.
- Independent Gate 2 incorporated the current/future reference, Position dependency,
  bulk-retry, real-path harness, soft-delete re-reference, and mixed approve/reject lock-order
  findings. The final read-only review is CLEAN with no remaining P0-P2 finding.

The Codex CLI review command was not rerun after the desktop policy blocked uncommitted
private-code review. The documented general-purpose independent reviewer fallback was used
instead. The local release candidate is complete; push, Vercel Preview, and production
remain unapplied pending their separate approvals.
