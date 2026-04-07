'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Task Summary Card
// Dashboard compact card: task counts + CTA to /my/tasks
// Replaces UnifiedTaskHub on Home pages
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
    ListChecks,
    CalendarDays,
    Target,
    ClipboardCheck,
    ArrowRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import type { UnifiedTaskListResponse } from '@/lib/unified-task/types'
import { UnifiedTaskType } from '@/lib/unified-task/types'

// ─── Types ──────────────────────────────────────────────────

interface Props {
    user: SessionUser
}

// ─── Component ──────────────────────────────────────────────

export function TaskSummaryCard({ user }: Props) {
    const t = useTranslations('myTasks')
    const isManager = user.role !== 'EMPLOYEE'

    const [counts, setCounts] = useState<Partial<Record<string, number>>>({})
    const [approvalCount, setApprovalCount] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [loading, setLoading] = useState(true)

    const fetchCounts = useCallback(async () => {
        try {
            // Fetch task counts (pending only)
            const res = await apiClient.get<UnifiedTaskListResponse>(
                '/api/v1/unified-tasks?statuses=PENDING,IN_PROGRESS&limit=1',
            )
            setCounts(res.data.countByType)
            setTotalCount(res.data.total)

            // Fetch approval counts for managers
            if (isManager) {
                const approvalRes = await apiClient.get<UnifiedTaskListResponse>(
                    '/api/v1/unified-tasks?mode=approvals&limit=1',
                )
                setApprovalCount(approvalRes.data.total)
            }
        } catch {
            // keep defaults
        } finally {
            setLoading(false)
        }
    }, [isManager])

    useEffect(() => {
        void fetchCounts()
    }, [fetchCounts])

    const TYPE_BADGES = [
        { type: UnifiedTaskType.LEAVE_APPROVAL, icon: CalendarDays, label: t('typeLeave'), color: '#818CF8' },
        { type: UnifiedTaskType.PERFORMANCE_REVIEW, icon: Target, label: t('typePerformance'), color: '#8B5CF6' },
        { type: UnifiedTaskType.ONBOARDING_TASK, icon: ClipboardCheck, label: t('typeOnboarding'), color: '#10B981' },
    ]

    if (loading) {
        return (
            <Card className="shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (totalCount === 0 && approvalCount === 0) {
        return (
            <Card className="shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <ListChecks className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{t('title')}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{t('emptyNoTasksDesc')}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="shadow-sm">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <ListChecks className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">{t('title')}</p>
                                <Badge className="h-5 rounded-full bg-primary px-2 text-[10px] font-bold text-white">
                                    {totalCount}
                                </Badge>
                            </div>
                            {isManager && approvalCount > 0 && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {t('tabApprovals')}: {approvalCount}
                                </p>
                            )}
                        </div>
                    </div>
                    <Link
                        href="/my/tasks"
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                        {t('viewAll')}
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>

                {/* Type breakdown badges */}
                <div className="mt-4 flex flex-wrap gap-2">
                    {TYPE_BADGES.map(({ type, icon: Icon, label, color }) => {
                        const count = counts[type] ?? 0
                        if (count === 0) return null
                        return (
                            <div
                                key={type}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                                style={{ backgroundColor: `${color}10` }}
                            >
                                <Icon className="h-3.5 w-3.5" style={{ color }} />
                                <span className="text-xs font-medium" style={{ color }}>{label}</span>
                                <span className="ml-0.5 text-xs font-bold" style={{ color }}>{count}</span>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
