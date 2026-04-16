'use client'

import { useLocale, useTranslations } from 'next-intl'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Instance Detail
// /onboarding/[id] — Master-Detail layout
//
// E-1: GP#2 Onboarding Pipeline
// CRAFTUI tokens applied throughout
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    AlertTriangle, CheckCircle2, Circle, Clock, Loader2,
    Lock, Play, Smile, SkipForward, ArrowLeft,
} from 'lucide-react'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { apiClient } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface TaskData {
    id: string
    status: string
    dueDate: string | null
    blockedReason: string | null
    blockedAt: string | null
    unblockedAt: string | null
    assigneeId: string | null
    completedAt: string | null
    note: string | null
    task: {
        id: string
        title: string
        description: string | null
        assigneeType: string
        dueDaysAfter: number
        sortOrder: number
        isRequired: boolean
        category: string
    }
    assignee: { id: string; name: string } | null
    completer: { id: string; name: string } | null
}

interface CheckinData {
    id: string
    milestone: string | null
    checkinWeek: number
    mood: string
    energy: number
    belonging: number
    comment: string | null
    aiSummary: string | null
    submittedAt: string
}

interface OnboardingDetail {
    id: string
    status: string
    planType: string
    startedAt: string | null
    completedAt: string | null
    signOff: {
        signedOffBy: { id: string; name: string } | null
        signedOffAt: string | null
        note: string | null
    }
    employee: {
        id: string
        name: string
        email: string
        hireDate: string | null
        department: string | null
        company: string | null
        position: string | null
        manager: { id: string; name: string } | null
    }
    buddy: { id: string; name: string } | null
    progress: { total: number; done: number; blocked: number; inProgress: number; pending: number; skipped: number; percentage: number }
    currentMilestone: string | null
    milestoneGroups: Record<string, TaskData[]>
    blockedHistory: Array<{ taskId: string; taskTitle: string; reason: string; blockedAt: string; unblockedAt: string | null; durationDays: number }>
    signOffEligibility: { eligible: boolean; reason?: string; requiredTotal: number; requiredDone: number; remainingTasks: string[] }
    checkins: CheckinData[]
}

// ─── Component ──────────────────────────────────────────────

