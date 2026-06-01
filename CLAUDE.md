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
npx tsx scripts/seed-qa-accounts.ts
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
| `super@ctr.co.kr` | 대조영 | SUPER_ADMIN | CTR-HOLD |
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

- **현재 SSOT**: `DESIGN.md` (Violet `#6366f1` 기반)
- **마이그레이션 타겟**: `_design-reference/DESIGN_RULES.md` (Workday Navy 기반)
- **Phase 1 진행 중**: 토큰 교체 단계 — 두 시스템이 일시 공존
- Token enforcement via `rules/design.md` (auto-loaded on UI file edits)
- In QA mode, flag any code that doesn't match DESIGN.md

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
- Write plan summary to `/tmp/codex-prompt.txt`
- Run: `cat /tmp/codex-prompt.txt | codex exec -`
- Incorporate HIGH findings into plan before approval

**Gate 2 — Post-Implementation Review** (during `/verify`, after tsc+lint pass):
- Run: `codex review --uncommitted`
- Fix all HIGH findings before commit

**Codex CLI reference** (GPT-5.4, `codex`):
```bash
# Gate 2: built-in review commands (no prompt needed)
codex review --uncommitted          # review uncommitted changes
codex review --base staging         # review branch diff
codex review --commit <SHA>         # review specific commit

# Gate 1: custom prompt via stdin pipe (MUST use pipe, NOT $(cat))
cat /tmp/prompt.txt | codex exec -  # ✅ stable
codex exec "$(cat /tmp/prompt.txt)" # ❌ shows "Reading additional input from stdin..."
```
Timeout: 300s (codex exec scans full codebase).

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

## 카나리 작업 표준 (P1-7부터 모든 카나리에 적용)

### N1 — 기능 충실도 3분법

카나리 컴포넌트가 노출하는 액션마다 사전 audit 후 분류:

| 분류 | 조건 | 처리 |
|---|---|---|
| (가) 완전 존재 | 7레이어 모두 작동 | 연결만. 신규 구현 0 |
| (나) 부분 존재 | 일부 레이어만 존재 | 누락 레이어만 구현 + 연결 |
| (다) 미존재 | 어느 레이어도 없음 | 전체 구현 (권한·API·DB·상태·UX 끝까지) |

"존재" = end-to-end 7레이어: ① Prisma mutation ② API endpoint(route+validation+RLS)
③ 권한 가드(롤별) ④ FE mutation ⑤ UI 트리거 ⑥ 사용자 피드백(toast/loading/error)
⑦ 상태 갱신(선택 해제·refetch). 1개라도 누락 → (나). **mock·stub·"준비 중
disabled" 금지** (P1-6b quick-actions disabled는 시그니처 외 액션 한정 예외).
누락분 구현이 시그니처 범위를 크게 초과하면 사전 보고 후 사용자 판단
(A: P1-7 내 구현 / B: 해당 액션 제외 + 별도 트랙 + 카나리 비노출).

### N2 — E2E 테스트 의무

카나리 액션마다 Playwright E2E 작성: 다중선택→바 노출→액션→실결과 검증
(DB/UI/toast) + 롤별(가능 롤 / 비가시 롤). 위치 `e2e/flows/*.spec.ts`
(`npm run test:e2e`). **gstack 라이브(시각) ≠ E2E(자동화) — 둘 다 PASS해야 완료.**

### 검증 게이트 (강화)

tsc 0 · lint clean · Codex Gate 2 HIGH 0 · **E2E PASS(롤별)** · gstack 3구간
(라이트 풀 + 다크 스모크 + ctr-* known-deferred) → 커밋·푸시 → 보고 → 승인.
D3 사전 audit = 액션 × 7레이어 매트릭스 표로 보고.

### P2 토큰통합 트랙 변형 (색 SSOT — 시그니처 아님)

색 토큰 통합(예: Workday `--wt-*` 팔레트 SSOT)은 N1/N2를 다음으로 변형:

- **N1 변형 = 색 매핑 표**: 토큰별 (가) 신 hex/oklch 정의 / (나) 기존 어느
  토큰·hex 가 매핑 / (다) 영향 파일·셀렉터. 7레이어 audit 대체.
- **N2 변형 = 시각 회귀 3축 단언**: ① 변경 대상 셀렉터 computed-style →
  신 값 확인 ② 불변 대상(나머지 토큰) 회귀 0 ③ 그 외(chrome/타이포/
  레이아웃) before/after PNG. (픽셀 diff 도구 미가정 — computed-style
  정량 + PNG + 사용자 판정.)
- **변환 규칙**: oklch→HSL 등 색공간 변환은 **수동·근사 금지**. 브라우저
  엔진(`getComputedStyle`) 또는 검증된 라이브러리로만. 신규 토큰값은
  globals.css 수정 **전 swatch(HTML+PNG)로 사전 보고·시각 확인 게이트**.
- **블라스트 분리**: 다소비처(차트 등 10+) 토큰은 저블라스트(상태/아바타)
  와 별 서브트랙으로 분리, 각 카나리 1곳 후 확산.
- 다크 토큰은 레퍼런스 정의 없으면 라이트만 통합, 다크는 known-deferred 합류.

## Phase 3 작업 표준 (페이지별 적용 — Phase 3a부터)

> Phase 3a 실행 SSOT(audit 양식 3종 + 프로토타입 페이지 list):
> `docs/plans/active/2026-05-18-phase3a-audit.md`.

### Q1 — 차등 우선순위 (모든 기능이 최종 목표, 인도 단위만 분할)

- **P0** = 매일 핵심 워크플로(입사·퇴사·조직변경·휴가·근태·급여 기본).
  P0 완료 = 실 운영 가능 마일스톤.
- **P1** = 주요 HR(평가·1:1·온보딩·리뷰 사이클·근속).
- **P2** = 리포팅·분석·인사이트(대시보드·KPI·차트·익스포트).
- **P3** = 운영도구·세팅·고급(권한·시스템 설정·특수 케이스).
Phase 3a audit에서 페이지별 기능 list 추출 → CC가 P0~P3 추정 →
사용자 확정. 우선순위 완료마다 라이브 사용·피드백 → 재조정 가능.

### Q2 — 하이브리드 4단계 게이트 (+ 3 경량화)

1. **Phase 3a audit** = 페이지별 기능 분류(∩ 공통 / 프로토타입만 /
   코드베이스만) + P0~P3 추정 + 불확실 등급
2. **페이지 batch 카드** 작성 (등급별 분량)
3. **사용자 페이지 batch 게이트** (OK / 정정 / 보류 / 제거)
4. **구현 + N1/N2 검증**

경량화: ① 표준 CRUD = 사전검토 생략, 결과 라이브 보고에서 OK/정정
② 게이트 단위 = 개별 기능 카드 아닌 **1페이지 batch 1장**
③ 불확실 등급제 — (고확실) fast-track 1줄 / (중확실) 짧은 카드
(목적+추정동작+불확실점) / (저확실) 상세 카드(목적·동작·데이터
모델·API·권한·불확실점). 사용자 검토 부담 동적 분배.

### Q3 — case-by-case (코드베이스만 있는 기능)

프로토타입에 없고 코드베이스에만 있는 기능 = "운명 카드"(유지/숨김/
제거 제안)로 동일 페이지 batch 게이트에서 처리. 양식: 스펙 카드 /
운명 카드 / 페이지 batch (등급별 분량은 Q2③).
