'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCircle2, Clock, Send, ShieldAlert, ArrowLeft } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { getGradeLabel } from '@/lib/performance/data-masking'
import type { SessionUser } from '@/types'
import { TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string }
interface NotifyItem {
    reviewId: string; employeeId: string; employeeName: string; department: string
    finalGradeEnum: string | null; notifiedAt: string | null; acknowledgedAt: string | null
    isAutoAcknowledged: boolean
}

type FilterType = 'all' | 'pending' | 'waiting' | 'done'

// ─── Component ────────────────────────────────────────────

export default function NotificationsClient({user }: {
  user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
    const isHrAdmin = user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN'

    const [cycles, setCycles] = useState<CycleOption[]>([])
    const [selectedCycleId, setSelectedCycleId] = useState('')
    const [cycleStatus, setCycleStatus] = useState('')
    const [items, setItems] = useState<NotifyItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [filter, setFilter] = useState<FilterType>('all')
    const [notifying, setNotifying] = useState<string | null>(null)
    const [bulkNotifying, setBulkNotifying] = useState(false)
    const { confirm, dialogProps } = useConfirmDialog()

    useEffect(() => {
        async function load() {
            try {
                const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
                const valid = res.data.filter((c) => ['FINALIZED', 'CLOSED', 'COMP_REVIEW', 'COMP_COMPLETED'].includes(c.status))
                setCycles(valid)
                if (valid.length > 0) { setSelectedCycleId(valid[0].id); setCycleStatus(valid[0].status) }
            } catch { setError(t('cycleLoadFailed')) }
        }
        load()
    }, [])

    const fetchItems = useCallback(async () => {
        if (!selectedCycleId) return
        setLoading(true); setError('')
        try {
            const res = await apiClient.get<NotifyItem[]>(`/api/v1/performance/cycles/${selectedCycleId}/participants`, { includeNotification: 'true' })
            setItems(res.data ?? [])
        } catch { setError('통보 현황을 불러오지 못했습니다.') }
        finally { setLoading(false) }
    }, [selectedCycleId])

    useEffect(() => { fetchItems() }, [fetchItems])

    function handleCycleChange(id: string) {
        setSelectedCycleId(id)
        const c = cycles.find((c) => c.id === id)
        if (c) setCycleStatus(c.status)
    }

    async function handleNotify(reviewId: string) {
        confirm({ title: t('kr_kec9db4_keca781ec_keab2b0ea_ke'), onConfirm: async () => {
            setNotifying(reviewId)
            try {
                await apiClient.post(`/api/v1/performance/reviews/${reviewId}/notify`)
                await fetchItems()
            } catch { toast({ title: t('kr_ked86b5eb_kec8ba4ed'), variant: 'destructive' }) }
            finally { setNotifying(null) }
        }})
    }

    async function handleBulkNotify() {
        const pendingCount = items.filter((i) => !i.notifiedAt).length
        confirm({ title: `미통보 ${pendingCount}명에게 일괄 통보하시겠습니까?`, onConfirm: async () => {
            setBulkNotifying(true)
            try {
                await apiClient.post(`/api/v1/performance/cycles/${selectedCycleId}/bulk-notify`)
                await fetchItems()
            } catch { toast({ title: t('kr_kec9dbcea_ked86b5eb_kec8ba4ed'), variant: 'destructive' }) }
            finally { setBulkNotifying(false) }
        }})
    }

    // Route guard
    const isBlocked = cycleStatus !== '' && !['FINALIZED', 'CLOSED', 'COMP_REVIEW', 'COMP_COMPLETED'].includes(cycleStatus)
    if (isBlocked) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <Bell className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">{t('kr_keab2b0ea_ked86b5eb_keb8ba8ea_')}</h2>
                    <p className="text-sm text-muted-foreground">{t('kr_keab2b0ea_ked86b5eb_finalized_')}</p>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> {t('kr_keb8f8cec')}</a>
                </div>
            </div>
        )
    }

    // Helpers
    function getDDay(notifiedAt: string | null): number | null {
        if (!notifiedAt) return null
        const deadline = new Date(notifiedAt).getTime() + 7 * 24 * 60 * 60 * 1000 // 168h
        return Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24))
    }

    function getStatus(item: NotifyItem): { label: string; cls: string } {
        if (item.acknowledgedAt) {
            return item.isAutoAcknowledged
                ? { label: t('kr_kec9e90eb'), cls: 'text-muted-foreground' }
                : { label: t('kr_confirm'), cls: 'text-emerald-700' }
        }
        if (item.notifiedAt) return { label: t('kr_keb8c80ea'), cls: 'text-amber-800' }
        return { label: t('kr_kebafb8ed'), cls: 'text-muted-foreground' }
    }

    const filtered = items.filter((item) => {
        if (filter === 'pending') return !item.notifiedAt
        if (filter === 'waiting') return item.notifiedAt && !item.acknowledgedAt
        if (filter === 'done') return !!item.acknowledgedAt
        return true
    })

    const total = items.length
    const notified = items.filter((i) => i.notifiedAt).length
    const acknowledged = items.filter((i) => i.acknowledgedAt).length
    const pending = total - notified

    return (
        <div className="min-h-screen bg-muted p-6">
            <div className="mx-auto max-w-5xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{t('kr_keab2b0ea_ked86b5eb_result_not')}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            전체: {total}명 | 통보 완료: {notified} | 미통보: {pending} | 확인 완료: {acknowledged}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {isHrAdmin && pending > 0 && (
                            <button onClick={handleBulkNotify} disabled={bulkNotifying}
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40">
                                <Send className="h-4 w-4" /> {bulkNotifying ? '통보 중...' : '전체 일괄 통보'}
                            </button>
                        )}
                        <select value={selectedCycleId} onChange={(e) => handleCycleChange(e.target.value)}
                            className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                            {!cycles?.length && <EmptyState />}
              {cycles?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Filter tabs */}
                <div className="mb-4 flex gap-2">
                    {([['all', '전체'], ['pending', '미통보'], ['waiting', '대기 중'], ['done', '확인 완료']] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setFilter(key)}
                            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${filter === key ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:bg-muted'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-destructive/15 bg-destructive/5 p-3 text-sm text-destructive">
                        {error} <button onClick={fetchItems} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {loading ? (
                    <TableSkeleton rows={4} cols={7} />
                ) : (
                    <div className={TABLE_STYLES.wrapper}>
                        <table className={TABLE_STYLES.table}>
                            <thead>
                                <tr className={TABLE_STYLES.header}>
                                    <th className={TABLE_STYLES.headerCell}>{t('name')}</th>
                                    <th className={TABLE_STYLES.headerCell}>{t('kr_keb93b1ea')}</th>
                                    <th className={TABLE_STYLES.headerCell}>{t('kr_ked86b5eb')}</th>
                                    <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('confirm_kec9dbc')}</th>
                                    <th className={cn(TABLE_STYLES.headerCell, "text-center")}>D-day</th>
                                    <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('status')}</th>
                                    <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('kr_kec95a1ec')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((item) => {
                                    const status = getStatus(item)
                                    const dDay = getDDay(item.notifiedAt)
                                    return (
                                        <tr key={item.reviewId} className={TABLE_STYLES.row}>
                                            <td className={cn(TABLE_STYLES.cell, "px-4")}>
                                                <p className="font-medium text-foreground">{item.employeeName}</p>
                                                <p className="text-xs text-muted-foreground">{item.department}</p>
                                            </td>
                                            <td className={cn(TABLE_STYLES.cell, "text-center font-medium")}>{getGradeLabel(item.finalGradeEnum)}</td>
                                            <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>{item.notifiedAt?.slice(0, 10) ?? '-'}</td>
                                            <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>
                                                {item.acknowledgedAt ? (
                                                    <span>{item.acknowledgedAt.slice(0, 10)}{item.isAutoAcknowledged ? ' (자동)' : ''}</span>
                                                ) : '-'}
                                            </td>
                                            <td className={cn(TABLE_STYLES.cell, "text-center")}>
                                                {dDay !== null && !item.acknowledgedAt ? (
                                                    <span className={`text-xs font-medium ${dDay <= 2 ? 'text-red-500' : 'text-amber-500'}`}>D-{Math.max(dDay, 0)}</span>
                                                ) : '-'}
                                            </td>
                                            <td className={cn(TABLE_STYLES.cell, "text-center font-medium text-xs", status.cls)}>{status.label}</td>
                                            <td className={cn(TABLE_STYLES.cell, "text-center")}>
                                                {!item.notifiedAt && (
                                                    <button onClick={() => handleNotify(item.reviewId)} disabled={notifying === item.reviewId}
                                                        className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-40">
                                                        {notifying === item.reviewId ? '...' : '통보'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        {/* Footer note */}
                        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                            {t('kr_ked86b5eb_ked9b84_168kec8b9cea')}
                        </div>
                    </div>
                )}
            </div>
        <ConfirmDialog {...dialogProps} />
        </div>
    )
}
