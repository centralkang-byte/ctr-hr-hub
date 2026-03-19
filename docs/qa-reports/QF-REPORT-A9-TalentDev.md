# QF-REPORT: Run A-9 — Talent & Development

| Field | Value |
|-------|-------|
| Date | 2026-03-18 |
| Tool | Claude Code Desktop (Opus) |
| Duration | ~35 min |
| Accounts | HK(한지영/HR_ADMIN), M1(박준혁/MANAGER), EA(이민준/EMPLOYEE), EB(정다은/EMPLOYEE) |
| Endpoints tested | 42 routes across 7 subdomains |

---

## P0 Fixes Applied (3건)

### P0-1: Missing permission modules — training, pulse, succession
- **Root cause**: `prisma/seed.ts` line 116 — `modules` array missing `training`, `pulse`, `succession`
- **Impact**: ALL roles (including HR_ADMIN) got 403 on all training/pulse/succession endpoints
- **Fix**: `scripts/qa-fix-perms.ts` — seeded 18 permissions (3 modules × 6 actions) + 32 role-permissions
- **Scope**: HR_ADMIN gets all; MANAGER gets training:read/create, pulse:read, succession:read; EMPLOYEE gets training:read/create, pulse:read/create
- **Note**: seed.ts is PROTECTED — fix applied via separate script. Seed file should be updated to include these modules.

### P0-2: Disciplinary appeal blocks employee self-service (403)
- **File**: `src/app/api/v1/disciplinary/[id]/appeal/route.ts`
- **Root cause**: Used `withPermission(perm(MODULE.DISCIPLINE, ACTION.UPDATE))` — employees don't have `discipline:update`
- **Fix**: Changed to `withAuth()` + ownership check (`existing.employeeId !== user.employeeId`)
- **Pattern**: Self-service (A-8 pattern — 8th instance)
- **Retest**: EA PUT appeal → 200 ✅

### P0-3: Training course RBAC — employees can create courses
- **Files**: `src/app/api/v1/training/courses/route.ts`, `src/app/api/v1/training/courses/[id]/route.ts`
- **Root cause**: Course creation used `training:create` — same permission as enrollment. Employees with `training:create` (for self-enrollment) could also create courses.
- **Fix**: Changed course POST/PUT/DELETE to `training:manage` (ACTION.APPROVE). Enrollment POST stays at `training:create`.
- **Retest**: EA POST course → 403 ✅

---

## P1 Issues (3건)

### P1-1: M1 (MANAGER) missing `performance:create` permission
- **Impact**: M1 couldn't create 1:1 meetings (403)
- **Fix**: Added `performance:create` to MANAGER role via `scripts/qa-fix-mgr-perms.ts`
- **Note**: Seed file should be updated

### P1-2: Gap report POST returns 500 on missing fields
- **File**: `src/app/api/v1/skills/gap-report/route.ts` POST handler
- **Root cause**: No Zod validation on POST body — missing `assessmentPeriod` and `reportData` fields cause unhandled Prisma error
- **Expected**: 400 with validation error
- **Actual**: 500 INTERNAL_ERROR

