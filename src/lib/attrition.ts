// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attrition Risk Calculator (Placeholder)
// ═══════════════════════════════════════════════════════════

export interface AttritionRiskResult {
  employeeId: string
  riskScore: number          // 0.0 ~ 1.0
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  factors: AttritionFactor[]
  calculatedAt: Date
}

export interface AttritionFactor {
  factor: string
  weight: number
  value: number
  description: string
}

/**
 * 이직 위험도를 계산합니다.
 * Phase 1에서는 기본 점수(0.2)를 반환하며,
 * Phase 2에서 AI 기반 계산으로 교체됩니다.
 */
export async function calculateAttritionRisk(
  employeeId: string,
): Promise<AttritionRiskResult> {
  const defaultScore = 0.2

  return {
    employeeId,
    riskScore: defaultScore,
    riskLevel: getRiskLevel(defaultScore),
    factors: [],
    calculatedAt: new Date(),
  }
}

function getRiskLevel(score: number): AttritionRiskResult['riskLevel'] {
  if (score >= 0.8) return 'CRITICAL'
  if (score >= 0.6) return 'HIGH'
  if (score >= 0.4) return 'MEDIUM'
  return 'LOW'
}
