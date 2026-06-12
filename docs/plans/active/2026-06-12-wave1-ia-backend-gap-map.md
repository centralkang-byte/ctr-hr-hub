# Wave 1 IA / Backend Gap Map — ground-truthed (2026-06-12)

> Companion to `2026-06-12-design-deferral-register.md`. The register listed what the design
> campaign **punted**; this maps each item against **origin/main** to see what is *actually still
> open* — because much of the "scary backlog" already landed.
>
> **Method**: 10 parallel investigators + skeptical re-verify of every blocker/high claim, all read
> against `origin/main` (the working tree is a superseded design branch). Sidebar IA mapped
> separately vs `_design-reference/shell.jsx`. Three highest-stakes claims (multi-tenant "done",
> BUG-2 blocker, LB1 high) cross-verified in the main session.
>
> **Governing principle (CEO, 2026-06-12)**: bring IA/backend **최대한 디자인 레퍼런스(프로토)와
> 동일하게**. ⚠ Caveat surfaced by the map: the proto is a *single-persona HR mock with no RBAC* —
> "identical" must NOT delete real functionality the mock could not express. Calibration pending.

---

## Headline — ground truth flipped the narrative

Already DONE on `origin/main` (memory / register were stale):

- **Multi-tenant P0 "launch blocker" (memory: 58 P0)** — **RESOLVED.** 8 isolation batches merged
  (#131–#143: settings/analytics/onboarding-leave-training/misc/residual + offboarding/year-end/
  attendance), SSOT enforcers `companyFilter.ts`/`withRLS.ts` present + PROTECTED + widely used,
  regression-prevention **ESLint guard** added (#137). Remaining = a *separate* by-id IDOR audit
  (medium) + explicitly-deferred policy (MANAGER dotted-line, FK cross-company, RLS SQL — low).
- **Payroll SoD RBAC** — core (PR #126) **and** EXECUTIVE approver landed. Small residue only.
- **B1 payroll/me allowance rows** — **NOT a backend gap.** `/api/v1/payroll/me` already returns
  full per-line `detail`; `/payroll/me/[runId]` renders it via `PayStubBreakdown`. The *list* hero
  just omits rows behind a stale comment. Frontend choice / no-op.
- **B3 payslip PDF 500** — fixed.
- **BUG-1 SUPER cross-company run-by-id 404** — fixed.
- **Special / event-based leave self-application** — implemented (memory stale).

---

## 🔴 Real blocker — fix before launch

- **BUG-2 — Payroll simulation FX + HIRING baseline queries are 100% dead.**
  `src/app/api/v1/payroll/simulation/route.ts` raw `$queryRaw` blocks use PascalCase tables/columns
  (`"Company"`, `"EmployeeAssignment"`, `"CompensationHistory"`, `"newBaseSalary"`) but Prisma
  `@@map`s them to snake_case (`companies`, `employee_assignments`, `compensation_history`,
  `new_base_salary`) → Postgres **42P01 / 42703** on every call → caught into a 400. Two blocks:
  L708–714 (hiring), L800–822 (FX). Reachable from `FxTab.tsx:103`. **Single-file fix, effort S.**
  *(Confirmed in main session: @@map verified at schema.prisma:1026/1661/3037, col map :3009.)*

---

## 🟠 Real user-facing bug — high (not a blocker)

- **LB1 — My Space shows stale / empty leave balance.** `my/page.tsx:40` reads the legacy
  `EmployeeLeaveBalance` (0 runtime writes; seed-only) instead of `LeaveYearBalance` (all 12 runtime
  writes: grant/approve/cancel/reject/accrual). Every post-seed employee sees a wrong 잔여 연차 on the
  personal landing KPI + balance list. The real `/leave` workflow reads the correct table, so no
  corruption — a **trust/credibility** defect on a high-traffic page. Re-source via `leaveTypeDef.code`.
  Effort M. *(Verified; `dashboard/summary` already migrated, so My Space is strictly behind.)*

---

## 🟢 Proto-fidelity backend — small (only if we match proto)

- **B2 — Home announcements (전사 공지).** No `Announcement`/`Notice` model, API, or authoring UI
  exists (confirmed; only per-employee `Notification`). Proto `page-dashboard-workday.jsx:310-358`
  shows an HR-authored notice section. To match: minimal `Announcement` model + company-scoped read
  API (resolveCompanyId + withRLS) + HR authoring form. Effort M. (Or ship without — no broken
  surface renders today.)
- **S8 — Global payroll FX prev-month rate-impact.** API returns only current-month rate; proto
  shows a rate-impact delta vs previous month. Needs a backend extension to expose prev-month rate.
  Effort S.

---

## 🔵 Feature-scale IA rebuild — large, all CEO-deferred ("최대한 동일" decision lands here)

- **Sidebar structural divergence (~11)** vs `_design-reference/shell.jsx` `NAV`.
  Biggest deltas: **My Space** 10 (proto) vs **12 + 3 conditional** (live); **휴가/휴직** merged
  (proto) vs split into 휴가 신청 + 휴직 신청 (live); **컴플라이언스** in 인사관리 (proto) vs 설정 (live).
  Most *other* structural diffs = **live is more complete** (payroll 근태마감/이상검토, full RBAC
  gating, conditional self-service, 분기 리뷰 admin) — reverting would be a regression.
  Plus ~11 **label/copy** aligns that are safe (리코그니션→칭찬/인정, 팀 건강→팀 헬스, 목표/평가→평가/성장,
  위임 설정→업무 위임 …) **except** labels that would over-promise (이직 분석→이직 **예측** implies ML the
  backend may not have; 이체 내역→이체 **관리** if the page is read-only). `navigation.ts` is FROZEN —
  any structural change is a deliberate, isolated IA edit + verification.
- **S1 — On/offboarding Option 3 unified admin dashboard.** 3 of 4 views (grid/table/journey)
  buildable on real data (`onboarding/dashboard` already serves buddy/template/progress/isDelayed/
  emotionPulse); the **Analytics view (4 metrics) has ZERO aggregation backend** — proto numbers are
  hardcoded mock, do not fabricate. Feature-scale, XL.
- **S2 — Insights 15 routes → 1 proto page.** **Key correction:** the implementation data is
  **real Prisma-backed** (the mock was only in the proto JSX) — so this is pure IA work, *not*
  blocked by missing data. Touches the `/dashboard` exec home; note `/analytics`→`/dashboard`
  redirect. + 3 genuinely-orphan routes (compensation, gender-pay-gap, report) cheap to wire-or-drop.
  Feature-scale, XL.

---

## ⚪ Low-priority cleanup

- **Multi-tenant by-id IDOR audit** — `findUnique({id})` without companyId across routes; separate
  open track, medium.
- **Leave legacy residue**: LB2 analytics predictions read legacy → degraded signals (medium);
  LB3 Teams bot command (low); LB4 dashboard avg-usage catch-block fallback (low); LB5 drop the
  legacy `EmployeeLeaveBalance` model + seed writers once LB1–4 done (low, ceo-gated).
- **RBAC residue**: EXECUTIVE can't *pull* pending payroll from the unified inbox (push-only, low);
  submit step-1 notify hardcodes HR_ADMIN/SUPER + omits companyId on role match (optional).
- **BUG-3** dynamic Tailwind `text-[${STATUS_FG}]` never compiles (`KpiSummaryCard:26`) — low, no chip.

---

## Verdict counts (this map)

| Bucket | Items | Net new work |
|---|---|---|
| Already done (was "open" in memory) | 6 tracks | 0 |
| 🔴 Blocker | 1 (BUG-2) | S |
| 🟠 High user-facing | 1 (LB1) | M |
| 🟢 Proto-fidelity backend | 2 (B2, S8) | M + S |
| 🔵 IA rebuild (CEO decision) | 3 (sidebar, S1, S2) | XL each |
| ⚪ Cleanup | ~8 | mixed |

**Bottom line**: the actionable, non-decision work is tiny — **BUG-2 (S) + LB1 (M)**. Everything
heavy is an IA rebuild gated on the "최대한 동일" calibration, and the proto being a simplified mock
means literal parity would *remove* working features. Decide the calibration, then sequence the
rebuilds where the backend actually supports them (S2 yes; S1 3/4; B2 needs a small new model).
