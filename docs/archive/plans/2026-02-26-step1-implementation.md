# CTR HR Hub STEP1 — Initial Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete project skeleton for CTR HR Hub v3.2 — no features, only structure, schema, libs, components, and seed data.

**Architecture:** Next.js 14 App Router with Server Component-first approach. PostgreSQL 16 via Prisma ORM with pgvector. Multi-company RBAC with company_id isolation. All customization driven by tenant_settings → DB enum → never hardcode.

**Tech Stack:** Next.js 14, TypeScript strict, Tailwind CSS, shadcn/ui, Prisma, PostgreSQL 16, NextAuth.js (M365 SSO), Redis, Zod v4, date-fns, AWS S3

**Spec References (ALWAYS consult during implementation):**
- `/Users/sangwoo/Documents/VibeCoding/HR_Hub/Script/STEP0_공통규칙.txt` — Global rules
- `/Users/sangwoo/Documents/VibeCoding/HR_Hub/Script/STEP1_초기세팅.txt` — Full STEP1 spec (lines 1-1381)
- `/Users/sangwoo/Documents/VibeCoding/HR_Hub/Script/CTR_HR_Hub_ERD_Phase1_v3_2.mermaid` — ERD

---

## Task 1: Project Initialization

**Goal:** Create Next.js 14 project with all dependencies.

**Step 1: Create Next.js project**

```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub
npx create-next-app@14 ctr-hr-hub \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm
```

**Step 2: Install core dependencies**

```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub
npm install prisma @prisma/client next-auth @auth/prisma-adapter \
  zod react-hook-form @hookform/resolvers date-fns \
  @aws-sdk/client-s3 @aws-sdk/s3-request-presigner \
  ioredis @anthropic-ai/sdk cmdk firebase-admin @aws-sdk/client-ses \
  uuid class-variance-authority clsx tailwind-merge lucide-react
npm install -D @types/uuid prisma
```

**Step 3: Initialize shadcn/ui**

```bash
npx shadcn@latest init
# Select: New York style, Slate color, CSS variables: yes
```

Add commonly needed shadcn components:

```bash
npx shadcn@latest add button input label card dialog select \
  dropdown-menu table badge avatar separator sheet tabs \
  toast tooltip popover command calendar checkbox switch \
  form textarea scroll-area skeleton alert
```

**Step 4: Configure TypeScript strict mode**

File: `tsconfig.json` — Ensure `"strict": true` is set.

**Step 5: Configure Tailwind with CTR brand colors**

File: `tailwind.config.ts` — Add CTR brand colors:
```
ctr-primary: '#003087'
ctr-accent: '#E30613'
ctr-gray-50/100/200/300/500/700/900
```
Plus CSS variable references: `--brand-primary`, `--brand-secondary`, `--brand-accent`

**Step 6: Create `.env.example`**

File: `.env.example` — Copy from STEP0 spec (lines 341-381).

**Step 7: Create `.env.local`**

File: `.env.local` — Copy `.env.example` with local dev values (localhost DB, Redis, etc.)

**Step 8: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

**Step 9: Verify**

```bash
npm run dev  # Should start on localhost:3000
```

**Step 10: Commit**

```bash
git init && git add -A && git commit -m "feat: project init with Next.js 14, Tailwind, shadcn/ui, Prisma"
```

---

## Task 2: Folder Structure

**Goal:** Create the complete directory tree from STEP0.

**Step 1: Create all directories**

Reference: STEP0 lines 125-211 for the full tree.

