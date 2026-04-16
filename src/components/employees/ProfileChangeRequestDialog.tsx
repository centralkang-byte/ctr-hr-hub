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
  phone: 'profileChangePhone',
  emergencyContact: 'profileChangeEmergencyName',
  emergencyContactPhone: 'profileChangeEmergencyPhone',
  name: 'profileChangeName',
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  CHANGE_PENDING: { label: 'profileChangeStatusPending', variant: 'default' },
  CHANGE_APPROVED: { label: 'profileChangeStatusApproved', variant: 'secondary' },
  CHANGE_REJECTED: { label: 'profileChangeStatusRejected', variant: 'destructive' },
}

// ─── Component ──────────────────────────────────────────────

export function ProfileChangeRequestDialog({ open, onOpenChange, fieldKey, currentValue, onSuccess }: Props) {
  const t = useTranslations('common')
  const te = useTranslations('employee')

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
      toast({ title: te('profileChangeSubmitSuccess') })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast({
        title: te('profileChangeSubmitError'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }, [fieldKey, newValue, reason, onOpenChange, onSuccess, te])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{te('profileChangeTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">{t('currentValue')}</p>
            <p className="text-sm font-medium">{currentValue || '-'}</p>
          </div>

          <div className="space-y-2">
            <Label>{te(FIELD_LABELS[fieldKey])}{te('profileChangeNewValue')}</Label>
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={te('profileChangeEnterValue')}
            />
          </div>

          <div className="space-y-2">
            <Label>{te('profileChangeReasonLabel')}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={te('profileChangeReasonPlaceholder')}
            />
            <p className="text-xs text-muted-foreground text-right">{reason.length}/500</p>
          </div>

          <p className="text-xs text-muted-foreground">
            {te('profileChangeHrNotice')}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {te('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !newValue.trim()}>
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {submitting ? te('profileChangeSubmitting') : te('profileChangeSubmitButton')}
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
  const te = useTranslations('employee')

  if (requests.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{te('profileChangeHistoryTitle')}</h3>
      <div className="space-y-2">
        {requests.map((req) => {
          const badge = STATUS_BADGE[req.status] ?? { label: req.status, variant: 'outline' as const }
          const fieldLabelKey = FIELD_LABELS[req.fieldName as EditableField]
          return (
            <div key={req.id} className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {fieldLabelKey ? te(fieldLabelKey) : req.fieldName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {req.oldValue ?? '-'} → {req.newValue}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(req.createdAt).toLocaleDateString('ko-KR')}
                  {req.rejectionReason && ` · ${te('profileChangeReasonPrefix')}${req.rejectionReason}`}
                </p>
              </div>
              <Badge variant={badge.variant}>{te(badge.label)}</Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}
