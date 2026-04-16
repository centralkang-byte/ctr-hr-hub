'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bulk Approve Floating Bar
// 선택 건수 + 일괄 승인 버튼 (pb-safe for iOS)
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import { CheckSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  selectedCount: number
  onBulkApprove: () => void
  onClearSelection: () => void
}

// ─── Component ──────────────────────────────────────────────

export function BulkApproveBar({ selectedCount, onBulkApprove, onClearSelection }: Props) {
  const t = useTranslations('myTasks')

  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 pb-safe">
      <div className="flex items-center gap-3 rounded-2xl bg-foreground px-5 py-3 text-white shadow-lg">
        <CheckSquare className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          {t('selectedCount', { count: selectedCount })}
        </span>
        <Button
          size="sm"
          className={BUTTON_VARIANTS.primary}
          onClick={onBulkApprove}
        >
          {t('bulkApprove')}
        </Button>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-white"
          onClick={onClearSelection}
        >
          {t('clearSelection')}
        </button>
      </div>
    </div>
  )
}
