# QF-REPORT: Run A-3 — Leave

Date: 2026-03-18
Tool: Claude Code Desktop (Opus)
Duration: ~35 min
Accounts: EA (Employee), M1 (Manager), HK (HR Admin), SA (Super Admin)

## Discovery Notes

- **Approval mechanism**: Direct manager approval via permission check (no ApprovalFlow for leave)
- **Balance deduction timing**: pendingDays incremented at request creation, moved to usedDays at approval
- **Two balance models**: `EmployeeLeaveBalance` (policy-based, used by request CRUD) and `LeaveYearBalance` (type-def-based, used by analytics)
- **EA initial balance**: 15 granted, 0 used, 0 pending (manually created for testing — no pre-existing EmployeeLeaveBalance for EA)
- **Type-defs require `MODULE.SETTINGS` permission** (SA, not HK)
- **Policies require `MODULE.LEAVE` + `ACTION.APPROVE`** (HK works)
- **Cancel route**: 3 scenarios (PENDING, APPROVED pre-start, APPROVED post-start/HR only) — handles balance directly in transaction
- **Delegation**: Supported via `checkDelegation()` in approve/reject

## CRUD Score Card

| Entity | C | R | R(detail) | U | D | Account | Issues |
|--------|---|---|-----------|---|---|---------|--------|
| Leave Type Def | ✅ | ✅ | ✅ | ✅ | ✅ | SA | HK gets 403 (requires settings permission) |
| Accrual Rules | — | ✅ | — | ✅ | — | SA | |
| Leave Policy | ✅ | ✅ | ✅ | ✅ | ✅ | HK | UNPAID leaveType → 500 (P2) |
| Leave Request | ✅ | ✅ | ✅ | — | — | EA | |
| Request Approve | ✅ | — | — | — | — | M1 | **P0 found & fixed** (see below) |
| Request Cancel | ✅ | — | — | — | — | EA | |
| Request Reject | ✅ | — | — | — | — | M1 | Same P0 pattern (fixed) |
| Team Leave | — | ✅ | — | — | — | M1 | |
| Balances (my) | — | ✅ | — | — | — | HK | |
| Balances (employee) | — | ✅ | — | — | — | HK | |
| Admin Dashboard | — | ✅ | — | — | — | HK | |
| Admin Stats | — | ✅ | — | — | — | HK | |
| Year Balances | — | ✅ | — | — | — | HK | |
| Accrual Run | ✅ | — | — | — | — | SA | 333 processed, 0 errors |
| Bulk Grant | ✅ | — | — | — | — | HK | EA +3 → 18, M1 +3 → 18 |

**CRUD Total: 25/25 endpoints tested ✅**

## Balance Reconciliation

| Metric | Value |
|--------|-------|
| Initial balance (granted/used/pending) | 15 / 0 / 0 |
| Request #1 (approved, 2 days) | used +2 |
| Request #2 (cancelled from PENDING) | 0 net change |
| Request #3 (rejected, 1 day) | 0 net change |
| Bulk grant | +3 granted |
| **Expected final** | 18 / 2 / 0 |
| **Actual final** | 18 / 2 / 0 |
| **Match?** | ✅ (post-fix) |

## RBAC Score Card

| Test | Account | Endpoint | Expected | Actual | Pass? |
|------|---------|----------|----------|--------|-------|
| Type Def Create | EA | POST /leave/type-defs | 403 | 403 | ✅ |
| Type Def Update | EA | PUT /leave/type-defs/{id} | 403 | 403 | ✅ |
| Type Def Delete | EA | DELETE /leave/type-defs/{id} | 403 | 403 | ✅ |
| Policy Create | EA | POST /leave/policies | 403 | 403 | ✅ |
| Policy Update | EA | PUT /leave/policies/{id} | 403 | 403 | ✅ |
| Policy Delete | EA | DELETE /leave/policies/{id} | 403 | 403 | ✅ |
| Bulk Grant | EA | POST /leave/bulk-grant | 403 | 403 | ✅ |
| Accrual Run | EA | POST /leave/accrual | 403 | 403 | ✅ |
| Admin View | EA | GET /leave/admin | 403 | 403 | ✅ |
| Admin Stats | EA | GET /leave/admin/stats | 403 | 403 | ✅ |
| Self Request | EA | GET /leave/requests | 200 | 200 | ✅ |
| Self Balances | EA | GET /leave/balances | 200 | 200 | ✅ |

**RBAC: 12/12 ✅**

## Issues

### [P0] Double balance update on leave approve/reject — event handler duplication

**Root Cause**: All three leave event handlers (`leave-approved`, `leave-rejected`, `leave-cancelled`) unconditionally updated balance regardless of whether called with `tx` or without. The approve/reject routes published the event TWICE:

