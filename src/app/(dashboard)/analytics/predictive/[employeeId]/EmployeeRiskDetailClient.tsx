'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 개인 이직위험 + 번아웃 상세 분석 뷰
// RadarChart + 신호별 상세 + 권고 액션
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  AlertTriangle,
  TrendingDown,
  Activity,
  Info,
} from 'lucide-react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS,  TABLE_STYLES, CHART_THEME } from '@/lib/styles'
import { cn } from '@/lib/utils'

// ─── 타입 ────────────────────────────────────────────────

interface Signal {
  signal: string
  weight: number
  score: number
  rawData: Record<string, unknown> | null
  available: boolean
}

interface Indicator {
  indicator: string
  weight: number
  score: number
  rawData: Record<string, unknown> | null
  available: boolean
}

interface EmployeeRiskData {
  employee: {
    id: string
    name: string
    hireDate: string | null
    department: { id: string; name: string } | null
    jobGrade: { name: string } | null
    company: { id: string; name: string } | null
  }
  turnover: {
    overallScore: number
    riskLevel: string
    signals: Signal[]
    topFactors: string[]
    calculatedAt: string
  } | null
  burnout: {
    overallScore: number
    riskLevel: string
    indicators: Indicator[]
    calculatedAt: string
  } | null
}

// ─── 상수 ────────────────────────────────────────────────

const RISK_CONFIG: Record<string, { labelKey: string; bg: string; text: string; border: string; color: string }> = {
  low:      { labelKey: 'predictive.riskLevels.low',     bg: 'bg-emerald-500/15', text: 'text-emerald-700', border: 'border-emerald-200', color: '#059669' },
  medium:   { labelKey: 'predictive.riskLevels.medium',     bg: 'bg-amber-500/15', text: 'text-amber-700', border: 'border-amber-300', color: '#F59E0B' },
  high:     { labelKey: 'predictive.riskLevels.high',     bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', color: '#EF4444' },
  critical: { labelKey: 'predictive.riskLevels.critical',     bg: 'bg-orange-500/10', text: 'text-orange-700', border: 'border-orange-200', color: '#C2410C' },
  insufficient_data: { labelKey: 'predictive.riskLevels.insufficientData', bg: 'bg-background', text: 'text-muted-foreground', border: 'border-border', color: '#999' },
}

const SIGNAL_LABELS: Record<string, string> = {
  overtime_signal: 'predictive.signals.overtime',
  leave_usage_signal: 'predictive.signals.leaveUsage',
  sentiment_signal: 'predictive.signals.sentiment',
  salary_band_signal: 'predictive.signals.salaryBand',
  promotion_stagnation_signal: 'predictive.signals.promotionStagnation',
  skill_gap_signal: 'predictive.signals.skillGap',
  training_signal: 'predictive.signals.training',
  exit_pattern_signal: 'predictive.signals.exitPattern',
  eval_trend_signal: 'predictive.signals.evalTrend',
  tenure_signal: 'predictive.signals.tenure',
}

// ─── 헬퍼 ────────────────────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const t = useTranslations('analytics')
  const cfg = RISK_CONFIG[level] ?? RISK_CONFIG.low!
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {t(cfg.labelKey)}
    </span>
  )
}

