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

---

# CTR HR Hub v3.2 — STEP 3 Session Context

**Date:** 2026-02-27
**Status:** STEP3 Complete
**TypeScript Errors:** 0

## What Was Built (STEP 3)

Onboarding lifecycle, offboarding lifecycle, emotional check-in system,
exit interviews with AI analysis, IT account deactivation, self-service profile changes.

## New Lib Files (2)

- `src/lib/notifications.ts` — Fire-and-forget notification helper (sendNotification)
- `src/lib/offboarding-complete.ts` — IT account deactivation + SSO revocation helper

## Updated Lib Files (2)

- `src/lib/claude.ts` — Added `onboardingCheckinSummary()` and `exitInterviewSummary()` AI functions
- `src/lib/constants.ts` — Added `CTR_VALUES` (5 core values with emoji icons)

## New API Routes (24)

### Onboarding (11)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/onboarding/templates` | GET/POST | 온보딩 템플릿 CRUD |
| `/api/v1/onboarding/templates/[id]` | GET/PUT/DELETE | 템플릿 상세 |
| `/api/v1/onboarding/templates/[id]/tasks` | GET/POST | 템플릿 태스크 관리 |
| `/api/v1/onboarding/templates/[id]/tasks/reorder` | PUT | 태스크 순서 변경 (DnD) |
| `/api/v1/onboarding/dashboard` | GET | 온보딩 대시보드 (진행중 목록) |
| `/api/v1/onboarding/tasks/[id]/complete` | PUT | 태스크 완료 처리 |
| `/api/v1/onboarding/[id]/force-complete` | PUT | 온보딩 강제 완료 |
| `/api/v1/onboarding/me` | GET | 내 온보딩 현황 |
| `/api/v1/onboarding/checkin` | POST | 주간 체크인 제출 |
| `/api/v1/onboarding/checkins` | GET | 체크인 현황 (HR admin) |
| `/api/v1/onboarding/checkins/[employeeId]` | GET | 직원별 체크인 이력 |

### Offboarding (8)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/offboarding/checklists` | GET/POST | 퇴직 체크리스트 CRUD |
| `/api/v1/offboarding/checklists/[id]` | GET/PUT/DELETE | 체크리스트 상세 |
| `/api/v1/offboarding/checklists/[id]/tasks` | GET/POST | 체크리스트 태스크 관리 |
| `/api/v1/offboarding/dashboard` | GET | 퇴직 대시보드 |
| `/api/v1/offboarding/[id]/tasks/[taskId]/complete` | PUT | 퇴직 태스크 완료 + IT 비활성화 |
| `/api/v1/offboarding/[id]/cancel` | PUT | 퇴직 취소 |
| `/api/v1/offboarding/[id]/exit-interview` | GET/POST | 퇴직 면담 |
| `/api/v1/offboarding/[id]/exit-interview/ai-summary` | POST | AI 퇴직 면담 분석 |

### Employee (1)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/employees/[id]/offboarding/start` | POST | 퇴직 처리 시작 (3단계 위저드) |

### Profile (3)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/profile/change-requests` | GET/POST | 내 정보변경 요청 |
| `/api/v1/profile/change-requests/pending` | GET | 대기중 요청 목록 (HR admin) |
| `/api/v1/profile/change-requests/[id]/review` | PUT | 승인/반려 |

### AI (1)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/ai/onboarding-checkin-summary` | POST | 체크인 AI 요약 |

### Files (1)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/files/presigned` | POST | S3 presigned upload URL 생성 |

## New UI Pages & Components (20)

### Onboarding Settings (2)
- `src/app/(dashboard)/settings/onboarding/page.tsx`
- `src/app/(dashboard)/settings/onboarding/OnboardingSettingsClient.tsx`

### Onboarding Dashboard (2)
- `src/app/(dashboard)/onboarding/page.tsx`
- `src/app/(dashboard)/onboarding/OnboardingDashboardClient.tsx`

### Employee Onboarding (2)
- `src/app/(dashboard)/onboarding/me/page.tsx`
- `src/app/(dashboard)/onboarding/me/OnboardingMeClient.tsx`

### Check-in (4)
- `src/app/(dashboard)/onboarding/checkin/page.tsx`
- `src/app/(dashboard)/onboarding/checkin/CheckinFormClient.tsx`
- `src/app/(dashboard)/onboarding/checkins/page.tsx`
- `src/app/(dashboard)/onboarding/checkins/CheckinsAdminClient.tsx`

### Offboarding Settings (2)
- `src/app/(dashboard)/settings/offboarding/page.tsx`
- `src/app/(dashboard)/settings/offboarding/OffboardingSettingsClient.tsx`

### Offboarding Dashboard (2)
- `src/app/(dashboard)/offboarding/page.tsx`
- `src/app/(dashboard)/offboarding/OffboardingDashboardClient.tsx`

### Offboarding Detail (2)
- `src/app/(dashboard)/offboarding/[id]/page.tsx`
- `src/app/(dashboard)/offboarding/[id]/OffboardingDetailClient.tsx`

