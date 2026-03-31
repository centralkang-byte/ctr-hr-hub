'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 성장 여정 시각화 (Performance Growth Journey)
// 과거 사이클 대비 MBO/BEI/종합 점수 추이 라인 차트
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react'
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { CHART_THEME } from '@/lib/styles/chart'

// ─── Types ────────────────────────────────────────────────

interface HistoryPoint {
    cycleId: string
    cycleName: string
    year: number
    half: string
    label: string
    mboScore: number | null
    beiScore: number | null
    totalScore: number | null
    finalGrade: string | null
    finalGradeLabel: string | null
}

// ─── Constants ────────────────────────────────────────────

const GRADE_ORDER = ['BELOW_MINUS', 'BELOW', 'MEETS', 'MEETS_PLUS', 'EXCEEDS', 'EXCEEDS_PLUS']

// ─── Component ────────────────────────────────────────────

export default function GrowthJourneyChart() {
    const t = useTranslations('performance')
    const [history, setHistory] = useState<HistoryPoint[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const res = await apiClient.get<HistoryPoint[]>('/api/v1/performance/reviews/my-history')
                setHistory(res.data)
            } catch {
                toast({ title: '성과 이력 로드 실패', variant: 'destructive' })
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    if (loading) {
        return (
            <div className="animate-pulse rounded-2xl bg-card p-6">
                <div className="mb-4 h-5 w-1/3 rounded bg-muted" />
                <div className="h-[240px] rounded bg-muted" />
            </div>
        )
    }

    // 2개 이상 사이클이 있어야 추이 의미 있음
    if (history.length < 2) return null

    const latest = history[history.length - 1]
    const prev = history[history.length - 2]
    const scoreDiff = (latest.totalScore ?? 0) - (prev.totalScore ?? 0)
    const gradeDiff = latest.finalGrade && prev.finalGrade
        ? GRADE_ORDER.indexOf(latest.finalGrade) - GRADE_ORDER.indexOf(prev.finalGrade)
        : 0

    const TrendIcon = scoreDiff > 0.1 ? TrendingUp : scoreDiff < -0.1 ? TrendingDown : Minus
    const trendColor = scoreDiff > 0.1 ? 'text-tertiary' : scoreDiff < -0.1 ? 'text-destructive' : 'text-muted-foreground'

    const chartData = history.map((h) => ({
        label: h.label,
        MBO: h.mboScore,
        BEI: h.beiScore,
        종합: h.totalScore,
    }))

    return (
        <div className="rounded-2xl bg-card p-6">
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold text-foreground">{t('growthJourney') || '성장 여정'}</h2>
                </div>
                <div className="flex items-center gap-1.5">
                    <TrendIcon className={`h-4 w-4 ${trendColor}`} />
                    <span className={`text-sm font-medium ${trendColor}`}>
                        {scoreDiff > 0 ? '+' : ''}{scoreDiff.toFixed(2)}
                    </span>
                    {gradeDiff !== 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                            ({gradeDiff > 0 ? '등급 ↑' : '등급 ↓'})
                        </span>
                    )}
                </div>
            </div>

            {/* Chart */}
            <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid {...CHART_THEME.grid} />
                        <XAxis
                            dataKey="label"
                            {...CHART_THEME.axis}
                            tick={{ ...CHART_THEME.axis.tick }}
                        />
                        <YAxis
                            domain={[0, 5]}
                            ticks={[1, 2, 3, 4, 5]}
                            {...CHART_THEME.axis}
                            tick={{ ...CHART_THEME.axis.tick }}
                        />
                        <Tooltip
                            contentStyle={CHART_THEME.tooltip.contentStyle}
                            labelStyle={CHART_THEME.tooltip.labelStyle}
                            formatter={(value) => [typeof value === 'number' ? value.toFixed(2) : '-', '']}
                        />
                        <Legend wrapperStyle={CHART_THEME.legend.wrapperStyle} />
                        <ReferenceLine y={3} stroke={CHART_THEME.colors[5]} strokeDasharray="3 3" label="" />
                        <Line
                            type="monotone" dataKey="MBO" name="MBO"
                            stroke={CHART_THEME.colors[0]} strokeWidth={2}
                            dot={{ r: 4, fill: CHART_THEME.colors[0] }}
                            activeDot={{ r: 6 }}
                            connectNulls
                        />
                        <Line
                            type="monotone" dataKey="BEI" name="BEI"
                            stroke={CHART_THEME.colors[2]} strokeWidth={2}
                            dot={{ r: 4, fill: CHART_THEME.colors[2] }}
                            activeDot={{ r: 6 }}
                            connectNulls
                        />
                        <Line
                            type="monotone" dataKey="종합" name={t('totalScore') || '종합'}
                            stroke={CHART_THEME.colors[1]} strokeWidth={2.5}
                            dot={{ r: 5, fill: CHART_THEME.colors[1] }}
                            activeDot={{ r: 7 }}
                            connectNulls
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Grade timeline */}
            <div className="mt-4 flex items-center gap-2 overflow-x-auto">
                {history.map((h, i) => (
                    <div key={h.cycleId} className="flex shrink-0 flex-col items-center gap-1">
                        <span className="text-[11px] text-muted-foreground">{h.label}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            h.finalGradeLabel
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                        }`}>
                            {h.finalGradeLabel ?? '-'}
                        </span>
                        {i < history.length - 1 && (
                            <div className="h-px w-6 bg-border" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
