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
      <div className={}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#F5F5F5] flex items-center justify-center">
            <Users className="h-5 w-5 text-[#555]" />
          </div>
          <div>
            <p className="text-xs text-[#666]">전체 구성원</p>
            <p className="text-2xl font-bold text-[#1A1A1A]">{totalEmployees}명</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#FECACA] p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-[#DC2626]" />
          </div>
          <div>
            <p className="text-xs text-[#666]">고위험군</p>
            <p className="text-2xl font-bold text-[#DC2626]">{highRiskCount}명</p>
            {highChange != null && (
              <span
                className={`text-xs flex items-center gap-0.5 ${highChange > 0 ? 'text-[#EF4444]' : highChange < 0 ? 'text-[#059669]' : 'text-[#999]'}`}
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

      <div className="bg-white rounded-xl border border-[#FCD34D] p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-[#D97706]" />
          </div>
          <div>
            <p className="text-xs text-[#666]">주의군</p>
            <p className="text-2xl font-bold text-[#D97706]">{mediumRiskCount}명</p>
          </div>
        </div>
      </div>

      <div className={}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#E8F5E9] flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-[#00C853]" />
          </div>
          <div>
            <p className="text-xs text-[#666]">평균 이탈 점수</p>
            <p className="text-2xl font-bold text-[#1A1A1A]">{avgScore}</p>
            <span className="text-xs text-[#999]">/ 100</span>
          </div>
        </div>
      </div>
    </div>
  )
}
