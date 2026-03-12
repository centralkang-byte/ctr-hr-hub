'use client'

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
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'

// ─── 타입 ────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high' | 'critical' | 'insufficient_data'

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

const RISK_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; color: string }> = {
  low:      { label: '낮음',     bg: 'bg-[#D1FAE5]', text: 'text-[#047857]', border: 'border-[#A7F3D0]', color: '#059669' },
  medium:   { label: '보통',     bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', border: 'border-[#FCD34D]', color: '#F59E0B' },
  high:     { label: '높음',     bg: 'bg-[#FEE2E2]', text: 'text-[#B91C1C]', border: 'border-[#FECACA]', color: '#EF4444' },
  critical: { label: '위험',     bg: 'bg-[#FFF7ED]', text: 'text-[#C2410C]', border: 'border-[#FED7AA]', color: '#C2410C' },
  insufficient_data: { label: '데이터 부족', bg: 'bg-[#FAFAFA]', text: 'text-[#555]', border: 'border-[#E8E8E8]', color: '#999' },
}

const SIGNAL_LABELS: Record<string, string> = {
  overtime_signal: '초과근무',
  leave_usage_signal: '연차 사용',
  sentiment_signal: '감정 추이',
  salary_band_signal: '급여 밴드',
  promotion_stagnation_signal: '승진 정체',
  skill_gap_signal: '스킬 갭',
  training_signal: '교육 미이수',
  exit_pattern_signal: '퇴직 패턴',
  eval_trend_signal: '평가 추이',
  tenure_signal: '재직 기간',
}

// ─── 헬퍼 ────────────────────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const cfg = RISK_CONFIG[level] ?? RISK_CONFIG.low!
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
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
          위험 점수
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
  const actions: { icon: string; text: string; priority: 'high' | 'medium' }[] = []

  if (turnover && ['high', 'critical'].includes(turnover.riskLevel)) {
    actions.push({ icon: '💬', text: '1:1 미팅 즉시 예약 — 이직 의향 파악', priority: 'high' })
    actions.push({ icon: '💰', text: '보상 수준 검토 및 조정 검토', priority: 'high' })
    if (turnover.topFactors.includes('승진 정체')) {
      actions.push({ icon: '📈', text: '경력 개발 계획 수립 지원', priority: 'medium' })
    }
  }

  if (burnout && ['high', 'critical'].includes(burnout.riskLevel)) {
    actions.push({ icon: '🏖️', text: '연차 사용 독려 — 단기 휴가 권장', priority: 'high' })
    actions.push({ icon: '⏱️', text: '초과근무 제한 조치 검토', priority: 'high' })
  }

  if (actions.length === 0) {
    actions.push({ icon: '✅', text: '현재 위험 수준 낮음 — 정기 모니터링 유지', priority: 'medium' })
  }

  return (
    <div className={}>
      <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">권고 액션</h3>
      <div className="space-y-3">
        {actions.map((action, i) => (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
            action.priority === 'high' ? 'bg-[#FFF7ED] border border-[#FED7AA]' : 'bg-[#F9F9F9]'
          }`}>
            <span className="text-lg">{action.icon}</span>
            <div>
              <p className="text-sm text-[#1A1A1A]">{action.text}</p>
              {action.priority === 'high' && (
                <span className="text-xs text-[#C2410C] font-medium">즉시 조치 필요</span>
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
        <Loader2 className="w-8 h-8 animate-spin text-[#999]" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <Link href="/analytics/predictive" className="flex items-center gap-2 text-sm text-[#666] hover:text-[#333] mb-6">
          <ArrowLeft className="w-4 h-4" /> 예측 애널리틱스로 돌아가기
        </Link>
        <p className="text-sm text-[#999]">데이터를 불러올 수 없습니다.</p>
      </div>
    )
  }

  // 레이더 차트 데이터 (이직 위험 신호)
  const radarData = data.turnover
    ? (data.turnover.signals as unknown as Signal[])
        .filter((s) => s.available)
        .map((s) => ({
          subject: SIGNAL_LABELS[s.signal] ?? s.signal,
          score: s.score,
        }))
    : []

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/analytics/predictive" className="flex items-center gap-2 text-sm text-[#666] hover:text-[#333]">
            <ArrowLeft className="w-4 h-4" /> 목록으로
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">{data.employee.name}</h1>
            <p className="text-sm text-[#666]">
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
          {recalculating ? '재계산 중...' : '실시간 재계산'}
        </button>
      </div>

      {/* 상단 스코어 카드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 이직 위험 */}
        <div className={}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-[#EF4444]" />
            <h3 className="text-base font-semibold text-[#1A1A1A]">이직 위험도</h3>
            {data.turnover && <RiskBadge level={data.turnover.riskLevel} />}
          </div>
          {data.turnover ? (
            <div className="flex items-center gap-6">
              <ScoreGauge score={data.turnover.overallScore} riskLevel={data.turnover.riskLevel} />
              <div className="flex-1">
                <p className="text-xs text-[#666] mb-2">주요 위험 요인</p>
                <div className="space-y-1">
                  {data.turnover.topFactors.slice(0, 4).map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-[#F59E0B]" />
                      <span className="text-xs text-[#555]">{f}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[#999] mt-3">
                  계산일: {new Date(data.turnover.calculatedAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-8 text-sm text-[#999]">
              <Info className="w-4 h-4" /> 데이터 부족 — 재계산을 실행해주세요
            </div>
          )}
        </div>

        {/* 번아웃 */}
        <div className={}>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-[#F59E0B]" />
            <h3 className="text-base font-semibold text-[#1A1A1A]">번아웃 위험도</h3>
            {data.burnout && <RiskBadge level={data.burnout.riskLevel} />}
          </div>
          {data.burnout ? (
            <div className="flex items-center gap-6">
              <ScoreGauge score={data.burnout.overallScore} riskLevel={data.burnout.riskLevel} />
              <div className="flex-1">
                <p className="text-xs text-[#666] mb-2">지표별 현황</p>
                <div className="space-y-2">
                  {(data.burnout.indicators as unknown as Indicator[])
                    .filter((i) => i.available)
                    .slice(0, 4)
                    .map((indicator) => (
                      <div key={indicator.indicator} className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="text-[10px] text-[#666]">{indicator.indicator}</p>
                          <div className="h-1 bg-[#F5F5F5] rounded-full overflow-hidden mt-0.5">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${indicator.score}%`,
                                backgroundColor: indicator.score > 70 ? '#EF4444' : indicator.score > 40 ? '#F59E0B' : '#059669',
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-[#666] w-6">{indicator.score}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-8 text-sm text-[#999]">
              <Info className="w-4 h-4" /> 데이터 부족 — 재계산을 실행해주세요
            </div>
          )}
        </div>
      </div>

      {/* 레이더 차트 + 권고 액션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {radarData.length > 0 && (
          <div className={}>
            <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">이직 위험 신호 레이더</h3>
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
        <div className="bg-white rounded-xl border border-[#E8E8E8]">
          <div className="px-5 py-4 border-b border-[#F5F5F5]">
            <h3 className="text-base font-semibold text-[#1A1A1A]">이직 위험 신호 상세</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>신호</th>
                  <th className={TABLE_STYLES.headerCell}>가중치</th>
                  <th className={TABLE_STYLES.headerCell}>점수</th>
                  <th className={TABLE_STYLES.headerCell}>상태</th>
                  <th className={TABLE_STYLES.headerCell}>원시 데이터</th>
                </tr>
              </thead>
              <tbody>
                {(data.turnover.signals as unknown as Signal[]).map((signal) => (
                  <tr key={signal.signal} className={TABLE_STYLES.header}>
                    <td className="px-4 py-3 text-sm font-medium text-[#1A1A1A]">
                      {SIGNAL_LABELS[signal.signal] ?? signal.signal}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#555]">{Math.round(signal.weight * 100)}%</td>
                    <td className="px-4 py-3">
                      {signal.available ? (
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${signal.score}%`,
                                backgroundColor: signal.score > 70 ? '#EF4444' : signal.score > 40 ? '#F59E0B' : '#059669',
                              }}
                            />
                          </div>
                          <span className="text-xs text-[#666]">{signal.score}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#999]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        signal.available
                          ? 'bg-[#D1FAE5] text-[#047857]'
                          : 'bg-[#FAFAFA] text-[#999]'
                      }`}>
                        {signal.available ? '계산됨' : '데이터 없음'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#666]">
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
