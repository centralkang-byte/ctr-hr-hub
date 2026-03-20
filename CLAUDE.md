# CTR HR Hub — Project Guide

> **Project**: CTR Integrated HR Management System (HR SaaS)
> **Path**: `/Users/sangwoo/VibeCoding/HR_Hub/ctr-hr-hub`
> **State Reference**: `~/Documents/Obsidian Vault/projects/hr-hub/STATUS.md` (Obsidian-managed, auto-loaded on session start via hook)

---

## Project Memory (Obsidian)

- **Status file**: `~/Documents/Obsidian Vault/projects/hr-hub/STATUS.md` — single source of truth for completion history, current phase, and next steps
- **Decisions log**: `~/Documents/Obsidian Vault/projects/hr-hub/decisions/`
- **Session notes**: `~/Documents/Obsidian Vault/projects/hr-hub/sessions/`

## Hooks

- **SessionStart**: Runs `.claude/hooks/session-start.sh` → loads STATUS.md automatically

## Design Review Flow

For non-trivial features or architecture changes:
1. Write design doc → `~/Documents/Obsidian Vault/projects/hr-hub/decisions/YYYY-MM-DD-<topic>.md`
2. Request Gemini review: paste the design doc and ask for critique (architecture trade-offs, edge cases, scalability)
3. Incorporate feedback → update the design doc with decisions and rationale
4. Proceed with implementation

Use `/plan-eng-review` for internal architecture review, Gemini for external second opinion.

## Session End Routine

When the user says "STATUS.md 업데이트해줘" or ends a session:
1. Update `~/Documents/Obsidian Vault/projects/hr-hub/STATUS.md` — move completed items, update in-progress, add new remaining work
2. Create `~/Documents/Obsidian Vault/projects/hr-hub/sessions/YYYY-MM-DD.md` — session summary with what was done, decisions made, and blockers encountered

---

## Environment Setup

```bash
node -v  # Must be 20.x (see .nvmrc)
cp .env.example .env.local
# Fill in: DATABASE_URL, NEXTAUTH_SECRET, AZURE_AD_*, REDIS_URL, AWS_*, ANTHROPIC_API_KEY
npm install
npx prisma generate
npx prisma migrate dev
npm run dev  # http://localhost:3002
```