export default function OnboardingDetailClient({ user, onboardingId }: { user: SessionUser; onboardingId: string }) {
    const tCommon = useTranslations('common')
    const t = useTranslations('onboarding')
    const locale = useLocale()
    const router = useRouter()
    const [data, setData] = useState<OnboardingDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [tab, setTab] = useState<'tasks' | 'checkins' | 'timeline'>('tasks')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [blockDialog, setBlockDialog] = useState<{ taskId: string; title: string } | null>(null)
    const [blockReason, setBlockReason] = useState('')
    const [signOffDialog, setSignOffDialog] = useState(false)
    const [signOffNote, setSignOffNote] = useState('')

    const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

    // ─── Fetch ────────────────────────────────────────────────

    const fetchDetail = useCallback(async () => {
        try {
            setLoading(true)
            const res = await apiClient.get<OnboardingDetail>(`/api/v1/onboarding/instances/${onboardingId}`)
            if ('data' in res && res.data) setData(res.data)
            else setError(tCommon('loadFailed'))
        } catch {
            setError(tCommon('loadFailed'))
        } finally {
            setLoading(false)
        }
    }, [onboardingId, tCommon])

    useEffect(() => { fetchDetail() }, [fetchDetail])

    // ─── Actions ──────────────────────────────────────────────

    const updateTaskStatus = async (taskId: string, status: string, blockedReason?: string) => {
        if (actionLoading) return
        setActionLoading(taskId)
        try {
            await apiClient.put(`/api/v1/onboarding/instances/${onboardingId}/tasks/${taskId}/status`, {
                status,
                ...(blockedReason ? { blockedReason } : {}),
            })
            await fetchDetail()
        } catch {
            setError(tCommon('saveFailed'))
        } finally {
            setActionLoading(null)
        }
    }

    const blockTask = async () => {
        if (!blockDialog || !blockReason.trim()) return
        setActionLoading(blockDialog.taskId)
        try {
            await apiClient.post(`/api/v1/onboarding/instances/${onboardingId}/tasks/${blockDialog.taskId}/block`, { reason: blockReason })
            setBlockDialog(null)
            setBlockReason('')
            await fetchDetail()
        } catch { setError(tCommon('saveFailed')) }
        finally { setActionLoading(null) }
    }

    const unblockTask = async (taskId: string) => {
        setActionLoading(taskId)
        try {
            await apiClient.post(`/api/v1/onboarding/instances/${onboardingId}/tasks/${taskId}/unblock`, { resumeStatus: 'PENDING' })
            await fetchDetail()
        } catch { setError(tCommon('saveFailed')) }
        finally { setActionLoading(null) }
    }

    const handleSignOff = async () => {
        setActionLoading('sign-off')
        try {
            await apiClient.post(`/api/v1/onboarding/instances/${onboardingId}/sign-off`, { note: signOffNote || undefined })
            setSignOffDialog(false)
            setSignOffNote('')
            await fetchDetail()
        } catch { setError(tCommon('saveFailed')) }
        finally { setActionLoading(null) }
    }

    // ─── Render ───────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error && !data) {
        return (
            <div className="p-6">
                <EmptyState icon={<AlertTriangle className="h-12 w-12" />} title={tCommon('error')} description={error} />
            </div>
        )
    }

    if (!data) return null

    const milestones = ['DAY_1', 'DAY_7', 'DAY_30', 'DAY_90'] as const
    const milestoneLabels: Record<string, string> = {
        DAY_1: t('milestoneDay1'), DAY_7: t('milestoneDay7'), DAY_30: t('milestoneDay30'), DAY_90: t('milestoneDay90'),
    }
    const canSignOff = (isHrAdmin || data.employee.manager?.id === user.employeeId) && data.signOffEligibility.eligible

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.push('/onboarding')} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <PageHeader title={t('detail.headerTitle', { name: data.employee.name })} description={`${data.employee.department ?? ''} · ${data.employee.position ?? ''}`} />
                <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${data.status === 'COMPLETED' ? 'bg-tertiary-container/20 text-tertiary' : data.status === 'IN_PROGRESS' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {data.status === 'COMPLETED' ? t('statusCompleted') : data.status === 'IN_PROGRESS' ? t('statusInProgress') : data.status}
                </span>
            </div>

            {/* Master-Detail Layout */}
            <div className="flex gap-6">
                {/* LEFT: Info Panel (30%) */}
                <div className="w-80 flex-shrink-0 space-y-4">
                    {/* Progress Ring Card */}
                    <div className="rounded-xl border border-border bg-card p-5">
                        <div className="mb-4 flex items-center justify-center">
                            <div className="relative h-28 w-28">
                                <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="42" fill="none" stroke="#F0F0F3" strokeWidth="8" />
                                    <circle cx="50" cy="50" r="42" fill="none" stroke="#5E81F4" strokeWidth="8" strokeLinecap="round"
                                        strokeDasharray={`${data.progress.percentage * 2.64} 264`} />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl font-bold text-foreground">{data.progress.percentage}%</span>
                                    <span className="text-xs text-muted-foreground">{data.progress.done}/{data.progress.total}</span>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg bg-primary/10 px-2 py-1.5">
                                <div className="text-sm font-bold text-primary">{data.progress.inProgress}</div>
                                <div className="text-[10px] text-muted-foreground">{t('inProgress')}</div>
                            </div>
                            <div className="rounded-lg bg-destructive/5 px-2 py-1.5">
                                <div className="text-sm font-bold text-red-500">{data.progress.blocked}</div>
                                <div className="text-[10px] text-muted-foreground">{t('blockedStatus')}</div>
                            </div>
                            <div className="rounded-lg bg-muted px-2 py-1.5">
                                <div className="text-sm font-bold text-muted-foreground">{data.progress.pending}</div>
                                <div className="text-[10px] text-muted-foreground">{t('pending')}</div>
                            </div>
                        </div>
                    </div>

                    {/* Employee Info Card */}
                    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                        <h3 className="text-sm font-semibold text-foreground">{t('detail.employeeInfo')}</h3>
                        <InfoRow label={t('hireDate')} value={data.employee.hireDate ? new Date(data.employee.hireDate).toLocaleDateString(locale) : '-'} />
                        <InfoRow label={t('detail.department')} value={data.employee.department ?? '-'} />
                        <InfoRow label={t('detail.position')} value={data.employee.position ?? '-'} />
                        <InfoRow label={t('detail.company')} value={data.employee.company ?? '-'} />
                        <InfoRow label={t('detail.manager')} value={data.employee.manager?.name ?? '-'} />
                        <InfoRow label={t('buddy')} value={data.buddy?.name ?? '-'} />
                        <InfoRow label={t('detail.currentMilestone')} value={data.currentMilestone ? milestoneLabels[data.currentMilestone] ?? data.currentMilestone : '-'} />
                    </div>

                    {/* Sign-off Section */}
                    {data.status !== 'COMPLETED' && (
                        <div className={`rounded-xl border p-5 ${data.signOffEligibility.eligible ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
                            <h3 className="mb-2 text-sm font-semibold text-foreground">🖊️ Sign-off</h3>
                            {data.signOffEligibility.eligible ? (
                                <>
                                    <p className="mb-3 text-xs text-tertiary">✅ {t('detail.allRequiredDone')}</p>
                                    {canSignOff && (
                                        <button onClick={() => setSignOffDialog(true)} disabled={actionLoading === 'sign-off'}
                                            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
                                            {actionLoading === 'sign-off' ? tCommon('processing') : t('approveOnboarding')}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <p className="mb-2 text-xs text-muted-foreground">
                                        {t('detail.requiredTaskProgress', { done: data.signOffEligibility.requiredDone, total: data.signOffEligibility.requiredTotal })}
                                    </p>
                                    {data.signOffEligibility.remainingTasks.length > 0 && (
                                        <ul className="space-y-1">
                                            {data.signOffEligibility.remainingTasks.slice(0, 3).map((t, i) => (
                                                <li key={i} className="text-xs text-red-500">• {t}</li>
                                            ))}
                                            {data.signOffEligibility.remainingTasks.length > 3 && (
                                                <li className="text-xs text-muted-foreground">... +{data.signOffEligibility.remainingTasks.length - 3}</li>
                                            )}
                                        </ul>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {data.status === 'COMPLETED' && data.signOff.signedOffBy && (
                        <div className="rounded-xl border border-green-100 bg-tertiary-container/10 p-5">
                            <h3 className="mb-2 text-sm font-semibold text-tertiary">✅ {t('detail.onboardingComplete')}</h3>
                            <InfoRow label={t('detail.approver')} value={data.signOff.signedOffBy.name} />
                            <InfoRow label={t('detail.approvedDate')} value={data.signOff.signedOffAt ? new Date(data.signOff.signedOffAt).toLocaleDateString(locale) : '-'} />
                            {data.signOff.note && <InfoRow label={t('detail.comment')} value={data.signOff.note} />}
                        </div>
                    )}
                </div>

                {/* RIGHT: Tab Content (70%) */}
                <div className="flex-1 min-w-0">
                    {/* Tab Bar */}
                    <div className="mb-4 flex gap-1 rounded-xl bg-muted p-1">
                        {(['tasks', 'checkins', 'timeline'] as const).map((tabKey) => {
                            const tabLabel = tabKey === 'tasks' ? t('tabTasks') : tabKey === 'checkins' ? t('tabCheckins') : t('tabTimeline')
                            return (
                                <button key={tabKey} onClick={() => setTab(tabKey)}
                                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === tabKey ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {tabLabel}
                                </button>
                            )
                        })}
                    </div>

                    {/* Tasks Tab */}
                    {tab === 'tasks' && (
                        <div className="space-y-6">
                            {milestones.map((milestone) => {
                                const tasks = data.milestoneGroups[milestone] ?? []
                                if (tasks.length === 0) return null
                                const done = tasks.filter((t) => t.status === 'DONE').length

                                return (
                                    <div key={milestone} className="rounded-xl border border-border bg-card">
                                        <div className="flex items-center justify-between border-b border-border px-5 py-3">
                                            <h3 className="text-sm font-semibold text-foreground">{milestoneLabels[milestone]}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">{done}/{tasks.length}</span>
                                                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border">
                                                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${tasks.length > 0 ? (done / tasks.length) * 100 : 0}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="divide-y divide-border">
                                            {tasks.map((task) => (
                                                <TaskRow key={task.id} task={task} user={user} isHrAdmin={isHrAdmin}
                                                    actionLoading={actionLoading} onStatusChange={updateTaskStatus}
                                                    onBlock={(id, title) => { setBlockDialog({ taskId: id, title }); setBlockReason('') }}
                                                    onUnblock={unblockTask} />
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Checkins Tab */}
                    {tab === 'checkins' && (
                        <div className="space-y-4">
                            {data.checkins.length === 0 ? (
                                <EmptyState icon={<Smile className="h-12 w-12" />} title={t('detail.noCheckins')} description={t('detail.noCheckinsDesc')} />
                            ) : (
                                <>
                                    {/* Mini Trend */}
                                    <div className="rounded-xl border border-border bg-card p-5">
                                        <h3 className="mb-3 text-sm font-semibold text-foreground">{t('detail.emotionTrend')}</h3>
                                        <div className="flex items-end justify-around gap-4 h-28">
                                            {data.checkins.map((c, i) => (
                                                <div key={i} className="flex flex-col items-center gap-1">
                                                    <div className="flex gap-1">
                                                        <MetricBar label="M" value={moodToNum(c.mood)} />
                                                        <MetricBar label="E" value={c.energy} />
                                                        <MetricBar label="B" value={c.belonging} />
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground">{c.milestone ?? `W${c.checkinWeek}`}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Checkin Cards */}
                                    {data.checkins.map((c) => (
                                        <div key={c.id} className="rounded-xl border border-border bg-card p-5">
                                            <div className="mb-2 flex items-center justify-between">
                                                <span className="text-sm font-semibold text-foreground">
                                                    {c.milestone ? milestoneLabels[c.milestone] ?? c.milestone : `Week ${c.checkinWeek}`}
                                                </span>
                                                <span className="text-xs text-muted-foreground">{new Date(c.submittedAt).toLocaleDateString(locale)}</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <EmotionCell label={t('mood')} value={c.mood} emoji={moodEmoji(c.mood)} />
                                                <EmotionCell label={t('detail.energy')} value={String(c.energy)} emoji={numEmoji(c.energy)} />
                                                <EmotionCell label={t('detail.belonging')} value={String(c.belonging)} emoji={numEmoji(c.belonging)} />
                                            </div>
                                            {c.comment && <p className="mt-3 text-sm text-muted-foreground">{c.comment}</p>}
                                            {c.aiSummary && (
                                                <div className="mt-2 rounded-lg bg-primary/10 p-3 text-xs text-primary">
                                                    🤖 {t('aiSummary')}: {c.aiSummary}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}

                    {/* Timeline Tab */}
                    {tab === 'timeline' && (
                        <div className="rounded-xl border border-border bg-card p-5">
                            <h3 className="mb-4 text-sm font-semibold text-foreground">{t('detail.blockedHistory')}</h3>
                            {data.blockedHistory.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{t('emptyBlockedHistory')}</p>
                            ) : (
                                <div className="space-y-3">
                                    {data.blockedHistory.map((b, i) => (
                                        <div key={i} className="flex items-start gap-3 rounded-lg border border-destructive/15 bg-destructive/5 p-3">
                                            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{b.taskTitle}</p>
                                                <p className="text-xs text-muted-foreground">{t('detail.reason')}: {b.reason}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(b.blockedAt).toLocaleDateString(locale)} ~ {b.unblockedAt ? new Date(b.unblockedAt).toLocaleDateString(locale) : t('inProgress')}
                                                    {' '}({t('detail.durationDays', { days: b.durationDays })})
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Block Dialog */}
            <Dialog open={!!blockDialog} onOpenChange={() => setBlockDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('detail.blockTask')}</DialogTitle>
                        <DialogDescription>{blockDialog?.title}</DialogDescription>
                    </DialogHeader>
                    <Textarea placeholder={tCommon('placeholderBlockReason')} value={blockReason} onChange={(e) => setBlockReason(e.target.value)} rows={3} />
                    <DialogFooter>
                        <button onClick={() => setBlockDialog(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
                        {tCommon('cancel')}
                        </button>
                        <button onClick={blockTask} disabled={!blockReason.trim() || !!actionLoading}
                            className="rounded-lg bg-destructive/50 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                            {t('detail.block')}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Sign-off Dialog */}
            <Dialog open={signOffDialog} onOpenChange={setSignOffDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('approveOnboarding')}</DialogTitle>
                        <DialogDescription>{t('detail.signOffDesc', { name: data.employee.name })}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <p className="text-sm text-primary">✅ {t('detail.requiredTaskProgress', { done: data.signOffEligibility.requiredDone, total: data.signOffEligibility.requiredTotal })}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t('detail.checkinCount', { count: data.checkins.length })}</p>
                        </div>
                        <Textarea placeholder={tCommon('enterComment')} value={signOffNote} onChange={(e) => setSignOffNote(e.target.value)} rows={3} />
                    </div>
                    <DialogFooter>
                        <button onClick={() => setSignOffDialog(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
                        {tCommon('cancel')}
                        </button>
                        <button onClick={handleSignOff} disabled={actionLoading === 'sign-off'}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
                            {actionLoading === 'sign-off' ? tCommon('processing') : t('approve')}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ─── Sub-components ─────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-foreground">{value}</span>
        </div>
    )
}

function TaskRow({ task, user, isHrAdmin, actionLoading, onStatusChange, onBlock, onUnblock }: {
    task: TaskData; user: SessionUser; isHrAdmin: boolean; actionLoading: string | null
    onStatusChange: (taskId: string, status: string) => void
    onBlock: (taskId: string, title: string) => void
    onUnblock: (taskId: string) => void
}) {
    const tCommon = useTranslations('common')
    const t = useTranslations('onboarding')
    const locale = useLocale()
    const isAssignee = task.assigneeId === user.employeeId
    const canAct = isAssignee || isHrAdmin
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE' && task.status !== 'SKIPPED'
    const isLoading = actionLoading === task.id

    return (
        <div className={`flex items-start gap-3 px-5 py-3 ${task.status === 'BLOCKED' ? 'border-l-4 border-l-[#EF4444] bg-destructive/5' : ''}`}>
            <div className="mt-0.5 flex-shrink-0">
                {task.status === 'DONE' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> :
                    task.status === 'IN_PROGRESS' ? <Play className="h-5 w-5 text-primary" /> :
                        task.status === 'BLOCKED' ? <Lock className="h-5 w-5 text-red-500" /> :
                            task.status === 'SKIPPED' ? <SkipForward className="h-5 w-5 text-muted-foreground" /> :
                                <Circle className="h-5 w-5 text-muted-foreground/40" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${task.status === 'DONE' || task.status === 'SKIPPED' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {task.task.title}
                    </span>
                    {task.task.isRequired && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{t('detail.required')}</span>}
                    {!task.task.isRequired && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tCommon('select')}</span>}
                </div>
                {task.task.description && <p className="mt-0.5 text-xs text-muted-foreground">{task.task.description}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {task.assignee && <span>👤 {task.assignee.name}</span>}
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{task.task.assigneeType}</span>
                    {task.dueDate && (
                        <span className={isOverdue ? 'font-medium text-red-500' : ''}>
                            <Clock className="mr-0.5 inline h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString(locale)}
                            {isOverdue && ` (${t('delayed')})`}
                        </span>
                    )}
                </div>
                {task.status === 'BLOCKED' && task.blockedReason && (
                    <div className="mt-1.5 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                        🚫 {task.blockedReason}
                    </div>
                )}
            </div>
            {/* Actions */}
            {canAct && task.status !== 'DONE' && task.status !== 'SKIPPED' && (
                <div className="flex flex-shrink-0 gap-1">
                    {task.status === 'PENDING' && (
                        <button onClick={() => onStatusChange(task.id, 'IN_PROGRESS')} disabled={isLoading}
                            className="rounded-lg border border-primary px-2 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-50">
                            {t('detail.start')}
                        </button>
                    )}
                    {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
                        <button onClick={() => onStatusChange(task.id, 'DONE')} disabled={isLoading}
                            className="rounded-lg bg-tertiary-container/100 px-2 py-1 text-xs text-white hover:bg-green-600 disabled:opacity-50">
                            {t('completed')}
                        </button>
                    )}
                    {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
                        <button onClick={() => onBlock(task.id, task.task.title)} disabled={isLoading}
                            className="rounded-lg border border-red-500 px-2 py-1 text-xs text-red-500 hover:bg-destructive/5 disabled:opacity-50">
                            {t('detail.block')}
                        </button>
                    )}
                    {task.status === 'BLOCKED' && (
                        <button onClick={() => onUnblock(task.id)} disabled={isLoading}
                            className="rounded-lg border border-amber-500 px-2 py-1 text-xs text-amber-500 hover:bg-amber-500/10 disabled:opacity-50">
                            {t('unblock')}
                        </button>
                    )}
                    {task.status === 'PENDING' && !task.task.isRequired && (
                        <button onClick={() => onStatusChange(task.id, 'SKIPPED')} disabled={isLoading}
                            className="rounded-lg border border-muted-foreground px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50">
                            {t('detail.skip')}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

function EmotionCell({ label, value, emoji }: { label: string; value: string; emoji: string }) {
    return (
        <div className="rounded-lg bg-muted p-3 text-center">
            <div className="text-2xl">{emoji}</div>
            <div className="mt-1 text-xs text-muted-foreground">{label}</div>
            <div className="text-sm font-semibold text-foreground">{value}</div>
        </div>
    )
}

function MetricBar({ label, value }: { label: string; value: number }) {
    const height = Math.max(10, (value / 5) * 80)
    const color = value >= 4 ? '#22C55E' : value >= 3 ? '#5E81F4' : value >= 2 ? '#F59E0B' : '#EF4444'
    return (
        <div className="flex flex-col items-center">
            <div className="w-3 rounded-t" style={{ height, backgroundColor: color }} />
            <span className="mt-0.5 text-[9px] text-muted-foreground">{label}</span>
        </div>
    )
}

function moodToNum(mood: string): number {
    switch (mood) {
        case 'GREAT': return 5
        case 'GOOD': return 4
        case 'NEUTRAL': return 3
        case 'STRUGGLING': return 2
        case 'BAD': return 1
        default: return 3
    }
}

function moodEmoji(mood: string): string {
    switch (mood) {
        case 'GREAT': return '😄'
        case 'GOOD': return '🙂'
        case 'NEUTRAL': return '😐'
        case 'STRUGGLING': return '😟'
        case 'BAD': return '😞'
        default: return '😐'
    }
}

function numEmoji(n: number): string {
    if (n >= 4) return '😄'
    if (n >= 3) return '🙂'
    if (n >= 2) return '😐'
    return '😞'
}
