'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bulk Approve Progress Modal
// 일괄 승인 진행 상태 + 확인 모달
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  count: number
  onClose: () => void
  onConfirm: () => Promise<void>
}

// ─── Component ──────────────────────────────────────────────

export function BulkApproveProgressModal({ count, onClose, onConfirm }: Props) {
  const t = useTranslations('myTasks')
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
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{t('bulkApprove')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            disabled={submitting}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          {t('bulkConfirm', { count })}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button
            size="sm"
            className={BUTTON_VARIANTS.primary}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('bulkApprove')}
          </Button>
        </div>
      </div>
    </div>
  )
}