### Self-Service Profile (4)
- `src/app/(dashboard)/employees/me/page.tsx`
- `src/app/(dashboard)/employees/me/ProfileSelfServiceClient.tsx`
- `src/app/(dashboard)/settings/profile-requests/page.tsx`
- `src/app/(dashboard)/settings/profile-requests/ProfileRequestsClient.tsx`

## Updated Files (2)

- `src/components/layout/Sidebar.tsx` — Added 온보딩 nav group, updated settings sub-items
- `src/app/(dashboard)/employees/[id]/EmployeeDetailClient.tsx` — 퇴직처리 3단계 위저드 다이얼로그

## Packages Added

- `recharts` — LineChart for check-in trends
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — Drag-and-drop for task reorder

## Key Architecture Decisions

- **Soft delete**: OnboardingTemplate uses `deletedAt`, OffboardingChecklist uses `isActive`
- **Fire-and-forget notifications**: `sendNotification()` won't block API response
- **IT deactivation**: Triggered by offboarding task completion via `deactivateItAccount()`
- **Profile change enum values**: `CHANGE_PENDING`/`CHANGE_APPROVED`/`CHANGE_REJECTED` (Prisma enum)
- **D-day warnings**: D-7 yellow, D-3 red pulsing in offboarding dashboard
- **3-tab offboarding detail**: Tasks / Handover / Exit Interview

---

# CTR HR Hub v3.2 — STEP 6B-1 Session Context

**Date:** 2026-02-28
**Status:** STEP 6B-1 Complete
**TypeScript Errors:** 0

## What Was Built (STEP 6B-1)

연봉·보상 관리 체계 + 이탈 위험 분석 모듈.
급여 밴드 CRUD, 3×3 연봉 인상 매트릭스, 시뮬레이션/확정/이력, Compa-Ratio 분석,
Attrition Risk 6요인 모델, 대시보드(도넛/레이더/히트맵/추이 차트).

## New/Updated Prisma Schema

- `AiFeature` enum: `COMPENSATION_RECOMMENDATION`, `ATTRITION_RISK_ASSESSMENT` 추가

## New Lib Files (4)

| File | Purpose |
|------|---------|
| `src/lib/schemas/compensation.ts` | Zod: salaryBand, matrix, simulation, confirm, history, analysis |
| `src/lib/schemas/attrition.ts` | Zod: dashboard, employee, trend, recalculate |
| `src/lib/compensation.ts` | compaRatio 계산, 밴드 분류, 매트릭스 추천, 예산 요약, 통화 포맷 |
| `src/lib/attrition.ts` | 6요인 모델 (근속15%/보상25%/성과20%/매니저15%/참여15%/근태10%) |

## New API Routes (12)

### Compensation (7)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/compensation/salary-bands` | GET/POST | 급여 밴드 목록(페이지네이션) + 생성 |
| `/api/v1/compensation/salary-bands/[id]` | GET/PUT/DELETE | 급여 밴드 상세/수정/삭제 |
| `/api/v1/compensation/matrix` | GET/POST | 3×3 매트릭스 조회 + 일괄 upsert |
| `/api/v1/compensation/matrix/copy` | POST | 이전 사이클 매트릭스 복사 |
| `/api/v1/compensation/simulation` | GET | 시뮬레이션 데이터 (compa + 추천) |
| `/api/v1/compensation/simulation/ai-recommend` | POST | AI 개별 추천 |
| `/api/v1/compensation/confirm` | POST | 연봉 조정 확정 ($transaction) |
| `/api/v1/compensation/history` | GET | 변경 이력 (필터/페이지네이션) |
| `/api/v1/compensation/analysis` | GET | Compa-Ratio 분포 분석 |

### Attrition Risk (5)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/attrition/dashboard` | GET | KPI + 분포 + 고위험 목록 |
| `/api/v1/attrition/employees/[id]` | GET | 직원별 6요인 상세 |
| `/api/v1/attrition/department-heatmap` | GET | 부서별 히트맵 |
| `/api/v1/attrition/trend` | GET | 월별 추이 (12개월) |
| `/api/v1/attrition/recalculate` | POST | 수동 재계산 (HR_ADMIN) |

## New UI Pages & Components (18)

### Compensation Pages (2)
- `src/app/(dashboard)/compensation/page.tsx` — 서버 컴포넌트
- `src/app/(dashboard)/compensation/CompensationClient.tsx` — 3탭 (시뮬레이션/확정/이력분석)

### Compensation Components (5)
- `src/components/compensation/SimulationTab.tsx` — DataTable + 인라인 편집 + AI 추천 + 예산 요약
- `src/components/compensation/ConfirmTab.tsx` — 리뷰 + AlertDialog 확정
- `src/components/compensation/HistoryTab.tsx` — 이력 테이블 + Compa-Ratio BarChart
- `src/components/compensation/CompaRatioBadge.tsx` — 5색 Compa 뱃지

