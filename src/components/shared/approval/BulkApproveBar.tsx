'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bulk Approve Floating Bar
// Phase 2 P1-7: Workday BulkActionBar 위 인플레이스 리스킨.
// Props/i18n(myTasks) 그대로 — 유일 소비처 ApprovalTabContent 무변경.
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import { CheckSquare } from 'lucide-react'
import { BulkActionBar } from '@/components/shared/BulkActionBar'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  selectedCount: number
  onBulkApprove: () => void
  onClearSelection: () => void
}

// ─── Component ──────────────────────────────────────────────

export function BulkApproveBar({ selectedCount, onBulkApprove, onClearSelection }: Props) {
  const t = useTranslations('myTasks')

  return (
    <BulkActionBar
      count={selectedCount}
      label={t('selectedCount', { count: selectedCount })}
      onClear={onClearSelection}
      clearAriaLabel={t('clearSelection')}
      actions={[
        {
          label: t('bulkApprove'),
          icon: CheckSquare,
          primary: true,
          onClick: onBulkApprove,
        },
      ]}
    />
  )
}
