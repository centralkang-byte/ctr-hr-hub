// ═══════════════════════════════════════════════════════════
// Unit Tests — Sensitive Data Masking Utilities
// src/lib/masking.ts
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  maskResidentId,
  maskBankAccount,
  maskEmail,
  maskPhone,
  maskSalary,
  maskSensitiveFields,
} from '@/lib/masking'

// ─── maskResidentId ─────────────────────────────────────────

describe('maskResidentId', () => {
  it('should mask normal 13-char resident ID', () => {
    expect(maskResidentId('9001011234567')).toBe('900101-*******')
  })

  it('should return fallback for short input (< 6 chars)', () => {
    expect(maskResidentId('12345')).toBe('***-*******')
  })

  it('should return fallback for empty string', () => {
    expect(maskResidentId('')).toBe('***-*******')
  })

  it('should handle input with hyphen (substring 0-6)', () => {
    expect(maskResidentId('900101-1234567')).toBe('900101-*******')
  })

  // Codex G1: exposes first 6 chars even if not digits
  it('should expose first 6 chars regardless of content', () => {
    expect(maskResidentId('ABCDEF1234567')).toBe('ABCDEF-*******')
  })
})

// ─── maskBankAccount ────────────────────────────────────────

describe('maskBankAccount', () => {
  it('should show last 6 digits of normal account', () => {
    expect(maskBankAccount('110-123-123456')).toBe('***-**-123456')
  })

  it('should return fallback for short input (< 6 chars)', () => {
    expect(maskBankAccount('123')).toBe('***-**-******')
  })

  it('should return fallback for empty string', () => {
    expect(maskBankAccount('')).toBe('***-**-******')
  })

  it('should strip non-digits and use last 6', () => {
    expect(maskBankAccount('12345678901234')).toBe('***-**-901234')
  })
})

// ─── maskEmail ──────────────────────────────────────────────

describe('maskEmail', () => {
  it('should mask normal email showing first 3 chars of local part', () => {
    expect(maskEmail('sangwoo@company.com')).toBe('san***@company.com')
  })

  it('should handle short local part (< 3 chars)', () => {
    expect(maskEmail('ab@x.com')).toBe('ab***@x.com')
  })

  it('should return fallback for empty string', () => {
    expect(maskEmail('')).toBe('***@***')
  })

  it('should return fallback when no @ sign present', () => {
    expect(maskEmail('invalid')).toBe('***@***')
  })
})

// ─── maskPhone ──────────────────────────────────────────────

describe('maskPhone', () => {
  it('should mask standard Korean phone number', () => {
    expect(maskPhone('010-1234-5678')).toBe('010-****-5678')
  })

  it('should return fallback for short digits (< 4)', () => {
    expect(maskPhone('123')).toBe('***-****-****')
  })

  // Codex G1: format switches at <= 8 digits
  it('should use 4-digit suffix format for 8-digit number', () => {
    expect(maskPhone('12345678')).toBe('****-5678')
  })

  it('should return fallback for empty string', () => {
    expect(maskPhone('')).toBe('***-****-****')
  })

  it('should handle phone with exactly 4 digits', () => {
    const result = maskPhone('1234')
    expect(result).toContain('1234')
  })
})

// ─── maskSalary ─────────────────────────────────────────────

describe('maskSalary', () => {
  const salary = 5_000_000

  it('should return value for SUPER_ADMIN', () => {
    expect(maskSalary(salary, 'SUPER_ADMIN', false)).toBe(salary)
  })

  it('should return value for HR_ADMIN', () => {
    expect(maskSalary(salary, 'HR_ADMIN', false)).toBe(salary)
  })

  it('should return value for MANAGER', () => {
    expect(maskSalary(salary, 'MANAGER', false)).toBe(salary)
  })

  it('should return value for EMPLOYEE viewing own data', () => {
    expect(maskSalary(salary, 'EMPLOYEE', true)).toBe(salary)
  })

  it('should return *** for EMPLOYEE viewing others data', () => {
    expect(maskSalary(salary, 'EMPLOYEE', false)).toBe('***')
  })

  it('should return null for null input regardless of role', () => {
    expect(maskSalary(null, 'SUPER_ADMIN', false)).toBeNull()
  })
})

// ─── maskSensitiveFields ────────────────────────────────────

describe('maskSensitiveFields', () => {
  // Codex G1: use personalEmail (not email) — exact key matching
  it('should mask residentId and personalEmail in a flat object', () => {
    const data = {
      id: 'emp1',
      name: '홍길동',
      residentId: '9001011234567',
      personalEmail: 'hong@personal.com',
    }
    const masked = maskSensitiveFields(data, 'EMPLOYEE', 'other-user')
    expect(masked.residentId).toBe('900101-*******')
    expect(masked.personalEmail).toBe('hon***@personal.com')
    expect(masked.name).toBe('홍길동') // non-sensitive field unchanged
  })

  it('should mask salary fields based on role for non-own data', () => {
    const data = { id: 'emp1', baseSalary: 5_000_000 }
    const masked = maskSensitiveFields(data, 'EMPLOYEE', 'other-user')
    expect(masked.baseSalary).toBe('***')
  })

  it('should not mask salary for SUPER_ADMIN', () => {
    const data = { id: 'emp1', baseSalary: 5_000_000 }
    const masked = maskSensitiveFields(data, 'SUPER_ADMIN')
    expect(masked.baseSalary).toBe(5_000_000)
  })

  it('should handle array input by mapping over items', () => {
    const data = [
      { id: 'emp1', residentId: '9001011234567' },
      { id: 'emp2', residentId: '8501021234567' },
    ]
    const masked = maskSensitiveFields(data, 'EMPLOYEE')
    expect(masked[0].residentId).toBe('900101-*******')
    expect(masked[1].residentId).toBe('850102-*******')
  })

  it('should return null/undefined unchanged', () => {
    expect(maskSensitiveFields(null, 'EMPLOYEE')).toBeNull()
    expect(maskSensitiveFields(undefined, 'EMPLOYEE')).toBeUndefined()
  })

  it('should return primitive values unchanged', () => {
    expect(maskSensitiveFields('hello', 'EMPLOYEE')).toBe('hello')
    expect(maskSensitiveFields(42, 'EMPLOYEE')).toBe(42)
  })

  it('should detect own data via id field matching currentUserId', () => {
    const data = { id: 'emp1', baseSalary: 5_000_000 }
    const masked = maskSensitiveFields(data, 'EMPLOYEE', 'emp1')
    expect(masked.baseSalary).toBe(5_000_000) // own data visible
  })

  it('should detect own data via employeeId field matching currentUserId', () => {
    const data = { employeeId: 'emp1', baseSalary: 5_000_000 }
    const masked = maskSensitiveFields(data, 'EMPLOYEE', 'emp1')
    expect(masked.baseSalary).toBe(5_000_000) // own data visible
  })
})
