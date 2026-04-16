'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Approval Tab Content
// /my/tasks?tab=approvals — 승인 요청 탭
// mode=approvals API 호출, 필터, 체크박스 선택, 일괄 승인
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
    ChevronDown,
    ChevronUp,
    Loader2,
    Inbox,
    CheckSquare,
    Square,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import {
    ApprovalItemCard,
    BulkApproveBar,
    BulkApproveProgressModal,
    RejectReasonModal,
} from '@/components/shared/approval'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'
import {
    UnifiedTaskType,
    UnifiedTaskStatus,
} from '@/lib/unified-task/types'
import type { UnifiedTask, UnifiedTaskListResponse } from '@/lib/unified-task/types'

// ─── Types ──────────────────────────────────────────────────

interface Props {
    user: SessionUser
}

type ModuleFilter = 'ALL' | 'LEAVE_APPROVAL' | 'PERFORMANCE_REVIEW' | 'PAYROLL_REVIEW'

// ─── Component ──────────────────────────────────────────────

export function ApprovalTabContent({ user }: Props) {
    const t = useTranslations('myTasks')
    const { toast } = useToast()
    const isHrAdmin = user.role === 'HR_ADMIN' || user.role === 'SUPER_ADMIN'

    // State
    const [tasks, setTasks] = useState<UnifiedTask[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('ALL')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [processing, setProcessing] = useState<string | null>(null)
    const [showHistory, setShowHistory] = useState(false)
    const [historyTasks, setHistoryTasks] = useState<UnifiedTask[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)

    // Modals
    const [rejectTarget, setRejectTarget] = useState<UnifiedTask | null>(null)
    const [showBulkConfirm, setShowBulkConfirm] = useState(false)

    // AbortController for tab switching
    const abortRef = useRef<AbortController | null>(null)

    // Filter tabs
    const FILTER_TABS: { key: ModuleFilter; labelKey: string }[] = [
        { key: 'ALL', labelKey: 'filterAll' },
        { key: 'LEAVE_APPROVAL', labelKey: 'filterLeave' },
        { key: 'PERFORMANCE_REVIEW', labelKey: 'filterPerformance' },
        ...(isHrAdmin ? [{ key: 'PAYROLL_REVIEW' as const, labelKey: 'filterPayroll' }] : []),
    ]

    // ── Fetch pending tasks ─────────────────────────────────

    const fetchTasks = useCallback(async () => {
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller

        setLoading(true)
        setError(false)
        try {
            const query = new URLSearchParams({
                mode: 'approvals',
                sortField: 'priority',
                sortDir: 'desc',
                limit: '100',
            })
            if (moduleFilter !== 'ALL') {
                query.set('types', moduleFilter)
            }
            const res = await apiClient.get<UnifiedTaskListResponse>(
                `/api/v1/unified-tasks?${query.toString()}`,
            )
            if (!controller.signal.aborted) {
                setTasks(res.data.items)
            }
        } catch {
            if (!controller.signal.aborted) {
                setError(true)
                toast({
                    title: t('loadFailed'),
                    variant: 'destructive',
                })
            }
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false)
            }
        }
    }, [moduleFilter, t, toast])

    useEffect(() => {
        void fetchTasks()
        return () => abortRef.current?.abort()
    }, [fetchTasks])

    // ── Fetch history (lazy) ────────────────────────────────

    const fetchHistory = useCallback(async () => {
        if (historyTasks.length > 0) return // already loaded
        setHistoryLoading(true)
        try {
            const query = new URLSearchParams({
                mode: 'approvals',
                includeHistory: 'true',
                historyDays: '30',
                statuses: 'COMPLETED,REJECTED',
                sortField: 'updatedAt',
                sortDir: 'desc',
                limit: '50',
            })
            const res = await apiClient.get<UnifiedTaskListResponse>(
                `/api/v1/unified-tasks?${query.toString()}`,
            )
            // Only keep completed/rejected items
            setHistoryTasks(
                res.data.items.filter(
                    t => t.status === UnifiedTaskStatus.COMPLETED || t.status === UnifiedTaskStatus.REJECTED,
                ),
            )
        } catch {
            toast({ title: t('loadFailed'), variant: 'destructive' })
        } finally {
            setHistoryLoading(false)
        }
    }, [historyTasks.length, t, toast])

    const handleToggleHistory = () => {
        const next = !showHistory
        setShowHistory(next)
        if (next) void fetchHistory()
    }

    // ── Computed ─────────────────────────────────────────────

    const pendingTasks = tasks.filter(
        t => t.status === UnifiedTaskStatus.PENDING || t.status === UnifiedTaskStatus.IN_PROGRESS,
    )
    const filteredTasks = moduleFilter === 'ALL'
        ? pendingTasks
        : pendingTasks.filter(t => t.type === moduleFilter)

    const tabCounts: Partial<Record<ModuleFilter, number>> = {
        ALL: pendingTasks.length,
        LEAVE_APPROVAL: pendingTasks.filter(t => t.type === UnifiedTaskType.LEAVE_APPROVAL).length,
        PERFORMANCE_REVIEW: pendingTasks.filter(t => t.type === UnifiedTaskType.PERFORMANCE_REVIEW).length,
        PAYROLL_REVIEW: pendingTasks.filter(t => t.type === UnifiedTaskType.PAYROLL_REVIEW).length,
    }

    const allSelected = filteredTasks.length > 0 && filteredTasks.every(t => selectedIds.has(t.id))

    // ── Actions ─────────────────────────────────────────────

    const doApprove = async (task: UnifiedTask) => {
        if (!task.actions?.approveUrl) return
        setProcessing(task.id)
        const prev = tasks
        setTasks(ts => ts.filter(t => t.id !== task.id))
        setSelectedIds(s => { const n = new Set(s); n.delete(task.id); return n })
        try {
            await apiClient.put(task.actions.approveUrl, {})
        } catch (err) {
            setTasks(prev)
            toast({ title: t('approveFailed'), variant: 'destructive' })
            throw err // rethrow for bulk approve Promise.allSettled
        } finally {
            setProcessing(null)
        }
    }

    const doReject = async (task: UnifiedTask, reason: string) => {
        if (!task.actions?.rejectUrl) return
        setProcessing(task.id)
        const prev = tasks
        setTasks(ts => ts.filter(t => t.id !== task.id))
        setSelectedIds(s => { const n = new Set(s); n.delete(task.id); return n })
        setRejectTarget(null)
        try {
            await apiClient.put(task.actions.rejectUrl, { rejectionReason: reason })
        } catch {
            setTasks(prev)
            toast({ title: t('rejectFailed'), variant: 'destructive' })
        } finally {
            setProcessing(null)
        }
    }

    const doBulkApprove = async () => {
        setShowBulkConfirm(false)
        const toApprove = filteredTasks.filter(t => selectedIds.has(t.id) && t.actions?.approveUrl)

        const results = await Promise.allSettled(
            toApprove.map(task => doApprove(task)),
        )

        const failCount = results.filter(r => r.status === 'rejected').length
        if (failCount > 0) {
            toast({ title: t('bulkPartialFail', { failed: failCount }), variant: 'destructive' })
        } else {
            toast({ title: t('bulkSuccess', { count: toApprove.length }) })
        }
        setSelectedIds(new Set())
        void fetchTasks()
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const n = new Set(prev)
            if (n.has(id)) n.delete(id)
            else n.add(id)
            return n
        })
    }

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredTasks.map(t => t.id)))
        }
    }

    // ── Render ───────────────────────────────────────────────

    return (
        <div className="relative space-y-4 pb-20">
            {/* Module filter tabs */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
                {FILTER_TABS.map(tab => {
                    const count = tabCounts[tab.key] ?? 0
                    const isActive = moduleFilter === tab.key
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => { setModuleFilter(tab.key); setSelectedIds(new Set()) }}
                            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150 ${
                                isActive
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                            }`}
                        >
                            {t(tab.labelKey)}
                            {count > 0 && (
                                <span className={`rounded-full px-1.5 text-[10px] ${
                                    isActive ? 'bg-white/25 text-white' : 'bg-muted text-muted-foreground'
                                }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Select all */}
            {filteredTasks.length > 0 && (
                <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                >
                    {allSelected
                        ? <CheckSquare className="h-4 w-4 text-primary" />
                        : <Square className="h-4 w-4" />
                    }
                    {t('selectAll')}
                </button>
            )}

            {/* Pending list */}
            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <Skeleton className="h-9 w-9 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-16" />
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : error ? (
                <Card>
                    <CardContent className="py-16">
                        <EmptyState
                            icon={<Inbox className="h-12 w-12" />}
                            title={t('loadFailed')}
                            description={t('retryDescription')}
                            action={{
                                label: t('retry'),
                                onClick: () => void fetchTasks(),
                            }}
                        />
                    </CardContent>
                </Card>
            ) : filteredTasks.length === 0 ? (
                <Card>
                    <CardContent className="py-16">
                        <EmptyState
                            icon={<Inbox className="h-12 w-12" />}
                            title={t('noApprovals')}
                            description={t('noApprovalsDesc')}
                        />
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {filteredTasks.map(task => (
                        <ApprovalItemCard
                            key={task.id}
                            task={task}
                            isSelected={selectedIds.has(task.id)}
                            onToggle={toggleSelect}
                            onApprove={(t) => void doApprove(t)}
                            onReject={(t) => setRejectTarget(t)}
                            processing={processing}
                        />
                    ))}
                </div>
            )}

            {/* History section (lazy loaded) */}
            <div className="pt-2">
                <button
                    type="button"
                    className="flex w-full items-center gap-2 py-2"
                    onClick={handleToggleHistory}
                >
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('historyTitle')}
                    </span>
                    <span className="ml-auto text-muted-foreground">
                        {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </span>
                </button>

                {showHistory && (
                    historyLoading ? (
                        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('loading')}
                        </div>
                    ) : historyTasks.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                            {t('noHistory')}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {historyTasks.map(task => (
                                <ApprovalItemCard
                                    key={task.id}
                                    task={task}
                                    isSelected={false}
                                    onToggle={() => {}}
                                    onApprove={() => {}}
                                    onReject={() => {}}
                                    processing={null}
                                />
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* Bulk approve bar */}
            <BulkApproveBar
                selectedCount={selectedIds.size}
                onBulkApprove={() => setShowBulkConfirm(true)}
                onClearSelection={() => setSelectedIds(new Set())}
            />

            {/* Reject modal */}
            {rejectTarget && (
                <RejectReasonModal
                    title={rejectTarget.title}
                    onClose={() => setRejectTarget(null)}
                    onConfirm={(reason) => doReject(rejectTarget, reason)}
                />
            )}

            {/* Bulk confirm modal */}
            {showBulkConfirm && (
                <BulkApproveProgressModal
                    count={selectedIds.size}
                    onClose={() => setShowBulkConfirm(false)}
                    onConfirm={doBulkApprove}
                />
            )}
        </div>
    )
}
