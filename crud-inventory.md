# CTR HR Hub — CRUD Inventory
Generated: 2026-03-18 00:32

## 1. API Routes
| Route | GET | POST | PUT | PATCH | DELETE | Module |
|-------|-----|------|-----|-------|--------|--------|
| `api/auth/[...nextauth]` | ✅ | ✅ | - | - | - | api |
| `api/employees/search` | ✅ | - | - | - | - | api |
| `api/v1/ai/calibration-analysis` | - | ✅ | - | - | - | ai |
| `api/v1/ai/eval-comment` | - | ✅ | - | - | - | ai |
| `api/v1/ai/executive-report` | - | ✅ | - | - | - | ai |
| `api/v1/ai/job-description` | - | ✅ | - | - | - | ai |
| `api/v1/ai/onboarding-checkin-summary` | - | ✅ | - | - | - | ai |
| `api/v1/ai/one-on-one-notes` | - | ✅ | - | - | - | ai |
| `api/v1/ai/payroll-anomaly` | - | ✅ | - | - | - | ai |
| `api/v1/ai/peer-review-summary` | - | ✅ | - | - | - | ai |
| `api/v1/ai/pulse-analysis` | - | ✅ | - | - | - | ai |
| `api/v1/ai/resume-analysis` | - | ✅ | - | - | - | ai |
| `api/v1/analytics/ai-report/generate` | - | ✅ | - | - | - | analytics |
| `api/v1/analytics/ai-report` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/attendance/overview` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/attendance` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/burnout` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/calculate` | - | ✅ | - | - | - | analytics |
| `api/v1/analytics/compensation` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/employee-risk` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/executive/summary` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/gender-pay-gap/export` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/gender-pay-gap` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/overview` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/payroll/overview` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/performance/overview` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/performance` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/prediction/burnout` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/prediction/turnover` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/recruitment` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/refresh` | - | ✅ | - | - | - | analytics |
| `api/v1/analytics/team-health-scores` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/team-health/overview` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/team-health` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/turnover-risk` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/turnover/overview` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/turnover` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/workforce/overview` | ✅ | - | - | - | - | analytics |
| `api/v1/analytics/workforce` | ✅ | - | - | - | - | analytics |
| `api/v1/approvals/attendance/[id]` | ✅ | - | ✅ | - | - | approvals |
| `api/v1/approvals/attendance/bulk` | - | ✅ | - | - | - | approvals |
| `api/v1/approvals/attendance` | ✅ | ✅ | - | - | - | approvals |
| `api/v1/approvals/inbox` | ✅ | - | - | - | - | approvals |
| `api/v1/attendance/[id]` | ✅ | - | ✅ | - | - | attendance |
| `api/v1/attendance/admin` | ✅ | - | - | - | - | attendance |
| `api/v1/attendance/clock-in` | - | ✅ | - | - | - | attendance |
| `api/v1/attendance/clock-out` | - | ✅ | - | - | - | attendance |
| `api/v1/attendance/employees/[id]` | ✅ | - | - | - | - | attendance |
| `api/v1/attendance/monthly/[year]/[month]` | ✅ | - | - | - | - | attendance |
| `api/v1/attendance/shifts` | ✅ | ✅ | - | - | - | attendance |
| `api/v1/attendance/team` | ✅ | - | - | - | - | attendance |
| `api/v1/attendance/today` | ✅ | - | - | - | - | attendance |
| `api/v1/attendance/weekly-summary` | ✅ | - | - | - | - | attendance |
| `api/v1/attendance/work-hour-alerts/[id]` | - | - | - | ✅ | - | attendance |
| `api/v1/attendance/work-hour-alerts` | ✅ | - | - | - | - | attendance |
| `api/v1/attrition/dashboard` | ✅ | - | - | - | - | attrition |
| `api/v1/attrition/department-heatmap` | ✅ | - | - | - | - | attrition |
| `api/v1/attrition/employees/[id]` | ✅ | - | - | - | - | attrition |
| `api/v1/attrition/recalculate` | - | ✅ | - | - | - | attrition |
| `api/v1/attrition/trend` | ✅ | - | - | - | - | attrition |
| `api/v1/audit/logs/export` | ✅ | - | - | - | - | audit |
| `api/v1/audit/logs` | ✅ | - | - | - | - | audit |
| `api/v1/audit/logs/stats` | ✅ | - | - | - | - | audit |
| `api/v1/audit/retention-policy` | ✅ | - | ✅ | - | - | audit |
| `api/v1/bank-transfers/[id]/generate` | - | ✅ | - | - | - | bank-transfers |
| `api/v1/bank-transfers/[id]/result` | - | - | ✅ | - | - | bank-transfers |
| `api/v1/bank-transfers/[id]` | ✅ | - | - | - | - | bank-transfers |
| `api/v1/bank-transfers` | ✅ | ✅ | - | - | - | bank-transfers |
| `api/v1/benefit-budgets` | ✅ | - | ✅ | - | - | benefit-budgets |
| `api/v1/benefit-claims/[id]` | ✅ | - | - | ✅ | - | benefit-claims |
| `api/v1/benefit-claims` | ✅ | ✅ | - | - | - | benefit-claims |
| `api/v1/benefit-claims/summary` | ✅ | - | - | - | - | benefit-claims |
| `api/v1/benefit-plans` | ✅ | - | - | - | - | benefit-plans |
| `api/v1/benefits/enrollments/[id]` | - | - | ✅ | - | - | benefits |
| `api/v1/benefits/enrollments` | ✅ | ✅ | - | - | - | benefits |
| `api/v1/benefits/policies/[id]` | ✅ | - | ✅ | - | ✅ | benefits |
| `api/v1/benefits/policies` | ✅ | ✅ | - | - | - | benefits |
| `api/v1/cfr/one-on-ones/[id]` | ✅ | - | ✅ | - | - | cfr |
| `api/v1/cfr/one-on-ones/dashboard` | ✅ | - | - | - | - | cfr |
| `api/v1/cfr/one-on-ones` | ✅ | ✅ | - | - | - | cfr |
| `api/v1/cfr/recognitions/[id]/like` | - | ✅ | - | - | - | cfr |
| `api/v1/cfr/recognitions/employee/[id]` | ✅ | - | - | - | - | cfr |
| `api/v1/cfr/recognitions` | ✅ | ✅ | - | - | - | cfr |
| `api/v1/cfr/recognitions/stats` | ✅ | - | - | - | - | cfr |
| `api/v1/companies` | ✅ | - | - | - | - | companies |
| `api/v1/compensation/analysis` | ✅ | - | - | - | - | compensation |
| `api/v1/compensation/confirm` | - | ✅ | - | - | - | compensation |
| `api/v1/compensation/history` | ✅ | - | - | - | - | compensation |
| `api/v1/compensation/matrix/copy` | - | ✅ | - | - | - | compensation |
| `api/v1/compensation/matrix` | ✅ | ✅ | - | - | - | compensation |
| `api/v1/compensation/salary-bands/[id]` | ✅ | - | ✅ | - | ✅ | compensation |
| `api/v1/compensation/salary-bands` | ✅ | ✅ | - | - | - | compensation |
| `api/v1/compensation/simulation/ai-recommend` | - | ✅ | - | - | - | compensation |
| `api/v1/compensation/simulation` | ✅ | - | - | - | - | compensation |
| `api/v1/competencies/[id]/indicators` | ✅ | - | ✅ | - | - | competencies |
| `api/v1/competencies/[id]/levels` | ✅ | - | ✅ | - | - | competencies |
| `api/v1/competencies/[id]` | ✅ | - | ✅ | - | ✅ | competencies |
| `api/v1/competencies` | ✅ | ✅ | - | - | - | competencies |
| `api/v1/compliance/cn/employee-registry/export` | ✅ | - | - | - | - | compliance |
| `api/v1/compliance/cn/social-insurance/calculate` | - | ✅ | - | - | - | compliance |
| `api/v1/compliance/cn/social-insurance/config/[id]` | - | - | ✅ | - | - | compliance |
| `api/v1/compliance/cn/social-insurance/config` | ✅ | ✅ | - | - | - | compliance |
| `api/v1/compliance/cn/social-insurance/export` | ✅ | - | - | - | - | compliance |
| `api/v1/compliance/cn/social-insurance/records` | ✅ | - | - | - | - | compliance |
| `api/v1/compliance/cron/retention` | ✅ | - | - | - | - | compliance |
| `api/v1/compliance/gdpr/consents/[id]/revoke` | - | ✅ | - | - | - | compliance |
| `api/v1/compliance/gdpr/consents` | ✅ | ✅ | - | - | - | compliance |
| `api/v1/compliance/gdpr/dpia/[id]` | ✅ | - | ✅ | - | - | compliance |
| `api/v1/compliance/gdpr/dpia` | ✅ | ✅ | - | - | - | compliance |
| `api/v1/compliance/gdpr/pii-access/dashboard` | ✅ | - | - | - | - | compliance |
| `api/v1/compliance/gdpr/pii-access` | ✅ | - | - | - | - | compliance |
| `api/v1/compliance/gdpr/requests/[id]` | ✅ | - | ✅ | - | - | compliance |
| `api/v1/compliance/gdpr/requests` | ✅ | ✅ | - | - | - | compliance |
| `api/v1/compliance/gdpr/retention/[id]` | - | - | ✅ | - | - | compliance |
| `api/v1/compliance/gdpr/retention` | ✅ | ✅ | - | - | - | compliance |
| `api/v1/compliance/gdpr/retention/run` | - | ✅ | - | - | - | compliance |
| `api/v1/compliance/kr/mandatory-training/[id]` | - | - | ✅ | - | - | compliance |
| `api/v1/compliance/kr/mandatory-training` | ✅ | ✅ | - | - | - | compliance |
| `api/v1/compliance/kr/mandatory-training/status` | ✅ | - | - | - | - | compliance |
| `api/v1/compliance/kr/severance-interim/[id]` | ✅ | - | ✅ | - | - | compliance |
| `api/v1/compliance/kr/severance-interim/calculate` | ✅ | - | - | - | - | compliance |
| `api/v1/compliance/kr/severance-interim` | ✅ | ✅ | - | - | - | compliance |
| `api/v1/compliance/kr/work-hours/alerts` | ✅ | - | - | - | - | compliance |
| `api/v1/compliance/kr/work-hours/employees` | ✅ | - | - | - | - | compliance |
| `api/v1/compliance/kr/work-hours` | ✅ | - | - | - | - | compliance |
| `api/v1/compliance/ru/kedo/[id]/reject` | - | ✅ | - | - | - | compliance |
| `api/v1/compliance/ru/kedo/[id]` | ✅ | - | ✅ | - | - | compliance |
| `api/v1/compliance/ru/kedo/[id]/sign` | - | ✅ | - | - | - | compliance |
| `api/v1/compliance/ru/kedo` | ✅ | ✅ | - | - | - | compliance |
| `api/v1/compliance/ru/military/[employeeId]` | ✅ | - | ✅ | - | - | compliance |
| `api/v1/compliance/ru/military/export/t2` | ✅ | - | - | - | - | compliance |
| `api/v1/compliance/ru/military` | ✅ | ✅ | - | - | - | compliance |
| `api/v1/compliance/ru/reports/57t` | ✅ | - | - | - | - | compliance |
| `api/v1/compliance/ru/reports/p4` | ✅ | - | - | - | - | compliance |
| `api/v1/contracts/expiring` | ✅ | - | - | - | - | contracts |
| `api/v1/cron/auto-acknowledge` | ✅ | - | - | - | - | cron |
| `api/v1/cron/eval-reminder` | - | ✅ | - | - | - | cron |
| `api/v1/cron/leave-promotion` | - | ✅ | - | - | - | cron |
| `api/v1/cron/org-snapshot` | - | ✅ | - | - | - | cron |
| `api/v1/cron/overdue-check` | ✅ | - | - | - | - | cron |
| `api/v1/dashboard/compare` | ✅ | - | - | - | - | dashboard |
| `api/v1/dashboard/summary` | ✅ | - | - | - | - | dashboard |
| `api/v1/dashboard/widgets/[widgetId]` | ✅ | - | - | - | - | dashboard |
| `api/v1/delegation/[id]/revoke` | - | - | ✅ | - | - | delegation |
| `api/v1/delegation/eligible` | ✅ | - | - | - | - | delegation |
| `api/v1/delegation` | ✅ | ✅ | - | - | - | delegation |
| `api/v1/departments/hierarchy` | ✅ | - | - | - | - | departments |
| `api/v1/directory` | ✅ | - | - | - | - | directory |
| `api/v1/disciplinary/[id]/appeal` | - | - | ✅ | - | - | disciplinary |
| `api/v1/disciplinary/[id]` | ✅ | - | ✅ | - | - | disciplinary |
| `api/v1/disciplinary` | ✅ | ✅ | - | - | - | disciplinary |
| `api/v1/employees/[id]/compensation` | ✅ | - | - | - | - | employees |
| `api/v1/employees/[id]/contracts/[contractId]` | ✅ | - | ✅ | - | - | employees |
| `api/v1/employees/[id]/contracts` | ✅ | ✅ | - | - | - | employees |
| `api/v1/employees/[id]/documents/[docId]/download` | ✅ | - | - | - | - | employees |
| `api/v1/employees/[id]/documents` | ✅ | ✅ | - | - | - | employees |
| `api/v1/employees/[id]/histories` | ✅ | - | - | - | - | employees |
| `api/v1/employees/[id]/history` | ✅ | - | - | - | - | employees |
| `api/v1/employees/[id]/insights` | ✅ | - | - | - | - | employees |
| `api/v1/employees/[id]/offboarding` | ✅ | - | - | - | - | employees |
| `api/v1/employees/[id]/offboarding/start` | - | ✅ | - | - | - | employees |
| `api/v1/employees/[id]` | ✅ | - | ✅ | - | ✅ | employees |
| `api/v1/employees/[id]/schedules` | ✅ | ✅ | - | - | - | employees |
| `api/v1/employees/[id]/snapshot` | ✅ | - | - | - | - | employees |
| `api/v1/employees/[id]/transfer` | - | ✅ | - | - | - | employees |
| `api/v1/employees/[id]/work-permits` | ✅ | ✅ | - | - | - | employees |
| `api/v1/employees/bulk-upload` | - | ✅ | - | - | - | employees |
| `api/v1/employees/export` | ✅ | - | - | - | - | employees |
| `api/v1/employees/me/avatar` | - | ✅ | - | - | - | employees |
| `api/v1/employees/me/emergency-contacts/[id]` | - | - | - | - | ✅ | employees |
| `api/v1/employees/me/emergency-contacts` | ✅ | ✅ | - | - | - | employees |
| `api/v1/employees/me/profile-extension` | ✅ | - | ✅ | - | - | employees |
| `api/v1/employees/me/visibility` | ✅ | - | ✅ | - | - | employees |
| `api/v1/employees` | ✅ | ✅ | - | - | - | employees |
| `api/v1/entity-transfers/[id]/approve` | - | - | ✅ | - | - | entity-transfers |
| `api/v1/entity-transfers/[id]/execute` | - | - | ✅ | - | - | entity-transfers |
| `api/v1/entity-transfers/[id]` | ✅ | - | - | - | - | entity-transfers |
| `api/v1/entity-transfers` | ✅ | ✅ | - | - | - | entity-transfers |
| `api/v1/files/presigned` | - | ✅ | - | - | - | files |
| `api/v1/holidays/[id]` | ✅ | - | ✅ | - | ✅ | holidays |
| `api/v1/holidays` | ✅ | ✅ | - | - | - | holidays |
| `api/v1/home/pending-actions` | ✅ | - | - | - | - | home |
| `api/v1/home/summary` | ✅ | - | - | - | - | home |
| `api/v1/hr-chat/messages/[id]/escalate` | - | ✅ | - | - | - | hr-chat |
| `api/v1/hr-chat/messages/[id]/feedback` | - | - | ✅ | - | - | hr-chat |
| `api/v1/hr-chat/sessions/[id]/messages` | ✅ | ✅ | - | - | - | hr-chat |
| `api/v1/hr-chat/sessions` | ✅ | ✅ | - | - | - | hr-chat |
| `api/v1/hr-documents/[id]` | - | - | ✅ | - | ✅ | hr-documents |
| `api/v1/hr-documents` | ✅ | ✅ | - | - | - | hr-documents |
| `api/v1/leave/accrual` | - | ✅ | - | - | - | leave |
| `api/v1/leave/admin` | ✅ | - | - | - | - | leave |
| `api/v1/leave/admin/stats` | ✅ | - | - | - | - | leave |
| `api/v1/leave/balances/[employeeId]` | ✅ | - | - | - | - | leave |
| `api/v1/leave/balances` | ✅ | - | - | - | - | leave |
| `api/v1/leave/bulk-grant` | - | ✅ | - | - | - | leave |
| `api/v1/leave/policies/[id]` | ✅ | - | ✅ | - | ✅ | leave |
| `api/v1/leave/policies` | ✅ | ✅ | - | - | - | leave |
| `api/v1/leave/requests/[id]/approve` | - | - | ✅ | - | - | leave |
| `api/v1/leave/requests/[id]/cancel` | - | - | ✅ | - | - | leave |
| `api/v1/leave/requests/[id]/reject` | - | - | ✅ | - | - | leave |
| `api/v1/leave/requests/[id]` | ✅ | - | - | - | - | leave |
| `api/v1/leave/requests` | ✅ | ✅ | - | - | - | leave |
| `api/v1/leave/team` | ✅ | - | - | - | - | leave |
| `api/v1/leave/type-defs/[id]/accrual-rules` | ✅ | - | ✅ | - | - | leave |
| `api/v1/leave/type-defs/[id]` | ✅ | - | ✅ | - | ✅ | leave |
| `api/v1/leave/type-defs` | ✅ | ✅ | - | - | - | leave |
| `api/v1/leave/year-balances` | ✅ | - | - | - | - | leave |
| `api/v1/locale` | - | ✅ | - | - | - | locale |
| `api/v1/m365/disable` | - | ✅ | - | - | - | m365 |
| `api/v1/m365/logs` | ✅ | - | - | - | - | m365 |
| `api/v1/m365/provision` | - | ✅ | - | - | - | m365 |
| `api/v1/m365/status` | ✅ | - | - | - | - | m365 |
| `api/v1/manager-hub/alerts` | ✅ | - | - | - | - | manager-hub |
| `api/v1/manager-hub/pending-approvals` | ✅ | - | - | - | - | manager-hub |
| `api/v1/manager-hub/performance` | ✅ | - | - | - | - | manager-hub |
| `api/v1/manager-hub/summary` | ✅ | - | - | - | - | manager-hub |
| `api/v1/manager-hub/team-health` | ✅ | - | - | - | - | manager-hub |
| `api/v1/migration/jobs/[id]/execute` | - | ✅ | - | - | - | migration |
| `api/v1/migration/jobs/[id]` | ✅ | - | - | - | ✅ | migration |
| `api/v1/migration/jobs/[id]/validate` | - | ✅ | - | - | - | migration |
| `api/v1/migration/jobs` | ✅ | ✅ | - | - | - | migration |
| `api/v1/migration/templates` | ✅ | - | - | - | - | migration |
| `api/v1/monitoring/health` | ✅ | - | - | - | - | monitoring |
| `api/v1/monitoring/metrics` | ✅ | - | - | - | - | monitoring |
| `api/v1/notifications/[id]/read` | - | - | ✅ | - | - | notifications |
| `api/v1/notifications/preferences` | ✅ | - | ✅ | - | - | notifications |
| `api/v1/notifications/read-all` | - | - | ✅ | - | - | notifications |
| `api/v1/notifications` | ✅ | - | - | - | - | notifications |
| `api/v1/notifications/unread-count` | ✅ | - | - | - | - | notifications |
| `api/v1/offboarding/[id]/cancel` | - | - | ✅ | - | - | offboarding |
| `api/v1/offboarding/[id]/exit-interview/ai-summary` | - | ✅ | - | - | - | offboarding |
| `api/v1/offboarding/[id]/exit-interview` | ✅ | ✅ | - | - | - | offboarding |
| `api/v1/offboarding/[id]/tasks/[taskId]/complete` | - | - | ✅ | - | - | offboarding |
| `api/v1/offboarding/checklists/[id]` | ✅ | - | ✅ | - | ✅ | offboarding |
| `api/v1/offboarding/checklists/[id]/tasks` | ✅ | ✅ | - | - | - | offboarding |
| `api/v1/offboarding/checklists` | ✅ | ✅ | - | - | - | offboarding |
| `api/v1/offboarding/dashboard` | ✅ | - | - | - | - | offboarding |
| `api/v1/offboarding/exit-interviews/statistics` | ✅ | - | - | - | - | offboarding |
| `api/v1/offboarding/instances/[id]/reschedule` | - | - | ✅ | - | - | offboarding |
| `api/v1/offboarding/instances/[id]` | ✅ | - | - | - | - | offboarding |
| `api/v1/offboarding/instances/[id]/tasks/[taskId]/status` | - | - | ✅ | - | - | offboarding |
| `api/v1/offboarding/instances` | ✅ | - | - | - | - | offboarding |
| `api/v1/offboarding/me` | ✅ | - | - | - | - | offboarding |
| `api/v1/onboarding/[id]/force-complete` | - | - | ✅ | - | - | onboarding |
| `api/v1/onboarding/checkin` | - | ✅ | - | - | - | onboarding |
| `api/v1/onboarding/checkins/[employeeId]` | ✅ | - | - | - | - | onboarding |
| `api/v1/onboarding/checkins` | ✅ | - | - | - | - | onboarding |
| `api/v1/onboarding/crossboarding` | - | ✅ | - | - | - | onboarding |
| `api/v1/onboarding/dashboard` | ✅ | - | - | - | - | onboarding |
| `api/v1/onboarding/instances/[id]` | ✅ | - | - | - | - | onboarding |
| `api/v1/onboarding/instances/[id]/sign-off-summary` | ✅ | - | - | - | - | onboarding |
| `api/v1/onboarding/instances/[id]/sign-off` | - | ✅ | - | - | - | onboarding |
| `api/v1/onboarding/instances/[id]/tasks/[taskId]/block` | - | ✅ | - | - | - | onboarding |
| `api/v1/onboarding/instances/[id]/tasks/[taskId]/status` | - | - | ✅ | - | - | onboarding |
| `api/v1/onboarding/instances/[id]/tasks/[taskId]/unblock` | - | ✅ | - | - | - | onboarding |
| `api/v1/onboarding/instances` | ✅ | - | - | - | - | onboarding |
| `api/v1/onboarding/me` | ✅ | - | - | - | - | onboarding |
| `api/v1/onboarding/tasks/[id]/complete` | - | - | ✅ | - | - | onboarding |
| `api/v1/onboarding/templates/[id]` | ✅ | - | ✅ | - | ✅ | onboarding |
| `api/v1/onboarding/templates/[id]/tasks/reorder` | - | - | ✅ | - | - | onboarding |
| `api/v1/onboarding/templates/[id]/tasks` | ✅ | ✅ | - | - | - | onboarding |
| `api/v1/onboarding/templates` | ✅ | ✅ | - | - | - | onboarding |
| `api/v1/org/change-history` | ✅ | - | - | - | - | org |
| `api/v1/org/companies` | ✅ | - | - | - | - | org |
| `api/v1/org/departments/[id]` | - | - | ✅ | - | - | org |
| `api/v1/org/departments` | ✅ | ✅ | - | - | - | org |
| `api/v1/org/restructure-plans/[id]/apply` | - | ✅ | - | - | - | org |
| `api/v1/org/restructure-plans/[id]` | ✅ | - | - | ✅ | ✅ | org |
| `api/v1/org/restructure-plans` | ✅ | ✅ | - | - | - | org |
| `api/v1/org/restructure` | - | ✅ | - | - | - | org |
| `api/v1/org/snapshots` | ✅ | ✅ | - | - | - | org |
| `api/v1/org/tree` | ✅ | - | - | - | - | org |
| `api/v1/payroll/[runId]/adjustments/[adjustmentId]` | - | - | - | - | ✅ | payroll |
| `api/v1/payroll/[runId]/adjustments/complete` | - | ✅ | - | - | - | payroll |
| `api/v1/payroll/[runId]/adjustments` | ✅ | ✅ | - | - | - | payroll |
| `api/v1/payroll/[runId]/anomalies/[anomalyId]/resolve` | - | - | ✅ | - | - | payroll |
| `api/v1/payroll/[runId]/anomalies/bulk-resolve` | - | ✅ | - | - | - | payroll |
| `api/v1/payroll/[runId]/anomalies` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/[runId]/approval-status` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/[runId]/approve` | - | ✅ | - | - | - | payroll |
| `api/v1/payroll/[runId]/comparison` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/[runId]/export/comparison` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/[runId]/export/journal` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/[runId]/export/ledger` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/[runId]/export/transfer` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/[runId]/notify-unread` | - | ✅ | - | - | - | payroll |
| `api/v1/payroll/[runId]/publish-status` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/[runId]/reject` | - | ✅ | - | - | - | payroll |
| `api/v1/payroll/[runId]/submit-for-approval` | - | ✅ | - | - | - | payroll |
| `api/v1/payroll/allowance-types/[id]` | ✅ | - | ✅ | - | ✅ | payroll |
| `api/v1/payroll/allowance-types` | ✅ | ✅ | - | - | - | payroll |
| `api/v1/payroll/anomalies` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/attendance-close` | - | ✅ | - | - | - | payroll |
| `api/v1/payroll/attendance-reopen` | - | ✅ | - | - | - | payroll |
| `api/v1/payroll/attendance-status` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/calculate` | - | ✅ | - | - | - | payroll |
| `api/v1/payroll/dashboard` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/deduction-types/[id]` | ✅ | - | ✅ | - | ✅ | payroll |
| `api/v1/payroll/deduction-types` | ✅ | ✅ | - | - | - | payroll |
| `api/v1/payroll/employees/[id]/pay-items/[itemId]` | - | - | ✅ | - | ✅ | payroll |
| `api/v1/payroll/employees/[id]/pay-items` | ✅ | ✅ | - | - | - | payroll |
| `api/v1/payroll/exchange-rates/copy-prev` | - | ✅ | - | - | - | payroll |
| `api/v1/payroll/exchange-rates` | ✅ | - | ✅ | - | - | payroll |
| `api/v1/payroll/global` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/import-logs` | ✅ | ✅ | - | - | - | payroll |
| `api/v1/payroll/import-mappings` | ✅ | ✅ | - | - | - | payroll |
| `api/v1/payroll/me/[runId]/pdf` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/me` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/payslips/[id]` | ✅ | - | - | ✅ | - | payroll |
| `api/v1/payroll/payslips` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/runs/[id]/approve` | - | - | ✅ | - | - | payroll |
| `api/v1/payroll/runs/[id]/calculate` | - | ✅ | - | - | - | payroll |
| `api/v1/payroll/runs/[id]/items/[itemId]` | - | - | ✅ | - | - | payroll |
| `api/v1/payroll/runs/[id]/paid` | - | - | ✅ | - | - | payroll |
| `api/v1/payroll/runs/[id]/review` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/runs/[id]` | ✅ | - | - | - | - | payroll |
| `api/v1/payroll/runs` | ✅ | ✅ | - | - | - | payroll |
| `api/v1/payroll/severance/[employeeId]` | - | ✅ | - | - | - | payroll |
| `api/v1/payroll/simulation/export` | - | ✅ | - | - | - | payroll |
| `api/v1/payroll/simulation` | ✅ | ✅ | - | - | - | payroll |
| `api/v1/payroll/whitelist/[anomalyId]` | - | - | - | - | ✅ | payroll |
| `api/v1/payroll/whitelist` | ✅ | - | - | - | - | payroll |
| `api/v1/peer-review/my-reviews/[nominationId]` | - | ✅ | - | - | - | peer-review |
| `api/v1/peer-review/my-reviews` | ✅ | - | - | - | - | peer-review |
| `api/v1/peer-review/nominations/[id]` | - | - | ✅ | - | - | peer-review |
| `api/v1/peer-review/nominations` | ✅ | ✅ | - | - | - | peer-review |
| `api/v1/peer-review/recommend` | ✅ | - | - | - | - | peer-review |
| `api/v1/peer-review/results` | ✅ | - | - | - | - | peer-review |
| `api/v1/peer-review/results/team` | ✅ | - | - | - | - | peer-review |
| `api/v1/performance/calibration/[sessionId]/adjust` | - | - | ✅ | - | - | performance |
| `api/v1/performance/calibration/[sessionId]/distribution` | ✅ | - | - | - | - | performance |
| `api/v1/performance/calibration/adjustments` | - | ✅ | - | - | - | performance |
| `api/v1/performance/calibration/rules` | ✅ | ✅ | - | - | - | performance |
| `api/v1/performance/calibration/sessions/[id]` | ✅ | - | ✅ | - | - | performance |
| `api/v1/performance/calibration/sessions` | ✅ | ✅ | - | - | - | performance |
| `api/v1/performance/checkins/[cycleId]/status` | ✅ | - | - | - | - | performance |
| `api/v1/performance/checkins` | - | ✅ | - | - | - | performance |
| `api/v1/performance/compensation/[cycleId]/apply` | - | - | ✅ | - | - | performance |
| `api/v1/performance/compensation/[cycleId]/approve` | - | ✅ | - | - | - | performance |
| `api/v1/performance/compensation/[cycleId]/dashboard` | ✅ | - | - | - | - | performance |
| `api/v1/performance/compensation/[cycleId]/export` | ✅ | - | - | - | - | performance |
| `api/v1/performance/compensation/[cycleId]/recommendations` | ✅ | - | - | - | - | performance |
| `api/v1/performance/cycles/[id]/advance` | - | - | ✅ | - | - | performance |
| `api/v1/performance/cycles/[id]/bulk-notify` | - | ✅ | - | - | - | performance |
| `api/v1/performance/cycles/[id]/finalize` | - | ✅ | - | - | - | performance |
| `api/v1/performance/cycles/[id]/initialize` | - | ✅ | - | - | - | performance |
| `api/v1/performance/cycles/[id]/overdue/[step]` | ✅ | - | - | - | - | performance |
| `api/v1/performance/cycles/[id]/participants` | ✅ | - | - | - | - | performance |
| `api/v1/performance/cycles/[id]` | ✅ | - | ✅ | - | - | performance |
| `api/v1/performance/cycles` | ✅ | ✅ | - | - | - | performance |
| `api/v1/performance/evaluations/[id]/ai-draft` | ✅ | ✅ | - | - | - | performance |
| `api/v1/performance/evaluations/bias-check` | ✅ | ✅ | - | - | - | performance |
| `api/v1/performance/evaluations/manager` | ✅ | ✅ | - | - | - | performance |
| `api/v1/performance/evaluations/self` | ✅ | ✅ | - | - | - | performance |
| `api/v1/performance/goals/[id]/approve` | - | - | ✅ | - | - | performance |
| `api/v1/performance/goals/[id]/progress` | ✅ | ✅ | - | - | - | performance |
| `api/v1/performance/goals/[id]/request-revision` | - | - | ✅ | - | - | performance |
| `api/v1/performance/goals/[id]` | ✅ | - | ✅ | - | ✅ | performance |
| `api/v1/performance/goals/[id]/submit` | - | - | ✅ | - | - | performance |
| `api/v1/performance/goals/[id]/unlock` | - | ✅ | - | - | - | performance |
| `api/v1/performance/goals/bulk-lock` | - | ✅ | - | - | - | performance |
| `api/v1/performance/goals` | ✅ | ✅ | - | - | - | performance |
| `api/v1/performance/peer-review/candidates` | ✅ | - | - | - | - | performance |
| `api/v1/performance/peer-review/my-assignments` | ✅ | - | - | - | - | performance |
| `api/v1/performance/peer-review/nominate` | - | ✅ | - | - | - | performance |
| `api/v1/performance/peer-review/nominations/[id]/skip` | - | - | ✅ | - | - | performance |
| `api/v1/performance/peer-review/results/[employeeId]` | ✅ | - | - | - | - | performance |
| `api/v1/performance/peer-review/submit` | - | ✅ | - | - | - | performance |
| `api/v1/performance/results/admin` | ✅ | - | - | - | - | performance |
| `api/v1/performance/results/me` | ✅ | - | - | - | - | performance |
| `api/v1/performance/results/team` | ✅ | - | - | - | - | performance |
| `api/v1/performance/reviews/[reviewId]/acknowledge` | - | ✅ | - | - | - | performance |
| `api/v1/performance/reviews/[reviewId]/notify` | - | ✅ | - | - | - | performance |
| `api/v1/performance/reviews/[reviewId]/overdue` | ✅ | - | - | - | - | performance |
| `api/v1/performance/reviews/my-result` | ✅ | - | - | - | - | performance |
| `api/v1/performance/team-goals` | ✅ | - | - | - | - | performance |
| `api/v1/process-settings/[category]` | ✅ | - | ✅ | - | ✅ | process-settings |
| `api/v1/profile/change-requests/[id]/review` | - | - | ✅ | - | - | profile |
| `api/v1/profile/change-requests/pending` | ✅ | - | - | - | - | profile |
| `api/v1/profile/change-requests` | ✅ | ✅ | - | - | - | profile |
| `api/v1/pulse/my-pending` | ✅ | - | - | - | - | pulse |
| `api/v1/pulse/surveys/[id]/questions` | - | - | ✅ | - | - | pulse |
| `api/v1/pulse/surveys/[id]/respond` | - | ✅ | - | - | - | pulse |
| `api/v1/pulse/surveys/[id]/results` | ✅ | - | - | - | - | pulse |
| `api/v1/pulse/surveys/[id]` | ✅ | - | ✅ | - | ✅ | pulse |
| `api/v1/pulse/surveys` | ✅ | ✅ | - | - | - | pulse |
| `api/v1/push/subscribe` | - | ✅ | - | - | ✅ | push |
| `api/v1/push/vapid-key` | ✅ | - | - | - | - | push |
| `api/v1/recruitment/applicants/[id]` | ✅ | - | ✅ | - | - | recruitment |
| `api/v1/recruitment/applicants/[id]/timeline` | ✅ | - | - | - | - | recruitment |
| `api/v1/recruitment/applicants/check-duplicate` | - | ✅ | - | - | - | recruitment |
| `api/v1/recruitment/applications/[id]/convert-to-employee` | - | ✅ | - | - | - | recruitment |
| `api/v1/recruitment/applications/[id]/offer` | - | ✅ | - | - | - | recruitment |
| `api/v1/recruitment/applications/[id]/stage` | - | - | ✅ | - | - | recruitment |
| `api/v1/recruitment/board` | ✅ | - | - | - | - | recruitment |
| `api/v1/recruitment/candidates/check` | ✅ | - | - | - | - | recruitment |
| `api/v1/recruitment/cost-analysis` | ✅ | - | - | - | - | recruitment |
| `api/v1/recruitment/costs/[id]` | ✅ | - | ✅ | - | ✅ | recruitment |
| `api/v1/recruitment/costs` | ✅ | ✅ | - | - | - | recruitment |
| `api/v1/recruitment/dashboard` | ✅ | - | - | - | - | recruitment |
| `api/v1/recruitment/internal-jobs/[id]/apply` | - | ✅ | - | - | - | recruitment |
| `api/v1/recruitment/internal-jobs` | ✅ | - | - | - | - | recruitment |
| `api/v1/recruitment/interviews/[id]/calendar/available-slots` | ✅ | - | - | - | - | recruitment |
| `api/v1/recruitment/interviews/[id]/calendar` | - | ✅ | ✅ | - | ✅ | recruitment |
| `api/v1/recruitment/interviews/[id]/evaluate` | - | ✅ | - | - | - | recruitment |
| `api/v1/recruitment/interviews/[id]` | ✅ | - | ✅ | - | ✅ | recruitment |
| `api/v1/recruitment/interviews` | ✅ | ✅ | - | - | - | recruitment |
| `api/v1/recruitment/positions/vacancies` | ✅ | - | - | - | - | recruitment |
| `api/v1/recruitment/postings/[id]/applicants` | ✅ | ✅ | - | - | - | recruitment |
| `api/v1/recruitment/postings/[id]/close` | - | - | ✅ | - | - | recruitment |
| `api/v1/recruitment/postings/[id]/publish` | - | - | ✅ | - | - | recruitment |
| `api/v1/recruitment/postings/[id]` | ✅ | - | ✅ | - | ✅ | recruitment |
| `api/v1/recruitment/postings` | ✅ | ✅ | - | - | - | recruitment |
| `api/v1/recruitment/requisitions/[id]/approve` | - | ✅ | - | - | - | recruitment |
| `api/v1/recruitment/requisitions/[id]` | ✅ | - | - | ✅ | - | recruitment |
| `api/v1/recruitment/requisitions` | ✅ | ✅ | - | - | - | recruitment |
| `api/v1/recruitment/talent-pool/[id]` | - | - | - | ✅ | - | recruitment |
| `api/v1/recruitment/talent-pool` | ✅ | ✅ | - | - | - | recruitment |
| `api/v1/rewards/[id]` | ✅ | - | ✅ | - | ✅ | rewards |
| `api/v1/rewards` | ✅ | ✅ | - | - | - | rewards |
| `api/v1/search/command` | ✅ | - | - | - | - | search |
| `api/v1/search/employees` | ✅ | - | - | - | - | search |
| `api/v1/settings-audit-log` | ✅ | - | - | - | - | settings-audit-log |
| `api/v1/settings/approval-flows` | ✅ | ✅ | ✅ | - | ✅ | settings |
| `api/v1/settings/attendance` | ✅ | - | ✅ | - | - | settings |
| `api/v1/settings/branding` | ✅ | - | ✅ | - | - | settings |
| `api/v1/settings/branding/upload` | - | ✅ | - | - | - | settings |
| `api/v1/settings/company` | ✅ | - | ✅ | - | - | settings |
| `api/v1/settings/compensation/override` | - | ✅ | - | - | ✅ | settings |
| `api/v1/settings/compensation` | ✅ | - | ✅ | - | - | settings |
| `api/v1/settings/custom-fields/[id]` | ✅ | - | ✅ | - | ✅ | settings |
| `api/v1/settings/custom-fields` | ✅ | ✅ | - | - | - | settings |
| `api/v1/settings/dashboard-layout` | ✅ | - | ✅ | - | - | settings |
| `api/v1/settings/email-templates/[id]` | ✅ | - | ✅ | - | ✅ | settings |
| `api/v1/settings/email-templates` | ✅ | ✅ | - | - | - | settings |
| `api/v1/settings/enums/[id]` | - | - | ✅ | - | ✅ | settings |
| `api/v1/settings/enums` | ✅ | ✅ | - | - | - | settings |
| `api/v1/settings/evaluation-scale` | ✅ | - | ✅ | - | - | settings |
| `api/v1/settings/evaluation/override` | - | ✅ | - | - | ✅ | settings |
| `api/v1/settings/evaluation` | ✅ | - | ✅ | - | - | settings |
| `api/v1/settings/export-templates/[id]` | ✅ | - | ✅ | - | ✅ | settings |
| `api/v1/settings/export-templates` | ✅ | ✅ | - | - | - | settings |
| `api/v1/settings/job-grades` | ✅ | - | - | - | - | settings |
| `api/v1/settings/modules` | ✅ | - | ✅ | - | - | settings |
| `api/v1/settings/notification-triggers/[id]` | - | - | ✅ | - | ✅ | settings |
| `api/v1/settings/notification-triggers` | ✅ | ✅ | - | - | - | settings |
| `api/v1/settings/performance/grade-scale` | ✅ | - | ✅ | - | - | settings |
| `api/v1/settings/performance/level-mapping` | ✅ | - | ✅ | - | - | settings |
| `api/v1/settings/performance/merit-matrix` | ✅ | - | ✅ | - | - | settings |
| `api/v1/settings/promotion/override` | - | ✅ | - | - | ✅ | settings |
| `api/v1/settings/promotion` | ✅ | - | ✅ | - | - | settings |
| `api/v1/settings/teams-webhooks/[id]` | - | - | - | ✅ | ✅ | settings |
| `api/v1/settings/teams-webhooks` | ✅ | ✅ | - | - | - | settings |
| `api/v1/settings/teams-webhooks/test` | - | ✅ | - | - | - | settings |
| `api/v1/settings/terms/[id]` | - | - | ✅ | - | ✅ | settings |
| `api/v1/settings/terms` | ✅ | ✅ | - | - | - | settings |
| `api/v1/settings/workflows/[id]` | ✅ | - | ✅ | - | ✅ | settings |
| `api/v1/settings/workflows` | ✅ | ✅ | - | - | - | settings |
| `api/v1/shift-change-requests/[id]/approve` | - | - | ✅ | - | - | shift-change-requests |
| `api/v1/shift-change-requests` | ✅ | ✅ | - | - | - | shift-change-requests |
| `api/v1/shift-groups/[id]/members` | ✅ | - | ✅ | - | - | shift-groups |
| `api/v1/shift-groups` | ✅ | ✅ | - | - | - | shift-groups |
| `api/v1/shift-patterns/[id]` | ✅ | - | ✅ | - | ✅ | shift-patterns |
| `api/v1/shift-patterns` | ✅ | ✅ | - | - | - | shift-patterns |
| `api/v1/shift-roster/[year]/[month]` | ✅ | - | - | - | - | shift-roster |
| `api/v1/shift-roster/assign` | - | - | ✅ | - | - | shift-roster |
| `api/v1/shift-roster/warnings` | ✅ | - | - | - | - | shift-roster |
| `api/v1/shift-schedules/[year]/[month]` | ✅ | - | - | - | - | shift-schedules |
| `api/v1/shift-schedules/generate` | - | ✅ | - | - | - | shift-schedules |
| `api/v1/sidebar/counts` | ✅ | - | - | - | - | sidebar |
| `api/v1/skills/assessments` | ✅ | ✅ | - | - | - | skills |
| `api/v1/skills/gap-report` | ✅ | ✅ | - | - | - | skills |
| `api/v1/skills/matrix` | ✅ | - | - | - | - | skills |
| `api/v1/skills/radar` | ✅ | - | - | - | - | skills |
| `api/v1/skills/team-assessments` | ✅ | ✅ | - | - | - | skills |
| `api/v1/succession/candidates/[id]` | - | - | ✅ | - | ✅ | succession |
| `api/v1/succession/dashboard` | ✅ | - | - | - | - | succession |
| `api/v1/succession/plans/[id]/candidates` | ✅ | ✅ | - | - | - | succession |
| `api/v1/succession/plans/[id]` | ✅ | - | ✅ | - | ✅ | succession |
| `api/v1/succession/plans` | ✅ | ✅ | - | - | - | succession |
| `api/v1/succession/readiness-batch` | - | ✅ | - | - | - | succession |
| `api/v1/tax-brackets/[id]` | ✅ | - | ✅ | - | ✅ | tax-brackets |
| `api/v1/tax-brackets` | ✅ | ✅ | - | - | - | tax-brackets |
| `api/v1/tax-brackets/seed` | - | ✅ | - | - | - | tax-brackets |
| `api/v1/teams/bot` | - | ✅ | - | - | - | teams |
| `api/v1/teams/channels` | ✅ | - | - | - | - | teams |
| `api/v1/teams/config/disconnect` | - | ✅ | - | - | - | teams |
| `api/v1/teams/config` | ✅ | - | ✅ | - | - | teams |
| `api/v1/teams/config/test` | - | ✅ | - | - | - | teams |
| `api/v1/teams/digest` | ✅ | ✅ | - | - | - | teams |
| `api/v1/teams/recognition` | - | ✅ | - | - | - | teams |
| `api/v1/teams/webhook` | - | ✅ | - | - | - | teams |
| `api/v1/temp-fix-positions` | ✅ | - | - | - | - | temp-fix-positions |
| `api/v1/tenant-settings/brand-colors` | ✅ | - | - | - | - | tenant-settings |
| `api/v1/terminals/[id]/regenerate-secret` | - | ✅ | - | - | - | terminals |
| `api/v1/terminals/[id]` | ✅ | - | ✅ | - | ✅ | terminals |
| `api/v1/terminals/clock` | - | ✅ | - | - | - | terminals |
| `api/v1/terminals` | ✅ | ✅ | - | - | - | terminals |
| `api/v1/training/courses/[id]` | ✅ | - | ✅ | - | ✅ | training |
| `api/v1/training/courses` | ✅ | ✅ | - | - | - | training |
| `api/v1/training/dashboard` | ✅ | - | - | - | - | training |
| `api/v1/training/enrollments/[id]` | - | - | ✅ | - | - | training |
| `api/v1/training/enrollments` | ✅ | ✅ | - | - | - | training |
| `api/v1/training/mandatory-config/[id]` | - | - | - | ✅ | ✅ | training |
| `api/v1/training/mandatory-config/enroll` | - | ✅ | - | - | - | training |
| `api/v1/training/mandatory-config` | ✅ | ✅ | - | - | - | training |
| `api/v1/training/mandatory-status` | ✅ | - | - | - | - | training |
| `api/v1/training/my` | ✅ | - | - | - | - | training |
| `api/v1/training/recommendations` | ✅ | - | - | - | - | training |
| `api/v1/training/skill-assessments` | ✅ | ✅ | - | - | - | training |
| `api/v1/unified-tasks` | ✅ | - | - | - | - | unified-tasks |
| `api/v1/work-permits/[id]` | - | - | ✅ | - | ✅ | work-permits |
| `api/v1/work-permits/expiring` | ✅ | - | - | - | - | work-permits |
| `api/v1/work-schedules/[id]` | ✅ | - | ✅ | - | ✅ | work-schedules |
| `api/v1/work-schedules` | ✅ | ✅ | - | - | - | work-schedules |
| `api/v1/year-end/hr/bulk-confirm` | - | ✅ | - | - | - | year-end |
| `api/v1/year-end/hr/settlements/[id]/confirm` | - | ✅ | - | - | - | year-end |
| `api/v1/year-end/hr/settlements/[id]/receipt` | - | ✅ | - | - | - | year-end |
| `api/v1/year-end/hr/settlements` | ✅ | - | - | - | - | year-end |
| `api/v1/year-end/settlements/[id]/calculate` | - | ✅ | - | - | - | year-end |
| `api/v1/year-end/settlements/[id]/deductions` | ✅ | - | ✅ | - | - | year-end |
| `api/v1/year-end/settlements/[id]/dependents` | ✅ | - | ✅ | - | - | year-end |
| `api/v1/year-end/settlements/[id]/documents` | - | ✅ | - | - | ✅ | year-end |
| `api/v1/year-end/settlements/[id]` | ✅ | - | ✅ | - | - | year-end |
| `api/v1/year-end/settlements/[id]/submit` | - | ✅ | - | - | - | year-end |
| `api/v1/year-end/settlements` | ✅ | ✅ | - | - | - | year-end |

