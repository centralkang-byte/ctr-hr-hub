'use client'

import { useTranslations } from 'next-intl'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 예측 애널리틱스 대시보드
// 4탭: 이직예측 | 번아웃 | 팀건강 | 인력현황
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
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
import { CHART_THEME, RISK_COLORS } from '@/lib/styles/chart'
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
  { key: 'turnover', labelKey: 'predictive.tabs.turnover', icon: TrendingDown },
  { key: 'burnout', labelKey: 'predictive.tabs.burnout', icon: Activity },
  { key: 'team', labelKey: 'predictive.tabs.teamHealth', icon: Heart },
  { key: 'workforce', labelKey: 'predictive.tabs.workforce', icon: Users },
] as const

type TabKey = (typeof TABS)[number]['key']

const RISK_CONFIG: Record<RiskLevel, { labelKey: string; bg: string; text: string; border: string }> = {
  low:      { labelKey: 'predictive.riskLevels.low', bg: 'bg-emerald-500/15', text: 'text-emerald-700', border: 'border-emerald-200' },
  medium:   { labelKey: 'predictive.riskLevels.medium', bg: 'bg-amber-500/15', text: 'text-amber-700', border: 'border-amber-300' },
  high:     { labelKey: 'predictive.riskLevels.high', bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20' },
  critical: { labelKey: 'predictive.riskLevels.critical', bg: 'bg-orange-500/10', text: 'text-orange-700', border: 'border-orange-200' },
}


// ─── 헬퍼 ────────────────────────────────────────────────

function RiskBadge({ level }: { level: RiskLevel }) {
  const t = useTranslations('analytics')
  const cfg = RISK_CONFIG[level]
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {t(cfg.labelKey)}
    </span>
  )
}

