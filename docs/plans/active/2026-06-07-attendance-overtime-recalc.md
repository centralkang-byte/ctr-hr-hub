# Bucket D #9 — Manual attendance correction does not recalculate overtimeMinutes

> 2026-06-07 (S267). Source = p0-dogfood-audit-triage Bucket D #9, verified against live code.
> Scope locked by CEO: **minimal — overtime recalculation only** (no 52h alert-record refresh).

## Verified problem (code, not audit claim)

`PUT /api/v1/attendance/[id]` (manual correction, HR_ADMIN) recomputes `totalMinutes`
when clockIn/clockOut change (`route.ts:111-122`) but **never recomputes `overtimeMinutes`**.
The stale value persists from the original clock-out.

### Triage symptom was imprecise
Triage said "→ 52h alert 오류". The 52h alert sums **`totalMinutes`**
(`workHourAlert.ts:96-99`), which the correction route *does* update — so overtime
staleness does **not** break the 52h threshold math.

### Real impact = payroll (money)
`payroll/calculator.ts:115-145` sums `Attendance.overtimeMinutes` (where `> 0`),
bucketed by `workType` (NORMAL/OVERTIME/NIGHT/HOLIDAY), to compute overtime premium pay.
A correction that changes clock times → stale `overtimeMinutes` → **wrong overtime pay**.
Secondary: monthly/weekly/analytics overtime displays drift.

### Root cause
Overtime formula is duplicated/scattered across write paths:
- `clock-out/route.ts:79` inline: `max(0, totalMinutes − BREAK − STANDARD)` = `max(0, t − 540)`
- correction route: **absent**
- (`workTypeEngine.ts` `WorkType` = FIXED/FLEXIBLE/SHIFT/REMOTE is a *different axis*
  — work arrangement, not the NORMAL/OVERTIME/NIGHT/HOLIDAY column enum. clock-out does
  not use it. Triage's "#113 ④-A 인접" pointer is misleading.)

## Fix — SHIPPED (single SSOT helper, behavior-preserving except the #9 fix)

1. **New** `src/lib/attendance/overtime.ts` — pure helpers:
   `computeOvertimeMinutes(totalMinutes, break=60) = max(0, total − break − 480)` +
   `graduatedBreakMinutes(total)` (8h→60·4h→30·else 0, terminal convention).
2. **clock-out/route.ts** — inline formula → `computeOvertimeMinutes(total)`; dropped unused
   local consts. Behavior-preserving (same math).
3. **attendance/[id]/route.ts** PUT — in `effectiveClockIn && effectiveClockOut` block,
   `updateData.overtimeMinutes = computeOvertimeMinutes(totalMinutes)`. ← **the #9 fix.**
4. **terminals/clock/route.ts** CLOCK_OUT — inline graduated-break formula →
   `computeOvertimeMinutes(total, graduatedBreakMinutes(total))`. Behavior-preserving.
5. **tests/unit/attendance/overtime.test.ts** — 8 boundary cases (both helpers).
6. **e2e/api/attendance-core.spec.ts** — wiring test: 720min correction → overtime 180 (skip-guarded).

## Gate outcomes
- **Codex Gate 1 (plan)**: sound, no P0. Flagged terminal auto-close omits overtime (P1) → folded in.
- **Codex Gate 2 (impl)**: caught that folding overtime into the terminal **CLOCK_IN auto-close**
  was unsafe — that path force-closes at `today 23:59` (future-dated → bogus `totalMinutes`),
  so adding overtime would push **false overtime into payroll**. **Reverted** the auto-close change.
  Re-review → **APPROVE**.

## Out of scope (decided at gate, tracked separately — not deferred vaguely)
- **Terminal CLOCK_IN auto-close bug** (`terminals/clock/route.ts` ~L46-71): query `workDate: today`
  + comment says "previous day" + 23:59 force-close fabricates future hours. Distinct from overtime
  recompute; needs product intent on what auto-close should do. → spawned as separate task.
- **Web (fixed 60) vs terminal (graduated) break policy mismatch** — pre-existing; domain decision,
  not unified here.
- **52h alert-record refresh** after a correction (CEO: minimal scope). Would fire belated 48h/52h
  notifications on current-week corrections.

## Verification — DONE
`tsc` 0 · `eslint` 0 · `vitest` 794 pass (8 new, +0 regressions) · Codex G1 sound · G2 APPROVE.

## Verification
- TDD: helper test first (red→green).
- `npx tsc --noEmit` 0, `npm run lint` 0, `npm run test:unit` (helper + regression).
- Codex Gate 1 (plan) + Gate 2 (impl, via /verify).
- No e2e fixture needed (pure helper + behavior-preserving wiring); manual reasoning that
  clock-out output is unchanged.
