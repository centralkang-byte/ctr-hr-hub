// ═══════════════════════════════════════════════════════════
// Unit Tests — Employee Profile Utilities
// src/lib/employee/profile-utils.ts
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { getDivisionName, canViewGrade, canViewSensitive } from '@/lib/employee/profile-utils'

// ─── getDivisionName ────────────────────────────────────────

describe('getDivisionName', () => {
  it('should return null for null input', () => {
    expect(getDivisionName(null)).toBeNull()
  })

  it('should return null for undefined input', () => {
    expect(getDivisionName(undefined)).toBeNull()
  })

  it('should return name directly for level-2 node', () => {
    const dept = { id: 'd1', name: '개발본부', level: 2, parent: null }
    expect(getDivisionName(dept)).toBe('개발본부')
  })

  it('should find level-2 ancestor from level-4 node', () => {
    const dept = {
      id: 'd4', name: '프론트엔드팀', level: 4,
      parent: {
        id: 'd3', name: '개발1실', level: 3,
        parent: { id: 'd2', name: '경영본부', level: 2, parent: null },
      },
    }
    expect(getDivisionName(dept)).toBe('경영본부')
  })

  it('should return null for level-1 node (no level-2 ancestor)', () => {
    const dept = { id: 'd1', name: 'BU', level: 1, parent: null }
    expect(getDivisionName(dept)).toBeNull()
  })

  it('should return null when parent chain breaks before level-2', () => {
    const dept = { id: 'd4', name: '팀', level: 4, parent: null }
    expect(getDivisionName(dept)).toBeNull()
  })
})

// ─── canViewGrade ───────────────────────────────────────────

describe('canViewGrade', () => {
  it('should return true for SUPER_ADMIN viewing anyone', () => {
    expect(canViewGrade('SUPER_ADMIN', 'viewer1', 'subject1', null)).toBe(true)
  })

  it('should return true for HR_ADMIN viewing anyone', () => {
    expect(canViewGrade('HR_ADMIN', 'viewer1', 'subject1', null)).toBe(true)
  })

  it('should return true when viewing own data', () => {
    expect(canViewGrade('EMPLOYEE', 'emp1', 'emp1', 'mgr1')).toBe(true)
  })

  it('should return true for direct manager', () => {
    expect(canViewGrade('MANAGER', 'mgr1', 'emp1', 'mgr1')).toBe(true)
  })

  it('should return false for EMPLOYEE viewing other (not manager)', () => {
    expect(canViewGrade('EMPLOYEE', 'emp1', 'emp2', 'mgr1')).toBe(false)
  })
})

// ─── canViewSensitive ───────────────────────────────────────

describe('canViewSensitive', () => {
  it('should be the same function reference as canViewGrade', () => {
    expect(canViewSensitive).toBe(canViewGrade)
  })
})
