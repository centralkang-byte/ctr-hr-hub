'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import AttritionRadarChart from './AttritionRadarChart'

interface Factor {
  factor: string
  weight: number
  value: number
  description: string
}

interface HighRiskEmployee {
  employeeId: string
  employeeName: string
  departmentName: string
  jobGradeName: string
  score: number
  riskLevel: string
  factors: Factor[]
  retentionActions?: string[]
}

interface HighRiskListProps {
  employees: HighRiskEmployee[]
}

const RISK_BADGE_CLASSES: Record<string, string> = {
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const RISK_LABELS: Record<string, string> = {
  CRITICAL: '위험',
  HIGH: '높음',
  MEDIUM: '주의',
  LOW: '낮음',
}

export default function HighRiskList({ employees }: HighRiskListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900">고위험 직원 목록</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {employees.map((emp) => {
          const isExpanded = expandedId === emp.employeeId
          const topFactors = [...emp.factors]
            .sort((a, b) => b.value - a.value)
            .slice(0, 3)

          return (
            <div key={emp.employeeId}>
              <button
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 text-left"
                onClick={() => setExpandedId(isExpanded ? null : emp.employeeId)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-600">
                    {emp.employeeName.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{emp.employeeName}</p>
                    <p className="text-xs text-slate-500">
                      {emp.departmentName} · {emp.jobGradeName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{emp.score}</p>
                    <Badge
                      className={`text-xs ${RISK_BADGE_CLASSES[emp.riskLevel] ?? ''}`}
                    >
                      {RISK_LABELS[emp.riskLevel] ?? emp.riskLevel}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {topFactors.map((f) => (
                      <span
                        key={f.factor}
                        className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                      >
                        {f.description}
                      </span>
                    ))}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 bg-slate-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2">6요인 레이더</h4>
                      <AttritionRadarChart factors={emp.factors} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2">
                        권장 리텐션 액션
                      </h4>
                      {emp.retentionActions && emp.retentionActions.length > 0 ? (
                        <ul className="space-y-2">
                          {emp.retentionActions.map((action, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-slate-600"
                            >
                              <span className="inline-block w-5 h-5 rounded bg-blue-100 text-blue-700 text-xs font-medium text-center leading-5 flex-shrink-0">
                                {i + 1}
                              </span>
                              {action}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-400">
                          AI 분석 데이터가 없습니다.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {employees.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm">
            고위험 직원이 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}
