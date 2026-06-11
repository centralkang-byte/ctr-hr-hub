'use client'

import { useTranslations, useLocale } from 'next-intl'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, ChevronLeft, ChevronRight, RefreshCw,
  ChevronDown, ChevronUp, CheckCircle2,
  BarChart3, TrendingUp, Globe, Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/types'
import { CARD_STYLES, TABLE_STYLES, TYPOGRAPHY, BUTTON_VARIANTS } from '@/lib/styles'

interface Anomaly {
  rule: string
  severity: 'high' | 'medium' | 'low'
  description: string
  affectedCount: number
  details: Record<string, unknown>[]
}

interface AnomalyData {
  year: number
  month: number
  totalAnomalies: number
  anomalies: Anomaly[]
  scannedCount: number
}

// AN-3·AN-6: raw 팔레트 → 시맨틱 토큰 (badge = Badge variant, 카드 보더/아이콘 틴트 = ALL-4)
const SEVERITY_BADGE: Record<string, BadgeVariant> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
}

const SEVERITY_CARD_BORDER: Record<string, string> = {
  high: 'border-destructive/20',
  medium: 'border-warning-bright/40',
  low: 'border-primary/20',
}

const SEVERITY_ICON_TINT: Record<string, string> = {
  high: 'text-destructive',
  medium: 'text-ctr-warning',
  low: 'text-primary',
}

const SEVERITY_LABEL_KEYS: Record<string, string> = {
  high: 'anomalyPage.severityHigh',
  medium: 'anomalyPage.severityMedium',
  low: 'anomalyPage.severityLow',
}

// AN-2: 이모지 → Lucide (미정의 룰은 AlertTriangle 폴백)
const RULE_ICONS: Record<string, LucideIcon> = {
  'BAND_EXCEEDED': BarChart3,
  'HIGH_INTERNAL_VARIANCE': TrendingUp,
  'CROSS_ENTITY_GAP': Globe,
  'MOM_CHANGE_30PCT': Zap,
}

const RULE_LABEL_KEYS: Record<string, string> = {
  'BAND_EXCEEDED': 'anomalyPage.ruleBandExceeded',
  'HIGH_INTERNAL_VARIANCE': 'anomalyPage.ruleHighVariance',
  'CROSS_ENTITY_GAP': 'anomalyPage.ruleCrossEntityGap',
  'MOM_CHANGE_30PCT': 'anomalyPage.ruleMomChange',
}

const ALL_RULES = ['BAND_EXCEEDED', 'HIGH_INTERNAL_VARIANCE', 'CROSS_ENTITY_GAP', 'MOM_CHANGE_30PCT'] as const

// AN-2: 룰 아이콘 렌더 (severity 틴트 — urgency는 아이콘 틴트로, rules/design.md)
function RuleIcon({ rule, severity }: { rule: string; severity: string }) {
  const Icon = RULE_ICONS[rule] ?? AlertTriangle
  return (
    <Icon
      className={cn('h-6 w-6 shrink-0', SEVERITY_ICON_TINT[severity] ?? 'text-muted-foreground')}
      strokeWidth={1.5}
      aria-hidden="true"
    />
  )
}

