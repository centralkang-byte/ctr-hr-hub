'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — EndConcurrentDialog
// B-3: 겸직(secondary assignment) 종료 다이얼로그
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
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
      setError('종료일을 입력해주세요.')
      return
    }

    if (endDate < assignment.effectiveDate) {
      setError(`종료일은 발효일(${assignment.effectiveDate}) 이후여야 합니다.`)
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

      toast({ title: '겸직이 종료되었습니다.' })
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '겸직 종료 중 오류가 발생했습니다.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>겸직 종료</DialogTitle>
          <DialogDescription>
            {label} 겸직을 종료합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 종료일 */}
          <div className="grid gap-2">
            <Label htmlFor="endDate">종료일 *</Label>
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
            <Label htmlFor="endReason">사유</Label>
            <Input
              id="endReason"
              placeholder="종료 사유를 입력하세요"
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
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '처리 중...' : '종료'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
