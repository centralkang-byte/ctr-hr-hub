# QF-REPORT: Run A-4 — Attendance & Shifts
Date: 2026-03-18
Tool: Claude Code Desktop (Opus)
Duration: ~35 min
Accounts: EA (employee-a), M1 (manager), HK (hr@ctr.co.kr)

## CRUD Score Card

| Entity | C | R | R(detail) | U | D | Account | Issues |
|--------|---|---|-----------|---|---|---------|--------|
| Clock In | ✅ | — | — | — | — | EA | 201, requires `method` field |
| Clock Out | ✅ | — | — | — | — | EA | 200 |
| Today View | — | ✅ | — | — | — | EA | |
| Weekly Summary | — | ✅ | — | — | — | EA | |
| Attendance Record | — | ✅ | ✅ | ✅ | — | EA,HK | |
| Team Attendance | — | ✅ | — | — | — | M1 | Shows EA's record correctly |
| Admin Dashboard | — | ✅ | — | — | — | HK | KPI + anomalies |
| Employee Att | — | ✅ | — | — | — | HK | |
| Monthly Summary | — | ✅ | — | — | — | HK | Shows full month with seed data |
| Att Shifts | — | ✅ | — | ✅ | — | HK | GET requires startDate/endDate params |
| Att Approval Submit | ✅ | — | — | — | — | HK | requestType, title, approverIds required |
| Att Approval List | — | ✅ | ✅ | — | — | M1 | |
| Att Approval Approve | — | — | — | ✅ | — | M1 | Action must be lowercase ("approve") |
| Att Bulk Approve | ✅ | — | — | — | — | M1 | |
| Work Hour Alert | — | ✅ | — | — | — | M1 | No alerts in DB — no test data |
| Shift Pattern | ✅ | ✅ | ✅ | ✅ | ✅ | HK | slots use `start`/`end` not `startTime`/`endTime` |
| Shift Group | ✅ | ✅ | — | — | — | HK | GET requires `shiftPatternId` param |
| Group Members | — | ✅ | — | ✅ | — | HK | |
| Shift Roster | — | ✅ | — | ✅ | — | HK | assign uses work_schedule ID not shift_schedule |
| Roster Warnings | — | ✅ | — | — | — | HK | |
| Shift Schedule View | — | ✅ | — | — | — | HK | |
| Schedule Generate | ✅ | — | — | — | — | HK | Requires shiftPatternId |
| Shift Change Req | ✅ | ✅ | — | — | — | EA | |
| Shift Change Approve | — | — | — | ✅ | — | HK | M1 gets 403 (needs `attendance:manage`) |
| Holiday | ✅ | ✅ | ✅ | ✅ | ✅ | HK | **P0 fixed**: GET had `deletedAt: null` |
| Work Schedule | ✅ | ✅ | ✅ | ✅ | ✅ | HK | **P0 fixed**: GET had `deletedAt: null` |

## RBAC Score Card

| Test | Account | Endpoint | Expected | Actual | Pass? |
|------|---------|----------|----------|--------|-------|
| Shift Create | EA | POST /shift-patterns | 403 | 403 | ✅ |
| Shift Update | EA | PUT /shift-patterns/{id} | 403 | 403 | ✅ |
| Shift Delete | EA | DELETE /shift-patterns/{id} | 403 | 403 | ✅ |
| Group Create | EA | POST /shift-groups | 403 | 403 | ✅ |
| Holiday Create | EA | POST /holidays | 403 | 403 | ✅ |
| Holiday Delete | EA | DELETE /holidays/{id} | 403 | 403 | ✅ |
| WS Create | EA | POST /work-schedules | 403 | 403 | ✅ |
| WS Delete | EA | DELETE /work-schedules/{id} | 403 | 403 | ✅ |
| Admin View | EA | GET /attendance/admin | 403 | 403 | ✅ |
| Edit Record | EA | PUT /attendance/{id} | 403 | 403 | ✅ |
| Self Clock-in | EA | POST /attendance/clock-in | 200/400 | 201 | ✅ |
| Self Today | EA | GET /attendance/today | 200 | 200 | ✅ |
| Self Weekly | EA | GET /attendance/weekly-summary | 200 | 200 | ✅ |
| Self Shift Req | EA | GET /shift-change-requests | 200 | 200 | ✅ |

## Issues

### [P0] GET /holidays returns 500 — `deletedAt` field reference on Holiday model
- **Root cause**: `src/app/api/v1/holidays/route.ts:28` used `deletedAt: null` in the where clause, but the `holidays` table has no `deletedAt` column.
- **Fix**: Removed `deletedAt: null` from the where clause.
- **Verified**: GET /holidays now returns 200 with `total: 31`.

