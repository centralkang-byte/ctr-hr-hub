# Phase 3 Patch Report — Assignment Pattern Analysis

> Generated: 2026-03-20
> Total files scanned: 87 (with assignment-related patterns)
> Total patch points: 131
> SAFE (no patch needed): 28 files

## Classification Rules
- **fetchPrimaryAssignment**: Use when doing a DB query for a single employee (detail API, no prior include)
- **extractPrimaryAssignment**: Use when assignments[] array is already in memory (list API with include, frontend component)
- **SAFE**: Already uses isPrimary filter via findFirst/findMany, or is a type definition, or is displaying all assignments (e.g., assignment history)

---

## Batch 1 — Core Modules (42 files, 52 patch points)

Paths: `src/app/api/v1/employees/**`, `src/app/api/v1/attendance/**`, `src/app/api/v1/leave/**`, `src/app/api/v1/payroll/**`, `src/app/api/v1/performance/**`, `src/lib/payroll/**`, `src/lib/leave/**`, `src/lib/attendance/**`, `src/lib/events/handlers/**`

### Employee APIs

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 1 | src/app/api/v1/employees/[id]/route.ts | 73 | `employee.assignments?.[0]` | extractPrimary | GET flatten; include has isPrimary |
| 2 | src/app/api/v1/employees/[id]/route.ts | 162 | `employee.assignments[0]?.companyId` | extractPrimary | PUT; include has isPrimary |
| 3 | src/app/api/v1/employees/[id]/route.ts | 247 | `employee.assignments[0]?.companyId` | extractPrimary | DELETE; include has isPrimary |
| 4 | src/app/api/v1/employees/route.ts | 117 | `emp.assignments?.[0]` | extractPrimary | List flatten; include has isPrimary |
| 5 | src/app/api/v1/employees/export/route.ts | 75 | `e.assignments[0]` | extractPrimary | Export; include has isPrimary |
| 6 | src/app/api/v1/employees/[id]/documents/route.ts | 96 | `employee.assignments[0]?.companyId` | extractPrimary | |
| 7 | src/app/api/v1/employees/[id]/work-permits/route.ts | 90 | `employee.assignments[0]?.companyId` | extractPrimary | |
| 8 | src/app/api/v1/employees/[id]/compensation/route.ts | 60 | `employee.assignments[0]` | extractPrimary | |
| 9 | src/app/api/v1/employees/[id]/schedules/route.ts | 107 | `employee.assignments[0]?.companyId` | extractPrimary | |
| 10 | src/app/api/v1/employees/[id]/transfer/route.ts | 83 | `employee.assignments[0]?.companyId` | extractPrimary | |
| 11 | src/app/api/v1/employees/[id]/offboarding/start/route.ts | 104 | `employee.assignments[0]` | extractPrimary | |
| 12 | src/app/api/v1/employees/[id]/contracts/route.ts | 175 | `employeeRaw.assignments[0]?.companyId` | extractPrimary | |
| 13 | src/app/api/v1/employees/[id]/contracts/[contractId]/route.ts | 82 | `employee.assignments[0]?.companyId` | extractPrimary | |

### Attendance APIs

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 14 | src/app/api/v1/attendance/shifts/route.ts | 101, 135 | `m.employee.assignments[0]?.department?.name` | extractPrimary | 2 patch points |
| 15 | src/app/api/v1/attendance/team/route.ts | 27, 90 | `manager?.assignments?.[0]?.departmentId` | extractPrimary | 2 patch points |

### Leave APIs

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 16 | src/app/api/v1/leave/balances/[employeeId]/route.ts | 35 | `employee.assignments?.[0]?.companyId` | extractPrimary | |
| 17 | src/app/api/v1/leave/admin/stats/route.ts | 108, 143, 156 | `emp?.assignments?.[0]` | extractPrimary | 3 patch points |
| 18 | src/app/api/v1/leave/admin/route.ts | 87 | `emp.assignments?.[0]` | extractPrimary | |
| 19 | src/app/api/v1/leave/team/route.ts | 38 | `manager?.assignments?.[0]?.departmentId` | extractPrimary | |

