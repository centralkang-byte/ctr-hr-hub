import { describe, it, expect } from 'vitest'
import {
  PAYROLL_APPROVAL_CHAINS,
  getApprovalChain,
  BANK_CODES,
  DEFAULT_PAY_DAY,
} from '@/lib/payroll/approval-chains'

// ─── PAYROLL_APPROVAL_CHAINS ────────────────────────────────

describe('PAYROLL_APPROVAL_CHAINS', () => {
  it('should have CTR chain as HR_MANAGER, CFO', () => {
    expect(PAYROLL_APPROVAL_CHAINS['CTR']).toEqual(['HR_MANAGER', 'CFO'])
  })

  it('should have CTR-CN chain as GENERAL_MANAGER', () => {
    expect(PAYROLL_APPROVAL_CHAINS['CTR-CN']).toEqual(['GENERAL_MANAGER'])
  })

  it('should have DEFAULT chain as HR_ADMIN', () => {
    expect(PAYROLL_APPROVAL_CHAINS['DEFAULT']).toEqual(['HR_ADMIN'])
  })

  it('should have entries for all 7 expected keys', () => {
    const keys = Object.keys(PAYROLL_APPROVAL_CHAINS)
    expect(keys).toHaveLength(7)
    expect(keys).toEqual(
      expect.arrayContaining(['CTR', 'CTR-CN', 'CTR-US', 'CTR-RU', 'CTR-VN', 'CTR-EU', 'DEFAULT']),
    )
  })
})

// ─── getApprovalChain ───────────────────────────────────────

describe('getApprovalChain', () => {
  it('should return DEFAULT chain for null companyCode', () => {
    expect(getApprovalChain(null)).toEqual(['HR_ADMIN'])
  })

  it('should return CTR chain for CTR', () => {
    expect(getApprovalChain('CTR')).toEqual(['HR_MANAGER', 'CFO'])
  })

  it('should return DEFAULT chain for unknown company code', () => {
    expect(getApprovalChain('CTR-XX')).toEqual(['HR_ADMIN'])
  })

  it('should return CONTROLLER chain for CTR-US', () => {
    expect(getApprovalChain('CTR-US')).toEqual(['CONTROLLER'])
  })

  it('should return COUNTRY_HEAD chain for CTR-RU', () => {
    expect(getApprovalChain('CTR-RU')).toEqual(['COUNTRY_HEAD'])
  })

  // Codex Gate 1 [HIGH]: domestic subsidiaries fall back to DEFAULT, not CTR
  it('should return DEFAULT chain for domestic subsidiary CTR-MOB', () => {
    expect(getApprovalChain('CTR-MOB')).toEqual(['HR_ADMIN'])
  })

  it('should return DEFAULT chain for domestic subsidiary CTR-ENR', () => {
    expect(getApprovalChain('CTR-ENR')).toEqual(['HR_ADMIN'])
  })

  it('should return correct values for CTR-VN', () => {
    expect(getApprovalChain('CTR-VN')).toEqual(['COUNTRY_HEAD'])
  })
})

// ─── BANK_CODES ─────────────────────────────────────────────

describe('BANK_CODES', () => {
  it('should map 국민은행 to 004', () => {
    expect(BANK_CODES['국민은행']).toBe('004')
  })

  it('should map 신한은행 to 088', () => {
    expect(BANK_CODES['신한은행']).toBe('088')
  })

  it('should have 18 bank entries', () => {
    expect(Object.keys(BANK_CODES)).toHaveLength(18)
  })
})

// ─── DEFAULT_PAY_DAY ────────────────────────────────────────

describe('DEFAULT_PAY_DAY', () => {
  it('should be 25', () => {
    expect(DEFAULT_PAY_DAY).toBe(25)
  })
})
