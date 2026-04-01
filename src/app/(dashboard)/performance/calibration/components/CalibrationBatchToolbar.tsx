'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Calibration Batch Toolbar
// 배치 모드 선택/이동/저장 플로팅 액션 바
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import { ArrowRight, RotateCcw, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  selectedCount: number
  pendingCount: number
  onMoveToBlock: (blockNum: number) => void
  onClearSelection: () => void
  onClearAll: () => void
  onOpenSaveDialog: () => void
}

// ─── Constants ──────────────────────────────────────────────

const BLOCK_OPTIONS = [
  { num: 9, label: '3C — Star' },
  { num: 8, label: '2C — Solid Contributor' },
  { num: 7, label: '1C — Enigma' },
  { num: 6, label: '3B — High Performer' },
  { num: 5, label: '2B — Core Player' },
  { num: 4, label: '1B — Dilemma' },
  { num: 3, label: '3A — Rough Diamond' },
  { num: 2, label: '2A — Inconsistent' },
  { num: 1, label: '1A — Under Performer' },
]

// ─── Component ──────────────────────────────────────────────

export default function CalibrationBatchToolbar({
  selectedCount,
  pendingCount,
  onMoveToBlock,
  onClearSelection,
  onClearAll,
  onOpenSaveDialog,
}: Props) {
  const t = useTranslations('performance')

  if (selectedCount === 0 && pendingCount === 0) return null

  return (
    <div className="sticky bottom-4 z-10 mx-auto max-w-2xl">
      <div className="flex items-center gap-3 rounded-full bg-card shadow-lg px-4 py-2.5 border border-border/50">
        {/* 선택 카운트 */}
        {selectedCount > 0 && (
          <>
            <span className="text-sm font-medium text-foreground whitespace-nowrap">
              {t('calibrationBatch.selectedCount', { count: selectedCount })}
            </span>

            {/* 블록 이동 드롭다운 */}
            <div className="flex items-center gap-1">
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  if (!isNaN(val)) onMoveToBlock(val)
                  e.target.value = ''
                }}
                defaultValue=""
                className="text-sm bg-transparent border-none focus:ring-0 text-primary cursor-pointer pr-6"
              >
                <option value="" disabled>{t('calibrationBatch.moveToBlock')}</option>
                {BLOCK_OPTIONS.map((opt) => (
                  <option key={opt.num} value={opt.num}>{opt.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={onClearSelection}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {pendingCount > 0 && (
              <div className="w-px h-4 bg-border" />
            )}
          </>
        )}

        {/* Pending 카운트 + 액션 */}
        {pendingCount > 0 && (
          <>
            <span className={cn(
              'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
              'bg-primary/10 text-primary',
            )}>
              {t('calibrationBatch.pendingCount', { count: pendingCount })}
            </span>

            <button
              onClick={onClearAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={t('calibrationBatch.undoAll')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onOpenSaveDialog}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {t('calibrationBatch.reviewAndSave')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