### Payroll APIs

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 20 | src/app/api/v1/payroll/anomalies/route.ts | 78, 113, 129, 162 | `item.employee.assignments[0]` | extractPrimary | 4 patch points |
| 21 | src/app/api/v1/payroll/[runId]/export/comparison/route.ts | 79 | `emp.assignments?.[0]?.department?.name` | extractPrimary | |
| 22 | src/app/api/v1/payroll/[runId]/export/ledger/route.ts | 46 | `emp.assignments?.[0]` | extractPrimary | |
| 23 | src/app/api/v1/payroll/[runId]/export/journal/route.ts | 43 | `item.employee.assignments?.[0]?.department?.name` | extractPrimary | |
| 24 | src/app/api/v1/payroll/employees/[id]/pay-items/route.ts | 108 | `employee.assignments?.[0]` | extractPrimary | |
| 25 | src/app/api/v1/payroll/[runId]/comparison/route.ts | 133 | `emp.assignments?.[0]` | extractPrimary | |
| 26 | src/app/api/v1/payroll/simulation/route.ts | 231 | `emp.assignments?.[0]` | extractPrimary | |
| 27 | src/app/api/v1/payroll/[runId]/approval-status/route.ts | 86 | `step.approver?.assignments?.[0]?.department?.name` | extractPrimary | |

### Performance APIs

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 28 | src/app/api/v1/performance/peer-review/results/[employeeId]/route.ts | 123 | `n.nominee.assignments[0]?.department?.name` | extractPrimary | |
| 29 | src/app/api/v1/performance/peer-review/candidates/route.ts | 90, 92 | `c.assignments[0]` | extractPrimary | 2 patch points |
| 30 | src/app/api/v1/performance/compensation/[cycleId]/export/route.ts | 66, 67 | `r.employee.assignments[0]?.department?.name` | extractPrimary | 2 patch points |
| 31 | src/app/api/v1/performance/compensation/[cycleId]/dashboard/route.ts | 106, 128 | `r.employee.assignments[0]?.department?.name` | extractPrimary | 2 patch points |
| 32 | src/app/api/v1/performance/compensation/[cycleId]/recommendations/route.ts | 84 | `review.employee.assignments[0]` | extractPrimary | |
| 33 | src/app/api/v1/performance/compensation/[cycleId]/apply/route.ts | 101 | `review.employee.assignments[0]?.jobGradeId` | extractPrimary | |
| 34 | src/app/api/v1/performance/calibration/[sessionId]/distribution/route.ts | 146 | `review.employee?.assignments[0]?.department` | extractPrimary | |
| 35 | src/app/api/v1/performance/cycles/[id]/overdue/[step]/route.ts | 105 | `r.employee.assignments[0]?.department` | extractPrimary | |
| 36 | src/app/api/v1/performance/cycles/[id]/participants/route.ts | 123, 124 | `emp.assignments[0]?.department` | extractPrimary | 2 patch points |
| 37 | src/app/api/v1/performance/evaluations/[id]/ai-draft/route.ts | 81 | `emp.assignments?.[0]` | extractPrimary | |

### Payroll Lib

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 38 | src/lib/payroll/yearEndReceiptPdf.ts | 60 | `employee.assignments?.[0]` | extractPrimary | |
| 39 | src/lib/payroll/anomaly-detector.ts | 162 | `employee.assignments?.[0]` | extractPrimary | |
| 40 | src/lib/payroll/severance.ts | 28 | `employee.assignments?.[0]?.companyId` | extractPrimary | |

### Event Handlers (Batch 1 — depends on performance module)

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 41 | src/lib/events/handlers/mbo-goal-submitted.handler.ts | 65 | `employee.assignments[0]?.positionId` | extractPrimary | |
| 42 | src/lib/events/handlers/self-eval-submitted.handler.ts | 60 | `employee.assignments[0]?.positionId` | extractPrimary | |

---

## Batch 2 — Secondary Modules (73 files, 79 patch points)

