// ═══════════════════════════════════════════════════════════
// benefit final-key 파싱/등치 검증 (순수 헬퍼)
// 다운로드 라우트가 레거시/위조 proofPaths 를 서명하지 않는 근거 로직.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  parseBenefitFinalKey,
  isServerIssuedBenefitFinalKey,
} from '@/lib/upload/proof-upload'

const COMPANY = '11111111-2222-4333-8444-555555555555'
const UPLOAD = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const KEY = `${COMPANY}/benefit-proof-final/${UPLOAD}/영수증.pdf`

describe('parseBenefitFinalKey', () => {
  it('서버 형식 키를 파스한다', () => {
    expect(parseBenefitFinalKey(KEY)).toEqual({
      companyId: COMPANY,
      uploadId: UPLOAD,
      filename: '영수증.pdf',
    })
  })

  it('레거시 자유 문자열은 거부한다', () => {
    expect(parseBenefitFinalKey('receipts/2025/receipt-001.pdf')).toBeNull()
    expect(parseBenefitFinalKey(`benefit-claims/${Date.now()}-a.pdf`)).toBeNull()
  })

  it('마커/uuid/세그먼트 수가 어긋나면 거부한다', () => {
    expect(parseBenefitFinalKey(`${COMPANY}/loa-proof-final/${UPLOAD}/a.pdf`)).toBeNull()
    expect(parseBenefitFinalKey(`not-a-uuid/benefit-proof-final/${UPLOAD}/a.pdf`)).toBeNull()
    expect(parseBenefitFinalKey(`${COMPANY}/benefit-proof-final/${UPLOAD}`)).toBeNull()
    expect(parseBenefitFinalKey(`${COMPANY}/benefit-proof-final/${UPLOAD}/a/b.pdf`)).toBeNull()
    expect(parseBenefitFinalKey(`${COMPANY}/benefit-proof-final/${UPLOAD}/`)).toBeNull()
  })
})

describe('isServerIssuedBenefitFinalKey', () => {
  const fu = { id: UPLOAD, companyId: COMPANY, filename: '영수증.pdf' }

  it('서버 기록과 정확히 일치하면 통과', () => {
    expect(isServerIssuedBenefitFinalKey(KEY, fu)).toBe(true)
  })

  it('법인/파일명/uploadId 하나라도 다르면 거부 (위조 final-형태 키)', () => {
    const otherCompany = '99999999-8888-4777-8666-555555555555'
    expect(
      isServerIssuedBenefitFinalKey(`${otherCompany}/benefit-proof-final/${UPLOAD}/영수증.pdf`, fu),
    ).toBe(false)
    expect(
      isServerIssuedBenefitFinalKey(`${COMPANY}/benefit-proof-final/${UPLOAD}/other.pdf`, fu),
    ).toBe(false)
    expect(
      isServerIssuedBenefitFinalKey(KEY, { ...fu, id: '00000000-0000-4000-8000-000000000000' }),
    ).toBe(false)
  })
})