Required env vars: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `REDIS_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `ANTHROPIC_API_KEY`

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | **Next.js 15** (App Router, `force-dynamic` dashboard layout) |
| Language | **TypeScript 5** (strict mode, path alias `@/*` → `./src/*`) |
| ORM | **Prisma 7** with `@prisma/adapter-pg` (PostgreSQL driver adapter) |
| Database | **PostgreSQL** (Supabase-hosted) with pgvector |
| Auth | **NextAuth 4** — Azure AD SSO + Credentials (email-only, dev) |
| UI | **Radix UI** + **Tailwind CSS 3** + `cn()` utility (shadcn/ui pattern) |
| Forms | **React Hook Form** + **Zod 4** validation |
| Charts | **Recharts 3** |
| i18n | **next-intl** — 5 locales (ko/en/zh/vi/es) × 14+ namespaces |
| Cache | **Redis** (ioredis) + **SWR** |
| Storage | **AWS S3** (presigned URLs) |
| AI | **Anthropic SDK** (Claude) + OpenAI embeddings |
| Monitoring | **Sentry** (@sentry/nextjs) |
| Testing | **Playwright** (E2E smoke tests) |

---

## Commands

```bash
npm run dev          # Dev server (port 3002)
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check (MUST pass before commit)
npm run test:e2e     # Playwright E2E tests

# Database
npx prisma generate  # Generate Prisma client (after schema changes)
npx prisma migrate dev --name <name>  # Create migration
npx tsx prisma/seed.ts               # Run all seeds
npx tsx scripts/run-qa-seed.ts       # QA accounts only

# Utilities
npx tsx scripts/verify-qa-accounts.ts   # Verify QA account DB state
npx tsx scripts/verify-leave-balance.ts  # Verify leave balances
```

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/          # Login page (M365 SSO + dev accounts)
│   ├── (dashboard)/           # All HR modules (33 modules)
│   │   ├── analytics/         # Workforce analytics, AI reports, predictive
│   │   ├── approvals/         # Approval workflows
│   │   ├── attendance/        # Attendance mgmt, shift calendar
│   │   ├── benefits/          # Employee benefits
│   │   ├── compensation/      # Compensation management
│   │   ├── compliance/        # GDPR, data retention, DPIA
│   │   ├── delegation/        # Authority delegation
│   │   ├── directory/         # Employee directory
│   │   ├── discipline/        # Disciplinary actions
│   │   ├── home/              # Dashboard home
│   │   ├── leave/             # Leave management
│   │   ├── manager-hub/       # Manager tools hub
│   │   ├── my/                # My profile, my leave, my tasks
│   │   ├── offboarding/       # Offboarding workflows
│   │   ├── onboarding/        # Onboarding workflows
│   │   ├── org-studio/        # Org chart studio
│   │   ├── payroll/           # Payroll, settlement, simulation
│   │   ├── performance/       # Performance mgmt, peer review, calibration
│   │   ├── recruitment/       # Recruitment, ATS
│   │   ├── settings/          # Settings hub (6 categories, 44+ tabs)
│   │   ├── succession/        # Succession planning
│   │   ├── talent/            # Talent management
│   │   ├── training/          # Training & development
│   │   └── ...                # team, org, notifications, employees
│   └── api/v1/                # REST API routes (73 modules)
├── components/
│   ├── ui/                    # Base components (shadcn/ui)
│   ├── layout/                # Sidebar, MobileDrawer ⚠️ PROTECTED
│   └── [feature]/             # Feature-specific components
├── lib/
│   ├── auth/                  # Auth utilities, manager-check
│   ├── permissions/           # RBAC permission checking
│   ├── prisma.ts              # Prisma client singleton
│   ├── prisma-rls.ts          # Row-Level Security wrapper
│   ├── constants.ts           # MODULE, ACTION, ROLE enums
│   └── [domain]/              # Business logic (payroll, leave, etc.)
├── config/navigation.ts       # Sidebar IA config ⚠️ PROTECTED
├── hooks/                     # Custom React hooks
└── types/                     # TypeScript type definitions

prisma/
├── schema.prisma              # Data model
├── seed.ts                    # Master seed orchestrator ⚠️ PROTECTED
├── seeds/                     # 34+ modular seed files (00-xx)
└── migrations/                # Database migrations
```

---

## Coding Conventions

### Component Pattern
- **Client Components**: `*Client.tsx` with `'use client'` directive
- **Server pages**: `page.tsx` wraps Client component with Suspense
- **Imports**: `import type { ... }` for type-only imports
- **Styling**: `cn()` from `@/lib/utils` for className merging
- **Icons**: `lucide-react` exclusively
- **Binary responses in App Router**: Use `new Response()` directly, not `NextResponse.json()` for file downloads

### Auth & RBAC
- **Roles**: `SUPER_ADMIN`, `HR_ADMIN`, `EXECUTIVE`, `MANAGER`, `EMPLOYEE`
- **Auth chain**: Employee → SsoIdentity → EmployeeRole → Role → RolePermissions
- **Manager relationship**: `Position.reportsToPositionId` (NOT direct managerId)
- **Active records**: `endDate: null` convention
- **RLS**: `withRLS()` wrapper sets Postgres session variables

### Assignment Rules (Track B)
- **Primary lookup**: NEVER access `assignments[0]` directly — always use helpers:
  - DB query: `fetchPrimaryAssignment(employeeId)`
  - In-memory filter: `extractPrimaryAssignment(assignments)`
- **Append-Only**: To modify assignments, set `endDate` on existing row → create new row. NEVER UPDATE in-place
- **isPrimary filter required**: Payroll, Leave, Approvals MUST include `isPrimary: true` condition
- **Concurrent positions**: Leave/Approvals processed under Primary Assignment's company only
- **Payroll scope**: Domestic 7 entities = HR Hub direct processing. Overseas 6 = local system + data sync only
- **employmentType mapping**: ATS lowercase → Employee uppercase via `mapRequisitionTypeToEmploymentType()`

### i18n
- Use `useTranslations()` hook from `next-intl` in Client components
- `src/lib/i18n/ko.ts` is **@deprecated** — use `messages/ko.json` instead
- Korean primary, 5 locales total

### API Pattern
- Response helpers: `apiSuccess()`, `apiPaginated()`, `apiError()`
- Error class: `AppError` with factory functions (`notFound()`, `forbidden()`, etc.)
- Error messages in Korean

### Database
- Seed scripts: modular files in `prisma/seeds/`, imported by `seed.ts`
- Idempotent: use `upsert` operations
- Deterministic UUIDs for seed data (reproducible)

---

## QA Test Accounts (8 accounts)

| Email | Name | Role | Company | Team |
|-------|------|------|---------|------|
| `super@ctr.co.kr` | 최상우 | SUPER_ADMIN | CTR-HOLD | 전사관리 |
| `hr@ctr.co.kr` | 한지영 | HR_ADMIN | CTR | 인사팀 |
| `hr@ctr-cn.com` | 陈美玲 | HR_ADMIN | CTR-CN | 人事部 |
| `manager@ctr.co.kr` | 박준혁 | MANAGER | CTR | 생산기술팀장 |
| `manager2@ctr.co.kr` | 김서연 | MANAGER | CTR | 품질관리팀장 |
| `employee-a@ctr.co.kr` | 이민준 | EMPLOYEE | CTR | 생산기술팀 |
| `employee-b@ctr.co.kr` | 정다은 | EMPLOYEE | CTR | 생산기술팀 |
| `employee-c@ctr.co.kr` | 송현우 | EMPLOYEE | CTR | 품질관리팀 |

**Reporting chain**: 이민준/정다은 → 박준혁, 송현우 → 김서연
**Dev login**: `NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true` enables Quick Login UI on `/login`

---

## DO NOT TOUCH Boundary

Every prompt MUST explicitly list files/modules that are OUT OF SCOPE for modification.

```
DO NOT modify (unless explicitly in scope):
- src/components/layout/*    (Sidebar, MobileDrawer, navigation)
- src/config/navigation.ts   (Sidebar IA — 10 sections, 30+ items)
- messages/*.json             (i18n translation files)
- prisma/seed.ts              (Master seed orchestrator)
- prisma/schema.prisma        (Schema changes require migration plan)
- src/middleware.ts            (Auth middleware)
- Any module not explicitly listed in the prompt's scope

# Track B Protected Files (v4.4)
- src/lib/api/companyFilter.ts    (resolveCompanyId — security filter SSOT)
- src/lib/prisma-rls.ts           (RLS wrapper — Phase 3 bypass APIs handled separately)
- src/lib/api/withRLS.ts          (withRLS transaction wrapper)
```

**Lesson learned**: Session A (GP#3 QA) modified sidebar while adding seed data → lost entire 인사이트 section. Always declare boundaries.

---

## Gotchas & Lessons Learned

- **Sidebar destruction incident**: Session A (GP#3 QA) modified sidebar while adding seed data → lost entire Insights section. Always declare DO NOT TOUCH boundaries before starting work.
- **Pure function extraction**: Business logic tightly coupled to Prisma models must be extracted into pure functions for testability (caught in Session C).
- **App Router binary responses**: File download endpoints must use `new Response()`, not `NextResponse.json()` (caught in Session C).
- **UI error states**: Always handle loading/error/empty states in Client components — don't assume API success.

## Core Rules

- Timezone handling: Always use `src/lib/timezone.ts` utilities — never raw `new Date()` for display
- API dates: ISO 8601 strings only (no Date objects passed directly)
- Components: Functional components only
- No `any` type — use proper types or `unknown` with narrowing

## Verification Checklist

After any implementation:
1. `npx tsc --noEmit` — 0 errors
2. `npm run lint` — no new warnings
3. Preview/screenshot for UI changes
4. DB verification for seed/migration changes
5. Update `~/Documents/Obsidian Vault/projects/hr-hub/STATUS.md` with completed/in-progress/next items
