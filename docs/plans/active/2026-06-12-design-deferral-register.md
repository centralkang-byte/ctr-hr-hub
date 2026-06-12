# Design Wave Campaign — Deferral Register (SSOT)

> **Purpose**: ONE place for everything the design refactor campaign deferred. Replaces the
> scattered `Out of scope` / `Deferred` / 이연 sections spread across 11+ Wave plan docs + STATUS.
> When someone asks "what did we punt?", read THIS file, not the individual plans.
>
> **Why this exists**: The campaign deliberately touches only the visual layer (colors/tokens,
> icons, banned patterns, a11y, copy) and FREEZES IA / layout / backend. Anything needing an
> IA/layout/backend change gets deferred. Those deferrals were recorded — but scattered, and
> unclassified, which made "we've deferred a lot" feel scarier than it is.
>
> **Method**: 55 raw deferred items were extracted from the Wave plan docs + STATUS, then
> classified. Most are not debt. This register keeps the real items visible and folds the noise.
>
> **Date**: 2026-06-12 · **Owner**: design campaign · **Status**: living doc, update per Wave PR.

---

## TL;DR — the scary "55 deferrals" breaks down to almost nothing

| Bucket | Count | Real risk? | Action |
|---|---|---|---|
| 🔴 **Launch-blocker candidates** | 4 | **Triage needed** | CEO decides per item (below) |
| 🟡 **Separate feature (post-launch)** | ~9 groups | No (planned) | Track here, do later via `/write-decision`→PR |
| 🔵 **Bug backlog (not a design deferral)** | 3 | Medium | Moved OUT to bug backlog / chips |
| ⚪ **Noise / already-resolved** | ~17 | **No** | Folded (listed at bottom for audit) |

**The headline insight**: the 🔴 candidates are mostly *backend/data absence reflected into the
UI* — the design team correctly refused to fabricate mock data and left honest empty states.
So the real debt is a **backend backlog**, not a design backlog. And the two biggest "separate
feature" items (onboarding 옵션3, insights IA) were **already CEO-ratified as deferred** — nothing
new exploded.

---

## 🔴 Launch-blocker candidates — CEO triage required

These are pages where the proto shows content but the UI is empty **because the backend/data
doesn't exist**. The design work left an honest gap (no mock fabrication). Decision per item:
is the empty state acceptable at launch, or must backend ship first?

| ID | Empty surface | Root cause | Source | Verdict needed |
|---|---|---|---|---|
| **B1** | `/payroll/me` — allowance breakdown rows | list API returns no per-line detail | sim-mypay.md:30 | Acceptable omission vs. backend before launch? |
| **B2** | Home — announcements section | announcement backend model/API/authoring UI **does not exist** | wave1-home.md:24; STATUS #148 | Ship without announcements, or build minimal backend? |
| **B3** | Payslip **PDF** generation | backend PDF normalization broken (pre-existing 500; see `[[hrhub-payslip-detail-normaliser]]`) | sim-mypay.md:45 (STUB-10) | Bug — must fix before payslip launch (also in 🔵 below) |
| **B4** | Onboarding 옵션3 **Analytics view** (4 metrics) | **zero** aggregation endpoints — all proto numbers hardcoded mock | onoffboarding-IA doc (a2222ba4) | Only blocks IF that feature ships; feature itself deferred (→ S1). **Never ship this view as-is.** |

> Note B3/B4 are real backend gaps, not design choices. B4 only matters when S1 is prioritized;
> until then it is inert (the whole feature is deferred).

---

## 🟡 Separate feature / later Wave — tracked, not urgent

Real work, but it's an IA/layout rebuild or a planned later phase. Fine post-launch. IA items
go through `/write-decision` → Codex → dedicated feature PR (per S288 precedent), **outside** the
design campaign.