```
src/app/(auth)/login/
src/app/(dashboard)/
src/app/(dashboard)/employees/
src/app/(dashboard)/org/
src/app/(dashboard)/attendance/
src/app/(dashboard)/leave/
src/app/(dashboard)/recruitment/
src/app/(dashboard)/performance/
src/app/(dashboard)/payroll/
src/app/(dashboard)/compensation/
src/app/(dashboard)/analytics/
src/app/(dashboard)/onboarding/
src/app/(dashboard)/offboarding/
src/app/(dashboard)/discipline/
src/app/(dashboard)/benefits/
src/app/(dashboard)/settings/
src/app/403/
src/app/api/auth/
src/app/api/v1/employees/
src/app/api/v1/org/
src/app/api/v1/attendance/
src/app/api/v1/attendance/terminal/
src/app/api/v1/leave/
src/app/api/v1/recruitment/
src/app/api/v1/performance/
src/app/api/v1/payroll/
src/app/api/v1/compensation/
src/app/api/v1/analytics/
src/app/api/v1/onboarding/
src/app/api/v1/offboarding/
src/app/api/v1/discipline/
src/app/api/v1/benefits/
src/app/api/v1/notifications/
src/app/api/v1/files/
src/app/api/v1/ai/
src/app/api/v1/home/
src/components/ui/          (already from shadcn)
src/components/layout/
src/components/home/
src/components/icons/
src/components/shared/
src/components/command-palette/
src/components/hr-chatbot/
src/lib/labor/
src/lib/i18n/
src/lib/schemas/
src/hooks/
src/types/
prisma/migrations/
```

**Step 2: Create placeholder files**

