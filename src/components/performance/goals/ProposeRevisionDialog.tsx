'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — ProposeRevisionDialog
// Phase C: APPROVED 목표 수정 제안 다이얼로그 (단일 + 배치)
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { FileEdit } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────

interface GoalForRevision {
  id: string
  title: string
  description?: string | null
  weight: number
  targetMetric?: string | null
  targetValue?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  goals: GoalForRevision[]  // 단일: 1개, 배치: 여러 개
  quarterlyReviewId?: string
  onSuccess: () => void
}

interface RevisionInput {
  goalId: string
  newTitle?: string
  newDescription?: string
  newWeight?: number
  newTargetMetric?: string
  newTargetValue?: string
}

// ─── Component ──────────────────────────────────────────────

export function ProposeRevisionDialog({ open, onOpenChange, goals, quarterlyReviewId, onSuccess }: Props) {
  const t = useTranslations('performance.goalRevision')
  const tc = useTranslations('common')
  const isBatch = goals.length > 1

  const [revisions, setRevisions] = useState<RevisionInput[]>(() =>
    goals.map((g) => ({
      goalId: g.id,
      newTitle: g.title,
      newDescription: g.description ?? undefined,
      newWeight: g.weight,
      newTargetMetric: g.targetMetric ?? undefined,
      newTargetValue: g.targetValue ?? undefined,
    })),
  )
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function updateRevision(goalId: string, field: string, value: string | number) {
    setRevisions((prev) =>
      prev.map((r) => (r.goalId === goalId ? { ...r, [field]: value } : r)),
    )
  }

  function hasChanges(rev: RevisionInput, original: GoalForRevision): boolean {
    return (
      rev.newTitle !== original.title ||
      (rev.newDescription ?? '') !== (original.description ?? '') ||
      rev.newWeight !== original.weight ||
      (rev.newTargetMetric ?? '') !== (original.targetMetric ?? '') ||
      (rev.newTargetValue ?? '') !== (original.targetValue ?? '')
    )
  }

  const anyChanges = revisions.some((rev) => {
    const original = goals.find((g) => g.id === rev.goalId)
    return original && hasChanges(rev, original)
  })

  async function handleSubmit() {
    if (!reason.trim() || !anyChanges) return
    setSubmitting(true)

    try {
      if (isBatch) {
        const items = revisions
          .filter((rev) => {
            const original = goals.find((g) => g.id === rev.goalId)
            return original && hasChanges(rev, original)
          })
          .map((rev) => {
            const original = goals.find((g) => g.id === rev.goalId)!
            const item: Record<string, unknown> = { goalId: rev.goalId }
            if (rev.newTitle !== original.title) item.newTitle = rev.newTitle
            if (rev.newWeight !== original.weight) item.newWeight = rev.newWeight
            if ((rev.newDescription ?? '') !== (original.description ?? '')) item.newDescription = rev.newDescription
            if ((rev.newTargetMetric ?? '') !== (original.targetMetric ?? '')) item.newTargetMetric = rev.newTargetMetric
            if ((rev.newTargetValue ?? '') !== (original.targetValue ?? '')) item.newTargetValue = rev.newTargetValue
            return item
          })
        await apiClient.post('/api/v1/performance/goals/batch-revisions', {
          revisions: items,
          reason,
          quarterlyReviewId,
        })
      } else {
        const rev = revisions[0]
        const original = goals[0]
        const body: Record<string, unknown> = { reason, quarterlyReviewId }
        if (rev.newTitle !== original.title) body.newTitle = rev.newTitle
        if (rev.newWeight !== original.weight) body.newWeight = rev.newWeight
        if ((rev.newDescription ?? '') !== (original.description ?? '')) body.newDescription = rev.newDescription
        if ((rev.newTargetMetric ?? '') !== (original.targetMetric ?? '')) body.newTargetMetric = rev.newTargetMetric
        if ((rev.newTargetValue ?? '') !== (original.targetValue ?? '')) body.newTargetValue = rev.newTargetValue
        await apiClient.post(`/api/v1/performance/goals/${original.id}/revisions`, body)
      }

      toast({ title: tc('save') + ' ' + tc('success') })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast({
        title: t('messages.proposeFailed'),
        description: err instanceof Error ? err.message : t('messages.retryPlease'),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileEdit className="h-5 w-5 text-primary" />
            {isBatch ? t('proposeBatch') : t('proposeRevision')}
          </DialogTitle>
          <DialogDescription>{t('proposeRevisionDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {goals.map((goal, idx) => {
            const rev = revisions[idx]
            if (!rev) return null

            return (
              <div key={goal.id} className="rounded-2xl bg-card p-4">
                <h4 className="mb-3 text-sm font-semibold text-foreground">{goal.title}</h4>

                {/* Title */}
                <div className="mb-2">
                  <label className="mb-1 block text-xs text-muted-foreground">{tc('title')}</label>
                  <div className="flex items-center gap-2">
                    {rev.newTitle !== goal.title && (
                      <span className="text-xs line-through text-muted-foreground">{goal.title}</span>
                    )}
                    <input
                      type="text"
                      value={rev.newTitle ?? ''}
                      onChange={(e) => updateRevision(goal.id, 'newTitle', e.target.value)}
                      className={`w-full rounded-lg border px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 ${
                        rev.newTitle !== goal.title ? 'bg-primary-container/20 font-semibold border-primary/30' : 'border-border/15'
                      }`}
                    />
                  </div>
                </div>

                {/* Weight */}
                <div className="mb-2">
                  <label className="mb-1 block text-xs text-muted-foreground">{t('prevValue')}: {goal.weight}%</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rev.newWeight ?? 0}
                      onChange={(e) => updateRevision(goal.id, 'newWeight', Number(e.target.value))}
                      className={`w-24 rounded-lg border px-3 py-1.5 text-sm font-mono tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 ${
                        rev.newWeight !== goal.weight ? 'bg-primary-container/20 font-semibold border-primary/30' : 'border-border/15'
                      }`}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>

                {/* Target */}
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">{t('targetMetric')}</label>
                    <input
                      type="text"
                      value={rev.newTargetMetric ?? ''}
                      onChange={(e) => updateRevision(goal.id, 'newTargetMetric', e.target.value)}
                      className={`w-full rounded-lg border px-3 py-1.5 text-sm focus:border-primary focus:outline-none ${
                        (rev.newTargetMetric ?? '') !== (goal.targetMetric ?? '') ? 'bg-primary-container/20 border-primary/30' : 'border-border/15'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">{t('targetValue')}</label>
                    <input
                      type="text"
                      value={rev.newTargetValue ?? ''}
                      onChange={(e) => updateRevision(goal.id, 'newTargetValue', e.target.value)}
                      className={`w-full rounded-lg border px-3 py-1.5 text-sm focus:border-primary focus:outline-none ${
                        (rev.newTargetValue ?? '') !== (goal.targetValue ?? '') ? 'bg-primary-container/20 border-primary/30' : 'border-border/15'
                      }`}
                    />
                  </div>
                </div>

                {/* Change indicator */}
                {hasChanges(rev, goal) && (
                  <p className="mt-1 text-xs text-primary">{t('diffHighlight')}</p>
                )}
              </div>
            )
          })}

          {/* Reason */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t('revisionReason')} <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('revisionReason')}
              className="w-full rounded-lg border border-border/15 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !reason.trim() || !anyChanges}>
              {submitting ? tc('saving') : t('proposeRevision')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