function ScoreGauge({ score, riskLevel }: { score: number; riskLevel: string }) {
  const cfg = RISK_CONFIG[riskLevel] ?? RISK_CONFIG.low!
  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 120 120" className="w-36 h-36">
        <circle cx="60" cy="60" r="50" fill="none" stroke="#F5F5F5" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={cfg.color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 314} 314`}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="58" textAnchor="middle" className="text-2xl font-bold" style={{ fill: '#1A1A1A', fontSize: '22px', fontWeight: 700 }}>
          {score}
        </text>
        <text x="60" y="75" textAnchor="middle" style={{ fill: '#999', fontSize: '11px' }}>
          {'risk_score'}
        </text>
      </svg>
    </div>
  )
}

// ─── 권고 액션 ─────────────────────────────────────────

function RecommendedActions({ turnover, burnout }: {
  turnover: EmployeeRiskData['turnover']
  burnout: EmployeeRiskData['burnout']
}) {
  const t = useTranslations('analytics')
  const actions: { icon: string; textKey: string; priority: 'high' | 'medium' }[] = []

  if (turnover && ['high', 'critical'].includes(turnover.riskLevel)) {
    actions.push({ icon: '💬', textKey: 'predictive.actions.oneOnOne', priority: 'high' })
    actions.push({ icon: '💰', textKey: 'predictive.actions.compensationReview', priority: 'high' })
    if (turnover.topFactors.includes('승진 정체')) { // i18n: intentional DB value match
      actions.push({ icon: '📈', textKey: 'predictive.actions.careerPathReview', priority: 'medium' })
    }
  }

  if (burnout && ['high', 'critical'].includes(burnout.riskLevel)) {
    actions.push({ icon: '🏖️', textKey: 'predictive.actions.leaveRecommendation', priority: 'high' })
    actions.push({ icon: '⏱️', textKey: 'predictive.actions.overtimeReduction', priority: 'high' })
  }

  if (actions.length === 0) {
    actions.push({ icon: '✅', textKey: 'predictive.actions.currentlyStable', priority: 'medium' })
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <h3 className="text-base font-semibold text-foreground mb-4">{t('predictive.recommendedActions')}</h3>
      <div className="space-y-3">
        {actions.map((action, i) => (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
            action.priority === 'high' ? 'bg-orange-500/10 border border-orange-200' : 'bg-background'
          }`}>
            <span className="text-lg">{action.icon}</span>
            <div>
              <p className="text-sm text-foreground">{t(action.textKey)}</p>
              {action.priority === 'high' && (
                <span className="text-xs text-orange-700 font-medium">{t('predictive.actions.immediateAction')}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────

export default function EmployeeRiskDetailClient({ employeeId }: { employeeId: string }) {
  const t = useTranslations('analytics')
  const [data, setData] = useState<EmployeeRiskData | null>(null)
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)

  const fetchData = useCallback(async (recalculate = false) => {
    if (recalculate) setRecalculating(true)
    else setLoading(true)
    try {
      const res = await apiClient.get<EmployeeRiskData>('/api/v1/analytics/employee-risk', {
        employee_id: employeeId,
        recalculate: recalculate ? 'true' : 'false',
      })
      setData(res.data)
    } catch {
      // silently handle
    } finally {
      setLoading(false)
      setRecalculating(false)
    }
  }, [employeeId])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <Link href="/analytics/predictive" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> {t('predictive.detail.backToList')}
        </Link>
        <EmptyState />
      </div>
    )
  }

  // Radar chart data (turnover risk signals)
  const radarData = data.turnover
    ? (data.turnover.signals as unknown as Signal[])
        .filter((s) => s.available)
        .map((s) => ({
          subject: SIGNAL_LABELS[s.signal] ? t(SIGNAL_LABELS[s.signal]) : s.signal,
          score: s.score,
        }))
    : []

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/analytics/predictive" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> {t('predictive.detail.back')}
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{data.employee.name}</h1>
            <p className="text-sm text-muted-foreground">
              {data.employee.department?.name ?? '—'} · {data.employee.jobGrade?.name ?? '—'}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={recalculating}
          className={`flex items-center gap-2 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}
        >
          {recalculating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {recalculating ? t('predictive.detail.recalculating') : t('predictive.detail.recalculate')}
        </button>
      </div>

      {/* 상단 스코어 카드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 이직 위험 */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-red-500" />
            <h3 className="text-base font-semibold text-foreground">{t('predictive.detail.turnoverRisk')}</h3>
            {data.turnover && <RiskBadge level={data.turnover.riskLevel} />}
          </div>
          {data.turnover ? (
            <div className="flex items-center gap-6">
              <ScoreGauge score={data.turnover.overallScore} riskLevel={data.turnover.riskLevel} />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-2">{t('predictive.detail.mainRiskFactors')}</p>
                <div className="space-y-1">
                  {data.turnover.topFactors.slice(0, 4).map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      <span className="text-xs text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-3">
                  {t('predictive.detail.calculatedDate', { date: new Date(data.turnover.calculatedAt).toLocaleDateString() })}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Info className="w-4 h-4" /> {t('predictive.detail.insufficientData')}
            </div>
          )}
        </div>

        {/* 번아웃 */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-semibold text-foreground">{t('predictive.detail.burnoutRisk')}</h3>
            {data.burnout && <RiskBadge level={data.burnout.riskLevel} />}
          </div>
          {data.burnout ? (
            <div className="flex items-center gap-6">
              <ScoreGauge score={data.burnout.overallScore} riskLevel={data.burnout.riskLevel} />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-2">{t('predictive.detail.indicatorStatus')}</p>
                <div className="space-y-2">
                  {(data.burnout.indicators as unknown as Indicator[])
                    .filter((i) => i.available)
                    .slice(0, 4)
                    .map((indicator) => (
                      <div key={indicator.indicator} className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="text-[10px] text-muted-foreground">{indicator.indicator}</p>
                          <div className="h-1 bg-muted rounded-full overflow-hidden mt-0.5">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${indicator.score}%`,
                                backgroundColor: indicator.score > 70 ? '#EF4444' : indicator.score > 40 ? '#F59E0B' : '#059669',
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground w-6">{indicator.score}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Info className="w-4 h-4" /> {t('predictive.detail.insufficientData')}
            </div>
          )}
        </div>
      </div>

      {/* 레이더 차트 + 권고 액션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {radarData.length > 0 && (
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">{t('predictive.detail.signalRadar')}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar
                  dataKey="score"
                  stroke={CHART_THEME.colors[4]}
                  fill={CHART_THEME.colors[4]}
                  fillOpacity={0.2}
                />
                <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        <RecommendedActions turnover={data.turnover} burnout={data.burnout} />
      </div>

      {/* 신호 상세 테이블 */}
      {data.turnover && (
        <div className="bg-card rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-base font-semibold text-foreground">{t('predictive.detail.signalDetailTable')}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className={TABLE_STYLES.table}>
              <thead className={TABLE_STYLES.header}>
                <tr className={TABLE_STYLES.row}>
                  <th className={TABLE_STYLES.headerCell}>{t('predictive.detail.signal')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('predictive.detail.weight')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('predictive.detail.score')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('predictive.detail.status')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('predictive.detail.rawData')}</th>
                </tr>
              </thead>
              <tbody>
                {(data.turnover.signals as unknown as Signal[]).map((signal) => (
                  <tr key={signal.signal} className={TABLE_STYLES.row}>
                    <td className={cn(TABLE_STYLES.cell, 'font-medium text-foreground')}>
                      {SIGNAL_LABELS[signal.signal] ? t(SIGNAL_LABELS[signal.signal]) : signal.signal}
                    </td>
                    <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground')}>{Math.round(signal.weight * 100)}%</td>
                    <td className={TABLE_STYLES.cell}>
                      {signal.available ? (
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${signal.score}%`,
                                backgroundColor: signal.score > 70 ? '#EF4444' : signal.score > 40 ? '#F59E0B' : '#059669',
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{signal.score}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        signal.available
                          ? 'bg-emerald-500/15 text-emerald-700'
                          : 'bg-background text-muted-foreground'
                      }`}>
                        {signal.available ? t('predictive.detail.calculated') : t('predictive.detail.noData')}
                      </span>
                    </td>
                    <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground')}>
                      {signal.rawData
                        ? Object.entries(signal.rawData)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
