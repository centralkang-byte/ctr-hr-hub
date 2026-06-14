# Wave 1 Recruitment List IA — proto-fidelity (S312)

> Track: **Wave 1 IA/백엔드 정합**. CEO-locked sequence: employees-org ✅ → attendance ✅ →
> my-space ✅ → **recruitment (this)** → performance/payroll → team → settings → nav.ts+퀵윈.
> Governing principle: adopt proto IA; re-home live-only real features (never delete); build
> backend only where data genuinely doesn't exist (never fabricate mock); keep-live where better.

## Problem (fidelity map line 83-87)

`/recruitment` list is a **bare table** — no KPI strip, no tabs, no per-job viz. DESIGN_RULES:75 assigns
채용 **Pattern A** (통계 스트립). Proto `page-jobs.jsx`:
- **wd-stat-strip** (4 KPI): 진행 공고 / 전체 지원자 / 인터뷰 / 오퍼
- **3 tabs**: 공고 명세 (card grid + per-job 4-cell stage viz) / 파이프라인 (analytics) / 후보군 (coming-soon)
- pipeline tab = **deferred backend** (time-to-hire needs stage-transition timestamps that don't exist) → never ship mock.

## CEO decisions (2026-06-14)
1. **목록 렌더링 = 카드 그리드 + (단계) 셀** (테이블 → 프로토 job-card 그리드 교체, 검색/상태필터/페이지네이션 유지).
2. **탭 = 3탭 셸 + 준비중 플레이스홀더** (공고 명세=실데이터, 파이프라인·후보군=정직한 "준비 중" 빈 상태, mock 아님).
3. (open) MANAGER에게 전사 KPI 합계 노출 — 기존 목록이 이미 전사 공고/지원자수를 MANAGER에 노출하므로 **일관성 유지(허용) 권장**, 승인 대기.

## Codex Gate 1 (2026-06-14 — no P0; 2 HIGH + P1/P2 folded in)
- **HIGH-1 (tenant)**: per-job groupBy re-applies the `posting:{ ...companyFilter, deletedAt:null }` relation
  predicate (defense-in-depth + race-safe), and skips when `pageIds` empty.
- **HIGH-2 (not a real funnel)**: `Application.stage` is *current* state only → a cumulative conversion funnel
  is unrecoverable without a stage-transition history table (= the deferred backend). The per-job 4-cell viz is a
  **current-stage snapshot** (headcount at each stage *now*), same model as the existing `/recruitment/dashboard`
  "funnel". Labels/caption say "현재 단계" — never claim conversion.
- P1: KPI renamed to data-true meanings (면접 단계 ≠ scheduled interviews); offer bucket identical across
  summary + cards; explicit per-KPI population table; shared `POSTINGS_READ_ROLES` const (kill 3-way drift) +
  EXECUTIVE 403 test; `deletedAt:null` on all KPI filters; gate "새 공고" button to SUPER/HR.
- P2: summary = 2 queries (count + groupBy) via Promise.all; expanded tests.

## Scope

### Shared SSOT (kill drift — Codex P1)
0. **NEW** `src/lib/recruitment/access.ts`:
   - `POSTINGS_READ_ROLES = [SUPER_ADMIN, HR_ADMIN, MANAGER]` (consumed by list + summary routes; EXECUTIVE excluded).
   - pure `bucketStages(counts: Partial<Record<ApplicationStage, number>>) → { applied, screen, interview, offer }`:
     - applied = Σ all stages (total applications received)
     - screen = SCREENING
     - interview = INTERVIEW_1 + INTERVIEW_2 + FINAL
     - offer = OFFER + OFFER_ACCEPTED + OFFER_DECLINED + HIRED  (**identical in summary KPI and card cell** → no API divergence)
   - vitest target (each bucket, empty input, HIRED-fold, ignores REJECTED outside `applied`).

### Per-KPI population + cutoff (explicit — Codex P1)
| KPI (label) | model | stage filter | posting filter |
|---|---|---|---|
| activePostings (진행 공고) | JobPosting count | — | status=OPEN, deletedAt:null, companyFilter |
| totalApplicants (전체 지원자) | Application | all | posting status=OPEN, deletedAt:null, companyFilter |
| inInterview (면접 단계) | Application | INTERVIEW_1/2/FINAL | posting status=OPEN, deletedAt:null, companyFilter |
| offersOut (오퍼) | Application | OFFER/OFFER_ACCEPTED/OFFER_DECLINED/HIRED | posting status=OPEN, deletedAt:null, companyFilter |

KPI strip = **OPEN postings only** (active-recruiting snapshot; intentional — drops as postings close).
Card cells = per-posting current-stage over the page (any status; follows search/status filter).

### Backend
1. **NEW** `GET /api/v1/recruitment/postings/summary/route.ts`
   - `withAuth` + `POSTINGS_READ_ROLES` (shared) else `forbidden`. EXECUTIVE → 403.
   - companyFilter: SUPER → {} else { companyId } (via `posting` relation).
   - **2 queries via Promise.all** (Codex P2):
     - `jobPosting.count({ status:'OPEN', deletedAt:null, ...companyFilter })` → activePostings
     - `application.groupBy({ by:['stage'], where:{ posting:{ status:'OPEN', deletedAt:null, ...companyFilter } }, _count:{ _all:true } })` → `bucketStages` → totalApplicants/inInterview/offersOut
   - No withCache (cheap; fresh on new applications).
2. **EXTEND** `GET /api/v1/recruitment/postings/route.ts`
   - import `POSTINGS_READ_ROLES` from shared const (remove local copy).
   - `pageIds = items.map(i=>i.id)`. **If pageIds.length===0 → skip groupBy** (Codex HIGH-1).
   - `application.groupBy({ by:['postingId','stage'], where:{ postingId:{ in: pageIds }, posting:{ ...companyFilter, deletedAt:null } }, _count:{ _all:true } })`
     — **relation predicate re-applied** (Codex HIGH-1).
   - Per-posting: `bucketStages` → `funnel{applied,screen,interview,offer}`; default `{0,0,0,0}` when no apps.
   - `deadlineDate` already returned (scalar) → client D-day.

### Frontend
3. `RecruitmentListClient.tsx` rework (3-state preserved; rules: WdStatStrip / Radix Tabs segmented / EmptyState / StatusBadge):
   - **WdStatStrip** (4 items from `/summary`; own loading state; Briefcase/Users/Inbox/Check icons; tones default/info/warning/success).
   - **Radix Tabs** (`@/components/ui/tabs`, segmented, `aria-label`): 공고 명세 (count) / 파이프라인 / 후보군.
   - 공고 명세 tab: search + status filter (existing) + **card grid** of `RecruitmentJobCard` + pagination (existing). 3-state handled.
   - 파이프라인 + 후보군 tabs: `EmptyState` "준비 중" honest placeholder. No mock.
   - **"새 공고" button gated to SUPER/HR** (Codex P1 — MANAGER has no CREATE → dead button today).
   - `PostingRecord` += `funnel:{applied,screen,interview,offer}` and `deadlineDate: string | null`.
4. **NEW** `RecruitmentJobCard.tsx` (local) — proto `wd-job-card`:
   - header: title, meta (dept/team · location · employmentType), D-day chip (warning ≤7 else info; "마감일 없음" when null).
   - **4-cell current-stage viz** (지원/서류/면접/오퍼) with active/warn tint per proto; small "현재 단계 기준" caption (Codex HIGH-2 honesty). Tokens only.
   - `onClick → /recruitment/[id]`; keyboard accessible.

### i18n (`messages/*.json` recruitment namespace, **add-only**, 5 locales, ko friendly tone)
5. `kpiActivePostings`, `kpiTotalApplicants`, `kpiInInterview`, `kpiOffersOut` (+ foot subs),
   `tabJobs`, `tabPipeline`, `tabCandidates`, `stageApplied`, `stageScreen`, `stageInterview`, `stageOffer`,
   `stageSnapshotCaption` ("현재 단계 기준"), `pipelineComingSoon`(+sub), `candidatesComingSoon`(+sub),
   `dDay` (`D-{days}`), `deadlineNone`.

### Tests
6. **vitest**: `bucketStages` (each bucket, empty, HIRED-fold, REJECTED only in applied).
7. **e2e** `e2e/api/recruitment-postings-summary.spec.ts`:
   - role: SUPER/HR/MANAGER → 200 (4 numeric KPIs); **EXECUTIVE → 403**; EMPLOYEE → 403.
   - multi-tenant: non-SUPER scoped to own company; SUPER cross-company.
   - **soft-deleted posting excluded** from KPIs.
   - postings funnel shape guard (each item `funnel{applied,screen,interview,offer}` numeric); empty-page ok;
     funnel reflects the current page after search/status filter.

## Out of scope (deferred — documented, not mock)
- **Pipeline analytics** content (avg time-to-hire by stage, channel effectiveness, monthly pass-rate, per-job
  comparison) — needs stage-transition history that doesn't exist. CEO ②: backend separate.
- **Candidates pool** — proto ships coming-soon.
- existing `/recruitment/dashboard` + `/analytics/recruitment` keep-live (real analytics already there).

## Verification gates
- tsc 0 · lint 0 · vitest (bucketStages) · e2e (summary role+tenant+soft-delete + funnel shape).
- **Codex Gate 2** (impl — multi-tenant sensitive ⇒ mandatory).
- **Pixel Gate**: proto `page-jobs.jsx` (style=workday) side-by-side — KPI strip + card-grid + stage viz.
- Multi-role dogfood: super@ + hr@ + **manager@** (KPI/cards render, MANAGER access + NO create button, console 0).

## Branch
`feat/wave1-recruitment-ia` off `origin/main` (non-stacked).
