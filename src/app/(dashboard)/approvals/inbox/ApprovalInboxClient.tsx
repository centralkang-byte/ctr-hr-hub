'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Approval Inbox Client (Stage 5-B)
// /approvals/inbox
//
// 설계 결정:
//   - /api/v1/approvals/inbox 기반 (Leave + MBO + Payroll 통합)
//   - 탭 필터: 전체/휴가/성과/급여
//   - 인라인 승인/반려 (Optimistic UI)
//   - 반려 모달: 사유 입력 필수
//   - 일괄 승인: 체크박스 + floating bar
//   - 완료 이력: 접기/펼치기
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Inbox,
  CalendarDays,
  Target,
  Banknote,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  X,
  AlertCircle,
  CheckCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import type { ApprovalItem } from '@/app/api/v1/approvals/inbox/route'
import { BUTTON_VARIANTS } from '@/lib/styles'


// ─── Constants ────────────────────────────────────────────

const MODULE_LABEL: Record<string, string> = {
  LEAVE:       '휴가',
  PERFORMANCE: '성과',
  PAYROLL:     '급여',
}

const MODULE_ICON: Record<string, React.ElementType> = {
  LEAVE:       CalendarDays,
  PERFORMANCE: Target,
  PAYROLL:     Banknote,
}

const MODULE_COLOR: Record<string, string> = {
  LEAVE:       'text-[#5E81F4]',
  PERFORMANCE: 'text-[#A855F7]',
  PAYROLL:     'text-[#F59E0B]',
}

const PRIORITY_BORDER: Record<string, string> = {
  HIGH:   'border-l-4 border-l-[#EF4444]',
  MEDIUM: 'border-l-4 border-l-[#F59E0B]',
  LOW:    '',
}

type ModuleFilter = 'ALL' | 'LEAVE' | 'PERFORMANCE' | 'PAYROLL'

const TABS: { key: ModuleFilter; label: string }[] = [
  { key: 'ALL',         label: '전체' },
  { key: 'LEAVE',       label: '휴가' },
  { key: 'PERFORMANCE', label: '성과' },
  { key: 'PAYROLL',     label: '급여' },
]

// ─── Rejection Modal ──────────────────────────────────────

interface RejectionModalProps {
  item:    ApprovalItem
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}