export default function PayrollAnomaliesClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<AnomalyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<AnomalyData>(`/api/v1/payroll/anomalies?year=${year}&month=${month}`)
      setData(res.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  const prevMonth = () => month === 1 ? (setYear(y => y - 1), setMonth(12)) : setMonth(m => m - 1)
  const nextMonth = () => month === 12 ? (setYear(y => y + 1), setMonth(1)) : setMonth(m => m + 1)
  const toggle = (rule: string) => setExpanded(e => ({ ...e, [rule]: !e[rule] }))

  const renderDetail = (anomaly: Anomaly) => {
    const { rule: _rule, details } = anomaly
    if (details.length === 0) return null

    const sample = details[0] as Record<string, unknown>

    return (
      <div className="mt-4 overflow-x-auto">
        <table className={TABLE_STYLES.table}>
          <thead>
            <tr className={TABLE_STYLES.header}>
              {Object.keys(sample).filter(k => k !== 'employeeId').map(k => (
                <th key={k} className={TABLE_STYLES.headerCell + " capitalize"}>
                  {k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {details.slice(0, 8).map((row, i) => {
              const r = row as Record<string, unknown>
              return (
                <tr key={i} className={TABLE_STYLES.row}>
                  {Object.entries(r).filter(([k]) => k !== 'employeeId').map(([k, v]) => (
                    <td key={k} className={TABLE_STYLES.cell}>
                      {typeof v === 'number' ? v.toLocaleString(locale) : String(v ?? '—')}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        {details.length > 8 && (
          <p className="text-xs text-muted-foreground mt-2 px-3">{t('anomalyPage.moreItems', { count: details.length - 8 })}</p>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      {/* ── Header (AN-1: proto .page-h — 56px 아이콘 타일 + pageTitle + 13px sub) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-accent text-primary">
            <AlertTriangle className="h-[26px] w-[26px]" aria-hidden="true" />
          </div>
          <div>
            <h1 className={TYPOGRAPHY.pageTitle}>{t('anomalyPage.pageTitle')}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{t('anomalyPage.pageDesc')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          aria-label={tCommon('refresh')}
          className={cn(BUTTON_VARIANTS.ghost, 'rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
        </button>
      </div>

      {/* Month Nav */}
      <div className="flex items-center gap-4">
        <button type="button" onClick={prevMonth} aria-label={t('dashboard.prevMonth')} className="p-2 hover:bg-muted rounded-lg">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        </button>
        <div className="text-lg font-semibold text-foreground min-w-[120px] text-center">
          {t('anomalyPage.yearMonth', { year, month })}
        </div>
        <button type="button" onClick={nextMonth} aria-label={t('dashboard.nextMonth')} className="p-2 hover:bg-muted rounded-lg">
          <ChevronRight className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> {tCommon('analyzing')}
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary KPI — AN-4: WdStatStrip 미적용(실수치 4개 아님, ALL-5) — 카드 유지 + 토큰 정합 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className={cn(CARD_STYLES.padded, 'border border-border')}>
              <p className={cn(TYPOGRAPHY.label, 'mb-1')}>{t('anomalyPage.totalAnomalies')}</p>
              <p className={cn(TYPOGRAPHY.stat, data.totalAnomalies > 0 ? 'text-destructive' : 'text-tertiary')}>
                {data.totalAnomalies}
              </p>
            </div>
            <div className={cn(CARD_STYLES.padded, 'border border-border')}>
              <p className={cn(TYPOGRAPHY.label, 'mb-1')}>{t('anomalyPage.highOrAbove')}</p>
              <p className={cn(TYPOGRAPHY.stat, 'text-destructive')}>
                {data.anomalies.filter(a => a.severity === 'high').reduce((s, a) => s + a.affectedCount, 0)}
              </p>
            </div>
            <div className={cn(CARD_STYLES.padded, 'border border-border')}>
              <p className={cn(TYPOGRAPHY.label, 'mb-1')}>{t('anomalyPage.ruleCount')}</p>
              <p className={TYPOGRAPHY.stat}>4</p>
            </div>
            <div className={cn(CARD_STYLES.padded, 'border border-border')}>
              <p className={cn(TYPOGRAPHY.label, 'mb-1')}>{t('anomalyPage.scannedCount')}</p>
              <p className={TYPOGRAPHY.stat}>{data.scannedCount}</p>
            </div>
          </div>

          {/* AN-5: 수동 빈 상태 배너 → EmptyState (standalone) */}
          {data.totalAnomalies === 0 && (
            <EmptyState
              icon={CheckCircle2}
              title={t('anomalyPage.noAnomalies')}
              sub={t('anomalyPage.noAnomaliesDesc', { year, month })}
              standalone
            />
          )}

          {/* Anomaly Cards */}
          <div className="space-y-4">
            {data.anomalies.map(anomaly => (
              <div
                key={anomaly.rule}
                className={cn('bg-card rounded-2xl border overflow-hidden', SEVERITY_CARD_BORDER[anomaly.severity] ?? 'border-border')}
              >
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-background"
                  onClick={() => toggle(anomaly.rule)}
                >
                  <div className="flex items-center gap-3">
                    <RuleIcon rule={anomaly.rule} severity={anomaly.severity} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={TYPOGRAPHY.cardTitle}>{t(RULE_LABEL_KEYS[anomaly.rule] ?? anomaly.rule)}</h3>
                        <Badge variant={SEVERITY_BADGE[anomaly.severity] ?? 'neutral'}>
                          {t('anomalyPage.riskLevel', { level: t(SEVERITY_LABEL_KEYS[anomaly.severity]) })}
                        </Badge>
                        <span className="text-sm font-bold text-destructive">{t('anomalyPage.itemCount', { count: anomaly.affectedCount })}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{anomaly.description}</p>
                    </div>
                  </div>
                  {expanded[anomaly.rule] ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                </div>
                {expanded[anomaly.rule] && (
                  <div className="px-5 pb-5 border-t border-border">
                    {renderDetail(anomaly)}
                  </div>
                )}
              </div>
            ))}

            {/* Placeholder cards for rules with no anomalies — AN-5: EmptyState (sm) */}
            {ALL_RULES
              .filter(rule => !data.anomalies.find(a => a.rule === rule))
              .map(rule => (
                <EmptyState
                  key={rule}
                  icon={CheckCircle2}
                  title={t(RULE_LABEL_KEYS[rule] ?? rule)}
                  sub={t('anomalyPage.noAnomalies')}
                  size="sm"
                  standalone
                />
              ))}
          </div>
        </>
      )}
    </div>
  )
}
