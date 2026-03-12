'use client'

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
  high: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]',
  medium: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]',
  low: 'bg-[#E0E7FF] text-[#4338CA] border-[#C7D2FE]',
}

const SEVERITY_LABEL: Record<string, string> = { high: '높음', medium: '보통', low: '낮음' }

const RULE_ICONS: Record<string, string> = {
  '밴드 이탈': '📊',
  '내부 분산 과다': '📈',
  '법인간 격차': '🌍',
  '급격한 변화': '⚡',
}

export default function PayrollAnomaliesClient({ user }: { user: SessionUser }) {
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
        <table className="w-full text-xs">
          <thead>
            <tr className={TABLE_STYLES.header}>
              {Object.keys(sample).filter(k => k !== 'employeeId').map(k => (
                <th key={k} className="px-3 py-2 text-left text-[#666] font-medium capitalize">
                  {k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F5F5F5]">
            {details.slice(0, 8).map((row, i) => {
              const r = row as Record<string, unknown>
              return (
                <tr key={i} className={TABLE_STYLES.row}>
                  {Object.entries(r).filter(([k]) => k !== 'employeeId').map(([k, v]) => (
                    <td key={k} className="px-3 py-2 text-[#555]">
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#FEE2E2] rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">급여 이상 탐지</h1>
            <p className="text-sm text-[#666]">밴드 이탈 · 내부 분산 · 법인간 격차 · 급격한 변화를 자동으로 탐지합니다</p>
          </div>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-[#F5F5F5] rounded-lg" disabled={loading}>
          <RefreshCw className={`w-4 h-4 text-[#555] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Month Nav */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={prevMonth} className="p-2 hover:bg-[#F5F5F5] rounded-lg">
          <ChevronLeft className="w-5 h-5 text-[#555]" />
        </button>
        <div className="text-lg font-semibold text-[#1A1A1A] min-w-[120px] text-center">
          {year}년 {month}월
        </div>
        <button onClick={nextMonth} className="p-2 hover:bg-[#F5F5F5] rounded-lg">
          <ChevronRight className="w-5 h-5 text-[#555]" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-[#999] text-sm gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> 분석 중...
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary KPI */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className={CARD_STYLES.padded}>
              <p className="text-xs text-[#666] mb-1">총 이상 건수</p>
              <p className={`text-3xl font-bold ${data.totalAnomalies > 0 ? 'text-[#DC2626]' : 'text-[#059669]'}`}>
                {data.totalAnomalies}
              </p>
            </div>
            <div className={CARD_STYLES.padded}>
              <p className="text-xs text-[#666] mb-1">High 이상</p>
              <p className="text-3xl font-bold text-[#DC2626]">
                {data.anomalies.filter(a => a.severity === 'high').reduce((s, a) => s + a.affectedCount, 0)}
              </p>
            </div>
            <div className={CARD_STYLES.padded}>
              <p className="text-xs text-[#666] mb-1">분석 규칙</p>
              <p className="text-3xl font-bold text-[#1A1A1A]">4</p>
            </div>
            <div className={CARD_STYLES.padded}>
              <p className="text-xs text-[#666] mb-1">스캔 인원</p>
              <p className="text-3xl font-bold text-[#1A1A1A]">{data.scannedCount}</p>
            </div>
          </div>

          {data.totalAnomalies === 0 && (
            <div className="flex items-center gap-3 p-6 bg-[#D1FAE5] rounded-xl text-[#047857]">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-semibold">이상 없음</p>
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
                  anomaly.severity === 'high' ? 'border-[#FECACA]' : anomaly.severity === 'medium' ? 'border-[#FCD34D]' : 'border-[#C7D2FE]'
                }`}
              >
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-[#FAFAFA]"
                  onClick={() => toggle(anomaly.rule)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{RULE_ICONS[anomaly.rule] ?? '⚠️'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[#1A1A1A]">{anomaly.rule}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_COLORS[anomaly.severity]}`}>
                          위험도 {SEVERITY_LABEL[anomaly.severity]}
                        </span>
                        <span className="text-sm font-bold text-[#DC2626]">{anomaly.affectedCount}건</span>
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
                  <div className="px-5 pb-5 border-t border-[#F5F5F5]">
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
                  <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0" />
                  <div>
                    <h3 className="font-medium text-[#555]">{rule}</h3>
                    <p className="text-sm text-[#999]">이상 없음</p>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
