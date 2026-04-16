import { describe, it, expect } from 'vitest'
import {
  determineViewerRole,
  maskPerformanceReview,
  maskCycleForEmployee,
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