- `src/types/index.ts` — empty export
- `src/hooks/.gitkeep`
- `src/app/403/page.tsx` — 403 forbidden page
- `src/app/error.tsx` — global error boundary

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: create full directory structure per STEP0"
```

---

## Task 3: Prisma Schema — Enums

**Goal:** Define all 30+ enums in schema.prisma.

**File:** `prisma/schema.prisma`

**Step 1: Write all enums**

Reference: STEP1 spec lines 40-900 — extract every ENUM definition.

Enums to define (complete list):
```
CompanyPayrollMode, JobCategoryCode, OrgChangeType,
EmploymentType, EmployeeStatus, HistoryChangeType, DocType,
OffboardingTargetType, OffboardingAssignee, ResignType, OffboardingStatus,
TaskStatus, ExitReason,
DisciplinaryType, DisciplinaryCategory, AppealStatus, RewardType,
OnboardingTargetType, OnboardingAssignee, OnboardingProgressStatus,
TaskProgressStatus, OnboardingTaskCategory, Mood,
ScheduleType, ClockMethod, WorkType, AttendanceStatus, TerminalType,
LeaveType, LeaveRequestStatus,
PostingStatus, ApplicantSource, ApplicationStage,
InterviewStatus, InterviewRecommendation,
CycleHalf, CycleStatus, GoalStatus, EvalType, EvalStatus,
OneOnOneStatus, CalibrationStatus,
CompensationChangeType,
BenefitCategory, BenefitFrequency, BenefitEnrollmentStatus, AllowanceType,
PayrollStatus,
NotificationChannel, AiFeature,
TrainingCategory, EnrollmentStatus,
PulseScope, AnonymityLevel, PulseStatus, QuestionType,
ChangeRequestStatus,
Criticality, PlanStatus, Readiness,
HrDocType, ChatRole, ChatFeedback,
CollabScoreType, NominationSource, NominationStatus,
CustomFieldType, ApproverType, TemplateChannel, ExportFormat
```

**Step 2: Verify syntax**

```bash
npx prisma format
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma && git commit -m "feat: define all Prisma enums (30+)"
```

---

## Task 4: Prisma Schema — Models (Part 1: Organization & Auth)

**Goal:** Define organization, auth, and employee core models.

**File:** `prisma/schema.prisma`

**Reference:** STEP1 lines 38-164

**Models:**
- `Company` (with self-relation parent_company_id)
- `Department` (with self-relation parent_id, @@unique company_id+code)
- `JobGrade`
- `JobCategory`
- `Role`
- `Permission`
- `RolePermission` (@@unique role_id+permission_id)
- `EmployeeRole` (@@unique employee_id+role_id+company_id)
- `OrgChangeHistory`
- `Employee` (all fields from spec lines 99-115)
- `EmployeeAuth`
- `SsoIdentity` (@@unique provider+provider_account_id)
- `SsoSession`
- `EmployeeHistory`
- `EmployeeDocument`

**Every model MUST have:**
- `id String @id @default(uuid())` for PK
- `@@map("table_name")` with snake_case table name
- All field names in camelCase, mapped to snake_case via `@map()`
- `deletedAt DateTime? @map("deleted_at")` where applicable
- All FK relations properly defined

**Verify:** `npx prisma format`

**Commit:** `git add prisma/schema.prisma && git commit -m "feat: add org, auth, employee core models"`

---

## Task 5: Prisma Schema — Models (Part 2: HR Processes)

**Goal:** Define onboarding, offboarding, discipline, attendance, leave models.

**File:** `prisma/schema.prisma`

**Reference:** STEP1 lines 166-338

**Models:**
- `OffboardingChecklist`, `OffboardingTask`, `EmployeeOffboarding`, `EmployeeOffboardingTask`, `ExitInterview`
- `DisciplinaryAction`, `RewardRecord`
- `OnboardingTemplate`, `OnboardingTask`, `EmployeeOnboarding`, `EmployeeOnboardingTask`, `OnboardingCheckin`
- `WorkSchedule`, `EmployeeSchedule`, `Attendance`, `AttendanceTerminal`
- `LeavePolicy`, `EmployeeLeaveBalance` (@@unique), `LeaveRequest`, `Holiday` (@@unique)

**Verify:** `npx prisma format`

**Commit:** `git add prisma/schema.prisma && git commit -m "feat: add HR process models (onboarding, offboarding, discipline, attendance, leave)"`

---

## Task 6: Prisma Schema — Models (Part 3: Recruitment & Performance)

**Goal:** Define recruitment, performance, CFR, calibration models.

**File:** `prisma/schema.prisma`

**Reference:** STEP1 lines 342-491

**Models:**
- `JobPosting`, `Applicant`, `Application` (@@unique), `InterviewSchedule`, `InterviewEvaluation`, `CompetencyLibrary`
- `PerformanceCycle`, `MboGoal`, `MboProgress`, `PerformanceEvaluation`, `EmsBlockConfig`
- `OneOnOne`, `Recognition`
- `CalibrationRule` (@@unique), `CalibrationSession`, `CalibrationAdjustment`

**Verify:** `npx prisma format`

**Commit:** `git add prisma/schema.prisma && git commit -m "feat: add recruitment, performance, CFR, calibration models"`

---

## Task 7: Prisma Schema — Models (Part 4: Compensation, Payroll, Support)

**Goal:** Define compensation, benefits, payroll, notification, AI, L&D, pulse, succession, attrition models.

**File:** `prisma/schema.prisma`

**Reference:** STEP1 lines 494-693

**Models:**
- `SalaryBand`, `CompensationHistory`, `SalaryAdjustmentMatrix`
- `BenefitPolicy`, `EmployeeBenefit`, `AllowanceRecord`
- `PayrollRun`, `PayrollItem`
- `NotificationTrigger`, `Notification`
- `AiLog`
- `TrainingCourse`, `TrainingEnrollment` (@@unique)
- `PulseSurvey`, `PulseQuestion`, `PulseResponse`
- `ProfileChangeRequest`
- `SuccessionPlan`, `SuccessionCandidate`
- `AttritionRiskHistory`
- `AuditLog`

**Verify:** `npx prisma format`

**Commit:** `git add prisma/schema.prisma && git commit -m "feat: add compensation, payroll, L&D, pulse, succession models"`

---

## Task 8: Prisma Schema — Models (Part 5: v3.2 Additions)

**Goal:** Define v3.2 chatbot, peer review, and customization models.

**File:** `prisma/schema.prisma`

**Reference:** STEP1 lines 708-943

**Models:**
- `HrDocument`, `HrDocumentChunk` (note: embedding field as `Unsupported("vector(1536)")` since Prisma doesn't natively support pgvector)
- `HrChatSession`, `HrChatMessage`
- `CollaborationScore` (unique composite index)
- `PeerReviewNomination` (unique composite index)
- `TenantSetting` (company_id unique)
- `TermOverride` (unique company_id+term_key)
- `TenantEnumOption` (unique company_id+enum_group+option_key)
- `CustomField` (unique company_id+entity_type+field_key)
- `CustomFieldValue` (unique field_id+entity_id)
- `WorkflowRule` (unique company_id+workflow_type+name)
- `WorkflowStep` (unique rule_id+step_order)
- `EmailTemplate` (unique company_id+event_type+channel+locale)
- `ExportTemplate` (unique company_id+entity_type+name)

**Verify:** `npx prisma format`

**Commit:** `git add prisma/schema.prisma && git commit -m "feat: add v3.2 chatbot, peer review, customization models"`

---

## Task 9: Prisma DB Push

**Goal:** Push schema to database and verify.

**Step 1: Ensure PostgreSQL is running**

```bash
# Check local PostgreSQL
psql -U postgres -c "SELECT 1;"
```

**Step 2: Create database**

```bash
psql -U postgres -c "CREATE DATABASE ctr_hr_hub;"
```

**Step 3: Enable pgvector extension**

```bash
psql -U postgres -d ctr_hr_hub -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Step 4: Push schema**

