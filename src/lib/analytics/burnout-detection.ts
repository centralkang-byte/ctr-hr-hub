// ═══════════════════════════════════════════════════════════
// G-2: Burnout Detection Model
// 3-condition composite: sustained overtime + leave unused + performance decline
// Risk = 2 of 3 conditions met
// ═══════════════════════════════════════════════════════════

export interface BurnoutInput {
  weeklyOvertimeHistory: number[]   // last 12 weeks (overtime hours per week)
  leaveUsageRate: number
  lastGrade: string | null
  prevGrade: string | null
}

export interface BurnoutResult {
  isAtRisk: boolean
  triggeredConditions: string[]
  conditionsMet: number             // out of 3
}

const GRADE_ORDER = ['E', 'M_PLUS', 'M', 'B']

export function detectBurnout(input: BurnoutInput): BurnoutResult {
  const conditions: string[] = []

  // Condition 1: Sustained overtime — 3 months of consecutive high avg overtime
  const last12Weeks = input.weeklyOvertimeHistory.slice(-12)
  if (last12Weeks.length >= 4) {
    const monthBlocks = [
      last12Weeks.slice(0, 4),
      last12Weeks.slice(4, 8),
      last12Weeks.slice(8, 12),
    ].filter(block => block.length > 0)

    const allMonthsHigh = monthBlocks.length >= 2 && monthBlocks.every(block => {
      const avg = block.reduce((s, h) => s + h, 0) / block.length
      return avg >= 10 // 10h+ weekly overtime sustained
    })
    if (allMonthsHigh) {
      conditions.push('초과근무 3개월 연속 주 10h+ 초과')
    }
  }

  // Condition 2: Leave not used — annual usage rate < 20%
  if (input.leaveUsageRate < 0.2) {
    conditions.push('연차 사용률 20% 미만')
  }

  // Condition 3: Performance decline — dropped 1+ grade
  if (input.lastGrade && input.prevGrade) {
    const lastIdx = GRADE_ORDER.indexOf(input.lastGrade)
    const prevIdx = GRADE_ORDER.indexOf(input.prevGrade)
    if (lastIdx >= 0 && prevIdx >= 0 && lastIdx > prevIdx) {
      conditions.push(`성과 하락: ${input.prevGrade} → ${input.lastGrade}`)
    }
  }

  // Burnout = 2 of 3 conditions met
  return {
    isAtRisk: conditions.length >= 2,
    triggeredConditions: conditions,
    conditionsMet: conditions.length,
  }
}
