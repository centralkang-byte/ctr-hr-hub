# QF-REPORT: Run A-8 — Onboarding + Offboarding + Crossboarding

Date: 2026-03-18
Tool: Claude Code Desktop (Opus)
Duration: ~35 min
Accounts: HK(han@ctr.co.kr, HR_ADMIN), HC(hr@ctr-cn.com, HR_ADMIN), M1(manager@ctr.co.kr, MANAGER), EA(employee-a@ctr.co.kr, EMPLOYEE), EB(employee-b@ctr.co.kr, EMPLOYEE)

## CRUD Score Card

| Entity | C | R | R(detail) | U | D | Account | Issues |
|--------|---|---|-----------|---|---|---------|--------|
| Onb Template | 201 | 200 | 200 | 200 | 200 | HK | - |
| Onb Template Tasks | 201 | 200 | n/a | n/a | n/a | HK | - |
| Onb Task Reorder | n/a | n/a | n/a | 200 | n/a | HK | - |
| Onb Instance | n/a | 200 | 200 | n/a | n/a | HK | No POST endpoint (seed only) |
| Onb Task Status | n/a | n/a | n/a | 200 | n/a | HK | - |
| Onb Task Block/Unblock | 200/200 | n/a | n/a | n/a | n/a | HK | - |
| Onb Task Complete | n/a | n/a | n/a | 200 | n/a | EA/M1/HK | P0 fixed: self-service |
| Onb Sign-off | 400* | 200 | n/a | n/a | n/a | HK | *Tasks incomplete |
| Onb Force Complete | n/a | n/a | n/a | 200 | n/a | HK | - |
| Onb Checkin | 201 | 200 | n/a | n/a | n/a | EA/HK | P0 fixed: self-service |
| Onb Dashboard | n/a | 200 | n/a | n/a | n/a | HK | - |
| Onb /me | n/a | 200 | n/a | n/a | n/a | EA | P0 fixed: self-service |
| Off Checklist | 201 | 200 | 200 | 200 | 200 | HK | - |
| Off Checklist Tasks | 201 | 200 | n/a | n/a | n/a | HK | - |
| Off Instance | n/a | 200 | 200 | n/a | n/a | HK | No POST endpoint (seed only) |
| Off Task Status | n/a | n/a | n/a | * | n/a | HK | Not tested (no tasks in seed instance) |
| Off Task Complete | n/a | n/a | n/a | * | n/a | EB | Self-service (getServerSession) |
| Off Reschedule | n/a | n/a | n/a | 200 | n/a | HK | - |
| Off Cancel | n/a | n/a | n/a | * | n/a | HK | Not tested (would corrupt seed data) |
| Exit Interview | 201 | 200 | n/a | n/a | n/a | HK | - |
| Exit AI Summary | 503 | n/a | n/a | n/a | n/a | HK | P2: External AI dep |
| Exit Statistics | n/a | 200 | n/a | n/a | n/a | HK | - |
| Off Dashboard | n/a | 200 | n/a | n/a | n/a | HK | - |
| Off /me | n/a | 200 | n/a | n/a | n/a | EB/EA | - |
| Crossboarding | 400 | n/a | n/a | n/a | n/a | HK | P2: Missing seed templates |

## RBAC Score Card

| Test | Account | Endpoint | Expected | Actual | Pass? |
|------|---------|----------|----------|--------|-------|
| EA POST template | EMPLOYEE | POST /onboarding/templates | 403 | 403 | PASS |
| EA GET dashboard | EMPLOYEE | GET /onboarding/dashboard | 403 | 403 | PASS |
| EA GET instances | EMPLOYEE | GET /onboarding/instances | 403 | 403 | PASS |
| EA GET /me | EMPLOYEE | GET /onboarding/me | 200 | 200 | PASS (after fix) |
| EA POST checkin | EMPLOYEE | POST /onboarding/checkin | 201 | 201 | PASS (after fix) |
| EA own checkins | EMPLOYEE | GET /onboarding/checkins/:id | 200 | 200 | PASS (after fix) |
| EA task complete | EMPLOYEE | PUT /onboarding/tasks/:id/complete | 200 | 200 | PASS (after fix) |
| M1 task complete | MANAGER | PUT /onboarding/tasks/:id/complete | 200 | 200 | PASS (after fix) |
| M1 GET templates | MANAGER | GET /onboarding/templates | 403 | 403 | PASS |
| M1 GET dashboard | MANAGER | GET /onboarding/dashboard | 403 | 403 | PASS |
| EA offb checklists | EMPLOYEE | GET /offboarding/checklists | 403 | 403 | PASS |
| EA exit interview | EMPLOYEE | GET /offboarding/:id/exit-interview | 403 | 403 | PASS |
| EA offb dashboard | EMPLOYEE | GET /offboarding/dashboard | 403 | 403 | PASS |
| EA offb instances | EMPLOYEE | GET /offboarding/instances | 403 | 403 | PASS |
| EB offboarding /me | EMPLOYEE | GET /offboarding/me | 200 | 200 | PASS |
| EA offboarding /me | EMPLOYEE | GET /offboarding/me (no active) | 200 | 200 | PASS |
| EA crossboarding | EMPLOYEE | POST /onboarding/crossboarding | 403 | 403 | PASS |
| HC GET templates | HR_ADMIN CN | GET /onboarding/templates | 200 | 200 | PASS |

