# CTR HR Hub — Project Guide

> **Project**: CTR Integrated HR Management System (HR SaaS)
> **State**: `~/Documents/Obsidian Vault/projects/hr-hub/STATUS.md`

---

## Project Memory (Obsidian)

- **Status**: `~/Documents/Obsidian Vault/projects/hr-hub/STATUS.md` — SSOT for progress
- **Decisions**: `~/Documents/Obsidian Vault/projects/hr-hub/decisions/`
- **Sessions**: `~/Documents/Obsidian Vault/projects/hr-hub/sessions/`
- **SessionStart hook**: `.claude/hooks/session-start.sh` → loads STATUS.md automatically

## Plans

- **저장 경로**: `docs/plans/active/` (프로젝트 내부)
- `.claude/plans/` 사용 금지 — 반드시 `docs/plans/active/`에 저장
- 네이밍: `YYYY-MM-DD-<topic>.md`

## Session End Routine

When the user says "STATUS.md 업데이트해줘" or ends a session:
1. Update STATUS.md — move completed items, update in-progress, add remaining work
2. Create `sessions/YYYY-MM-DD.md` — session summary with decisions and blockers

## Design Review Flow

For non-trivial features or architecture changes:
1. Write design doc → `decisions/YYYY-MM-DD-<topic>.md`
2. Request Gemini review for critique
3. Incorporate feedback → proceed with implementation

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15 (App Router, `force-dynamic` dashboard layout) |
| Language | TypeScript 5 (strict mode, `@/*` → `./src/*`) |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Database | PostgreSQL (Supabase) with pgvector |
| Auth | NextAuth 4 — Azure AD SSO + Credentials (dev) |
| UI | Radix UI + Tailwind CSS 3 + shadcn/ui (`cn()`) |
| Forms | React Hook Form + Zod 4 |
| i18n | next-intl — 5 locales × 14+ namespaces |
| Cache | Redis (ioredis) + SWR |
| AI | Anthropic SDK (Claude) + OpenAI embeddings |

## Commands

```bash
npm run dev          # Dev server (port 3002)
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check (MUST pass before commit)
npm run test:e2e     # Playwright E2E

# Database
npx prisma generate
npx prisma migrate dev --name <name>
npx tsx prisma/seed.ts
npx tsx scripts/run-qa-seed.ts
```

---

## Coding Conventions

### Component Pattern
- Client Components: `*Client.tsx` with `'use client'` directive
- Server pages: `page.tsx` wraps Client component with Suspense
- Styling: `cn()` from `@/lib/utils` for className merging
- Icons: `lucide-react` exclusively
- Timezone: Always use `src/lib/timezone.ts` — never raw `new Date()` for display

### Auth & RBAC
- Roles: `SUPER_ADMIN`, `HR_ADMIN`, `EXECUTIVE`, `MANAGER`, `EMPLOYEE`
- Auth chain: Employee → SsoIdentity → EmployeeRole → Role → RolePermissions
- Manager relationship: `Position.reportsToPositionId` (NOT direct managerId)
- Active records: `endDate: null` convention
- RLS: `withRLS()` wrapper sets Postgres session variables

---

## QA Test Accounts

| Email | Name | Role | Company |
|-------|------|------|---------|
| `super@ctr.co.kr` | 최상우 | SUPER_ADMIN | CTR-HOLD |
| `hr@ctr.co.kr` | 한지영 | HR_ADMIN | CTR |
| `hr@ctr-cn.com` | 陈美玲 | HR_ADMIN | CTR-CN |
| `manager@ctr.co.kr` | 박준혁 | MANAGER | CTR |
| `manager2@ctr.co.kr` | 김서연 | MANAGER | CTR |
| `employee-a@ctr.co.kr` | 이민준 | EMPLOYEE | CTR |
| `employee-b@ctr.co.kr` | 정다은 | EMPLOYEE | CTR |
| `employee-c@ctr.co.kr` | 송현우 | EMPLOYEE | CTR |

Reporting: 이민준/정다은 → 박준혁, 송현우 → 김서연
Dev login: `NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true`

---

## DO NOT TOUCH

```
- src/components/layout/*       (Sidebar, MobileDrawer)
- src/config/navigation.ts      (Sidebar IA)
- messages/*.json                (i18n translations)
- prisma/seed.ts                 (Master seed orchestrator)
- prisma/schema.prisma           (Requires migration plan)
- src/middleware.ts              (Auth middleware)
- src/lib/api/companyFilter.ts   (resolveCompanyId — security SSOT)
- src/lib/prisma-rls.ts          (RLS wrapper)
- src/lib/api/withRLS.ts         (withRLS transaction wrapper)
```

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Gotchas

- Sidebar destruction: Session A modified sidebar while adding seed data → lost entire section. Always respect DO NOT TOUCH.
- Pure function extraction: Business logic coupled to Prisma must be extracted into pure functions for testability.
- UI error states: Always handle loading/error/empty states in Client components.

## Verification

After any implementation:
1. `npx tsc --noEmit` — 0 errors
2. `npm run lint` — no new warnings
3. Preview/screenshot for UI changes
4. DB verification for seed/migration changes
