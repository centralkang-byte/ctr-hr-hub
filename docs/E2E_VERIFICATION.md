# E2E Scenario Verification — CTR HR Hub

> **Verified:** 2026-03-12 (Q-4 P6)
> **Method:** Code path tracing (not runtime test)
> **Verifier:** AI Architecture Review

---

## Scenario 1: 채용 → 입사 → 온보딩

### Expected Flow
1. `POST /recruitment/applications/[id]/convert-to-employee` → creates Employee + EmployeeAssignment
2. Fires `EMPLOYEE_HIRED` event
3. `employee-hired.handler.ts` → calls `createOnboardingPlan()`
4. Tasks visible in `/onboarding/instances/[id]`
5. Task completion → milestone check → sign-off

### Verification

| Step | File | Status |
|------|------|:---:|
| 1. Convert API | `src/app/api/v1/recruitment/applications/[id]/convert-to-employee/route.ts` | ✅ Exists |
| 2. Event emission | Line 172-173: `eventBus.publish(DOMAIN_EVENTS.EMPLOYEE_HIRED, {...})` | ✅ Fires |
| 3. Handler | `src/lib/events/handlers/employee-hired.handler.ts` — imports `createOnboardingPlan` | ✅ Handles |
| 4. Plan creation | `src/lib/onboarding/create-onboarding-plan.ts` | ✅ Exists |
| 5. Task API | `src/app/api/v1/onboarding/instances/[id]/tasks/` | ✅ Exists |

### Gaps
- **None found.** Full chain from hire to onboarding task creation is complete.
- Recommendation: Add integration test that converts applicant and verifies onboarding plan exists.

---

## Scenario 2: 성과 사이클 (7-step pipeline)

### Expected Flow
1. `POST /performance/cycles` → create cycle (`DRAFT`)
2. Advance: `DRAFT → ACTIVE → CHECK_IN → EVAL_OPEN → CALIBRATION → FINALIZED → CLOSED → COMP_REVIEW`
3. Goal Setting: employees submit MBO goals, manager approves
4. Check-in: optional mid-cycle review
5. Evaluation: self-eval → manager-eval → peer-review
6. Calibration: HR reviews grade distribution
7. Result notification: employees see final grade

### Verification

| Step | File | Status |
|------|------|:---:|
| 1. Create cycle | `src/app/api/v1/performance/cycles/route.ts` | ✅ |
| 2. State machine | `src/lib/performance/pipeline.ts` — maps all 8 states | ✅ |
| 3. Advance API | `src/app/api/v1/performance/cycles/[id]/advance/route.ts` — 364+ lines | ✅ |
| 4. MBO goals | `src/app/api/v1/performance/goals/` — submit, review APIs | ✅ |
| 5. Self-eval | `src/app/api/v1/performance/evaluations/self/route.ts` | ✅ |
| 6. Manager eval | `src/app/api/v1/performance/evaluations/manager/route.ts` | ✅ |
| 7. Peer review | `src/app/api/v1/performance/peer-review/` | ✅ |
| 8. Calibration | `src/app/api/v1/performance/calibration/` | ✅ |
| 9. Bulk notify | `src/app/api/v1/performance/cycles/[id]/bulk-notify/route.ts` — checks `FINALIZED` | ✅ |
| 10. PERFORMANCE_CYCLE_FINALIZED event | Line 364 in advance/route.ts | ✅ |

### Gaps
- **Data masking:** No explicit data masking detected before `FINALIZED` stage. Employees could potentially see raw scores during `CALIBRATION`. Recommend adding a guard in the my-result API.
- **Compensation review:** State machine includes `COMP_REVIEW` after `CLOSED`, but no dedicated comp-review advance handler found.

---

## Scenario 3: 퇴직 처리 (Offboarding)

### Expected Flow
1. `POST /offboarding/instances` → creates offboarding with tasks
2. Fires `EMPLOYEE_OFFBOARDING_STARTED` event
3. Handler: cancels active onboarding, notifies stakeholders
4. Task completion → asset return → exit interview
5. Complete offboarding → employee status change

### Verification

| Step | File | Status |
|------|------|:---:|
| 1. Create offboarding | `src/app/api/v1/offboarding/instances/route.ts` | ✅ |
| 2. Event emission | `EMPLOYEE_OFFBOARDING_STARTED` published | ✅ |
| 3. Handler | `src/lib/events/handlers/offboarding-started.handler.ts` — cancels onboarding, notifies | ✅ |
| 4. Task API | `src/app/api/v1/offboarding/checklists/[id]/tasks/` | ✅ |
| 5. Exit interview | `src/app/api/v1/offboarding/[id]/exit-interview/` | ✅ |
| 6. Complete offboarding | `src/lib/offboarding/complete-offboarding.ts` + `src/lib/offboarding-complete.ts` | ✅ |

