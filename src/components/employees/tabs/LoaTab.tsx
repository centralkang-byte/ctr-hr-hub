'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, FileText, Clock, CheckCircle2, XCircle, AlertCircle, Pause } from 'lucide-react'
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
  REQUESTED: '신청',
  APPROVED: '승인',
  ACTIVE: '휴직중',
  RETURN_REQUESTED: '복직신청',
  COMPLETED: '복직완료',
  REJECTED: '거부',
  CANCELLED: '취소',
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
  REQUESTED: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-orange-100 text-orange-700',
  RETURN_REQUESTED: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
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
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex flex-col items-center py-12 text-[#999]">
          <Shield className="h-10 w-10 mb-3 text-border" />
          <p className="text-sm font-medium text-[#666]">휴직 이력이 없습니다</p>
        </div>
      </div>
    )
  }

  // 활성/진행중 먼저, 나머지 최신순
  const active = records.filter(r => ['REQUESTED', 'APPROVED', 'ACTIVE', 'RETURN_REQUESTED'].includes(r.status))
  const past = records.filter(r => ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(r.status))

  return (
    <div className="rounded-xl border border-border bg-white p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">휴직 이력</h3>
        <span className="text-sm text-muted-foreground">{records.length}건</span>
      </div>

      {/* 활성 휴직 */}
      {active.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">진행중</p>
          {active.map(r => <LoaCard key={r.id} record={r} />)}
        </div>
      )}

      {/* 과거 이력 */}
      {past.length > 0 && (
        <div className="space-y-3">
          {active.length > 0 && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">이전 이력</p>}
          {past.map(r => <LoaCard key={r.id} record={r} />)}
        </div>
      )}
    </div>
  )
}

function LoaCard({ record: r }: { record: LoaRecord }) {
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
              r.type.category === 'STATUTORY' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500',
            )}>
              {r.type.category === 'STATUTORY' ? '법정' : '약정'}
            </span>
            {r.splitSequence > 1 && (
              <span className="text-xs text-muted-foreground">{r.splitSequence}차</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{formatDate(r.startDate)} ~ {formatDate(r.actualEndDate ?? r.expectedEndDate)}</span>
            <span className="text-xs">({days}일)</span>
          </div>
          {r.reason && (
            <p className="mt-1 text-xs text-muted-foreground truncate">{r.reason}</p>
          )}
          {r.approver && (
            <p className="mt-1 text-xs text-muted-foreground">
              승인: {r.approver.name} ({formatDate(r.approvedAt)})
            </p>
          )}
        </div>
        <Badge className={cn('shrink-0', STATUS_COLORS[r.status])}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {STATUS_LABELS[r.status] ?? r.status}
        </Badge>
      </div>
    </div>
  )
}