### P1-3: Pulse survey POST RBAC order — validation runs before permission check
- **Impact**: EA POST `/pulse/surveys` returns 400 (validation error) instead of 403 (permission denied)
- **Root cause**: `withPermission` wrapper runs handler before checking permissions on some code paths
- **Not blocking**: Functional impact is nil (EA still can't create surveys), but leaks API shape info

---

## P2 Issues (2건)

### P2-1: Skills gap-report accessible to all employees
- **Endpoint**: GET `/skills/gap-report`
- **Permission**: `employees:read` — all roles have this
- **Expected**: Gap report should be HR/Manager only
- **Actual**: EA can read full gap report (200)

### P2-2: 1:1 dashboard permission too restrictive for managers
- **Endpoint**: GET `/cfr/one-on-ones/dashboard`
- **Permission**: `performance:manage` — only HR_ADMIN/SUPER_ADMIN
- **Expected**: Managers should see their own team dashboard
- **Note**: By design or oversight — documented for product review

---

## CRUD Score Card

| Entity | C | R | R(detail) | U | D | Account | Issues |
|--------|---|---|-----------|---|---|---------|--------|
| Skills Matrix | n/a | ✅200 | n/a | n/a | n/a | HK | |
| Skills Radar | n/a | ✅200 | n/a | n/a | n/a | EA | |
| Skill Assessment | ✅201 | ✅200 | n/a | n/a | n/a | EA | Needs assessmentPeriod, selfLevel |
| Skill Team Assessment | ✅201 | ✅200 | n/a | n/a | n/a | M1 | Needs assessmentPeriod |
| Gap Report | ❌500→P1 | ✅200 | n/a | n/a | n/a | HK | POST missing validation |
| Training Course | ✅201 | ✅200 | ✅200 | ✅200 | ✅200 | HK | P0-3 RBAC fixed |
| Training Enrollment | ✅201 | ✅200 | n/a | n/t | n/a | EA | Uses employeeIds[] array |
| Mandatory Config | ✅201 | ✅200 | n/a | n/t | n/t | HK | Lowercase enums: all/annual |
| Mandatory Enroll | ✅200 | n/a | n/a | n/a | n/a | HK | Needs year field |
| Training /my | n/a | ✅200 | n/a | n/a | n/a | EA | |
| Training Recommendations | n/a | ✅200 | n/a | n/a | n/a | EA | |
| Training Dashboard | n/a | ✅200 | n/a | n/a | n/a | HK | |
| Training Skill Assessment | ✅201 | ✅200 | n/a | n/a | n/a | HK | |
| Mandatory Status | n/a | ✅200 | n/a | n/a | n/a | HK | |
| 1:1 Meeting | ✅201 | ✅200 | ✅200 | ✅200 | n/a | M1 | P1-1 permission fix |
| 1:1 Dashboard | n/a | ✅200 | n/a | n/a | n/a | HK | M1 gets 403 (P2-2) |
| Recognition | ✅201 | ✅200 | n/a | n/a | n/a | EB→EA | |
| Recognition Like | ✅200 | n/a | n/a | n/a | n/a | EA | |
| Recognition /employee | n/a | ✅200 | n/a | n/a | n/a | HK | |
| Recognition Stats | n/a | ✅200 | n/a | n/a | n/a | HK | |
| Pulse Survey | ✅201 | ✅200 | ✅200 | ✅200 | ✅200 | HK | |
| Pulse Questions | n/a | n/a | n/a | ⚠400 | n/a | HK | Can't edit ACTIVE survey (correct) |
| Pulse Respond | ⚠400 | n/a | n/a | n/a | n/a | EA | openAt in future |
| Pulse /my-pending | n/a | ✅200 | n/a | n/a | n/a | EA | |
| Pulse Results | n/a | ⚠400 | n/a | n/a | n/a | HK | No responses yet |
| Succession Plan | ✅201 | ✅200 | ✅200 | ✅200 | ✅200 | HK | |
| Succession Candidate | ✅201 | ✅200 | n/a | ✅200 | ✅200 | HK | |
| Succession Dashboard | n/a | ✅200 | n/a | n/a | n/a | HK | |
| Readiness Batch | ⚠400 | n/a | n/a | n/a | n/a | HK | Needs employeeIds[] |
| Disciplinary Case | ✅201 | ✅200 | ✅200 | ✅200 | n/a | HK | |
| Disciplinary Appeal | n/a | n/a | n/a | ✅200 | n/a | EA | P0-2 self-service fix |
| Reward | ✅201 | ✅200 | ✅200 | ✅200 | ✅200 | HK | |

Legend: ✅ Pass | ❌ Fail | ⚠ Expected behavior/validation | n/a Not applicable | n/t Not tested (blocker)

---

## RBAC Score Card

| Test | Account | Endpoint | Expected | Actual | Pass? |
|------|---------|----------|----------|--------|-------|
| EA GET skills/matrix | EA | GET /skills/matrix | 200 | 200 | ✅ |
| EA GET skills/radar | EA | GET /skills/radar | 200 | 200 | ✅ |
| EA GET skills/assessments | EA | GET /skills/assessments | 200 | 200 | ✅ |
| EA POST skills/assessments | EA | POST /skills/assessments | 201 | 201 | ✅ |
| EA GET skills/gap-report | EA | GET /skills/gap-report | 403 | 200 | ❌ P2-1 |
| EA GET training/my | EA | GET /training/my | 200 | 200 | ✅ |
| EA GET training/recommendations | EA | GET /training/recommendations | 200 | 200 | ✅ |
| EA POST training/courses | EA | POST /training/courses | 403 | 403 | ✅ (P0-3 fixed) |
| EA POST training/enrollments | EA | POST /training/enrollments | 201 | 201 | ✅ |
| EA GET pulse/my-pending | EA | GET /pulse/my-pending | 200 | 200 | ✅ |
| EA POST pulse/surveys | EA | POST /pulse/surveys | 403 | 400 | ⚠ P1-3 |
| EA GET succession/plans | EA | GET /succession/plans | 403 | 403 | ✅ |
| EA GET succession/dashboard | EA | GET /succession/dashboard | 403 | 403 | ✅ |
| EA POST disciplinary | EA | POST /disciplinary | 403 | 403 | ✅ |
| EA PUT disciplinary/:id/appeal | EA | PUT appeal | 200 | 200 | ✅ (P0-2 fixed) |
| EA POST rewards | EA | POST /rewards | 403 | 403 | ✅ |
| EA GET rewards | EA | GET /rewards | 403 | 403 | ✅ |
| EB POST cfr/recognitions | EB | POST /cfr/recognitions | 201 | 201 | ✅ |
| M1 GET skills/team-assessments | M1 | GET /skills/team-assessments | 200 | 200 | ✅ |
| M1 POST cfr/one-on-ones | M1 | POST /cfr/one-on-ones | 201 | 201 | ✅ (P1-1 fixed) |
| M1 GET cfr/one-on-ones/dashboard | M1 | GET 1:1 dashboard | 403 | 403 | ⚠ P2-2 |
| M1 GET disciplinary | M1 | GET /disciplinary | 200 | 200 | ✅ |
| HK full CRUD all modules | HK | All endpoints | 200/201 | 200/201 | ✅ |

---

## Summary

| Category | Count |
|----------|-------|
| Endpoints tested | 42 |
| P0 fixed | 3 (permissions seed, appeal self-service, course RBAC) |
| P1 found | 3 (manager permission, gap-report 500, RBAC order) |
| P2 found | 2 (gap-report access, 1:1 dashboard scope) |
| RBAC tests | 23 |
| RBAC pass rate | 20/23 (87%) |

### Files Modified
1. `src/app/api/v1/disciplinary/[id]/appeal/route.ts` — P0-2: self-service fix
2. `src/app/api/v1/training/courses/route.ts` — P0-3: RBAC elevation (create→manage)
3. `src/app/api/v1/training/courses/[id]/route.ts` — P0-3: RBAC elevation (update/delete→manage)

### Scripts Created (non-production)
- `scripts/qa-fix-perms.ts` — Seeds missing training/pulse/succession permissions
- `scripts/qa-fix-mgr-perms.ts` — Adds performance:create to MANAGER role
- `scripts/qa-disc.ts`, `scripts/qa-disc2.ts`, `scripts/qa-disc3.ts` — Discovery scripts

### Seed File Action Required (DO NOT MODIFY seed.ts directly)
`prisma/seed.ts` line 116-120 needs `'training', 'pulse', 'succession'` added to `modules` array.
Line 135-138 MANAGER needs `'performance_create'` added.

### Verdict
**PASS with fixes** — All 7 subdomains functional after P0 fixes. 3 P1 and 2 P2 items logged for follow-up.
