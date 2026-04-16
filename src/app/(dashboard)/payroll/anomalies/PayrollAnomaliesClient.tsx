'use client'

import { useTranslations, useLocale } from 'next-intl'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, ChevronLeft, ChevronRight, RefreshCw,
  ChevronDown, ChevronUp, CheckCircle2
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { CARD_STYLES, TABLE_STYLES } from '@/lib/styles'

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

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-amber-500/15 text-amber-700 border-amber-300',
  low: 'bg-indigo-500/15 text-primary/90 border-indigo-200',
}

const SEVERITY_LABEL_KEYS: Record<string, string> = {
  high: 'anomalyPage.severityHigh',
  medium: 'anomalyPage.severityMedium',
  low: 'anomalyPage.severityLow',
}

const RULE_ICONS: Record<string, string> = {
  'BAND_EXCEEDED': '📊',
  'HIGH_INTERNAL_VARIANCE': '📈',
  'CROSS_ENTITY_GAP': '🌍',
  'MOM_CHANGE_30PCT': '⚡',
}

const RULE_LABEL_KEYS: Record<string, string> = {
  'BAND_EXCEEDED': 'anomalyPage.ruleBandExceeded',
  'HIGH_INTERNAL_VARIANCE': 'anomalyPage.ruleHighVariance',
  'CROSS_ENTITY_GAP': 'anomalyPage.ruleCrossEntityGap',
  'MOM_CHANGE_30PCT': 'anomalyPage.ruleMomChange',
}

const ALL_RULES = ['BAND_EXCEEDED', 'HIGH_INTERNAL_VARIANCE', 'CROSS_ENTITY_GAP', 'MOM_CHANGE_30PCT'] as const

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
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-destructive/10 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('anomalyPage.pageTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('anomalyPage.pageDesc')}</p>
          </div>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-muted rounded-lg" disabled={loading}>
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Month Nav */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={prevMonth} className="p-2 hover:bg-muted rounded-lg">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="text-lg font-semibold text-foreground min-w-[120px] text-center">
          {t('anomalyPage.yearMonth', { year, month })}
        </div>
        <button onClick={nextMonth} className="p-2 hover:bg-muted rounded-lg">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> {tCommon('analyzing')}
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary KPI */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className={CARD_STYLES.padded}>
              <p className="text-xs text-muted-foreground mb-1">{t('anomalyPage.totalAnomalies')}</p>
              <p className={`text-3xl font-bold ${data.totalAnomalies > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                {data.totalAnomalies}
              </p>
            </div>
            <div className={CARD_STYLES.padded}>
              <p className="text-xs text-muted-foreground mb-1">{t('anomalyPage.highOrAbove')}</p>
              <p className="text-3xl font-bold text-destructive">
                {data.anomalies.filter(a => a.severity === 'high').reduce((s, a) => s + a.affectedCount, 0)}
              </p>
            </div>
            <div className={CARD_STYLES.padded}>
              <p className="text-xs text-muted-foreground mb-1">{t('anomalyPage.ruleCount')}</p>
              <p className="text-3xl font-bold text-foreground">4</p>
            </div>
            <div className={CARD_STYLES.padded}>
              <p className="text-xs text-muted-foreground mb-1">{t('anomalyPage.scannedCount')}</p>
              <p className="text-3xl font-bold text-foreground">{data.scannedCount}</p>
            </div>
          </div>

          {data.totalAnomalies === 0 && (
            <div className="flex items-center gap-3 p-6 bg-emerald-500/15 rounded-xl text-emerald-700">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-semibold">{t('anomalyPage.noAnomalies')}</p>
                <p className="text-sm mt-0.5">{t('anomalyPage.noAnomaliesDesc', { year, month })}</p>
              </div>
            </div>
          )}

          {/* Anomaly Cards */}
          <div className="space-y-4">
            {data.anomalies.map(anomaly => (
              <div
                key={anomaly.rule}
                className={`bg-card rounded-xl border overflow-hidden ${
                  anomaly.severity === 'high' ? 'border-destructive/20' : anomaly.severity === 'medium' ? 'border-amber-300' : 'border-indigo-200'
                }`}
              >
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-background"
                  onClick={() => toggle(anomaly.rule)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{RULE_ICONS[anomaly.rule] ?? '⚠️'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{t(RULE_LABEL_KEYS[anomaly.rule] ?? anomaly.rule)}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_COLORS[anomaly.severity]}`}>
                          {t('anomalyPage.riskLevel', { level: t(SEVERITY_LABEL_KEYS[anomaly.severity]) })}
                        </span>
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

            {/* Placeholder cards for rules with no anomalies */}
            {ALL_RULES
              .filter(rule => !data.anomalies.find(a => a.rule === rule))
              .map(rule => (
                <div key={rule} className={`${CARD_STYLES.kpi} flex items-center gap-3 opacity-60`}>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="font-medium text-muted-foreground">{t(RULE_LABEL_KEYS[rule] ?? rule)}</h3>
                    <p className="text-sm text-muted-foreground">{t('anomalyPage.noAnomalies')}</p>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
