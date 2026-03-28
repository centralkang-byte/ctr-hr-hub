---
paths: ["src/**/*assignment*", "src/**/*Assignment*", "src/**/payroll/**", "src/**/leave/**", "src/**/approvals/**"]
---

# Assignment Rules (Track B)

- Primary lookup: NEVER access `assignments[0]` directly — always use helpers:
  - DB query: `fetchPrimaryAssignment(employeeId)`
  - In-memory filter: `extractPrimaryAssignment(assignments)`
- Append-Only: To modify assignments, set `endDate` on existing row → create new row. NEVER UPDATE in-place
- isPrimary filter required: Payroll, Leave, Approvals MUST include `isPrimary: true` condition
- Concurrent positions: Leave/Approvals processed under Primary Assignment's company only
- Payroll scope: Domestic 7 entities = HR Hub direct processing. Overseas 6 = local system + data sync only
- employmentType mapping: ATS lowercase → Employee uppercase via `mapRequisitionTypeToEmploymentType()`
