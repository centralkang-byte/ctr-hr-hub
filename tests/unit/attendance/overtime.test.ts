import { describe, it, expect } from 'vitest'
import {
  computeOvertimeMinutes,
  graduatedBreakMinutes,
  STANDARD_MINUTES,
  DEFAULT_BREAK_MINUTES,
} from '@/lib/attendance/overtime'

describe('computeOvertimeMinutes — 초과근무 분 계산 (SSOT)', () => {
  it('표준+휴식(540) 이하면 초과근무 0', () => {
    expect(computeOvertimeMinutes(540)).toBe(0)
    expect(computeOvertimeMinutes(480)).toBe(0)
    expect(computeOvertimeMinutes(0)).toBe(0)
  })

  it('540 초과분만 초과근무로 계산', () => {
    expect(computeOvertimeMinutes(600)).toBe(60) // 600 − 60 − 480
    expect(computeOvertimeMinutes(1000)).toBe(460)
  })

  it('음수 totalMinutes 가드 → 0 (보정 시 clockOut<clockIn 등)', () => {
    expect(computeOvertimeMinutes(-100)).toBe(0)
  })

  it('breakMinutes 파라미터로 휴식 차감값 조정 (단말기 누진 휴식)', () => {
    expect(computeOvertimeMinutes(600, 0)).toBe(120) // 600 − 0 − 480
    expect(computeOvertimeMinutes(600, 30)).toBe(90) // 600 − 30 − 480
    expect(computeOvertimeMinutes(600, 60)).toBe(60) // 기본과 동일
  })

  it('상수 SSOT 값', () => {
    expect(STANDARD_MINUTES).toBe(480)
    expect(DEFAULT_BREAK_MINUTES).toBe(60)
  })
})

describe('graduatedBreakMinutes — 단말기 누진 휴식', () => {
  it('8시간↑(480+) → 60분', () => {
    expect(graduatedBreakMinutes(480)).toBe(60)
    expect(graduatedBreakMinutes(600)).toBe(60)
  })

  it('4시간↑(240~479) → 30분', () => {
    expect(graduatedBreakMinutes(240)).toBe(30)
    expect(graduatedBreakMinutes(479)).toBe(30)
  })

  it('4시간 미만 → 0분', () => {
    expect(graduatedBreakMinutes(239)).toBe(0)
    expect(graduatedBreakMinutes(0)).toBe(0)
  })
})