### [P0] GET /work-schedules returns 500 — same `deletedAt` issue
- **Root cause**: `src/app/api/v1/work-schedules/route.ts:39` used `deletedAt: null` in the where clause, but `work_schedules` table has no `deletedAt` column.
- **Fix**: Removed `deletedAt: null` from the where clause.
- **Verified**: GET /work-schedules now returns 200 with `total: 2`.

### [P0] RBAC: Employee can create shift-patterns, shift-groups, holidays, and work-schedules
- **Root cause**: Admin config routes (shift-patterns, shift-groups, holidays, work-schedules POST/PUT/DELETE) used `perm(MODULE.ATTENDANCE, ACTION.CREATE/UPDATE/DELETE)` which EMPLOYEE role has (needed for clock-in). Should use `perm(MODULE.ATTENDANCE, ACTION.APPROVE)` (maps to `manage` permission) which only HR_ADMIN+ roles have.
- **Fix**: Changed all admin config create/update/delete routes to use `ACTION.APPROVE` instead of `ACTION.CREATE/UPDATE/DELETE`:
  - `src/app/api/v1/shift-patterns/route.ts` POST
  - `src/app/api/v1/shift-patterns/[id]/route.ts` PUT, DELETE
  - `src/app/api/v1/shift-groups/route.ts` POST
  - `src/app/api/v1/shift-groups/[id]/members/route.ts` PUT
  - `src/app/api/v1/holidays/route.ts` POST
  - `src/app/api/v1/holidays/[id]/route.ts` PUT, DELETE
  - `src/app/api/v1/work-schedules/route.ts` POST
  - `src/app/api/v1/work-schedules/[id]/route.ts` PUT, DELETE
- **Verified**: EA now gets 403 on all admin ops; HK (HR_ADMIN) still gets 201.

### [P1] M1 (Manager) cannot approve shift-change-requests — needs `attendance:manage`
- **Impact**: Managers need to go through HR to approve shift changes for their direct reports. Could be intentional design (HR-only approval) but worth reviewing.
- **Status**: Not fixed — needs product decision.

### [P2] `deletedAt` pattern used across 118 API routes
- **Impact**: Many routes reference `deletedAt` on models that may not have it. Only holidays and work-schedules were in scope for this run, but the same bug likely exists on other modules.
- **Status**: Noted for future QF runs.

## P0 Fix Log

| # | File | Line | Before | After |
|---|------|------|--------|-------|
| 1 | `api/v1/holidays/route.ts` | 28 | `deletedAt: null,` | *(removed)* |
| 2 | `api/v1/work-schedules/route.ts` | 39 | `deletedAt: null,` | *(removed)* |
| 3 | `api/v1/shift-patterns/route.ts` | 101 | `ACTION.CREATE` | `ACTION.APPROVE` |
| 4 | `api/v1/shift-patterns/[id]/route.ts` | 110,146 | `ACTION.UPDATE/DELETE` | `ACTION.APPROVE` |
| 5 | `api/v1/shift-groups/route.ts` | 111 | `ACTION.CREATE` | `ACTION.APPROVE` |
| 6 | `api/v1/shift-groups/[id]/members/route.ts` | 198 | `ACTION.UPDATE` | `ACTION.APPROVE` |
| 7 | `api/v1/holidays/route.ts` | 90 | `ACTION.CREATE` | `ACTION.APPROVE` |
| 8 | `api/v1/holidays/[id]/route.ts` | 80,121 | `ACTION.UPDATE/DELETE` | `ACTION.APPROVE` |
| 9 | `api/v1/work-schedules/route.ts` | 103 | `ACTION.CREATE` | `ACTION.APPROVE` |
| 10 | `api/v1/work-schedules/[id]/route.ts` | 83,121 | `ACTION.UPDATE/DELETE` | `ACTION.APPROVE` |

**tsc --noEmit**: 0 errors after all fixes.

## Verdict

**CONDITIONAL PASS**

P0: 3 (all fixed) | P1: 1 | P2: 1 | RBAC violations: 0 (after fix)

All 3 P0s were found and fixed during the run:
- 2x Prisma `deletedAt` field reference on models without soft-delete
- 1x RBAC escalation allowing EMPLOYEE to perform admin config operations (affected 10 route handlers across 6 files)

Remaining P1 (manager shift-change approval) needs product decision on whether managers should have `attendance:manage` permission.
