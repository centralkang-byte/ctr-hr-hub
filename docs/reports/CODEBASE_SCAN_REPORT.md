# CTR HR Hub — Codebase ↔ Design Spec Gap Analysis

> **Scan Date:** 2026-03-11  
> **Git Commit:** `c11df95`  
> **Codebase:** 521 API routes · 184 pages · 194 models · 131 enums · 24 seed files

---

## 1. Schema Summary

| Metric | Count |
|--------|-------|
| Models | **194** |
| Enums | **131** |
| Seed files | **24** (02~25) |
| API routes (route.ts) | **521** |
| Pages (page.tsx) | **184** |

### Key Enum Values

| Enum | Spec | Actual | Match? |
|------|------|--------|--------|
| `CycleStatus` | 5 states (DRAFT/ACTIVE/EVAL_OPEN/CALIBRATION/CLOSED) | **7** states (+CHECK_IN, FINALIZED) | ⚠️ Exceeds spec |
| `PayrollStatus` | 8 states | **9** states (+CANCELLED) | ⚠️ Exceeds spec |
| `TaskProgressStatus` | PENDING/IN_PROGRESS/DONE/BLOCKED/SKIPPED | ✅ Matches | ✅ |
| `LeaveRequestStatus` | PENDING/APPROVED/REJECTED/CANCELLED | ✅ Matches | ✅ |
| `DelegationScope` | LEAVE_ONLY/ALL | ✅ Matches | ✅ |
| `DelegationStatus` | ACTIVE/EXPIRED/REVOKED | ✅ Matches | ✅ |
| `OnboardingMilestone` | DAY_1/DAY_7/DAY_30/DAY_90 | ✅ Matches | ✅ |
| `ResignType` | 5 types | ✅ VOLUNTARY/INVOLUNTARY/RETIREMENT/CONTRACT_END/MUTUAL_AGREEMENT | ✅ |
| `PerformanceGrade` | E/M+/M/B | ✅ E/M_PLUS/M/B | ✅ |
| `ReviewStatus` | 8 states | ✅ NOT_STARTED→ACKNOWLEDGED (8 states) | ✅ |
| `AiReportStatus` | 3 states | ✅ GENERATING/GENERATED/FAILED | ✅ |

---

## 2. GP#1 Leave — Spec vs Reality

### ✅ Matches Spec
- `LeaveRequestStatus`: PENDING/APPROVED/REJECTED/CANCELLED — exact match
- **Dual balance model**: `EmployeeLeaveBalance` + `LeaveYearBalance` both exist as separate models
- `LeaveSetting.allowNegativeBalance` ✅ + `negativeBalanceLimit` ✅ fields exist
- `LeaveTypeDef.minAdvanceDays` ✅ field exists (F-3 addition)
- **3-scenario cancel logic**: `src/app/api/v1/leave/requests/[id]/cancel/route.ts` exists with partial cancel logic
- **Delegation integration**: `checkDelegation` imported and used in `approve` and `reject` routes
- `balance-renewal.ts` ✅ + `negative-balance-settlement.ts` ✅ exist in `src/lib/leave/`
- `accrualEngine.ts` ✅ exists
- Leave admin stats API: `GET /api/v1/leave/admin/stats` ✅
- Leave type definitions: CRUD APIs (`type-defs/`, `accrual-rules/`) ✅
- Year balances API: `GET /api/v1/leave/year-balances` ✅

### ⚠️ Differs from Spec (spec needs update)
- **18 Leave API routes** exist (spec may describe fewer) — code includes `bulk-grant`, `accrual`, `year-balances` not in original spec
- `LeaveTypeDef` has additional fields: `allowHalfDay`, `requiresProof`, `maxConsecutiveDays`, `displayOrder`

### ❌ Not Implemented
- None identified — GP#1 is **fully implemented**

---

## 3. GP#2 Onboarding/Offboarding — Spec vs Reality