1. Inside `$transaction` (line 104): `eventBus.publish(DOMAIN_EVENTS.LEAVE_APPROVED, payload, tx)` — handler updates balance inside tx
2. Fire-and-forget (line 136): `void eventBus.publish(DOMAIN_EVENTS.LEAVE_APPROVED, payload)` — handler updates balance AGAIN outside tx

**Compounding factor**: Next.js dev hot-reload re-runs `bootstrap.ts` which re-registers handlers on the global EventBus singleton (the `bootstrapped` module-level flag resets on file reload, but `globalThis.__eventBus` persists). This caused handlers to multiply with each hot-reload, making the double-count even worse (4x, 8x, etc.).

**Symptom**: After approving a 2-day request starting from balance 15/0/0:
- Expected: granted=15, used=2, pending=0
- Actual: granted=15, used=8, pending=-6

**Fix (3 files)**:

1. **approve/route.ts**: Replaced `eventBus.publish(LEAVE_APPROVED, ..., tx)` with direct `tx.employeeLeaveBalance.update()`. Replaced fire-and-forget event publish with direct `sendNotification()`.

2. **reject/route.ts**: Same pattern — direct balance update in transaction + direct notification.

3. **cancel/route.ts**: Already used direct balance updates in transaction. Removed fire-and-forget `eventBus.publish()` calls (which passed `balanceId: ''` — a secondary bug that would have caused handler failures).

4. **bootstrap.ts**: Added `eventBus.clearAll()` before handler registration to prevent duplication on hot-reload.

5. **Event handlers** (leave-approved, leave-rejected, leave-cancelled): Added `if (tx)` / `if (!tx)` guards to prevent balance updates when called without transaction. This is a defense-in-depth fix for any future event publishing.

### [P2] LeavePolicy POST with leaveType `UNPAID` returns 500

**Description**: Creating a leave policy with `leaveType: "UNPAID"` returns 500 "데이터베이스 오류가 발생했습니다" instead of a proper validation error.
**Workaround**: Use valid enum values (ANNUAL, SICK, SPECIAL, etc.)
**Impact**: Minor — only affects admin settings UI, correct enum values work fine.

### [P2] HK (HR_ADMIN) cannot access Leave Type Definitions CRUD

**Description**: Type-defs use `MODULE.SETTINGS` permission, not `MODULE.LEAVE`. HK (HR_ADMIN) gets 403 on all type-def endpoints. SA (SUPER_ADMIN) works.
**Impact**: Low — HR admins may need SA delegation for leave type configuration.

### [P2] EA had no EmployeeLeaveBalance record

**Description**: EA (employee-a@ctr.co.kr) had a `LeaveYearBalance` record (type-def model) but no `EmployeeLeaveBalance` record (policy model). The leave request POST requires the policy-based balance to exist. This was manually created for testing.
**Impact**: Employees without EmployeeLeaveBalance records cannot submit leave requests, even if they have LeaveYearBalance records. The accrual run appears to create these (333 processed), but new employees may need explicit balance provisioning.

## P0 Fix Log

| Step | Action | Result |
|------|--------|--------|
| 1 | Diagnosed double-count in approve/reject event handlers | Root cause: event published 2x (in-tx + fire-and-forget) |
| 2 | Fixed handler files (if tx guards) | Hot-reload didn't pick up changes (globalThis caching) |
| 3 | Fixed route files: direct balance update in tx + direct notification | Hot-reload picked up route changes ✅ |
| 4 | Fixed bootstrap.ts: clearAll() before re-registration | Prevents handler accumulation on hot-reload |
| 5 | `npx tsc --noEmit` | 0 errors ✅ |
| 6 | Re-tested full lifecycle | Balance: 15/2/0 after approve ✅ |
| 7 | Verified cancel and reject | Balance math correct ✅ |

**Files Modified:**
- `src/app/api/v1/leave/requests/[id]/approve/route.ts`
- `src/app/api/v1/leave/requests/[id]/reject/route.ts`
- `src/app/api/v1/leave/requests/[id]/cancel/route.ts`
- `src/lib/events/handlers/leave-approved.handler.ts`
- `src/lib/events/handlers/leave-rejected.handler.ts`
- `src/lib/events/handlers/leave-cancelled.handler.ts`
- `src/lib/events/bootstrap.ts`

## Verdict

**CONDITIONAL PASS**

P0: 1 (found & fixed) | P1: 0 | P2: 3 | RBAC violations: 0 | Balance integrity: ✅ (post-fix)

The leave module's core CRUD and lifecycle work correctly after the P0 fix. The double balance update was a critical data integrity bug affecting all approve/reject operations. The fix eliminates the event-handler-based balance updates in favor of direct transactional updates (consistent with the cancel route's existing pattern).
