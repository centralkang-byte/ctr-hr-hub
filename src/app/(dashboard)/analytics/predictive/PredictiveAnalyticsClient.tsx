'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 예측 애널리틱스 대시보드
// 4탭: 이직예측 | 번아웃 | 팀건강 | 인력현황
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  TrendingDown,
  Heart,
  Users,
  RefreshCw,
  Play,
  Loader2,
  ChevronRight,
  Activity,
  Shield,
  Zap,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts'
import { apiClient } from '@/lib/api'
import { AnalyticsPageLayout } from '@/components/analytics/AnalyticsPageLayout'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'

// ─── 타입 ────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

interface TurnoverRiskRow {
  employeeId: string
  employeeName: string
  departmentName: string | null
  jobGradeName: string | null
  latestScore: {
    id: string
    overallScore: number
    riskLevel: RiskLevel
    topFactors: string[]
    calculatedAt: string
  } | null
}

interface BurnoutRow {
  employeeId: string
  employeeName: string
  departmentName: string | null
  latestScore: {
    id: string
    overallScore: number
    riskLevel: RiskLevel
    calculatedAt: string
  } | null
}

interface TeamHealthRow {
  departmentId: string
  departmentName: string
  latestScore: {
    id: string
    overallScore: number
    riskLevel: RiskLevel
    memberCount: number
    metrics: unknown
    calculatedAt: string
  } | null
}

// ─── 상수 ────────────────────────────────────────────────

const TABS = [
  { key: 'turnover', label: '이직 예측', icon: TrendingDown },
  { key: 'burnout', label: '번아웃', icon: Activity },
  { key: 'team', label: '팀 건강', icon: Heart },
  { key: 'workforce', label: '인력 현황', icon: Users },
] as const

type TabKey = (typeof TABS)[number]['key']

const RISK_CONFIG: Record<RiskLevel, { label: string; bg: string; text: string; border: string }> = {
  low:      { label: '낮음', bg: 'bg-[#D1FAE5]', text: 'text-[#047857]', border: 'border-[#A7F3D0]' },
  medium:   { label: '보통', bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', border: 'border-[#FCD34D]' },
  high:     { label: '높음', bg: 'bg-[#FEE2E2]', text: 'text-[#B91C1C]', border: 'border-[#FECACA]' },
  critical: { label: '위험', bg: 'bg-[#FFF7ED]', text: 'text-[#C2410C]', border: 'border-[#FED7AA]' },
}

const RISK_COLORS: Record<RiskLevel, string> = {
  low: '#059669',
  medium: '#F59E0B',
  high: '#EF4444',
  critical: '#C2410C',
}

const CHART_THEME = {
  grid: { stroke: '#F5F5F5', strokeDasharray: '3 3' },
  tooltip: {
    contentStyle: { borderRadius: '8px', border: '1px solid #E8E8E8', boxShadow: '0 4px 16px rgba(15,23,42,0.06)' },
    labelStyle: { fontWeight: 600, color: '#1A1A1A' },
  },
  colors: ['#5E81F4', '#22C55E', '#F59E0B', '#8B5CF6', '#EF4444'],
}

// ─── 헬퍼 ────────────────────────────────────────────────

function RiskBadge({ level }: { level: RiskLevel }) {
  const cfg = RISK_CONFIG[level]
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {cfg.label}
    </span>
  )
}

function ScoreBar({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: RISK_COLORS[level] }}
        />
      </div>
      <span className="text-xs text-[#666] w-8 text-right">{score}</span>
    </div>
  )
}

// ─── KPI 요약 카드 ─────────────────────────────────────