### Frontend Pages/Components

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 1 | src/app/(dashboard)/employees/[id]/page.tsx | 77 | `rawEmployee.assignments[0]` | extractPrimary | Server component |
| 2 | src/app/(dashboard)/my/profile/MyProfileClient.tsx | 207, 525 | `employee.assignments[0]` | extractPrimary | 2 points |
| 3 | src/app/(dashboard)/my/MySpaceClient.tsx | 65 | `employee.assignments[0]` | extractPrimary | |
| 4 | src/app/(dashboard)/payroll/[runId]/review/PayrollReviewClient.tsx | 171, 172 | `anomaly.employee.assignments?.[0]` | extractPrimary | 2 points |
| 5 | src/app/(dashboard)/my/skills/page.tsx | 37 | `employee?.assignments?.[0]?.jobGrade?.code` | extractPrimary | Server |

### Analytics APIs

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 6 | src/app/api/v1/analytics/burnout/route.ts | 53 | `e.assignments[0]?.department?.name` | extractPrimary | |
| 7 | src/app/api/v1/analytics/turnover-risk/route.ts | 55, 56 | `e.assignments[0]?.department?.name` | extractPrimary | 2 points |
| 8 | src/app/api/v1/analytics/employee-risk/route.ts | 44, 94-96 | `employee.assignments[0]?.company?.id` | extractPrimary | 2+ points |
| 9 | src/app/api/v1/analytics/turnover/overview/route.ts | 201 | `i.employeeOffboarding?.employee?.assignments?.[0]` | extractPrimary | Deep nested |
| 10 | src/app/api/v1/analytics/performance/overview/route.ts | 101 | `r.employee?.assignments?.[0]` | extractPrimary | |
| 11 | src/app/api/v1/analytics/gender-pay-gap/export/route.ts | 120 | `emp.assignments?.[0] as any` | extractPrimary | Remove `as any` |
| 12 | src/app/api/v1/analytics/gender-pay-gap/route.ts | 170 | `emp.assignments?.[0] as any` | extractPrimary | Remove `as any` |

### Directory / Teams / Delegation

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 13 | src/app/api/v1/directory/route.ts | 85 | `emp.assignments[0]` | extractPrimary | |
| 14 | src/app/api/v1/teams/recognition/route.ts | 64 | `sender.employee.assignments[0] as any` | extractPrimary | Remove `as any` |
| 15 | src/app/api/v1/delegation/eligible/route.ts | 69, 70 | `e.assignments[0]?.department?.name` | extractPrimary | 2 points |

### Entity Transfer / M365

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 16 | src/app/api/v1/entity-transfers/route.ts | 117 | `employee.assignments[0] as any` | extractPrimary | Remove `as any` |
| 17 | src/app/api/v1/entity-transfers/[id]/execute/route.ts | 62 | `employee.assignments[0] as any` | extractPrimary | Remove `as any` |
| 18 | src/app/api/v1/m365/disable/route.ts | 52 | `employee.assignments[0] as any` | extractPrimary | Remove `as any` |
| 19 | src/app/api/v1/m365/provision/route.ts | 47 | `employee.assignments[0] as any` | extractPrimary | Remove `as any` |

