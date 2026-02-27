# CTR HR Hub v3.2 — STEP1 Session Context

**Date:** 2026-02-26
**Status:** STEP1 Complete (except DB push — PostgreSQL not installed)
**TypeScript Errors:** 0

## What Was Built

Complete project skeleton for CTR HR Hub v3.2 SaaS HR system.
No feature implementation — structure, schema, libs, components, and seed only.

## Stats

| Metric | Count |
|--------|-------|
| Total files | 235 |
| TypeScript/TSX source files | 184 (excl. generated) |
| Prisma models | 87 |
| Prisma enums | 70 |
| Schema lines | 2,549 |
| Seed data lines | 1,130 |
| MV SQL lines | 308 |
| Git commits | 10 |

## Commits

1. `76b8016` — Initial commit from Create Next App
2. `9483036` — Project init with Next.js 14, Tailwind, shadcn/ui, Prisma + full folder structure
3. `dd88e80` — Complete Prisma schema with 87 models and 70 enums
4. `52d367a` — All common lib files (foundation, auth, services, v3.2 customization)
5. `c042325` — Base Zod validation schemas
6. `baba289` — All shared components (simple + complex)
7. `3b5e631` — Dashboard layout, auth pages, and app configuration
8. `1c9c7be` — Role-based home pages, error pages, and core value icons
9. `cdde9b6` — Complete seed data (companies, roles, permissions, test accounts, v3.2)
10. `8069a12` — 8 materialized views SQL with indexes and pg_cron schedules

## Created Files (Custom — excluding generated & shadcn/ui)

### Lib Files (28)
- `src/lib/env.ts` — Type-safe env vars
- `src/lib/errors.ts` — AppError class + Prisma error handler
- `src/lib/prisma.ts` — Singleton PrismaClient
- `src/lib/api.ts` — apiSuccess/apiError/apiClient
- `src/lib/constants.ts` — Roles, modules, actions, permissions
- `src/lib/i18n/ko.ts` — Korean translations (200+ keys)
- `src/lib/auth.ts` — NextAuth + Azure AD SSO
- `src/lib/permissions.ts` — RBAC: withPermission, hasPermission, requirePermission
- `src/lib/audit.ts` — Audit logging
- `src/lib/s3.ts` — S3 presigned URLs
- `src/lib/redis.ts` — Redis cache helpers
- `src/lib/claude.ts` — Anthropic AI client + logging
- `src/lib/terminal.ts` — Terminal auth
- `src/lib/attrition.ts` — Attrition risk stub
- `src/lib/labor/index.ts` — Labor module interface + registry
- `src/lib/labor/kr.ts` — Korean labor law (52h/week)
- `src/lib/labor/us.ts`, `cn.ts`, `ru.ts`, `vn.ts`, `eu.ts`, `mx.ts` — Stubs
- `src/lib/terms.ts` — v3.2 term overrides (14 keys)
- `src/lib/tenant-settings.ts` — v3.2 tenant settings + module toggle
- `src/lib/enum-options.ts` — v3.2 dynamic enums
- `src/lib/workflow.ts` — v3.2 workflow engine
- `src/lib/custom-fields.ts` — v3.2 custom fields
- `src/lib/schemas/common.ts` — Zod: pagination, uuid, dateRange
- `src/lib/schemas/employee.ts` — Zod: employee CRUD schemas

### Components (22 custom)
- `src/components/shared/LoadingSpinner.tsx`
- `src/components/shared/EmptyState.tsx`
- `src/components/shared/AiGeneratedBadge.tsx`
- `src/components/shared/PageHeader.tsx`
- `src/components/shared/PermissionGate.tsx` (Server Component)
- `src/components/shared/DataTable.tsx`
- `src/components/shared/CompanySelector.tsx`
- `src/components/shared/CustomFieldsSection.tsx`
- `src/components/shared/ModuleGate.tsx`
- `src/components/shared/BrandProvider.tsx`
- `src/components/command-palette/CommandPalette.tsx` (Cmd+K)
- `src/components/hr-chatbot/HrChatbot.tsx` (Floating chatbot)
- `src/components/layout/Sidebar.tsx` (CTR brand + RBAC nav)
- `src/components/layout/Header.tsx` (Breadcrumb + CompanySelector)
- `src/components/home/EmployeeHome.tsx`
- `src/components/home/ManagerHome.tsx`
- `src/components/home/HrAdminHome.tsx`
- `src/components/home/ExecutiveHome.tsx`
- `src/components/icons/CoreValueIcons.tsx`

