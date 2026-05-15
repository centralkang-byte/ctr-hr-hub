// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 주민등록번호 (RRN) 헬퍼
// 정규화 + 검증 + 마스킹 + 암호화 wrapper
// ═══════════════════════════════════════════════════════════

import { badRequest } from '@/lib/errors'
import { encrypt, decrypt } from './encryption'

const RRN_DIGITS = 13
const CHECKSUM_WEIGHTS = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5]

/**
 * 입력 문자열에서 숫자만 추출해 13자리 RRN 으로 정규화한다.
 * 13자리가 아니면 throw.
 */
export function normalizeRRN(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.length !== RRN_DIGITS) {
    throw badRequest(`주민등록번호는 13자리여야 합니다. (입력: ${digits.length}자리)`)
  }
  return digits
}

/**
 * 주민등록번호 체크섬을 검증한다. (현행 13자리 체계)
 *
 * 주의: 2020년 이후 발급된 일부 번호는 임의 채번이라 체크섬이 맞지 않을 수 있다.
 * 마이그레이션 시 strict 검증은 권장하지 않음 — 포맷 검증만 사용.
 */
export function isValidRRNChecksum(normalized: string): boolean {
  if (normalized.length !== RRN_DIGITS) return false

  let sum = 0
  for (let i = 0; i < CHECKSUM_WEIGHTS.length; i++) {
    sum += Number(normalized[i]) * CHECKSUM_WEIGHTS[i]
  }
  const expected = (11 - (sum % 11)) % 10
  return Number(normalized[12]) === expected
}

/**
 * 13자리 RRN 을 표시용으로 마스킹한다.
 * "8808081234567" → "880808-1******"
 *
 * 성별 1자리만 노출 (생년월일 + 성별은 통상 비밀이 아님).
 */
export function maskRRN(input: string): string {
  const normalized = normalizeRRN(input)
  return `${normalized.slice(0, 6)}-${normalized[6]}******`
}

/**
 * RRN 에서 생년월일을 추출한다. (성별 자리로 세기 구분)
 *
 * 성별 코드:
 *  - 1, 2 → 1900년대 한국인
 *  - 3, 4 → 2000년대 한국인
 *  - 5, 6 → 1900년대 외국인
 *  - 7, 8 → 2000년대 외국인
 *  - 9, 0 → 1800년대 (희박)
 */
export function extractBirthFromRRN(input: string): { birthDate: Date; isForeigner: boolean; isMale: boolean } {
  const normalized = normalizeRRN(input)
  const yy = Number(normalized.slice(0, 2))
  const mm = Number(normalized.slice(2, 4))
  const dd = Number(normalized.slice(4, 6))
  const genderCode = Number(normalized[6])

  let century: number
  if (genderCode === 1 || genderCode === 2 || genderCode === 5 || genderCode === 6) {
    century = 1900
  } else if (genderCode === 3 || genderCode === 4 || genderCode === 7 || genderCode === 8) {
    century = 2000
  } else if (genderCode === 9 || genderCode === 0) {
    century = 1800
  } else {
    throw badRequest(`성별 코드가 잘못되었습니다. (${genderCode})`)
  }

  const isForeigner = [5, 6, 7, 8].includes(genderCode)
  const isMale = [1, 3, 5, 7, 9].includes(genderCode)

  const birthDate = new Date(Date.UTC(century + yy, mm - 1, dd))
  if (birthDate.getUTCMonth() !== mm - 1 || birthDate.getUTCDate() !== dd) {
    throw badRequest('주민등록번호의 생년월일 부분이 잘못되었습니다.')
  }

  return { birthDate, isForeigner, isMale }
}

/**
 * RRN 을 정규화 후 암호화한다.
 * 빈 문자열 입력 시 빈 문자열 반환.
 */
export function encryptRRN(input: string): string {
  if (!input) return ''
  return encrypt(normalizeRRN(input))
}

/**
 * 암호화된 RRN 을 복호화한다. 빈 입력은 빈 문자열 반환.
 */
export function decryptRRN(payload: string): string {
  if (!payload) return ''
  return decrypt(payload)
}
