'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Profile Change Request Dialog
// 프로필 정보 수정 요청 독립 Dialog (AR-2: 폼 상태 격리)
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────

type EditableField = 'phone' | 'emergencyContact' | 'emergencyContactPhone' | 'name'

interface ChangeRequest {
  id: string
  fieldName: string
  oldValue: string | null
  newValue: string
  status: string
  rejectionReason: string | null
  reviewedAt: string | null
  reviewer: { id: string; name: string } | null
  createdAt: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  fieldKey: EditableField
  currentValue: string
  onSuccess: () => void
}

// ─── Constants ──────────────────────────────────────────────

const FIELD_LABELS: Record<EditableField, string> = {
  phone: '연락처 (개인)',
  emergencyContact: '비상연락처 이름',
  emergencyContactPhone: '비상연락처 전화번호',
  name: '이름',
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  CHANGE_PENDING: { label: '대기중', variant: 'default' },
  CHANGE_APPROVED: { label: '승인됨', variant: 'secondary' },
  CHANGE_REJECTED: { label: '반려됨', variant: 'destructive' },
}

// ─── Component ──────────────────────────────────────────────

export function ProfileChangeRequestDialog({ open, onOpenChange, fieldKey, currentValue, onSuccess }: Props) {
  const t = useTranslations('common')

  // Independent form state (AR-2: isolated from parent)
  const [newValue, setNewValue] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset form when dialog opens with new field
  useEffect(() => {
    if (open) {
      setNewValue('')
      setReason('')
    }
  }, [open, fieldKey])

  const handleSubmit = useCallback(async () => {
    if (!newValue.trim()) return
    setSubmitting(true)
    try {
      await apiClient.post('/api/v1/profile/change-requests', {
        fieldName: fieldKey,
        newValue: newValue.trim(),
        reason: reason.trim() || undefined,
      })
      toast({ title: '수정 요청이 제출되었습니다.' })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast({
        title: '요청 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }, [fieldKey, newValue, reason, onOpenChange, onSuccess])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>정보 변경 요청</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">{t('currentValue')}</p>
            <p className="text-sm font-medium">{currentValue || '-'}</p>
          </div>

          <div className="space-y-2">
            <Label>{FIELD_LABELS[fieldKey]} — 새로운 값</Label>
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="변경할 값을 입력하세요"
            />
          </div>

          <div className="space-y-2">
            <Label>변경 사유 (선택)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="변경이 필요한 이유를 입력하세요"
            />
            <p className="text-xs text-muted-foreground text-right">{reason.length}/500</p>
          </div>

          <p className="text-xs text-muted-foreground">
            HR 담당자의 승인 후 최종 반영됩니다.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !newValue.trim()}>
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {submitting ? '제출 중...' : '요청 제출'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Change Request History Section ─────────────────────────

interface HistoryProps {
  requests: ChangeRequest[]
}

export function ChangeRequestHistory({ requests }: HistoryProps) {
  if (requests.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">수정 요청 내역</h3>
      <div className="space-y-2">
        {requests.map((req) => {
          const badge = STATUS_BADGE[req.status] ?? { label: req.status, variant: 'outline' as const }
          return (
            <div key={req.id} className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {FIELD_LABELS[req.fieldName as EditableField] ?? req.fieldName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {req.oldValue ?? '-'} → {req.newValue}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(req.createdAt).toLocaleDateString('ko-KR')}
                  {req.rejectionReason && ` · 사유: ${req.rejectionReason}`}
                </p>
              </div>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}
