import { describe, it, expect } from 'vitest'
import { cumulativeReached, YEAR_END_STAGES } from '@/lib/payroll/year-end-stepper'

describe('cumulativeReached — sum(count where statusIndex >= stageIndex)', () => {
  it('혼합 분포 — 단계별 도달 누계 + 알 수 없는 status 무시', () => {
    // 변수 경유로 excess key 전달 (계약: unknown status는 무시, 실패 금지)
    const summary = {
      not_started: 2,
      in_progress: 3,
      submitted: 1,
      hr_review: 0,
      confirmed: 4,
      bogus_status: 99, // 알 수 없는 키 — 계산에서 제외돼야 함
    }
    expect(cumulativeReached(summary)).toEqual([10, 8, 5, 4, 4])
  })

  it('전부 0 — 모든 단계 도달 0', () => {
    const summary = {
      not_started: 0,
      in_progress: 0,
      submitted: 0,
      hr_review: 0,
      confirmed: 0,
    }
    expect(cumulativeReached(summary)).toEqual([0, 0, 0, 0, 0])
  })

  it('전부 confirmed — 모든 단계 도달 = 전체 인원', () => {
    const summary = {
      not_started: 0,
      in_progress: 0,
      submitted: 0,
      hr_review: 0,
      confirmed: 8,
    }
    expect(cumulativeReached(summary)).toEqual([8, 8, 8, 8, 8])
    expect(cumulativeReached(summary)).toHaveLength(YEAR_END_STAGES.length)
  })
})
