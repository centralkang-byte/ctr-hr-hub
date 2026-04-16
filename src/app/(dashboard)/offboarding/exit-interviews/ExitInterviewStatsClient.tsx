'use client'

import { EmptyState } from '@/components/ui/EmptyState'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Exit Interview Statistics Client
// E-2: Anonymous exit interview analytics with 5-record threshold
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import {
    BarChart3,
    Users,
    Star,
    ThumbsUp,
    ShieldAlert,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────

interface ReasonBreakdown {
    reason: string
    count: number
    percentage: number
}

interface StatsData {
    canDisplay: boolean
    totalInterviews: number
    reasonBreakdown: ReasonBreakdown[]
    avgSatisfaction: number | null
    wouldRecommend: {
        yes: number
        no: number
        percentage: number
    } | null
}

const REASON_LABEL_KEYS: Record<string, string> = {
    COMPENSATION: 'reasonCompensation',
    CAREER_GROWTH: 'reasonCareerGrowth',
    WORK_LIFE_BALANCE: 'reasonWorkLifeBalance',
    MANAGEMENT: 'reasonManagement',
    CULTURE: 'reasonCulture',
    RELOCATION: 'reasonRelocation',
    PERSONAL: 'reasonPersonal',
    OTHER: 'reasonOther',
}

const REASON_COLORS: Record<string, string> = {
    COMPENSATION: '#EF4444',
    CAREER_GROWTH: '#5E81F4',
    WORK_LIFE_BALANCE: '#22C55E',
    MANAGEMENT: '#F59E0B',
    CULTURE: '#8B5CF6',
    RELOCATION: '#06B6D4',
    PERSONAL: '#8181A5',
    OTHER: '#D1D5DB',
}

// ─── Component ──────────────────────────────────────────────

export function ExitInterviewStatsClient({ user: _user }: { user: SessionUser }) {
    const t = useTranslations('offboarding')
    const [stats, setStats] = useState<StatsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchStats = useCallback(async () => {
        setLoading(true)
        try {
            const result = await apiClient.get<StatsData>('/api/v1/offboarding/exit-interviews/statistics')
            setStats(result.data)
        } catch {
            setError(t('loadFailed'))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchStats() }, [fetchStats])

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('exitInterviewStatsTitle')}
                description={t('exitInterviewStatsDesc')}
            />

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <CardContent className="p-6">
                                <Skeleton className="h-8 w-24 mb-2" />
                                <Skeleton className="h-12 w-16" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : error ? (
                <Card>
                    <CardContent className="p-8 text-center">
                        <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">{error}</p>
                    </CardContent>
                </Card>
            ) : !stats?.canDisplay ? (
                /* ─── Insufficient Data Guard ──────────────── */
                <Card className="border border-border">
                    <CardContent className="py-16 text-center">
                        <ShieldAlert className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
                        <h3 className="text-xl font-semibold text-foreground mb-2">
                            {t('exitInterview.insufficientData')}
                        </h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            {t('exitInterview.insufficientDataDesc', { min: 5, current: stats?.totalInterviews ?? 0 })}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                /* ─── Statistics Dashboard ────────────────── */
                <div className="space-y-6">
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border border-border">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <Users className="w-5 h-5 text-primary" />
                                    </div>
                                    <span className="text-sm text-muted-foreground">{t('totalInterviews')}</span>
                                </div>
                                <p className="text-3xl font-bold text-foreground">{stats.totalInterviews}</p>
                            </CardContent>
                        </Card>

                        <Card className="border border-border">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-amber-500/100/10">
                                        <Star className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <span className="text-sm text-muted-foreground">{t('avgSatisfaction')}</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-bold text-foreground">{stats.avgSatisfaction}</p>
                                    <span className="text-sm text-muted-foreground">/ 5.0</span>
                                </div>
                                <div className="flex gap-1 mt-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            className={`w-4 h-4 ${star <= (stats.avgSatisfaction ?? 0)
                                                ? 'fill-amber-500 text-amber-500'
                                                : 'text-border'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border border-border">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-tertiary-container/100/10">
                                        <ThumbsUp className="w-5 h-5 text-green-500" />
                                    </div>
                                    <span className="text-sm text-muted-foreground">{t('recommendRate')}</span>
                                </div>
                                <p className="text-3xl font-bold text-foreground">
                                    {stats.wouldRecommend?.percentage ?? 0}%
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t('wouldRecommendYes')} {stats.wouldRecommend?.yes ?? 0} / {t('wouldRecommendNo')} {stats.wouldRecommend?.no ?? 0}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Reason Breakdown */}
                    <Card className="border border-border">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-foreground">
                                <BarChart3 className="w-5 h-5 text-primary" />
                                {t('reasonAnalysis')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {stats.reasonBreakdown.map((item) => (
                                    <div key={item.reason} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-foreground">
                                                {REASON_LABEL_KEYS[item.reason] ? t(REASON_LABEL_KEYS[item.reason]) : item.reason}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                {item.count} ({item.percentage}%)
                                            </span>
                                        </div>
                                        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500 ease-out"
                                                style={{
                                                    width: `${item.percentage}%`,
                                                    backgroundColor: REASON_COLORS[item.reason] ?? '#8181A5',
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {stats.reasonBreakdown.length === 0 && (
                                <EmptyState />
                            )}
                        </CardContent>
                    </Card>

                    {/* Privacy Notice */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-primary/5 rounded-lg border border-primary/20">
                        <ShieldAlert className="w-4 h-4 text-primary flex-shrink-0" />
                        <p className="text-xs text-muted-foreground">
                            {t('exitInterviewPrivacyFull')}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
