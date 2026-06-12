# Wave 1 Page-IA Proto-Fidelity Map — ground-truthed (2026-06-12)

> **CEO intent**: the proto is NOT just the sidebar — **every page's IA/layout/UX was deliberately
> designed with function in mind**. Bring live pages to proto fidelity. The design Wave only matched
> the VISUAL layer (color/tokens/banned patterns) and froze page IA/layout — so this is the deferred
> half.
>
> **Method**: 11-cluster workflow comparing proto page IA vs live page IA on `origin/main`, every
> divergence classified, then a skeptical verify pass on every `backend-needed`/`keep-live` call.
> 225 divergences; verify overturned **16** (92 upheld).
>
> **Governing principle** (same as sidebar): adopt the proto's deliberate IA; **re-home** live-only
> real features into the proto structure (never delete); **build backend** where the proto shows data
> that genuinely doesn't exist (never fabricate mock); **keep-live** where live is provably better.

---

## Headline — the "backend-needed" scare deflated under verification

The raw map flagged 42 `backend-needed`. The skeptical verify pass showed **most are "data/endpoint/
component already exists, just not wired"** — i.e. frontend `adopt`/`re-home`, not a backend build:

- payroll **글로벌 FX table** → prev-month rates are ALREADY queried in the same route; just omitted
  from the response shape. (Corrects the earlier S8 "backend extension".)
- payroll **연말정산 4-card** → `finalSettlement` already returned; client reduction + minor summary add.
- employees **성과평가 tab** → `EmployeeInsightPanel` + `/employees/[id]/insights` + recognition endpoint
  already ship; it's a `comingSoon` placeholder over a live backend → re-home.
- insights **Executive Summary** (hero, AI one-liner, risk cards, corp comparison) → **already built**
  on `/dashboard` (the proto exec view was re-homed there); only the nav label points to a dead redirect.
- performance **goals/results analytics** → 2-of-3 + grade×raise aggregations already exist on other
  routes → re-home, not build.
- my-space **profile tabs / training goal** → existing components + computable data → adopt.

**Net after verify**: ~57 adopt · ~29 re-home · **~31 backend-needed** (and most of THOSE are optional
analytics depth) · ~61 keep-live · ~44 already-aligned. **The proto-fidelity work is mostly frontend
wiring; the true backend backlog is small and concentrated in analytics enrichment.**

---

## Per-cluster state (proto vs live)

