import { describe, it, expect } from 'vitest'
import {
  determineViewerRole,
  maskPerformanceReview,
  maskCycleForEmployee,
  isResultPublishedForRole,
  getGradeLabel,
} from '@/lib/performance/data-masking'

// ─── determineViewerRole ───────────────────────────────────

describe('determineViewerRole', () => {
  it('should return HR_ADMIN for SUPER_ADMIN user', () => {
    expect(determineViewerRole('u1', 'e2', 'SUPER_ADMIN', false)).toBe('HR_ADMIN')
  })

  it('should return HR_ADMIN for HR_ADMIN user', () => {
    expect(determineViewerRole('u1', 'e2', 'HR_ADMIN', false)).toBe('HR_ADMIN')
  })

  it('should return EXECUTIVE for EXECUTIVE user', () => {
    expect(determineViewerRole('u1', 'e2', 'EXECUTIVE', false)).toBe('EXECUTIVE')
  })

  it('should return MANAGER when isManager is true', () => {
    expect(determineViewerRole('u1', 'e2', 'EMPLOYEE', true)).toBe('MANAGER')
  })

  it('should return EMPLOYEE when viewing own review', () => {
    expect(determineViewerRole('u1', 'u1', 'EMPLOYEE', false)).toBe('EMPLOYEE')
  })
})

// ─── maskPerformanceReview ─────────────────────────────────

describe('maskPerformanceReview', () => {
  const fullReview = {
    originalGrade: 'O',
    finalGrade: 'E',
    calibrationNote: 'Adjusted up',
    overdueFlags: ['GOAL_LATE_3D'],
    notifiedAt: '2026-01-15',
    notifiedBy: 'admin-1',
    mboScore: 4.2,
    beiScore: 3.8,
    totalScore: 4.0,
  }

  it('should return full review for HR_ADMIN', () => {
    const result = maskPerformanceReview(fullReview, 'HR_ADMIN')
    expect(result.originalGrade).toBe('O')
    expect(result.calibrationNote).toBe('Adjusted up')
  })

  it('should return full review for EXECUTIVE', () => {
    const result = maskPerformanceReview(fullReview, 'EXECUTIVE')
    expect(result.calibrationNote).toBe('Adjusted up')
  })

  it('should hide calibrationNote for MANAGER', () => {
    const result = maskPerformanceReview(fullReview, 'MANAGER')
    expect(result.calibrationNote).toBeUndefined()
    expect(result.originalGrade).toBe('O') // originalGrade visible to manager
  })

  it('should hide originalGrade, calibrationNote, overdueFlags, notifiedBy for EMPLOYEE', () => {
    const result = maskPerformanceReview(fullReview, 'EMPLOYEE')
    expect(result.originalGrade).toBeUndefined()
    expect(result.calibrationNote).toBeUndefined()
    expect(result.overdueFlags).toBeUndefined()
    expect(result.notifiedBy).toBeUndefined()
  })

  it('should preserve finalGrade for EMPLOYEE (Design Decision #17)', () => {
    const result = maskPerformanceReview(fullReview, 'EMPLOYEE')
    expect(result.finalGrade).toBe('E')
  })

  it('should preserve mboScore and beiScore for EMPLOYEE', () => {
    const result = maskPerformanceReview(fullReview, 'EMPLOYEE')
    expect(result.mboScore).toBe(4.2)
    expect(result.beiScore).toBe(3.8)
  })
})

// ─── maskCycleForEmployee ──────────────────────────────────

describe('maskCycleForEmployee', () => {
  it('should mask COMP_REVIEW as CLOSED with isResultPublished=false', () => {
    const result = maskCycleForEmployee({ status: 'COMP_REVIEW' })
    expect(result.status).toBe('CLOSED')
    expect(result.isResultPublished).toBe(false)
  })

  it('should mask COMP_COMPLETED as CLOSED with isResultPublished=false', () => {
    const result = maskCycleForEmployee({ status: 'COMP_COMPLETED' })
    expect(result.status).toBe('CLOSED')
    expect(result.isResultPublished).toBe(false)
  })

  it('should keep CLOSED as-is with isResultPublished=true', () => {
    const result = maskCycleForEmployee({ status: 'CLOSED' })
    expect(result.status).toBe('CLOSED')
    expect(result.isResultPublished).toBe(true)
  })

  // CALIBRATION/FINALIZED come BEFORE result notification (results not yet published).
  // getAllowedStatuses('result') still admits CALIBRATION, so isResultPublished must gate it.
  it('should keep CALIBRATION as-is with isResultPublished=false', () => {
    const result = maskCycleForEmployee({ status: 'CALIBRATION' })
    expect(result.status).toBe('CALIBRATION')
    expect(result.isResultPublished).toBe(false)
  })

  it('should keep FINALIZED as-is with isResultPublished=false', () => {
    const result = maskCycleForEmployee({ status: 'FINALIZED' })
    expect(result.isResultPublished).toBe(false)
  })
})

// ─── isResultPublishedForRole (server gate SSOT) ───────────

describe('isResultPublishedForRole', () => {
  // EMPLOYEE: only genuinely-CLOSED is published; comp stages stay hidden.
  it('should publish only CLOSED for EMPLOYEE', () => {
    expect(isResultPublishedForRole('CLOSED', 'EMPLOYEE')).toBe(true)
    expect(isResultPublishedForRole('CALIBRATION', 'EMPLOYEE')).toBe(false)
    expect(isResultPublishedForRole('COMP_REVIEW', 'EMPLOYEE')).toBe(false)
    expect(isResultPublishedForRole('COMP_COMPLETED', 'EMPLOYEE')).toBe(false)
    expect(isResultPublishedForRole('EVAL_OPEN', 'EMPLOYEE')).toBe(false)
  })

  // Privileged self-view mirrors the non-employee branch of GET /cycles.
  it('should publish CLOSED and COMP_COMPLETED for non-EMPLOYEE roles', () => {
    for (const role of ['HR_ADMIN', 'EXECUTIVE', 'MANAGER', 'SUPER_ADMIN']) {
      expect(isResultPublishedForRole('CLOSED', role)).toBe(true)
      expect(isResultPublishedForRole('COMP_COMPLETED', role)).toBe(true)
      expect(isResultPublishedForRole('CALIBRATION', role)).toBe(false)
      expect(isResultPublishedForRole('COMP_REVIEW', role)).toBe(false)
    }
  })

  // Fail-closed: missing/blank status (e.g. select omission) must never expose results.
  it('should fail closed for unknown/blank/undefined status', () => {
    expect(isResultPublishedForRole('', 'EMPLOYEE')).toBe(false)
    expect(isResultPublishedForRole('', 'HR_ADMIN')).toBe(false)
    // undefined cannot occur via the typed select, but the gate must still fail closed.
    expect(isResultPublishedForRole(undefined as unknown as string, 'EMPLOYEE')).toBe(false)
    expect(isResultPublishedForRole(undefined as unknown as string, 'HR_ADMIN')).toBe(false)
  })
})

// ─── getGradeLabel ─────────────────────────────────────────

describe('getGradeLabel', () => {
  it('should return Korean label for valid grade code', () => {
    expect(getGradeLabel('O', 'ko')).toBe('탁월(Outstanding)')
  })

  it('should return empty string for null', () => {
    expect(getGradeLabel(null)).toBe('')
  })
})