## 2. Module Summary
| Module | Routes | GET | POST | PUT/PATCH | DELETE |
|--------|--------|-----|------|-----------|--------|
| ai | 10 | 0 | 10 | 0 | 0 |
| analytics | 27 | 24 | 3 | 0 | 0 |
| approvals | 4 | 3 | 2 | 1 | 0 |
| attendance | 12 | 9 | 3 | 2 | 0 |
| attrition | 5 | 4 | 1 | 0 | 0 |
| audit | 4 | 4 | 0 | 1 | 0 |
| bank-transfers | 4 | 2 | 2 | 1 | 0 |
| benefit-budgets | 1 | 1 | 0 | 1 | 0 |
| benefit-claims | 3 | 3 | 1 | 1 | 0 |
| benefit-plans | 1 | 1 | 0 | 0 | 0 |
| benefits | 4 | 3 | 2 | 2 | 1 |
| cfr | 7 | 6 | 3 | 1 | 0 |
| companies | 1 | 1 | 0 | 0 | 0 |
| compensation | 9 | 6 | 5 | 1 | 1 |
| competencies | 4 | 4 | 1 | 3 | 1 |
| compliance | 36 | 28 | 14 | 8 | 0 |
| contracts | 1 | 1 | 0 | 0 | 0 |
| cron | 5 | 2 | 3 | 0 | 0 |
| dashboard | 3 | 3 | 0 | 0 | 0 |
| delegation | 3 | 2 | 1 | 1 | 0 |
| departments | 1 | 1 | 0 | 0 | 0 |
| directory | 1 | 1 | 0 | 0 | 0 |
| disciplinary | 3 | 2 | 1 | 2 | 0 |
| discipline | 0 | 0 | 0 | 0 | 0 |
| employees | 23 | 18 | 10 | 4 | 2 |
| entity-transfers | 4 | 2 | 1 | 2 | 0 |
| files | 1 | 0 | 1 | 0 | 0 |
| holidays | 2 | 2 | 1 | 1 | 1 |
| home | 2 | 2 | 0 | 0 | 0 |
| hr-chat | 4 | 2 | 3 | 1 | 0 |
| hr-documents | 2 | 1 | 1 | 1 | 1 |
| leave | 18 | 13 | 5 | 6 | 2 |
| locale | 1 | 0 | 1 | 0 | 0 |
| m365 | 4 | 2 | 2 | 0 | 0 |
| manager-hub | 5 | 5 | 0 | 0 | 0 |
| migration | 5 | 3 | 3 | 0 | 1 |
| monitoring | 2 | 2 | 0 | 0 | 0 |
| notifications | 5 | 3 | 0 | 3 | 0 |
| offboarding | 14 | 9 | 4 | 5 | 1 |
| onboarding | 19 | 10 | 7 | 5 | 1 |
| org | 10 | 7 | 5 | 2 | 1 |
| payroll | 50 | 30 | 21 | 9 | 5 |
| peer-review | 7 | 5 | 2 | 1 | 0 |
| performance | 47 | 28 | 21 | 10 | 1 |
| process-settings | 1 | 1 | 0 | 1 | 1 |
| profile | 3 | 2 | 1 | 1 | 0 |
| pulse | 6 | 4 | 2 | 2 | 1 |
| push | 2 | 1 | 1 | 0 | 1 |
| recruitment | 30 | 19 | 13 | 10 | 4 |
| rewards | 2 | 2 | 1 | 1 | 1 |
| search | 2 | 2 | 0 | 0 | 0 |
| settings | 35 | 26 | 14 | 21 | 12 |
| settings-audit-log | 1 | 1 | 0 | 0 | 0 |
| shift-change-requests | 2 | 1 | 1 | 1 | 0 |
| shift-groups | 2 | 2 | 1 | 1 | 0 |
| shift-patterns | 2 | 2 | 1 | 1 | 1 |
| shift-roster | 3 | 2 | 0 | 1 | 0 |
| shift-schedules | 2 | 1 | 1 | 0 | 0 |
| sidebar | 1 | 1 | 0 | 0 | 0 |
| skills | 5 | 5 | 3 | 0 | 0 |
| succession | 6 | 4 | 3 | 2 | 2 |
| tax-brackets | 3 | 2 | 2 | 1 | 1 |
| teams | 8 | 3 | 6 | 1 | 0 |
| temp-fix-positions | 1 | 1 | 0 | 0 | 0 |
| tenant-settings | 1 | 1 | 0 | 0 | 0 |
| terminals | 4 | 2 | 3 | 1 | 1 |
| training | 12 | 9 | 5 | 3 | 2 |
| unified-tasks | 1 | 1 | 0 | 0 | 0 |
| work-permits | 2 | 1 | 0 | 1 | 1 |
| work-schedules | 2 | 2 | 1 | 1 | 1 |
| year-end | 11 | 5 | 7 | 3 | 1 |

