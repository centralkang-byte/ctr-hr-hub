# QF-REPORT: Run A-2 — Organization
Date: 2026-03-18
Tool: Claude Code Desktop (Opus)
Duration: ~35 min
Accounts: SA, HK, HC, EA

## Discovery Summary
- **Companies**: 13 active legal entities
- **Departments**: CTR-KR has 17 departments (most of any entity)
- **Restructure Plans**: 0 (clean slate)
- **Entity Transfers**: 0 (clean slate)
- **HR Documents**: 0 (clean slate)

## CRUD Score Card

| Entity | C | R | R(detail) | U | D | Account | Issues |
|--------|---|---|-----------|---|---|---------|--------|
| Org Tree | — | ✅ | — | — | — | SA,HK | |
| Companies | — | ✅ | — | — | — | SA,HK | HK sees all 13 (reference list by design) |
| Department | ✅ | ✅ | — | ✅ | — | HK | Create requires `level` field |
| Dept Hierarchy | — | ✅ | — | — | — | HK | **P0 FIXED**: was using wrong permission |
| Restructure Sim | ✅ | — | — | — | — | HK | |
| Restructure Plan | ✅ | ✅ | ✅ | ✅ | ✅ | HK | Uses `title` not `name` |
| Restr Plan Apply | ✅ | — | — | — | — | HK | |
| Org Snapshot | ✅ | ✅ | — | — | — | HK | Requires `companyId` in body |
| Change History | — | ✅ | — | — | — | HK | 2 entries after restructure tests |
| Entity Transfer | ✅ | ✅ | ✅ | — | — | HK,HC | Full 3-step approval workflow works |
| Transfer Approve | ✅ | — | — | — | — | HK→HC→SA | 3-step: from-HR → to-HR → executive |
| Transfer Execute | ✅ | — | — | — | — | SA | Actually moves employee assignment |
| Directory | — | ✅ | — | — | — | HK | 186 employees returned |
| HR Document | ✅ | ✅ | — | ✅ | ✅ | SA | **P2**: HK gets 403 (missing hr_chatbot perms) |

## RBAC Score Card

| Test | Account | Endpoint | Expected | Actual | Pass? |
|------|---------|----------|----------|--------|-------|
| Dept Create | EA | POST /org/departments | 403 | 403 | ✅ |
| Dept Update | EA | PUT /org/departments/{id} | 403 | 403 | ✅ |
| Restructure | EA | POST /org/restructure | 403 | 403 | ✅ |
| Restr Plan | EA | POST /org/restructure-plans | 403 | 403 | ✅ |
| Transfer Create | EA | POST /entity-transfers | 403 | 403 | ✅ |
| HR Doc Create | EA | POST /hr-documents | 403 | 403 | ✅ |
| HR Doc Delete | EA | DELETE /hr-documents/{id} | 403 | 403 | ✅ |
| Org Tree Read | EA | GET /org/tree | 200? | 403 | ⚠️ |
| Directory Read | EA | GET /directory | 200 | 200 | ✅ |
| Companies Read | EA | GET /companies | 200? | 403 | ⚠️ |

**Note**: Org Tree (403) and Companies (403) for EMPLOYEE is by design — these endpoints require `ORG:VIEW` permission which EMPLOYEE role does not have. Employees access org data through the directory instead.

## Issues

### [P0] Dept Hierarchy wrong permission — FIXED
- **File**: `src/app/api/v1/departments/hierarchy/route.ts`
- **Symptom**: HK (HR_ADMIN) got 403 on `GET /departments/hierarchy`
- **Root cause**: Route used `{ module: 'EMPLOYEE', action: 'read' }` instead of `perm(MODULE.ORG, ACTION.VIEW)`
- **Fix**: Changed to `perm(MODULE.ORG, ACTION.VIEW)` with proper imports
- **Verified**: HK now gets 200, returns 7 hierarchy items
- **Type check**: `npx tsc --noEmit` — 0 errors

### [P2] HR Documents inaccessible to HR_ADMIN
- **File**: `src/app/api/v1/hr-documents/route.ts`, `src/app/api/v1/hr-documents/[id]/route.ts`
- **Symptom**: HK gets 403 on all HR Document endpoints
- **Root cause**: Routes use `perm(MODULE.HR_CHATBOT, ACTION.VIEW/CREATE/UPDATE/DELETE)` but no `hr_chatbot` permissions exist in the `permissions` table. Only SUPER_ADMIN (permission bypass) can access.
- **Recommendation**: Add `hr_chatbot` CRUD permissions to the `permissions` table and grant them to HR_ADMIN role.

### [P2] Department Create requires undocumented `level` field
- **Symptom**: POST `/org/departments` returns 400 without `level` field
- **Root cause**: `departmentCreateSchema` requires `level: z.number()` but this is not obvious from the endpoint documentation
- **Recommendation**: Either make `level` optional with auto-calculation from parent, or document it clearly

## Entity Transfer Workflow Notes
- Full 3-step approval chain works correctly:
  1. HK (from-company HR) approves → status: FROM_APPROVED
  2. HC (to-company HR) approves → status: TO_APPROVED
  3. SA (executive) approves → status: EXEC_APPROVED
- Execute actually reassigns the employee's `EmployeeAssignment` to the target company
- **Critical**: EA was manually reversed back to CTR-KR after test execution to preserve test data integrity

## P0 Fix Log
| Fix | File | Before | After | tsc | Re-test |
|-----|------|--------|-------|-----|---------|
| Dept Hierarchy perm | departments/hierarchy/route.ts | `{module:'EMPLOYEE',action:'read'}` | `perm(MODULE.ORG, ACTION.VIEW)` | ✅ 0 errors | ✅ HK 200 |

## Cleanup Verification
- ✅ QA-TEST-001 department deleted
- ✅ QA-NEW-BIZ department deleted
- ✅ Restructure plan deleted
- ✅ Org change history entries deleted
- ✅ Entity transfer + data logs deleted
- ✅ Employee history entries cleaned
- ✅ HR document deleted
- ✅ EA (employee-a@ctr.co.kr) confirmed in CTR-KR

## Verdict
**CONDITIONAL PASS**
P0: 1 (fixed) | P1: 0 | P2: 2 | RBAC violations: 0
