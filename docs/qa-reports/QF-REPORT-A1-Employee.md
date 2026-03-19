# QF-REPORT: Run A-1 — Employee Core

Date: 2026-03-18
Tool: Claude Code Desktop (Opus)
Duration: ~35 min
Accounts: SA (super@ctr.co.kr), HK (hr@ctr.co.kr), EA (employee-a@ctr.co.kr)

## CRUD Score Card (🔑 = tested with)

| Entity | C | R(List) | R(Detail) | U | D | Account | Issues |
|--------|---|---------|-----------|---|---|---------|--------|
| Employee | ✅ | ✅ | ✅ | ✅ | ✅ | HK | Response wrapped in `data` key |
| Contract | ✅ | ✅ | ✅ | ✅ | N/A | HK | contractType: PERMANENT/FIXED_TERM (not FULL_TIME) |
| Document | ❌ | ✅ | N/A | N/A | N/A | HK | P2: field is `docType` + requires `title` — schema mismatch from prompt |
| History/Snapshot | N/A | ✅ | ✅ | N/A | N/A | HK | 8d: returns data for pre-hire date (P2) |
| Transfer | ✅ | N/A | N/A | N/A | N/A | HK | |
| Work Permit | ✅ | ✅ | N/A | ✅ | ✅ | HK | |
| Schedule | N/A | ✅ | N/A | N/A | N/A | HK | No seed schedule data |
| Emergency Contact | ✅ | ✅ | N/A | N/A | ✅ | EA | **P0 FIXED** — was 403, now works |
| Profile Extension | N/A | ✅ | N/A | ✅ | N/A | EA | **P0 FIXED** — was 403, now works |
| Visibility | N/A | ✅ | N/A | ✅ | N/A | EA | **P0 FIXED** — was 403, now works |
| Avatar | ✅ | N/A | N/A | N/A | N/A | EA | **P0 FIXED** — was 403, now works |
| Export | N/A | ✅ | N/A | N/A | N/A | SA | 107KB Excel, valid format |
| Bulk Upload | ❌ | N/A | N/A | N/A | N/A | SA | Returns INTERNAL_ERROR on malformed (expected 400) |
| Search | N/A | ✅ | N/A | N/A | N/A | HK | /api/employees/search (non-v1) |
| Insights | N/A | ✅ | N/A | N/A | N/A | HK | Goals, evals, succession |
| Compensation | N/A | ✅ | N/A | N/A | N/A | HK+EA | EA can view own (✅) |
| Offboarding | N/A | ✅ | N/A | N/A | N/A | HK | 404 for non-offboarded (correct) |

## RBAC Score Card

| Test | Account | Endpoint | Expected | Actual | Pass? |
|------|---------|----------|----------|--------|-------|
| R1 | EA | POST /employees | 403 | 403 | ✅ |
| R2 | EA | PUT /employees/:id | 403 | 403 | ✅ |
| R3 | EA | DELETE /employees/:id | 403 | 403 | ✅ |
| R4 | EA | GET /employees/export | 403 | 403 | ✅ |
| R5 | EA | POST /employees/bulk-upload | 403 | 403 | ✅ |

## Issues

### [P0] /me Self-Service Write Endpoints Return 403 for EMPLOYEE Role — **FIXED**

**Symptom**: All 5 `/me` write endpoints (POST emergency-contacts, DELETE emergency-contacts/:id, PUT profile-extension, PUT visibility, POST avatar) returned 403 FORBIDDEN for EMPLOYEE role.

**Root Cause**: These routes used `perm(MODULE.EMPLOYEES, ACTION.UPDATE)` which maps to `employees:update`. The EMPLOYEE role only has `employees:read` permission. Since `/me` routes are self-scoped (always use `user.employeeId`), they don't need the general `employees:update` permission.

**Fix**: Changed all 5 `/me` write route permission checks from `ACTION.UPDATE` to `ACTION.VIEW` (`employees:read`), which EMPLOYEE role has. Security is maintained because all data access is scoped to `user.employeeId`.

**Files Modified**:
- `src/app/api/v1/employees/me/emergency-contacts/route.ts` (POST)
- `src/app/api/v1/employees/me/emergency-contacts/[id]/route.ts` (DELETE)
- `src/app/api/v1/employees/me/profile-extension/route.ts` (PUT)
- `src/app/api/v1/employees/me/visibility/route.ts` (PUT)
- `src/app/api/v1/employees/me/avatar/route.ts` (POST)

**Verification**: All 5 endpoints return 200/201 after fix. tsc --noEmit passes with 0 errors.

### [P1] Bulk Upload Returns INTERNAL_ERROR Instead of 400

Sending malformed JSON to `POST /employees/bulk-upload` returns `INTERNAL_ERROR` instead of a proper 400 validation error. Not a security issue but poor error handling.

### [P2] Document Create Schema Mismatch

`POST /employees/:id/documents` requires fields `docType` and `title` (not `fileType`/`fileName` as might be expected). Not a bug — just needs API documentation alignment.

### [P2] Snapshot Returns Data for Pre-Hire Dates

`GET /employees/:id/snapshot?date=2020-01-01` returns employee data even when the date is before the hire date. Expected behavior: 404 or empty result. Low severity — edge case.

## P0 Fix Log

| Step | Action | Result |
|------|--------|--------|
| 1 | Read 5 `/me` route.ts files | Found `perm(MODULE.EMPLOYEES, ACTION.UPDATE)` on all write handlers |
| 2 | Query DB: EMPLOYEE role permissions | Only has `employees:read`, not `employees:update` |
| 3 | Changed all 5 files: `ACTION.UPDATE` → `ACTION.VIEW` | Self-service routes now accessible |
| 4 | `npx tsc --noEmit` | 0 errors |
| 5 | Re-ran all 5 `/me` write tests as EA | All pass (201/200) |

## Cross-Checks

| Check | Result |
|-------|--------|
| Orphaned assignments | 0 — ✅ |
| Test employee cleanup | Deleted — ✅ |
| tsc --noEmit | 0 errors — ✅ |

## Verdict

**CONDITIONAL PASS**

P0: 1 (fixed) | P1: 1 | P2: 2 | RBAC violations: 0

All P0 issues resolved. RBAC boundary is solid — EMPLOYEE role correctly denied on all HR-admin endpoints and correctly allowed on all `/me` self-service endpoints after fix. Core CRUD (Create, Read, Update, Delete) for Employee entity works correctly.
