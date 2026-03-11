'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Heart, Clock, CalendarDays, Target, AlertTriangle, Flame } from 'lucide-react'
import { ChartCard } from '@/components/analytics/ChartCard'
import type { TeamHealthResponse } from '@/lib/analytics/types'

const SCORE_COLORS: Record<string, string> = {
  HEALTHY: '#10B981', CAUTION: '#F59E0B', WARNING: '#F97316', CRITICAL: '#EF4444',
}
const SCORE_LABELS: Record<string, string> = {
  HEALTHY: '건강', CAUTION: '주의', WARNING: '경고', CRITICAL: '위험',
}
const SUB_ICONS = [
  { key: 'overtime', label: '초과근무', icon: Clock },
  { key: 'leaveUsage', label: '연차사용', icon: CalendarDays },
  { key: 'performanceDist', label: '성과분포', icon: Target },
  { key: 'turnoverRisk', label: '이직위험', icon: AlertTriangle },
  { key: 'burnoutRisk', label: '번아웃', icon: Flame },
]
const STATUS_COLORS = { GREEN: '#10B981', YELLOW: '#F59E0B', RED: '#EF4444' }
const STATUS_LABELS = { GREEN: '🟢', YELLOW: '🟡', RED: '🔴' }
const RISK_COLORS = { HIGH: 'text-red-600 bg-red-50', MEDIUM: 'text-amber-600 bg-amber-50', LOW: 'text-emerald-600 bg-emerald-50' }

export default function TeamHealthClient() {
  const [data, setData] = useState<TeamHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/analytics/team-health/overview')
      if (res.ok) { const j = await res.json(); setData(j.data) }
    } catch { /* */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !data) {
    return <div className="space-y-6 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-xl" />)}</div>
  }

  if (data.isEmpty) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-gray-100 p-4">
            <Heart className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">👥 조회할 팀원 데이터가 없습니다 (0명)</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          현재 직속 팀원이 배정되지 않았거나, 조직도 데이터가 아직 연결되지 않았습니다.
          인사팀에 문의하시거나 조직도 업데이트를 확인해주세요.
        </p>
      </div>
    )
  }

  const scoreColor = SCORE_COLORS[data.scoreLevel] || '#94A3B8'
  const dashOffset = 100 - data.score

  return (
    <div className="space-y-6">
      {/* Health Score Hero */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex flex-col items-center">
          <div className="relative w-48 h-28 mb-4">
            <svg viewBox="0 0 120 70" className="w-48 h-28">
              {/* Background arc */}
              <path d="M10 65 A50 50 0 0 1 110 65" fill="none" stroke="#E5E7EB" strokeWidth="8" strokeLinecap="round" />
              {/* Score arc */}
              <path d="M10 65 A50 50 0 0 1 110 65" fill="none" stroke={scoreColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(data.score / 100) * 157} 157`} className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
              <span className="text-3xl font-bold" style={{ color: scoreColor }}>{data.score}</span>
              <span className="text-xs font-medium" style={{ color: scoreColor }}>
                {SCORE_LABELS[data.scoreLevel]}
              </span>
            </div>
          </div>
        </div>

        {/* Sub-scores */}
        <div className="grid grid-cols-5 gap-3 mt-4">
          {SUB_ICONS.map(({ key, label, icon: Icon }) => {
            const sub = data.subScores[key as keyof typeof data.subScores]
            const subColor = sub.level === 'GOOD' ? '#10B981' : sub.level === 'CAUTION' ? '#F59E0B' : sub.level === 'WARNING' ? '#F97316' : '#EF4444'
            return (
              <div key={key} className="text-center p-3 bg-gray-50 rounded-xl">
                <Icon className="h-4 w-4 mx-auto mb-1" style={{ color: subColor }} />
                <div className="text-lg font-bold" style={{ color: subColor }}>{sub.score}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Members Table */}
      <ChartCard title="👥 팀원 현황">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 font-medium text-gray-500">이름</th>
                <th className="text-right py-2 px-3 font-medium text-gray-500">초과근무</th>
                <th className="text-right py-2 px-3 font-medium text-gray-500">연차사용률</th>
                <th className="text-center py-2 px-3 font-medium text-gray-500">성과등급</th>
                <th className="text-center py-2 px-3 font-medium text-gray-500">이직위험</th>
                <th className="text-center py-2 px-3 font-medium text-gray-500">상태</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.employeeId} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 px-3 font-medium text-gray-700">{m.name}</td>
                  <td className={`text-right py-2 px-3 ${m.weeklyOvertime > 10 ? 'text-red-600 font-medium' : ''}`}>{m.weeklyOvertime}h</td>
                  <td className={`text-right py-2 px-3 ${m.leaveUsageRate < 30 ? 'text-amber-600' : ''}`}>{m.leaveUsageRate}%</td>
                  <td className="text-center py-2 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.lastGrade === 'B' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                      {m.lastGrade}
                    </span>
                  </td>
                  <td className="text-center py-2 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${RISK_COLORS[m.turnoverRisk]}`}>
                      {m.turnoverRisk}
                    </span>
                  </td>
                  <td className="text-center py-2 px-3">{STATUS_LABELS[m.overallStatus]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Recommendations */}
      <ChartCard title="💡 추천 액션">
        <div className="space-y-3">
          {data.recommendations.map((rec, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${
              rec.severity === 'RED' ? 'border-l-red-500 bg-red-50/30' : 'border-l-amber-500 bg-amber-50/30'
            }`}>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">
                  {rec.employeeName}
                  {rec.factors.length > 0 && ` — ${rec.factors.join(', ')}`}
                </p>
                <p className="text-xs text-gray-500 mt-1">{rec.actionText}</p>
              </div>
              {rec.actionLink && (
                <a href={rec.actionLink} className="text-xs text-[#5E81F4] hover:underline whitespace-nowrap">
                  프로필 보기 →
                </a>
              )}
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  )
}
