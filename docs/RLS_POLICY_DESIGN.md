# RLS Policy Design — CTR HR Hub

> **Created:** 2026-03-12 (Q-4 P6)
> **Status:** Design — implementation deferred to Q-5
> **Database:** Supabase PostgreSQL
> **ORM:** Prisma 6.x (generates tables; RLS policies applied via raw SQL migrations)
> **Total Models:** 194

---

## Overview

Currently, multi-tenant data isolation relies on `resolveCompanyId()` at the application layer (`src/lib/api/companyFilter.ts`). If any API route forgets the `companyId` filter, data from other companies leaks.

**RLS enforces isolation at the database level** — even if application code has a bug, PostgreSQL itself refuses to return other tenants' data.

### Architecture

```
┌─────────────────────────────────────────┐
│  Next.js API Route                      │
│  ┌───────────────────────────────────┐  │
│  │ resolveCompanyId() ← app-level   │  │  ← Defense Layer 1 (current)
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Prisma Client Extension           │  │
│  │ SET LOCAL app.current_company_id  │  │  ← Defense Layer 2 (RLS)
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ PostgreSQL RLS Policy             │  │  ← Database-level enforcement
│  │ WHERE companyId = current_setting │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## Model Classification

### Category A: Direct Tenant (has `companyId` column) — 115 models

These models have a direct `companyId` foreign key. RLS policy is straightforward.

| # | Model | Sensitivity | Priority |
|---|-------|:---:|:---:|
| 1 | EmployeeAssignment | 🔴 High | P0 |
| 2 | PayrollRun | 🔴 High | P0 |
| 3 | Payslip | 🔴 High | P0 |
| 4 | EmployeePayItem | 🔴 High | P0 |
| 5 | CompensationHistory | 🔴 High | P0 |
| 6 | SalaryBand | 🔴 High | P0 |
| 7 | SalaryAdjustmentMatrix | 🔴 High | P0 |
| 8 | PerformanceCycle | 🟡 Med | P1 |
| 9 | PerformanceEvaluation | 🟡 Med | P1 |
| 10 | PerformanceReview | 🟡 Med | P1 |
| 11 | MboGoal | 🟡 Med | P1 |
| 12 | CalibrationSession | 🟡 Med | P1 |
| 13 | CalibrationRule | 🟡 Med | P1 |
| 14 | PulseSurvey | 🟡 Med | P1 |
| 15 | PulseResponse | 🟡 Med | P1 |
| 16 | LeaveRequest | 🟡 Med | P2 |
| 17 | LeavePolicy | 🟡 Med | P2 |
| 18 | LeaveSetting | 🟡 Med | P2 |
| 19 | LeaveTypeDef | 🟡 Med | P2 |
| 20 | Attendance | 🟡 Med | P2 |
| 21 | AttendanceSetting | 🟡 Med | P2 |
| 22 | AttendanceApprovalRequest | 🟡 Med | P2 |
| 23 | BenefitPlan | 🟡 Med | P3 |
| 24 | BenefitPolicy | 🟡 Med | P3 |
| 25 | BenefitBudget | 🟡 Med | P3 |
| 26 | DisciplinaryAction | 🟡 Med | P3 |
| 27 | RewardRecord | 🟡 Med | P3 |
| 28 | Department | 🟢 Low | P4 |
| 29 | Position | 🟢 Low | P4 |
| 30 | Job | 🟢 Low | P4 |
| 31 | JobCategory | 🟢 Low | P4 |
| 32 | JobGrade | 🟢 Low | P4 |
| 33 | JobPosting | 🟢 Low | P4 |
| 34 | Requisition | 🟢 Low | P4 |
| 35 | RecruitmentCost | 🟢 Low | P4 |
| 36 | TrainingCourse | 🟢 Low | P4 |
| 37 | MandatoryTraining | 🟢 Low | P4 |
| 38 | MandatoryTrainingConfig | 🟢 Low | P4 |
| 39 | OnboardingTemplate | 🟢 Low | P4 |
| 40 | OffboardingChecklist | 🟢 Low | P4 |
| 41 | SuccessionPlan | 🟢 Low | P4 |
| 42 | Holiday | 🟢 Low | P4 |
| 43 | ShiftPattern | 🟢 Low | P4 |
| 44 | ShiftGroup | 🟢 Low | P4 |
| 45 | ShiftSchedule | 🟢 Low | P4 |
| 46 | WorkSchedule | 🟢 Low | P4 |
| 47 | CustomField | 🟢 Low | P4 |
| 48 | EmailTemplate | 🟢 Low | P4 |
| 49 | ExportTemplate | 🟢 Low | P4 |
| 50 | AnalyticsConfig | 🟢 Low | P4 |
| 51 | AnalyticsSnapshot | 🟢 Low | P4 |
| 52 | OrgSnapshot | 🟢 Low | P4 |
| 53 | OrgRestructurePlan | 🟢 Low | P4 |
| 54 | OrgChangeHistory | 🟢 Low | P4 |
| 55 | TenantSetting | 🟢 Low | P4 |
| 56 | TenantEnumOption | 🟢 Low | P4 |
| 57 | CompanyProcessSetting | 🟢 Low | P4 |
| 58 | ApprovalFlow | 🟢 Low | P4 |
| 59 | ApprovalDelegation | 🟢 Low | P4 |
| 60 | WorkflowRule | 🟢 Low | P4 |
| 61 | NotificationTrigger | 🟢 Low | P4 |
| 62 | PayAllowanceType | 🟢 Low | P4 |
| 63 | PayDeductionType | 🟢 Low | P4 |
| 64 | PayrollImportMapping | 🟢 Low | P4 |
| 65 | PayrollImportLog | 🟢 Low | P4 |
| 66 | BankTransferBatch | 🟢 Low | P4 |
| 67 | TaxBracket | 🟢 Low | P4 |
| 68 | SocialInsuranceConfig | 🟢 Low | P4 |
| 69 | CompensationSetting | 🟢 Low | P4 |
| 70 | CompetencyLibrary | 🟢 Low | P4 |
| 71 | CompetencyRequirement | 🟢 Low | P4 |
| 72 | EmployeeLevelMapping | 🟢 Low | P4 |
| 73 | EvaluationSetting | 🟢 Low | P4 |
| 74 | PromotionSetting | 🟢 Low | P4 |
| 75 | OnboardingSetting | 🟢 Low | P4 |
| 76 | AttendanceTerminal | 🟢 Low | P4 |
| 77 | EmsBlockConfig | 🟢 Low | P4 |
| 78 | DataRetentionPolicy | 🟢 Low | P4 |
| 79 | DpiaRecord | 🟢 Low | P4 |
| 80 | GdprConsent | 🟢 Low | P4 |
| 81 | GdprRequest | 🟢 Low | P4 |
| 82 | KedoDocument | 🟢 Low | P4 |
| 83 | MilitaryRegistration | 🟢 Low | P4 |
| 84 | WorkPermit | 🟢 Low | P4 |
| 85 | HrDocument | 🟢 Low | P4 |
| 86 | HrChatSession | 🟢 Low | P4 |
| 87 | ContractHistory | 🟢 Low | P4 |
| 88 | EmployeeDocument | 🟢 Low | P4 |
| 89 | EmployeeOnboarding | 🟢 Low | P4 |
| 90 | EmployeeRole | 🟢 Low | P4 |
| 91 | ExitInterview | 🟢 Low | P4 |
| 92 | OneOnOne | 🟢 Low | P4 |
| 93 | OnboardingCheckin | 🟢 Low | P4 |
| 94 | ShiftChangeRequest | 🟢 Low | P4 |
| 95 | SkillGapReport | 🟢 Low | P4 |
| 96 | TeamHealthScore | 🟢 Low | P4 |
| 97 | TeamsIntegration | 🟢 Low | P4 |
| 98 | TeamsWebhookConfig | 🟢 Low | P4 |
| 99 | TeamsCardAction | 🟢 Low | P4 |
| 100 | TermOverride | 🟢 Low | P4 |
| 101 | M365ProvisioningLog | 🟢 Low | P4 |
| 102 | MigrationJob | 🟢 Low | P4 |
| 103 | Recognition | 🟢 Low | P4 |
| 104 | CollaborationScore | 🟢 Low | P4 |
| 105 | BiasDetectionLog | 🟢 Low | P4 |
| 106 | PiiAccessLog | 🟢 Low | P4 |
| 107 | AttritionRiskHistory | 🟢 Low | P4 |
| 108 | AiReport | 🟢 Low | P4 |
| 109 | AiEvaluationDraft | 🟢 Low | P4 |
| 110 | AiLog | 🟢 Low | P4 |
| 111 | SeveranceInterimPayment | 🟢 Low | P4 |
| 112 | AllowanceRecord | 🟢 Low | P4 |
| 113 | SocialInsuranceRecord | 🟢 Low | P4 |
| 114 | AuditLog | 🛡️ System | Special |
| 115 | PeerReviewNomination* | 🟡 Med | P1 |

**Policy template (Category A):**
```sql
ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "Department"
  FOR SELECT USING ("companyId" = current_setting('app.current_company_id')::uuid);

