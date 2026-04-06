'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — EndConcurrentDialog
// B-3: 겸직(secondary assignment) 종료 다이얼로그
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────

interface ConcurrentAssignment {
  id: string
  companyName: string
  departmentName: string | null
  positionTitle: string | null
  effectiveDate: string
}

interface EndConcurrentDialogProps {
  employeeId: string
  assignment: ConcurrentAssignment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Component ──────────────────────────────────────────────

export default function EndConcurrentDialog({
  employeeId,
  assignment,
  open,
  onOpenChange,
  onSuccess,
}: EndConcurrentDialogProps) {
  const t = useTranslations('employee')

  const [endDate, setEndDate] = useState(getToday)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!assignment) return null

  const label = [
    assignment.companyName,
    assignment.departmentName,
    assignment.positionTitle,
  ]
    .filter(Boolean)
    .join(' · ')

  const handleSubmit = async () => {
    if (!endDate) {
      setError(t('concurrentEndDateRequired'))
      return
    }

    if (endDate < assignment.effectiveDate) {
      setError(t('concurrentEndDateAfterStart', { date: assignment.effectiveDate }))
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await apiClient.patch(
        `/api/v1/employees/${employeeId}/assignments/${assignment.id}/end`,
        {
          endDate,
          reason: reason || undefined,
        },
      )

      toast({ title: t('concurrentEndSuccess') })
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('concurrentEndError')
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t('concurrentEndTitle')}</DialogTitle>
          <DialogDescription>
            {label} {t('concurrentEndDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 종료일 */}
          <div className="grid gap-2">
            <Label htmlFor="endDate">{t('concurrentEndDateLabel')}</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              min={assignment.effectiveDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* 사유 */}
          <div className="grid gap-2">
            <Label htmlFor="endReason">{t('assignmentReason')}</Label>
            <Input
              id="endReason"
              placeholder={t('concurrentEndReasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? t('processing') : t('assignmentEnd')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
