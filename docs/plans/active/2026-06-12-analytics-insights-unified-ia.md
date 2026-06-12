# Analytics Insights Unified Dashboard (proto IA) — DEFERRED

> **Status**: Recorded backlog (deferred feature). NOT in the current Wave 1 analytics PR.
> **Decision**: CEO chose **Option "보류 (defer)"** for the analytics cluster — same posture as the
> on/offboarding Option 3 (`2026-06-12-onoffboarding-unified-dashboard-ia.md`). The current
> Wave 1 analytics work is a **token + forbidden-pattern + a11y sweep with IA preserved**;
> adopting the prototype's unified insights IA is deferred to a dedicated feature project.
> **Date**: 2026-06-12 (Wave 1 design campaign, analytics Batch 1).

---

## What the prototype wants (the deferred target)

`_design-reference/page-insights.jsx` (2,423 LOC, "인사이트") renders **one unified
executive-insights dashboard** — Executive Summary + Team Health + Attendance analytics in a
single page with `wd-stat-strip`, line/bar/funnel/gauge charts, "위험 신호" risk cards, and a
"법인 비교" cross-company table. `_design-reference/page-dashboard-reports.jsx` (514 LOC) is the
report variant.

## Current implementation (what exists today)

A **fan-out of 15 separate analytics routes**, not one unified page:

- `/analytics` → `redirect('/dashboard')` (no standalone analytics hub). The "Executive Summary"
  nav entry lands on `/dashboard/DashboardClient.tsx` — an **old "Kinetic Atelier Bento Grid"**
  page (partially migrated: uses `WdStatStrip`, but its bento IA ≠ the proto insights IA).
- nav "인사이트" group (G-1) exposes 8 of the 15: Executive Summary(/dashboard), workforce,
  payroll, performance, attendance, turnover, team-health, ai-report.
- 7 routes are not in the insights nav (attrition, compensation, gender-pay-gap, predictive
  +`[employeeId]`, recruitment, report) — reached from within pages or standalone.

## Why it was deferred — risks (severity order)

1. **Proto IA = unified page; impl = 15 separate routes ⇒ feature-scale IA rebuild.** Folding 15
   working pages into one proto-style dashboard (or splitting the proto across routes) is a
   product-IA decision, not design cleanup. S288 precedent: IA transitions go through
   `/write-decision` → Codex, not auto-applied in a design Wave.
2. **`/dashboard` reconciliation (Bento → proto insights) touches the executive home surface.**
   `DashboardClient.tsx` overlaps the home/dashboard work (PR-5A series) — re-laying it out to the
   proto insights sections risks regressing a high-traffic page.
3. **Some proto insights data is mock.** The proto's risk cards / cross-company comparison carry
   hardcoded numbers; honest adoption needs verified backing from real endpoints (mirrors the
   on/offboarding analytics-view honesty blocker, S287 precedent).
4. **Verification cost.** A unified IA ⇒ new e2e guards, visual baseline regen, multi-role QA over
   a much larger surface.

## What WAS done in Batch 1 (IA preserved)

Forbidden-pattern + a11y + token sweep on the debt-carrying pages (no IA change, backend untouched):
team-health, turnover, performance, ai-report, predictive/[employeeId]. (emoji→lucide,
`border-l-4`→icon-tint, gradient/glow→flat, off-token amber/emerald/orange/red→D17 tokens,
malformed `bg-x/5/30`→valid, gauge hex tracks→`CHART_THEME`, status color-only→shape+color icon
with sr-only text, one raw-key leak `risk_score` fixed.)

## De-risking approach (if/when prioritized)

- `/write-decision` → Codex Gate 1 → dedicated feature PR (separate from the design campaign).
- Keep the 15 routes working; introduce the unified insights **view** at `/dashboard` only if its
  sections are backed by real endpoints. Defer any mock-only section (or ship an explicit
  "coming soon" empty state).
- Prereq: confirm which proto insights sections have real backing vs mock.

## Next step

When this rises in priority: `/write-decision` → Codex Gate 1 → feature PR.