### Profile / Onboarding / Offboarding

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 20 | src/app/api/v1/profile/change-requests/[id]/review/route.ts | 98, 148, 188 | `changeRequest.employee.assignments[0]?.companyId` | extractPrimary | 3 points |
| 21 | src/app/api/v1/onboarding/plans/route.ts | 51 | `employee.assignments[0]?.companyId` | extractPrimary | |
| 22 | src/app/api/v1/onboarding/instances/[id]/route.ts | 88, 146-148 | Double-nested `assignments?.[0]` | extractPrimary | Multiple points |
| 23 | src/app/api/v1/onboarding/instances/[id]/sign-off-summary/route.ts | 55 | Double-nested `assignments?.[0]` | extractPrimary | |
| 24 | src/app/api/v1/onboarding/instances/[id]/sign-off/route.ts | 58 | Double-nested `assignments?.[0]` | extractPrimary | |
| 25 | src/app/api/v1/onboarding/instances/route.ts | 70, 71 | `inst.employee?.assignments?.[0]` | extractPrimary | 2 points |
| 26 | src/app/api/v1/onboarding/[id]/force-complete/route.ts | 39 | `onboarding.employee.assignments?.[0]?.companyId` | extractPrimary | |
| 27 | src/app/api/v1/offboarding/[id]/exit-interview/route.ts | 152 | `offboarding.employee.assignments?.[0] as any` | extractPrimary | Remove `as any` |
| 28 | src/app/api/v1/offboarding/[id]/exit-interview/ai-summary/route.ts | 66 | `offboarding.employee.assignments?.[0] as any` | extractPrimary | Remove `as any` |
| 29 | src/app/api/v1/offboarding/[id]/cancel/route.ts | 86 | `offboarding.employee.assignments?.[0]?.companyId` | extractPrimary | |
| 30 | src/app/api/v1/offboarding/instances/[id]/route.ts | 100 | `offboarding.employee?.assignments?.[0]` | extractPrimary | |
| 31 | src/app/api/v1/offboarding/instances/[id]/tasks/[taskId]/status/route.ts | 60 | `task.employeeOffboarding.employee?.assignments?.[0]?.companyId` | extractPrimary | |
| 32 | src/app/api/v1/offboarding/instances/route.ts | 76 | `ob.employee?.assignments?.[0]` | extractPrimary | |

### Search / Skills

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 33 | src/app/api/v1/search/employees/route.ts | 86 | `e.assignments?.[0]` | extractPrimary | |
| 34 | src/app/api/v1/search/command/route.ts | 73 | `e.assignments?.[0]` | extractPrimary | |
| 35 | src/app/api/v1/skills/matrix/route.ts | 86, 95, 96 | `emp.assignments?.[0]` | extractPrimary | 3 points |
| 36 | src/app/api/v1/skills/radar/route.ts | 47 | `employee?.assignments?.[0]` | extractPrimary | |
| 37 | src/app/api/v1/skills/team-assessments/route.ts | 110, 117 | `m.assignments?.[0]` | extractPrimary | 2 points |
| 38 | src/app/api/v1/skills/gap-report/route.ts | 80, 106, 111, 117 | `emp.assignments?.[0]` | extractPrimary | 4 points |
| 39 | src/app/api/v1/skills/assessments/route.ts | 77 | `employee?.assignments?.[0]` | extractPrimary | |

### Compensation / Approvals / Attrition

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 40 | src/app/api/v1/compensation/confirm/route.ts | 72 | `emp.assignments?.[0]?.jobGradeId` | extractPrimary | |
| 41 | src/app/api/v1/compensation/simulation/route.ts | 74 | `emp.assignments?.[0]` | extractPrimary | |
| 42 | src/app/api/v1/compensation/simulation/ai-recommend/route.ts | 54 | `employee.assignments?.[0]` | extractPrimary | |
| 43 | src/app/api/v1/compensation/analysis/route.ts | 76 | `emp.assignments?.[0]` | extractPrimary | |
| 44 | src/app/api/v1/approvals/inbox/route.ts | 132, 205 | `lr.employee.assignments?.[0]` | extractPrimary | 2 points |
| 45 | src/app/api/v1/attrition/employees/[id]/route.ts | 104, 174 | `employee.assignments?.[0] as any` | extractPrimary | 2 points; remove `as any` |
| 46 | src/app/api/v1/attrition/recalculate/route.ts | 51 | `employee.assignments?.[0] as any` | extractPrimary | Remove `as any` |
| 47 | src/app/api/v1/attrition/dashboard/route.ts | 120, 121 | `emp.assignments?.[0]` | extractPrimary | 2 points |
| 48 | src/app/api/v1/attrition/department-heatmap/route.ts | 70 | `emp.assignments?.[0] as any` | extractPrimary | Remove `as any` |

