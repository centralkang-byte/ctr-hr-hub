# Entity Transfer (전적) Policy — CTR Group

> Status: DRAFT — Pending 부회장 confirmation on 3 items
> Created: Track B Phase 1 Session 4
> Affects: Leave, Payroll, Employee modules

---

## Definition

Entity Transfer = permanent move from Company A to Company B.
Different from Concurrent Assignment (겸직) which is simultaneous.

## Code Implementation (Already Supported)

Transfer uses existing Append-Only pattern:
1. End current assignment: `EmployeeAssignment.endDate = transferDate`
2. Create new assignment: `isPrimary: true, effectiveDate = transferDate, companyId = newCompany`
3. Previous company's assignment becomes historical record

No new models or APIs needed — existing Assignment CRUD handles this.

## Pending Policy Decisions (부회장 확인 필요)

### 1. Leave Balance on Transfer
| Option | Description | Recommendation |
|--------|-------------|----------------|
| A) Carry Over | Transfer remaining days to new company | Recommended for domestic |
| B) Reset | Zero out + recalculate by new company policy | Common for international |
| C) Cash Out | Pay out remaining days + recalculate at new company | Hybrid approach |

**Current default (until confirmed):** Option A for domestic (KR→KR), Option B for international.
**Code impact:** Leave module needs `transferLeaveBalance()` function — can be added post-deployment.

### 2. Payroll History Continuity
| Option | Description | Recommendation |
|--------|-------------|----------------|
| A) Unified | Show all payslips across companies in one view | Recommended (employee-centric) |
| B) Separated | Only show payslips from current company | Simpler but less useful |

**Current default:** Option A — the Payroll API already queries by `employeeId`, not `companyId`.
**Code impact:** Minimal. Just ensure payroll history API doesn't filter by current assignment's company.

### 3. Tenure Calculation
| Option | Description | Recommendation |
|--------|-------------|----------------|
| A) Group Tenure | Count from first hire date across any company | Recommended (Korean labor law) |
| B) Company Tenure | Reset tenure counter at new company | Uncommon in Korean practice |

**Current default:** Option A — `Employee.hireDate` already represents first employment.
**Code impact:** If both needed:
- Add `companyHireDate` to Employee model (Phase 2 schema change)
- `groupHireDate` = existing `hireDate` (never changes)
- `companyHireDate` = latest transfer's effectiveDate

---

## Transfer Scenarios

### Domestic Transfer (KR → KR)
Example: Employee moves from CTR to CTR-MOB
- Leave: Carry over (Option A recommended)
- Payroll: Continues under Korean tax system
- Tenure: Group tenure maintained
- Process: HR Admin creates new assignment via Assignment Admin UI (B-3l)

### International Transfer (KR → Overseas)
Example: Employee moves from CTR to CTR-CN
- Leave: Reset + recalculate by Chinese policy (Option B recommended)
- Payroll: Switches to local system (HR Hub = view only for overseas)
- Tenure: Group tenure for Korean labor law purposes
- Process: Same as domestic + additional compliance steps (visa, tax residency)

### Overseas → Korea
- Leave: Reset + recalculate by Korean policy
- Payroll: Switches to HR Hub direct processing
- Tenure: Group tenure maintained

---

## Not In Scope

- Automatic transfer workflow (approval chain) — manual HR Admin action for now
- Cross-company benefit transfer — handled by Benefits team manually
- Cost center reallocation — ERP handles this