CREATE POLICY "tenant_isolation_insert" ON "Department"
  FOR INSERT WITH CHECK ("companyId" = current_setting('app.current_company_id')::uuid);

CREATE POLICY "tenant_isolation_update" ON "Department"
  FOR UPDATE USING ("companyId" = current_setting('app.current_company_id')::uuid);

CREATE POLICY "tenant_isolation_delete" ON "Department"
  FOR DELETE USING ("companyId" = current_setting('app.current_company_id')::uuid);
```

---

### Category B: Indirect Tenant (via `employeeId` → Employee → Assignment) — 36 models

These models link to `Employee` via `employeeId` but do NOT have a direct `companyId`. Tenant isolation requires a JOIN through `EmployeeAssignment`.

| # | Model | Sensitivity | Priority |
|---|-------|:---:|:---:|
| 1 | PayrollItem | 🔴 High | P0 |
| 2 | PayrollAdjustment | 🔴 High | P0 |
| 3 | PayrollAnomaly | 🔴 High | P0 |
| 4 | PayrollSimulation | 🔴 High | P0 |
| 5 | WithholdingReceipt | 🔴 High | P0 |
| 6 | YearEndSettlement | 🔴 High | P0 |
| 7 | BankTransferItem | 🔴 High | P0 |
| 8 | BenefitClaim | 🟡 Med | P3 |
| 9 | EmployeeBenefit | 🟡 Med | P3 |
| 10 | EmployeeLeaveBalance | 🟡 Med | P2 |
| 11 | LeaveYearBalance | 🟡 Med | P2 |
| 12 | LeavePromotionLog | 🟡 Med | P2 |
| 13 | EmployeeOffboarding | 🟡 Med | P3 |
| 14 | EntityTransfer | 🟡 Med | P3 |
| 15 | EmployeeHistory | 🟢 Low | P4 |
| 16 | EmployeeProfileExtension | 🟢 Low | P4 |
| 17 | ProfileChangeRequest | 🟢 Low | P4 |
| 18 | ProfileVisibility | 🟢 Low | P4 |
| 19 | EmergencyContact | 🟢 Low | P4 |
| 20 | EmployeeAuth | 🛡️ System | Special |
| 21 | EmployeeSchedule | 🟢 Low | P4 |
| 22 | EmployeeSkillAssessment | 🟢 Low | P4 |
| 23 | TrainingEnrollment | 🟢 Low | P4 |
| 24 | CalibrationAdjustment | 🟡 Med | P1 |
| 25 | PeerReviewNomination | 🟡 Med | P1 |
| 26 | RecognitionLike | 🟢 Low | P4 |
| 27 | SuccessionCandidate | 🟢 Low | P4 |
| 28 | ShiftGroupMember | 🟢 Low | P4 |
| 29 | BurnoutScore | 🟢 Low | P4 |
| 30 | TurnoverRiskScore | 🟢 Low | P4 |
| 31 | WorkHourAlert | 🟢 Low | P4 |
| 32 | Notification | 🛡️ System | Special |
| 33 | NotificationPreference | 🛡️ System | Special |
| 34 | PushSubscription | 🛡️ System | Special |
| 35 | SsoIdentity | 🛡️ System | Special |
| 36 | SsoSession | 🛡️ System | Special |

**Policy template (Category B):**
```sql
ALTER TABLE "PayrollItem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "PayrollItem"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "EmployeeAssignment" ea
      WHERE ea."employeeId" = "PayrollItem"."employeeId"
        AND ea."companyId" = current_setting('app.current_company_id')::uuid
        AND ea."isPrimary" = true
        AND ea."endDate" IS NULL
    )
  );
