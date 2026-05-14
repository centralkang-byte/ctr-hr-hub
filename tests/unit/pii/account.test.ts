import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { generateKey, _resetKeyCacheForTest } from '@/lib/pii/encryption'
import {
  normalizeAccountNumber,
  maskAccountNumber,
  encryptAccountNumber,
  decryptAccountNumber,
} from '@/lib/pii/account'

describe('Account number helpers', () => {
  beforeAll(() => {
    process.env.PII_ENCRYPTION_KEY = generateKey()
  })

  beforeEach(() => {
    _resetKeyCacheForTest()
  })

  describe('normalizeAccountNumber', () => {
    it('strips hyphens', () => {
      expect(normalizeAccountNumber('110-123-456789')).toBe('110123456789')
    })

    it('throws on too short', () => {
      expect(() => normalizeAccountNumber('12345')).toThrow(/길이/)
    })

    it('throws on too long', () => {
      expect(() => normalizeAccountNumber('1'.repeat(20))).toThrow(/길이/)
    })
  })

  describe('maskAccountNumber', () => {
    it('shows last 4 digits only', () => {
      expect(maskAccountNumber('110-123-456789')).toBe('********6789')
      expect(maskAccountNumber('1101234567890')).toBe('*********7890')
    })
  })

  describe('encryptAccountNumber / decryptAccountNumber', () => {
    it('round-trips', () => {
      const ct = encryptAccountNumber('1101-23-456789')
      expect(ct).toMatch(/^v1:/)
      expect(decryptAccountNumber(ct)).toBe('110123456789')
    })

    it('handles empty input', () => {
      expect(encryptAccountNumber('')).toBe('')
      expect(decryptAccountNumber('')).toBe('')
    })
  })
})
