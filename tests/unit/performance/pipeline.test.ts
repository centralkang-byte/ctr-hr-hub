import { describe, it, expect } from 'vitest'
import {
  getPipelineSteps,
  getNextStatus,
  isFinalStatus,
  getAllowedStatuses,
  addOverdueFlag,
  daysSinceDeadline,
  isAutoAcknowledgeExpired,
  formatOverdueBadge,
  H1_PIPELINE,
  H2_PIPELINE,
} from '@/lib/performance/pipeline'

// ─── getPipelineSteps ──────────────────────────────────────

describe('getPipelineSteps', () => {
  it('should return 4 steps for H1', () => {
    expect(getPipelineSteps('H1')).toEqual(H1_PIPELINE)
    expect(getPipelineSteps('H1')).toHaveLength(4)
  })

  it('should return 7 steps for H2', () => {
    expect(getPipelineSteps('H2')).toEqual(H2_PIPELINE)
    expect(getPipelineSteps('H2')).toHaveLength(7)
  })
})

// ─── getNextStatus ─────────────────────────────────────────

describe('getNextStatus', () => {
  it('should transition DRAFT → ACTIVE', () => {
    expect(getNextStatus('DRAFT', 'H1')).toBe('ACTIVE')
  })

  it('should skip CHECK_IN in H1: EVAL_OPEN → CLOSED', () => {
    // H1 pipeline: DRAFT, ACTIVE, EVAL_OPEN, CLOSED
    expect(getNextStatus('EVAL_OPEN', 'H1')).toBe('CLOSED')
  })

  it('should return null for terminal status in H1 (CLOSED)', () => {
    expect(getNextStatus('CLOSED', 'H1')).toBeNull()
  })

  it('should continue past CLOSED in H2: CLOSED → CALIBRATION', () => {
    expect(getNextStatus('CLOSED', 'H2')).toBe('CALIBRATION')
  })

  it('should return null for terminal status in H2 (COMP_COMPLETED)', () => {
    expect(getNextStatus('COMP_COMPLETED', 'H2')).toBeNull()
  })

  it('should return null for unknown status', () => {
    expect(getNextStatus('INVALID', 'H1')).toBeNull()
  })
})

// ─── isFinalStatus ─────────────────────────────────────────

describe('isFinalStatus', () => {
  it('should be true for CLOSED in H1', () => {
    expect(isFinalStatus('CLOSED', 'H1')).toBe(true)
  })

  it('should be true for COMP_COMPLETED in H2', () => {
    expect(isFinalStatus('COMP_COMPLETED', 'H2')).toBe(true)
  })

  it('should be false for DRAFT', () => {
    expect(isFinalStatus('DRAFT', 'H1')).toBe(false)
  })

  it('should be false for CLOSED in H2 (not terminal)', () => {
    expect(isFinalStatus('CLOSED', 'H2')).toBe(false)
  })
})

// ─── getAllowedStatuses ────────────────────────────────────

describe('getAllowedStatuses', () => {
  it('goals phase should return from ACTIVE onward (H1)', () => {
    const result = getAllowedStatuses('goals', 'H1')
    expect(result[0]).toBe('ACTIVE')
    expect(result).not.toContain('DRAFT')
  })

  it('evaluation phase should return from EVAL_OPEN onward (H2)', () => {
    const result = getAllowedStatuses('evaluation', 'H2')
    expect(result[0]).toBe('EVAL_OPEN')
  })

  it('compensation phase should return empty for H1 (no COMP_REVIEW)', () => {
    expect(getAllowedStatuses('compensation', 'H1')).toEqual([])
  })

  it('compensation phase should return COMP_REVIEW + COMP_COMPLETED for H2', () => {
    expect(getAllowedStatuses('compensation', 'H2')).toEqual(['COMP_REVIEW', 'COMP_COMPLETED'])
  })

  it('calibration phase should return empty for H1', () => {
    expect(getAllowedStatuses('calibration', 'H1')).toEqual([])
  })

  it('calibration phase should return from CALIBRATION onward for H2', () => {
    const result = getAllowedStatuses('calibration', 'H2')
    expect(result[0]).toBe('CALIBRATION')
    expect(result).toContain('COMP_COMPLETED')
  })
})

// ─── addOverdueFlag ────────────────────────────────────────

describe('addOverdueFlag', () => {
  it('should add flag to empty array', () => {
    expect(addOverdueFlag([], 'GOAL_LATE_3D')).toEqual(['GOAL_LATE_3D'])
  })

  it('should dedup existing flag', () => {
    expect(addOverdueFlag(['GOAL_LATE_3D'], 'GOAL_LATE_3D')).toEqual(['GOAL_LATE_3D'])
  })

  it('should handle null/non-array input', () => {
    expect(addOverdueFlag(null, 'GOAL_LATE_3D')).toEqual(['GOAL_LATE_3D'])
  })
})

// ─── daysSinceDeadline ─────────────────────────────────────

describe('daysSinceDeadline', () => {
  it('should return 0 when deadline is today', () => {
    const now = new Date()
    expect(daysSinceDeadline(now, now)).toBe(0)
  })

  it('should return 3 for deadline 3 days ago', () => {
    const now = new Date(2026, 3, 8) // April 8
    const deadline = new Date(2026, 3, 5) // April 5
    expect(daysSinceDeadline(deadline, now)).toBe(3)
  })

  it('should return 0 when deadline is in the future', () => {
    const now = new Date(2026, 3, 5)
    const deadline = new Date(2026, 3, 10)
    expect(daysSinceDeadline(deadline, now)).toBe(0)
  })
})

// ─── isAutoAcknowledgeExpired ──────────────────────────────

describe('isAutoAcknowledgeExpired', () => {
  it('should return true after 168+ hours', () => {
    const now = new Date()
    const notifiedAt = new Date(now.getTime() - 200 * 60 * 60 * 1000) // 200 hours ago
    expect(isAutoAcknowledgeExpired(notifiedAt, now)).toBe(true)
  })

  it('should return false before 168 hours', () => {
    const now = new Date()
    const notifiedAt = new Date(now.getTime() - 100 * 60 * 60 * 1000) // 100 hours ago
    expect(isAutoAcknowledgeExpired(notifiedAt, now)).toBe(false)
  })

  it('should return true at exactly 168 hours (>= threshold)', () => {
    const now = new Date()
    const notifiedAt = new Date(now.getTime() - 168 * 60 * 60 * 1000)
    expect(isAutoAcknowledgeExpired(notifiedAt, now)).toBe(true)
  })
})

// ─── formatOverdueBadge ────────────────────────────────────

describe('formatOverdueBadge', () => {
  it('should return empty string for empty array', () => {
    expect(formatOverdueBadge([])).toBe('')
  })

  it('should format GOAL_LATE flag', () => {
    expect(formatOverdueBadge(['GOAL_LATE_3D'])).toBe('🚨 목표 3일 지연')
  })

  it('should format CHECKIN_MISSING flag', () => {
    expect(formatOverdueBadge(['CHECKIN_MISSING'])).toBe('🚨 체크인 미완료')
  })

  it('should join multiple flags with ·', () => {
    expect(formatOverdueBadge(['GOAL_LATE_5D', 'SELF_EVAL_LATE_2D']))
      .toBe('🚨 목표 5일 지연 · 자기평가 2일 지연')
  })
})