```

> ⚠️ **Performance note:** Category B policies require a subquery JOIN. Ensure `EmployeeAssignment(employeeId, companyId, isPrimary, endDate)` has a composite index.

---

### Category C: Global / No Tenant — 43 models

These models have NO `companyId` and NO `employeeId`. They are either:
- Global reference data (Company, Competency, Role)
- Child records linked via parent (OnboardingTask → OnboardingTemplate)
- System auth/config

| # | Model | Reason | RLS |
|---|-------|--------|-----|
| 1 | Company | **IS** the tenant | None (root entity) |
| 2 | Employee | Linked via Assignment | Via Assignment |
| 3 | Competency | Global reference | None |
| 4 | CompetencyCategory | Global reference | None |
| 5 | CompetencyIndicator | Child of Competency | None |
| 6 | CompetencyLevel | Child of Competency | None |
| 7 | Role | Global auth reference | None |
| 8 | Permission | Global auth reference | None |
| 9 | RolePermission | Global auth reference | None |
| 10 | IncomeTaxRate | Global tax table | None |
| 11 | InsuranceRate | Global insurance table | None |
| 12 | NontaxableLimit | Global tax-free limits | None |
| 13 | ExchangeRate | Global exchange rates | None |
| 14 | LeaveAccrualRule | Global leave rules | None |
| 15 | YearEndDeductionConfig | Global tax config | None |
| 16 | Applicant | Pre-hire (no company yet) | Via Application |
| 17 | Application | Child of JobPosting (has company) | Via Parent |
| 18 | TalentPoolEntry | Pre-hire talent | Via Application |
| 19 | CandidateDuplicateLog | Pre-hire dedup | Via Applicant |
| 20 | InterviewSchedule | Child of Application | Via Parent |
| 21 | InterviewEvaluation | Child of Interview | Via Parent |
| 22 | RequisitionApproval | Child of Requisition (has company) | Via Parent |
| 23 | ApprovalFlowStep | Child of ApprovalFlow | Via Parent |
| 24 | AttendanceApprovalStep | Child of AttendanceApproval | Via Parent |
| 25 | PayrollApproval | Child of PayrollRun | Via Parent |
| 26 | PayrollApprovalStep | Child of PayrollApproval | Via Parent |
| 27 | WorkflowStep | Child of WorkflowRule | Via Parent |
| 28 | OnboardingTask | Child of Template | Via Parent |
| 29 | OffboardingTask | Child of Checklist | Via Parent |
| 30 | EmployeeOnboardingTask | Child of EmployeeOnboarding | Via Parent |
| 31 | EmployeeOffboardingTask | Child of EmployeeOffboarding | Via Parent |
| 32 | EntityTransferDataLog | Child of EntityTransfer | Via Parent |
| 33 | CustomFieldValue | Child of CustomField | Via Parent |
| 34 | HrDocumentChunk | Child of HrDocument | Via Parent |
| 35 | HrChatMessage | Child of HrChatSession | Via Parent |
| 36 | MboProgress | Child of MboGoal | Via Parent |
| 37 | PeerReviewAnswer | Child of PeerReviewNomination | Via Parent |
| 38 | PulseQuestion | Child of PulseSurvey | Via Parent |
| 39 | MigrationLog | System operation log | None |
| 40 | KpiDashboardConfig | UI personalization | By userId |
| 41 | YearEndDeduction | Child of YearEndSettlement | Via Parent |
| 42 | YearEndDependent | Child of YearEndSettlement | Via Parent |
| 43 | YearEndDocument | Child of YearEndSettlement | Via Parent |

**No direct RLS policy needed.** These are either:
- Protected via parent table's RLS (cascading security)
- Global reference data (intentionally shared)
- System tables (auth-scoped, not tenant-scoped)

---

## Implementation Priority

| Priority | Model Count | Models (Key Examples) | Reason |
|:---:|:---:|---------|--------|
| **P0** | 13 | EmployeeAssignment, PayrollRun, Payslip, PayrollItem, PayrollAdjustment, CompensationHistory, SalaryBand, SalaryAdjustmentMatrix, WithholdingReceipt, YearEndSettlement, BankTransferItem, BankTransferBatch, EmployeePayItem | **Salary & financial data** — highest PII sensitivity |
| **P1** | 10 | PerformanceCycle, PerformanceEvaluation, PerformanceReview, MboGoal, CalibrationSession, CalibrationRule, CalibrationAdjustment, PulseSurvey, PulseResponse, PeerReviewNomination | **Performance data** — sensitive evaluation records |
| **P2** | 9 | LeaveRequest, LeavePolicy, LeaveSetting, LeaveTypeDef, Attendance, AttendanceSetting, AttendanceApprovalRequest, EmployeeLeaveBalance, LeaveYearBalance | **Personal work data** — attendance & leave |
| **P3** | 9 | BenefitPlan, BenefitPolicy, BenefitBudget, BenefitClaim, EmployeeBenefit, DisciplinaryAction, RewardRecord, EmployeeOffboarding, EntityTransfer | **Benefit & HR action data** |
| **P4** | ~74 | Department, Position, Job, JobPosting, TrainingCourse, OnboardingTemplate, etc. | **General operational data** |
| **Special** | ~7 | AuditLog, Notification, EmployeeAuth, SsoIdentity, SsoSession, NotificationPreference, PushSubscription | **System tables** — RLS by userId, not companyId |

---

## Implementation Plan

### Step 1: Prisma Client Extension for Session Variables

> ⚠️ **CRITICAL:** Prisma does NOT automatically support PostgreSQL session variables. RLS's `current_setting('app.current_company_id')` requires the session variable to be set before every query.

**Option A: Prisma Client Extension (Recommended)**
```typescript
// src/lib/prisma-rls.ts
import { PrismaClient } from '@prisma/client'

