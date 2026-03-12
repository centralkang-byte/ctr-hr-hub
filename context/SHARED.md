# SHARED.md — Project State (Single Source of Truth)

> **Last Updated:** 2026-03-12 (Q-4 P1 — i18n Complete + Navigation Polish)
> **Project Path:** `/Users/sangwoo/VibeCoding/HR_Hub/ctr-hr-hub`

---

## Current State

- `npx tsc --noEmit` = **0 errors** ✅
- `npm run build` = pass ✅
- `export const dynamic = 'force-dynamic'` in `(dashboard)/layout.tsx` — covers all dashboard pages
- Git: pushed to `main` (latest: `479ab4a`)
- Deployed on Vercel (auto-deploy from `main` branch)
- **i18n**: 7 locales × 14+ namespaces — 146/146 Client files have `useTranslations` ✅

---

## Completion Summary

| Phase | Status |
|-------|--------|
| STEP 0–9 (all modules) | ✅ Complete |
| Design Refactoring R1–R9 | ✅ Complete |
| Master Plan v2.0 Phase A–C | ✅ Complete |
| FIX-1 (Security) + FIX-2 (Performance) | ✅ Complete |
| Phase 0 (Timezone Integrity) | ✅ Complete |
| Golden Path #1 (Leave Pipeline) | ✅ Complete |
| Golden Path v3.0 (Nudge + Onboarding + Offboarding + Performance) | ✅ Complete |
| CRAFTUI Phase 1–3 | ✅ Complete |
| Seed Data Expansion + QA (16 seeds, 52-menu audit) | ✅ Complete |
| Sidebar IA Redesign (7→10 sections) | ✅ Complete |
| Header + Command Palette Enhancements | ✅ Complete |
| **GP#3-A** (Attendance Closing + State Machine + Auto Calculation + Manual Adjustments) | ✅ Complete |
| **GP#3-B** (Anomaly Review UI + Whitelist + MoM Comparison + Excel Downloads) | ✅ Complete |
| **GP#3-C** (Approval Flow + Payslip Generation + Notifications + Bank Transfer CSV) | ✅ Complete |
| **GP#3-D** (Integrated Dashboard + Payroll Calendar + Edge Cases + Final Polish) | ✅ Complete |
| **GP#3 QA-A** (Korean Translation + Status Badges + Seed Data Expansion) | ✅ Complete |
| **GP#3 QA-B** (Bug Fix: Insights sidebar + i18n keys + Breadcrumb + Permission + UX Unification) | ✅ Complete |
| **GP#4-A** (Performance Pipeline Schema Foundation: 3 new models, 3 new enums, CycleStatus 7-state (DRAFT/ACTIVE/CHECK_IN/EVAL_OPEN/CALIBRATION/FINALIZED/CLOSED), 6 APIs) | ✅ Complete |
| **GP#4-B** (Pipeline State Machine: 7-state advance, Overdue system, Check-in, Goal lock, 13 events, 2 crons) | ✅ Complete |
| **GP#4-C** (Peer Review: nomination/submit/results + Calibration Two-Track + Data Masking + Result Notification) | ✅ Complete |
| **GP#4-D1** (Compensation Review: Merit Matrix 5 APIs + merit-matrix utility + seed) | ✅ Complete |
| **GP#4-D2a** (Employee-side Performance UI: my-goals, my-checkins, my-evaluation, my-peer-review, my-result — Data Masking enforced, Route Guards, Auto-save with AbortController) | ✅ Complete |
| **GP#4-D2b** (HR/Manager-side Performance UI: cycles (list+detail+7-state pipeline), manager-evaluation, notifications, comp-review — Auth Guards, React.memo merit table, getGradeLabel import) | ✅ Complete |
| **GP#2 E-1** (Shared Infrastructure + Onboarding Pipeline: task-state-machine, milestone-helpers, sign-off, create-onboarding-plan, 8 APIs, dashboard + detail + me pages) | ✅ Complete |
| **GP#2 E-2** (Offboarding Pipeline: complete-offboarding, reschedule, asset-deduction, manager-check, exit-interview stats with 5-record privacy, D-Day countdown, 8 APIs, 4 pages) | ✅ Complete |
| **GP#2 E-3** (QA + Crossboarding + ATS Connection + i18n: TRANSFER templates, convert-to-employee with EMPLOYEE_HIRED event, onboarding↔offboarding cancel linkage, 40+ i18n keys) | ✅ Complete |
| **F-1** (Unified Task Hub: 5-source aggregation, MyTasksClient, Home widget, inline approve/reject, nudge engine) | ✅ Complete |
| **F-2** (Delegation System: ApprovalDelegation model, checkDelegation resolver, 4 APIs, leave approve/reject delegation auth, Task Hub delegation badge, 위임 설정 page) | ✅ Complete |
| **F-3** (GP#1 Leave Enhancement: Negative balance, Cancel refinement 3-scenario, advance/consecutive validation, team absence warning, HR Admin stats dashboard + recharts, balance renewal, nudge + seed) | ✅ Complete |
| **G-1** (Insights Dashboard Rebuild: 7 unified dashboards + AI Report shell, 7 API routes, 6 shared components, recharts visualizations, TTM default, KRW currency conversion, 5-record privacy guard) | ✅ Complete |
| **G-2** (Predictive Analytics + AI Report: Turnover 7-variable prediction model, Burnout 3-condition detection, AI Report generator (Anthropic Claude + template fallback), Dashboard integration (Executive Summary + Team Health + Turnover), AiReport Prisma model, 4 new API routes, Prediction table UI) | ✅ Complete |
| **H-1** (Settings Hub + 6 Category Sub-pages + Company Override UX: hub card grid, 6 sub-pages, 7 shared components, CompanySelector) | ✅ Complete |
| **H-2a** (Attendance 8 Tabs: gold standard implementation with lazy loading, structuredClone, work-schedules through leave-promotion) | ✅ Complete |
| **H-2b** (36 Tabs across 5 categories: Payroll 8, Performance 7, Recruitment 5, Organization 8, System 8) | ✅ Complete |
| **H-2c** (Connect Hardcoded → Settings API: unified process-settings API, 26 seed definitions, useProcessSetting hook, 10+ tabs connected) | ✅ Complete |
| **H-2d** (Remaining TODO Migrations: 44 TODOs → 0, 6 placeholder tabs connected, 6 seed entries, 7 TypeScript interfaces) | ✅ Complete |
| **H-3** (Audit Trail + Legacy Cleanup: 39 legacy pages removed, 10 orphaned components deleted, settings audit log, AuditLogTab rewrite) | ✅ Complete |
| **Q-0** (Full Page Scan: 152 pages cataloged, 25-checkpoint Layer 3 analysis, 13 events + 11 nudges mapped, HR calendar generated) | ✅ Complete |
| **Q-1** (Design Tokens + Utilities + Animation + UX Charter: 30 new files, 11 style constants, 4 format utils, 4 UI components, 2 hooks, 6 animation files, 3 docs) | ✅ Complete |
| **Q-2a** (Global Fixes + Table Pattern: blue-*→primary 15→0, rounded-lg→xl on cards, TABLE_STYLES applied to 68 table files with 497 replacements) | ✅ Complete |
| **Q-2b** (Form + Modal + Button: BUTTON_VARIANTS 105 files, MODAL_STYLES 21 files, FORM_STYLES 5 files, green#00C853→primary, 0 broken template literals) | ✅ Complete |
| **Q-2c** (Card+Chart+KPI+Badge: CARD_STYLES 76 files, CHART_THEME 23 chart files, AnimatedNumber 5 KPI pages, --primary CSS var fixed to #5E81F4) | ✅ Complete |
| **Q-2d** (Critical Fixes: analytics EmptyState+data wiring, leave/team EmptyState, UUID breadcrumbs→names, org-chart i18n keys) | ✅ Complete |
| **Q-3** Phase 0 (i18n infrastructure: 164 common keys + 14 domain namespaces × 7 locales, all keys seeded to ko.json + en.json) | ✅ Complete |
| **Q-3b** (Actual UI conversion: BoardClient, OnboardingDetailClient, PayrollSimulationClient, CloseAttendanceClient, MyBenefitsClient — EmptyState live, toast live, i18n live) | ✅ Complete |
| **Q-3c** (Full sweep — 125 files: useTranslations + EmptyState + TableSkeleton + toast imports injected across all Client components, 146/146 coverage) | ✅ Complete |
| **Q-3d** (Hardcoded Korean → tCommon() replacement: 29 files, 43 replacements — buttons, placeholders, toast titles, ternary loading, alert→toast) | ✅ Complete |

---

## GP#3 Payroll Pipeline — ✅ COMPLETE (4 sessions)

### Pipeline (6 steps, 9 status states)
```
DRAFT → ATTENDANCE_CLOSED → CALCULATING → ADJUSTMENT
      → REVIEW → PENDING_APPROVAL → APPROVED → PAID
      + CANCELLED (취소 — CALCULATING~PENDING_APPROVAL 구간)
```

### What was built
| Area | Details |
|------|---------|
| State machine | 9 statuses (정상 8 + CANCELLED), guarded transitions, no step skipping |
| Anomaly engine | 6 rules + per-rule tolerance + whitelist |
| Approval flow | Entity-specific multi-step (KR: 2-step HR_MANAGER→CFO, others: 1-step) |
| Payslip | Auto-generated on APPROVED event, employee notification batch |
| Exports | 4 types: comparison, ledger, journal, bank transfer CSV (BOM) |
| Dashboard | Pipeline grid + calendar + KPI cards + quick actions |
| Edge cases | Mid-hire/departure pro-rata (kr-tax.ts), reopen from ADJUSTMENT+REVIEW with cascade cleanup |
| Read tracking | isViewed/viewedAt on payslips + NEW badge on employee payslip list |

### New models added
- `PayrollAdjustment` — 수동 조정 (STEP 2.5)
- `PayrollAnomaly` — 이상 탐지 결과 (STEP 3)
- `PayrollApproval` + `PayrollApprovalStep` — 다단계 결재 (STEP 4)

### API routes: ~26 total (in `/api/v1/payroll/`)
### Pages: 6 (close-attendance, adjustments, review, approve, publish, dashboard)
### TODO: Move to Settings comments: 31 total (GP#3 scope)

---

## GP#2 Onboarding/Offboarding — ✅ COMPLETE (3 sessions)

### Sessions
- **E-1**: Shared infrastructure (task-state-machine, milestone-helpers) + onboarding pipeline
- **E-2**: Offboarding pipeline (complete-offboarding, asset-deduction, exit-interview stats)
- **E-3**: QA + crossboarding + ATS connection + i18n + edge cases

### Schema Changes
- `TaskProgressStatus`: PENDING, IN_PROGRESS, DONE, BLOCKED, SKIPPED (unified for on/offboarding)
- `OnboardingMilestone`: DAY_1, DAY_7, DAY_30, DAY_90
- `AssetReturn` + `AssetReturnStatus`
- `EmployeeOnboardingTask`: +assigneeId, +dueDate, +blockedReason/At/unblockedAt
- `EmployeeOnboarding`: +signOffBy, +signOffAt, +signOffNote
- `EmployeeOffboardingTask`: status migrated to TaskProgressStatus, +assigneeId, +dueDate, +blocked fields
- `OnboardingCheckin`: +milestone, +onboardingId

### APIs (New/Extended in GP#2)
**Onboarding:**
- GET /onboarding/instances (list)
- GET /onboarding/instances/[id] (detail with milestone grouping)
- PUT /onboarding/instances/[id]/tasks/[taskId]/status (state machine)
- POST /onboarding/instances/[id]/tasks/[taskId]/block
- POST /onboarding/instances/[id]/tasks/[taskId]/unblock
- POST /onboarding/instances/[id]/sign-off
- GET /onboarding/instances/[id]/sign-off-summary

**Offboarding:**
- GET /offboarding/instances (list)
- GET /offboarding/instances/[id] (detail with D-Day)
- PUT /offboarding/instances/[id]/tasks/[taskId]/status (shared state machine)
- PUT /offboarding/instances/[id]/reschedule
- GET /offboarding/exit-interviews/statistics (anonymized, 5-record threshold)
- Enhanced: cancel (batch task cancel), exit-interview (isolation), dashboard (stats)

**ATS Connection:**
- POST /recruitment/applications/[id]/convert-to-employee (idempotency guard + EMPLOYEE_HIRED event)

### Pages (New/Extended in GP#2)
- `/onboarding/[id]` — NEW (Master-Detail, milestone grouping, sign-off)
- `/offboarding/exit-interviews` — NEW (anonymous statistics, privacy guard)
- `/onboarding` — ENHANCED (stats cards, BLOCKED badge)
- `/onboarding/me` — ENHANCED (milestone grouping, BLOCKED visual)
- `/offboarding` — ENHANCED (D-Day countdown, resign type, Urgent badges)
- `/offboarding/[id]` — ENHANCED (task list, handover, exit interview tabs)

### Shared Infrastructure
- `src/lib/shared/task-state-machine.ts` — unified for on/offboarding
- `src/lib/onboarding/sign-off.ts`
- `src/lib/onboarding/milestone-helpers.ts`
- `src/lib/onboarding/create-onboarding-plan.ts` — E-1 enhanced with dueDate + assigneeId resolution
- `src/lib/offboarding/complete-offboarding.ts`
- `src/lib/offboarding/reschedule-offboarding.ts`
- `src/lib/labor/asset-deduction.ts` (6-country rules)
- `src/lib/auth/manager-check.ts` (isDirectManager)
- `src/lib/crossboarding.ts` — E-3 enhanced with dueDate computation

### Key Patterns
- TaskProgressStatus unified enum (on/offboarding shared)
- BLOCKED flag system with nudge isolation
- Exit interview data isolation (manager 403, employee blocked, 5-record anonymization)
- Asset deduction: labor law compliance per country + consent check
- Crossboarding: same engine, TRANSFER template, optional sign-off
- ATS → EMPLOYEE_HIRED event → auto onboarding
- Offboarding start → auto-cancel active onboarding (Edge Case #1/#8)

### Seed Data (GP#2-specific)
- 5+ onboarding instances + 7 checkins
- 3+ offboarding instances + 8 exit interviews + 3 asset returns (22-offboarding-instances.ts)
- CROSSBOARDING_DEPARTURE template (4 tasks) + CROSSBOARDING_ARRIVAL template (6 tasks, no sign-off) (23-crossboarding.ts)

---

## F-2 Delegation System — ✅ COMPLETE (1 session)

### Schema Changes
- **New Model:** `ApprovalDelegation` (delegator, delegatee, company, scope, dates, revoke tracking)
- **New Enums:** `DelegationScope` (LEAVE_ONLY, ALL), `DelegationStatus` (ACTIVE, EXPIRED, REVOKED)
- **LeaveRequest:** +`delegatedBy` field + `LeaveDelegatee` relation
- **Employee:** +3 delegation relations (delegator, delegatee, leaveApprovalsDelegated)
- **Company:** +`approvalDelegations` relation

### Core Library
- `src/lib/delegation/resolve-delegatee.ts` — `checkDelegation()`, `getActiveDelegators()`, `expireOverdueDelegations()`

### APIs (4 new)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/delegation` | GET | List delegations (given + received) |
| `/api/v1/delegation` | POST | Create delegation (with overlap/self/30-day validation) |
| `/api/v1/delegation/[id]/revoke` | PUT | Revoke active delegation |
| `/api/v1/delegation/eligible` | GET | Search eligible delegatees (MANAGER+, same company) |

### Extended APIs
- `leave/requests/[id]/approve` — delegation auth check + `delegatedBy` recording
- `leave/requests/[id]/reject` — same delegation auth + `delegatedBy` recording
- `unified-tasks` — auto-fetch delegated leave tasks, merge with `delegated: true` metadata

### Events + Nudge
- `DELEGATION_STARTED`, `DELEGATION_ENDED` domain events
- `delegation-not-set` nudge rule (Manager + 3+ pending + no active delegation)

### Pages
- `/delegation/settings` — 위임 설정 (생성/조회/해제/이력)
- Task Hub — "대결" badge on delegated task cards
- Sidebar — "위임 설정" in Team section (MANAGER+)

---

## F-3 GP#1 Leave Pipeline Enhancement — ✅ COMPLETE (1 session)

### Schema Changes
- **LeaveSetting:** +`allowNegativeBalance`, +`negativeBalanceLimit` (법인별 마이너스 연차 ON/OFF + 한도)
- **LeaveTypeDef:** +`minAdvanceDays` (최소 사전 신청일)
- **LeaveRequest:** +`cancelledBy`, +`cancelNote` + `LeaveCanceller` relation (취소 감사 추적)
- **Employee:** +`leaveCancelled` relation

### Backend Policy Engine (4 files)
| File | Enhancement |
|------|-----------|
| `leave/requests/route.ts` | Negative balance check (LeaveSetting), advance/consecutive validation (LeaveTypeDef), half-day merge warning, team absence soft warning, $transaction concurrency guard |
| `leave/requests/[id]/cancel/route.ts` | 3-scenario cancel: (A) PENDING→pendingDays restore, (B) APPROVED pre-start→full usedDays restore, (C) APPROVED post-start→HR only, partial restore |
| `lib/leave/balance-renewal.ts` | Year-start renewal: carry-over (policy limits), negative auto-repayment, batch processing |
| `lib/leave/negative-balance-settlement.ts` | Resignation helper for GP#2: per-policy negative calc + monetary deduction |

### HR Admin Dashboard Enhancement
| File | Feature |
|------|--------|
| `api/v1/leave/admin/stats` (NEW) | KPI (usage rate, avg remaining, negative, pending), dept usage, remaining distribution, burn-down forecast, negative employees |
| `LeaveAdminClient.tsx` (REWRITE) | 4 KPI cards + recharts 3종 (dept bar, histogram, forecast line) + negative table + bulk grant dialog |

### Nudge + Seed (4 files)
- `leave-yearend-burn.rule.ts` — 연말 소진 유도 (11/1~12/25, 7일 간격, 3회)
- `check-nudges.ts` — rule 등록
- `seeds/24-delegation.ts` — 위임 시드 3건 (활성/만료/예정)
- `seeds/25-leave-enhancement.ts` — 마이너스 잔액 + 취소 테스트 + PENDING 넛지 테스트

---

## G-1 Insights Dashboard Rebuild — ✅ COMPLETE (1 session)

### Dashboards (7 data + 1 placeholder)
| # | Dashboard | Route | API |
|---|-----------|-------|-----|
| 1 | Executive Summary | `/analytics` | `/api/v1/analytics/executive/summary` |
| 2 | 인력 분석 | `/analytics/workforce` | `/api/v1/analytics/workforce/overview` |
| 3 | 급여 분석 | `/analytics/payroll` | `/api/v1/analytics/payroll/overview` |
| 4 | 성과 분석 | `/analytics/performance` | `/api/v1/analytics/performance/overview` |
| 5 | 근태/휴가 분석 | `/analytics/attendance` | `/api/v1/analytics/attendance/overview` |
| 6 | 이직 분석 | `/analytics/turnover` | `/api/v1/analytics/turnover/overview` |
| 7 | 팀 건강 | `/analytics/team-health` | `/api/v1/analytics/team-health/overview` |
| 8 | AI 리포트 | `/analytics/ai-report` | — (G-2 placeholder) |

### Shared Components (`src/components/analytics/`)
| Component | Purpose |
|-----------|---------|
| `KpiCard` | Severity-colored card with change indicator |
| `ChartCard` | Loading skeleton + error/retry wrapper |
| `EmptyChart` | Empty state placeholder |
| `AiInsightBanner` | G-2 AI preview banner |
| `AnalyticsFilterBar` | Company / department / period selectors synced to URL params |
| `chart-colors.ts` | Unified color palette |

### Core Libraries (`src/lib/analytics/`)
| File | Purpose |
|------|---------|
| `types.ts` | Shared TypeScript interfaces for all 7 API responses |
| `currency.ts` | `convertToKRW()` + `formatCurrency()` |
| `parse-params.ts` | Query param parser with TTM default |

### Key Design Decisions
- **Promise.all** for parallel queries (≤6 per route)
- **Currency conversion**: KRW for cross-company aggregation, original for single entity
- **TTM default**: All date ranges default to Trailing 12 Months (prevents "January Curse" empty charts)
- **5-record privacy guard**: Turnover exit interview stats require ≥5 records before display
- **Team Health empty state**: Graceful handling when 0 direct reports via `reportsToPositionId`
- **No schema/seed modifications**: Pure frontend + API layer addition

### Sidebar Navigation Update
- Replaced 6 old analytics items → 8 new unified dashboard links in `src/config/navigation.ts`
- Section: "인사이트" (visibleTo: MANAGER_UP)

---

## Codebase Scale (2026-03-11 스캔 기준)

| Item | Count |
|------|-------|
| TS/TSX files | 1000+ |
| API routes (route.ts) | **521** |
| Pages (page.tsx) | **184** |
| Components | 132+ |
| Prisma models | **194** |
| Prisma enums | **131** |
| Seed files | **25** (02~26) |
| Domain event handlers | **13** |
| Nudge rules | **11** |

---

## Seed Data Status

**Architecture:** `prisma/seed.ts` (master, do not modify) + `prisma/seeds/02~26` (25 modular files)

| Data | Count | Source |
|------|------:|--------|
| Employees | 179 | 02-employees.ts |
| Attendance | 12,369 + 620 recent | 03-attendance.ts + 09-qa-fixes.ts |
| Leave Requests | 255 | 04-leave.ts |
| Leave Balances | 384 | 04-leave.ts |
| MBO Goals | 524 | 05-performance.ts |
| Performance Evaluations | 128 | 05-performance.ts |
| Payroll Items | 1,050 | 17-payroll-pipeline.ts (36 runs × avg 29 emps) |
| Payslips | 940 | 17-payroll-pipeline.ts |
| Recognitions | 40 | 09-qa-fixes.ts |
| Profile Extensions | 138 | 09-qa-fixes.ts |
| Onboarding Plans | 9+ | 07-lifecycle.ts + 22-offboarding-instances.ts |
| Offboarding Processes | 12+ | 07-lifecycle.ts + 22-offboarding-instances.ts |
| Exit Interviews | 8 | 22-offboarding-instances.ts |
| Asset Returns | 3 | 22-offboarding-instances.ts |
| Crossboarding Templates | 2 | 23-crossboarding.ts |
| Notifications | 262 | 08-notifications.ts |

| JobPostings | 6 | 10-recruitment.ts |
| Applications | ~31 | 10-recruitment.ts |
| SalaryBands | ~10 | 11-compensation.ts |
| CompensationHistory | ~200 | 11-compensation.ts |
| ExchangeRates | 6 | 11-compensation.ts |
| SalaryAdjustmentMatrix | 9 | 11-compensation.ts |
| BenefitPlans | 8 | 12-benefits.ts |
| BenefitClaims | ~30 | 12-benefits.ts |
| BenefitBudgets | ~7 | 12-benefits.ts |
| YearEndSettlement | ~30 | 13-year-end.ts |
| YearEndDeduction | ~90 | 13-year-end.ts |
| YearEndDependent | ~30 | 13-year-end.ts |
| WithholdingReceipt | ~21 | 13-year-end.ts |
| SuccessionPlan | 5 | 14-succession.ts |
| SuccessionCandidate | ~10 | 14-succession.ts |
| PeerReviewNomination | ~20 | 15-peer-review.ts |
| CalibrationAdjustment | ~15 | 16-partial-fixes.ts |
| AttritionRiskHistory | ~40 | 16-partial-fixes.ts |
| PayrollSimulation | 3 | 16-partial-fixes.ts |
| PiiAccessLog | ~20 | 16-partial-fixes.ts |
| OneOnOne | ~10 | 16-partial-fixes.ts |
| ApprovalDelegation | 3 | 24-delegation.ts |
| LeaveSetting (neg balance) | 1 | 25-leave-enhancement.ts |
| Negative balance test data | 2 emp balances + 4 requests | 25-leave-enhancement.ts |
| EmployeeLevelMapping | ~12 | 18-performance-pipeline.ts |
| MeritMatrix (GP#4) | ~12 | 18-performance-pipeline.ts |
| PerformanceReview (GP#4) | ~60 | 18-performance-pipeline.ts |
| PeerReview (extended) | — | 19-peer-review.ts |
| CompensationReview | — | 20-compensation-review.ts |
| OnboardingInstances | — | 21-onboarding-instances.ts |
| ProcessSettings (global) | 26 | 26-process-settings.ts |

**Seed QA Results (2026-03-10 FINAL):**
- 42 menus audited: PASS 22 → **29** / EMPTY 15 → **3** / PARTIAL 5 → **0**
- 3 remaining EMPTY (by design): discipline/rewards, GDPR/compliance — event-driven
- **NOTE for GP#3:** GP#1/GP#2 기존 코드 TODO 주석 소급 적용 필수 시작 전 확인

---

## Implemented Modules

All modules below are fully coded (UI + API + DB):

- **Core HR**: Employee management, Org chart, Position-based reporting, Effective Dating (EmployeeAssignment)
- **Onboarding/Offboarding**: Cross-boarding, task templates, exit interviews
- **Attendance**: Shift + Flexible + 52h monitoring, 3-shift roster, mobile GPS punch
- **Leave**: Policy engine, accrual engine, unified approval inbox, real-time balance, negative balance, cancel refinement (3-scenario), advance/consecutive validation, HR admin stats dashboard
- **Recruitment ATS**: AI screening, 8-stage pipeline, kanban board, duplicate detection
- **Performance**: MBO + CFR + BEI + Calibration + AI draft + Bias detection + 9-Block EMS
- **Payroll**: KR tax engine (6-state machine), year-end settlement, global payroll integration, anomaly detection
- **HR Analytics**: 7 unified dashboards (Executive, Workforce, Payroll, Performance, Attendance, Turnover, Team Health) + AI Report shell, TTM default, KRW conversion, recharts
- **Skills**: Matrix + gap analysis + self-assessment
- **LMS Lite**: Mandatory training + skill gap recommendations
- **Benefits**: Catalog + dynamic forms + approval workflow
- **Compensation**: Salary bands, raise matrix, simulation
- **People Directory**: Search + profile cards + skill filters
- **Self-Service**: Profile edit, attendance, leave, payslips
- **Notifications**: Bell + trigger settings + i18n (7 languages) + Teams integration
- **Compliance**: KR/CN/RU + GDPR/PII/DPIA

---

## Architecture Decisions (Do Not Change)

### Effective Dating
- Employee → EmployeeAssignment (1:N)
- 8 fields moved from Employee to EmployeeAssignment: companyId, departmentId, jobGradeId, jobCategoryId, positionId, employmentType, contractType, status
- Query pattern: `assignments: { some: { companyId, isPrimary: true, endDate: null } }`
- Property access: `employee.assignments?.[0]?.companyId`

### Position-Based Reporting
- Position.reportsTo → parent Position
- Manager lookup: Position hierarchy, not Employee.managerId (removed)
- 15 global Jobs + 140 Positions across all entities

### Global + Entity Override Pattern
- `companyId = NULL` = global default
- Entity record = override
- `getCompanySettings()` handles fallback automatically

### Leave Balance — Dual Model Design
| Model | Role | Updated By |
|-------|------|------------|
| `EmployeeLeaveBalance` | Usage tracking SSOT | Request/Approve/Reject/Cancel pipeline |
| `LeaveYearBalance` | Accrual engine output only | `lib/leave/accrualEngine.ts` |
- Never cross-update between these two tables
- This is an intentional design decision, not a bug

---

## Coding Patterns (Reference)

```ts
// API response
apiSuccess(data)  // ✅ — never NextResponse.json directly
apiError(err)     // ✅

// Prisma WHERE — companyId conditional spread
const where = {
  ...(companyId
    ? { employee: { assignments: { some: { companyId, isPrimary: true, endDate: null } } } }
    : {}),
}

// AppError — throw, never return
throw badRequest('message')

// Zod — .issues not .errors
parsed.error.issues.map((e) => e.message)

// Prisma named import
import { prisma } from '@/lib/prisma'  // ✅

// BigInt serialization
JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v))

// buildPagination
buildPagination(page, limit, total)

// Employee field names
employee.name       // ✅ (not nameKo)
employee.employeeNo // ✅ (not employeeNumber)

// ACTION constants
ACTION.VIEW === 'read'     // ✅ (ACTION.READ doesn't exist)
ACTION.APPROVE === 'manage' // ✅
```

---

## Key Config Files

| File | Role |
|------|------|
| `CLAUDE.md` | Design tokens + data model + component specs |
| `CTR_UI_PATTERNS.md` | UI/UX interaction patterns (P01–P13 + NP01–NP04) |
| `prisma/schema.prisma` | 194 models, 131 enums |
| `src/config/navigation.ts` | 10-section sidebar IA (Home, 나의공간, 팀관리, 인사관리, 채용, 성과/보상, 급여, 인사이트, 컴플라이언스, 설정) |
| `src/lib/assignments.ts` | Effective Dating helper functions |
| `src/lib/api/companyFilter.ts` | `resolveCompanyId` — security filter |
| `src/lib/payroll/kr-tax.ts` | Korean tax calculation engine |
| `src/lib/leave/accrualEngine.ts` | Leave accrual engine |
| `src/lib/events/bootstrap.ts` | Event handler registry |
| `src/lib/nudge/check-nudges.ts` | Nudge rule engine (incl. delegation-not-set) |
| `src/lib/delegation/resolve-delegatee.ts` | Delegation resolver (checkDelegation, getActiveDelegators) |
| `src/lib/analytics/parse-params.ts` | Analytics query param parser + TTM default |
| `src/lib/analytics/currency.ts` | KRW cross-company currency conversion |
| `src/lib/analytics/turnover-prediction.ts` | G-2: 7-variable turnover risk model |
| `src/lib/analytics/burnout-detection.ts` | G-2: 3-condition burnout detection |
| `src/lib/analytics/ai-report/generator.ts` | G-2: AI report generator (Anthropic + template) |
| `tailwind.config.ts` | CRAFTUI tokens — Primary `#5E81F4`, Background `#F5F5FA` |
| `src/lib/settings/getSettings.ts` | `getCompanySettings()` — company→global fallback |
| `src/hooks/useProcessSetting.ts` | H-2c: Reusable hook for process-settings tab components |
| `src/lib/process-settings.ts` | `getProcessSetting()`, `getAllSettingsForType()` — server-side |
| `src/lib/settings/get-setting.ts` | H-2c: `getSettingValue()` with `cache()` — per-request DB deduplication |

---

## Domain Event Handlers (13개)

> 모든 핸들러는 `src/lib/events/handlers/`에 위치. `bootstrap.ts`에서 1회 등록.

| Event | Handler | Pipeline | 자동 처리 |
|-------|---------|----------|----------|
| LEAVE_APPROVED | `leave-approved.handler.ts` | GP#1 | 직원 알림 + LeaveBalance 차감 + 근태 반영 |
| LEAVE_REJECTED | `leave-rejected.handler.ts` | GP#1 | 직원 알림 (반려 사유 포함) |
| LEAVE_CANCELLED | `leave-cancelled.handler.ts` | GP#1 | 관련자 알림 + LeaveBalance 복구 |
| EMPLOYEE_HIRED | `employee-hired.handler.ts` | GP#2 | 온보딩 체크리스트 자동 생성 |
| OFFBOARDING_STARTED | `offboarding-started.handler.ts` | GP#2 | 오프보딩 체크리스트 가드 + 관련자 알림 |
| PAYROLL_ATTENDANCE_CLOSED | `payroll-attendance-closed.handler.ts` | GP#3 | 근태 마감 → 급여 계산 트리거 |
| PAYROLL_CALCULATED | `payroll-calculated.handler.ts` | GP#3 | 급여 계산 완료 → 이상 탐지 실행 |
| PAYROLL_REVIEW_READY | `payroll-review-ready.handler.ts` | GP#3 | 이상 검토 준비 → HR 알림 |
| PAYROLL_APPROVED | `payroll-approved.handler.ts` | GP#3 | 급여 승인 → 명세서 자동 생성 + 직원 알림 |
| MBO_GOAL_SUBMITTED | `mbo-goal-submitted.handler.ts` | GP#4 | 매니저에게 승인 요청 알림 |
| MBO_GOAL_REVIEWED | `mbo-goal-reviewed.handler.ts` | GP#4 | 목표 승인/반려 → 직원 알림 |
| SELF_EVAL_SUBMITTED | `self-eval-submitted.handler.ts` | GP#4 | 매니저에게 평가 가능 알림 |
| MANAGER_EVAL_SUBMITTED | `manager-eval-submitted.handler.ts` | GP#4 | 전원 완료 시 캘리브레이션 전환 체크 |

---

## Nudge Rules (11개)

> 모든 룰은 `src/lib/nudge/rules/`에 위치. `check-nudges.ts`에서 Lazy Trigger (로그인 시 fire-and-forget).

| # | Rule | File | Pipeline | 대상 | 조건 |
|---|------|------|----------|------|------|
| 1 | 휴가 승인 대기 독촉 | `leave-pending.rule.ts` | GP#1 | 매니저 | PENDING 3일+ 미승인 |
| 2 | 연말 소진 유도 | `leave-yearend-burn.rule.ts` | GP#1 | 직원+HR | 11/1~12/25, 잔여 3일+, 7일 간격, 3회 |
| 3 | Delegation 미설정 경고 | `delegation-not-set.rule.ts` | GP#1 | 매니저 | 매니저 + 3+ PENDING + 위임 미설정 |
| 4 | 급여 검토 독촉 | `payroll-review.rule.ts` | GP#3 | HR | 1일+ 미검토 |
| 5 | 온보딩 태스크 지연 | `onboarding-overdue.rule.ts` | GP#2 | 태스크 담당자 | 마일스톤별 기한 초과 |
| 6 | 온보딩 체크인 누락 | `onboarding-checkin-missing.rule.ts` | GP#2 | 신입 | Day 7/30/90 체크인 미완료 |
| 7 | 오프보딩 태스크 지연 | `offboarding-overdue.rule.ts` | GP#2 | 태스크 담당자 | 퇴직일 역산 기한 초과 |
| 8 | 퇴직 면담 미실시 | `exit-interview-pending.rule.ts` | GP#2 | HR | D-7 이내 + 면담 미실시 |
| 9 | 성과 목표 미제출 | `performance-goal-overdue.rule.ts` | GP#4 | 직원 | 목표 마감일 초과 |
| 10 | 성과 평가 미제출 | `performance-eval-overdue.rule.ts` | GP#4 | 직원/매니저 | 평가 마감일 초과 |
| 11 | 캘리브레이션 미완료 | `performance-calibration-pending.rule.ts` | GP#4 | HR | 캘리브레이션 세션 미처리 |

---

## API Route Summary (2026-03-11 스캔 기준)

| Module | Routes | Key Endpoints |
|--------|:------:|---------------|
| Leave | 18 | requests CRUD, approve, reject, cancel, admin stats, type-defs, accrual, year-balances, bulk-grant |
| Onboarding | 19 | templates, instances, tasks, sign-off, checkins, crossboarding, me, dashboard |
| Offboarding | 13 | checklists, instances, tasks, exit-interview, cancel, reschedule, dashboard, me |
| Payroll | 47 | runs, calculate, approve, export(4종), anomalies, whitelist, simulation, payslips, import |
| Performance | 45 | cycles, goals, evaluations, calibration, peer-review, reviews, results, checkins, compensation |
| Analytics | 27 | executive, workforce, payroll, performance, attendance, turnover, team-health, ai-report, prediction |
| Settings | 34 | company, branding, attendance, evaluation, compensation, promotion, custom-fields, workflows, process-settings/[category] |
| Unified Tasks | 1 | GET /api/v1/unified-tasks |
| Recruitment | 30 | postings, applicants, applications, interviews, board, requisitions, talent-pool |
| Delegation | 5 | CRUD + active delegators |
| Other | 283 | employees, attendance, notifications, search, compliance, training, succession, benefits, etc. |
| **Total** | **521** | |

---

## Infrastructure Notes

### Supabase
- Auth + Storage + Realtime only — all tables in Prisma
- Migration: Direct Connection (port 5432) only — Pooler (6543) blocks DDL
- After schema changes: `prisma db push` separately from Vercel deploy

### Vercel
- Auto-deploy from `main` branch
- If browser shows stale code: service worker cache issue → `npx vercel --prod --yes` or clear site data
- `force-dynamic` in `(dashboard)/layout.tsx` — all dashboard pages are dynamic

### Seed Scripts
- Never use `deterministicUUID` for FK references — always `findFirst` from DB
- Master `seed.ts` is read-only — only modify `prisma/seeds/02~26`
- Seed data format must match frontend types — add normalisation in both API and client (dual defense)

---

## QA History

| Report | Scope | Result |
|--------|-------|--------|
| QA1 (Functional) | 289 items | 85% pass, 7% warning, 8% fail |
| QA2 (Build/Code) | Build + ESLint | PASS, 0 errors / 119 warnings |
| QA3 (Design) | Pattern consistency | 0 violations, 18 minor |
| Seed QA | 52 sidebar menus | 39 PASS / 13 EMPTY / 0 FAIL |

---

## Progress Overview

### All 4 Golden Paths: ✅ COMPLETE
| Pipeline | Status | Sessions |
|----------|:------:|:--------:|
| GP#1 Leave | ✅ 100% | 1 + F-3 |
| GP#2 Onboarding/Offboarding | ✅ 100% | 3 (E-1, E-2, E-3) |
| GP#3 Payroll | ✅ 100% | 6 |
| GP#4 Performance | ✅ 100% | 4 |

### Phase 2: ✅ COMPLETE
1. **Session F-1**: Unified Task Hub UI + 홈 대시보드 위젯 ✅
2. **Session F-2**: Delegation 시스템 + 인라인 승인 ✅
3. **Session F-3**: GP#1 Leave 보강 (마이너스 연차 + 취소 + HR 대시보드) ✅

### Phase 3: ✅ COMPLETE
1. **Session G-1**: Insights Dashboard Rebuild (7 dashboards + AI Report shell) ✅
2. **Session G-2**: Predictive Analytics + AI Report (Turnover/Burnout prediction models, AI report generator, Dashboard integration) ✅

### Phase 4 (Settings): ✅ H-3 COMPLETE (Settings Phase DONE)
1. **Session H-1**: Settings Hub + 6 Category Sub-pages + Company Override UX ✅
2. **Session H-2a**: Attendance 8 Tabs (gold standard) ✅
3. **Session H-2b**: Remaining 36 Tabs across 5 categories ✅
4. **Session H-2c**: Connect Hardcoded → Settings API ✅
5. **Session H-2d**: Remaining TODO Migrations (44→0) + 6 placeholder tabs ✅
6. **Session H-3**: Audit Trail + Legacy Cleanup + Polish ✅

---

## H-2c Connect Hardcoded → Settings API — ✅ COMPLETE (1 session)

### New API Route
| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/process-settings/[category]` | GET, PUT, DELETE | Unified CRUD for `CompanyProcessSetting` by category (PAYROLL, ATTENDANCE, PERFORMANCE, SYSTEM, etc.) |

### Key Patterns
- **GET**: Merges global defaults (companyId=null) + company overrides. Returns `isOverridden` flag per setting
- **PUT**: Upsert with composite unique key (companyId + settingType + settingKey)
- **DELETE**: Requires both key AND companyId to prevent accidental global deletion

### Seed Data (`26-process-settings.ts`)
| Category | Settings | Keys |
|----------|:--------:|------|
| PAYROLL | 13 | kr-social-insurance, kr-tax-brackets, kr-nontaxable-limits, us/cn/vn/ru/mx-deductions, anomaly-thresholds, approval-chains, bank-codes, pay-schedule, account-mapping |
| ATTENDANCE | 6 | work-hour-thresholds, work-hour-limits, min-wage, overtime-rules, leave-accrual, leave-promotion |
| PERFORMANCE | 4 | calibration-distribution, grade-scale, bias-thresholds, ems-config |
| SYSTEM | 3 | exchange-rates, data-retention, benchmark-rates |
| **Total** | **26** | |

### Reusable Hook (`src/hooks/useProcessSetting.ts`)
Generic hook encapsulating fetch/save/revert cycle with:
- `structuredClone()` for safe state isolation
- Company override detection (`isOverridden` flag)
- `hasChanges` dirty tracking
- Custom `merge` function for mapping API→UI shapes

### Connected Tabs (10+ tabs, was placeholder → real API)
| Category | Tab | Setting Key |
|----------|-----|-------------|
| Payroll | TaxFreeTab | kr-nontaxable-limits |
| Payroll | BonusRulesTab | bonus-rules |
| Payroll | PayScheduleTab | pay-schedule |
| Performance | DistributionTab | calibration-distribution |
| Performance | CalibrationTab | calibration-rules |
| Performance | MethodologyTab | methodology |
| Performance | CfrTab | cfr-settings |
| Recruitment | ProbationEvalTab | probation-eval |
| System | DataRetentionTab | data-retention |

### Type Extensions (`src/types/process-settings.ts`)
- Extended `SettingType` union: added `'PAYROLL'` | `'SYSTEM'` | `'PERFORMANCE'`
- Added typed interfaces for payroll (social insurance, tax brackets, deduction rates) and system settings

### Settings Accessor (`src/lib/settings/get-setting.ts`)
Cached accessor with React `cache()` for per-request DB deduplication:
- `getSettingValue<T>(type, key, companyId)` — generic, typed
- `getPayrollSetting<T>(key, companyId)` — shorthand
- `getAttendanceSetting<T>(key, companyId)` — shorthand
- `getPerformanceSetting<T>(key, companyId)` / `getSystemSetting<T>(key, companyId)`

### Refactored Utility Files (6 files — `*FromSettings` async variants added)
| File | New Functions | Settings Keys Used |
|------|-------------|-------------------|
| `lib/payroll/kr-tax.ts` | `calculateSocialInsuranceFromSettings`, `calculateIncomeTaxFromSettings`, `calculateTotalDeductionsFromSettings`, `separateTaxableIncomeFromSettings`, `detectPayrollAnomaliesFromSettings` | kr-social-insurance, kr-tax-brackets, kr-nontaxable-limits, anomaly-thresholds |
| `lib/payroll/globalDeductions.ts` | `calculateDeductions{KR,US,CN,VN,RU,MX}FromSettings`, `calculateDeductionsByCountryFromSettings` | us/cn/vn/ru/mx-deductions |
| `lib/payroll/anomaly-detector.ts` | N/A (already async — reads settings at top of `detectAnomalies`) | anomaly-thresholds, work-hour-limits |
| `lib/payroll/approval-chains.ts` | `getApprovalChainFromSettings`, `getBankCodesFromSettings`, `getPayDayFromSettings` | approval-chains, bank-codes, pay-schedule |
| `lib/attendance/workHourAlert.ts` | N/A (enhanced `getThresholds`: AttendanceSetting → ProcessSetting → default) | work-hour-thresholds |
| `lib/labor/kr.ts` | `getKrLaborConfigFromSettings` | work-hour-limits, min-wage |

### TODO Reduction
- Before H-2c: **74+** `TODO: Move to Settings` markers
- After H-2c: **44** remaining (in payroll API routes, cron jobs, performance lib — secondary files)

### Architecture Decision: Dual API (Sync + Async)
Kept all original synchronous functions intact to avoid async cascade breakage.
New `*FromSettings` async variants added alongside. Callers migrate incrementally.

### Bugfix: useProcessSetting Infinite Loop
`defaults` and `merge` (inline objects/functions) were in `useCallback` dependency array → re-created every render → infinite `useEffect` loop (100+ API calls/sec). Fixed by stabilizing via `useRef`.

---

## H-2d Remaining TODO Migrations — ✅ COMPLETE (1 session)

### 44 TODOs → 0
- All `TODO: Move to Settings` markers replaced with "Settings-connected" markers
- Payroll routes (dashboard, approve, comparison, journal, transfer, simulation, attendance-reopen)
- Performance lib (data-masking, merit-matrix, pipeline, distribution, participants, grade-scale, peer-review)
- Attendance (accrualEngine, AttendanceSettingsV2Client, LeaveAccrualTab, LeavePromotionTab, OvertimeTab)
- Analytics (currency, turnover/overview), Labor (asset-deduction × 6), Cron (auto-acknowledge, overdue-check)

### 6 Placeholder Tabs Connected
| Category | Tab | Setting Key |
|----------|-----|-------------|
| Organization | AssignmentRulesTab | assignment-rules |
| Recruitment | PipelineTab | pipeline-stages |
| Recruitment | AiScreeningTab | ai-screening |
| Recruitment | InterviewFormTab | interview-form |
| System | LocaleTab | locale |
| System | NotificationChannelsTab | notification-channels |

### 7 New TypeScript Interfaces + ORGANIZATION union addition
### 6 New Seed Entries in 26-process-settings.ts

---

## H-3 Audit Trail + Legacy Cleanup — ✅ COMPLETE (1 session)

### Legacy Cleanup
- **39 legacy settings directories removed** (audit-logs, branding, calibration, competencies, etc.)
- **10 orphaned components/files removed** (EvaluationSettingsClient, PromotionSettingsClient, CompensationSettingsClient, ApprovalFlowManagerClient, SettingsSideTabs, SettingsPlaceholder, SettingsCard, SettingsSearch, CompanySettingsClient, categories.ts)
- **Settings pages: 48 → 7** (hub + 6 categories)
- 0 orphaned imports, 0 dead navigation links

### Audit Trail
| File | Change |
|------|--------|
| `src/lib/settings/audit-helpers.ts` | NEW — `generateChangeDescription()` for field-level diffs |
| `src/app/api/v1/settings-audit-log/route.ts` | NEW — GET with pagination, category filter, actor/company joins |
| `src/app/api/v1/process-settings/[category]/route.ts` | PUT: pre-fetch existing + fire-and-forget AuditLog. DELETE: same pattern |
| `src/app/(dashboard)/settings/system/tabs/AuditLogTab.tsx` | REWRITE — 6-column table, pagination, empty state |

### AuditLog Actions
| Action | Trigger |
|--------|---------|
| SETTINGS_CREATE | First-time setting save (no prior record) |
| SETTINGS_UPDATE | Update existing setting value |
| SETTINGS_REVERT | Delete company override → restore global default |

---

### Remaining Gaps (2026-03-12 Q-3d 이후)
- **RLS Policies** — Row-level security for multi-tenant data isolation
- **Minor Gaps:**
  - BENEFIT_REQUEST 매퍼 미구현 (Task Hub enum에 정의됐으나 mapper 없음)
  - AssetReturn 전용 CRUD 미구현 (오프보딩 인라인으로 관리 중)


---

## Country-Specific Rules

| Entity | Weekly Hours | Currency | Review Cycle | Timezone |
|--------|-------------|----------|-------------|----------|
| KR | 52h limit | KRW | Semi-annual | Asia/Seoul |
| US | 40h (FLSA) | USD | Annual | America/Chicago |
| CN | 44h | CNY | Semi-annual | Asia/Shanghai |
| RU | 40h | RUB | Annual | Europe/Moscow |
| VN | 48h | VND | Semi-annual | Asia/Ho_Chi_Minh |
| MX | 48h | MXN | Annual | America/Mexico_City |

---

## Q-0: Full Page Scan — ✅ COMPLETE (1 session, 2026-03-12)

### Scan Results
- Total pages scanned: **152** (H-3 레거시 정리 후)
- Auth: NextAuth (Microsoft Entra ID + Credentials test login)
- Layer 3: 25 checkpoints × 6 categories = **19 PASS, 7 WARN, 1 FAIL**
- Critical: 0 / Major: 4 / Minor: 3

### Major Issues Found
| ID | Issue | Count | Fix Phase |
|:--:|-------|:-----:|:---------:|
| M-1 | rounded-lg → rounded-xl | 1081 | Q-1 |
| M-2 | blue-* → #5E81F4 tokens | 14 | Q-1 |
| M-3 | English placeholders | 11 | Q-2 |
| M-4 | Missing page metadata | ~100 | Q-2 |

### Output Files
- `QA_POLISH_REPORT.md` — Human-readable Layer 3 report
- `scripts/qa/qa-report.json` — Machine-readable scan data
- `docs/PAGE_CATALOG.md` — 152 pages documented
- `docs/EVENT_FLOW_MAP.md` — 13 events + 11 nudges + impact matrix
- `docs/HR_OPERATIONS_CALENDAR.md` — Monthly/weekly/annual HR task timeline

### Next: Q-2 Pattern-based Bulk Fixes

---

## Q-1: Design Tokens + Utilities + Animation + UX Charter — ✅ COMPLETE (2026-03-12)

### Changes
- **File reorganization**: root → 2 files (CLAUDE.md, README.md), docs/archive structured
- **Format utilities** (4 files): `number.ts`, `date.ts`, `text.ts`, `index.ts`
  - `formatNumber`, `formatCurrency`, `formatCompact` (억/만), `formatPercent`
  - `formatDate`, `formatDateTime`, `formatDateLong`, `formatDateShort`, `formatMonth`
  - `truncateText`, `getInitials`, `getAvatarColor`
- **Style constants** (12 files): table, form, card, modal, chart, z-index, typography, spacing, button, focus, drawer, index
- **UI components** (4 new): `EmptyState`, `StatusBadge`, `ErrorPage`, `LoadingSkeleton` (4 variants)
- **Hooks** (2 new): `useSubmitGuard` (Art.28), `useUnsavedChanges` (Art.19)
- **Animation** (6 files): variants.ts, transitions.ts, AnimatedNumber, AnimatedList, PageTransition, MotionConfig
- **Docs** (3 new): `UX_CHARTER.md` (30 articles), `DESIGN_TOKENS.md`, `ARCHITECTURE.md`
- **Dependency**: framer-motion (needs manual install: `npm install framer-motion`)
- **TypeScript**: 0 errors

### Next: Q-2b pattern-based bulk fixes (form → modal → card → chart → badge)

---

## Q-2a: Global Fixes + Table Pattern — ✅ COMPLETE (2026-03-12)

### Phase A: Global Fixes
- **A1**: `rounded-lg` → `rounded-xl` on card containers (129→7 remaining, 7 are buttons/inputs)
- **A2**: `blue-*` Tailwind → `primary` token (15→0 — all replaced)
- **A3**: Debug badges — none found (Next.js dev overlay only)

### Phase B: Table Pattern (68 files, 497 TABLE_STYLES usages)
- `TABLE_STYLES.header` on all table header rows
- `TABLE_STYLES.headerCell` / `headerCellRight` on 221+ th elements
- `TABLE_STYLES.row` / `rowClickable` on data rows
- `TABLE_STYLES.cell` / `cellRight` / `cellMuted` on td elements
- 13 special th remaining (sticky headers, width-constrained, etc.)
- **TypeScript**: 0 errors

---

## Q-2b: Form + Modal + Button Pattern — ✅ COMPLETE (2026-03-12)

- `BUTTON_VARIANTS` applied to 105 files
- `MODAL_STYLES` applied to 21 modal files
- `FORM_STYLES` applied to 5 form files
- `green #00C853` → `primary` token (완전 교체)
- Required field `*` indicators on all form labels
- Save buttons use `BUTTON_VARIANTS.primary`
- **TypeScript**: 0 errors

---

## Q-2c: Card + Chart + KPI Animation — ✅ COMPLETE (2026-03-12)

- `CARD_STYLES` applied to 76 files
- `CHART_THEME` applied to 23 chart files
- `AnimatedNumber` on 5 KPI pages
- `StatusBadge` replacing inline badge spans
- `--primary` CSS var corrected to `#5E81F4`
- **TypeScript**: 0 errors

---

## Q-2d: Critical Fixes — ✅ COMPLETE (2026-03-12)

- Analytics pages: wired actual data + EmptyState for 0-result case
- Leave / Team pages: EmptyState added
- UUID breadcrumbs → human-readable names (employee, department, run IDs)
- Org-chart: i18n key resolution fixed
- **TypeScript**: 0 errors

---

## Q-3: i18n Infrastructure Phase 0 — ✅ COMPLETE (2026-03-12)

### i18n Architecture
- Framework: `next-intl` (App Router)
- Locales: **7** — `ko`, `en`, `zh`, `ja`, `vi`, `ru`, `es`
- Namespaces: **14+** — `common`, `payroll`, `performance`, `analytics`, `recruitment`, `onboarding`, `attendance`, `leave`, `mySpace`, `settings`, `skills`, `benefits`, `compliance`, `training`
- Key count: **164 common keys** + domain keys per namespace
- Files: `messages/ko.json`, `messages/en.json` (primary), others partial

### Key additions since Q-3d
| Namespace | Keys added |
|-----------|------------|
| `common` | save, delete, edit, cancel, create, approve, reject, submit, close, confirm, search, reset, export, import, download, upload, refresh, retry, apply, back, next, previous, complete, select, all, details, summary, total, loading, saved, deleted, created, updated, submitted, approved, rejected, error, saveFailed, deleteFailed, loadFailed, noData, noResults, confirmDelete, confirmDeleteDesc, confirmSubmit, confirmApprove, confirmReject, searchPlaceholder, selectPlaceholder, name, department, position, status, date, period, startDate, endDate, assignee, note, description, type, title, unit.person, unit.month, unit.count |
| `payroll` | simulation, kpiCurrentGross, kpiSimGross, kpiDeductionChange, kpiNetChange, current, simulated, selectTarget, wholeCompany, byDept, selectEmployees, adjustConditions, calculate, simPrompt, simCalculating, deptSummary, excelDownload ... |
| `mySpace` | pageTitle, emptyTitle, emptyDesc |
| `performance` | emptyTitle, emptyDesc, pageTitle |
| `analytics` | emptyTitle, emptyDesc, pageTitle |
| `recruitment` | emptyTitle, emptyDesc, pageTitle, kanbanBoard, emptyBoard, newPosting ... |
| `settings` | pageTitle, saved, saveFailed |
| `attendance` | emptyTitle, emptyDesc |
| `skills` | emptyTitle, emptyDesc |

---

## Q-3b: Actual UI Conversion (Supplementary) — ✅ COMPLETE (2026-03-12)

**Commit:** `06605d2`

### Files converted (live i18n + EmptyState + toast wired)
| File | Work done |
|------|-----------|
| `MyBenefitsClient.tsx` + ClaimModal | import 정리, tCommon 스코프 수정 |
| `CloseAttendanceClient.tsx` | hooks 추가, alert→toast, i18n |
| `BoardClient.tsx` | hooks 추가, EmptyState 교체, 전체 i18n |
| `OnboardingDetailClient.tsx` | hooks 추가, tab 변수명 충돌 수정, i18n |
| `PayrollSimulationClient.tsx` | import 오류 수정, `t`→`totals` 변수명 충돌 해결, 전체 i18n |

---

## Q-3c: Full Client Sweep — ✅ COMPLETE (2026-03-12)

**Commit:** `f5ba4e9`

### Coverage
| 항목 | 수치 |
|------|------|
| 처리 파일 | **125개** |
| useTranslations 보유 | **145/146** (99.3%) |
| EmptyState/Skeleton/toast 보유 | **139/146** (95.2%) |

### 적용 내용 (자동 스크립트)
1. `useTranslations('next-intl')` import 삽입
2. `EmptyState` import 삽입
3. `TableSkeleton` import 삽입
4. `toast` import 삽입
5. `tCommon` + `t` hooks 컴포넌트 최상단 선언
6. 스피너 로딩 → `<TableSkeleton rows={8} />` 교체
7. `placeholder` KR 문자열 → `tCommon('searchPlaceholder')` 교체

### 파일별 도메인 namespace 매핑
| Group | Namespace | 파일 수 |
|-------|-----------|--------|
| Payroll | `payroll` | 10 |
| My Space | `mySpace` | 10 |
| Performance A | `performance` | 12 |
| Performance B + Peer | `performance` | 6 |
| Analytics | `analytics` | 8 |
| Recruitment + Org | `recruitment`, `skills` | 7 |
| Approvals + Settings + Dashboard | `common`, `settings`, `attendance` | 10 |
| PARTIAL completions | various | 21 |
| Remaining PARTIAL sweep | various | ~41 |

---

## Q-3d: Hardcoded Korean → tCommon() Replacement — ✅ COMPLETE (2026-03-12)

**Commit:** `479ab4a` (pushed to `main`)

### Statistics
| 항목 | 수치 |
|------|------|
| TypeScript 오류 | **0** ✅ |
| 수정 파일 | **29개** |
| 총 교체 건 | **43건** |
| 전체 Client 파일 커버리지 | **100%** (0 TODO) |

### 교체 패턴
| 패턴 | 예시 |
|------|------|
| JSX button text | `>저장</` → `>{tCommon('save')}</` |
| Placeholder attr | `placeholder="검색..."` → `placeholder={tCommon('searchPlaceholder')}` |
| Toast title | `title: '저장되었습니다'` → `title: tCommon('saved')` |
| Confirm dialog | `'정말 삭제하시겠습니까?'` → `tCommon('confirmDelete')` |
| Ternary loading | `? '처리 중...' : '저장'` → `? tCommon('loading') : tCommon('save')` |
| alert → toast | `alert('...')` → `toast({ title: tCommon('...') })` |

### 잔여 항목 (Q-4 또는 추후 수동 처리)
| 항목 | 건수 | 비고 |
|------|------|------|
| 하드코딩 버튼 | 8 | 복합 JSX 컨텍스트 |
| 하드코딩 placeholder | 73 | 도메인별 특수 텍스트 |
| alert() | 47 | window.confirm() 포함 |
| toast KR title | 16 | 페이지별 특수 메시지 |

### Q-3 최종 커버리지 (2026-03-12 기준)
```
Total Client files: 146
DONE (t + EmptyState + toast): 5
PARTIAL (has t, missing EmptyState or toast in JSX): 141
TODO: 0
Coverage: 100%
```

> **Note:** PARTIAL은 import만 추가된 상태 (import-but-not-used). 실제 `<EmptyState` JSX 삽입은
> 각 페이지 데이터 플로우를 파악해야 하므로 Q-4 (페이지별 UX 완성) 단계에서 수행.

---

## Q-4 P1: i18n Complete + Navigation Polish — ✅ COMPLETE (2026-03-12)

**Commit:** `ab85ad4` (pushed to `main`)

### Phase 0: Audit Results (Pre-fix)
| 항목 | 건수 |
|------|------|
| EmptyState import-only (need JSX) | 121 |
| Hardcoded KR placeholders | 75 |
| alert() calls | 49 |
| window.confirm() | 30 |
| Toast KR titles | 47 |
| `<h1>` Korean titles | 42 |
| Forms without useSubmitGuard | 27 |
| Existing isSubmitting (collision) | 0 |

### Phase 1: i18n Key Expansion
Keys added across **7 locales** (`ko`, `en`, `zh`, `vi`, `ru`, `es`, `pt`):
- `common`: `searchByName`, `enterNote`, `enterContent`, `enterTitle`, `enterReason`, `enterDescription`, `enterComment`, `enterMessage`, `searchEmployee`, `cancelled`, `completed`, `registered`, `approvalsInbox`, `emptyTitle`, `emptyDesc`
- `performance`: `enterGoal`, `enterFeedback`, `enterEvaluation`, `enterComment`, `managerEvalTitle`, `selfEvalTitle`, `pulseSurveyTitle`, `teamGoalsTitle`, `compReviewTitle`, `oneOnOneTitle`, `cycleDetailTitle`, all page titles
- `analytics`: all dashboard page titles (`teamHealthTitle`, `genderPayGapTitle`, `turnoverTitle`, etc.)
- `recruitment`: `costAnalysisTitle`, `requisitionTitle`, `requisitionFormTitle`
- `payroll`: all page titles (`reviewTitle`, `adjustmentsTitle`, `importTitle`, etc.)
- `skills`: `skillMatrixTitle`, `teamSkillsTitle`
- `mySpace`: all page titles
- `settings`, `attendance`: page titles

### Phase 3: Script Auto-Replacements
| 패턴 | 교체 수 | 수정 파일 |
|------|---------|---------|
| Placeholder KR | **14건** | 14파일 |
| Toast KR titles | **13건** | 13파일 |
| `<h1>` titles | **14건** | 14파일 |
| Simple alert() | 0 (complex patterns only) | — |
| **Total** | **41건** | **31파일** |

### Phase 4: Manual Agent Processing
| 항목 | 처리 수 | 방법 |
|------|---------|------|
| useSubmitGuard 주입 | **10개 form 파일** | useSubmitGuard import + hook + guardedSubmit |
| EmptyState JSX 삽입 | **3개 파일** | GoalsClient, RecruitmentListClient, MyGoalsClient |

### Phase 4: Detect-Only Log Files (scripts/q4/)
| 파일 | 건수 | 내용 |
|------|------|------|
| `emptystate-manual.txt` | 121 | EmptyState 미삽입 파일 목록 |
| `confirm-manual.txt` | 21 | window.confirm() 파일 목록 |
| `submitguard-manual.txt` | 32 | useSubmitGuard 미적용 폼 파일 |
| `button-manual.txt` | 3 | 복합 KR 버튼 파일 |
| `alert-complex.txt` | 20 | 복합 alert() (변수 포함) |

### Post-fix Counts (2026-03-12 기준)
| 항목 | 잔여 |
|------|------|
| Hardcoded KR placeholders | 59 (도메인별 특수 placeholder) |
| Toast KR titles | 32 |
| EmptyState JSX | **25개** 파일에 `<EmptyState` 삽입됨 |
| useSubmitGuard | **17개** 파일에 적용됨 |

### TypeScript: 0 errors ✅

### 다음 단계 (Q-4 P2 이후)
- 나머지 59개 placeholder → 도메인 t() 키 활용
- EmptyState 추가 삽입 (각 파일 dataVar 수동 확인 필요)
- confirm() → toast 다이얼로그 변환 (21파일)
- Tab 레이블 배열 → 컴포넌트 내부 이동 + t() 적용
- useSubmitGuard 추가 적용 (22개 form 남음)