### Gaps
- **Duplicate files:** Both `src/lib/offboarding-complete.ts` and `src/lib/offboarding/complete-offboarding.ts` exist. Potential dead code — verify which is actually imported.
- **Assignment status change:** Verify `complete-offboarding` actually sets `EmployeeAssignment.status = 'TERMINATED'`.

---

## Scenario 4: 급여 파이프라인 (6-step)

### Expected Flow
1. Attendance close → fires `PAYROLL_ATTENDANCE_CLOSED`
2. Auto-calculate → fires `PAYROLL_CALCULATED`
3. Anomaly detection → fires `PAYROLL_REVIEW_READY`
4. HR review + adjustments
5. Approval (multi-step for KR) → fires `PAYROLL_APPROVED`
6. Payslip generation → employee notification

### Verification

| Step | File | Status |
|------|------|:---:|
| 1. Attendance close | `src/app/api/v1/payroll/attendance-close/route.ts` | ✅ |
| 2. PAYROLL_ATTENDANCE_CLOSED handler | `src/lib/events/handlers/payroll-attendance-closed.handler.ts` — triggers calculation | ✅ |
| 3. PAYROLL_CALCULATED handler | `src/lib/events/handlers/payroll-calculated.handler.ts` — runs anomaly detection | ✅ |
| 4. PAYROLL_REVIEW_READY handler | `src/lib/events/handlers/payroll-review-ready.handler.ts` — notifies HR | ✅ |
| 5. Approval API | `src/app/api/v1/payroll/[runId]/approve/` | ✅ |
| 6. PAYROLL_APPROVED handler | `src/lib/events/handlers/payroll-approved.handler.ts` — generates payslips | ✅ |
| 7. Payslip API | `src/app/api/v1/payroll/me/[runId]/` | ✅ |
| 8. KR tax calc | `src/lib/payroll/kr-tax.ts` (PROTECTED) | ✅ |

### Gaps
- **None found.** Full 6-step pipeline with event-driven automation is complete.
- Each step fires the next event, creating a chain: `ATTENDANCE_CLOSED → CALCULATED → REVIEW_READY → (manual review) → APPROVED → payslips`.

---

## Scenario 5: 법인 간 전입 (Crossboarding / Entity Transfer)

### Expected Flow
1. Transfer request → creates EntityTransfer record
2. Multi-step approval: `TRANSFER_REQUESTED → FROM_APPROVED → TO_APPROVED → EXEC_APPROVED`
3. Execute: creates new EmployeeAssignment (target company), ends old assignment
4. CROSSBOARDING template applied (departure + arrival tasks)
5. Departure offboarding at source, arrival onboarding at target

### Verification

| Step | File | Status |
|------|------|:---:|
| 1. Create transfer | `src/app/api/v1/entity-transfers/route.ts` | ✅ |
| 2. Approval flow | `src/app/api/v1/entity-transfers/[id]/approve/route.ts` | ✅ |
| 3. Execute transfer | `src/app/api/v1/entity-transfers/[id]/execute/route.ts` | ✅ |
| 4. Schema | `src/lib/schemas/entity-transfer.ts` — 6 statuses defined | ✅ |
| 5. Data logging | Entity transfer data log for audit trail | ✅ |

### Gaps
- **CROSSBOARDING template:** No dedicated crossboarding onboarding template auto-application found. The execute API creates the new assignment but does NOT automatically trigger departure/arrival onboarding.
- **Recommendation:** Add event emission (`ENTITY_TRANSFER_COMPLETED`) in execute route that triggers:
  - Source company: offboarding tasks (asset return, access revocation)
  - Target company: onboarding tasks (new badge, new team intro)

---

## Summary

| Scenario | Chain Complete | Gaps |
|----------|:---:|------|
| 1. 채용→온보딩 | ✅ | None |
| 2. 성과 7-step | ⚠️ | Data masking before FINALIZED, COMP_REVIEW handler |
| 3. 퇴직 처리 | ⚠️ | Duplicate offboarding-complete files |
| 4. 급여 파이프라인 | ✅ | None |
| 5. 법인간 전입 | ⚠️ | Missing auto-crossboarding template (departure+arrival) |

### Priority Fixes
1. **P0:** Scenario 2 — Add data masking guard in my-result API for pre-FINALIZED access
2. **P1:** Scenario 5 — Add `ENTITY_TRANSFER_COMPLETED` event + crossboarding template automation
3. **P2:** Scenario 3 — Deduplicate offboarding-complete files, verify which is active
