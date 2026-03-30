'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, ChevronLeft, ChevronRight, RefreshCw,
  ChevronDown, ChevronUp, ShieldAlert, CheckCircle2
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
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-300',
  low: 'bg-indigo-100 text-primary/90 border-indigo-200',
}

const SEVERITY_LABEL: Record<string, string> = { high: '높음', medium: '보통', low: '낮음' }

const RULE_ICONS: Record<string, string> = {
  '밴드 이탈': '📊',
  '내부 분산 과다': '📈',
  '법인간 격차': '🌍',
  '급격한 변화': '⚡',
}

export default function PayrollAnomaliesClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
  const tPayroll = useTranslations('payrollPage')
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
    const { rule, details } = anomaly
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
          <tbody className="divide-y divide-gray-200">
            {details.slice(0, 8).map((row, i) => {
              const r = row as Record<string, unknown>
              return (
                <tr key={i} className={TABLE_STYLES.row}>
                  {Object.entries(r).filter(([k]) => k !== 'employeeId').map(([k, v]) => (
                    <td key={k} className={TABLE_STYLES.cell}>
                      {typeof v === 'number' ? v.toLocaleString() : String(v ?? '—')}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        {details.length > 8 && (
          <p className="text-xs text-[#999] mt-2 px-3">... 외 {details.length - 8}건 더</p>
        )}
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{'급여 이상 탐지'}</h1>
            <p className="text-sm text-[#666]">{'밴드 이탈 · 내부 분산 · 법인간 격차 · 급격한 변화를 자동으로 탐지합니다'}</p>
          </div>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-muted rounded-lg" disabled={loading}>
          <RefreshCw className={`w-4 h-4 text-[#555] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Month Nav */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={prevMonth} className="p-2 hover:bg-muted rounded-lg">
          <ChevronLeft className="w-5 h-5 text-[#555]" />
        </button>
        <div className="text-lg font-semibold text-foreground min-w-[120px] text-center">
          {year}년 {month}월
        </div>
        <button onClick={nextMonth} className="p-2 hover:bg-muted rounded-lg">
          <ChevronRight className="w-5 h-5 text-[#555]" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-[#999] text-sm gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> {'분석 중...'}
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary KPI */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className={CARD_STYLES.padded}>
              <p className="text-xs text-[#666] mb-1">{tPayroll('totalAnomalies')}</p>
              <p className={`text-3xl font-bold ${data.totalAnomalies > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {data.totalAnomalies}
              </p>
            </div>
            <div className={CARD_STYLES.padded}>
              <p className="text-xs text-[#666] mb-1">{tPayroll('highOrAbove')}</p>
              <p className="text-3xl font-bold text-red-600">
                {data.anomalies.filter(a => a.severity === 'high').reduce((s, a) => s + a.affectedCount, 0)}
              </p>
            </div>
            <div className={CARD_STYLES.padded}>
              <p className="text-xs text-[#666] mb-1">{'분석 규칙'}</p>
              <p className="text-3xl font-bold text-foreground">4</p>
            </div>
            <div className={CARD_STYLES.padded}>
              <p className="text-xs text-[#666] mb-1">{'스캔 인원'}</p>
              <p className="text-3xl font-bold text-foreground">{data.scannedCount}</p>
            </div>
          </div>

          {data.totalAnomalies === 0 && (
            <div className="flex items-center gap-3 p-6 bg-emerald-100 rounded-xl text-emerald-700">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-semibold">{tPayroll('noAnomalies')}</p>
                <p className="text-sm mt-0.5">{year}년 {month}월 급여 데이터에서 이상 징후가 발견되지 않았습니다.</p>
              </div>
            </div>
          )}

          {/* Anomaly Cards */}
          <div className="space-y-4">
            {data.anomalies.map(anomaly => (
              <div
                key={anomaly.rule}
                className={`bg-white rounded-xl border overflow-hidden ${
                  anomaly.severity === 'high' ? 'border-red-200' : anomaly.severity === 'medium' ? 'border-amber-300' : 'border-indigo-200'
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
                        <h3 className="font-semibold text-foreground">{anomaly.rule}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_COLORS[anomaly.severity]}`}>
                          위험도 {SEVERITY_LABEL[anomaly.severity]}
                        </span>
                        <span className="text-sm font-bold text-red-600">{anomaly.affectedCount}건</span>
                      </div>
                      <p className="text-sm text-[#666] mt-0.5">{anomaly.description}</p>
                    </div>
                  </div>
                  {expanded[anomaly.rule] ? (
                    <ChevronUp className="w-5 h-5 text-[#999] shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#999] shrink-0" />
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
            {(['밴드 이탈', '내부 분산 과다', '법인간 격차', '급격한 변화'] as const)
              .filter(rule => !data.anomalies.find(a => a.rule === rule))
              .map(rule => (
                <div key={rule} className={`${CARD_STYLES.kpi} flex items-center gap-3 opacity-60`}>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="font-medium text-[#555]">{rule}</h3>
                    <p className="text-sm text-[#999]">{'이상 없음'}</p>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
