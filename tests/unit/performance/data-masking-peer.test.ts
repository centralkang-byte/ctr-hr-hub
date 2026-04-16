import { describe, it, expect } from 'vitest'
import { maskPeerReviews, PeerReviewForMasking } from '@/lib/performance/data-masking'

// ─── Helpers ────────────────────────────────────────────────

function makeReviews(count = 5): PeerReviewForMasking[] {
  return Array.from({ length: count }, (_, i) => ({
    reviewerName: `Reviewer ${i + 1}`,
    reviewerDepartment: `Dept ${i + 1}`,
    submittedAt: `2026-03-${String(10 + i).padStart(2, '0')}T09:00:00Z`,
    scoreChallenge: 3 + i,
    scoreTrust: 4,
    scoreResponsibility: 5,
    scoreRespect: 3,
    overallComment: `Comment from reviewer ${i + 1}`,
  }))
}

const CYCLE_ID = 'cycle-abc-123'
const EMPLOYEE_ID = 'emp-xyz-456'

// ─── Privileged roles — return as-is ────────────────────────

describe('maskPeerReviews — privileged roles', () => {
  const reviews = makeReviews(3)

  it('should return reviews as-is for MANAGER', () => {
    const result = maskPeerReviews(reviews, 'MANAGER', CYCLE_ID, EMPLOYEE_ID)
    expect(result).toBe(reviews) // same reference
  })

  it('should return reviews as-is for HR_ADMIN', () => {
    const result = maskPeerReviews(reviews, 'HR_ADMIN', CYCLE_ID, EMPLOYEE_ID)
    expect(result).toBe(reviews)
  })

  it('should return reviews as-is for EXECUTIVE', () => {
    const result = maskPeerReviews(reviews, 'EXECUTIVE', CYCLE_ID, EMPLOYEE_ID)
    expect(result).toBe(reviews)
  })
})

// ─── EMPLOYEE anonymization ─────────────────────────────────

describe('maskPeerReviews — EMPLOYEE anonymization', () => {
  const reviews = makeReviews(5)

  it('should strip reviewerName from all reviews', () => {
    const result = maskPeerReviews(reviews, 'EMPLOYEE', CYCLE_ID, EMPLOYEE_ID)
    for (const r of result) {
      expect(r).not.toHaveProperty('reviewerName')
    }
  })

  it('should strip reviewerDepartment from all reviews', () => {
    const result = maskPeerReviews(reviews, 'EMPLOYEE', CYCLE_ID, EMPLOYEE_ID)
    for (const r of result) {
      expect(r).not.toHaveProperty('reviewerDepartment')
    }
  })

  it('should strip submittedAt from all reviews', () => {
    const result = maskPeerReviews(reviews, 'EMPLOYEE', CYCLE_ID, EMPLOYEE_ID)
    for (const r of result) {
      expect(r).not.toHaveProperty('submittedAt')
    }
  })

  it('should add reviewerLabel as 평가자 N (1-indexed)', () => {
    const result = maskPeerReviews(reviews, 'EMPLOYEE', CYCLE_ID, EMPLOYEE_ID)
    result.forEach((r, i) => {
      expect(r.reviewerLabel).toBe(`평가자 ${i + 1}`)
    })
  })

  it('should preserve score fields for EMPLOYEE', () => {
    const result = maskPeerReviews(reviews, 'EMPLOYEE', CYCLE_ID, EMPLOYEE_ID)
    for (const r of result) {
      expect(typeof r.scoreChallenge).toBe('number')
      expect(typeof r.scoreTrust).toBe('number')
      expect(typeof r.scoreResponsibility).toBe('number')
      expect(typeof r.scoreRespect).toBe('number')
    }
  })

  it('should preserve overallComment for EMPLOYEE', () => {
    const result = maskPeerReviews(reviews, 'EMPLOYEE', CYCLE_ID, EMPLOYEE_ID)
    for (const r of result) {
      expect(typeof r.overallComment).toBe('string')
      expect(r.overallComment.length).toBeGreaterThan(0)
    }
  })

  it('should return same count of reviews as input', () => {
    const result = maskPeerReviews(reviews, 'EMPLOYEE', CYCLE_ID, EMPLOYEE_ID)
    expect(result).toHaveLength(reviews.length)
  })
})

// ─── Deterministic shuffle ──────────────────────────────────

describe('maskPeerReviews — deterministic shuffle', () => {
  const reviews = makeReviews(5)

  it('should produce same order for same seed (cycleId + employeeId)', () => {
    const r1 = maskPeerReviews(reviews, 'EMPLOYEE', CYCLE_ID, EMPLOYEE_ID)
    const r2 = maskPeerReviews(reviews, 'EMPLOYEE', CYCLE_ID, EMPLOYEE_ID)
    const scores1 = r1.map(r => r.scoreChallenge)
    const scores2 = r2.map(r => r.scoreChallenge)
    expect(scores1).toEqual(scores2)
  })

  // Codex Gate 2: removed probabilistic "different seed = different order" assertion.
  // deterministicShuffle only guarantees same seed → same order, not uniqueness across seeds.
})

// ─── Edge cases ─────────────────────────────────────────────

describe('maskPeerReviews — edge cases', () => {
  it('should handle empty reviews array for EMPLOYEE', () => {
    const result = maskPeerReviews([], 'EMPLOYEE', CYCLE_ID, EMPLOYEE_ID)
    expect(result).toEqual([])
  })

  it('should handle single review for EMPLOYEE', () => {
    const single = makeReviews(1)
    const result = maskPeerReviews(single, 'EMPLOYEE', CYCLE_ID, EMPLOYEE_ID)
    expect(result).toHaveLength(1)
    expect(result[0].reviewerLabel).toBe('평가자 1')
  })

  // Codex Gate 1: input array should not be mutated
  it('should not mutate the input array', () => {
    const reviews = makeReviews(3)
    const original = reviews.map(r => ({ ...r }))
    maskPeerReviews(reviews, 'EMPLOYEE', CYCLE_ID, EMPLOYEE_ID)
    expect(reviews).toEqual(original)
  })
})
