'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Reject Reason Modal
// 반려 사유 입력 모달 (min 10자, max 500자)
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  title: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}

// ─── Component ──────────────────────────────────────────────

export function RejectReasonModal({ title, onClose, onConfirm }: Props) {
  const t = useTranslations('myTasks')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    const trimmed = reason.trim()
    if (trimmed.length < 10) {
      setError(t('rejectReasonMinLength'))
      return
    }
    setSubmitting(true)
    try {
      await onConfirm(trimmed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{t('rejectReason')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Target */}
        <div className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {title}
        </div>

        {/* Reason textarea */}
        <textarea
          className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
          rows={4}
          maxLength={500}
          placeholder={t('rejectReasonRequired')}
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError('') }}
        />
        <div className="mt-1 flex items-center justify-between">
          {error ? (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          ) : <span />}
          <span className="text-[10px] text-muted-foreground">{reason.length}/500</span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button
            size="sm"
            className="bg-destructive/90 text-white hover:bg-destructive"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('rejectConfirm')}
          </Button>
        </div>
      </div>
    </div>
  )
}
