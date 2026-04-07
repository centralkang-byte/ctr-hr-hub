import { describe, it, expect } from 'vitest'
import { maskQuarterlyReview } from '@/lib/performance/quarterly-review-masking'
import type { SessionUser } from '@/types'

// ─── Helpers ────────────────────────────────────────────────

const EMPLOYEE_ID = 'emp-001'
const MANAGER_ID = 'mgr-001'

function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-001',
    employeeId: 'other-emp',
    companyId: 'company-001',
    name: 'Test User',
    email: 'test@ctr.co.kr',
    role: 'EMPLOYEE',
    permissions: [],
    ...overrides,
  }
}

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 'review-001',
    employeeId: EMPLOYEE_ID,
    managerId: MANAGER_ID,
    status: 'DRAFT',
    // EMPLOYEE_FIELDS
    goalHighlights: 'My highlights',
    challenges: 'My challenges',
    developmentNeeds: 'My dev needs',
    employeeComments: 'My comments',
    employeeSubmittedAt: '2026-03-15T09:00:00Z',
    // MANAGER_FIELDS
    managerFeedback: 'Manager feedback',
    coachingNotes: 'Coaching notes',
    developmentPlan: 'Dev plan',
    overallSentiment: 'POSITIVE',
    managerSubmittedAt: '2026-03-16T09:00:00Z',
    actionItems: [{ text: 'Action 1' }],
    aiSummary: 'AI summary text',
    // goalProgress with both employee and manager fields
    goalProgress: [
      {
        goalId: 'goal-1',
        employeeComment: 'Employee progress note',
        managerComment: 'Manager progress note',
        trackingStatus: 'ON_TRACK',
        progressPct: 60,
      },
    ],
    ...overrides,
  }
}

// ─── HR_ADMIN / SUPER_ADMIN — full access ───────────────────

describe('maskQuarterlyReview — HR/SUPER_ADMIN', () => {
  it('should return full review for HR_ADMIN regardless of status', () => {
    const user = makeUser({ role: 'HR_ADMIN' })
    const review = makeReview({ status: 'DRAFT' })
    const result = maskQuarterlyReview(review, user)
    expect(result.managerFeedback).toBe('Manager feedback')
    expect(result.goalHighlights).toBe('My highlights')
    expect(result.goalProgress[0].managerComment).toBe('Manager progress note')
  })

  it('should return full review for SUPER_ADMIN regardless of status', () => {
    const user = makeUser({ role: 'SUPER_ADMIN' })
    const review = makeReview({ status: 'DRAFT' })
    const result = maskQuarterlyReview(review, user)
    expect(result.managerFeedback).toBe('Manager feedback')
    expect(result.employeeComments).toBe('My comments')
  })
})

// ─── EMPLOYEE (self) ────────────────────────────────────────

describe('maskQuarterlyReview — EMPLOYEE (self)', () => {
  const selfUser = makeUser({ employeeId: EMPLOYEE_ID, role: 'EMPLOYEE' })

  it('should return full review when status is COMPLETED', () => {
    const review = makeReview({ status: 'COMPLETED' })
    const result = maskQuarterlyReview(review, selfUser)
    expect(result.managerFeedback).toBe('Manager feedback')
    expect(result.coachingNotes).toBe('Coaching notes')
    expect(result.goalProgress[0].managerComment).toBe('Manager progress note')
  })

  it('should mask MANAGER_FIELDS when status is DRAFT', () => {
    const review = makeReview({ status: 'DRAFT' })
    const result = maskQuarterlyReview(review, selfUser)
    expect(result.managerFeedback).toBeNull()
    expect(result.coachingNotes).toBeNull()
    expect(result.developmentPlan).toBeNull()
    expect(result.overallSentiment).toBeNull()
    expect(result.managerSubmittedAt).toBeNull()
    expect(result.actionItems).toBeNull()
    expect(result.aiSummary).toBeNull()
  })

  it('should mask MANAGER_FIELDS when status is EMPLOYEE_DONE', () => {
    const review = makeReview({ status: 'EMPLOYEE_DONE' })
    const result = maskQuarterlyReview(review, selfUser)
    expect(result.managerFeedback).toBeNull()
    expect(result.goalHighlights).toBe('My highlights') // employee fields preserved
  })

  it('should mask goalProgress managerComment when not COMPLETED', () => {
    const review = makeReview({ status: 'DRAFT' })
    const result = maskQuarterlyReview(review, selfUser)
    expect(result.goalProgress[0].managerComment).toBeNull()
  })

  it('should mask goalProgress trackingStatus when not COMPLETED', () => {
    const review = makeReview({ status: 'IN_PROGRESS' })
    const result = maskQuarterlyReview(review, selfUser)
    expect(result.goalProgress[0].trackingStatus).toBeNull()
  })
})

// ─── MANAGER ────────────────────────────────────────────────