```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub
npx prisma db push
```

**Step 5: Generate Prisma client**

```bash
npx prisma generate
```

**Step 6: Verify — count tables**

```bash
psql -U postgres -d ctr_hr_hub -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
```

Expected: 85+ tables

**Commit:** `git add prisma/ && git commit -m "feat: prisma db push successful — 85+ tables"`

---

## Task 10: Common Lib Files (Part 1: Foundation)

**Goal:** Create foundation lib files with no inter-dependencies.

**Files to create:**

### `src/lib/env.ts`
- Type-safe environment variable access
- Required: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, AZURE_AD_CLIENT_ID/SECRET/TENANT_ID
- Optional: REDIS_URL, S3 vars, ANTHROPIC_API_KEY, etc.
- Throw on missing required vars in production

### `src/lib/errors.ts`
- `AppError` class extending Error
- Properties: statusCode, code, message, details
- Factory methods: notFound(), forbidden(), badRequest(), unauthorized(), conflict()
- Prisma error handler: handlePrismaError(error) — P2002 → conflict, P2025 → notFound

### `src/lib/prisma.ts`
- Singleton PrismaClient
- Global cache for dev hot-reload

### `src/lib/api.ts`
- Server: `apiSuccess(data, status?)`, `apiError(error)`, `apiPaginated(data, pagination)`
- Client: `apiClient` with `get<T>`, `getList<T>`, `post<T>`, `put<T>`, `delete<T>` methods
- All use `fetch` internally, handle errors consistently

### `src/lib/constants.ts`
- Permission module/action constants
- Role code constants: SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE, EXECUTIVE
- Default page sizes, date formats, etc.

### `src/lib/i18n/ko.ts`
- Korean string constants organized by module
- Error messages, labels, button texts

### `src/types/index.ts`
- Shared TypeScript types
- `Permission` type, `SessionUser` type, `ApiResponse<T>`, `PaginatedResponse<T>`
- Re-export Prisma generated types as needed

**Verify:** `npx tsc --noEmit` (may have some errors — track them)

**Commit:** `git add src/lib/ src/types/ && git commit -m "feat: add foundation lib files (env, errors, prisma, api, constants, i18n)"`

---

## Task 11: Common Lib Files (Part 2: Auth & Permissions)

**Goal:** Create auth and permission system.

### `src/lib/auth.ts`
- NextAuth configuration
- Microsoft Entra ID Provider (Azure AD)
- Custom session callback: include employeeId, permissions, companyId
- JWT strategy
- Sign-in callback: look up employee by SSO email, attach roles/permissions

### `src/lib/permissions.ts`
- `requirePermission(session, permission)` — throws 403 if not allowed
- `withPermission(handler, permission)` — API route wrapper
- `hasPermission(session, permission)` — boolean check
- `getPermissionsForRole(roleId)` — DB lookup with cache
- Company-scoped permission check: verify user has role for the target company_id

### `src/lib/audit.ts`
- `logAudit({ actorId, action, resourceType, resourceId, companyId, changes, ip, userAgent })`
- Creates AuditLog record via Prisma
- Non-blocking (fire and forget with error logging)

**Commit:** `git add src/lib/ && git commit -m "feat: add auth, permissions, audit lib files"`

---

## Task 12: Common Lib Files (Part 3: External Services)

**Goal:** Create S3, Redis, Claude, terminal integration libs.

