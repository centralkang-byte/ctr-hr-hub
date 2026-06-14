import { describe, it, expect } from 'vitest'
import { bucketStages, POSTINGS_READ_ROLES } from '@/lib/recruitment/access'
import { ROLE } from '@/lib/constants'
import type { ApplicationStage } from '@/generated/prisma/enums'

// bucketStages = 현재 단계 스냅샷(누적 전환 아님). summary KPI + 카드 셀 공유 SSOT.

describe('bucketStages — 4-cell 현재 단계 집계', () => {
  it('빈 입력 → 모두 0', () => {
    expect(bucketStages({})).toEqual({ applied: 0, screen: 0, interview: 0, offer: 0 })
  })

  it('applied = 모든 단계 합(REJECTED 포함 = 받은 지원 총계)', () => {
    const counts: Partial<Record<ApplicationStage, number>> = {
      APPLIED: 2,
      SCREENING: 3,
      INTERVIEW_1: 1,
      REJECTED: 4,
    }
    expect(bucketStages(counts).applied).toBe(10)
  })

  it('screen = SCREENING 만', () => {
    expect(bucketStages({ SCREENING: 5, APPLIED: 9 }).screen).toBe(5)
  })

  it('interview = INTERVIEW_1 + INTERVIEW_2 + FINAL', () => {
    expect(bucketStages({ INTERVIEW_1: 2, INTERVIEW_2: 1, FINAL: 3 }).interview).toBe(6)
  })

  it('offer = OFFER + OFFER_ACCEPTED + OFFER_DECLINED + HIRED (HIRED 포함 — 손실 방지)', () => {
    const buckets = bucketStages({
      OFFER: 1,
      OFFER_ACCEPTED: 2,
      OFFER_DECLINED: 1,
      HIRED: 3,
    })
    expect(buckets.offer).toBe(7)
  })

  it('REJECTED 는 applied 외 어느 버킷에도 들어가지 않는다', () => {
    const buckets = bucketStages({ REJECTED: 5 })
    expect(buckets).toEqual({ applied: 5, screen: 0, interview: 0, offer: 0 })
  })

  it('전체 시나리오 — 단계별 분포', () => {
    const counts: Partial<Record<ApplicationStage, number>> = {
      APPLIED: 5,
      SCREENING: 3,
      INTERVIEW_1: 2,
      INTERVIEW_2: 1,
      FINAL: 1,
      OFFER: 1,
      OFFER_ACCEPTED: 1,
      OFFER_DECLINED: 0,
      HIRED: 1,
      REJECTED: 2,
    }
    expect(bucketStages(counts)).toEqual({
      applied: 17,
      screen: 3,
      interview: 4, // 2 + 1 + 1
      offer: 3, // 1 + 1 + 0 + 1
    })
  })
})

describe('POSTINGS_READ_ROLES — 목록/요약 읽기 allowlist', () => {
  it('SUPER/HR/MANAGER 포함, EXECUTIVE·EMPLOYEE 제외', () => {
    expect(POSTINGS_READ_ROLES).toContain(ROLE.SUPER_ADMIN)
    expect(POSTINGS_READ_ROLES).toContain(ROLE.HR_ADMIN)
    expect(POSTINGS_READ_ROLES).toContain(ROLE.MANAGER)
    expect(POSTINGS_READ_ROLES).not.toContain(ROLE.EXECUTIVE)
    expect(POSTINGS_READ_ROLES).not.toContain(ROLE.EMPLOYEE)
  })
})