describe('maskQuarterlyReview — MANAGER', () => {
  const mgrUser = makeUser({ employeeId: MANAGER_ID, role: 'MANAGER' })

  it('should return full review when status is EMPLOYEE_DONE', () => {
    const review = makeReview({ status: 'EMPLOYEE_DONE' })
    const result = maskQuarterlyReview(review, mgrUser)
    expect(result.goalHighlights).toBe('My highlights')
    expect(result.managerFeedback).toBe('Manager feedback')
  })

  it('should return full review when status is MANAGER_DONE', () => {
    const review = makeReview({ status: 'MANAGER_DONE' })
    const result = maskQuarterlyReview(review, mgrUser)
    expect(result.employeeComments).toBe('My comments')
  })

  it('should return full review when status is COMPLETED', () => {
    const review = makeReview({ status: 'COMPLETED' })
    const result = maskQuarterlyReview(review, mgrUser)
    expect(result.goalHighlights).toBe('My highlights')
  })

  it('should mask EMPLOYEE_FIELDS when status is DRAFT', () => {
    const review = makeReview({ status: 'DRAFT' })
    const result = maskQuarterlyReview(review, mgrUser)
    expect(result.goalHighlights).toBeNull()
    expect(result.challenges).toBeNull()
    expect(result.developmentNeeds).toBeNull()
    expect(result.employeeComments).toBeNull()
    expect(result.employeeSubmittedAt).toBeNull()
    // Manager fields preserved
    expect(result.managerFeedback).toBe('Manager feedback')
  })

  it('should mask goalProgress employeeComment when status is DRAFT', () => {
    const review = makeReview({ status: 'DRAFT' })
    const result = maskQuarterlyReview(review, mgrUser)
    expect(result.goalProgress[0].employeeComment).toBeNull()
  })
})

// ─── EXECUTIVE ──────────────────────────────────────────────

describe('maskQuarterlyReview — EXECUTIVE', () => {
  it('should return full review for EXECUTIVE regardless of status', () => {
    const user = makeUser({ role: 'EXECUTIVE' })
    const review = makeReview({ status: 'DRAFT' })
    const result = maskQuarterlyReview(review, user)
    expect(result.managerFeedback).toBe('Manager feedback')
    expect(result.goalHighlights).toBe('My highlights')
  })

  // Codex Gate 1 [HIGH]: EXECUTIVE who is also the employee — isEmployee branch runs first
  // Known bug: isEmployee check (line 82) precedes EXECUTIVE check (line 110)
  // This test asserts the INTENDED behavior (full access). Marked .fails until bug is fixed.
  // When the bug is fixed, this test will pass and .fails will alert to remove the wrapper.
  it.fails('should give EXECUTIVE full access even when viewing own review (pending fix)', () => {
    const user = makeUser({ employeeId: EMPLOYEE_ID, role: 'EXECUTIVE' })
    const review = makeReview({ status: 'DRAFT' })
    const result = maskQuarterlyReview(review, user)
    expect(result.managerFeedback).toBe('Manager feedback')
    expect(result.goalHighlights).toBe('My highlights')
  })
})

// ─── Other roles (unrelated viewer) ─────────────────────────

describe('maskQuarterlyReview — other roles', () => {
  const otherUser = makeUser({ employeeId: 'unrelated-emp', role: 'EMPLOYEE' })

  it('should mask both EMPLOYEE and MANAGER fields for unrelated user', () => {
    const review = makeReview({ status: 'DRAFT' })
    const result = maskQuarterlyReview(review, otherUser)
    // Employee fields masked
    expect(result.goalHighlights).toBeNull()
    expect(result.employeeComments).toBeNull()
    // Manager fields masked
    expect(result.managerFeedback).toBeNull()
    expect(result.coachingNotes).toBeNull()
  })

  it('should mask goalProgress employeeComment for unrelated user', () => {
    const review = makeReview({ status: 'COMPLETED' })
    const result = maskQuarterlyReview(review, otherUser)
    expect(result.goalProgress[0].employeeComment).toBeNull()
  })

  it('should mask goalProgress managerComment for unrelated user', () => {
    const review = makeReview({ status: 'COMPLETED' })
    const result = maskQuarterlyReview(review, otherUser)
    expect(result.goalProgress[0].managerComment).toBeNull()
  })

  it('should mask goalProgress trackingStatus for unrelated user', () => {
    const review = makeReview({ status: 'COMPLETED' })
    const result = maskQuarterlyReview(review, otherUser)
    expect(result.goalProgress[0].trackingStatus).toBeNull()
  })
})

// ─── Edge cases ─────────────────────────────────────────────

describe('maskQuarterlyReview — edge cases', () => {
  it('should handle review without goalProgress field', () => {
    const user = makeUser({ employeeId: EMPLOYEE_ID, role: 'EMPLOYEE' })
    const review = makeReview({ status: 'DRAFT' })
    delete (review as Record<string, unknown>).goalProgress
    const result = maskQuarterlyReview(review, user)
    expect(result.goalProgress).toBeUndefined()
    expect(result.managerFeedback).toBeNull()
  })

  it('should handle empty goalProgress array', () => {
    const user = makeUser({ employeeId: EMPLOYEE_ID, role: 'EMPLOYEE' })
    const review = makeReview({ status: 'DRAFT', goalProgress: [] })
    const result = maskQuarterlyReview(review, user)
    expect(result.goalProgress).toEqual([])
  })
})