### `src/lib/s3.ts`
- `getPresignedUploadUrl(key, contentType, expiresIn?)` — for direct upload
- `getPresignedDownloadUrl(key, expiresIn?)` — for secure download
- `deleteObject(key)` — soft delete support
- S3Client singleton

### `src/lib/redis.ts`
- Redis client singleton (ioredis)
- `cacheGet<T>(key)`, `cacheSet(key, value, ttlSeconds?)`, `cacheDel(key)`
- Connection error handling (graceful degradation)

### `src/lib/claude.ts`
- Anthropic client singleton
- `callClaude({ feature, prompt, systemPrompt?, maxTokens? })` — returns response + logs to ai_logs
- `logAiCall({ feature, promptVersion, inputTokens, outputTokens, latencyMs, model })`
- Error handling: 503 on API failure

### `src/lib/terminal.ts`
- Terminal auth verification: `verifyTerminalSecret(secret)`
- Terminal heartbeat tracking

### `src/lib/attrition.ts`
- Attrition risk calculation stub
- `calculateAttritionRisk(employeeId)` — placeholder returning default score

### `src/lib/labor/index.ts` + `kr.ts` + stubs for `us.ts`, `cn.ts`, `ru.ts`, `vn.ts`, `eu.ts`, `mx.ts`
- Interface: `LaborModule { getOvertimeLimit(), getMinWage(), validateWorkHours() }`
- `kr.ts` with basic Korean labor law constants (52h/week max, etc.)
- Other countries: stub implementations

**Commit:** `git add src/lib/ && git commit -m "feat: add external service libs (s3, redis, claude, terminal, labor)"`

---

## Task 13: Common Lib Files (Part 4: v3.2 Customization)

**Goal:** Create v3.2 customization helper libs.

**Reference:** STEP1 lines 1267-1305

### `src/lib/terms.ts`
- `DEFAULT_TERMS` map: department→부서, job_grade→직급, etc. (14 keys)
- `getTermLabel(companyId, key, locale?)` — check term_overrides → fallback to default
- `useTerms(companyId)` — React hook (SWR-based)
- In-memory cache: `Map<companyId, Map<termKey, label>>`

### `src/lib/tenant-settings.ts`
- `getTenantSettings(companyId)` — fetch from DB with Redis cache (5min TTL)
- `isModuleEnabled(companyId, module)` — check enabled_modules array
- `getCoreValues(companyId)` — parse core_values JSON
- `getRatingScale(companyId)` — { min, max, labels }
- `getBrandColors(companyId)` — { primary, secondary, accent }

### `src/lib/enum-options.ts`
- `getEnumOptions(companyId, enumGroup)` — fetch active options, sorted by sort_order
- `useEnumOptions(companyId, enumGroup)` — React hook (SWR)

### `src/lib/workflow.ts`
- `getApplicableWorkflow(companyId, workflowType, context?)` — find matching rule + steps
- `getNextApprover(workflowRuleId, currentStep, employeeId)` — resolve approver
- `isApprovalComplete(entityId, workflowType)` — check all steps done

### `src/lib/custom-fields.ts`
- `getCustomFields(companyId, entityType)` — fetch field definitions
- `getCustomFieldValues(entityId, entityType)` — fetch values
- `saveCustomFieldValues(entityId, entityType, values)` — upsert values

**Commit:** `git add src/lib/ && git commit -m "feat: add v3.2 customization libs (terms, tenant-settings, enum-options, workflow, custom-fields)"`

---

## Task 14: Zod Schemas

**Goal:** Create base Zod validation schemas.

**File:** `src/lib/schemas/employee.ts`

- `employeeCreateSchema` — validate employee creation
- `employeeUpdateSchema` — validate employee update (all fields optional)
- `employeeSearchSchema` — validate search params (page, limit, search, filters)

**File:** `src/lib/schemas/common.ts`

- `paginationSchema` — page, limit with defaults
- `uuidSchema` — UUID validation
- `dateRangeSchema` — startDate, endDate

**Note:** Use Zod v4 syntax (`schema.safeParse(data).error?.issues` not `.errors`)

**Commit:** `git add src/lib/schemas/ && git commit -m "feat: add base Zod validation schemas"`

---

## Task 15: Common Components (Part 1: Simple Components)