### home — ~80% aligned (HrAdmin home already heavily converted)
- adopt/re-home: minor. **keep-live**: SuggestCard gates on real data (proto fabricates).
- TRUE backend: worklet **inline status rows** (per-tile drill, L — but CEO chose "compact" #165, taste);
  **announcements** section (B2, no model, L); **2 of 6** hero KPIs (leave-usage, avg-overtime) need aggregation.
- Exec/Manager/Employee homes have NO single-persona proto (different primitive family) — keep-live.

### my-space — bulk already converted; concentrated in 2 pages
- **adopt**: profile gradient worker-banner + read-only attendance/leave/perf summary tabs (data+components
  exist); skills radar default-visible (flip toggle); training quarter-goal card (computable + const target).
- **re-home**: recognition personal 보낸/받은 tabs + value-distribution (backend exists).
- keep-live: the `/my` hub is live-only (no proto) — KEEP, but **fix its leave source (LB1: reads legacy
  EmployeeLeaveBalance → migrate to LeaveYearBalance)**.

### attendance-leave — same self/admin axis; high-value adopts
- **adopt**: attendance **weekly time-grid** (7 day-tiles, data already returned); leave **team-calendar Gantt**;
  LoA paid/unpaid + **file-upload** (backend fully supports; frontend form gap).
- **keep-live (never delete)**: shift-roster, 52h alerts, manual-correction drawer, negative-balance table, full LOA lifecycle.
- TRUE backend (XL, optional depth): attendance trend/dept/arrival analytics; leave 사용패턴 분석 (needs reason-category field).

### employees-org — most mature; org page is richer than proto
- **adopt**: employee-list multi-select filter dropdowns + active-filter chip row + checkbox row-select → BulkActionBar;
  detail **wd-worker-banner** header (DESIGN_RULES signature pattern).
- **re-home**: detail 성과평가 tab (EmployeeInsightPanel exists); per-employee 계약/취업허가 (live-only).
- TRUE backend (XL): detail **경력 이력** tab (education/certifications storage doesn't exist).

### payroll — ~80% aligned; narrow deltas
- **adopt**: 연말정산 4-card strip + global **FX-impact table** (both data already on hand).
- **re-home (never delete)**: the entire execution backend the single-persona proto can't show —
  close-attendance, adjustments, anomalies, bank-transfers, import, run/[id] review→approve→publish, self-service.
- TRUE backend: 연말정산 **공제 항목 분포** tab (L); 자료-누락 reminder send (M).

### performance — proto consolidates, live explodes into ~20 routes
- **adopt**: perf-cycle **overview** (wd-summary-lead narrative + 4-step stepper + active-cycles grid + key-dates);
  unify 징계/포상 into one tabbed page; status-chip KPI headers.
- **keep-live**: calibration (live 9-box engine ≫ proto static 4×4).
- TRUE backend: only **goal-category distribution** (MboGoal has no `category` — schema migration) + calibration-meeting table (defer).

### onboarding-offboarding — the deferred Option 3
- Unified journey-analytics dashboard. **Analytics view = zero backend (XL, never ship mock)**; 3/4 views buildable.
  CEO-deferred feature; reopening = separate decision. *(Cluster under-mapped by the agent — only 3 divergences; revisit if prioritized.)*

### recruitment — list page violates its own pattern
- **adopt**: **/recruitment list** is a bare table with NO KPI strip/tabs/funnel — DESIGN_RULES:69 assigns it
  Pattern A (stat strip); add KPI strip + per-job funnel cards.
- **keep-live**: requisitions+approval, cost-ROI, interviews, succession (live-only depth).
- TRUE backend: 파이프라인 analytics — channel effectiveness, **time-to-hire by stage** (needs stage-transition timestamps), monthly pass-rate.

### insights-analytics — the backend-heavy outlier (but mostly optional depth)
- Top-level IA already aligned (8 sidebar items ↔ 8 proto sub-views); per-page chrome already Wave-converted.
- **already-aligned (verify)**: Executive Summary fully lives on `/dashboard` — only fix the dead nav label (`/analytics`→`/dashboard`).
- **re-home (do-not-delete)**: predictive ML, compensation, gender-pay-gap, report, attrition, compare — deep-link orphans not in sidebar.
- TRUE backend (~10, mostly OPTIONAL "section density"): workforce extra cuts, comp distribution/percentiles, perf 9-box
  (link to existing calibration instead), attendance long-non-takers list+notify (high value), team-health trend+eNPS,
  **AI report structured JSON** (XL), ask-AI NL query.

### team — maps ~1:1; live mostly equal-or-richer
- **adopt**: manager-hub **5-tab hub** (개요/팀원/1:1·활동/성과/AI) previewing the dedicated pages; weekly attendance trend; status-chip headers; member-grid preview.
- TRUE backend (derivable): manager-hub per-member overtime/leaveUsage/grade/risk (some fields exist on Employee); 5-day team attendance-rate trend.

### settings-compliance — settings near byte-for-byte; compliance overview is the gap
- settings config is a near-exact proto port (live exceeds it). **adopt**: header actions (변경 이력 / 설정 백업) + 최근 변경 widget (Pattern D).
- compliance 4-tab IA already converted; PII-Audit/Country are deeper live (keep-live).
- TRUE backend: **설정 백업 export** endpoint (M); compliance **score engine** (Pattern-D hero score + per-law status + alerts feed — no scoring backend exists).

---

## True backend backlog (post-verify) — small, mostly deferrable
| Area | Item | Effort | Launch-critical? |
|---|---|---|---|
| home | announcements model+API+authoring (B2) | L | no (ship-without OK) |
| home | worklet inline rows / 2 KPIs aggregation | L | no (CEO chose compact) |
| employees | career-history (education/cert) storage | XL | no |
| payroll | 연말정산 공제분포 + 자료누락 reminder | L+M | no |
| performance | MboGoal.category field (schema) | M | no |
| recruitment | pipeline timing (stage-transition timestamps) | L | no |
| onboarding | analytics aggregations (Option 3) | XL | no (feature-deferred) |
| insights | ~10 analytics depth cards + AI structured JSON | M–XL | no (enrichment) |
| settings | settings-export + compliance score engine | M+L | no |

**Nothing here is launch-blocking.** It's proto-fidelity enrichment, sequenceable after the frontend adopts.

## Recommended sequence (frontend-first, backend-gated last)
1. **Sidebar re-categorization** (separate proposal) — the IA spine.
2. **Frontend adopt/re-home, cluster by cluster** — start with high-value, low-risk: employees-list bulk-select +
   detail banner, attendance weekly-grid, my-space profile tabs + recognition, recruitment list Pattern-A,
   performance perf-cycle overview, team manager-hub tabs, payroll FX/연말정산 cards, settings header widgets.
   (Each is mostly wiring existing data/components into the proto IA.)
3. **Quick wins**: insights nav label fix (`/analytics`→`/dashboard`); LB1 leave-source fix.
4. **Backend enrichment** (the table above) — prioritize by value (e.g. attendance long-non-takers notify) as separate features.

> Keep-live (~61) = where literal "동일" is WRONG (live is better). Do NOT regress those to match a simplified mock.
