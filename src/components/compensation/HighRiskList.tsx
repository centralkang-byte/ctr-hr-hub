'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import AttritionRadarChart from './AttritionRadarChart'

interface Factor {
  factor: string
  weight: number
  value: number
  description: string
}

interface AiAssessment {
  adjusted_score: number
  adjusted_level: string
  risk_drivers: string[]
  contextual_risks: string[]
  retention_actions: string[]
  confidence: string
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
  aiAssessment?: AiAssessment | null
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

const CONFIDENCE_LABELS: Record<string, string> = {
  HIGH: '높음',
  MEDIUM: '보통',
  LOW: '낮음',
}

export default function HighRiskList({ employees }: HighRiskListProps) {
  const { toast } = useToast()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [aiData, setAiData] = useState<Record<string, AiAssessment>>({})
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null)

  const handleLoadAi = async (employeeId: string) => {
    if (aiData[employeeId]) return // already loaded
    setAiLoadingId(employeeId)
    try {
      const res = await apiClient.get<{ aiAssessment: AiAssessment }>(
        `/api/v1/attrition/employees/${employeeId}`,
        { includeAi: 'true' },
      )
      if (res.data.aiAssessment) {
        setAiData((prev) => ({ ...prev, [employeeId]: res.data.aiAssessment }))
      }
    } catch {
      toast({ title: 'AI 분석 실패', description: 'AI 평가를 불러올 수 없습니다.', variant: 'destructive' })
    } finally {
      setAiLoadingId(null)
    }
  }

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
          const ai = emp.aiAssessment ?? aiData[emp.employeeId] ?? null

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
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-slate-700">
                          AI 인사이트
                        </h4>
                        {!ai && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLoadAi(emp.employeeId)}
                            disabled={aiLoadingId === emp.employeeId}
                            className="text-indigo-600 hover:text-indigo-700 text-xs"
                          >
                            {aiLoadingId === emp.employeeId ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Sparkles className="h-3 w-3 mr-1" />
                            )}
                            AI 분석
                          </Button>
                        )}
                      </div>

                      {ai ? (
                        <div className="space-y-3">
                          {/* AI adjusted score */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">AI 보정 점수:</span>
                            <span className="text-sm font-bold">{ai.adjusted_score}</span>
                            <Badge className={`text-xs ${RISK_BADGE_CLASSES[ai.adjusted_level] ?? ''}`}>
                              {RISK_LABELS[ai.adjusted_level] ?? ai.adjusted_level}
                            </Badge>
                            <span className="text-xs text-slate-400">
                              신뢰도: {CONFIDENCE_LABELS[ai.confidence] ?? ai.confidence}
                            </span>
                          </div>

                          {/* Risk drivers */}
                          {ai.risk_drivers.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-600 mb-1">핵심 이탈 동인</p>
                              <ul className="space-y-1">
                                {ai.risk_drivers.map((d, i) => (
                                  <li key={i} className="text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded">
                                    {d}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Contextual risks */}
                          {ai.contextual_risks.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-600 mb-1">맥락적 위험</p>
                              <ul className="space-y-1">
                                {ai.contextual_risks.map((r, i) => (
                                  <li key={i} className="text-xs text-slate-600">
                                    · {r}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Retention actions */}
                          {ai.retention_actions.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-600 mb-1">리텐션 액션</p>
                              <ul className="space-y-1">
                                {ai.retention_actions.map((action, i) => (
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
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
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
                              AI 분석 버튼을 클릭하여 인사이트를 확인하세요.
                            </p>
                          )}
                        </div>
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