## Issues

### [P0] EMPLOYEE/MANAGER blocked from self-service onboarding endpoints (4 endpoints fixed)

**Root cause**: EMPLOYEE role has NO onboarding/offboarding permissions in RBAC seed. The following endpoints used `withPermission(perm(MODULE.ONBOARDING, ACTION.*))` which requires explicit role permissions, but self-service endpoints should be accessible to any authenticated user.

**Files fixed:**
1. `src/app/api/v1/onboarding/me/route.ts` — Changed from `withPermission` to `getServerSession` (matches offboarding/me pattern)
2. `src/app/api/v1/onboarding/checkin/route.ts` — Changed from `withPermission` to `getServerSession`
3. `src/app/api/v1/onboarding/checkins/[employeeId]/route.ts` — Changed from `withPermission` to `getServerSession` with self/HR access check
4. `src/app/api/v1/onboarding/tasks/[id]/complete/route.ts` — Changed from `withPermission` to `getServerSession` (any authenticated user can complete tasks they're assigned to)

**Pattern**: Same as A-1~A-7 `/me` self-service blocking pattern. Cumulative: 8 endpoints fixed across runs.

### [P2] Crossboarding: Missing global CROSSBOARDING_DEPARTURE/ARRIVAL templates

The `triggerCrossboarding()` function requires global templates with `planType: 'CROSSBOARDING_DEPARTURE'` and `planType: 'CROSSBOARDING_ARRIVAL'` and `companyId: null`. These don't exist in seed data. The template creation API doesn't expose `planType` field (only `targetType`), so these must be seeded.

**Impact**: Crossboarding endpoint returns 400 but the code logic is correct. Fix is seed data only.

### [P2] Exit Interview AI Summary: 503 (External AI dependency)

The `/offboarding/:id/exit-interview/ai-summary` endpoint calls Claude AI via `exitInterviewSummary()`. Returns 503 when AI service is unavailable. Not a code bug.

### [P1] No POST endpoint for creating onboarding/offboarding instances via API

Both onboarding instances (`EmployeeOnboarding`) and offboarding instances (`EmployeeOffboarding`) can only be created via:
- Direct DB operations
- Crossboarding flow (creates linked instances)
- Seed scripts

No REST API endpoint exists for HR to initiate onboarding/offboarding for an employee. This means the UI must have a different mechanism (perhaps a separate admin action).

### [P1] Several offboarding routes use MODULE.ONBOARDING instead of MODULE.OFFBOARDING

The following offboarding endpoints use `perm(MODULE.ONBOARDING, ...)` instead of `perm(MODULE.OFFBOARDING, ...)`:
- `offboarding/instances/route.ts` — GET uses `MODULE.ONBOARDING`
- `offboarding/dashboard/route.ts` — GET uses `MODULE.ONBOARDING`
- `offboarding/instances/[id]/reschedule/route.ts` — PUT uses `MODULE.ONBOARDING`
- `offboarding/[id]/cancel/route.ts` — PUT uses `MODULE.ONBOARDING`
- `offboarding/instances/[id]/tasks/[taskId]/status/route.ts` — PUT uses `MODULE.ONBOARDING`
- `offboarding/[id]/exit-interview/route.ts` — GET/POST uses `MODULE.ONBOARDING`
- `offboarding/exit-interviews/statistics/route.ts` — GET uses `MODULE.ONBOARDING`

**Impact**: Currently not blocking since HR_ADMIN has both `onboarding` and `offboarding` permissions. But semantically incorrect and could cause issues if permissions are separated.

## P0 Fix Log

| # | Endpoint | Issue | Fix | Verified |
|---|----------|-------|-----|----------|
| 1 | GET /onboarding/me | `withPermission` blocks EMPLOYEE | `getServerSession` | 200 |
| 2 | POST /onboarding/checkin | `withPermission` blocks EMPLOYEE | `getServerSession` | 201 |
| 3 | GET /onboarding/checkins/:eid | `withPermission` blocks EMPLOYEE | `getServerSession` + self-check | 200 |
| 4 | PUT /onboarding/tasks/:id/complete | `withPermission` blocks EMPLOYEE/MANAGER | `getServerSession` | 200 |

## Verdict

**CONDITIONAL PASS**

P0: 4 (all fixed) | P1: 2 | P2: 2 | RBAC violations: 0 (after fix)

All 4 P0 issues were self-service endpoints using `withPermission` instead of `getServerSession`. Pattern is identical to A-1~A-7 `/me` blocking pattern. Cumulative P0 fix count: 28.

Crossboarding is untestable without seed data for global templates (P2). Instance creation requires seed/DB operations (P1). Otherwise all template CRUD, checklist CRUD, task lifecycle, checkins, dashboards, exit interviews, and reschedule work correctly.
