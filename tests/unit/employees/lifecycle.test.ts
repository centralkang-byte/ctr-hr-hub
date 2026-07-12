import { describe, it, expect } from 'vitest'
import { deriveProbationBadge, deriveContractBadge } from '@/lib/employees/lifecycle'

const NOW = new Date('2026-07-12T15:00:00Z')

describe('deriveProbationBadge', () => {
  it('종료일 미래 + IN_PROGRESS → 수습 중 (info)', () => {
    const b = deriveProbationBadge('2026-08-01T00:00:00.000Z', 'IN_PROGRESS', NOW)
    expect(b).toMatchObject({ labelKey: 'probationInProgress', variant: 'info', daysLeft: 20 })
  })

  it('종료일 경과 + IN_PROGRESS → 만료 경과 (error)', () => {
    const b = deriveProbationBadge('2026-06-01T00:00:00.000Z', 'IN_PROGRESS', NOW)
    expect(b).toMatchObject({ labelKey: 'probationOverdue', variant: 'error' })
    expect(b!.daysLeft).toBeLessThan(0)
  })

  it('종료일 당일 → 수습 중 (경과 아님)', () => {
    const b = deriveProbationBadge('2026-07-12T00:00:00.000Z', 'IN_PROGRESS', NOW)
    expect(b).toMatchObject({ labelKey: 'probationInProgress', daysLeft: 0 })
  })

  it('PASSED/null 상태 또는 종료일 없음 → null', () => {
    expect(deriveProbationBadge('2026-08-01', 'PASSED', NOW)).toBeNull()
    expect(deriveProbationBadge(null, 'IN_PROGRESS', NOW)).toBeNull()
    expect(deriveProbationBadge('2026-08-01', null, NOW)).toBeNull()
  })

  it('UTC date-only 비교 — 시각 성분이 하루 시프트를 만들지 않음', () => {
    // now가 UTC 23:50이어도 같은 UTC 날짜면 daysLeft 동일
    const lateNow = new Date('2026-07-12T23:50:00Z')
    const b = deriveProbationBadge('2026-07-13T00:00:00.000Z', 'IN_PROGRESS', lateNow)
    expect(b!.daysLeft).toBe(1)
  })
})

describe('deriveContractBadge', () => {
  it('만료 경과 → contractExpired (error)', () => {
    const b = deriveContractBadge('2026-05-01T00:00:00.000Z', NOW)
    expect(b).toMatchObject({ labelKey: 'contractExpired', variant: 'error' })
  })

  it('D-30 이내 → contractExpiringSoon (warning)', () => {
    const b = deriveContractBadge('2026-08-01T00:00:00.000Z', NOW)
    expect(b).toMatchObject({ labelKey: 'contractExpiringSoon', variant: 'warning', daysLeft: 20 })
  })

  it('D-30 경계: 정확히 30일 남음 → warning, 31일 → null', () => {
    expect(deriveContractBadge('2026-08-11T00:00:00.000Z', NOW)).toMatchObject({ daysLeft: 30 })
    expect(deriveContractBadge('2026-08-12T00:00:00.000Z', NOW)).toBeNull()
  })

  it('무기한(null) → null', () => {
    expect(deriveContractBadge(null, NOW)).toBeNull()
    expect(deriveContractBadge(undefined, NOW)).toBeNull()
  })
})
