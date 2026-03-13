'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Exit Interview Statistics Client
// E-2: Anonymous exit interview analytics with 5-record threshold
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
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

const REASON_LABELS: Record<string, string> = {
    COMPENSATION: '보상/급여',
    CAREER_GROWTH: '경력 성장',
    WORK_LIFE_BALANCE: '워라밸',
    MANAGEMENT: '경영진/관리',
    CULTURE: '조직 문화',
    RELOCATION: '이전/이주',
    PERSONAL: '개인 사유',
    OTHER: '기타',
}

const REASON_COLORS: Record<string, string> = {
    COMPENSATION: '#EF4444',
    CAREER_GROWTH: '#4F46E5',
    WORK_LIFE_BALANCE: '#22C55E',
    MANAGEMENT: '#F59E0B',
    CULTURE: '#8B5CF6',
    RELOCATION: '#06B6D4',
    PERSONAL: '#8181A5',
    OTHER: '#D1D5DB',
}

// ─── Component ──────────────────────────────────────────────

export function ExitInterviewStatsClient({ user }: { user: SessionUser }) {
    const [stats, setStats] = useState<StatsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchStats = useCallback(async () => {
        setLoading(true)
        try {
            const result = await apiClient.get<StatsData>('/api/v1/offboarding/exit-interviews/statistics')
            setStats(result.data)
        } catch {
            setError('네트워크 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchStats() }, [fetchStats])

    return (
        <div className="space-y-6">
            <PageHeader
                title="퇴직 면담 분석"
                description="익명화된 퇴직 사유 통계 및 조직 건강 지표"
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
                        <ShieldAlert className="w-12 h-12 text-[#8181A5] mx-auto mb-4" />
                        <p className="text-[#8181A5]">{error}</p>
                    </CardContent>
                </Card>
            ) : !stats?.canDisplay ? (
                /* ─── Insufficient Data Guard ──────────────── */
                <Card className="border border-[#F0F0F3]">
                    <CardContent className="py-16 text-center">
                        <ShieldAlert className="w-16 h-16 text-[#8181A5] mx-auto mb-6" />
                        <h3 className="text-xl font-semibold text-[#1C1D21] mb-2">
                            데이터 부족
                        </h3>
                        <p className="text-[#8181A5] max-w-md mx-auto">
                            통계를 생성하려면 최소 <span className="font-bold text-[#4F46E5]">5건</span>의 퇴직 면담이 필요합니다.
                            현재: <span className="font-bold text-[#1C1D21]">{stats?.totalInterviews ?? 0}건</span>
                        </p>
                    </CardContent>
                </Card>
            ) : (
                /* ─── Statistics Dashboard ────────────────── */
                <div className="space-y-6">
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border border-[#F0F0F3]">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-[#4F46E5]/10">
                                        <Users className="w-5 h-5 text-[#4F46E5]" />
                                    </div>
                                    <span className="text-sm text-[#8181A5]">총 면담 건수</span>
                                </div>
                                <p className="text-3xl font-bold text-[#1C1D21]">{stats.totalInterviews}</p>
                            </CardContent>
                        </Card>

                        <Card className="border border-[#F0F0F3]">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-[#F59E0B]/10">
                                        <Star className="w-5 h-5 text-[#F59E0B]" />
                                    </div>
                                    <span className="text-sm text-[#8181A5]">평균 만족도</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-bold text-[#1C1D21]">{stats.avgSatisfaction}</p>
                                    <span className="text-sm text-[#8181A5]">/ 5.0</span>
                                </div>
                                <div className="flex gap-1 mt-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            className={`w-4 h-4 ${star <= (stats.avgSatisfaction ?? 0)
                                                ? 'fill-[#F59E0B] text-[#F59E0B]'
                                                : 'text-[#F0F0F3]'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border border-[#F0F0F3]">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-[#22C55E]/10">
                                        <ThumbsUp className="w-5 h-5 text-[#22C55E]" />
                                    </div>
                                    <span className="text-sm text-[#8181A5]">추천 의향</span>
                                </div>
                                <p className="text-3xl font-bold text-[#1C1D21]">
                                    {stats.wouldRecommend?.percentage ?? 0}%
                                </p>
                                <p className="text-xs text-[#8181A5] mt-1">
                                    예 {stats.wouldRecommend?.yes ?? 0} / 아니오 {stats.wouldRecommend?.no ?? 0}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Reason Breakdown */}
                    <Card className="border border-[#F0F0F3]">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-[#1C1D21]">
                                <BarChart3 className="w-5 h-5 text-[#4F46E5]" />
                                퇴직 사유 분석
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {stats.reasonBreakdown.map((item) => (
                                    <div key={item.reason} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-[#1C1D21]">
                                                {REASON_LABELS[item.reason] ?? item.reason}
                                            </span>
                                            <span className="text-sm text-[#8181A5]">
                                                {item.count}건 ({item.percentage}%)
                                            </span>
                                        </div>
                                        <div className="w-full h-3 bg-[#F5F5FA] rounded-full overflow-hidden">
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
                                <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />
                            )}
                        </CardContent>
                    </Card>

                    {/* Privacy Notice */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-[#4F46E5]/5 rounded-lg border border-[#4F46E5]/20">
                        <ShieldAlert className="w-4 h-4 text-[#4F46E5] flex-shrink-0" />
                        <p className="text-xs text-[#8181A5]">
                            모든 통계는 익명화되어 표시됩니다. 개인 식별 정보는 포함되지 않으며, 5건 미만의 데이터는 통계로 생성되지 않습니다.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
