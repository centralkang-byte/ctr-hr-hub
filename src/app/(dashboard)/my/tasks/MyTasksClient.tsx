'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Unified Task Hub (Full Page)
// /my/tasks — "나의 업무" 전체 페이지
// URL state sync, type/status filter, sort, pagination
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
    CalendarDays,
    Target,
    ClipboardCheck,
    Clock,
    DoorOpen,
    CheckCircle2,
    XCircle,
    ExternalLink,
    Loader2,
    ListChecks,
    PartyPopper,
    ArrowUpDown,
    Info,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import {
    UnifiedTaskType,
    UnifiedTaskStatus,
    UnifiedTaskPriority,
} from '@/lib/unified-task/types'
import type { UnifiedTask, UnifiedTaskListResponse } from '@/lib/unified-task/types'

// ─── Helpers ─────────────────────────────────────────────

function getDday(dueDate?: string): string | null {
    if (!dueDate) return null
    const diff = Math.ceil(
        (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    )
    if (diff < 0) return `D+${Math.abs(diff)}`
    if (diff === 0) return 'D-Day'
    return `D-${diff}`
}

function getDdayStyle(dueDate?: string): string {
    if (!dueDate) return ''
    const diff = Math.ceil(
        (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    )
    if (diff < 0) return 'bg-destructive/10 text-destructive border-destructive/20'
    if (diff <= 3) return 'bg-amber-500/15 text-amber-700 border-amber-300'
    return 'bg-primary/10 text-primary border-indigo-200'
}

// ─── Task Card ───────────────────────────────────────────

function UnifiedTaskCard({
    task,
    user,
    onAction,
    processing,
    typeConfig,
    priorityConfig,
}: {
    task: UnifiedTask
    user: SessionUser
    onAction: (taskId: string, action: 'approve' | 'reject', sourceId: string) => void
    processing: string | null
    typeConfig: Record<string, { label: string; color: string; icon: React.ElementType }>
    priorityConfig: Record<string, { color: string; bg: string; label: string }>
}) {
    const t = useTranslations('myTasks')
    const typeInfo = typeConfig[task.type]
    const prioInfo = priorityConfig[task.priority]
    const Icon = typeInfo?.icon ?? ListChecks
    const dday = getDday(task.dueDate)
    const ddayStyle = getDdayStyle(task.dueDate)
    const isLeave = task.type === UnifiedTaskType.LEAVE_APPROVAL
    const canInlineApprove = isLeave && user.role !== 'EMPLOYEE'
    const isPending = task.status === UnifiedTaskStatus.PENDING || task.status === UnifiedTaskStatus.IN_PROGRESS
    const isBusy = processing === task.id
    const isBlocked = !!(task.metadata as Record<string, unknown>)?.isBlocked

    let borderStyle = 'border border-border'
    if (task.priority === UnifiedTaskPriority.URGENT) borderStyle = 'border border-destructive/20 border-l-4 border-l-[#EF4444]'
    else if (task.priority === UnifiedTaskPriority.HIGH) borderStyle = 'border border-amber-300 border-l-4 border-l-[#F59E0B]'

    return (
        <div
            className={`group rounded-xl bg-card p-4 transition-all duration-150 hover:shadow-md ${borderStyle}`}
        >
            <div className="flex items-start gap-3">
                {/* Priority dot */}
                <div className="mt-1.5 flex flex-col items-center gap-1">
                    <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: prioInfo?.color ?? '#5E81F4' }}
                    />
                </div>

                {/* Type Icon */}
                <div
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${typeInfo?.color ?? '#5E81F4'}15` }}
                >
                    <Icon className="h-4.5 w-4.5" style={{ color: typeInfo?.color ?? '#5E81F4' }} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            className="h-5 shrink-0 rounded-md border px-1.5 text-[10px] font-medium"
                            style={{
                                borderColor: `${typeInfo?.color ?? '#5E81F4'}40`,
                                color: typeInfo?.color ?? '#5E81F4',
                                backgroundColor: `${typeInfo?.color ?? '#5E81F4'}08`,
                            }}
                        >
                            {typeInfo?.label ?? task.type}
                        </Badge>
                        {isBlocked && (
                            <Badge variant="destructive" className="h-5 rounded-md px-1.5 text-[10px]">
                                BLOCKED
                            </Badge>
                        )}
                        {!!(task.metadata as Record<string, unknown>)?.delegated && (
                            <Badge
                                variant="outline"
                                className="h-5 rounded-md border-indigo-200 bg-primary/10 px-1.5 text-[10px] font-medium text-violet-500"
                            >
                                {t('delegated')}
                            </Badge>
                        )}
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground line-clamp-1">
                        {task.title}
                    </p>
                    {task.summary && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                            {task.summary}
                        </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{task.requester?.name}</span>
                        {task.requester?.department && (
                            <>
                                <span className="opacity-40">·</span>
                                <span>{task.requester.department}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Right side: D-day + Actions */}
                <div className="flex shrink-0 flex-col items-end gap-2">
                    {dday && (
                        <Badge variant="outline" className={`h-6 rounded-md px-2 text-[11px] font-semibold ${ddayStyle}`}>
                            {dday}
                        </Badge>
                    )}
                    <div className="flex items-center gap-1">
                        {isPending && canInlineApprove ? (
                            <>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 gap-1 px-2 text-[11px] text-primary/90 hover:bg-primary/10"
                                    disabled={isBusy}
                                    onClick={(e) => { e.stopPropagation(); onAction(task.id, 'approve', task.sourceId) }}
                                >
                                    {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                    <span className="hidden sm:inline">{t('actionApprove')}</span>
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 gap-1 px-2 text-[11px] text-red-500 hover:bg-destructive/10"
                                    disabled={isBusy}
                                    onClick={(e) => { e.stopPropagation(); onAction(task.id, 'reject', task.sourceId) }}
                                >
                                    <XCircle className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">{t('actionReject')}</span>
                                </Button>
                            </>
                        ) : isPending && task.actionUrl ? (
                            <Link href={task.actionUrl}>
                                <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:bg-muted">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">{t('actionView')}</span>
                                </Button>
                            </Link>
                        ) : task.actionUrl ? (
                            <Link href={task.actionUrl}>
                                <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:bg-muted">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                            </Link>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Inner client (needs useSearchParams inside Suspense) ──

function MyTasksInner({ user }: { user: SessionUser }) {
    const t = useTranslations('myTasks')
    const router = useRouter()
    const searchParams = useSearchParams()

    // URL state
    const statusTab = (searchParams.get('tab') ?? 'PENDING') as 'PENDING' | 'COMPLETED'
    const typeFilter = searchParams.get('type') ?? 'all'
    const sortBy = searchParams.get('sortBy') ?? 'priority'
    const page = parseInt(searchParams.get('page') ?? '1', 10)

    // Config arrays defined here for t() access
    const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
        [UnifiedTaskType.LEAVE_APPROVAL]: { label: t('typeLeave'), color: '#818CF8', icon: CalendarDays },
        [UnifiedTaskType.PAYROLL_REVIEW]: { label: t('typePayroll'), color: '#F59E0B', icon: Clock },
        [UnifiedTaskType.ONBOARDING_TASK]: { label: t('typeOnboarding'), color: '#10B981', icon: ClipboardCheck },
        [UnifiedTaskType.OFFBOARDING_TASK]: { label: t('typeOffboarding'), color: '#EF4444', icon: DoorOpen },
        [UnifiedTaskType.PERFORMANCE_REVIEW]: { label: t('typePerformance'), color: '#8B5CF6', icon: Target },
    }
    const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
        [UnifiedTaskPriority.URGENT]: { color: '#EF4444', bg: '#FEF2F2', label: t('priorityUrgent') },
        [UnifiedTaskPriority.HIGH]: { color: '#F59E0B', bg: '#FFFBEB', label: t('priorityHigh') },
        [UnifiedTaskPriority.MEDIUM]: { color: '#10B981', bg: '#F0FDF4', label: t('priorityMedium') },
        [UnifiedTaskPriority.LOW]: { color: '#5E81F4', bg: '#EDF1FE', label: t('priorityLow') },
    }
    const FILTER_TABS = [
        { key: 'all', label: t('filterAll'), type: null },
        { key: 'LEAVE_APPROVAL', label: t('filterLeave'), type: UnifiedTaskType.LEAVE_APPROVAL },
        { key: 'PAYROLL_REVIEW', label: t('filterPayroll'), type: UnifiedTaskType.PAYROLL_REVIEW },
        { key: 'ONBOARDING_TASK', label: t('filterOnboarding'), type: UnifiedTaskType.ONBOARDING_TASK },
        { key: 'OFFBOARDING_TASK', label: t('filterOffboarding'), type: UnifiedTaskType.OFFBOARDING_TASK },
        { key: 'PERFORMANCE_REVIEW', label: t('filterPerformance'), type: UnifiedTaskType.PERFORMANCE_REVIEW },
    ]
    const SORT_OPTIONS = [
        { value: 'priority', label: t('sortPriority') },
        { value: 'dueDate', label: t('sortDueDate') },
        { value: 'createdAt', label: t('sortCreatedAt') },
    ]

    const [tasks, setTasks] = useState<UnifiedTask[]>([])
    const [countByType, setCountByType] = useState<Partial<Record<UnifiedTaskType, number>>>({})
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState<string | null>(null)

    const limit = 20

    // ── URL State Sync ──────────────────────────────────────

    const updateParams = useCallback((updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString())
        Object.entries(updates).forEach(([k, v]) => {
            if (v && v !== '') params.set(k, v)
            else params.delete(k)
        })
        router.replace(`/my/tasks?${params.toString()}`, { scroll: false })
    }, [searchParams, router])

    // ── Fetch tasks ─────────────────────────────────────────

    const fetchTasks = useCallback(async () => {
        setLoading(true)
        try {
            const query = new URLSearchParams()
            if (typeFilter !== 'all') query.set('types', typeFilter)

            // Status filter: PENDING for 진행중, COMPLETED/REJECTED/CANCELLED for 완료
            if (statusTab === 'PENDING') {
                query.set('statuses', 'PENDING,IN_PROGRESS')
            } else {
                query.set('statuses', 'COMPLETED,REJECTED,CANCELLED')
            }

            query.set('sortField', sortBy)
            query.set('sortDir', sortBy === 'dueDate' ? 'asc' : 'desc')
            query.set('page', String(page))
            query.set('limit', String(limit))

            const res = await apiClient.get<UnifiedTaskListResponse>(
                `/api/v1/unified-tasks?${query.toString()}`
            )

            setTasks(res.data.items)
            setCountByType(res.data.countByType)
            setTotal(res.data.total)
            setTotalPages(Math.max(1, Math.ceil(res.data.total / limit)))
        } catch {
            setTasks([])
        } finally {
            setLoading(false)
        }
    }, [statusTab, typeFilter, sortBy, page])

    useEffect(() => {
        void fetchTasks()
    }, [fetchTasks])

    // ── Inline Actions (Leave approve/reject) ───────────────

    const handleAction = useCallback(
        async (taskId: string, action: 'approve' | 'reject', sourceId: string) => {
            setProcessing(taskId)
            const prev = tasks
            setTasks((ts) => ts.filter((t) => t.id !== taskId))
            try {
                await apiClient.put(`/api/v1/leave/requests/${sourceId}/${action}`, {})
                await fetchTasks()
            } catch {
                setTasks(prev)
            } finally {
                setProcessing(null)
            }
        },
        [tasks, fetchTasks],
    )

    // ── Total pending count ─────────────────────────────────

    const totalAllTypes = useMemo(() => {
        return Object.values(countByType).reduce((sum, n) => sum + (n ?? 0), 0)
    }, [countByType])

    // ── Render ──────────────────────────────────────────────

    return (
        <div className="space-y-6 p-6">
            <PageHeader
                title={t('title')}
                description={t('description')}
            />

            {/* ── Status Tabs ── */}
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
                <button
                    type="button"
                    onClick={() => updateParams({ tab: null, page: null, type: null })}
                    className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${statusTab === 'PENDING'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    {t('tabInProgress')}
                    {statusTab === 'PENDING' && totalAllTypes > 0 && (
                        <span className="ml-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                            {totalAllTypes}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => updateParams({ tab: 'COMPLETED', page: null, type: null })}
                    className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${statusTab === 'COMPLETED'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    {t('tabCompleted')}
                </button>
            </div>

            {/* ── Type Filter Tabs + Sort ── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                    {FILTER_TABS.map((tab) => {
                        const count = tab.type ? (countByType[tab.type] ?? 0) : totalAllTypes
                        const isActive = typeFilter === tab.key

                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => updateParams({ type: tab.key === 'all' ? null : tab.key, page: null })}
                                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150 ${isActive
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                                    }`}
                            >
                                {tab.label}
                                {count > 0 && (
                                    <span className={`rounded-full px-1.5 text-[10px] ${isActive
                                        ? 'bg-white/25 text-white'
                                        : 'bg-muted text-muted-foreground'
                                        }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Sort control */}
                <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select
                        value={sortBy}
                        onValueChange={(v) => updateParams({ sortBy: v, page: null })}
                    >
                        <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SORT_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* ── Task List ── */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Card key={i} className="border-border">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <Skeleton className="h-9 w-9 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-16" />
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                    <Skeleton className="h-6 w-12" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : tasks.length === 0 ? (
                <Card className="border-border">
                    <CardContent className="py-16">
                        <EmptyState
                            icon={statusTab === 'PENDING'
                                ? <PartyPopper className="h-12 w-12" />
                                : <Info className="h-12 w-12" />
                            }
                            title={
                                typeFilter !== 'all' ? t('emptyNoType') :
                                    statusTab === 'COMPLETED' ? t('emptyCompleted') :
                                        t('emptyNoTasks')
                            }
                            description={
                                statusTab === 'PENDING'
                                    ? t('emptyNoTasksDesc')
                                    : t('emptyCompletedDesc')
                            }
                        />
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {tasks.map((task) => (
                        <UnifiedTaskCard
                            key={task.id}
                            task={task}
                            user={user}
                            onAction={handleAction}
                            processing={processing}
                            typeConfig={TYPE_CONFIG}
                            priorityConfig={PRIORITY_CONFIG}
                        />
                    ))}
                </div>
            )}

            {/* ── Completed Tab Notice ── */}
            {statusTab === 'COMPLETED' && !loading && (
                <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-primary/10 p-4">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="text-xs text-primary">
                        <p className="font-medium">{t('completedNotice')}</p>
                        <p className="mt-1 text-muted-foreground">
                            {t('completedLinks')}
                            <span className="ml-1 space-x-2">
                                <Link href="/leave" className="underline hover:text-primary">{t('linkLeave')}</Link>
                                <Link href="/payroll/me" className="underline hover:text-primary">{t('linkPayslip')}</Link>
                                <Link href="/performance" className="underline hover:text-primary">{t('linkPerformance')}</Link>
                            </span>
                        </p>
                    </div>
                </div>
            )}

            {/* ── Pagination ── */}
            {totalPages > 1 && !loading && (
                <div className="flex items-center justify-between px-1">
                    <p className="text-sm text-muted-foreground">
                        {t('totalCount', { count: total.toLocaleString() })}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => updateParams({ page: String(page - 1) })}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-foreground">
                            {page} / {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => updateParams({ page: String(page + 1) })}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Wrapper with Suspense for useSearchParams ────────────

export function MyTasksClient({ user }: { user: SessionUser }) {
    return (
        <Suspense fallback={
            <div className="space-y-6 p-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-64" />
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
                </div>
            </div>
        }>
            <MyTasksInner user={user} />
        </Suspense>
    )
}
