'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — RevisionHistorySheet
// Phase C: 목표별 수정 이력 Sheet
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { History } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────

interface GoalRevisionItem {
  id: string
  version: number
  status: string
  reason: string
  prevTitle: string
  prevWeight: number
  prevTargetMetric?: string | null
  prevTargetValue?: string | null
  newTitle: string
  newWeight: number
  newTargetMetric?: string | null
  newTargetValue?: string | null
  reviewComment?: string | null
  batchId?: string | null
  createdAt: string
  proposedBy: { id: string; name: string }
  reviewedBy?: { id: string; name: string } | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalId: string
  goalTitle: string
}

const REVISION_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-700',
  APPROVED: 'bg-tertiary-container/30 text-tertiary',
  REJECTED: 'bg-destructive/5 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
}

// ─── Component ──────────────────────────────────────────────

export function RevisionHistorySheet({ open, onOpenChange, goalId, goalTitle }: Props) {
  const t = useTranslations('performance.goalRevision')
  const [revisions, setRevisions] = useState<GoalRevisionItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRevisions = useCallback(async () => {
    if (!goalId) return
    setLoading(true)
    try {
      const res = await apiClient.get<GoalRevisionItem[]>(`/api/v1/performance/goals/${goalId}/revisions`)
      setRevisions(res.data)
    } catch (err) {
      toast({
        title: '이력 로드 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [goalId])

  useEffect(() => {
    if (open) fetchRevisions()
  }, [open, fetchRevisions])

  function DiffLine({ label, prev, next }: { label: string; prev: string; next: string }) {
    if (prev === next) return null
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
        <span className="line-through text-muted-foreground">{prev}</span>
        <span className="text-foreground">→</span>
        <span className="font-semibold text-foreground">{next}</span>
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            {t('revisionHistory')}
          </SheetTitle>
          <SheetDescription>{goalTitle}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : revisions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t('noRevisions')}
            </div>
          ) : (
            revisions.map((rev) => (
              <div key={rev.id} className="rounded-2xl bg-card p-4">
                {/* Header */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {t('version', { version: rev.version })}
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${REVISION_STATUS_STYLES[rev.status] ?? ''}`}>
                      {t(`revision${rev.status.charAt(0) + rev.status.slice(1).toLowerCase()}` as Parameters<typeof t>[0])}
                    </span>
                    {rev.batchId && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">배치</span>
                    )}
                  </div>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {new Date(rev.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>

                {/* Diff */}
                <div className="mb-2 space-y-1 rounded-lg bg-primary-container/10 p-2">
                  <DiffLine label="제목" prev={rev.prevTitle} next={rev.newTitle} />
                  <DiffLine label="가중치" prev={`${rev.prevWeight}%`} next={`${rev.newWeight}%`} />
                  <DiffLine label="지표" prev={rev.prevTargetMetric ?? '-'} next={rev.newTargetMetric ?? '-'} />
                  <DiffLine label="목표값" prev={rev.prevTargetValue ?? '-'} next={rev.newTargetValue ?? '-'} />
                </div>

                {/* Reason */}
                <p className="mb-1 text-xs text-muted-foreground">
                  <span className="font-medium">{t('revisionReason')}:</span> {rev.reason}
                </p>

                {/* Reviewer comment */}
                {rev.reviewComment && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{t('reviewComment')}:</span> {rev.reviewComment}
                  </p>
                )}

                {/* Proposer */}
                <p className="mt-2 text-xs text-muted-foreground">
                  {rev.proposedBy.name}
                  {rev.reviewedBy && ` → ${rev.reviewedBy.name}`}
                </p>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
