# CTR HR Hub — Project Guide

> **Project**: CTR 통합 인사관리 시스템 (HR SaaS)
> **Path**: `/Users/sangwoo/VibeCoding/HR_Hub/ctr-hr-hub`
> **State Reference**: `context/SHARED.md` (completion history, current state)

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
│   ├── (dashboard)/           # All HR modules (30+ pages)
│   │   ├── analytics/         # 워크포스 분석, AI 리포트, 예측 분석
│   │   ├── attendance/        # 근태 관리, 교대 캘린더
│   │   ├── compliance/        # GDPR, 데이터 보존, DPIA
│   │   ├── home/              # 대시보드 홈
│   │   ├── leave/             # 휴가 관리
│   │   ├── my/                # 내 프로필, 내 휴가, 내 업무
│   │   ├── payroll/           # 급여, 정산, 시뮬레이션
│   │   ├── performance/       # 성과 관리, 동료 평가, 보정
│   │   ├── recruitment/       # 채용, ATS
│   │   ├── settings/          # 설정 허브 (6개 카테고리, 44개 탭)
│   │   └── ...                # training, succession, org, etc.
│   └── api/v1/                # REST API routes (45+ modules)
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

### Auth & RBAC
- **Roles**: `SUPER_ADMIN`, `HR_ADMIN`, `EXECUTIVE`, `MANAGER`, `EMPLOYEE`
- **Auth chain**: Employee → SsoIdentity → EmployeeRole → Role → RolePermissions
- **Manager relationship**: `Position.reportsToPositionId` (NOT direct managerId)
- **Active records**: `endDate: null` convention
- **RLS**: `withRLS()` wrapper sets Postgres session variables

### Assignment 규칙 (Track B)
- **Primary 조회**: `assignments[0]` 직접 접근 금지 → 반드시 헬퍼 사용
  - DB 조회: `fetchPrimaryAssignment(employeeId)`
  - 메모리 필터: `extractPrimaryAssignment(assignments)`
- **Append-Only**: assignment 수정 시 기존 row에 endDate → 신규 row 생성. UPDATE 금지
- **isPrimary 필터 필수**: Payroll, Leave, 결재 등에서 반드시 `isPrimary: true` 조건
- **겸직자 연차/결재**: Primary Assignment 법인 기준으로만 처리
- **급여 스코프**: 국내 7개 법인 = HR Hub 직접 처리. 해외 6개 = 로컬 시스템 + 데이터 연동만
- **employmentType 매핑**: ATS 소문자 → Employee 대문자는 `mapRequisitionTypeToEmploymentType()` 사용

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

## QA Test Accounts (8개)

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

# Track B 보호 파일 (v4.4)
- src/lib/api/companyFilter.ts    (resolveCompanyId — 보안 필터 SSOT)
- src/lib/prisma-rls.ts           (RLS wrapper — Phase 3에서 우회 API만 별도 처리)
- src/lib/api/withRLS.ts          (withRLS transaction wrapper)
```

**Lesson learned**: Session A (GP#3 QA) modified sidebar while adding seed data → lost entire 인사이트 section. Always declare boundaries.

---

## Prompt & Agent Guidelines

### Parallel Agent Architecture
When writing prompts for multi-task work:
- Identify parallelizable segments and split into Agent 1~N
- Draw dependency graph (which Agent must finish before another starts)
- Assign per-Agent: autonomy mode (Agent-driven / Review-driven / Agent-assisted) and model recommendation
- Example: Backend APIs = parallel → UI depends on both → Export depends on UI

### Cross-Review for Complex Prompts
Before executing complex prompts (multi-agent, API+UI+Export combined), run a review pass to catch:
- Edge cases and runtime error traps
- Tight coupling to Prisma models (need pure function extraction?)
- Next.js App Router gotchas (binary responses, server/client boundaries)
- Error state handling gaps in UI
- **Reference**: Session C caught 3 critical traps: pure function extraction, App Router binary response, UI error state

### Verification Checklist
After any implementation:
1. `npx tsc --noEmit` — 0 errors
2. `npm run lint` — no new warnings
3. Preview/screenshot for UI changes
4. DB verification for seed/migration changes
