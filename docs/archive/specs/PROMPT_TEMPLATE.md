# CTR HR Hub — Claude Code Session Prompt Template

---

## Session Start Block (paste at top of every session)

```
Read these files first:

1. CLAUDE.md               — Design tokens + project specs
2. CTR_UI_PATTERNS.md      — UI/UX interaction patterns
3. SHARED.md               — Current project state + DB schema + coding patterns

## Output Locations
- Plans/specs: ctr-hr-hub/docs/plans/
- Do not save md files in HR_Hub/ root
```

---

## Feature Implementation Session

```
Implement [feature name].

## Pre-Task
Read CLAUDE.md, CTR_UI_PATTERNS.md, SHARED.md

## Tech Stack
- Next.js 14 App Router
- Tailwind CSS (CLAUDE.md tokens)
- Prisma ORM (no raw SQL)
- Supabase (auth + storage)
- lucide-react icons
- Pretendard font

## Scope
1. [Feature 1] — [description]
2. [Feature 2] — [description]

## Constraints
- Seed data: 7 entities (CTR-HQ, KR, CN, RU, US, VN, MX)
- Korean UI primary, i18n for 7 languages
- FLEX/Workday-style UI (follow CLAUDE.md DO/DON'T)
- Fully autonomous: diagnose → fix → verify → deploy without asking user

## Completion Criteria
- [ ] npx tsc --noEmit = 0 errors
- [ ] npm run build = passes
- [ ] Data visible in actual UI (not just API response)
- [ ] SHARED.md updated with changes

## Session End
Update SHARED.md:
- New/modified DB tables
- New/modified components
- New/modified API routes
- Known issues
- Next session notes
```

---

## Design Refactoring Session

```
Refactor [page name] to CRAFTUI standards.

## Pre-Task
Read CLAUDE.md, CTR_UI_PATTERNS.md

## CRAFTUI Tokens
- Primary: #5E81F4
- Background: #F5F5FA
- Border: #F0F0F3
- Inactive text: #8181A5
- Active text: #1C1D21
- Cards: rounded-xl border border-[#F0F0F3] (no shadow)
- Table header: text-[#8181A5] bg-transparent

## Target Files
- [file path 1]
- [file path 2]

## Rules
- Do NOT change functional logic — design tokens only
- Replace existing Tailwind classes → CLAUDE.md tokens
```

---

## QA / Verification Session

```
Run QA on [module name].

## Checklist
- [ ] Data displays correctly for all 7 entities
- [ ] RBAC access control (EMPLOYEE/MANAGER/HR_ADMIN/SUPER_ADMIN)
- [ ] Korean UI complete (no missing labels)
- [ ] 52h compliance logic (CTR-KR)
- [ ] npm run build passes
- [ ] npx tsc --noEmit = 0 errors
- [ ] Approval workflows functional

## Issues Found
Record in SHARED.md "Known Issues" section
```

---

## Quick Bug Fix Session

```
Fix: [bug description]

## Context
- Location: [file path]
- Symptom: [description]
- Suspected cause: [description]

## Rules
- Minimum changes only
- No unrelated refactoring
- Verify the fix end-to-end: code → tsc → build → deploy → UI confirmation
- If Vercel deploy seems stuck: npx vercel --prod --yes
```

---

## Seed Data Session

```
Add seed data for [module].

## Pre-Task
Read SHARED.md seed data section

## Rules
- Never modify prisma/seed.ts (master data)
- Only add/modify files in prisma/seeds/
- Never use deterministicUUID for FK references — always query DB with findFirst
- Seed data format MUST match frontend component types
- After seed: run on production DB via Direct Connection (port 5432)
- Verify data displays in actual UI

## Session End
Update SHARED.md seed data table with new counts
```