function RejectionModal({ item, onClose, onConfirm }: RejectionModalProps) {
  const tCommon = useTranslations('common')
  const [reason,     setReason]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const handleSubmit = async () => {
    if (!reason.trim()) { setError('반려 사유를 입력해주세요.'); return }
    setSubmitting(true)
    try {
      await onConfirm(reason.trim())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1C1D21]">반려 사유 입력</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#8181A5] hover:bg-[#F5F5FA]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Target */}
        <div className="mb-4 rounded-lg bg-[#F5F5FA] px-3 py-2 text-sm text-[#8181A5]">
          {item.title}
        </div>

        {/* Reason textarea */}
        <textarea
          className="w-full rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm text-[#1C1D21] placeholder:text-[#C0C0D0] focus:border-[#5E81F4] focus:outline-none"
          rows={4}
          placeholder={'placeholderRejectReasonRequired'}
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError('') }}
        />
        {error && (
          <p className="mt-1 flex items-center gap-1 text-xs text-[#EF4444]">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button
            size="sm"
            className="bg-[#EF4444] text-white hover:bg-[#DC2626]"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '반려 확인'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Approve Confirm Modal ──────────────────────────────────

interface ApproveConfirmModalProps {
  item:      ApprovalItem
  onClose:   () => void
  onConfirm: () => Promise<void>
}

function ApproveConfirmModal({ item, onClose, onConfirm }: ApproveConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1C1D21]">승인 확인</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-[#8181A5] hover:bg-[#F5F5FA]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-4 rounded-lg bg-[#F5F5FA] px-3 py-2 text-sm text-[#8181A5]">
          {item.title}
        </div>
        <p className="text-sm text-[#1C1D21]">이 요청을 승인하시겠습니까?</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button
            size="sm"
            className={BUTTON_VARIANTS.primary}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '승인'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Bulk Confirm Modal ───────────────────────────────────

interface BulkConfirmModalProps {
  count:     number
  onClose:   () => void
  onConfirm: () => Promise<void>
}

function BulkConfirmModal({ count, onClose, onConfirm }: BulkConfirmModalProps) {
  const [progress,   setProgress]   = useState<{ done: number; total: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setSubmitting(true)
    setProgress({ done: 0, total: count })
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h2 className="mb-3 text-base font-semibold text-[#1C1D21]">일괄 승인 확인</h2>
        <p className="text-sm text-[#8181A5]">
          선택한 <span className="font-semibold text-[#1C1D21]">{count}건</span>을 모두 승인하시겠습니까?
        </p>

        {progress && (
          <div className="mt-3 text-xs text-[#8181A5]">
            처리 중... ({progress.done}/{progress.total})
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button
            size="sm"
            className={BUTTON_VARIANTS.primary}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '일괄 승인'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Approval Row ─────────────────────────────────────────

interface ApprovalRowProps {
  item:        ApprovalItem
  isSelected:  boolean
  onToggle:    (id: string) => void
  onApprove:   (item: ApprovalItem) => void
  onReject:    (item: ApprovalItem) => void
  processing:  string | null
}

function ApprovalRow({ item, isSelected, onToggle, onApprove, onReject, processing }: ApprovalRowProps) {
  const Icon   = MODULE_ICON[item.module] ?? Inbox
  const color  = MODULE_COLOR[item.module] ?? 'text-[#8181A5]'
  const border = PRIORITY_BORDER[item.priority] ?? ''
  const isBusy = processing === item.id

  const dueLabel = item.dueDate
    ? new Date(item.dueDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    : null

  const isDue = item.dueDate && new Date(item.dueDate) <= new Date()

  return (
    <div
      className={`rounded-xl bg-white p-4 transition-shadow hover:shadow-sm ${border} border border-[#F0F0F3]`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox (pending only) */}
        {item.status === 'PENDING' ? (
          <button
            type="button"
            className="mt-0.5 shrink-0 text-[#8181A5] hover:text-[#5E81F4]"
            onClick={() => onToggle(item.id)}
            aria-label="선택"
          >
            {isSelected
              ? <CheckSquare className="h-4 w-4 text-[#5E81F4]" />
              : <Square className="h-4 w-4" />
            }
          </button>
        ) : (
          <div className="mt-0.5 h-4 w-4 shrink-0">
            {item.status === 'APPROVED'
              ? <CheckCircle2 className="h-4 w-4 text-[#5E81F4]" />
              : <XCircle className="h-4 w-4 text-[#EF4444]" />
            }
          </div>
        )}

        {/* Icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F5F5FA]">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#1C1D21]">{item.title}</p>
          <p className="mt-0.5 truncate text-xs text-[#8181A5]">{item.description}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {MODULE_LABEL[item.module] ?? item.module}
            </Badge>
            <span className="text-[10px] text-[#8181A5]">{item.requesterDept}</span>
            {dueLabel && (
              <Badge
                variant="outline"
                className={`h-5 px-1.5 text-[10px] ${
                  isDue
                    ? 'border-[#FECACA] bg-[#FEF2F2] text-[#EF4444]'
                    : 'border-[#F0F0F3] text-[#8181A5]'
                }`}
              >
                마감: {dueLabel}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        {item.status === 'PENDING' && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[11px] text-[#5E81F4] hover:bg-[#EDF1FE]"
              disabled={isBusy}
              onClick={() => onApprove(item)}
            >
              {isBusy
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <CheckCircle2 className="h-3.5 w-3.5" />
              }
              <span className="hidden sm:inline">승인</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[11px] text-[#EF4444] hover:bg-[#FEF2F2]"
              disabled={isBusy}
              onClick={() => onReject(item)}
            >
              <XCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">반려</span>
            </Button>
            <Link href={item.actions.detailUrl}>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#8181A5] hover:bg-[#F5F5FA]">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────

interface ApprovalInboxClientProps {
  user: SessionUser
}

export function ApprovalInboxClient({ user }: ApprovalInboxClientProps) {
  const tCommon = useTranslations('common')
  const [items,       setItems]       = useState<ApprovalItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState<ModuleFilter>('ALL')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [processing,  setProcessing]  = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [pendingVisible, setPendingVisible] = useState(20)
  const [historyVisible, setHistoryVisible] = useState(20)

  // Modals
  const [rejectTarget,    setRejectTarget]    = useState<ApprovalItem | null>(null)
  const [approveTarget,   setApproveTarget]   = useState<ApprovalItem | null>(null)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)

  // Bulk progress
  const [bulkProgress,    setBulkProgress]    = useState<{ total: number; done: number; failed: number } | null>(null)

  // ─── Fetch ───────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    try {
      const [pendingRes, historyRes] = await Promise.all([
        apiClient.get<{ items: ApprovalItem[]; pendingCount: number }>(
          '/api/v1/approvals/inbox?status=PENDING',
        ),
        apiClient.get<{ items: ApprovalItem[]; pendingCount: number }>(
          '/api/v1/approvals/inbox?status=ALL&days=30',
        ),
      ])
      const pending  = pendingRes.data.items.filter(i => i.status === 'PENDING')
      const history  = historyRes.data.items.filter(i => i.status !== 'PENDING')
      setItems([...pending, ...history])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchItems() }, [fetchItems])

  // ─── Computed ─────────────────────────────────────────────

  const pendingItems  = items.filter(i => i.status === 'PENDING')
  const historyItems  = items.filter(i => i.status !== 'PENDING')

  const filtered = (tab === 'ALL' ? pendingItems : pendingItems.filter(i => i.module === tab))

  const tabCounts: Record<ModuleFilter, number> = {
    ALL:         pendingItems.length,
    LEAVE:       pendingItems.filter(i => i.module === 'LEAVE').length,
    PERFORMANCE: pendingItems.filter(i => i.module === 'PERFORMANCE').length,
    PAYROLL:     pendingItems.filter(i => i.module === 'PAYROLL').length,
  }

  const selectedItems = filtered.filter(i => selectedIds.has(i.id))

  // ─── Action handlers ──────────────────────────────────────

  const doApprove = async (item: ApprovalItem) => {
    setProcessing(item.id)
    const prev = items
    // Optimistic
    setItems(is => is.map(i => i.id === item.id ? { ...i, status: 'APPROVED' as const } : i))
    setSelectedIds(s => { const n = new Set(s); n.delete(item.id); return n })

    try {
      await apiClient.put(item.actions.approveUrl, {})
    } catch {
      setItems(prev)
    } finally {
      setProcessing(null)
    }
  }

  const doReject = async (item: ApprovalItem, reason: string) => {
    setProcessing(item.id)
    const prev = items
    setItems(is => is.map(i => i.id === item.id ? { ...i, status: 'REJECTED' as const } : i))
    setSelectedIds(s => { const n = new Set(s); n.delete(item.id); return n })
    setRejectTarget(null)

    try {
      await apiClient.put(item.actions.rejectUrl, { rejectionReason: reason })
    } catch {
      setItems(prev)
    } finally {
      setProcessing(null)
    }
  }

  const doBulkApprove = async () => {
    setShowBulkConfirm(false)
    const toApprove = [...selectedItems]
    setBulkProgress({ total: toApprove.length, done: 0, failed: 0 })

    const results = await Promise.allSettled(
      toApprove.map(async (item) => {
        await doApprove(item)
        setBulkProgress(prev => prev ? { ...prev, done: prev.done + 1 } : null)
      })
    )

    const failCount = results.filter(r => r.status === 'rejected').length
    setBulkProgress(prev => prev ? { ...prev, done: prev.total, failed: failCount } : null)

    // 2초 후 진행률 바 숨김
    setTimeout(() => setBulkProgress(null), 2000)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="relative space-y-4 pb-20">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1C1D21]">{tCommon('approvalsInbox')}</h1>
          <p className="mt-0.5 text-sm text-[#8181A5]">
            처리가 필요한 승인 요청을 확인하세요.
          </p>
        </div>
        {selectedIds.size > 0 && (
          <Button
            size="sm"
            className={`gap-1.5 ${BUTTON_VARIANTS.primary}`}
            onClick={() => setShowBulkConfirm(true)}
          >
            <CheckCheck className="h-4 w-4" />
            일괄 승인 ({selectedIds.size}건)
          </Button>
        )}
      </div>

      {/* ── Bulk progress bar ── */}
      {bulkProgress && (
        <div className="rounded-lg border border-[#F0F0F3] bg-white p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#1C1D21] font-medium">
              일괄 승인 진행 중... ({bulkProgress.done}/{bulkProgress.total})
            </span>
            {bulkProgress.failed > 0 && (
              <span className="text-sm text-destructive">{bulkProgress.failed}건 실패</span>
            )}
          </div>
          <div className="h-2 bg-[#F0F0F3] rounded-full overflow-hidden">
            <div
              className="h-full bg-ctr-primary rounded-full transition-all duration-300"
              style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Module tabs ── */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setSelectedIds(new Set()); setPendingVisible(20) }}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-[#5E81F4] text-white'
                : 'bg-[#F5F5FA] text-[#8181A5] hover:bg-[#EDF1FE] hover:text-[#5E81F4]'
            }`}
          >
            {t.label}
            {tabCounts[t.key] > 0 && (
              <span className={`rounded-full px-1 text-[10px] ${
                tab === t.key ? 'bg-white/30 text-white' : 'bg-[#E8E8F0] text-[#8181A5]'
              }`}>
                {tabCounts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Pending list ── */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#F5F5FA]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-[#F0F0F3] shadow-none">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <CheckCircle2 className="mb-3 h-12 w-12 text-[#5E81F4] opacity-60" />
            <EmptyState />
            <p className="mt-1 text-xs text-[#8181A5]">모든 요청이 처리되었습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, pendingVisible).map(item => (
            <ApprovalRow
              key={item.id}
              item={item}
              isSelected={selectedIds.has(item.id)}
              onToggle={toggleSelect}
              onApprove={(i) => setApproveTarget(i)}
              onReject={(i) => setRejectTarget(i)}
              processing={processing}
            />
          ))}
          {filtered.length > pendingVisible && (
            <button
              type="button"
              onClick={() => setPendingVisible(v => v + 20)}
              className="w-full py-2 text-sm text-[#5E81F4] hover:underline"
            >
              더 보기 ({filtered.length - pendingVisible}건 남음)
            </button>
          )}
        </div>
      )}

      {/* ── History section ── */}
      {historyItems.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            className="flex w-full items-center gap-2 py-2"
            onClick={() => setShowHistory(v => !v)}
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8181A5]">
              처리 완료 (최근 30일)
            </span>
            <span className="rounded-full bg-[#F0F0F3] px-1.5 py-0.5 text-[10px] text-[#8181A5]">
              {historyItems.length}
            </span>
            <span className="ml-auto text-[#8181A5]">
              {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </span>
          </button>

          {showHistory && (
            <div className="space-y-2">
              {historyItems.slice(0, historyVisible).map(item => (
                <ApprovalRow
                  key={item.id}
                  item={item}
                  isSelected={false}
                  onToggle={() => {}}
                  onApprove={() => {}}
                  onReject={() => {}}
                  processing={null}
                />
              ))}
              {historyItems.length > historyVisible && (
                <button
                  type="button"
                  onClick={() => setHistoryVisible(v => v + 20)}
                  className="w-full py-2 text-sm text-[#8181A5] hover:underline"
                >
                  더 보기 ({historyItems.length - historyVisible}건 남음)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Bulk floating action bar ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl bg-[#1C1D21] px-5 py-3 text-white shadow-lg">
            <CheckSquare className="h-4 w-4 text-[#5E81F4]" />
            <span className="text-sm font-medium">{selectedIds.size}건 선택됨</span>
            <Button
              size="sm"
              className={BUTTON_VARIANTS.primary}
              onClick={() => setShowBulkConfirm(true)}
            >
              일괄 승인
            </Button>
            <button
              type="button"
              className="text-xs text-[#8181A5] hover:text-white"
              onClick={() => setSelectedIds(new Set())}
            >
              선택 해제
            </button>
          </div>
        </div>
      )}

      {/* ── Approve Confirm Modal ── */}
      {approveTarget && (
        <ApproveConfirmModal
          item={approveTarget}
          onClose={() => setApproveTarget(null)}
          onConfirm={async () => { await doApprove(approveTarget); setApproveTarget(null) }}
        />
      )}

      {/* ── Rejection Modal ── */}
      {rejectTarget && (
        <RejectionModal
          item={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => doReject(rejectTarget, reason)}
        />
      )}

      {/* ── Bulk Confirm Modal ── */}
      {showBulkConfirm && (
        <BulkConfirmModal
          count={selectedIds.size}
          onClose={() => setShowBulkConfirm(false)}
          onConfirm={doBulkApprove}
        />
      )}
    </div>
  )
}
