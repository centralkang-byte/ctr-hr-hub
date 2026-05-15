import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { generateKey, _resetKeyCacheForTest } from '@/lib/pii/encryption'
import {
  normalizeRRN,
  maskRRN,
  isValidRRNChecksum,
  extractBirthFromRRN,
  encryptRRN,
  decryptRRN,
} from '@/lib/pii/rrn'

describe('RRN helpers', () => {
  beforeAll(() => {
    process.env.PII_ENCRYPTION_KEY = generateKey()
  })

  beforeEach(() => {
    _resetKeyCacheForTest()
  })

  describe('normalizeRRN', () => {
    it('strips hyphens and non-digits', () => {
      expect(normalizeRRN('880808-1234567')).toBe('8808081234567')
      expect(normalizeRRN('880808 1234567')).toBe('8808081234567')
    })

    it('throws on wrong length', () => {
      expect(() => normalizeRRN('12345')).toThrow(/13자리/)
      expect(() => normalizeRRN('88080812345678')).toThrow(/13자리/)
    })
  })

  describe('maskRRN', () => {
    it('shows YYMMDD-S only', () => {
      expect(maskRRN('880808-1234567')).toBe('880808-1******')
      expect(maskRRN('8808082345678')).toBe('880808-2******')
    })
  })

  describe('isValidRRNChecksum', () => {
    it('validates known-good checksum', () => {
      // 880808-1888889 — synthetic, checksum computed manually
      // weights: 2,3,4,5,6,7,8,9,2,3,4,5
      // digits:  8,8,0,8,0,8,1,8,8,8,8,8 → 16+24+0+40+0+56+8+72+16+24+32+40 = 328
      // 11 - (328 % 11) = 11 - 9 = 2 → 2 % 10 = 2
      // So 12th digit (0-indexed 12) should be 2
      // Build: "8808081888882"
      expect(isValidRRNChecksum('8808081888882')).toBe(true)
    })

    it('rejects wrong checksum', () => {
      expect(isValidRRNChecksum('8808081888881')).toBe(false)
    })

    it('returns false on wrong length', () => {
      expect(isValidRRNChecksum('123')).toBe(false)
    })
  })

  describe('extractBirthFromRRN', () => {
    it('parses 1980s Korean male (gender 1)', () => {
      const r = extractBirthFromRRN('8808081234567')
      expect(r.birthDate.toISOString().slice(0, 10)).toBe('1988-08-08')
      expect(r.isMale).toBe(true)
      expect(r.isForeigner).toBe(false)
    })

    it('parses 1990s Korean female (gender 2)', () => {
      const r = extractBirthFromRRN('9412012234567')
      expect(r.birthDate.toISOString().slice(0, 10)).toBe('1994-12-01')
      expect(r.isMale).toBe(false)
      expect(r.isForeigner).toBe(false)
    })

    it('parses 2000s Korean (gender 3/4)', () => {
      const r = extractBirthFromRRN('0501013234567')
      expect(r.birthDate.toISOString().slice(0, 10)).toBe('2005-01-01')
      expect(r.isMale).toBe(true)
    })

    it('parses foreigner (gender 5/6)', () => {
      const r = extractBirthFromRRN('8808085234567')
      expect(r.birthDate.toISOString().slice(0, 10)).toBe('1988-08-08')
      expect(r.isForeigner).toBe(true)
      expect(r.isMale).toBe(true)
    })

    it('throws on invalid month/day', () => {
      expect(() => extractBirthFromRRN('8813321234567')).toThrow(/생년월일/)
    })
  })

  describe('encryptRRN / decryptRRN', () => {
    it('round-trips with normalization', () => {
      const ct = encryptRRN('880808-1234567')
      expect(ct).toMatch(/^v1:/)
      expect(decryptRRN(ct)).toBe('8808081234567')
    })

    it('handles empty input', () => {
      expect(encryptRRN('')).toBe('')
      expect(decryptRRN('')).toBe('')
    })
  })
})
