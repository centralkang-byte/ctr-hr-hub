'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/StatusBadge'

// ─── Types ──────────────────────────────────────────────────

interface GoalProgressItem {
  id: string
  goalId: string
  snapshotTitle: string
  snapshotWeight: number
  snapshotTarget?: string | null
  progressPct: number
  employeeComment: string | null
  managerComment: string | null
  trackingStatus: string | null
  isRevisedMidQuarter?: boolean
}

interface Props {
  items: GoalProgressItem[]
  canEditEmployee: boolean
  canEditManager: boolean
  onChange: (goalProgressId: string, field: string, value: string | number) => void
}

// ─── Constants ──────────────────────────────────────────────

const TRACKING_COLORS: Record<string, string> = {
  ON_TRACK: 'bg-emerald-500',
  AT_RISK: 'bg-amber-500',
  BEHIND: 'bg-red-500',
}

// ─── Component ──────────────────────────────────────────────

export default function GoalProgressSection({ items, canEditEmployee, canEditManager, onChange }: Props) {
  const t = useTranslations('performance.quarterlyReview')

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {t('empty.description')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="bg-muted/30 rounded-xl p-5 space-y-3">
          {/* Goal header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">{item.snapshotTitle}</h4>
              <span className="text-xs text-muted-foreground">
                {t('field.progressPct')}: {item.snapshotWeight}%
              </span>
            </div>
            {item.trackingStatus && (
              <StatusBadge status={item.trackingStatus}>
                {t(`tracking.${item.trackingStatus}`)}
              </StatusBadge>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  TRACKING_COLORS[item.trackingStatus ?? 'ON_TRACK'] ?? 'bg-primary',
                )}
                style={{ width: `${Math.min(item.progressPct, 100)}%` }}
              />
            </div>
            {canEditEmployee ? (
              <Input
                type="number"
                min={0}
                max={100}
                value={item.progressPct}
                onChange={(e) => onChange(item.id, 'progressPct', parseInt(e.target.value) || 0)}
                className="w-16 h-8 text-center text-sm"
              />
            ) : (
              <span className="text-sm font-medium tabular-nums font-mono w-12 text-right">
                {item.progressPct}%
              </span>
            )}
          </div>

          {/* Phase C: 목표 수정됨 경고 배너 */}
          {item.isRevisedMidQuarter && (
            <div className="rounded-2xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              {t('revisedMidQuarter')}
            </div>
          )}

          {item.snapshotTarget && (
            <p className="text-xs text-muted-foreground">{t('field.target')}: {item.snapshotTarget}</p>
          )}

          {/* Employee comment */}
          {(item.employeeComment !== null || canEditEmployee) && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t('field.employeeComment')}
              </label>
              {canEditEmployee ? (
                <Textarea
                  value={item.employeeComment ?? ''}
                  onChange={(e) => onChange(item.id, 'employeeComment', e.target.value)}
                  placeholder={t('field.goalHighlightsPlaceholder')}
                  className="min-h-[60px] text-sm"
                />
              ) : (
                <p className="text-sm">{item.employeeComment}</p>
              )}
            </div>
          )}

          {/* Manager comment */}
          {(item.managerComment !== null || canEditManager) && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t('field.managerComment')}
              </label>
              {canEditManager ? (
                <Textarea
                  value={item.managerComment ?? ''}
                  onChange={(e) => onChange(item.id, 'managerComment', e.target.value)}
                  placeholder={t('field.managerFeedbackPlaceholder')}
                  className="min-h-[60px] text-sm"
                />
              ) : (
                <p className="text-sm">{item.managerComment}</p>
              )}
            </div>
          )}

          {/* Manager tracking status selector */}
          {canEditManager && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">{t('field.trackingStatusLabel')}:</label>
              {(['ON_TRACK', 'AT_RISK', 'BEHIND'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => onChange(item.id, 'trackingStatus', status)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                    item.trackingStatus === status
                      ? status === 'ON_TRACK'
                        ? 'bg-emerald-500/15 text-emerald-700'
                        : status === 'AT_RISK'
                          ? 'bg-amber-500/15 text-amber-700'
                          : 'bg-red-500/15 text-red-700'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {t(`tracking.${status}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