### Attrition Pages (2)
- `src/app/(dashboard)/analytics/attrition/page.tsx` — 서버 컴포넌트
- `src/app/(dashboard)/analytics/attrition/AttritionRiskClient.tsx` — 대시보드

### Attrition Components (6)
- `src/components/compensation/AttritionKpiCards.tsx` — KPI 카드 4개
- `src/components/compensation/AttritionDonutChart.tsx` — PieChart (분포)
- `src/components/compensation/AttritionRadarChart.tsx` — RadarChart (6요인)
- `src/components/compensation/DepartmentHeatmap.tsx` — 부서별 색상 그리드
- `src/components/compensation/AttritionTrendChart.tsx` — LineChart (월별 추이)
- `src/components/compensation/HighRiskList.tsx` — 확장 가능 고위험 목록

### Settings Pages (4)
- `src/app/(dashboard)/settings/salary-bands/page.tsx` — 서버 컴포넌트
- `src/app/(dashboard)/settings/salary-bands/SalaryBandsClient.tsx` — 급여 밴드 CRUD
- `src/app/(dashboard)/settings/salary-matrix/page.tsx` — 서버 컴포넌트
- `src/app/(dashboard)/settings/salary-matrix/SalaryMatrixClient.tsx` — 3×3 그리드 편집

## Updated Files (1)

- `src/components/layout/Sidebar.tsx` — 연봉/보상(Banknote), 분석/이탈위험(AlertTriangle), 설정/급여밴드·인상매트릭스 추가

## Key Technical Details

### Compa-Ratio 5색 밴드
| Band | Range | Color |
|------|-------|-------|
| VERY_LOW | <0.80 | 🔴 Red |
| LOW | 0.80-0.95 | 🟡 Amber |
| AT_RANGE | 0.95-1.05 | 🟢 Green |
| HIGH | 1.05-1.20 | 🔵 Blue |
| VERY_HIGH | >1.20 | 🟣 Purple |

### EMS 9-Block → Performance Group
- High: blocks 7,8,9 (3A, 3B, 3C)
- Mid: blocks 4,5,6 (2A, 2B, 2C)
- Low: blocks 1,2,3 (1A, 1B, 1C)

### Attrition Risk 6요인 가중치
| Factor | Weight | Data Source |
|--------|--------|-------------|
| Tenure | 15% | hireDate |
| Compensation | 25% | compa-ratio |
| Performance | 20% | EMS block + compa |
| Manager | 15% | managerId 존재 여부 |
| Engagement | 15% | PulseResponse (Mood 매핑 + 미응답 패널티) |
| Attendance | 10% | Attendance (지각률/결근/초과근무 번아웃) |

### Risk Levels
- LOW: <40, MEDIUM: 40-59, HIGH: 60-79, CRITICAL: 80+

---

# CTR HR Hub v3.2 — STEP 6B-1 Gap Fill Session Context

**Date:** 2026-02-28
**Status:** STEP 6B-1 100% Complete (Gap Fill)
**TypeScript Errors:** 0

## What Was Done (STEP 6B-1 Gap Fill)

기존 STEP 6B-1 (85% 완료)의 미완성 부분 4가지를 채워 100% 완성:
1. AI 연봉 추천 — stub → 실제 Claude API 호출
2. Attrition AI 보정 — HIGH/CRITICAL 직원 AI 평가
3. Engagement/Attendance 요인 — 하드코딩 → 실데이터 연동
4. UI 에러 처리 + AI 결과 표시 패널

## Updated Files (7)

