import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { encrypt, decrypt, generateKey, _resetKeyCacheForTest } from '@/lib/pii/encryption'

describe('PII encryption (AES-256-GCM)', () => {
  beforeAll(() => {
    process.env.PII_ENCRYPTION_KEY = generateKey()
  })

  beforeEach(() => {
    _resetKeyCacheForTest()
  })

  it('round-trips a plaintext value', () => {
    const plain = '8808081234567'
    const ct = encrypt(plain)
    expect(ct).not.toBe(plain)
    expect(ct.startsWith('v1:')).toBe(true)
    expect(decrypt(ct)).toBe(plain)
  })

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const plain = '강상우'
    const a = encrypt(plain)
    const b = encrypt(plain)
    expect(a).not.toBe(b)
    expect(decrypt(a)).toBe(plain)
    expect(decrypt(b)).toBe(plain)
  })

  it('handles empty string as no-op', () => {
    expect(encrypt('')).toBe('')
    expect(decrypt('')).toBe('')
  })

  it('throws AppError when key is missing', () => {
    delete process.env.PII_ENCRYPTION_KEY
    _resetKeyCacheForTest()
    expect(() => encrypt('test')).toThrow(/PII 암호화 키/)
  })

  it('throws AppError when key length is wrong', () => {
    process.env.PII_ENCRYPTION_KEY = Buffer.from('too-short').toString('base64')
    _resetKeyCacheForTest()
    expect(() => encrypt('test')).toThrow(/키 길이/)
  })

  it('rejects payload with wrong format', () => {
    process.env.PII_ENCRYPTION_KEY = generateKey()
    _resetKeyCacheForTest()
    expect(() => decrypt('not-encrypted')).toThrow(/포맷/)
    expect(() => decrypt('v1:a:b')).toThrow(/포맷/)
  })

  it('rejects payload with wrong version', () => {
    process.env.PII_ENCRYPTION_KEY = generateKey()
    _resetKeyCacheForTest()
    expect(() => decrypt('v9:aa:bb:cc')).toThrow(/암호화 버전/)
  })

  it('rejects tampered ciphertext (auth tag mismatch)', () => {
    process.env.PII_ENCRYPTION_KEY = generateKey()
    _resetKeyCacheForTest()
    const ct = encrypt('original-value')
    const parts = ct.split(':')
    // flip last char of ciphertext segment
    const tampered = [parts[0], parts[1], parts[2], parts[3].slice(0, -1) + 'A'].join(':')
    expect(() => decrypt(tampered)).toThrow(/복호화/)
  })

  it('rejects decryption with a different key', () => {
    process.env.PII_ENCRYPTION_KEY = generateKey()
    _resetKeyCacheForTest()
    const ct = encrypt('secret-value')
    process.env.PII_ENCRYPTION_KEY = generateKey() // rotate
    _resetKeyCacheForTest()
    expect(() => decrypt(ct)).toThrow(/복호화/)
  })
})