### ✅ Matches Spec
- `TaskProgressStatus`: PENDING/IN_PROGRESS/DONE/BLOCKED/SKIPPED — exact match
- `OnboardingMilestone`: DAY_1/DAY_7/DAY_30/DAY_90 — exact match
- `EmployeeOnboardingTask` has `assigneeId` ✅, `dueDate` ✅, `blockedReason` ✅, `blockedAt` + `unblockedAt` ✅
- **Sign-off fields** on `EmployeeOnboarding`: `signOffBy` ✅, `signOffAt` ✅, `signOffNote` ✅
- `ExitInterview` model ✅ exists
- `AssetReturn` model ✅ exists
- Crossboarding templates: seed `23-crossboarding.ts` ✅ with DEPARTURE/ARRIVAL templates
- **19 Onboarding API routes** (templates, instances, tasks, sign-off, checkins, crossboarding, me)
- **13 Offboarding API routes** (checklists, instances, exit-interview, cancel, dashboard, me)
- Onboarding checkin: `POST /api/v1/onboarding/checkin` ✅
- Exit interview AI summary: `GET /api/v1/offboarding/[id]/exit-interview/ai-summary` ✅
- Task block/unblock APIs ✅

### ⚠️ Differs from Spec
- Exit interview has AI summary generation (not in original spec — enhancement)
- Offboarding has `cancel` and `reschedule` APIs (enhancements)
- Crossboarding flow is more comprehensive than spec (includes departure + arrival templates)

### ❌ Not Implemented
- **AssetReturn CRUD endpoints** — model exists but no dedicated `/api/v1/asset-returns/` route found (managed inline within offboarding task completion)
- **Onboarding settings page** — placeholder exists (`/settings/onboarding`) but Settings UI is empty shell

---

## 4. GP#3 Payroll — Spec vs Reality

### ✅ Matches Spec
- `PayrollStatus` has all 8 spec states: DRAFT → ATTENDANCE_CLOSED → CALCULATING → ADJUSTMENT → REVIEW → PENDING_APPROVAL → APPROVED → PAID
- `PayrollAdjustment` model ✅
- `PayrollAnomaly` model ✅
- `PayrollApproval` + `PayrollApprovalStep` models ✅
- `kr-tax.ts` ✅ exists with pro-rata logic
- **4 export types**: comparison ✅, ledger ✅, journal ✅, bank transfer CSV ✅
- Full payroll pipeline: attendance-close → calculate → adjust → review → approve → publish
- **47 Payroll API routes** — comprehensive pipeline
- Anomaly detector with whitelist support
- Payroll simulation with export
- Payslip PDF generation
- Global deductions (US, CN, VN, RU, MX)
- Severance calculation

### ⚠️ Differs from Spec
- `PayrollStatus` has **9th state**: `CANCELLED` (not in spec — safety addition)
- `PayrollRunType` enum added (MONTHLY) — not in spec
- Additional APIs beyond spec: `attendance-reopen`, `import-mappings`, `import-logs`, `payslips`, `whitelist`
- Exchange rate management APIs ✅ (not in original spec)
- Bank transfer batch processing ✅ (enhancement)

### ❌ Not Implemented
- **Payroll settings UI** — 54 TODO comments reference Settings (Payroll) — all hardcoded values
- **Country-specific tax bracket management** — `TaxBracket` model exists but UI for editing is minimal

---

## 5. GP#4 Performance — Spec vs Reality

### ✅ Matches Spec
- `CycleStatus` has core 5 states: DRAFT/ACTIVE/EVAL_OPEN/CALIBRATION/CLOSED ✅
- `PerformanceReview` model with `originalGrade` + `finalGrade` + `calibrationNote` ✅ (two-track preservation)
- `SalaryAdjustmentMatrix` model exists with Merit Matrix extension (gradeKey + comparatioBand) ✅
- `EmployeeLevelMapping` model exists with `mboWeight`/`beiWeight` per level ✅
- Merit Matrix seed data: `prisma/seeds/18-performance-pipeline.ts` ✅
- EmployeeLevelMapping seed data: same file ✅
- Peer review models: `PeerReviewNomination` ✅, `PeerReviewAnswer` ✅
- `CalibrationAdjustment` model ✅
- Grade labels: `E` / `M_PLUS` / `M` / `B` ✅ (not S/A/B/C)
- `ReviewStatus`: NOT_STARTED → GOAL_SETTING → SELF_EVAL → PEER_EVAL → MANAGER_EVAL → CALIBRATED → NOTIFIED → ACKNOWLEDGED ✅
- Overdue flags system ✅ (JSON array on PerformanceReview)
- Result notification + acknowledgment flow ✅
- MBO score + BEI score + total score fields ✅
- **45 Performance API routes** — full pipeline coverage
- Compensation review APIs (dashboard, recommendations, approve, export, apply)
- AI evaluation draft generation
- Bias detection for evaluations
- Check-in system with cycle status tracking