**Goal:** Create simple shared components.

### `src/components/shared/LoadingSpinner.tsx`
- Props: `size?: 'sm' | 'md' | 'lg'`, `fullPage?: boolean`
- Full page: centered with backdrop, inline: just the spinner

### `src/components/shared/EmptyState.tsx`
- Props: `icon?: ReactNode`, `title: string`, `description?: string`, `action?: { label: string, onClick: () => void }`
- Centered layout with muted text

### `src/components/shared/AiGeneratedBadge.tsx`
- Small badge: "AI 생성" with robot icon
- Tooltip: "AI가 생성한 내용입니다"

### `src/components/shared/PageHeader.tsx`
- Props: `title: string`, `description?: string`, `actions?: ReactNode`
- Consistent page header with optional action buttons

### `src/components/shared/PermissionGate.tsx`
- **Server Component**
- Props: `permission: string`, `children: ReactNode`, `fallback?: ReactNode`
- Check session permissions, render children or null/fallback

### `src/components/shared/DataTable.tsx`
- Generic data table wrapper using shadcn Table
- Props: `columns`, `data`, `pagination?`, `onSort?`, `loading?`
- Handles empty state, loading skeleton, pagination controls

**Commit:** `git add src/components/shared/ && git commit -m "feat: add simple shared components"`

---

## Task 16: Common Components (Part 2: Complex Components)

**Goal:** Create complex shared components.

### `src/components/shared/CompanySelector.tsx`
- 'use client' component
- Dropdown showing companies user has access to
- HR_ADMIN/EXECUTIVE/SUPER_ADMIN: all companies + "그룹 합산"
- MANAGER/EMPLOYEE: own company only
- Selected company → URL param company_id + session cache
- Placed in header right side

### `src/components/command-palette/CommandPalette.tsx`
- 'use client' component using `cmdk` library
- Cmd+O / Ctrl+O trigger
- 4 search categories: employees, menus, HR policies, recent
- Keyboard navigation: ↑↓ Enter Esc
- Debounce 200ms
- Category grouping, max 3 per category

### `src/components/hr-chatbot/HrChatbot.tsx`
- 'use client' component
- Floating button (bottom-right, z-index 50)
- Chat panel (360×500px, mobile fullscreen)
- Message bubbles (user right, AI left)
- Source citations inline
- Feedback buttons (thumbs up/down)
- Escalation button
- Session management stub

### `src/components/shared/CustomFieldsSection.tsx`
- Props: `companyId`, `entityType`, `entityId?`, `mode: 'view' | 'edit'`
- Auto-load custom_fields → render type-appropriate inputs
- TEXT→Input, NUMBER→NumberInput, DATE→DatePicker, SELECT→Select, etc.

### `src/components/shared/ModuleGate.tsx`
- Props: `module: string`, `companyId: string`, `children: ReactNode`
- Check enabled_modules, render children or null

### `src/components/shared/BrandProvider.tsx`
- 'use client' provider component
- Load tenant_settings brand colors
- Inject CSS variables: --brand-primary, --brand-secondary, --brand-accent

**Commit:** `git add src/components/ && git commit -m "feat: add complex shared components (CompanySelector, CommandPalette, HrChatbot, etc.)"`

---

## Task 17: Layout Components

**Goal:** Create dashboard layout with sidebar and header.

### `src/components/layout/Sidebar.tsx`
- CTR branding: bg-ctr-primary, white text
- Logo + slogan "Central to your safe mobility"
- Navigation items filtered by permissions + enabled_modules
- Module sections: Core HR, Attendance, Leave, Performance, etc.
- Active item highlight
- Collapse/expand

### `src/components/layout/Header.tsx`
- Breadcrumb
- CompanySelector (right side)
- User avatar + dropdown (profile, settings, logout)
- Notification bell

### `src/app/(dashboard)/layout.tsx`
- Server Component
- Get session → redirect if not authenticated
- Sidebar + Header + main content area
- Wrap with BrandProvider

### `src/app/providers.tsx`
- Client providers wrapper (SessionProvider, etc.)

### `src/app/layout.tsx`
- Root layout with providers, fonts, metadata

