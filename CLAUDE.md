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

- **수동 플랜**: `docs/plans/active/` — 네이밍: `YYYY-MM-DD-<topic>.md`
- **Plan mode 플랜**: `.claude/plans/` — 시스템 자동 생성 경로 (변경 불가)
- Plan mode 진입 시 `.claude/plans/`에 자동 할당됨, 이를 허용

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
> Versions: see `package.json`. Do not hardcode versions here.

| Framework | Next.js (App Router, `force-dynamic` dashboard layout) |
| Language | TypeScript (strict mode, `@/*` → `./src/*`) |
| ORM | Prisma with `@prisma/adapter-pg` |
| Database | PostgreSQL (Supabase) with pgvector |
| Auth | NextAuth — Azure AD SSO + Credentials (dev) |
| UI | Radix UI + Tailwind CSS + shadcn/ui (`cn()`) |
| Forms | React Hook Form + Zod |
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

Detailed rules in `.claude/rules/` (auto-loaded when editing matching files).

- **Timezone:** Always use `src/lib/timezone.ts` — never raw `new Date()` for display
- **Roles:** `SUPER_ADMIN`, `HR_ADMIN`, `EXECUTIVE`, `MANAGER`, `EMPLOYEE`
- **Manager lookup:** `Position.reportsToPositionId` (NOT direct managerId)
- **Active records:** `endDate: null` convention

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
- messages/*.json                (i18n — adding new keys OK, editing/deleting existing keys FORBIDDEN)
- prisma/seed.ts                 (Master seed orchestrator)
- prisma/schema.prisma           (Requires migration plan)
- src/middleware.ts              (Auth middleware)
- src/lib/api/companyFilter.ts   (resolveCompanyId — security SSOT)
- src/lib/prisma-rls.ts          (RLS wrapper)
- src/lib/api/withRLS.ts         (withRLS transaction wrapper)
```

## Design System

See `DESIGN.md`. Token enforcement via `rules/design.md` (auto-loaded on UI file edits).
In QA mode, flag any code that doesn't match DESIGN.md.

## Gotchas

- Sidebar destruction: Session A modified sidebar while adding seed data → lost entire section. Always respect DO NOT TOUCH.
- Pure function extraction: Business logic coupled to Prisma must be extracted into pure functions for testability.
- UI error states: Always handle loading/error/empty states in Client components.

## Verification & Workflow

### Dev Flow
Plan → **Codex Plan Review** → Implement → `/verify` (includes **Codex Post-Review**) → UI QA (if UI changed) → `/wrap-up`

### Codex Outside Voice Review (MANDATORY)

Two review gates in every task that is **planned** to touch 3+ files (judge by plan scope, not final diff):

**Gate 1 — Plan Review** (after writing plan, before ExitPlanMode):
- Launch a `general-purpose` Agent as independent reviewer
- Prompt: "Review this plan critically. Find missing files, pattern inconsistencies, namespace conflicts, data-matching strings that should NOT be i18n'd. Rate findings HIGH/MED/LOW."
- Incorporate HIGH findings into plan before approval

**Gate 2 — Post-Implementation Review** (during `/verify`, after tsc+lint pass):
- Launch a `general-purpose` Agent as independent reviewer
- Prompt: "Search actual changed files. Check for residual hardcoded strings, unused imports, type mismatches, missing translations across locales, pattern violations."
- Fix all HIGH findings before commit

**Implementation**:
- **Gate 1 (Plan)**: `general-purpose` Agent subagent (Claude, fast, text-based)
- **Gate 2 (Post)**: Real Codex CLI (GPT-5.4, truly independent model)
  ```bash
  /opt/homebrew/bin/codex review --uncommitted   # for uncommitted changes
  /opt/homebrew/bin/codex review --base staging   # for branch diff
  ```
  Long custom prompts: write to `/tmp/codex-prompt.txt`, then `codex exec "$(cat /tmp/codex-prompt.txt)"`

### /verify (code checks)
1. **Code:** `npx tsc --noEmit` + `npm run lint` (pre-commit hook auto-runs)
2. **DB:** `npx prisma migrate status` — must show "up to date"
3. **Patterns:** Changed files checked against `rules/`

### UI QA (when UI files changed)
- **Quick check:** Claude Preview — `preview_inspect` for exact token measurement
- **Systematic QA:** `/gstack` — multi-page, responsive, multi-role
- **Complex interactions:** Computer Use — drag-and-drop, nested modals, real login flows
- Multi-role: super@ctr.co.kr + employee-a@ctr.co.kr minimum

### /wrap-up (session end)
Bundles: commit → STATUS.md update → Vercel deploy. See `/wrap-up` for details.
