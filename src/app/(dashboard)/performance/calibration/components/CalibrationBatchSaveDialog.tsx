'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Calibration Batch Save Dialog
// 배치 조정 확인 + 사유 입력 + 분포 미리보기
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { PendingChange } from '../hooks/useBatchAdjustmentState'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pendingChanges: Map<string, PendingChange>
  distribution: Record<number, number>
  isSaving: boolean
  onSave: (sharedReason: string) => void
}

// ─── Constants ──────────────────────────────────────────────

const BLOCK_LABELS: Record<number, string> = {
  1: '1A', 2: '2A', 3: '3A',
  4: '1B', 5: '2B', 6: '3B',
  7: '1C', 8: '2C', 9: '3C',
}

// ─── Component ──────────────────────────────────────────────

export default function CalibrationBatchSaveDialog({
  open,
  onOpenChange,
  pendingChanges,
  distribution,
  isSaving,
  onSave,
}: Props) {
  const t = useTranslations('performance')
  const [sharedReason, setSharedReason] = useState('')
  const [showPerEmployee, setShowPerEmployee] = useState(false)

  const changes = Array.from(pendingChanges.values())
  const isValid = sharedReason.trim().length >= 10
  const totalEmployees = Object.values(distribution).reduce((s, n) => s + n, 0)

  const handleSave = () => {
    if (!isValid || isSaving) return
    onSave(sharedReason.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('calibrationBatch.saveTitle')}</DialogTitle>
          <DialogDescription>
            {t('calibrationBatch.saveDesc', { count: changes.length })}
          </DialogDescription>
        </DialogHeader>

        {/* 변경 요약 테이블 */}
        <div className="rounded-2xl bg-background p-3 space-y-1 max-h-[200px] overflow-y-auto">
          <div className="grid grid-cols-[1fr_60px_20px_60px] gap-1 text-xs font-medium text-muted-foreground px-1 pb-1">
            <span>{t('calibrationBatch.employee')}</span>
            <span className="text-center">{t('calibrationBatch.from')}</span>
            <span />
            <span className="text-center">{t('calibrationBatch.to')}</span>
          </div>
          {changes.map((c) => (
            <div
              key={c.employeeId}
              className="grid grid-cols-[1fr_60px_20px_60px] gap-1 items-center text-sm px-1 py-0.5 rounded-lg hover:bg-muted/50"
            >
              <span className="truncate">{c.employeeName}</span>
              <span className="text-center text-xs text-muted-foreground">{BLOCK_LABELS[c.fromBlock]}</span>
              <span className="text-center text-xs text-muted-foreground">→</span>
              <span className="text-center text-xs font-medium text-primary">{BLOCK_LABELS[c.toBlock]}</span>
            </div>
          ))}
        </div>

        {/* 분포 미리보기 */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t('calibrationBatch.distributionPreview')}</span>
          <div className="flex gap-0.5 h-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
              const count = distribution[num] ?? 0
              const pct = totalEmployees > 0 ? (count / totalEmployees) * 100 : 0
              return (
                <div
                  key={num}
                  className={cn(
                    'rounded-sm flex items-center justify-center text-[9px] font-medium',
                    count > 0 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                  style={{ width: `${Math.max(pct, 5)}%` }}
                  title={`${BLOCK_LABELS[num]}: ${count}명 (${pct.toFixed(1)}%)`}
                >
                  {count > 0 && BLOCK_LABELS[num]}
                </div>
              )
            })}
          </div>
        </div>

        {/* 공통 사유 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            {t('calibrationBatch.sharedReason')} <span className="text-destructive">*</span>
          </label>
          <textarea
            rows={3}
            value={sharedReason}
            onChange={(e) => setSharedReason(e.target.value)}
            placeholder={t('calibrationBatch.reasonPlaceholder')}
            className="w-full px-3 py-2 rounded-xl text-sm bg-background focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground resize-none"
          />
          <div className="flex items-center justify-between">
            <span className={cn(
              'text-xs',
              sharedReason.trim().length < 10 ? 'text-destructive' : 'text-muted-foreground',
            )}>
              {sharedReason.trim().length}/10+
            </span>
            {!isValid && sharedReason.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="w-3 h-3" />
                {t('calibrationBatch.reasonTooShort')}
              </span>
            )}
          </div>
        </div>

        {/* 개별 사유 오버라이드 */}
        <button
          onClick={() => setShowPerEmployee(!showPerEmployee)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showPerEmployee ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {t('calibrationBatch.perEmployeeReason')}
        </button>

        {showPerEmployee && (
          <div className="space-y-2 max-h-[150px] overflow-y-auto">
            {changes.map((c) => (
              <div key={c.employeeId} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 truncate">{c.employeeName}</span>
                <input
                  type="text"
                  placeholder={t('calibrationBatch.optionalReason')}
                  value={c.reason ?? ''}
                  onChange={(_e) => {
                    // 직접 Map 수정 대신 상위에서 관리 — 여기서는 read-only 표시
                    // TODO: 개별 사유 편집은 pendingChanges 업데이트 필요 시 훅 확장
                  }}
                  disabled
                  className="flex-1 px-2 py-1 text-xs rounded-lg bg-background text-muted-foreground"
                />
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-background transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || isSaving}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
              'bg-primary text-white hover:bg-primary/90 disabled:opacity-50',
            )}
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? t('calibrationBatch.saving') : t('calibrationBatch.confirmSave')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