**Commit:** `git add src/components/layout/ src/app/ && git commit -m "feat: add dashboard layout with sidebar and header"`

---

## Task 18: Auth Pages & API

**Goal:** Configure NextAuth and login page.

### `src/app/api/auth/[...nextauth]/route.ts`
- Export GET, POST handlers from NextAuth

### `src/app/(auth)/login/page.tsx`
- Split layout: left half bg-ctr-primary (logo + slogan), right half white (login form)
- M365 SSO login button
- Dev mode: test account selector (4 accounts from seed)

**Commit:** `git add src/app/ && git commit -m "feat: add NextAuth config and login page"`

---

## Task 19: Role-Based Home Pages

**Goal:** Create role-based home layout shells.

**Reference:** STEP1 lines 1329-1333

### `src/app/(dashboard)/page.tsx` (Server Component)
- Get session → determine role → render appropriate home client component

### `src/components/home/EmployeeHome.tsx`
- Shell with placeholder cards: 출퇴근 버튼, 내 휴가 잔여, 최근 Recognition, 온보딩 진행률

### `src/components/home/ManagerHome.tsx`
- Shell: 팀 근태 현황, 팀 휴가 달력, 1:1 일정, 팀 성과 요약

### `src/components/home/HrAdminHome.tsx`
- Shell: 전사 인원 현황, 채용 파이프라인, 이직 위험 Top 5, 퇴직 진행 현황

### `src/components/home/ExecutiveHome.tsx`
- Shell: 핵심 KPI 카드 (인원/이직률/성과분포/인건비), AI 인사이트

### `src/app/403/page.tsx`
- 403 Forbidden page

### `src/app/error.tsx`
- Global error boundary

**Commit:** `git add src/app/ src/components/home/ && git commit -m "feat: add role-based home page shells"`

---

## Task 20: Core Value Icons

**Goal:** Create CTR core value icon components.

### `src/components/icons/CoreValueIcons.tsx`
- 4 icon components: ChallengeIcon, TrustIcon, ResponsibilityIcon, RespectIcon
- SVG-based, accept size and color props
- Used in Recognition, home dashboard, empty states

**Commit:** `git add src/components/icons/ && git commit -m "feat: add CTR core value icon components"`

---

## Task 21: Seed Data (Part 1: Companies, Roles, Permissions)

**Goal:** Create seed script foundation.

**File:** `prisma/seed.ts`

**Reference:** STEP1 lines 1096-1128

**Step 1: Add seed script to package.json**

```json
"prisma": { "seed": "npx tsx prisma/seed.ts" }
```

Install tsx: `npm install -D tsx`

**Step 2: Write seed for:**
- 13 companies (CTR Holdings → 12 subsidiaries with parent relations)
- 5 system roles (SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE, EXECUTIVE)
- 66 permissions (11 modules × 6 actions)
- Role-permission mappings per spec lines 1124-1128
- 4 job categories per company (OFFICE, PRODUCTION, R_AND_D, MANAGEMENT)

**Step 3: Run and verify**

```bash
npx prisma db seed
```

**Commit:** `git add prisma/seed.ts package.json && git commit -m "feat: seed companies, roles, permissions, job categories"`

---

## Task 22: Seed Data (Part 2: Test Accounts & Templates)

**Goal:** Seed test accounts and HR templates.

**Reference:** STEP1 lines 1149-1169

**Extend `prisma/seed.ts`:**
- 4 test employees + employee_auth + employee_roles + sso_identities
- Job grades for CTR-KR (임원/부장/차장/과장/대리/사원)
- 1 onboarding template (CTR-KR, NEW_HIRE) + 6 tasks
- 1 offboarding checklist (CTR-KR, VOLUNTARY) + 8 tasks
- 1 EMS block config (CTR default — 9 blocks)
- Salary bands (CTR-KR, 6 grades)
- 3 benefit policies (CTR-KR: meal, transport, health)
- 7 notification triggers
- Korean holidays 2025-2026

**Run and verify:** `npx prisma db seed`

**Commit:** `git add prisma/seed.ts && git commit -m "feat: seed test accounts, templates, salary bands, benefits, holidays"`

---

## Task 23: Seed Data (Part 3: v3.2 Customization Data)