### ⚠️ Differs from Spec
- `CycleStatus` has **7 states** (added CHECK_IN, FINALIZED beyond spec's 5)
- Auto-acknowledge via CRON job (`/api/v1/cron/auto-acknowledge`) — not in spec
- Overdue check CRON (`/api/v1/cron/overdue-check`) — not in spec
- Peer review has `skip` functionality — not in original spec
- Compensation review is more detailed than spec (includes apply + approve + export)

### ❌ Not Implemented
- **9 TODO: Move to Settings (Performance)** items remain hardcoded:
  - Forced distribution guideline percentages
  - Probation exclusion logic
  - Deviation threshold (5pp)
  - Job family matching for peer candidates
  - CRON_SECRET validation
  - Grade scale configuration (already has API but marked TODO)

---

## 6. Unified Task Hub — Spec vs Reality

### ✅ Matches Spec
- **5 mappers** exist: `leave.mapper.ts` ✅, `payroll.mapper.ts` ✅, `onboarding.mapper.ts` ✅, `offboarding.mapper.ts` ✅, `performance.mapper.ts` ✅
- `GET /api/v1/unified-tasks` route ✅
- `types.ts` with `UnifiedTask` interface ✅
- `UnifiedTaskType` enum: LEAVE_APPROVAL, PAYROLL_REVIEW, ONBOARDING_TASK, PERFORMANCE_REVIEW, BENEFIT_REQUEST, OFFBOARDING_TASK ✅
- `UnifiedTaskStatus` enum: PENDING, IN_PROGRESS, DONE ✅

### ⚠️ Differs from Spec
- `BENEFIT_REQUEST` task type defined but mapper not found — enum exists without implementation
- Task types use runtime aggregation (no dedicated DB model) — matches D-1 design decision

### ❌ Not Implemented
- **90-day timebox for completed tasks** — needs verification in route logic
- **BENEFIT_REQUEST mapper** — enum defined but no `benefit.mapper.ts` exists

---

## 7. Insights Dashboard — Spec vs Reality

### ✅ Matches Spec
- **7+ dashboard APIs** under `/api/v1/analytics/`:
  - Executive Summary (`executive/summary`) ✅
  - Workforce Overview (`workforce/overview`) ✅
  - Payroll Overview (`payroll/overview`) ✅
  - Performance Overview (`performance/overview`) ✅
  - Attendance Overview (`attendance/overview`) ✅
  - Turnover Overview (`turnover/overview`) ✅
  - Team Health Overview (`team-health/overview`) ✅
- `AiReport` model ✅ with status enum (GENERATING/GENERATED/FAILED)
- `turnover-prediction.ts` ✅ + `burnout-detection.ts` ✅
- `ai-report/generator.ts` ✅ + `data-collector.ts` ✅
- Currency conversion: `convertToKRW()` + `formatCurrency()` in `currency.ts` ✅
- 3-layer cascading filter (법인→본부→팀) ✅ (G-2 QA fix)
- KPI tooltips on 24+ cards ✅ (G-2 QA fix)
- Custom date range picker ✅ (G-2 QA fix)

### ⚠️ Differs from Spec
- **27 Analytics API routes total** — far exceeds spec (includes legacy routes, prediction, burnout, employee-risk, recruitment analytics)
- Predictive analytics (`prediction/turnover`, `prediction/burnout`) added in G-2 — not in original Insights spec
- Gender pay gap analytics with export ✅ — not in original spec
- KPI dashboard config model exists — not in spec
- Burnout + turnover risk score models (`BurnoutScore`, `TurnoverRiskScore`, `TeamHealthScore`) — not in original spec

### ❌ Not Implemented
- **Benchmark rate** hardcoded as 4.5% (TODO: Move to Settings)
- **Drill-down from chart to employee list** — spec may describe this but implementation status unclear

---

## 8. Settings — Current State

### 8-1. TODO: Move to Settings — Full List (74 items)

| # | Category | Count | Key Items |
|---|----------|-------|-----------|
| 1 | **Payroll** | **54** | KR 4대보험 요율, US/CN/VN/RU/MX 세율, 비과세 한도, 이상탐지 임계값, 은행코드, 계정과목, 승인체계, 급여마감/지급일 |
| 2 | **Performance** | **9** | 강제배분 비율, 수습 제외 로직, 편차 임계치(5pp), 직무계열 매칭, CRON_SECRET, 등급 스케일 |
| 3 | **Attendance** | **8** | 주간 근무한도 44/48/52시간 임계값, 월 소정근로시간 209시간 |
| 4 | **System** | **1** | 전환율 벤치마크(이직률 4.5%) |
| 5 | **Other** (no tag) | **2** | 은행 기본코드 '004', 이직률 산업 평균 |
| | **Total** | **74** | |

### 8-2. Hardcoded Policy Values (no TODO comment)

| File | Value | Description |
|------|-------|-------------|
| `src/lib/labor/kr.ts` | `MAX_WEEKLY_HOURS = 52` | 주 52시간 (기본 40 + 연장 12) |
| `src/lib/analytics/predictive/burnout.ts` | `52, 48, 44` | 번아웃 임계값 (하드코딩) |
| `src/lib/analytics/queries.ts` | `52` | 근태 이상 쿼리 기준 |
| `src/types/settings.ts` | `forcedDistribution`, `distributionRules` | 타입 정의 있으나 Settings UI 미연결 |
| `src/types/process-settings.ts` | `forced_distribution`, `distribution_rules` | 프로세스 설정 타입 정의 |

### 8-3. Settings Pages — Current State

**39 settings pages** exist:

| Category | Pages | Status |
|----------|-------|--------|
| General | company, branding, modules, dashboard-widgets | ⚠️ Basic shell |
| Attendance | attendance, shift-patterns, shift-roster, work-schedules, holidays, terminals | ⚠️ Basic shell |
| Payroll | payroll-items, salary-bands, salary-matrix, exchange-rates, tax-brackets | ⚠️ Basic shell |
| Performance | performance-cycles (CRUD), calibration, evaluation-scale, competencies | ⚠️ Partial |
| HR Admin | custom-fields, enums, terms, email-templates, export-templates | ⚠️ Basic shell |
| System | audit-logs, monitoring, data-migration, m365, teams, workflows, approval-flows | ⚠️ Basic shell |
| Leave | leave, leave-policies | ⚠️ Basic shell |
| Onboarding/Offboarding | onboarding, offboarding | ⚠️ Basic shell |
| Profile | profile-requests, entity-transfers, org-changes, contract-rules | ⚠️ Basic shell |
| Notifications | notifications | ⚠️ Basic shell |

### 8-4. CompanyProcessSetting — Usage Status

- **Model exists:** ✅ `CompanyProcessSetting` with `settingType`, `settingKey`, `settingValue` (JSON)
- **Getter exists:** ✅ `getCompanySettings()` in `src/lib/settings/getSettings.ts`
- **Active usage:** ✅ Used by 3 settings APIs (`evaluation`, `promotion`, `compensation`) + `manager/route.ts`
- **Fallback pattern:** ✅ Company override → global default (companyId=null)
- **6 setting models:** EvaluationSetting, PromotionSetting, CompensationSetting, AttendanceSetting, LeaveSetting, OnboardingSetting

---

## 9. API Route Summary

| Module | API Routes | Key Endpoints |
|--------|-----------|---------------|
| Leave | **18** | requests/CRUD, approve, reject, cancel, admin, stats, type-defs, accrual, year-balances, bulk-grant |
| Onboarding | **19** | templates, instances, tasks, sign-off, checkins, crossboarding, me, dashboard, force-complete |
| Offboarding | **13** | checklists, instances, tasks, exit-interview, cancel, reschedule, dashboard, me, ai-summary |
| Payroll | **47** | runs, calculate, approve, reject, export(4 types), anomalies, whitelist, simulation, payslips, allowance/deduction-types, import, severance, global |
| Performance | **45** | cycles, goals, evaluations, calibration, peer-review, reviews, results, checkins, compensation, team-goals, one-on-one |
| Analytics | **27** | executive, workforce, payroll, performance, attendance, turnover, team-health, ai-report, prediction, burnout, compensation, gender-pay-gap |
| Settings | **33** | company, branding, attendance, evaluation, compensation, promotion, performance, custom-fields, enums, email-templates, export-templates, workflows, notification-triggers, teams-webhooks, terms, modules |
| Unified Tasks | **1** | GET /api/v1/unified-tasks |
| Recruitment | **30** | postings, applicants, applications, interviews, board, requisitions, talent-pool, costs, dashboard, internal-jobs |
| Delegation | **5** | CRUD + active delegators |
| Other | **283** | employees, attendance, notifications, search, compliance, training, succession, pulse, benefits, year-end, shifts, etc. |
| **Total** | **521** | |

---

## 10. Page/UI Summary

| Module | Pages | Key Pages |
|--------|-------|-----------|
| Analytics | **9** | executive, workforce, payroll, performance, attendance, turnover, team-health, ai-report, attrition |
| Performance | **19** | admin, goals, cycles, calibration, peer-review, my-evaluation, self-eval, results, one-on-one, pulse, recognition, comp-review |
| Payroll | **12** | admin, adjustments, anomalies, close-attendance, review, approve, publish, simulation, me, bank-transfers, import, global |
| Recruitment | **15** | postings, applicants, interviews, pipeline, board, requisitions, talent-pool, cost-analysis, dashboard, internal-jobs |
| Settings | **39** | (see Section 8-3) |
| Leave | **3** | my/leave, admin, team |
| Onboarding | **5** | admin, detail, checkin, checkins, me |
| Offboarding | **3** | admin, detail, exit-interviews |
| Employee | **7** | list, detail, new, contracts, work-permits, me, directory |
| Home/Tasks | **3** | home, my/tasks, dashboard |
| Other | **69** | compliance, benefits, training, succession, attendance, discipline, etc. |
| **Total** | **184** | |

---

## 11. Sidebar Navigation

**10 Sections** (verified):

| # | Section Key | Label | Items | Visible To |
|---|-------------|-------|-------|------------|
| 1 | `home` | — | 대시보드, 알림 | ALL |
| 2 | `my-space` | 나의 공간 | 8 items (나의 업무, 내 프로필, 출퇴근, 휴가 신청, 급여명세서, 목표/평가, 복리후생, 연말 정산) | ALL |
| 3 | `team` | 팀 관리 | 5 items (팀 현황, 팀 근태, 팀 휴가, 팀 목표/성과, 위임 설정) | MANAGER_UP |
| 4 | `hr-admin` | 인사 관리 | ~8 items | HR_UP |
| 5 | `recruitment` | 채용 | ~6 items | HR_UP |
| 6 | `performance` | 성과/보상 | ~6 items | HR_UP |
| 7 | `payroll` | 급여 | ~8 items | PAYROLL_ADMIN |
| 8 | `insights` | 인사이트 | 8 items (Exec Summary, 인력, 급여, 성과, 근태/휴가, 이직, 팀 건강, AI 리포트) | MANAGER_UP |
| 9 | `compliance` | 컴플라이언스 | ~7 items | HR_ADMIN |
| 10 | `settings` | 설정 | ~10 items | HR_UP |

---

## 12. Seed Data Summary

| Seed File | Description | Status |
|-----------|-------------|--------|
| `02-employees.ts` | 직원 기본 데이터 (179명) | ✅ |
| `03-attendance.ts` | 근태 기록 | ✅ |
| `04-leave.ts` | 휴가 정책/신청/잔액 | ✅ |
| `05-performance.ts` | 성과 사이클/평가 | ✅ |
| `06-payroll.ts` | 급여 기본 | ✅ |
| `07-lifecycle.ts` | 온보딩/오프보딩 기본 | ✅ |
| `08-notifications.ts` | 알림 트리거/이메일 템플릿 | ✅ |
| `09-qa-fixes.ts` | QA 패치 데이터 | ✅ |
| `10-recruitment.ts` | 채용 공고/지원자 | ✅ |
| `11-compensation.ts` | 보상/급여밴드/SalaryAdjustmentMatrix | ✅ |
| `12-benefits.ts` | 복리후생 | ✅ |
| `13-year-end.ts` | 연말정산 | ✅ |
| `14-succession.ts` | 승계 계획 | ✅ |
| `15-peer-review.ts` | 동료 평가 | ✅ |
| `16-partial-fixes.ts` | 분석/급여 시뮬레이션 패치 | ✅ |
| `17-payroll-pipeline.ts` | 급여 파이프라인 (全 8단계) | ✅ |
| `18-performance-pipeline.ts` | 성과 파이프라인 (EmployeeLevelMapping + MeritMatrix) | ✅ |
| `19-peer-review.ts` | 동료 평가 확장 | ✅ |
| `20-compensation-review.ts` | 보상 리뷰 | ✅ |
| `21-onboarding-instances.ts` | 온보딩 인스턴스 | ✅ |
| `22-offboarding-instances.ts` | 오프보딩 인스턴스 | ✅ |
| `23-crossboarding.ts` | 크로스보딩 템플릿 | ✅ |
| `24-delegation.ts` | 승인 위임 | ✅ |
| `25-leave-enhancement.ts` | 휴가 강화 (LeaveTypeDef/YearBalance) | ✅ |

---

## 13. Domain Events & Handlers

| Event | Handler Exists? |
|-------|----------------|
| LEAVE_APPROVED | ✅ `leave-approved.handler.ts` |
| LEAVE_REJECTED | ✅ `leave-rejected.handler.ts` |
| LEAVE_CANCELLED | ✅ `leave-cancelled.handler.ts` |
| EMPLOYEE_HIRED | ✅ `employee-hired.handler.ts` |
| OFFBOARDING_STARTED | ✅ `offboarding-started.handler.ts` |
| PAYROLL_ATTENDANCE_CLOSED | ✅ `payroll-attendance-closed.handler.ts` |
| PAYROLL_CALCULATED | ✅ `payroll-calculated.handler.ts` |
| PAYROLL_REVIEW_READY | ✅ `payroll-review-ready.handler.ts` |
| PAYROLL_APPROVED | ✅ `payroll-approved.handler.ts` |
| MBO_GOAL_SUBMITTED | ✅ `mbo-goal-submitted.handler.ts` |
| MBO_GOAL_REVIEWED | ✅ `mbo-goal-reviewed.handler.ts` |
| SELF_EVAL_SUBMITTED | ✅ `self-eval-submitted.handler.ts` |
| MANAGER_EVAL_SUBMITTED | ✅ `manager-eval-submitted.handler.ts` |

### Nudge Rules (11 rules)

| Rule | File |
|------|------|
| Delegation not set | `delegation-not-set.rule.ts` |
| Exit interview pending | `exit-interview-pending.rule.ts` |
| Leave pending | `leave-pending.rule.ts` |
| Leave year-end burn | `leave-yearend-burn.rule.ts` |
| Offboarding overdue | `offboarding-overdue.rule.ts` |
| Onboarding checkin missing | `onboarding-checkin-missing.rule.ts` |
| Onboarding overdue | `onboarding-overdue.rule.ts` |
| Payroll review | `payroll-review.rule.ts` |
| Performance calibration pending | `performance-calibration-pending.rule.ts` |
| Performance eval overdue | `performance-eval-overdue.rule.ts` |
| Performance goal overdue | `performance-goal-overdue.rule.ts` |

---

## 14. Action Items for Spec Updates

### 🔴 Critical (Spec ≠ Code — must update)

| # | Spec | Action |
|---|------|--------|
| 1 | GP#4 `CycleStatus` | Update spec: add CHECK_IN, FINALIZED (7 states total) |
| 2 | GP#3 `PayrollStatus` | Update spec: add CANCELLED (9 states total) |
| 3 | Settings spec | Update: 39 settings pages + 33 settings APIs already exist — spec implies empty shell |
| 4 | Settings spec | Document: `getCompanySettings()` with company→global fallback already works |
| 5 | Settings spec | Document: 6 dedicated settings models (Evaluation/Promotion/Compensation/Attendance/Leave/Onboarding) + `CompanyProcessSetting` generic model |

### 🟡 Important (Implementation exceeds spec)

| # | Spec | Enhancement |
|---|------|-------------|
| 6 | GP#2 | Add: Exit interview AI summary, offboarding cancel/reschedule, crossboarding |
| 7 | GP#3 | Add: Payroll simulation export, import mapping, bank transfer batching, whitelist |
| 8 | GP#4 | Add: Auto-acknowledge CRON, overdue check CRON, peer review skip, compensation review pipeline |
| 9 | Insights | Add: Predictive analytics (turnover/burnout), 3-layer filter, KPI tooltips, custom date range |
| 10 | Task Hub | Add: BENEFIT_REQUEST type defined but mapper missing — either remove type or add mapper |
| 11 | Overall | Add: 13 domain event handlers + 11 nudge rules — not in any spec |

### 🟢 Low Priority (Code gaps)

| # | Gap | Impact |
|---|-----|--------|
| 12 | 74 TODO: Move to Settings items (54 Payroll, 9 Performance, 8 Attendance) | Settings pages exist but many values hardcoded |
| 13 | AssetReturn CRUD endpoints missing | Low — managed inline within offboarding |
| 14 | BENEFIT_REQUEST mapper missing | Low — enum exists without implementation |
| 15 | Settings UI "empty shell" — pages exist but many are basic forms | Medium — functional but needs polish |

---

## 15. Key Checklist Results

### GP#1 Leave ✅
- [x] LeaveRequest status: PENDING/APPROVED/REJECTED/CANCELLED
- [x] Dual balance model: EmployeeLeaveBalance + LeaveYearBalance
- [x] LeaveSetting.allowNegativeBalance + negativeBalanceLimit
- [x] LeaveTypeDef.minAdvanceDays
- [x] 3-scenario cancel logic
- [x] Delegation integration in approve/reject
- [x] balance-renewal.ts + negative-balance-settlement.ts
- [x] Leave admin stats API

### GP#2 Onboarding/Offboarding ✅
- [x] TaskProgressStatus: PENDING/IN_PROGRESS/DONE/BLOCKED/SKIPPED
- [x] OnboardingMilestone: DAY_1/DAY_7/DAY_30/DAY_90
- [x] EmployeeOnboardingTask: assigneeId, dueDate, blocked fields
- [x] Sign-off fields on EmployeeOnboarding
- [x] ExitInterview model with AI summary
- [x] AssetReturn model
- [x] Crossboarding templates in seed

### GP#3 Payroll ✅
- [x] PayrollStatus: 8 core states (+CANCELLED)
- [x] PayrollAdjustment model
- [x] PayrollAnomaly model
- [x] PayrollApproval + PayrollApprovalStep
- [x] kr-tax.ts with pro-rata
- [x] 4 export types: comparison, ledger, journal, transfer

### GP#4 Performance ✅
- [x] CycleStatus: 5 core states (+CHECK_IN, FINALIZED)
- [x] PerformanceReview: originalGrade + finalGrade + calibrationNote
- [x] SalaryAdjustmentMatrix (Merit Matrix) with seed
- [x] EmployeeLevelMapping with seed
- [x] Peer review models
- [x] CalibrationAdjustment
- [x] Grade labels: E/M_PLUS/M/B

### Task Hub ✅
- [x] 5 mappers: leave, payroll, onboarding, offboarding, performance
- [x] GET /api/v1/unified-tasks
- [x] types.ts with UnifiedTask interface
- [ ] 90-day timebox — needs verification
- [ ] BENEFIT_REQUEST mapper — defined but missing

### Insights ✅
- [x] 7+ dashboard APIs
- [x] AiReport model
- [x] turnover-prediction.ts + burnout-detection.ts
- [x] ai-report/generator.ts

### Settings ⚠️
- [x] 39 settings pages exist
- [x] CompanyProcessSetting model + getCompanySettings()
- [ ] 74 hardcoded values still need migration to Settings UI
- [x] 6 dedicated setting models operational

---

> **Summary:** Core GP#1–4, Task Hub, and Insights specs are **95%+ implemented**. Main gap is **74 hardcoded values** that should be managed through Settings UI, and a few minor missing features (AssetReturn CRUD, BenefitRequest mapper). Specs need updates to reflect enhancements (extra enum values, AI features, CRON jobs, crossboarding, analytics predictions).
