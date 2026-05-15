// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Generic PII Encryption (AES-256-GCM)
// 주민번호, 계좌번호 등 민감 데이터 양방향 암호화
// ═══════════════════════════════════════════════════════════

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { serviceUnavailable, badRequest } from '@/lib/errors'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32 // 256 bits
const IV_BYTES = 12 // GCM 권장 96-bit nonce
const AUTH_TAG_BYTES = 16
const VERSION = 'v1' // 향후 키 rotation 대비 prefix

let cachedKey: Buffer | null = null

/**
 * PII_ENCRYPTION_KEY 환경변수에서 32-byte 키를 로드한다.
 * 키는 base64 인코딩 32 bytes (256-bit) 여야 한다.
 * 키 부재 또는 길이 불일치 시 throw — silent fallback 금지.
 */
function loadKey(): Buffer {
  if (cachedKey) return cachedKey

  const raw = process.env.PII_ENCRYPTION_KEY
  if (!raw) {
    throw serviceUnavailable('PII 암호화 키가 설정되지 않았습니다. PII_ENCRYPTION_KEY 환경변수를 확인하세요.')
  }

  const key = Buffer.from(raw, 'base64')
  if (key.length !== KEY_BYTES) {
    throw serviceUnavailable(
      `PII 암호화 키 길이가 잘못되었습니다. (예상: ${KEY_BYTES} bytes, 실제: ${key.length} bytes)`,
    )
  }

  cachedKey = key
  return key
}

/**
 * 테스트에서 키 캐시를 초기화한다. (운영 코드에서 호출 금지)
 */
export function _resetKeyCacheForTest(): void {
  cachedKey = null
}

/**
 * 평문을 AES-256-GCM 으로 암호화한다.
 * 반환 포맷: `v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>`
 *
 * 빈 문자열은 빈 문자열로 반환 (null 처리는 호출자 책임).
 */
export function encrypt(plaintext: string): string {
  if (plaintext === '') return ''

  const key = loadKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [VERSION, iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':')
}

/**
 * encrypt() 로 만든 문자열을 복호화한다.
 * 포맷 또는 인증 태그 불일치 시 throw — 호출자가 try/catch 로 처리.
 */
export function decrypt(payload: string): string {
  if (payload === '') return ''

  const parts = payload.split(':')
  if (parts.length !== 4) {
    throw badRequest('암호화 데이터 포맷이 잘못되었습니다.')
  }

  const [version, ivB64, tagB64, ctB64] = parts
  if (version !== VERSION) {
    throw badRequest(`지원하지 않는 암호화 버전입니다. (${version})`)
  }

  const key = loadKey()
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const ciphertext = Buffer.from(ctB64, 'base64')

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw badRequest('암호화 데이터의 IV 또는 인증 태그 길이가 잘못되었습니다.')
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    throw badRequest('암호화 데이터 복호화에 실패했습니다. (키 불일치 또는 데이터 변조)')
  }
}

/**
 * 새 PII_ENCRYPTION_KEY 를 생성한다. (CLI/스크립트 용)
 * 운영 코드에서 직접 호출 금지 — 키 생성은 KMS 또는 별도 운영 절차로.
 */
export function generateKey(): string {
  return randomBytes(KEY_BYTES).toString('base64')
}