export function createRlsPrisma(companyId: string) {
  return new PrismaClient().$extends({
    query: {
      $allOperations({ args, query }) {
        return prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SET LOCAL app.current_company_id = '${companyId}'`
          )
          return query(args)
        })
      },
    },
  })
}
```

**Option B: Supabase RLS Connection String**
- Use Supabase's built-in RLS support with the `anon` key
- Pass JWT with `company_id` claim
- Supabase automatically sets the session variable

**Recommendation:** Option A for development, Option B for production (Supabase manages the session lifecycle).

### Step 2: Apply P0 Policies (SQL Migration)

```sql
-- Migration: 20260312_rls_p0_salary_data.sql

-- 1. EmployeeAssignment
ALTER TABLE "EmployeeAssignment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "EmployeeAssignment"
  FOR ALL USING ("companyId" = current_setting('app.current_company_id')::uuid);

-- 2. PayrollRun
ALTER TABLE "PayrollRun" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "PayrollRun"
  FOR ALL USING ("companyId" = current_setting('app.current_company_id')::uuid);

-- 3. Payslip (has companyId)
ALTER TABLE "Payslip" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Payslip"
  FOR ALL USING ("companyId" = current_setting('app.current_company_id')::uuid);

-- ... (repeat for all P0 models)
```

### Step 3: SUPER_ADMIN Bypass

```sql
-- Allow SUPER_ADMIN to bypass RLS
CREATE ROLE super_admin_role;
ALTER TABLE "PayrollRun" FORCE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_bypass" ON "PayrollRun"
  FOR ALL TO super_admin_role USING (true);
```

Alternatively, use `SET LOCAL app.bypass_rls = 'true'` with a policy check.

### Step 4: Progressive Rollout
1. Apply P0 in staging, run integration tests
2. Monitor query performance (Category B JOIN overhead)
3. Roll out P1 → P2 → P3 → P4 over 2-4 sessions
4. **Keep `resolveCompanyId()` as defense-in-depth** (do NOT remove)

---

## Risks

1. **Prisma + PostgreSQL Session Variables:** Prisma does not automatically support PostgreSQL session variables. To make `current_setting('app.current_company_id')` work, every query must be wrapped in an interactive transaction with `SET LOCAL`. This requires either a Prisma Client Extension or Supabase's RLS-aware connection string. Without this, RLS policies will reject ALL queries (session variable unset → `current_setting()` returns empty → no rows match).

2. **Performance (Category B):** Indirect tenant models require a JOIN to `EmployeeAssignment`. For tables with millions of rows (Attendance, PayrollItem), this subquery can be slow. **Mitigation:** Add composite index on `EmployeeAssignment(employeeId, companyId, isPrimary, endDate)`.

3. **SUPER_ADMIN Access:** Super admins need cross-company views (compare dashboard, global payroll). Must implement bypass mechanism without disabling RLS globally.

4. **Migration Size:** 115 Category A + 36 Category B = 151 tables need policies. Break into priority-based migration files (P0: ~13, P1: ~10, P2: ~9, P3: ~9, P4: ~110).

5. **Testing Gap:** No automated RLS tests exist. Before enabling, create test queries that verify:
   - Company A user CANNOT see Company B data
   - SUPER_ADMIN CAN see all companies
   - Category B JOIN works correctly for transferred employees

6. **Entity Transfers:** When an employee transfers between companies (crossboarding), their old assignment gets `endDate` set. RLS must handle both active and historical access patterns.

---

## Appendix: Index Requirements

```sql
-- Required for Category B policy performance
CREATE INDEX idx_employee_assignment_rls
  ON "EmployeeAssignment" ("employeeId", "companyId", "isPrimary")
  WHERE "endDate" IS NULL;

-- Required for Category A policy performance (if not already indexed)
CREATE INDEX idx_payroll_run_company ON "PayrollRun" ("companyId");
CREATE INDEX idx_leave_request_company ON "LeaveRequest" ("companyId");
CREATE INDEX idx_attendance_company ON "Attendance" ("companyId");
```