### App Pages (10)
- `src/app/layout.tsx` — Root layout (lang="ko")
- `src/app/providers.tsx` — SessionProvider + Toaster
- `src/app/(auth)/layout.tsx` — Auth layout
- `src/app/(auth)/login/page.tsx` — Split login (SSO + dev accounts)
- `src/app/(dashboard)/layout.tsx` — Dashboard layout (Server)
- `src/app/(dashboard)/DashboardShell.tsx` — Client shell
- `src/app/(dashboard)/page.tsx` — Role-based home router
- `src/app/403/page.tsx` — Forbidden
- `src/app/error.tsx` — Error boundary
- `src/app/not-found.tsx` — 404

### Data Files
- `prisma/schema.prisma` — 87 models, 70 enums (2,549 lines)
- `prisma/seed.ts` — Full seed: 13 companies, 5 roles, 66 permissions, 4 test accounts, v3.2 data (1,130 lines)
- `prisma/migrations/mv_analytics.sql` — 8 MVs + indexes + pg_cron (308 lines)
- `src/types/index.ts` — Shared types

## Seed Data Summary

| Data | Count |
|------|-------|
| Companies | 13 |
| Roles | 5 |
| Permissions | 66 |
| Role-Permission Mappings | ~150 |
| Job Categories | 52 (4/company) |
| Departments (CTR-KR) | 4 |
| Job Grades | 12 |
| Test Accounts | 4 |
| Onboarding Template + Tasks | 1 + 6 |
| Offboarding Checklist + Tasks | 1 + 8 |
| EMS Block Config | 9 blocks |
| Salary Bands | 6 |
| Benefit Policies | 3 |
| Notification Triggers | 7 |
| Korean Holidays | ~30 |
| Tenant Settings | 13 |
| Term Overrides | 182 |
| Tenant Enum Options | ~780 |
| Workflow Rules + Steps | 4 + 5 |
| Email Templates | 15 |
| Export Templates | 3 |

## Remaining for STEP1 Completion

1. **Install PostgreSQL** (Homebrew, Postgres.app, or Docker)
2. Run `npx prisma db push`
3. Run `npx prisma db seed`
4. Apply `prisma/migrations/mv_analytics.sql` manually
5. Verify dev server: `npm run dev` → localhost:3000

## Architecture Notes

- Multi-company isolation: all queries filter by company_id
- RBAC: role → permission with company_id binding
- Customization priority: tenant_settings → DB enum → never hardcode
- Server Component first: 'use client' only when state needed
- Soft delete: all tables have deleted_at column
- Prisma v7 with @prisma/adapter-pg

---

# CTR HR Hub v3.2 — STEP 2.5 Session Context

**Date:** 2026-02-27
**Status:** STEP 2.5 Complete
**TypeScript Errors:** 0

## What Was Built (STEP 2.5)

Contract management, work permit/visa tracking, Poland entity setup, probation flexibility,
annual leave promotion alerts, recruitment→employee conversion, evaluation reminders,
org snapshot history, payroll frequency multiplexing.

## New Prisma Models (3)

| Model | Table | Purpose |
|-------|-------|---------|
| ContractHistory | contract_history | 계약 이력 (차수, 유형, 기간, 급여) |
| WorkPermit | work_permit | 비자/취업허가 관리 |
| OrgSnapshot | org_snapshot | 조직 스냅샷 이력 |

## New Prisma ENUMs (5)

- `ContractType`: PERMANENT, FIXED_TERM, DISPATCH, INTERN, PROBATION_ONLY
- `WorkPermitType`: WORK_VISA, WORK_PERMIT, RESIDENCE_PERMIT, I9_VERIFICATION, OTHER
- `WorkPermitStatus`: ACTIVE, EXPIRED, REVOKED, PENDING_RENEWAL
- `SnapshotTrigger`: MANUAL, SCHEDULED, RESTRUCTURE, ACQUISITION
- (Employee): contractEndDate, contractType 필드 추가

## New Lib Files (4)

- `src/lib/contract/rules.ts` — 국가별 계약 규칙 (7개국: KR/CN/RU/VN/MX/US/PL)
- `src/lib/labor/pl.ts` — 폴란드 노동법 (24개월 계약 제한, 3개 갱신)
- `src/lib/kpmg-interface.ts` — KPMG 연결 인터페이스 (폴란드 급여대행)
- `src/lib/performance/reminders.ts` — 평가 리마인더 로직

