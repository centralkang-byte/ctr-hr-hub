import { describe, it, expect } from 'vitest'
import {
  computeTrailingFourWeekAvgWeeklyHours,
  evaluateSeveranceEligibility,
  SEVERANCE_REASON_TENURE,
  SEVERANCE_REASON_WEEKLY_HOURS,
  SEVERANCE_WARN_NO_SCHEDULE,
  type ScheduleWindowInput,
} from '@/lib/payroll/severance-eligibility'

// ─── Helpers ────────────────────────────────────────────────

/** Create UTC date to avoid CI timezone issues */
function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

function sched(
  id: string,
  from: Date,
  to: Date | null,
  weeklyHours: number,
): ScheduleWindowInput {
  return { id, effectiveFrom: from, effectiveTo: to, weeklyHours }
}

const TERM = utc(2026, 3, 1) // termination date — window = [2026-02-01, 2026-03-01)

// ─── computeTrailingFourWeekAvgWeeklyHours ──────────────────

describe('computeTrailingFourWeekAvgWeeklyHours', () => {
  it('full-coverage single schedule → avg = its weeklyHours, 28 days', () => {
    const r = computeTrailingFourWeekAvgWeeklyHours(
      [sched('a', utc(2025, 1, 1), null, 40)],
      TERM,
    )
    expect(r.coveredDays).toBe(28)
    expect(r.avgWeeklyHours).toBe(40)
  })

  it('excludes termination day itself, includes term-28d', () => {
    // schedule covers exactly [TERM-28d, TERM-1d]; a schedule starting on TERM
    // must NOT contribute (term day excluded)
    const r = computeTrailingFourWeekAvgWeeklyHours(
      [
        sched('win', utc(2026, 2, 1), utc(2026, 2, 28), 20),
        sched('termday', utc(2026, 3, 1), null, 99),
      ],
      TERM,
    )
    expect(r.coveredDays).toBe(28)
    expect(r.avgWeeklyHours).toBe(20)
  })

  it('day-weighted average across mid-window schedule change', () => {
    // 14 days @ 10h (2/1..2/14), 14 days @ 20h (2/15..2/28)
    const r = computeTrailingFourWeekAvgWeeklyHours(
      [
        sched('lo', utc(2026, 1, 1), utc(2026, 2, 14), 10),
        sched('hi', utc(2026, 2, 15), null, 20),
      ],
      TERM,
    )
    expect(r.coveredDays).toBe(28)
    expect(r.avgWeeklyHours).toBe(15) // (14*10 + 14*20) / 28
  })

  it('overlap tie-break: effectiveFrom desc → most recent assignment wins', () => {
    const r = computeTrailingFourWeekAvgWeeklyHours(
      [
        sched('old', utc(2025, 1, 1), null, 8),
        sched('new', utc(2026, 1, 15), null, 40),
      ],
      TERM,
    )
    expect(r.avgWeeklyHours).toBe(40)
  })

  it('overlap tie-break: equal effectiveFrom → id asc deterministic', () => {
    const r = computeTrailingFourWeekAvgWeeklyHours(
      [
        sched('b', utc(2025, 1, 1), null, 30),
        sched('a', utc(2025, 1, 1), null, 12),
      ],
      TERM,
    )
    expect(r.avgWeeklyHours).toBe(12) // id 'a' < 'b'
  })

  it('partial coverage (< 28 days) → null (unknown, not inflated avg)', () => {
    // only 1 day covered (2026-02-28); 27 days unknown → must NOT be 25
    const r = computeTrailingFourWeekAvgWeeklyHours(
      [sched('one', utc(2026, 2, 28), utc(2026, 2, 28), 25)],
      TERM,
    )
    expect(r.coveredDays).toBe(1)
    expect(r.avgWeeklyHours).toBeNull()
  })

  it('day-weighted test also proves effectiveTo inclusivity + full cover', () => {
    // lo effectiveTo 2026-02-14 inclusive → no gap on 2/14 → covered 28.
    // If 2/14 were exclusive, covered would be 27 → null.
    const r = computeTrailingFourWeekAvgWeeklyHours(
      [
        sched('lo', utc(2026, 1, 1), utc(2026, 2, 14), 10),
        sched('hi', utc(2026, 2, 15), null, 20),
      ],
      TERM,
    )
    expect(r.coveredDays).toBe(28)
    expect(r.avgWeeklyHours).toBe(15)
  })

  it('no coverage in window → null', () => {
    const r = computeTrailingFourWeekAvgWeeklyHours(
      [sched('past', utc(2024, 1, 1), utc(2024, 12, 31), 40)],
      TERM,
    )
    expect(r.coveredDays).toBe(0)
    expect(r.avgWeeklyHours).toBeNull()
  })

  it('empty schedules → null', () => {
    const r = computeTrailingFourWeekAvgWeeklyHours([], TERM)
    expect(r.avgWeeklyHours).toBeNull()
  })
})

// ─── evaluateSeveranceEligibility ───────────────────────────

describe('evaluateSeveranceEligibility', () => {
  it('tenure < 365 → ineligible (tenure reason, no warning)', () => {
    expect(
      evaluateSeveranceEligibility({ tenureDays: 364, avgWeeklyHours: 40 }),
    ).toEqual({ eligible: false, reason: SEVERANCE_REASON_TENURE, warning: null })
  })

  it('tenure 365 boundary + 40h → eligible', () => {
    expect(
      evaluateSeveranceEligibility({ tenureDays: 365, avgWeeklyHours: 40 }),
    ).toEqual({ eligible: true, reason: null, warning: null })
  })

  it('avgWeeklyHours null → eligible with audit warning (not auto-excluded)', () => {
    expect(
      evaluateSeveranceEligibility({ tenureDays: 800, avgWeeklyHours: null }),
    ).toEqual({ eligible: true, reason: null, warning: SEVERANCE_WARN_NO_SCHEDULE })
  })

  it('avg 14.999 (< 15) → ineligible (weekly-hours reason)', () => {
    expect(
      evaluateSeveranceEligibility({ tenureDays: 800, avgWeeklyHours: 14.999 }),
    ).toEqual({
      eligible: false,
      reason: SEVERANCE_REASON_WEEKLY_HOURS,
      warning: null,
    })
  })

  it('avg exactly 15.0 → eligible (>= 15)', () => {
    expect(
      evaluateSeveranceEligibility({ tenureDays: 800, avgWeeklyHours: 15 }),
    ).toEqual({ eligible: true, reason: null, warning: null })
  })

  it('tenure reason takes precedence over weekly-hours', () => {
    expect(
      evaluateSeveranceEligibility({ tenureDays: 100, avgWeeklyHours: 5 }),
    ).toEqual({ eligible: false, reason: SEVERANCE_REASON_TENURE, warning: null })
  })
})
