'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Shield, Clock, CheckCircle2, XCircle, AlertCircle, Pause } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  employeeId: string
}

interface LoaRecord {
  id: string
  startDate: string
  expectedEndDate: string | null
  actualEndDate: string | null
  status: string
  reason: string | null
  splitSequence: number
  requestedAt: string
  approvedAt: string | null
  type: {
    id: string
    code: string
    name: string
    nameEn: string | null
    category: string
  }
  approver: { id: string; name: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'loaStatusRequested',
  APPROVED: 'loaStatusApproved',
  ACTIVE: 'loaStatusActive',
  RETURN_REQUESTED: 'loaStatusReturnRequested',
  COMPLETED: 'loaStatusCompleted',
  REJECTED: 'loaStatusRejected',
  CANCELLED: 'loaStatusCancelled',
}

const STATUS_ICONS: Record<string, typeof Clock> = {
  REQUESTED: Clock,
  APPROVED: CheckCircle2,
  ACTIVE: Pause,
  RETURN_REQUESTED: AlertCircle,
  COMPLETED: CheckCircle2,
  REJECTED: XCircle,
  CANCELLED: XCircle,
}

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: 'bg-yellow-500/15 text-yellow-700',
  APPROVED: 'bg-primary/10 text-primary',
  ACTIVE: 'bg-orange-500/15 text-orange-700',
  RETURN_REQUESTED: 'bg-purple-500/15 text-purple-700',
  COMPLETED: 'bg-tertiary-container/20 text-tertiary',
  REJECTED: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR')
}

function calcDuration(start: string, end: string | null) {
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  const days = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
  return days
}

export function LoaTab({ employeeId }: Props) {
  const t = useTranslations('employee')
  const [records, setRecords] = useState<LoaRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRecords = useCallback(() => {
    setLoading(true)
    fetch(`/api/v1/leave-of-absence?employeeId=${employeeId}&limit=50`)
      .then(res => res.json())
      .then(json => {
        if (json.data) setRecords(json.data)
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  }, [employeeId])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <Shield className="h-10 w-10 mb-3 text-border" />
          <p className="text-sm font-medium text-muted-foreground">{t('loaNoHistory')}</p>
        </div>
      </div>
    )
  }

  // 활성/진행중 먼저, 나머지 최신순
  const active = records.filter(r => ['REQUESTED', 'APPROVED', 'ACTIVE', 'RETURN_REQUESTED'].includes(r.status))
  const past = records.filter(r => ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(r.status))

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">{t('loaHistoryTitle')}</h3>
        <span className="text-sm text-muted-foreground">{records.length}{t('loaCountSuffix')}</span>
      </div>

      {/* 활성 휴직 */}
      {active.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('loaInProgress')}</p>
          {active.map(r => <LoaCard key={r.id} record={r} />)}
        </div>
      )}

      {/* 과거 이력 */}
      {past.length > 0 && (
        <div className="space-y-3">
          {active.length > 0 && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">{t('loaPastHistory')}</p>}
          {past.map(r => <LoaCard key={r.id} record={r} />)}
        </div>
      )}
    </div>
  )
}

function LoaCard({ record: r }: { record: LoaRecord }) {
  const t = useTranslations('employee')
  const StatusIcon = STATUS_ICONS[r.status] ?? Clock
  const days = calcDuration(r.startDate, r.actualEndDate ?? r.expectedEndDate)

  return (
    <div className="rounded-lg border border-border p-4 hover:bg-background transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-foreground">{r.type.name}</span>
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              r.type.category === 'STATUTORY' ? 'bg-primary/5 text-primary' : 'bg-muted/50 text-muted-foreground',
            )}>
              {r.type.category === 'STATUTORY' ? t('loaCategoryStatutory') : t('loaCategoryContractual')}
            </span>
            {r.splitSequence > 1 && (
              <span className="text-xs text-muted-foreground">{r.splitSequence}{t('loaSplitSuffix')}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{formatDate(r.startDate)} ~ {formatDate(r.actualEndDate ?? r.expectedEndDate)}</span>
            <span className="text-xs">({days}{t('loaDaySuffix')})</span>
          </div>
          {r.reason && (
            <p className="mt-1 text-xs text-muted-foreground truncate">{r.reason}</p>
          )}
          {r.approver && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('loaApproverLabel')}{r.approver.name} ({formatDate(r.approvedAt)})
            </p>
          )}
        </div>
        <Badge className={cn('shrink-0', STATUS_COLORS[r.status])}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {t(STATUS_LABELS[r.status] ?? r.status)}
        </Badge>
      </div>
    </div>
  )
}
