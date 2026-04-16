// ═══════════════════════════════════════════════════════════
// G-2: Turnover Risk Prediction Model
// 7-variable weighted scoring (spec section 4-1)
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROTECTED — DO NOT MODIFY without architecture review
// This file is a core infrastructure component. Changes here
// can break: ML-based turnover risk scoring — employee attrition prediction
// Last verified: 2026-03-12 (Q-4 P6)
// ═══════════════════════════════════════════════════════════════

export interface TurnoverRiskInput {
  compaRatio: number | null         // from CompensationHistory.compaRatio
  lastGrade: string | null          // from PerformanceReview.finalGrade
  prevGrade: string | null          // previous cycle grade (decline detection)
  avgWeeklyOvertime: number         // 3-month avg from Attendance.overtimeMinutes
  leaveUsageRate: number            // from EmployeeLeaveBalance (used/granted)
  tenureYears: number               // from Employee.hireDate
  managerChanges: number            // EmployeeAssignment changes in last 12 months
  samePositionYears: number         // current assignment duration
}

export interface TurnoverRiskFactor {
  factor: string
  contribution: number
  detail: string
}

export interface TurnoverRiskResult {
  score: number                     // 0-100
  level: 'HIGH' | 'MEDIUM' | 'LOW'
  factors: TurnoverRiskFactor[]
}

export function calculateTurnoverRisk(input: TurnoverRiskInput): TurnoverRiskResult {
  const factors: TurnoverRiskFactor[] = []
  let score = 0

  // 1. Compa-Ratio (25%) — lower = higher risk
  if (input.compaRatio !== null) {
    if (input.compaRatio < 0.8) {
      score += 25
      factors.push({ factor: '급여 경쟁력', contribution: 25, detail: `Compa-Ratio ${(input.compaRatio * 100).toFixed(0)}% — 시장 대비 매우 낮음` })
    } else if (input.compaRatio < 0.9) {
      score += 15
      factors.push({ factor: '급여 경쟁력', contribution: 15, detail: `Compa-Ratio ${(input.compaRatio * 100).toFixed(0)}% — 시장 대비 낮음` })
    } else if (input.compaRatio < 1.0) {
      score += 5
      factors.push({ factor: '급여 경쟁력', contribution: 5, detail: `Compa-Ratio ${(input.compaRatio * 100).toFixed(0)}% — 시장 평균 미달` })
    }
  }

  // 2. Performance grade (20%)
  if (input.lastGrade === 'S') {
    score += 20
    factors.push({ factor: '성과 등급', contribution: 20, detail: `최근 등급 S — 저성과 이탈 위험` })
  }
  // O-grade high performer with low pay = extra risky
  if (input.lastGrade === 'O' && input.compaRatio !== null && input.compaRatio < 0.95) {
    score += 20
    factors.push({ factor: '고성과 저보상', contribution: 20, detail: `O등급이나 Compa-Ratio ${(input.compaRatio * 100).toFixed(0)}% — 핵심 인재 유출 위험` })
  }

  // 3. Overtime (15%) — sustained high overtime
  if (input.avgWeeklyOvertime >= 15) {
    score += 15
    factors.push({ factor: '초과근무', contribution: 15, detail: `주 평균 ${input.avgWeeklyOvertime.toFixed(1)}h — 지속적 과로` })
  } else if (input.avgWeeklyOvertime >= 8) {
    score += 8
    factors.push({ factor: '초과근무', contribution: 8, detail: `주 평균 ${input.avgWeeklyOvertime.toFixed(1)}h — 높은 업무 강도` })
  }

  // 4. Leave usage (10%) — very low usage = disengagement signal
  if (input.leaveUsageRate < 0.2) {
    score += 10
    factors.push({ factor: '연차 미사용', contribution: 10, detail: `사용률 ${(input.leaveUsageRate * 100).toFixed(0)}% — 업무 과부하 또는 이탈 징후` })
  }

  // 5. Tenure (10%) — 1-2 year mark is peak turnover
  if (input.tenureYears >= 1 && input.tenureYears <= 2) {
    score += 10
    factors.push({ factor: '근속 연수', contribution: 10, detail: `${input.tenureYears.toFixed(1)}년 — 이직 피크 구간 (1-2년)` })
  }

  // 6. Manager changes (10%)
  if (input.managerChanges >= 2) {
    score += 10
    factors.push({ factor: '매니저 변경', contribution: 10, detail: `최근 1년 ${input.managerChanges}회 변경 — 조직 불안정` })
  }

  // 7. Position stagnation (10%)
  if (input.samePositionYears >= 3) {
    score += 10
    factors.push({ factor: '직급 체류', contribution: 10, detail: `동일 직급 ${input.samePositionYears.toFixed(1)}년 — 경력 정체` })
  }

  const finalScore = Math.min(score, 100)
  return {
    score: finalScore,
    level: finalScore >= 70 ? 'HIGH' : finalScore >= 40 ? 'MEDIUM' : 'LOW',
    factors: factors.sort((a, b) => b.contribution - a.contribution),
  }
}
