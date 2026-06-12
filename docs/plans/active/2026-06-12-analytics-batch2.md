# Analytics Wave 1 — Batch 2 (design forbidden-pattern cleanup)

**Branch:** `design/wave1-analytics-batch2` (off origin/main)
**Constraints:** IA/layout/backend untouched · i18n add-only (all keys verified resolving — 0 leaks) · Pixel Gate at **pattern level** (no 1:1 proto exists for these analytics leaf pages).
**Audit:** 11-file parallel workflow + main-session ground-truth cross-check (4 verify agents were rate-limited on the dirty files, all of which were independently verified in main session).

## Scope summary

- **6 leaf clients CONFIRMED CLEAN — no edits:** workforce, payroll, compensation, attrition, recruitment, report (i18n resolves, chart colors from `chart.ts` SSOT, zero forbidden patterns).
- **Edits:** 5 page clients + 2 shared analytics components + `chart.ts` (additive). **Remove 2 dead files.**

## Edits

### 1. `predictive/PredictiveAnalyticsClient.tsx` (10 gaps)
- **RISK_CONFIG (101-106)** — tokenize off-token (low/medium/critical) **+ fix severity inversion** (current high=red / critical=orange is inverted vs `RISK_COLORS` and the canonical `HighRiskList` map, which both order high=orange / critical=red; `ScoreBar` already uses the correct `RISK_COLORS` ramp). New map (tokens only):
  - low → `bg-tertiary/10 text-[#006b39] border-tertiary/30`
  - medium → `bg-warning-bright/15 text-ctr-warning border-warning-bright/30`
  - high → `bg-wd-orange-soft text-wd-orange-ink border-wd-orange/30` (orange = `RISK_COLORS.high`)
  - critical → `bg-destructive/10 text-destructive border-destructive/20` (red = `RISK_COLORS.critical`)
  - Keep `RiskBadge` as a manual pill (badge.tsx has **no orange variant** → cannot use `<Badge variant>`; auditor's `<Badge accent>` was unsound — `accent`=wt-4=`#d73337` red, would collide high/critical).
- **SummaryCards tile bg (166/174/182/190 + render 199)** — move inline hex → semantic className (atomic with line 199); fixes violet `#EDE9FE` (card3, mismatched its amber icon) → warning. Icon colors stay inline (`RISK_COLORS`/`CHART_THEME`, exception 5c).
  - `#FEE2E2`→`bg-destructive/10` · `#FEF3C7`→`bg-warning-bright/15` · `#EDE9FE`→`bg-warning-bright/15` · `#D1FAE5`→`bg-tertiary/10`
- 480 `text-emerald-600`→`text-[#006b39]` · 612/704 `text-amber-700`→`text-ctr-warning`.

### 2. `gender-pay-gap/GenderPayGapClient.tsx` (~8 mappings + 1 decision)
- 124-125 gap-color fn → `text-[#006b39]` / `text-ctr-warning`
- 130-131 badge classes → D17 success/warning tokens
- 215 card-bg ternary → `bg-warning-bright/10` / `bg-tertiary/5` (keep existing `bg-destructive/5`)
- 221/223 trend icons → `text-ctr-warning` / `text-[#006b39]` · 345 diff → `text-[#006b39]`
- **DECISION D1 — gender F color** (197 icon, 288 label, 291 bar): M = `bg-primary`/`text-primary` (navy, correct token); F = off-token `pink-400/500`. Options — **(A)** keep pink as a `GENDER_COLORS` domain constant in `chart.ts` (exception 5c) [recommended — conventional pink/navy gender encoding, least surprising]; **(B)** F → `wd-orange` (brand-pure navy/orange).

### 3. `dashboard/DashboardClient.tsx` (2)
- 272 MEDIUM row: malformed `bg-amber-500/10/50` (invalid double-opacity — renders nothing) → `bg-warning-bright/10 hover:bg-warning-bright/15`; drop off-token dark `amber-950` (HIGH/default siblings have no dark variant; dark mode deferred).
- 277 icon `text-amber-500` → `text-ctr-warning`.

### 4. `dashboard/compare/CompareClient.tsx` (1 + 1 minor)
- 304 `fill: '#334155'` → `CHART_THEME.axis.label.fill` (exact literal dup).
- 326/328 `#94A3B8` (recharts ReferenceLine stroke/label) — genuine chart-domain (exception 5c); leave as documented literal (minor; optional `CHART_THEME.axis.referenceLine`).

### 5. `attendance/AttendanceClient.tsx` (1)
- 112 heatmap zero-cell `#F3F4F6` → add `HEATMAP_COLORS.empty` to `chart.ts` and reference.

### 6. `components/analytics/AnalyticsKpiCard.tsx` (4) — SHARED; live consumer = `compensation` only (Batch 2; other consumer is the dead AttendanceAnalyticsClient). **No Batch-1 re-shading.**
- colorMap/iconBgMap off-token emerald/amber → `tertiary`/`warning-bright` D17 tokens.

### 7. `components/analytics/PercentileBar.tsx` (2) — SHARED; consumer = `compare` only (Batch 2).
- `bg-emerald-500/100`→`bg-tertiary` · `bg-amber-500/100`→`bg-warning-bright` (the `/100` is a no-op). a11y status-color-only of the marker dot noted as a **separate** concern (not regressed here).

### 8. `src/lib/styles/chart.ts` (additive SSOT)
- `HEATMAP_COLORS.empty` · (per D1: `GENDER_COLORS`) · (optional `CHART_THEME.axis.referenceLine`).

### Dead-code removal (in-track — feedback-decision-gating)
- `analytics/attendance/AttendanceAnalyticsClient.tsx` (0 refs) — remove.
- `components/analytics/BurnoutBadge.tsx` (0 refs) — remove (avoids fixing its off-token orange; nothing renders it).

## Out of scope / flagged
- **Systemic risk-badge off-token dup (5+ files):** HighRiskList, EmployeeRiskDetailClient (Batch-1), InsightSurfacingBanner, DpiaTabContent, BiasDetectionBanner → separate SSOT-consolidation follow-up.
- DashboardClient hashed i18n keys (`average_keab7bcec`…) — pre-existing, not touched (not editing its i18n).
- ExecutiveReportClient hardcoded English strings + `rounded-xl` — outside forbidden-pattern set.

## Verification
tsc 0 · lint 0 · Pixel Gate (HR_ADMIN real browser, pattern-level vs design system) · Codex G1 (this plan) / G2 (post-impl).