| File | Changes |
|------|---------|
| `src/lib/claude.ts` | `compensationRecommendation()` + `attritionRiskAssessment()` 2개 AI 함수 추가 |
| `src/lib/attrition.ts` | `calculateEngagementFactor()`: PulseResponse Mood 매핑 (GREAT=10~BAD=85) + 미응답 패널티 +20, `calculateAttendanceFactor()`: 지각률/결근/초과근무(60h+ 번아웃) |
| `src/app/api/v1/compensation/simulation/ai-recommend/route.ts` | Mock stub → employee/comp/salaryBand/EMS 조회 후 `compensationRecommendation()` 실제 호출 |
| `src/app/api/v1/attrition/employees/[id]/route.ts` | `?includeAi=true` 쿼리 파라미터 → HIGH/CRITICAL만 `attritionRiskAssessment()` 호출, `aiAssessment` 필드 추가 |
| `src/components/compensation/SimulationTab.tsx` | AI 추천 결과 패널 (reasoning + riskFactors + alternativeActions), toast 에러 처리 |
| `src/components/compensation/HistoryTab.tsx` | toast 에러 처리 (// ignore → useToast) |
| `src/components/compensation/HighRiskList.tsx` | "AI 분석" 버튼 → on-demand AI 로드, risk_drivers/contextual_risks/retention_actions/confidence 표시 |

## AI Functions Added

### compensationRecommendation()
- Input: employeeName, department, grade, emsBlock, compaRatio, currentSalary, currency, tenureMonths, budgetConstraint?, companyAvgRaise?
- Output: `{ recommendedPct, reasoning, riskFactors[], alternativeActions[] }`
- AiFeature: `COMPENSATION_RECOMMENDATION`

### attritionRiskAssessment()
- Input: employeeName, department, grade, tenureMonths, factorScores, totalScore, compaRatio, emsBlock
- Output: `{ adjusted_score, adjusted_level, risk_drivers[], contextual_risks[], retention_actions[], confidence }`
- AiFeature: `ATTRITION_RISK_ASSESSMENT`
- 비용 절감: HIGH/CRITICAL 직원만 호출, includeAi=true 시에만

## Engagement Factor Logic
- PulseResponse 최근 6개월 조회
- Mood → risk 매핑: GREAT=10, GOOD=25, NEUTRAL=40, STRUGGLING=65, BAD=85
- 연속 2회 미응답 → +20 가산
- 데이터 없으면 기본값 50

## Attendance Factor Logic
- Attendance 최근 6개월 조회
- 지각률 > 15% → +30, > 8% → +15
- 결근 5일+ → +25, 2일+ → +10
- 월 초과근무 60h+ → +25 (번아웃 위험), 40h+ → +15
- 데이터 없으면 기본값 30

---

# CTR HR Hub v3.2 — STEP 7-1 Session Context

**Date:** 2026-02-28
**Status:** STEP 7-1 Complete
**TypeScript Errors:** 0

## What Was Built (STEP 7-1)

급여처리 모듈 — 6단계 상태머신(DRAFT→CALCULATING→REVIEW→APPROVED→PAID→CANCELLED),
한국 4대보험 자동공제, 초과근무 계산, AI 이상감지, 직원 급여명세서, 퇴직금 정산.

## Schema Changes

### Enum Changes
- `PayrollStatus`: PAYROLL_DRAFT/IMPORTED/PAYROLL_CONFIRMED/PAID → **DRAFT/CALCULATING/REVIEW/APPROVED/PAID/CANCELLED**
- `PayrollRunType` (new): MONTHLY, BONUS, SEVERANCE, SPECIAL
- `AiFeature`: + PAYROLL_ANOMALY_CHECK

### Model Changes
- `PayrollRun`: + name, runType, approvedBy/At, paidAt, totalDeductions, headcount
- `PayrollItem`: + grossPay, allowances, currency, isManuallyAdjusted, adjustmentReason

## New Lib Files (6)

| File | Purpose |
|------|---------|
| `src/lib/payroll/types.ts` | PayrollItemDetail, PayrollAnomaly, SeveranceDetail 타입 |
| `src/lib/payroll/kr-tax.ts` | 4대보험 (국민연금4.5%/건강3.545%/장기요양12.81%/고용0.9%) + 8구간 소득세 |
| `src/lib/payroll/calculator.ts` | 직원별 급여 상세 계산 (기본급+초과근무+수당-공제) |
| `src/lib/payroll/batch.ts` | 일괄 계산 (DRAFT→CALCULATING→REVIEW, concurrency 10) |
| `src/lib/payroll/severance.ts` | 퇴직금 = 3개월 평균임금 × 재직연수 |
| `src/lib/payroll/ai-anomaly.ts` | AI 급여 이상감지 (Claude API) |
| `src/lib/payroll/pdf.ts` | 급여명세서 HTML 생성 |
| `src/lib/payroll/index.ts` | Barrel export |
| `src/lib/schemas/payroll.ts` | Zod: payrollRunCreate/List, itemAdjust, severance, anomaly |

## New API Routes (10)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/payroll/runs` | GET/POST | 급여 실행 목록 + 생성(DRAFT) |
| `/api/v1/payroll/runs/[id]` | GET | 급여 실행 상세 (items 포함) |
| `/api/v1/payroll/runs/[id]/calculate` | POST | DRAFT→REVIEW 계산 실행 |
| `/api/v1/payroll/runs/[id]/approve` | PUT | REVIEW→APPROVED 승인 |
| `/api/v1/payroll/runs/[id]/paid` | PUT | APPROVED→PAID 지급완료 |
| `/api/v1/payroll/runs/[id]/review` | GET | 검토 데이터 + 이상항목 플래그 |
| `/api/v1/payroll/runs/[id]/items/[itemId]` | PUT | 수동 조정 |
| `/api/v1/payroll/me` | GET | 내 급여명세서 목록 (PAID만) |
| `/api/v1/payroll/me/[runId]/pdf` | GET | 급여명세서 다운로드 |
| `/api/v1/ai/payroll-anomaly` | POST | AI 이상감지 |
| `/api/v1/payroll/severance/[employeeId]` | POST | 퇴직금 계산 |

## New UI Pages & Components (14)

### Pages (7)
| File | Description |
|------|-------------|
| `(dashboard)/payroll/page.tsx` + `PayrollClient.tsx` | 급여 실행 목록 (필터+DataTable+생성) |
| `(dashboard)/payroll/[runId]/review/page.tsx` + `PayrollReviewClient.tsx` | 급여 검토 (KPI+DataTable+액션+AI) |
| `(dashboard)/payroll/me/page.tsx` + `PayrollMeClient.tsx` | 내 급여명세서 목록 |
| `(dashboard)/payroll/me/[runId]/page.tsx` + `PayStubDetailClient.tsx` | 명세서 상세 (비율바+지급/공제) |

### Components (7)
| File | Description |
|------|-------------|
| `components/payroll/PayrollStatusBadge.tsx` | 6단계 상태 색상 뱃지 |
| `components/payroll/PayrollKpiCards.tsx` | 4개 KPI 카드 (인원/총지급/공제/실지급) |
| `components/payroll/PayrollCreateDialog.tsx` | 생성 폼 Dialog |
| `components/payroll/PayrollAdjustDialog.tsx` | 수동 조정 폼 |
| `components/payroll/AnomalyPanel.tsx` | AI 이상감지 결과 패널 |
| `components/payroll/PayStubBreakdown.tsx` | 지급/공제 항목 상세 뷰 + 비율 바 |
| `components/payroll/SeveranceCalculator.tsx` | 퇴직금 계산 폼 + 3개월 평균임금 테이블 |

## Updated Files (1)
- `src/components/layout/Sidebar.tsx` — 급여관리 href 변경: `/payroll` (급여 정산), `/payroll/me` (내 급여명세서)

## Key Technical Details

### 4대보험 비율 (2025)
| 항목 | 근로자 부담 |
|------|------------|
| 국민연금 | 4.5% (상한 590만원) |
| 건강보험 | 3.545% |
| 장기요양 | 건강보험 × 12.81% |
| 고용보험 | 0.9% |
| 소득세 | 8구간 누진 (6%~45%) |
| 지방소득세 | 소득세 × 10% |

### 통상시급 = 월급여 / 209시간

### 이상항목 기준
- 초과근무 > 월 60시간 → WARNING
- 전월 대비 급여 차이 > 20% → ERROR
- 신규 입사자 (일할 계산) → INFO

### 퇴직금 공식
퇴직금 = 3개월 평균임금 × (재직일수/365) — 1년 미만 비해당

---

# CTR HR Hub v3.2 — STEP 7-3 Session Context

**Date:** 2026-02-28
**Status:** STEP 7-3 Complete
**TypeScript Errors:** 0

## What Was Built (STEP 7-3)

알림 시스템 구축 + 전체 QA.
알림 API (목록/읽음/전체읽음/미읽음수), 알림 트리거 설정 CRUD,
헤더 벨 아이콘 Popover 드롭다운, 전체 알림 페이지, 알림 트리거 설정 페이지.

## New Lib Files (2)

| File | Purpose |
|------|---------|
| `src/lib/date-utils.ts` | 상대 시간 포맷 (방금 전 / N분 전 / N시간 전 / N일 전 / yyyy-MM-dd) |
| `src/lib/schemas/notification.ts` | Zod: notificationListSchema, notificationTriggerCreate/UpdateSchema |

## New API Routes (8)

### Notifications (4)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/notifications` | GET | 내 알림 목록 (페이지네이션+필터) |
| `/api/v1/notifications/[id]/read` | PUT | 단건 읽음 처리 |
| `/api/v1/notifications/read-all` | PUT | 전체 읽음 처리 |
| `/api/v1/notifications/unread-count` | GET | 미읽음 수 (헤더 뱃지용) |

### Settings (4)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/settings/notification-triggers` | GET | 트리거 목록 (SETTINGS:VIEW) |
| `/api/v1/settings/notification-triggers` | POST | 트리거 생성 (SETTINGS:CREATE) |
| `/api/v1/settings/notification-triggers/[id]` | PUT | 트리거 수정 (SETTINGS:UPDATE) |
| `/api/v1/settings/notification-triggers/[id]` | DELETE | 트리거 삭제 (SETTINGS:DELETE) |

## New UI Pages & Components (7)

| File | Description |
|------|-------------|
| `src/components/layout/NotificationBell.tsx` | 헤더 벨 아이콘 + Popover 드롭다운 (미읽음 뱃지, 최근 20개, 모두 읽기, 딥링크) |
| `(dashboard)/notifications/page.tsx` | 알림 페이지 서버 컴포넌트 |
| `(dashboard)/notifications/NotificationsClient.tsx` | 알림 페이지 클라이언트 (필터 탭, 읽음/미읽음, 페이지네이션) |
| `(dashboard)/settings/notifications/page.tsx` | 알림 트리거 설정 서버 컴포넌트 |
| `(dashboard)/settings/notifications/NotificationTriggersClient.tsx` | 알림 트리거 CRUD (DataTable, Switch 토글, Dialog) |

## Updated Files (3)

- `src/components/layout/Header.tsx` — stub Bell 버튼을 `<NotificationBell />` 컴포넌트로 교체
- `src/components/layout/Sidebar.tsx` — 시스템설정에 '알림 설정' 메뉴 추가, Bell 아이콘 import
- `context.md` — STEP 7-3 세션 추가

## Project Totals (After STEP 7-3)

| Metric | Count |
|--------|-------|
| API route files | ~151 |
| Dashboard pages | ~73 |
| TypeScript/TSX source files | ~439 |
| Prisma models | 87 |
| Prisma enums | 70+ |

## QA Checklist Results

### B-A. 빌드 + 타입 검증
- `npx tsc --noEmit` = 0 errors
- 미사용 import/변수 정리 완료

### B-B. 인증 + 권한
- 알림 API: getServerSession 기반 인증, employeeId 필터로 본인 알림만 접근
- 알림 트리거 API: withPermission(SETTINGS module) 래퍼 적용
- 읽음 처리: employeeId 일치 검증 후 처리

### B-C. 다법인 데이터 격리
- Notification: employeeId 기반 격리 (자동)
- NotificationTrigger: companyId 필터 + OR null (글로벌 트리거)

### B-D. 감사 로그
- 알림 트리거 CRUD에 logAudit 호출 추가 (create/update/delete)

### Phase 2 기술부채
- AI 기능 통합 테스트 (19개 AiFeature)
- Materialized View 8개 자동 갱신 검증
- E2E 플로우 테스트 (채용→입사→온보딩→성과→보상→퇴직)
- 반응형 UI 검증 (모바일/태블릿)
- 성능 최적화 (페이지네이션, 인덱스, 캐싱)
- FCM/SES 알림 채널 실제 연동 (현재 IN_APP만)
- 국제화 (i18n) 확장 (현재 한국어만)

---

## STEP 6B-2 Session — 복리후생 + L&D + Succession Planning

**Date:** 2026-02-28
**Status:** Complete
**TypeScript Errors:** 0 (7 pre-existing cache-life.d2.ts duplicates excluded)

### 신규 파일 (34개)

#### Zod Schemas (3)
- `src/lib/schemas/benefits.ts` — BenefitPolicy + Enrollment CRUD schemas
- `src/lib/schemas/training.ts` — TrainingCourse + Enrollment CRUD schemas
- `src/lib/schemas/succession.ts` — SuccessionPlan + Candidate CRUD schemas

#### API Routes — Benefits (4)
- `src/app/api/v1/benefits/policies/route.ts` — GET (목록+필터), POST (생성)
- `src/app/api/v1/benefits/policies/[id]/route.ts` — GET, PUT, DELETE (soft)
- `src/app/api/v1/benefits/enrollments/route.ts` — GET (목록), POST (신청)
- `src/app/api/v1/benefits/enrollments/[id]/route.ts` — PUT (상태변경)

#### API Routes — Training (5)
- `src/app/api/v1/training/courses/route.ts` — GET, POST
- `src/app/api/v1/training/courses/[id]/route.ts` — GET, PUT, DELETE (soft)
- `src/app/api/v1/training/enrollments/route.ts` — GET, POST (일괄 등록)
- `src/app/api/v1/training/enrollments/[id]/route.ts` — PUT (상태전환)
- `src/app/api/v1/training/dashboard/route.ts` — GET (KPI)

#### API Routes — Succession (5)
- `src/app/api/v1/succession/plans/route.ts` — GET, POST
- `src/app/api/v1/succession/plans/[id]/route.ts` — GET (상세+후보), PUT, DELETE
- `src/app/api/v1/succession/plans/[id]/candidates/route.ts` — GET, POST
- `src/app/api/v1/succession/candidates/[id]/route.ts` — PUT, DELETE
- `src/app/api/v1/succession/dashboard/route.ts` — GET (KPI)

#### UI — Benefits (4)
- `src/app/(dashboard)/benefits/page.tsx` — 서버 래퍼
- `src/app/(dashboard)/benefits/BenefitsClient.tsx` — 2탭: 정책관리/신청현황
- `src/components/benefits/BenefitPoliciesTab.tsx` — 정책 CRUD DataTable + Dialog
- `src/components/benefits/BenefitEnrollmentsTab.tsx` — 신청 목록 + 상태 뱃지

#### UI — Training (6)
- `src/app/(dashboard)/training/page.tsx` — 서버 래퍼
- `src/app/(dashboard)/training/TrainingClient.tsx` — 2탭: 교육과정/수강현황
- `src/components/training/CoursesTab.tsx` — 과정 CRUD DataTable + Dialog
- `src/components/training/EnrollmentsTab.tsx` — 수강 목록 + 상태전환
- `src/app/(dashboard)/training/enrollments/page.tsx` — 수강현황 별도 페이지
- `src/app/(dashboard)/training/enrollments/TrainingEnrollmentsClient.tsx`

#### UI — Succession (6)
- `src/app/(dashboard)/succession/page.tsx` — 서버 래퍼
- `src/app/(dashboard)/succession/SuccessionClient.tsx` — 2탭: 핵심직책/대시보드
- `src/components/succession/PlansTab.tsx` — 핵심직책 DataTable + 생성 Dialog
- `src/components/succession/PlanDetailDialog.tsx` — 직책 상세 + 후보 관리
- `src/components/succession/SuccessionDashboard.tsx` — KPI + PieChart
- `src/components/succession/CandidateCard.tsx` — 후보자 카드

### 수정 파일 (1)
- `src/components/layout/Sidebar.tsx` — Crown 아이콘 + 후계자 관리 메뉴 추가

### 패턴 준수
- 모든 API: withPermission + perm(MODULE.X, ACTION.Y) + company scope
- 모든 API: logAudit (fire-and-forget) + extractRequestMeta
- Soft delete: BenefitPolicy, TrainingCourse (deletedAt)
- Hard delete: SuccessionPlan, SuccessionCandidate (cascade)
- Decimal→Number 직렬화: amount, durationHours, score
- Employee 필드: name, employeeNo (not firstName/lastName)

---

# CTR HR Hub v3.2 — STEP 8-1 Session Context

**Date:** 2026-02-28
**Status:** STEP 8-1 Complete
**TypeScript Errors:** 0

## What Was Built (STEP 8-1)

Settings 모듈 — 관리자 전용 UI로 법인별 커스터마이징 기능 11개 섹션 구현.

## New Lib Files (1)

| File | Purpose |
|------|---------|
| `src/lib/schemas/settings.ts` | Zod: 22개 스키마 (company, branding, terms, enums, custom-fields, workflows, email-templates, evaluation-scale, modules, export-templates, dashboard-layout) |

## New API Routes (18)

### Foundation API (TenantSetting 직접 수정, 6개)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/settings/company` | GET/PUT | 회사설정 (coreValues, fiscal, probation, overtime, timezone, locale) |
| `/api/v1/settings/branding` | GET/PUT | 브랜딩 (colors + logo/favicon URLs) |
| `/api/v1/settings/branding/upload` | POST | S3 presigned URL 생성 |
| `/api/v1/settings/evaluation-scale` | GET/PUT | 평가 척도 (rating scale + grade labels) |
| `/api/v1/settings/modules` | GET/PUT | 모듈 ON/OFF (enabledModules array) |
| `/api/v1/settings/dashboard-layout` | GET/PUT | 대시보드 레이아웃 (JSON) |

### CRUD API (독립 모델, 12개)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/settings/terms` | GET/POST | 용어 오버라이드 목록 + upsert |
| `/api/v1/settings/terms/[id]` | PUT/DELETE | 용어 수정/삭제 |
| `/api/v1/settings/enums` | GET/POST | ENUM 옵션 목록 + 생성 |
| `/api/v1/settings/enums/[id]` | PUT/DELETE | ENUM 옵션 수정/삭제 (시스템 보호) |
| `/api/v1/settings/custom-fields` | GET/POST | 커스텀 필드 목록 + 생성 |
| `/api/v1/settings/custom-fields/[id]` | GET/PUT/DELETE | 커스텀 필드 상세/수정/소프트삭제 |
| `/api/v1/settings/workflows` | GET/POST | 워크플로 목록 + 트랜잭션 생성 |
| `/api/v1/settings/workflows/[id]` | GET/PUT/DELETE | 워크플로 상세/트랜잭션수정/소프트삭제 |
| `/api/v1/settings/email-templates` | GET/POST | 이메일 템플릿 목록 + 생성 |
| `/api/v1/settings/email-templates/[id]` | GET/PUT/DELETE | 이메일 템플릿 상세/수정/삭제 (시스템 보호) |
| `/api/v1/settings/export-templates` | GET/POST | 내보내기 템플릿 목록 + 생성 |
| `/api/v1/settings/export-templates/[id]` | GET/PUT/DELETE | 내보내기 템플릿 상세/수정/소프트삭제 |

## New UI Pages & Components (22)

| # | Section | page.tsx | Client |
|---|---------|----------|--------|
| 1 | 회사설정 | `settings/page.tsx` | `CompanySettingsClient.tsx` |
| 2 | 브랜딩 | `settings/branding/page.tsx` | `BrandingClient.tsx` |
| 3 | 용어 | `settings/terms/page.tsx` | `TermsClient.tsx` |
| 4 | ENUM | `settings/enums/page.tsx` | `EnumManagementClient.tsx` |
| 5 | 커스텀필드 | `settings/custom-fields/page.tsx` | `CustomFieldsClient.tsx` |
| 6 | 워크플로 | `settings/workflows/page.tsx` | `WorkflowsClient.tsx` |
| 7 | 이메일 | `settings/email-templates/page.tsx` | `EmailTemplatesClient.tsx` |
| 8 | 평가척도 | `settings/evaluation-scale/page.tsx` | `EvaluationScaleClient.tsx` |
| 9 | 모듈 | `settings/modules/page.tsx` | `ModuleToggleClient.tsx` |
| 10 | 내보내기 | `settings/export-templates/page.tsx` | `ExportTemplatesClient.tsx` |
| 11 | 대시보드 | `settings/dashboard-widgets/page.tsx` | `DashboardWidgetsClient.tsx` |

## Updated Files (1)

- `src/components/layout/Sidebar.tsx` — 10개 신규 설정 메뉴 추가 (Palette, Languages, List, FormInput, GitBranch, Mail, Gauge, ToggleLeft, Download, LayoutGrid 아이콘)

## Key Patterns

- TenantSetting PUT 후 `invalidateTenantSettingsCache(companyId)` 호출
- WorkflowRule: `prisma.$transaction` (deleteMany steps → createMany steps)
- S3 presigned URL: `buildS3Key` + `getPresignedUploadUrl`
- Soft delete: CustomField, WorkflowRule, ExportTemplate (deletedAt)
- Hard delete: TermOverride, EmailTemplate
- 시스템 보호: TenantEnumOption.isSystem, EmailTemplate.isSystem → 수정/삭제 차단

---

# STEP 8-2 Session: Task-Centric Home + Manager Hub + HR Chatbot RAG + Command Palette

**Date:** 2026-03-01
**Status:** Complete
**TypeScript Errors:** 0 (new code)

## What Was Built

4대 사용자 경험 고도화 기능: PendingActions 통합, Manager Hub, HR Chatbot RAG, Command Palette 실제 검색.

## Stats

| Category | Count |
|----------|-------|
| 신규 Lib (스키마+유틸) | 7 |
| 신규 API route | 14 |
| 신규 UI (page.tsx + Client) | 5 |
| 수정 (Home 4종 + Chatbot + CommandPalette + Sidebar) | 7 |
| **합계** | **33** |

## New Files

### Lib (7)
- `src/lib/schemas/pending-actions.ts` — pendingActionsQuerySchema
- `src/lib/schemas/hr-chat.ts` — session, message, feedback, document schemas
- `src/lib/schemas/manager-hub.ts` — summary, alerts, performance schemas
- `src/lib/schemas/command-search.ts` — commandSearchSchema
- `src/lib/embedding.ts` — OpenAI text-embedding-3-small + chunkText
- `src/lib/vector-search.ts` — pgvector search/insert/delete (raw SQL)
- `src/lib/pending-actions.ts` — 9+ model virtual aggregation

### API Routes (14)
- `api/v1/home/pending-actions/route.ts` — GET
- `api/v1/home/summary/route.ts` — GET (role-based KPIs)
- `api/v1/manager-hub/summary/route.ts` — GET (KPI 4개)
- `api/v1/manager-hub/pending-approvals/route.ts` — GET
- `api/v1/manager-hub/team-health/route.ts` — GET (5차원 radar)
- `api/v1/manager-hub/alerts/route.ts` — GET (초과근무/번아웃)
- `api/v1/manager-hub/performance/route.ts` — GET (등급분포+MBO)
- `api/v1/hr-chat/sessions/route.ts` — GET/POST
- `api/v1/hr-chat/sessions/[id]/messages/route.ts` — GET/POST (RAG pipeline)
- `api/v1/hr-chat/messages/[id]/feedback/route.ts` — PUT
- `api/v1/hr-chat/messages/[id]/escalate/route.ts` — POST
- `api/v1/hr-documents/route.ts` — GET/POST (chunking+embedding)
- `api/v1/hr-documents/[id]/route.ts` — PUT/DELETE
- `api/v1/search/command/route.ts` — GET

### UI (5 new)
- `src/components/home/PendingActionsPanel.tsx` — 우선순위 카드리스트
- `src/app/(dashboard)/manager-hub/page.tsx` — SSR
- `src/components/manager-hub/ManagerInsightsHub.tsx` — KPI+Radar+Alerts+Performance
- `src/app/(dashboard)/settings/hr-documents/page.tsx` — SSR
- `src/components/hr-chatbot/HrDocumentManager.tsx` — DataTable+Upload+Delete

### Modified (7)
- `EmployeeHome.tsx` — PendingActionsPanel + API summary
- `ManagerHome.tsx` — PendingActionsPanel + API summary
- `HrAdminHome.tsx` — PendingActionsPanel + API summary
- `ExecutiveHome.tsx` — PendingActionsPanel + API summary
- `HrChatbot.tsx` — RAG API, sessions, sources, confidence, escalation
- `CommandPalette.tsx` — Cmd+O, API search, fuzzy menu, recent localStorage
- `Sidebar.tsx` — 매니저 허브 + HR 문서 관리 메뉴

## Key Patterns

- PendingAction: No new DB table — 9+ model virtual aggregation with priority sorting
- RAG: generateEmbedding → searchSimilarChunks → callClaude → confidence parse
- Vector: `prisma.$queryRaw`/`$executeRaw` with pgvector `<=>` operator
- Chunking: 500 token / 100 overlap sentence-based
- apiClient.get/post returns `ApiResponse<T>` → access `.data`
- Command Palette: Cmd+O, fuzzyMatch client-side, localStorage recent (max 5)
