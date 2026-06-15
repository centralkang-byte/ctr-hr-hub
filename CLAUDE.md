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

> **강제 = PreToolUse 훅** (`.claude/hooks/protected-guard.sh`): 동결 IA·`// PROTECTED` 헤더·`prisma/migrations/*` 편집을 **기본 차단**(무관한 작업 중 우발 수정 방지 — 영구 금지 아님). 의도적 수정이 이번 세션 과제면 `/unlock-protected <path>` → 편집 → 다음 세션 자동 재잠금(즉시 재잠금 `/lock-protected`). 훅 범위 밖: `messages/*.json`(append-only)·`seed.ts`(헤더 없음) — 종전대로 주의.

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
- **Gate 1 (플랜, ExitPlanMode 전)**: 플랜 요약 → `/tmp/codex-prompt.txt`, 실행 `cat /tmp/codex-prompt.txt | codex exec -` (파이프 필수, `$(cat)` 금지). HIGH/P0–P1 findings를 플랜에 반영 후 승인.
- **Gate 2 (구현 후)**: `/verify`가 실행. 명령·타임아웃·우선순위 라벨 등 상세는 **`.claude/commands/verify.md`가 SSOT**.

### /verify · UI QA · /wrap-up
상세 절차는 커맨드 파일이 SSOT: `/verify` (tsc·lint·`prisma migrate status`·rules 패턴 + Gate 2 + UI QA), `/wrap-up` (commit→STATUS.md→Vercel deploy). UI QA 멀티롤 최소 = `super@ctr.co.kr` + `employee-a@ctr.co.kr`.

## Design Refactor — HR Hub Migration

`_design-reference/` 에 HR Hub 프로토타입 (Babel-in-browser JSX) 이 있어요.
**시각 디자인·페이지 IA·KPI 패턴·인터랙션의 source of truth** 입니다.

### 원칙

- **백엔드 절대 보존**: prisma, API, lib, middleware, RLS, companyFilter 손대지 말 것
- **DESIGN.md 점진 갱신**: 기존 Violet 디자인 시스템 → HR Hub 컨벤션 (Workday Navy + Workday Orange)
- **Phase 단위 PR**: 각 Phase 별 별도 브랜치/PR 로 머지

### Phase 진행

| Phase | 범위 | 기간 |
|---|---|---|
| 1. 디자인 토큰 | tailwind.config.ts 색·radius·shadow, globals.css, DESIGN.md 갱신 | 1-2일 |
| 2. 핵심 컴포넌트 | wd-stat-strip / wd-status-chips / wd-summary-lead / EmptyState / WdDrawer / Inspector / BulkActionBar 패턴을 shadcn 위에 구현 | 1주 |
| 3. 페이지별 적용 | 대시보드 → 직원 → 휴가/근태 → 인사이트 → 설정 순으로 점진 | 수주 |
| 4. 폴리시 | ⌘K 강화, 미니카드, 모바일 카드 reflow | 1주 |

### 참고 우선순위 (HR Hub 폴더 안)

1. `_design-reference/DESIGN_RULES.md` ← 가장 중요 (페이지 골격·KPI 5패턴·카피 톤·라벨 컨벤션)
2. `_design-reference/HANDOVER.md` (HR Hub 아키텍처·함정·완료된 작업)
3. `_design-reference/REVIEW_REPORT.md` (P0-P4 정리 기록 — 어떤 디자인 결정이 왜 내려졌는지)

### 작업 시 추가 가드

- Phase 1 끝나기 전엔 `src/components/ui/*` (shadcn 베이스) 수정 금지 — 토큰만 바뀌면 자동 적용됨
- `messages/*.json` 키 그대로 — 친근 톤 변환은 한국어 (`ko.json` 등) 만, 다른 언어는 그대로
- 각 Phase 끝나면 Playwright visual test 스냅샷 업데이트 + 검토 필수

## 작업 모드 표준 (해당 작업 시작 시 스킬 로드)

- **카나리 작업** (다중선택 바·일괄액션 등): `/canary-standard` — N1 기능충실도 7레이어 + N2 E2E 의무 + 검증 게이트. (카나리 시작 시 반드시 로드)
- **Phase 3 페이지별 적용**: `/phase3-standard` — Q1 우선순위 + Q2 4단계 게이트 + Q3 운명카드. 실행 SSOT = `docs/plans/active/2026-05-18-phase3a-audit.md`
- **대규모 감사·마이그레이션·병렬 리뷰**: `.claude/workflows/` (저장된 dynamic workflow + 언제/어떻게 발동 가이드 = README). 발동은 옵트인 — 요청에 "workflow" 또는 `/effort` ultracode.