**Goal:** Seed all v3.2 customization data.

**Reference:** STEP1 lines 1177-1225

**Extend `prisma/seed.ts`:**
- 13 tenant_settings records (one per company)
  - CTR-KR: all modules enabled
  - Overseas: basic modules only
  - Brand colors, rating scales, grade labels per spec
- 14 term keys × 13 companies (term_overrides — default labels per locale)
- ~60 tenant_enum_options (is_system=true):
  - leave_type 7, employment_type 4, disciplinary_type 7, reward_type 7,
    exit_reason 8, training_category 6, benefit_category 9, clock_method 5
- 4 workflow_rules (CTR-KR) + corresponding workflow_steps
- ~15 email_templates (CTR-KR, ko, is_system=true)
- 3 export_templates (EMPLOYEE, ATTENDANCE, PAYROLL defaults)

**Run and verify:** `npx prisma db seed`

**Commit:** `git add prisma/seed.ts && git commit -m "feat: seed v3.2 customization data (tenant settings, enums, workflows, templates)"`

---

## Task 24: Materialized Views SQL

**Goal:** Create MV SQL file with all 8 views.

**File:** `prisma/migrations/mv_analytics.sql`

**Reference:** STEP1 lines 946-1089

**Content:**
1. `mv_headcount_daily` + UNIQUE INDEX
2. `mv_attendance_weekly` + UNIQUE INDEX
3. `mv_performance_summary` + UNIQUE INDEX
4. `mv_recruitment_funnel` + UNIQUE INDEX
5. `mv_burnout_risk` + UNIQUE INDEX (full SQL in spec lines 970-1026)
6. `mv_team_health` + UNIQUE INDEX
7. `mv_exit_reason_monthly` + UNIQUE INDEX (full SQL in spec lines 1034-1049)
8. `mv_compa_ratio_distribution` + UNIQUE INDEX (full SQL in spec lines 1053-1077)

Plus pg_cron schedule commands (spec lines 1081-1089).
Plus `CREATE EXTENSION IF NOT EXISTS vector;` at top.

**Commit:** `git add prisma/migrations/ && git commit -m "feat: add 8 materialized views SQL with indexes and pg_cron schedules"`

---

## Task 25: Type Check & Final Verification

**Goal:** Ensure zero TypeScript errors and everything works.

**Step 1: Type check**

```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub
npx tsc --noEmit
```

Fix any errors. Known acceptable: Prisma pgvector `Unsupported` type warnings.

**Step 2: Dev server**

```bash
npm run dev
```

Verify: localhost:3000 loads without crash.

**Step 3: Prisma studio**

```bash
npx prisma studio
```

Verify: all 85+ tables visible with seed data.

**Step 4: Final commit**

```bash
git add -A && git commit -m "feat: STEP1 complete — all type errors resolved"
```

---

## Task 26: Create context.md

**Goal:** Document session results per spec requirement.

**File:** `context.md` (project root)

**Content:**
- All created files (full paths)
- Table count (85+)
- Seed data counts per entity
- Environment variables list
- MV list + index status
- Known issues/limitations

**Commit:** `git add context.md && git commit -m "docs: add context.md with STEP1 completion status"`

---

## Task 27: Update launch.json

**Goal:** Create dev server config for preview tools.

**File:** `.claude/launch.json`

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

**Commit:** `git add .claude/ && git commit -m "chore: add launch.json for dev server"`

---

## Completion Checklist

- [ ] Next.js 14 + TypeScript strict + Tailwind + shadcn/ui
- [ ] Full folder structure per STEP0
- [ ] 85+ Prisma models + 30+ enums
- [ ] prisma db push successful
- [ ] ~25 lib files created
- [ ] ~12 shared components created
- [ ] Seed: 13 companies, 5 roles, 66 permissions, 4 test accounts
- [ ] Seed: templates, salary bands, benefits, holidays
- [ ] Seed: v3.2 tenant settings, enum options, workflows, email templates
- [ ] 4 role-based home shells
- [ ] 8 MV SQL + unique indexes + pg_cron
- [ ] Login page (M365 SSO + dev test accounts)
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] Dev server starts successfully
- [ ] context.md written
