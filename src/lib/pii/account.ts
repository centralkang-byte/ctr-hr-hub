// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 은행 계좌번호 헬퍼
// 정규화 + 마스킹 + 암호화 wrapper
// ═══════════════════════════════════════════════════════════

import { badRequest } from '@/lib/errors'
import { encrypt, decrypt } from './encryption'

const MIN_DIGITS = 8
const MAX_DIGITS = 16
const VISIBLE_TAIL = 4

/**
 * 입력에서 숫자만 추출해 계좌번호로 정규화한다.
 * 한국 은행 계좌는 통상 8~16자리.
 */
export function normalizeAccountNumber(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) {
    throw badRequest(`계좌번호 길이가 잘못되었습니다. (${MIN_DIGITS}~${MAX_DIGITS}자리, 입력: ${digits.length}자리)`)
  }
  return digits
}

/**
 * 계좌번호를 표시용으로 마스킹한다. 마지막 4자리만 노출.
 * "1101234567890" → "*********7890"
 */
export function maskAccountNumber(input: string): string {
  const normalized = normalizeAccountNumber(input)
  const visible = normalized.slice(-VISIBLE_TAIL)
  return '*'.repeat(normalized.length - VISIBLE_TAIL) + visible
}

/**
 * 계좌번호를 정규화 후 암호화한다.
 */
export function encryptAccountNumber(input: string): string {
  if (!input) return ''
  return encrypt(normalizeAccountNumber(input))
}

/**
 * 암호화된 계좌번호를 복호화한다.
 */
export function decryptAccountNumber(payload: string): string {
  if (!payload) return ''
  return decrypt(payload)
}