## 3. UI Pages
- `/analytics/ai-report`
- `/analytics/attendance`
- `/analytics/attrition`
- `/analytics/compensation`
- `/analytics/gender-pay-gap`
- `/analytics`
- `/analytics/payroll`
- `/analytics/performance`
- `/analytics/predictive/[employeeId]`
- `/analytics/predictive`
- `/analytics/recruitment`
- `/analytics/report`
- `/analytics/team-health`
- `/analytics/turnover`
- `/analytics/workforce`
- `/approvals/attendance`
- `/approvals/inbox`
- `/attendance/admin`
- `/attendance`
- `/attendance/shift-calendar`
- `/attendance/shift-roster`
- `/attendance/team`
- `/benefits`
- `/compensation`
- `/compliance/cn`
- `/compliance/data-retention`
- `/compliance/dpia`
- `/compliance/gdpr`
- `/compliance/kr`
- `/compliance`
- `/compliance/pii-audit`
- `/compliance/ru`
- `/dashboard/compare`
- `/dashboard`
- `/delegation/settings`
- `/directory`
- `/discipline/[id]`
- `/discipline/new`
- `/discipline`
- `/discipline/rewards/[id]`
- `/discipline/rewards/new`
- `/discipline/rewards`
- `/employees/[id]/contracts`
- `/employees/[id]`
- `/employees/[id]/work-permits`
- `/employees/me`
- `/employees/new`
- `/employees`
- `/home`
- `/leave/admin`
- `/leave`
- `/leave/team`
- `/manager-hub`
- `/my/benefits`
- `/my/internal-jobs`
- `/my/leave`
- `/my/offboarding`
- `/my`
- `/my/profile`
- `/my/settings/notifications`
- `/my/skills`
- `/my/tasks`
- `/my/training`
- `/my/year-end`
- `/notifications`
- `/offboarding/[id]`
- `/offboarding/exit-interviews`
- `/offboarding`
- `/onboarding/[id]`
- `/onboarding/checkin`
- `/onboarding/checkins`
- `/onboarding/me`
- `/onboarding`
- `/org-studio`
- `/org`
- `/organization/skill-matrix`
- `/page.tsx`
- `/payroll/[runId]/approve`
- `/payroll/[runId]/publish`
- `/payroll/[runId]/review`
- `/payroll/adjustments`
- `/payroll/anomalies`
- `/payroll/bank-transfers`
- `/payroll/close-attendance`
- `/payroll/global`
- `/payroll/import`
- `/payroll/me/[runId]`
- `/payroll/me`
- `/payroll`
- `/payroll/simulation`
- `/payroll/year-end`
- `/performance/admin`
- `/performance/calibration`
- `/performance/comp-review`
- `/performance/cycles/[id]`
- `/performance/cycles`
- `/performance/goals/new`
- `/performance/goals`
- `/performance/manager-eval`
- `/performance/manager-evaluation`
- `/performance/my-checkins`
- `/performance/my-evaluation`
- `/performance/my-goals`
- `/performance/my-peer-review`
- `/performance/my-result`
- `/performance/notifications`
- `/performance/one-on-one/[id]`
- `/performance/one-on-one`
- `/performance`
- `/performance/peer-review/[cycleId]/setup`
- `/performance/peer-review/evaluate/[nominationId]`
- `/performance/peer-review`
- `/performance/peer-review/results/[cycleId]`
- `/performance/pulse/[id]/respond`
- `/performance/pulse/[id]/results`
- `/performance/pulse`
- `/performance/recognition`
- `/performance/results`
- `/performance/self-eval`
- `/performance/team-goals`
- `/performance/team-results`
- `/recruitment/[id]/applicants/new`
- `/recruitment/[id]/applicants`
- `/recruitment/[id]/edit`
- `/recruitment/[id]/interviews/new`
- `/recruitment/[id]/interviews`
- `/recruitment/[id]`
- `/recruitment/[id]/pipeline`
- `/recruitment/board`
- `/recruitment/cost-analysis`
- `/recruitment/dashboard`
- `/recruitment/new`
- `/recruitment`
- `/recruitment/requisitions/new`
- `/recruitment/requisitions`
- `/recruitment/talent-pool`
- `/settings/attendance`
- `/settings/organization`
- `/settings`
- `/settings/payroll`
- `/settings/performance`
- `/settings/recruitment`
- `/settings/system`
- `/succession`
- `/talent/succession`
- `/team/skills`
- `/training/enrollments`
- `/training`

## 4. Settings Tabs
- `/settings/attendance`
- `/settings/organization`
- `/settings`
- `/settings/payroll`
- `/settings/performance`
- `/settings/recruitment`
- `/settings/system`

## 5. Totals
- API Routes: 526
- UI Pages: 148
