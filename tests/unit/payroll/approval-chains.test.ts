import { describe, it, expect } from 'vitest'
import {
  BANK_CODES,
  DEFAULT_PAY_DAY,
} from '@/lib/payroll/approval-chains'

// 급여 승인 체인(PAYROLL_APPROVAL_CHAINS/getApprovalChain) 테스트는 #10(전결 SoD)
// 마이그레이션으로 제거됨 — 체인은 ApprovalFlow SSOT(resolveApprovalFlow)로 이전.
// 신 동작은 e2e SoD 테스트(payroll approval)에서 검증.

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