function SummaryCards({
  turnoverData,
  burnoutData,
  teamData,
}: {
  turnoverData: TurnoverRiskRow[]
  burnoutData: BurnoutRow[]
  teamData: TeamHealthRow[]
}) {
  const t = useTranslations('analytics')
  const highTurnover = turnoverData.filter((d) =>
    ['high', 'critical'].includes(d.latestScore?.riskLevel ?? '')
  ).length
  const highBurnout = burnoutData.filter((d) =>
    ['high', 'critical'].includes(d.latestScore?.riskLevel ?? '')
  ).length
  const criticalTeams = teamData.filter((d) =>
    ['high', 'critical'].includes(d.latestScore?.riskLevel ?? '')
  ).length

  const cards = [
    {
      icon: TrendingDown,
      label: 'kr_kec9db4ec_keab3a0ec_kec9db8ec',
      value: highTurnover,
      unit: 'persons',
      color: '#EF4444',
      bg: '#FEE2E2',
    },
    {
      icon: Zap,
      label: 'kr_kebb288ec_keab3a0ec_kec9db8ec',
      value: highBurnout,
      unit: 'persons',
      color: '#F59E0B',
      bg: '#FEF3C7',
    },
    {
      icon: Shield,
      label: 'risk_ked8c80',
      value: criticalTeams,
      unit: 'kr_keab09c',
      color: '#8B5CF6',
      bg: '#EDE9FE',
    },
    {
      icon: Users,
      label: 'analytics_keb8c80ec_kec9db8ec',
      value: turnoverData.length,
      unit: 'persons',
      color: '#059669',
      bg: '#D1FAE5',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg }}>
              <c.icon className="w-5 h-5" style={{ color: c.color }} />
            </div>
            <p className="text-xs text-[#666]">{c.label}</p>
          </div>
          <p className="text-3xl font-bold text-[#1A1A1A]">
            {c.value}
            <span className="text-sm font-normal text-[#999] ml-1">{c.unit}</span>
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── 이직 예측 탭 ─────────────────────────────────────

function TurnoverTab({ data }: { data: TurnoverRiskRow[] }) {
  const t = useTranslations('analytics')
  const chartData = ['critical', 'high', 'medium', 'low'].map((level) => ({
    level: RISK_CONFIG[level as RiskLevel].label,
    count: data.filter((d) => d.latestScore?.riskLevel === level).length,
    fill: RISK_COLORS[level as RiskLevel],
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 분포 차트 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">{'risk_keb8f84_kebb684ed'}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
              <XAxis dataKey="level" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 고위험 Top 5 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">{'kr_keab3a0ec_kec8381ec_5persons'}</h3>
          <div className="space-y-3">
            {data.slice(0, 5).map((row) => (
              <div key={row.employeeId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A1A] truncate">{row.employeeName}</p>
                  <p className="text-xs text-[#666]">{row.departmentName ?? '—'}</p>
                </div>
                {row.latestScore && (
                  <>
                    <RiskBadge level={row.latestScore.riskLevel} />
                    <Link
                      href={`/analytics/predictive/${row.employeeId}`}
                      className="text-[#5E81F4] hover:text-[#4B6DE0]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </>
                )}
              </div>
            ))}
            {data.length === 0 && (
              <p className="text-sm text-[#999] text-center py-8">{'kr_kec8aa4ec_keb8db0ec_kec9786ec'}</p>
            )}
          </div>
        </div>
      </div>

      {/* 전체 목록 */}
      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        <div className="px-5 py-4 border-b border-[#F5F5F5]">
          <h3 className="text-base font-semibold text-[#1A1A1A]">{'kr_kec9db4ec_risk_all_kebaaa9eb'}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}>
              <tr className={TABLE_STYLES.row}>
                <th className={TABLE_STYLES.headerCell}>{'이름'}</th>
                <th className={TABLE_STYLES.headerCell}>{'부서'}</th>
                <th className={TABLE_STYLES.headerCell}>{'직급'}</th>
                <th className={TABLE_STYLES.headerCell}>{'risk_score'}</th>
                <th className={TABLE_STYLES.headerCell}>{'risk_keb8f84'}</th>
                <th className={TABLE_STYLES.headerCell}>{'kr_keca3bcec_kec9a94ec'}</th>
                <th className={TABLE_STYLES.headerCell}></th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.employeeId} className={TABLE_STYLES.row}>
                  <td className={cn(TABLE_STYLES.cell, 'font-medium text-[#1A1A1A]')}>{row.employeeName}</td>
                  <td className={cn(TABLE_STYLES.cell, 'text-[#555]')}>{row.departmentName ?? '—'}</td>
                  <td className={cn(TABLE_STYLES.cell, 'text-[#555]')}>{row.jobGradeName ?? '—'}</td>
                  <td className={TABLE_STYLES.cell}>
                    {row.latestScore ? (
                      <ScoreBar score={row.latestScore.overallScore} level={row.latestScore.riskLevel} />
                    ) : (
                      <span className="text-xs text-[#999]">{'kr_kebafb8ea'}</span>
                    )}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {row.latestScore && <RiskBadge level={row.latestScore.riskLevel} />}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    <div className="flex flex-wrap gap-1">
                      {row.latestScore?.topFactors.slice(0, 2).map((f) => (
                        <span key={f} className="text-xs bg-[#F5F5F5] text-[#555] px-2 py-0.5 rounded">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    <Link
                      href={`/analytics/predictive/${row.employeeId}`}
                      className="text-sm text-[#5E81F4] hover:text-[#4B6DE0] font-medium"
                    >
                      {'analytics'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && (
            <div className="text-center py-12 text-sm text-[#999]">
              {'kr_keb8db0ec_kec9786ec_kebb0b0ec_'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 번아웃 탭 ───────────────────────────────────────

function BurnoutTab({ data }: { data: BurnoutRow[] }) {
  const t = useTranslations('analytics')
  const chartData = ['critical', 'high', 'medium', 'low'].map((level) => ({
    level: RISK_CONFIG[level as RiskLevel].label,
    count: data.filter((d) => d.latestScore?.riskLevel === level).length,
    fill: RISK_COLORS[level as RiskLevel],
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">{'kr_kebb288ec_risk_kebb684ed'}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
              <XAxis dataKey="level" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">{'kr_kebb288ec_keab3a0ec_kec8381ec_'}</h3>
          <div className="space-y-3">
            {data.slice(0, 5).map((row) => (
              <div key={row.employeeId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A1A] truncate">{row.employeeName}</p>
                  <p className="text-xs text-[#666]">{row.departmentName ?? '—'}</p>
                </div>
                {row.latestScore && <RiskBadge level={row.latestScore.riskLevel} />}
              </div>
            ))}
            {data.length === 0 && (
              <p className="text-sm text-[#999] text-center py-8">{'kr_kec8aa4ec_keb8db0ec_kec9786ec'}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        <div className="px-5 py-4 border-b border-[#F5F5F5]">
          <h3 className="text-base font-semibold text-[#1A1A1A]">{'kr_kebb288ec_all_kebaaa9eb'}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}>
              <tr className={TABLE_STYLES.row}>
                <th className={TABLE_STYLES.headerCell}>{'이름'}</th>
                <th className={TABLE_STYLES.headerCell}>{'부서'}</th>
                <th className={TABLE_STYLES.headerCell}>{'kr_kebb288ec_score'}</th>
                <th className={TABLE_STYLES.headerCell}>{'risk_keb8f84'}</th>
                <th className={TABLE_STYLES.headerCell}>{'kr_keab384ec'}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.employeeId} className={TABLE_STYLES.row}>
                  <td className={cn(TABLE_STYLES.cell, 'font-medium text-[#1A1A1A]')}>{row.employeeName}</td>
                  <td className={cn(TABLE_STYLES.cell, 'text-[#555]')}>{row.departmentName ?? '—'}</td>
                  <td className={TABLE_STYLES.cell}>
                    {row.latestScore ? (
                      <ScoreBar score={row.latestScore.overallScore} level={row.latestScore.riskLevel} />
                    ) : (
                      <span className="text-xs text-[#999]">{'kr_kebafb8ea'}</span>
                    )}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {row.latestScore && <RiskBadge level={row.latestScore.riskLevel} />}
                  </td>
                  <td className={cn(TABLE_STYLES.cell, 'text-[#999]')}>
                    {row.latestScore
                      ? new Date(row.latestScore.calculatedAt).toLocaleDateString('ko-KR')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && (
            <div className="text-center py-12 text-sm text-[#999]">
              {'kr_keb8db0ec_kec9786ec_kebb0b0ec_'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 팀 건강 탭 ─────────────────────────────────────

function TeamHealthTab({ data }: { data: TeamHealthRow[] }) {
  const t = useTranslations('analytics')
  const radarData = data.slice(0, 8).map((d) => ({
    team: d.departmentName.slice(0, 6),
    score: 100 - (d.latestScore?.overallScore ?? 0),
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">{'kr_ked8c80eb_keab1b4ea'}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="team" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar dataKey="score" stroke={CHART_THEME.colors[3]} fill={CHART_THEME.colors[3]} fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">{'kr_ked8c80_keab1b4ea_risk_status'}</h3>
          <div className="space-y-3">
            {data
              .filter((d) => ['high', 'critical'].includes(d.latestScore?.riskLevel ?? ''))
              .slice(0, 5)
              .map((d) => (
                <div key={d.departmentId} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1A1A1A]">{d.departmentName}</p>
                    <p className="text-xs text-[#666]">{d.latestScore?.memberCount ?? 0}명</p>
                  </div>
                  {d.latestScore && <RiskBadge level={d.latestScore.riskLevel} />}
                </div>
              ))}
            {data.filter((d) => ['high', 'critical'].includes(d.latestScore?.riskLevel ?? '')).length === 0 && (
              <p className="text-sm text-[#059669] text-center py-8">{'kr_kebaaa8eb_ked8c80ec_keab1b4ea'}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        <div className="px-5 py-4 border-b border-[#F5F5F5]">
          <h3 className="text-base font-semibold text-[#1A1A1A]">{'kr_ked8c80_keab1b4ea_all_status'}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}>
              <tr className={TABLE_STYLES.row}>
                <th className={TABLE_STYLES.headerCell}>{'kr_ked8c80'}</th>
                <th className={TABLE_STYLES.headerCell}>{'kr_kec9db8ec'}</th>
                <th className={TABLE_STYLES.headerCell}>{'kr_keab1b4ea_score'}</th>
                <th className={TABLE_STYLES.headerCell}>{'risk_keb8f84'}</th>
                <th className={TABLE_STYLES.headerCell}>{'kr_keab384ec'}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.departmentId} className={TABLE_STYLES.row}>
                  <td className={cn(TABLE_STYLES.cell, 'font-medium text-[#1A1A1A]')}>{row.departmentName}</td>
                  <td className={cn(TABLE_STYLES.cell, 'text-[#555]')}>{row.latestScore?.memberCount ?? '—'}</td>
                  <td className={TABLE_STYLES.cell}>
                    {row.latestScore ? (
                      <ScoreBar score={row.latestScore.overallScore} level={row.latestScore.riskLevel} />
                    ) : (
                      <span className="text-xs text-[#999]">{'kr_kebafb8ea'}</span>
                    )}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {row.latestScore && <RiskBadge level={row.latestScore.riskLevel} />}
                  </td>
                  <td className={cn(TABLE_STYLES.cell, 'text-[#999]')}>
                    {row.latestScore
                      ? new Date(row.latestScore.calculatedAt).toLocaleDateString('ko-KR')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && (
            <div className="text-center py-12 text-sm text-[#999]">
              {'kr_keb8db0ec_kec9786ec_kebb0b0ec_'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 인력현황 탭 ─────────────────────────────────────

function WorkforceTab({
  turnoverData,
  burnoutData,
}: {
  turnoverData: TurnoverRiskRow[]
  burnoutData: BurnoutRow[]
}) {
  const t = useTranslations('analytics')
  const deptMap: Record<string, { turnoverHigh: number; burnoutHigh: number; total: number }> = {}

  for (const row of turnoverData) {
    const dept = row.departmentName ?? '기타'
    if (!deptMap[dept]) deptMap[dept] = { turnoverHigh: 0, burnoutHigh: 0, total: 0 }
    deptMap[dept].total++
    if (['high', 'critical'].includes(row.latestScore?.riskLevel ?? '')) {
      deptMap[dept].turnoverHigh++
    }
  }

  for (const row of burnoutData) {
    const dept = row.departmentName ?? '기타'
    if (!deptMap[dept]) deptMap[dept] = { turnoverHigh: 0, burnoutHigh: 0, total: 0 }
    if (['high', 'critical'].includes(row.latestScore?.riskLevel ?? '')) {
      deptMap[dept].burnoutHigh++
    }
  }

  const chartData = Object.entries(deptMap)
    .map(([dept, stats]) => ({
      dept: dept.slice(0, 8),
      이직위험: stats.turnoverHigh,
      번아웃위험: stats.burnoutHigh,
    }))
    .sort((a, b) => (b.이직위험 + b.번아웃위험) - (a.이직위험 + a.번아웃위험))

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">{'department_kebb384_risk_kec9db8ec_status'}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 20, left: -20 }}>
            <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
            <XAxis dataKey="dept" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
            <Bar dataKey="이직위험" fill={CHART_THEME.colors[4]} radius={[4, 4, 0, 0]} />
            <Bar dataKey="번아웃위험" fill={CHART_THEME.colors[2]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        <div className="px-5 py-4 border-b border-[#F5F5F5]">
          <h3 className="text-base font-semibold text-[#1A1A1A]">{'department_kebb384_integrations_status'}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}>
              <tr className={TABLE_STYLES.row}>
                <th className={TABLE_STYLES.headerCell}>{'부서'}</th>
                <th className={TABLE_STYLES.headerCell}>{'analytics_kec9db8ec'}</th>
                <th className={TABLE_STYLES.headerCell}>{'kr_kec9db4ec_keab3a0ec'}</th>
                <th className={TABLE_STYLES.headerCell}>{'kr_kebb288ec_keab3a0ec'}</th>
                <th className={TABLE_STYLES.headerCell}>{'risk_keba5a0'}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(deptMap).map(([dept, stats]) => {
                const riskRate = stats.total > 0 ? Math.round(((stats.turnoverHigh + stats.burnoutHigh) / (stats.total * 2)) * 100) : 0
                return (
                  <tr key={dept} className={TABLE_STYLES.row}>
                    <td className={cn(TABLE_STYLES.cell, 'font-medium text-[#1A1A1A]')}>{dept}</td>
                    <td className={cn(TABLE_STYLES.cell, 'text-[#555]')}>{stats.total}</td>
                    <td className={cn(TABLE_STYLES.cell, 'text-[#B91C1C]')}>{stats.turnoverHigh}</td>
                    <td className={cn(TABLE_STYLES.cell, 'text-[#B45309]')}>{stats.burnoutHigh}</td>
                    <td className={TABLE_STYLES.cell}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${riskRate}%`,
                              backgroundColor: riskRate > 50 ? '#EF4444' : riskRate > 25 ? '#F59E0B' : '#059669',
                            }}
                          />
                        </div>
                        <span className="text-xs text-[#666]">{riskRate}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {Object.keys(deptMap).length === 0 && (
            <div className="text-center py-12 text-sm text-[#999]">
              {'kr_keb8db0ec_kec9786ec_kebb0b0ec_'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────

export default function PredictiveAnalyticsClient() {
  const tCommon = useTranslations('common')
  const t = useTranslations('analytics')

  const searchParams = useSearchParams()
  const router = useRouter()
  const companyId = searchParams.get('company_id') ?? undefined

  const [activeTab, setActiveTab] = useState<TabKey>('turnover')
  const [turnoverData, setTurnoverData] = useState<TurnoverRiskRow[]>([])
  const [burnoutData, setBurnoutData] = useState<BurnoutRow[]>([])
  const [teamData, setTeamData] = useState<TeamHealthRow[]>([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [tr, bn, th] = await Promise.all([
        apiClient.get<TurnoverRiskRow[]>('/api/v1/analytics/turnover-risk', { company_id: companyId }),
        apiClient.get<BurnoutRow[]>('/api/v1/analytics/burnout', { company_id: companyId }),
        apiClient.get<TeamHealthRow[]>('/api/v1/analytics/team-health-scores', { company_id: companyId }),
      ])
      setTurnoverData(tr.data ?? [])
      setBurnoutData(bn.data ?? [])
      setTeamData(th.data ?? [])
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleCalculate = async () => {
    setCalculating(true)
    try {
      await fetch('/api/v1/analytics/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId }),
      })
      await fetchAll()
    } catch {
      // silently handle
    } finally {
      setCalculating(false)
    }
  }

  return (
    <AnalyticsPageLayout
      title="예측 애널리틱스"
      description="이직 위험, 번아웃, 팀 심리안전 지수를 AI 기반으로 분석합니다"
    >
      {/* 액션 버튼 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#B45309]" />
          <span className="text-sm text-[#666]">{t('kr_hr_admin_keca084ec_keca781ec_k')}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#555] hover:bg-[#FAFAFA]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('kr_kec8388eb')}
          </button>
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className={`flex items-center gap-2 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}
          >
            {calculating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {calculating ? '계산 중...' : '배치 계산 실행'}
          </button>
        </div>
      </div>

      {/* KPI 카드 */}
      {!loading && (
        <SummaryCards turnoverData={turnoverData} burnoutData={burnoutData} teamData={teamData} />
      )}

      {/* 탭 */}
      <div className="flex border-b border-[#E8E8E8] mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#5E81F4] text-[#5E81F4]'
                : 'border-transparent text-[#666] hover:text-[#333]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#999]" />
        </div>
      ) : (
        <>
          {activeTab === 'turnover' && <TurnoverTab data={turnoverData} />}
          {activeTab === 'burnout' && <BurnoutTab data={burnoutData} />}
          {activeTab === 'team' && <TeamHealthTab data={teamData} />}
          {activeTab === 'workforce' && (
            <WorkforceTab turnoverData={turnoverData} burnoutData={burnoutData} />
          )}
        </>
      )}
    </AnalyticsPageLayout>
  )
}
