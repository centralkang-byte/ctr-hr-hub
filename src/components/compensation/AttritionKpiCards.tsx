'use client'

import { AlertTriangle, TrendingUp, TrendingDown, Users } from 'lucide-react'

interface AttritionKpiCardsProps {
  totalEmployees: number
  highRiskCount: number
  mediumRiskCount: number
  avgScore: number
  prevMonthHighCount?: number
}

export default function AttritionKpiCards({
  totalEmployees,
  highRiskCount,
  mediumRiskCount,
  avgScore,
  prevMonthHighCount,
}: AttritionKpiCardsProps) {
  const highChange =
    prevMonthHighCount != null ? highRiskCount - prevMonthHighCount : null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <Users className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">전체 구성원</p>
            <p className="text-2xl font-bold text-slate-900">{totalEmployees}명</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">고위험군</p>
            <p className="text-2xl font-bold text-red-600">{highRiskCount}명</p>
            {highChange != null && (
              <span
                className={`text-xs flex items-center gap-0.5 ${highChange > 0 ? 'text-red-500' : highChange < 0 ? 'text-emerald-600' : 'text-slate-400'}`}
              >
                {highChange > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : highChange < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                {highChange > 0 ? '+' : ''}
                {highChange}명 전월 대비
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">주의군</p>
            <p className="text-2xl font-bold text-amber-600">{mediumRiskCount}명</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">평균 이탈 점수</p>
            <p className="text-2xl font-bold text-slate-900">{avgScore}</p>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
        </div>
      </div>
    </div>
  )
}