### Training / Year-end / CFR / Recruitment / Shift-groups

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 49 | src/app/api/v1/training/recommendations/route.ts | 48, 49 | `employee?.assignments?.[0]` | extractPrimary | 2 points |
| 50 | src/app/api/v1/year-end/hr/settlements/[id]/receipt/route.ts | 45 | `settlement.employee.assignments?.[0] as { companyId? }` | extractPrimary | Remove cast |
| 51 | src/app/api/v1/year-end/hr/settlements/[id]/confirm/route.ts | 50 | `settlement.employee.assignments?.[0] as { companyId? }` | extractPrimary | Remove cast |
| 52 | src/app/api/v1/year-end/hr/settlements/route.ts | 86 | `s.employee.assignments?.[0]` | extractPrimary | |
| 53 | src/app/api/v1/cfr/recognitions/stats/route.ts | 73, 74 | `r.sender.assignments?.[0]?.department` | extractPrimary | 2 points |
| 54 | src/app/api/v1/recruitment/interviews/[id]/calendar/available-slots/route.ts | 60 | `schedule.interviewer.assignments?.[0] as any` | extractPrimary | Remove `as any` |
| 55 | src/app/api/v1/shift-groups/[id]/members/route.ts | 70, 71 | `m.employee?.assignments?.[0]` | extractPrimary | 2 points |

### Search (non-v1 path)

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 56 | src/app/api/employees/search/route.ts | 112 | `emp.assignments?.[0]` | extractPrimary | |

### Shared Libs

| # | File | Line(s) | Current Pattern | Helper | Notes |
|---|------|---------|----------------|--------|-------|
| 57 | src/lib/workflow.ts | 106, 127, 169, 225 | Double-nested `assignments?.[0]` | extractPrimary | 4 points |
| 58 | src/lib/peer-recommend.ts | 83, 132, 170 | `assignments?.[0]?.department` | extractPrimary | 3 points |
| 59 | src/lib/offboarding/complete-offboarding.ts | 68 | `assignments?.[0]?.company?.countryCode` | extractPrimary | |
| 60 | src/lib/attrition.ts | 71, 181 | `employee.assignments?.[0]` | extractPrimary | 2 points |
| 61 | src/lib/onboarding/create-onboarding-plan.ts | 74 | Double-nested; inner `employees[0]` is Position.employees | extractPrimary | Outer only |
| 62 | src/lib/nudge/rules/onboarding-overdue.rule.ts | 209 | `onboarding.employee.assignments?.[0]?.positionId` | extractPrimary | |
| 63 | src/lib/unified-task/mappers/offboarding.mapper.ts | 126-192 | Multiple `assignments?.[0]` | extractPrimary | 5 points |
| 64 | src/lib/unified-task/mappers/payroll.mapper.ts | 71 | `approver.assignments?.[0]` | extractPrimary | |
| 65 | src/lib/unified-task/mappers/benefit.mapper.ts | 121, 137 | `emp.assignments?.[0]` | extractPrimary | 2 points |
| 66 | src/lib/unified-task/mappers/onboarding.mapper.ts | 127-191 | Multiple `assignments?.[0]` | extractPrimary | 4 points |
| 67 | src/lib/unified-task/mappers/leave.mapper.ts | 88 | `employee.assignments?.[0]` | extractPrimary | |
| 68 | src/lib/compliance/gdpr.ts | 113 | `employee.assignments?.[0]` | extractPrimary | |
| 69 | src/lib/compliance/kr.ts | 145 | `e.assignments?.[0]?.departmentId` | extractPrimary | |
| 70 | src/lib/compliance/ru.ts | 39, 100, 160, 161 | Multiple `assignments?.[0]` | extractPrimary | 4 points |
| 71 | src/lib/compliance/cn.ts | 229 | `emp.assignments?.[0]` | extractPrimary | |
| 72 | src/lib/employee-adapter.ts | 19 | `emp.assignments?.[0] ?? emp.currentAssignment` | extractPrimary | Frontend adapter |
| 73 | src/lib/employee-utils.ts | 22, 43 | **CRITICAL**: Missing `isPrimary: true` in where | extractPrimary | MUST FIX |

---

## SAFE — No Patch Needed (28 files)