| ID | Item | Why deferred | Source / status |
|---|---|---|---|
| **S1** | On/offboarding **Option 3** unified admin dashboard | feature-scale IA rebuild; 3/4 views buildable on real data, Analytics view needs backend (B4). nav already unified → no frozen-file edit | `2026-06-12-onoffboarding-unified-dashboard-ia.md` (CEO-ratified deferred). `/offboarding` 651L + detail 1152L need fate decision |
| **S2** | **Insights** unified IA (proto 1-page vs. 15 routes) | feature-scale IA rebuild; touches `/dashboard` exec home; some risk-card data mock | `2026-06-12-analytics-insights-unified-ia.md` (CEO 보류). Lives on `design/wave1-analytics` branch |
| **S3** | Wave 1 remaining legacy reskins: settings (7.7k), performance (12.8k), recruitment (8.3k LOC) | not yet in sequence — future Wave 1 design targets | STATUS S293 |
| **S4** | Employee / Manager / Executive **home V2** proto fidelity | later Wave 1 pages (HR Admin home done first) | wave1-home.md:28 |
| **S5** | Remaining 20 input-form **Dialog → WdDrawer** | Option 3 = per-page transition as each page is reskinned | modal-to-drawer-migration.md:23-51 (in progress) |
| **S6** | **Phase 4** bundle: dark-mode palette (`.dark`/Phase 4b), ⌘K enhancement, mobile card reflow | planned final polish phase; warm-button tokens pre-applied | wave0:96; wave1-home:30; final-bundle:71 |
| **S7** | Residual pattern cleanup: `bg-emerald-600` (19 files), `formatToTz` timezone (24 client files), variantless `<Button>` (15), risk-badge off-token dup (5+) | cross-cutting fan-out; campaign does it page-by-page to avoid blast | run-pages.md:19; warm-buttons Appx B; analytics-batch2:57 |
| **S8** | Global payroll **FX rate-impact table** (prev-month rate) | API doesn't return prev-month rate — needs backend extension | wave1-payroll-ia.md:20 |
| **S9** | Import **mapping** inline panel → WdDrawer; self-toast → use-toast | upload-state risk, separate pass | wave1-payroll-residual.md:75 |

---

## 🔵 Bug backlog — NOT design deferrals (moved out, per decision)

Real bugs the design work surfaced. They do not belong in the design deferral register; logged
here only as a pointer. Two already have spawn_task chips.

| ID | Bug | Chip / status |
|---|---|---|
| **BUG-1** | SUPER accessing another company's payroll run by-id → 404 → infinite skeleton | chip `task_62c94b78` (run-pages.md:100) |
| **BUG-2** | Global FX `42P01` from raw `"Company"` table query | chip `task_c13bac02` (residual.md:50) |
| **BUG-3** | Dynamic Tailwind class `text-[${STATUS_FG}]` never compiles (KpiSummaryCard:26) | **no chip yet** — needs one (wave0.md:121) |

---

## ⚪ Noise / already-resolved — folded (audit trail only)

Not debt. Listed so nothing is silently dropped.

- **Intentional freeze guards** (never touched, by design): Sidebar 240px / `navigation.ts` frozen files.
- **Mechanical / local-gate**: e2e visual baseline regen (330+ PNGs, once-per-wave); global/year-end
  baselines deferred due to hydration-race spinner capture (flaky tooling, not a product gap).
- **Already improved / resolved**: full `text-tertiary` ink contrast (already AA-improved);
  warm-orange primary button (resolved #152); payroll routes reskinned in follow-up PRs
  (review/sim/global/year-end/adjustments/bank-transfers — done across #156/#157/#159 etc.);
  home worklet colors/sections (done in Wave 1).
- **Intentional CEO decisions**: home sparkline removed (trend lives in /analytics);
  worklet vertical-stack → horizontal compact (CEO override, #165).
- **Cosmetic lowest-priority**: `ADJUSTMENT_TYPE_COLORS` inline hex → chart.ts; `chip.warning`
  friendly variant; polluted i18n key *values* (`工资roll Decision`) blocked by frozen-key rule.
- **Minor / unsure** (revisit if a page owner complains): year-end progressbar a11y + 11px text;
  anomalies camelCase→header i18n; no-data footnotes intentionally omitted; Form-Dialog
  reclassification pending; ExecutiveReportClient hardcoded English + `rounded-xl`.

---

## How to use / maintain

1. New Wave PR defers something → add a row to the right bucket here, not just the plan doc.
2. 🔴 candidates get a CEO verdict before launch; resolved ones move to ⚪ with a note.
3. 🟡 items get picked up via `/write-decision` → Codex → feature PR when prioritized.
4. 🔵 bugs live in chips / bug backlog, not here — this file is design deferrals only.