## Updated Lib Files (1)

- `src/lib/labor/kr.ts` — 수습 기간 범위 필드 추가

## New API Routes (10)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/employees/[id]/contracts` | GET | 직원 계약 이력 목록 |
| `/api/v1/employees/[id]/contracts` | POST | 신규 계약 등록 |
| `/api/v1/employees/[id]/contracts/[contractId]` | GET | 계약 상세 |
| `/api/v1/employees/[id]/contracts/[contractId]` | PUT | 계약 수정 |
| `/api/v1/employees/[id]/work-permits` | GET | 직원 비자/허가 목록 |
| `/api/v1/employees/[id]/work-permits` | POST | 비자/허가 등록 |
| `/api/v1/work-permits/[id]` | PUT | 비자/허가 수정 |
| `/api/v1/work-permits/[id]` | DELETE | 비자/허가 소프트 삭제 |
| `/api/v1/contracts/expiring` | GET | 만료 예정 계약 목록 |
| `/api/v1/work-permits/expiring` | GET | 만료 예정 비자/허가 목록 |
| `/api/v1/org/snapshots` | GET/POST | 조직 스냅샷 관리 |
| `/api/v1/recruitment/applications/[id]/convert-to-employee` | POST | 합격자 → 직원 전환 |

## New UI Pages & Components (7)

| File | Description |
|------|-------------|
| `src/app/(dashboard)/employees/[id]/contracts/page.tsx` | 계약 이력 페이지 (서버) |
| `src/app/(dashboard)/employees/[id]/contracts/ContractsClient.tsx` | 계약 이력 클라이언트 |
| `src/app/(dashboard)/employees/[id]/work-permits/page.tsx` | 비자/허가 페이지 (서버) |
| `src/app/(dashboard)/employees/[id]/work-permits/WorkPermitsClient.tsx` | 비자/허가 클라이언트 |
| `src/app/(dashboard)/settings/contract-rules/page.tsx` | 계약 규칙 설정 페이지 |
| `src/app/(dashboard)/settings/contract-rules/ContractRulesClient.tsx` | 국가별 계약 규칙 카드 |
| `src/components/recruitment/ConvertToEmployeeButton.tsx` | 합격자 전환 버튼+다이얼로그 |

## Seed Data Additions

| Data | Count |
|------|-------|
| MX enum options (allowance_type) | 4 (MX_PTU, MX_AGUINALDO, MX_PRIMA_VACACIONAL, MX_SUNDAY_PREMIUM) |
| RU enum options (bonus_type) | 1 (RU_13TH_SALARY) |
| Email templates | +8 (CONTRACT_EXPIRY_30D/7D, WORK_PERMIT_EXPIRY_90D/30D, LEAVE_PROMOTION_STEP1/2/3) |
| Companies updated | All 13 companies upserted with payrollFrequencies field |
| CTR-EU (Poland) | payrollFrequencies: ['MONTHLY'] + KPMG 연동 플래그 |

## Key Implementation Notes

### ContractHistory 접근 패턴
Prisma generate 이전 호환을 위해 타입 캐스팅 사용:
```ts
const db = prisma as unknown as ExtendedPrismaClient
```
`prisma generate` 실행 후 실제 타입으로 교체 가능.

### convert-to-employee 필수 필드 처리
Employee.departmentId, jobGradeId, jobCategoryId 모두 non-nullable.
공고(posting)에서 자동 채움. 없으면 400 오류:
```ts
const resolvedDepartmentId = departmentId ?? application.posting?.departmentId
if (!resolvedDepartmentId) throw badRequest('departmentId가 필요합니다.')
```

### ContractRule 인터페이스 (snake_case)
```ts
interface ContractRule {
  max_fixed_term_count: number    // 0 = 무제한
  max_fixed_term_months: number   // 0 = 무제한
  probation_range: { min_days: number; max_days: number }
  auto_convert_to_permanent: boolean
}
```

## Remaining for STEP 2.5 Completion

1. **Install PostgreSQL** (Homebrew, Postgres.app, or Docker)
2. Run `npx prisma db push`
3. Run `npx prisma db seed`
4. Apply `prisma/migrations/mv_analytics.sql` manually
5. Remove `ExtendedPrismaClient` cast in contracts routes (after prisma generate is standard)
6. Verify dev server: `npm run dev` → localhost:3000
