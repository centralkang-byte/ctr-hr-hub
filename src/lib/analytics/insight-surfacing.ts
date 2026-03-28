// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Insight Surfacing Engine (규칙 기반)
// ExecutiveSummary 데이터에서 위험 신호를 클라이언트사이드로 추출
// Workday Focus Insights 패턴 (ML 불필요, 규칙 기반 10개)
// ═══════════════════════════════════════════════════════════

import type { ExecutiveSummaryResponse } from './types'

// ─── Types ──────────────────────────────────────────────────

export type InsightSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM'

export interface SurfacedInsight {
  id: string
  severity: InsightSeverity
  title: string
  description: string
  link: string
  weight: number // CRITICAL=3, HIGH=2, MEDIUM=1
}

// ─── Severity → Weight ──────────────────────────────────────

const SEVERITY_WEIGHT: Record<InsightSeverity, number> = {
  CRITICAL: 3,
  HIGH: 2,
  MEDIUM: 1,
}

// ─── Dismiss key (24h localStorage) ─────────────────────────

const DISMISS_KEY = 'insight-surfacing-dismissed'
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000

export function isDismissed(insightId: string): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const dismissed: Record<string, number> = JSON.parse(raw)
    const ts = dismissed[insightId]
    if (!ts) return false
    return Date.now() - ts < DISMISS_TTL_MS
  } catch { return false }
}

export function dismissInsight(insightId: string): void {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    const dismissed: Record<string, number> = raw ? JSON.parse(raw) : {}
    dismissed[insightId] = Date.now()
    // Prune expired
    for (const [k, t] of Object.entries(dismissed)) {
      if (Date.now() - t > DISMISS_TTL_MS) delete dismissed[k]
    }
    localStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed))
  } catch { /* noop */ }
}

// ─── Rule Evaluation ────────────────────────────────────────

export function evaluateInsights(data: ExecutiveSummaryResponse): SurfacedInsight[] {
  const insights: SurfacedInsight[] = []
  const { kpis, riskAlerts } = data

  // Rule 1: 이직률 > 업계 평균 2배 (제조업 4.5% 기준)
  const turnover = kpis.monthlyTurnoverRate
  if (turnover && typeof turnover.value === 'number' && turnover.value > 9) {
    insights.push({
      id: 'high-turnover',
      severity: turnover.value > 15 ? 'CRITICAL' : 'HIGH',
      title: `전사 이직률 ${turnover.value}% — 업계 평균의 ${(turnover.value / 4.5).toFixed(1)}배`,
      description: '이직 원인 분석 및 리텐션 전략이 시급합니다.',
      link: '/analytics/turnover',
      weight: turnover.value > 15 ? 3 : 2,
    })
  }

  // Rule 9: 온보딩 완료율 < 70%
  const onboarding = kpis.onboardingCompletionRate
  if (onboarding && typeof onboarding.value === 'number' && onboarding.value < 70) {
    insights.push({
      id: 'low-onboarding',
      severity: onboarding.value < 50 ? 'HIGH' : 'MEDIUM',
      title: `온보딩 완료율 ${onboarding.value}% — 권장 수준(82%) 미달`,
      description: '신규 입사자 적응에 문제가 발생할 수 있습니다.',
      link: '/onboarding',
      weight: onboarding.value < 50 ? 2 : 1,
    })
  }

  // API riskAlerts 흡수 (서버에서 계산된 위험 신호)
  for (const alert of riskAlerts) {
    const severity: InsightSeverity = alert.severity === 'HIGH' ? 'HIGH' : 'MEDIUM'
    insights.push({
      id: `api-${alert.type}-${alert.count}`,
      severity,
      title: `${alert.type} ${alert.count}건 감지`,
      description: alert.type,
      link: alert.link,
      weight: SEVERITY_WEIGHT[severity],
    })
  }

  // 정렬: weight DESC
  insights.sort((a, b) => b.weight - a.weight)

  // Dismiss 필터링
  return insights.filter((i) => !isDismissed(i.id))
}
