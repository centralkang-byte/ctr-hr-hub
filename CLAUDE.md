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

"STATUS.md 업데이트" 또는 세션 종료 시 → `/session-end` (STATUS.md 갱신 + `sessions/YYYY-MM-DD-sessionNNN.md` 작성). 커밋·배포까지 묶으려면 `/wrap-up`.

## Design Review Flow

For non-trivial features or architecture changes:
1. Write design doc → `~/Documents/Obsidian Vault/projects/hr-hub/decisions/YYYY-MM-DD-<topic>.md` (`/write-decision`)
2. Run Codex plan review (see Codex Outside Voice Review below)
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
| i18n | next-intl — 5 locales × 69+ namespaces |
| Cache | Redis (ioredis) + SWR |
| AI | Anthropic SDK (Claude) + OpenAI embeddings (raw fetch, `openai` npm 패키지 없음 — `OPENAI_API_KEY` 필요) |

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
npx tsx scripts/seed-qa-accounts.ts
```

---

## Coding Conventions

Detailed rules in `.claude/rules/` (auto-loaded when editing matching files).

- **Timezone:** Always use `src/lib/timezone.ts` — never raw `new Date()` for display
- **Roles:** `SUPER_ADMIN`, `HR_ADMIN`, `EXECUTIVE`, `MANAGER`, `EMPLOYEE` (DB `Role.code` 문자열 — Prisma enum 아님; SSOT `src/lib/constants.ts`)
- **Manager lookup:** 조직 위계 → `Position.reportsToPositionId`. CFR·평가(1:1·분기리뷰) → `OneOnOne.managerId` / `QuarterlyReview.managerId`. 둘을 혼동하지 말 것
- **Active records:** `endDate: null` convention

---

## QA Test Accounts

| Email | Name | Role | Company |
|-------|------|------|---------|
| `super@ctr.co.kr` | 대조영 | SUPER_ADMIN | CTR-HOLD |
| `executive@ctr.co.kr` | 강대표 | EXECUTIVE | CTR |
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

**파일 잠금 SSOT = 코드 내 `// PROTECTED` 헤더** (~43개 파일). 헤더가 있는 파일은 아키텍처 리뷰 없이 수정 금지. 아래는 헤더를 못 다는 대상(디렉터리·glob·데이터)만 명시:

- 🔒 **동결** (IA — 사이드바 파괴 사고 가드): `src/components/layout/{Sidebar,MobileDrawer}.tsx`, `src/config/navigation.ts`
- 🔒 **i18n 키**: `messages/*.json` — 키 추가 OK, 기존 키 편집/삭제 FORBIDDEN
- 🚧 **게이트** (신중히, 고블라스트): `prisma/schema.prisma` (migration 동반 필수), `prisma/seed.ts` (마스터 오케스트레이터 — 자주 수정되나 영향 큼)
- 🛡️ **보안 검토 필수**: `src/middleware.ts`, `src/lib/api/companyFilter.ts` (resolveCompanyId SSOT), `src/lib/prisma-rls.ts`, `src/lib/api/withRLS.ts`

## Design System

- 색·토큰 SSOT: `DESIGN.md` (Workday Navy `#004964` — violet에서 수렴 완료). Enforcement: `rules/design.md` (UI 편집 시 자동 주입); 구현 SSOT = `src/lib/styles/{status,typography}.ts`·`ui/badge.tsx`
- 시각·IA 타겟: `_design-reference/DESIGN_RULES.md` (페이지 전환 기준)
- 마이그레이션 현황(Phase 3 페이지·Phase 4 다크 미완)은 **STATUS.md가 SSOT** — 여기엔 박지 않음
- UI QA(`/gstack`·`/qa`)에서 DESIGN.md 불일치 코드 flag

## Gotchas

- Sidebar destruction: Session A modified sidebar while adding seed data → lost entire section. Always respect DO NOT TOUCH.
- Pure function extraction: 비즈니스 로직이 아직 대부분 Prisma에 결합돼 있고 단위테스트 인프라 없음 — 신규/리팩터 시 부수효과 없는 순수 헬퍼로 추출 (전방 목표).
- UI 에러 상태(loading/error/empty) 3분법은 `rules/components.md`가 SSOT (UI 편집 시 자동 주입).

## Verification & Workflow

### Dev Flow
Plan → **Codex Plan Review (Gate 1)** → Implement → `/verify` (tsc·lint·migrate·patterns + **Codex Gate 2**) → UI QA (UI 변경 시) → `/wrap-up`

### Codex Outside Voice Review (MANDATORY — 3+파일, 플랜 범위 기준)
- **Gate 1 (플랜, ExitPlanMode 전)**: 플랜 요약 → `/tmp/codex-prompt.txt`, 실행 `cat /tmp/codex-prompt.txt | /opt/homebrew/bin/codex exec -` (파이프 필수, `$(cat)` 금지). HIGH/P0–P1 findings를 플랜에 반영 후 승인.
- **Gate 2 (구현 후)**: `/verify`가 실행. 명령·타임아웃·우선순위 라벨 등 상세는 **`.claude/commands/verify.md`가 SSOT**.

### /verify · UI QA · /wrap-up
상세 절차는 커맨드 파일이 SSOT: `/verify` (tsc·lint·`prisma migrate status`·rules 패턴 + Gate 2 + UI QA), `/wrap-up` (commit→STATUS.md→Vercel deploy). UI QA 멀티롤 최소 = `super@ctr.co.kr` + `employee-a@ctr.co.kr`.

## 작업 모드 표준 (해당 작업 시작 시 스킬 로드)

- **카나리 작업** (다중선택 바·일괄액션 등): `/canary-standard` — N1 기능충실도 7레이어 + N2 E2E 의무 + 검증 게이트. (카나리 시작 시 반드시 로드)
- **Phase 3 페이지별 적용**: `/phase3-standard` — Q1 우선순위 + Q2 4단계 게이트 + Q3 운명카드. 실행 SSOT = `docs/plans/active/2026-05-18-phase3a-audit.md`