function ScoreBar({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: RISK_COLORS[level] }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{score}</span>
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
      label: t('predictive.summary.turnoverHighRisk'),
      value: highTurnover,
      unit: t('predictive.summary.persons'),
      color: RISK_COLORS.high,
      bg: '#FEE2E2',
    },
    {
      icon: Zap,
      label: t('predictive.summary.burnoutHighRisk'),
      value: highBurnout,
      unit: t('predictive.summary.persons'),
      color: RISK_COLORS.medium,
      bg: '#FEF3C7',
    },
    {
      icon: Shield,
      label: t('predictive.summary.riskTeams'),
      value: criticalTeams,
      unit: t('predictive.summary.teams'),
      color: CHART_THEME.colors[3],
      bg: '#EDE9FE',
    },
    {
      icon: Users,
      label: t('predictive.summary.totalAnalyzed'),
      value: turnoverData.length,
      unit: t('predictive.summary.persons'),
      color: RISK_COLORS.low,
      bg: '#D1FAE5',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg }}>
              <c.icon className="w-5 h-5" style={{ color: c.color }} />
            </div>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {c.value}
            <span className="text-sm font-normal text-muted-foreground ml-1">{c.unit}</span>
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
    level: t(RISK_CONFIG[level as RiskLevel].labelKey),
    count: data.filter((d) => d.latestScore?.riskLevel === level).length,
    fill: RISK_COLORS[level as RiskLevel],
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 분포 차트 */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">{t('predictive.turnover.riskDistribution')}</h3>
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
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">{t('predictive.turnover.highRiskTop5')}</h3>
          <div className="space-y-3">
            {data.slice(0, 5).map((row) => (
              <div key={row.employeeId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{row.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{row.departmentName ?? '—'}</p>
                </div>
                {row.latestScore && (
                  <>
                    <RiskBadge level={row.latestScore.riskLevel} />
                    <Link
                      href={`/analytics/predictive/${row.employeeId}`}
                      className="text-primary hover:text-primary/90"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </>
                )}
              </div>
            ))}
            {data.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t('predictive.noCalculationData')}</p>
            )}
          </div>
        </div>
      </div>

      {/* 전체 목록 */}
      <div className="bg-card rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">{t('predictive.turnover.allList')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}>
              <tr className={TABLE_STYLES.row}>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.table.name')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.table.department')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.table.grade')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.table.riskScore')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.table.riskLevel')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.table.topFactors')}</th>
                <th className={TABLE_STYLES.headerCell}></th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.employeeId} className={TABLE_STYLES.row}>
                  <td className={cn(TABLE_STYLES.cell, 'font-medium text-foreground')}>{row.employeeName}</td>
                  <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground')}>{row.departmentName ?? '—'}</td>
                  <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground')}>{row.jobGradeName ?? '—'}</td>
                  <td className={TABLE_STYLES.cell}>
                    {row.latestScore ? (
                      <ScoreBar score={row.latestScore.overallScore} level={row.latestScore.riskLevel} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('predictive.noScore')}</span>
                    )}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {row.latestScore && <RiskBadge level={row.latestScore.riskLevel} />}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    <div className="flex flex-wrap gap-1">
                      {row.latestScore?.topFactors.slice(0, 2).map((f) => (
                        <span key={f} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    <Link
                      href={`/analytics/predictive/${row.employeeId}`}
                      className="text-sm text-primary hover:text-primary/90 font-medium"
                    >
                      {t('predictive.viewDetail')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {t('predictive.noData')}
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
    level: t(RISK_CONFIG[level as RiskLevel].labelKey),
    count: data.filter((d) => d.latestScore?.riskLevel === level).length,
    fill: RISK_COLORS[level as RiskLevel],
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">{t('predictive.burnout.riskDistribution')}</h3>
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

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">{t('predictive.burnout.highRiskTop5')}</h3>
          <div className="space-y-3">
            {data.slice(0, 5).map((row) => (
              <div key={row.employeeId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{row.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{row.departmentName ?? '—'}</p>
                </div>
                {row.latestScore && <RiskBadge level={row.latestScore.riskLevel} />}
              </div>
            ))}
            {data.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t('predictive.noCalculationData')}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">{t('predictive.burnout.allList')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}>
              <tr className={TABLE_STYLES.row}>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.table.name')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.table.department')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.burnout.score')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.table.riskLevel')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.table.calculatedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.employeeId} className={TABLE_STYLES.row}>
                  <td className={cn(TABLE_STYLES.cell, 'font-medium text-foreground')}>{row.employeeName}</td>
                  <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground')}>{row.departmentName ?? '—'}</td>
                  <td className={TABLE_STYLES.cell}>
                    {row.latestScore ? (
                      <ScoreBar score={row.latestScore.overallScore} level={row.latestScore.riskLevel} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('predictive.noScore')}</span>
                    )}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {row.latestScore && <RiskBadge level={row.latestScore.riskLevel} />}
                  </td>
                  <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground')}>
                    {row.latestScore
                      ? new Date(row.latestScore.calculatedAt).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {t('predictive.noData')}
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
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">{t('predictive.teamHealth.healthRadar')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="team" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar dataKey="score" stroke={CHART_THEME.colors[3]} fill={CHART_THEME.colors[3]} fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">{t('predictive.teamHealth.riskStatus')}</h3>
          <div className="space-y-3">
            {data
              .filter((d) => ['high', 'critical'].includes(d.latestScore?.riskLevel ?? ''))
              .slice(0, 5)
              .map((d) => (
                <div key={d.departmentId} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{d.departmentName}</p>
                    <p className="text-xs text-muted-foreground">{t('predictive.teamHealth.memberCount', { count: d.latestScore?.memberCount ?? 0 })}</p>
                  </div>
                  {d.latestScore && <RiskBadge level={d.latestScore.riskLevel} />}
                </div>
              ))}
            {data.filter((d) => ['high', 'critical'].includes(d.latestScore?.riskLevel ?? '')).length === 0 && (
              <p className="text-sm text-emerald-600 text-center py-8">{t('predictive.teamHealth.allHealthy')}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">{t('predictive.teamHealth.allStatus')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}>
              <tr className={TABLE_STYLES.row}>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.teamHealth.team')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.teamHealth.members')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.teamHealth.healthScore')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.table.riskLevel')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.table.calculatedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.departmentId} className={TABLE_STYLES.row}>
                  <td className={cn(TABLE_STYLES.cell, 'font-medium text-foreground')}>{row.departmentName}</td>
                  <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground')}>{row.latestScore?.memberCount ?? '—'}</td>
                  <td className={TABLE_STYLES.cell}>
                    {row.latestScore ? (
                      <ScoreBar score={row.latestScore.overallScore} level={row.latestScore.riskLevel} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('predictive.noScore')}</span>
                    )}
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    {row.latestScore && <RiskBadge level={row.latestScore.riskLevel} />}
                  </td>
                  <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground')}>
                    {row.latestScore
                      ? new Date(row.latestScore.calculatedAt).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {t('predictive.noData')}
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
    const dept = row.departmentName ?? t('predictive.workforce.other')
    if (!deptMap[dept]) deptMap[dept] = { turnoverHigh: 0, burnoutHigh: 0, total: 0 }
    deptMap[dept].total++
    if (['high', 'critical'].includes(row.latestScore?.riskLevel ?? '')) {
      deptMap[dept].turnoverHigh++
    }
  }

  for (const row of burnoutData) {
    const dept = row.departmentName ?? t('predictive.workforce.other')
    if (!deptMap[dept]) deptMap[dept] = { turnoverHigh: 0, burnoutHigh: 0, total: 0 }
    if (['high', 'critical'].includes(row.latestScore?.riskLevel ?? '')) {
      deptMap[dept].burnoutHigh++
    }
  }

  const chartData = Object.entries(deptMap)
    .map(([dept, stats]) => ({
      dept: dept.slice(0, 8),
      turnoverRisk: stats.turnoverHigh,
      burnoutRisk: stats.burnoutHigh,
    }))
    .sort((a, b) => (b.turnoverRisk + b.burnoutRisk) - (a.turnoverRisk + a.burnoutRisk))

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">{t('predictive.workforce.deptRiskChart')}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 20, left: -20 }}>
            <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
            <XAxis dataKey="dept" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
            <Bar dataKey="turnoverRisk" name={t('predictive.workforce.turnoverRisk')} fill={CHART_THEME.colors[4]} radius={[4, 4, 0, 0]} />
            <Bar dataKey="burnoutRisk" name={t('predictive.workforce.burnoutRisk')} fill={CHART_THEME.colors[2]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">{t('predictive.workforce.deptIntegratedStatus')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}>
              <tr className={TABLE_STYLES.row}>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.table.department')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.workforce.headcount')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.workforce.turnoverHighRisk')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.workforce.burnoutHighRisk')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('predictive.workforce.riskRate')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(deptMap).map(([dept, stats]) => {
                const riskRate = stats.total > 0 ? Math.round(((stats.turnoverHigh + stats.burnoutHigh) / (stats.total * 2)) * 100) : 0
                return (
                  <tr key={dept} className={TABLE_STYLES.row}>
                    <td className={cn(TABLE_STYLES.cell, 'font-medium text-foreground')}>{dept}</td>
                    <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground')}>{stats.total}</td>
                    <td className={cn(TABLE_STYLES.cell, 'text-destructive')}>{stats.turnoverHigh}</td>
                    <td className={cn(TABLE_STYLES.cell, 'text-amber-700')}>{stats.burnoutHigh}</td>
                    <td className={TABLE_STYLES.cell}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${riskRate}%`,
                              backgroundColor: riskRate > 50 ? RISK_COLORS.high : riskRate > 25 ? RISK_COLORS.medium : RISK_COLORS.low,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{riskRate}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {Object.keys(deptMap).length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {t('predictive.noData')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────

export default function PredictiveAnalyticsClient() {
  const t = useTranslations('analytics')

  const searchParams = useSearchParams()
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
      title={t('predictive.pageTitle')}
      description={t('predictive.pageDescription')}
    >
      {/* 액션 버튼 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700" />
          <span className="text-sm text-muted-foreground">{t('predictive.hrAdminOnly')}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-background"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('predictive.refresh')}
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
            {calculating ? t('predictive.calculating') : t('predictive.runBatchCalc')}
          </button>
        </div>
      </div>

      {/* KPI 카드 */}
      {!loading && (
        <SummaryCards turnoverData={turnoverData} burnoutData={burnoutData} teamData={teamData} />
      )}

      {/* 탭 */}
      <div className="flex border-b border-border mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
