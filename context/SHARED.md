# SHARED.md — Project State (Single Source of Truth)

> **Last Updated:** 2026-03-10 (GP#3-B + GP#3-C — Payroll Anomaly Review + Approval Flow + Payslip + Transfer CSV)
> **Project Path:** `/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub`

---

## Current State

- `npx tsc --noEmit` = 0 errors ✅ (12 pre-existing: sidebar counts type + seed BigInt)
- `npm run build` = pass ✅
- `export const dynamic = 'force-dynamic'` in `(dashboard)/layout.tsx` — covers all 129 dashboard pages
- Git commits: 70+
- Deployed on Vercel (auto-deploy from `main` branch)

---

## Completion Summary

| Phase | Status |
|-------|--------|
| STEP 0–9 (all modules) | ✅ Complete |
| Design Refactoring R1–R9 | ✅ Complete |
| Master Plan v2.0 Phase A (Architecture) | ✅ Complete |
| Master Plan v2.0 Phase B (B1–B11 Features) | ✅ Complete |
| Master Plan v2.0 Phase C (UX Refactoring C1–C3) | ✅ Complete |
| FIX-1 (Security) + FIX-2 (Performance) | ✅ Complete |
| Phase 0 (Timezone Integrity) | ✅ Complete |
| Golden Path #1 (Leave Pipeline) | ✅ Complete |
| Golden Path v3.0 (Nudge + Onboarding + Offboarding + Performance) | ✅ Complete |
| CRAFTUI Phase 1–3 | ✅ Complete |
| Seed Data Expansion (4 sessions + QA fixes) | ✅ Complete |
| Seed QA (52-menu audit) | ✅ Complete |
| Sidebar IA Redesign (7→10 sections) | ✅ Complete |
| Header Enhancements (Part 3/5: Quick Actions + Directory) | ✅ Complete |
| Command Palette Enhancement (Part 4/5: Employee search + Recent pages) | ✅ Complete |
| Seed QA Session A (Recruitment + Compensation + Benefits — seeds 10~12) | ✅ Complete |
| Seed QA Session B (Year-End + Succession + Peer Review + Partial — seeds 13~16) | ✅ Complete |
| GP#3-A (Attendance Closing + State Machine + Auto Calculation + Manual Adjustments) | ✅ Complete |
| GP#3-B (Anomaly Review UI + Whitelist + MoM Comparison + Excel Downloads) | ✅ Complete |
| GP#3-C (Approval Flow + Payslip Generation + Notifications + Bank Transfer CSV) | ✅ Complete |

---

## Codebase Scale

| Item | Count |
|------|-------|
| TS/TSX files | 894+ |
| API routes (route.ts) | 294+ |
| Pages (page.tsx) | 115+ (166 including sub-routes) |
| Components | 120+ |
| Prisma models | 89+ |
| Prisma enums | 70 |

---

## Seed Data Status

**Architecture:** `prisma/seed.ts` (master, do not modify) + `prisma/seeds/02~09` (modular)

| Data | Count | Source |
|------|------:|--------|
| Employees | 138 | 02-employees.ts |
| Attendance | 12,369 + 620 recent | 03-attendance.ts + 09-qa-fixes.ts |
| Leave Requests | 255 | 04-leave.ts |
| Leave Balances | 384 | 04-leave.ts |
| MBO Goals | 524 | 05-performance.ts |
| Performance Evaluations | 128 | 05-performance.ts |
| Payroll Items | 459 | 06-payroll.ts |
| Payslips | 459 | 09-qa-fixes.ts |
| Recognitions | 40 | 09-qa-fixes.ts |
| Profile Extensions | 138 | 09-qa-fixes.ts |
| Onboarding Plans | 4 | 07-lifecycle.ts |
| Offboarding Processes | 2 | 07-lifecycle.ts |
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
- **Leave**: Policy engine, accrual engine, unified approval inbox, real-time balance
- **Recruitment ATS**: AI screening, 8-stage pipeline, kanban board, duplicate detection
- **Performance**: MBO + CFR + BEI + Calibration + AI draft + Bias detection + 9-Block EMS
- **Payroll**: KR tax engine (6-state machine), year-end settlement, global payroll integration, anomaly detection
- **HR Analytics**: Turnover prediction, burnout detection, team health, KPI dashboard
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
| `prisma/schema.prisma` | 89+ models, 70 enums |
| `src/config/navigation.ts` | 10-section sidebar IA (People→Hire→Develop→Perform→Reward→Analyze) |
| `src/lib/assignments.ts` | Effective Dating helper functions |
| `src/lib/api/companyFilter.ts` | `resolveCompanyId` — security filter |
| `src/lib/payroll/kr-tax.ts` | Korean tax calculation engine |
| `src/lib/leave/accrualEngine.ts` | Leave accrual engine |
| `src/lib/events/bootstrap.ts` | Event handler registry |
| `src/lib/nudge/check-nudges.ts` | Nudge rule engine |
| `tailwind.config.ts` | CRAFTUI tokens — Primary `#5E81F4`, Background `#F5F5FA` |

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
- Master `seed.ts` is read-only — only modify `prisma/seeds/02~09`
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

## Next Tasks

1. **GP#3-D** — Integrated payroll dashboard + calendar view + edge cases + final polish
2. **Excel/CSV Export total: 4 types** — comparison, ledger, journal, bank transfer (✅ all done)
3. **Payroll Pipeline STEP 1~5 status:**
   - STEP 1: Attendance Closing ✅
   - STEP 2: Auto-Calculation ✅
   - STEP 2.5: Manual Adjustments ✅
   - STEP 3: Anomaly Review ✅
   - STEP 4: Approval Flow (multi-step, entity-specific) ✅
   - STEP 5: Payslip Generation + Notifications + Bank Transfer CSV ✅
4. **Settings Page** — Currently empty shell, needs actual settings UI
5. **RLS Policies** — Row-level security for multi-tenant data isolation

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
