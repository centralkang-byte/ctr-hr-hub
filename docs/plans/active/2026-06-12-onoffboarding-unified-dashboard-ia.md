# On/Offboarding Unified Admin Dashboard (proto IA) — DEFERRED

> **Status**: Recorded backlog (deferred feature). NOT in the current Wave 1 PR.
> **Decision**: CEO chose **Option 2** (token/pattern/Dialog cleanup, IA preserved) for the
> current `design/wave1-onoffboarding` PR. **Option 3** (this doc) — adopting the prototype's
> unified on/offboarding admin dashboard — is deferred to a dedicated feature project.
> **Date**: 2026-06-12 (S29x, Wave 1 design campaign).

---

## What the prototype wants (the deferred target)

`_design-reference/page-onboarding.jsx` renders **one unified dashboard** that merges
onboarding **and** offboarding into a single admin page (`OnboardingPage`):

- Page header + `wd-stat-strip` (4 KPIs: 진행 중 / 지연 / 완료 / 이번 주 입사)
- Process tabs (전체 / 온보딩 / 오프보딩) + status pill-tabs (전체/진행중/완료/지연)
- **4 view modes** via segmented toggle:
  - **Grid** — "Hire cards" (인물 카드: avatar, D-day, buddy, progress bar, quick actions)
  - **Table** — sortable person table
  - **Journey** — per-person step stepper (서류→OJT→보안→버디→시스템→인사, done/current/overdue/upcoming)
  - **Analytics** — 단계별 평균 소요시간 · 정체율 · 버디 매칭 효과 · 템플릿별 완료율

## Current implementation (what exists today)

Separate routes & pages, not unified:

- `/onboarding` — `OnboardingDashboardClient.tsx` (admin dashboard, list/filters)
- `/onboarding/[id]` — `OnboardingDetailClient.tsx` (block/unblock/sign-off workflow)
- `/offboarding` — `OffboardingDashboardClient.tsx` (admin dashboard)
- `/offboarding/[id]` — `OffboardingDetailClient.tsx` (complete/cancel/exit-interview/reschedule)
- `/onboarding/me`, `/my/offboarding` — self-service (cleaned in the Option 2 PR)

Note: `src/config/navigation.ts` (frozen) **already has a single unified entry**
`onboarding-offboarding → /onboarding` (line ~408). So a unified dashboard could mount at
`/onboarding` **without** editing the frozen navigation file. `/offboarding` would become
redundant and need a fate decision (redirect vs keep).

## Why it was deferred — risks (severity order)

1. **Analytics view has no backend (honesty blocker, highest).** The proto's analytics
   numbers are **all hardcoded mock**. The real API surface
   (`onboarding/dashboard`, `instances`, `templates`, `checkins`; no aggregation endpoints)
   cannot feed it. Building it honestly needs **new backend** — which violates Wave 1's
   "백엔드 절대 보존". Fabricating numbers violates the S287 *정직 비교* precedent.
   → This view must be a real feature with its own backend, or be explicitly omitted.
2. **Feature-scale IA rebuild ⇒ regression risk on working admin P0 workflows.** The
   `[id]` detail pages carry real HR workflows (onboarding block/unblock/sign-off;
   offboarding complete/cancel/exit-interview/reschedule/documents). The proto's inline
   "journey" is a read-only stepper — folding detail into the dashboard loses workflow.
3. **`/offboarding` route + 1152-line detail orphaning.** Mounting unified at `/onboarding`
   leaves `/offboarding` dashboard (651L) + detail (1152L) needing a fate decision.
4. **Proto mock fields ≠ real data.** Hire cards assume `buddy`/`hue`/`progress`/`dDay`;
   dashboard API may not return `buddy`/`hue` (unverified). Pixel-perfect match impossible
   where data is absent → Pixel Gate weakened.
5. **Verification cost balloons.** New routes + interactive views ⇒ new e2e guards, visual
   baseline regen, multi-role QA over a much larger surface.
6. **S288 precedent.** Global-payroll & year-end IA divergences were deferred to CEO
   decision, not auto-applied — IA transitions are product decisions, not design cleanup.

## De-risking approach (if/when prioritized)

- Write a decision doc first (`/write-decision`) → Codex plan review → dedicated feature PR.
- **Keep** `[id]` detail pages and the `/offboarding` route; mount the unified **view layer**
  at `/onboarding` (nav already unified) and link out to detail for workflow actions.
- Adopt only the views backed by real data now: Hire-card grid + table + journey
  (from real task list). **Defer the Analytics view** until its backend exists, or ship it
  as an explicit "coming soon" empty state.
- Prereq verification: confirm `onboarding/dashboard` + `offboarding/dashboard` responses
  include the fields Hire cards/journey need (`buddy`, `progress/total`, `dDay`, `template`).

## Next step

When this rises in priority: `/write-decision` → Codex Gate 1 → feature PR (separate from
the Wave 1 design campaign).