| # | File | Reason |
|---|------|--------|
| 1 | src/lib/assignments.ts | Position-based lookups with `isPrimary: true, endDate: null, take: 1` |
| 2 | src/lib/auth.ts | Already uses `isPrimary: true, endDate: null` (B-1a+ patched) |
| 3 | src/lib/auth/manager-check.ts | All findFirst calls use `isPrimary: true, endDate: null` |
| 4 | src/lib/analytics/predictive/turnoverRisk.ts | Uses `isPrimary: true, endDate: null` |
| 5 | src/lib/analytics/predictive/teamHealth.ts | Uses `isPrimary: true, endDate: null` |
| 6 | src/lib/unified-task/mappers/performance.mapper.ts | Uses findFirst with `isPrimary: true` |
| 7 | src/lib/nudge/rules/performance-goal-overdue.rule.ts | Uses `isPrimary: true, endDate: null` |
| 8 | src/lib/nudge/rules/exit-interview-pending.rule.ts | Uses `isPrimary: true` |
| 9 | src/lib/nudge/rules/performance-eval-overdue.rule.ts | Uses `isPrimary: true, endDate: null` |
| 10 | src/lib/attendance/workHourAlert.ts | Uses `isPrimary: true, endDate: null` |
| 11 | src/app/api/v1/employees/[id]/history/route.ts | Intentionally fetches ALL assignments |
| 12 | src/app/api/v1/employees/[id]/snapshot/route.ts | Uses `isPrimary: true` with effectiveDate |
| 13 | src/app/api/v1/employees/bulk-upload/route.ts | Uses `isPrimary: true, endDate: null` |
| 14 | src/app/api/v1/approvals/inbox/route.ts (line 48) | Uses findFirst with `isPrimary: true` |
| 15 | All src/app/api/v1/manager-hub/** | Uses `isPrimary: true, endDate: null` |
| 16 | src/app/api/v1/sidebar/counts/route.ts | Uses `isPrimary: true, endDate: null` |
| 17 | All analytics/executive/workforce/team-stats/team-health | Uses `isPrimary: true` |
| 18 | All org/restructure-plans/** | Uses `isPrimary: true, endDate: null` |
| 19 | src/app/api/v1/pulse/surveys/[id]/respond/route.ts | Uses `isPrimary: true, endDate: null` |
| 20 | src/app/api/v1/home/summary/route.ts | Uses `isPrimary: true, endDate: null` |
| 21 | src/app/api/v1/temp-fix-positions/route.ts | Uses `isPrimary: true, endDate: null` |
| 22 | src/types/assignment.ts | Type definition only |
| 23 | src/types/process-settings.ts | Type definition only |
| 24 | src/components/shared/AssignmentTimeline.tsx | UI component, no [0] access |
| 25 | src/components/employees/tabs/AssignmentHistoryTab.tsx | Displays full history |
| 26 | src/app/(dashboard)/settings/organization/tabs/AssignmentRulesTab.tsx | Settings, no [0] |
| 27 | src/lib/schemas/shift.ts | Zod schema only |
| 28 | src/generated/prisma/** | Generated code |

---

## Frontend Shared Types

| # | File | Type/Function | Issue | Decision |
|---|------|--------------|-------|----------|
| 1 | src/lib/employee-utils.ts | `EMPLOYEE_MINIMAL_SELECT` | **CRITICAL**: Missing `isPrimary: true` in assignments where clause | MUST FIX: Add `isPrimary: true` |
| 2 | src/lib/employee-adapter.ts | `adaptEmployeeForCell()` | Uses `assignments?.[0]` | Replace with `extractPrimaryAssignment()` |
| 3 | src/types/assignment.ts | Type definitions | Correct as-is | No change needed |

---

## Summary

| Batch | Files | Patch Points |
|-------|-------|-------------|
| Batch 1 (Core) | 42 | 52 |
| Batch 2 (Secondary) | 73 | 79 |
| SAFE (skip) | 28 | 0 |
| **Total** | **87+28=115** | **131** |

### Critical Findings

1. **`employee-utils.ts` EMPLOYEE_MINIMAL_SELECT** — Only file with substantively incorrect query (missing `isPrimary: true`). All other 130 patch points already have correct filtering; refactor is for code hygiene.
2. **12 files with `as any` casts** — Should be cleaned up when applying helper.
3. **Double-nested patterns** (workflow.ts, onboarding routes) — Inner `assignments[0]` is Position.assignments, not Employee.assignments; both levels have isPrimary filter.
