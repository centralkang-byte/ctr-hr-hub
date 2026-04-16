'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Approval Item Card
// 승인 탭용 카드 (체크박스 + 인라인 액션 + 우선순위 보더)
// 터치 타겟 44px, rounded-lg, tonal layering
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  CheckSquare,
  Square,
  CalendarDays,
  Target,
  Banknote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  UnifiedTaskType,
  UnifiedTaskStatus,
  UnifiedTaskPriority,
} from '@/lib/unified-task/types'
import type { UnifiedTask } from '@/lib/unified-task/types'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  task: UnifiedTask
  isSelected: boolean
  onToggle: (id: string) => void
  onApprove: (task: UnifiedTask) => void
  onReject: (task: UnifiedTask) => void
  processing: string | null
}

// ─── Constants ──────────────────────────────────────────────

const MODULE_CONFIG: Record<string, { labelKey: string; icon: React.ElementType; color: string }> = {
  [UnifiedTaskType.LEAVE_APPROVAL]: { labelKey: 'typeLeave', icon: CalendarDays, color: '#818CF8' },
  [UnifiedTaskType.PERFORMANCE_REVIEW]: { labelKey: 'typePerformance', icon: Target, color: '#8B5CF6' },
  [UnifiedTaskType.PAYROLL_REVIEW]: { labelKey: 'typePayroll', icon: Banknote, color: '#F59E0B' },
}

const PRIORITY_BORDER: Record<string, string> = {
  [UnifiedTaskPriority.URGENT]: 'border-l-4 border-l-[#EF4444]',
  [UnifiedTaskPriority.HIGH]: 'border-l-4 border-l-[#F59E0B]',
  [UnifiedTaskPriority.MEDIUM]: '',
  [UnifiedTaskPriority.LOW]: '',
}

// ─── Component ──────────────────────────────────────────────

export function ApprovalItemCard({ task, isSelected, onToggle, onApprove, onReject, processing }: Props) {
  const t = useTranslations('myTasks')
  const isPending = task.status === UnifiedTaskStatus.PENDING || task.status === UnifiedTaskStatus.IN_PROGRESS
  const isBusy = processing === task.id
  const config = MODULE_CONFIG[task.type]
  const Icon = config?.icon ?? CalendarDays
  const border = PRIORITY_BORDER[task.priority] ?? ''

  const dday = task.dueDate ? getDday(task.dueDate) : null
  const ddayStyle = task.dueDate ? getDdayStyle(task.dueDate) : ''

  return (
    <div className={`group rounded-lg bg-card p-4 transition-all duration-150 hover:shadow-sm ${border}`}>
      <div className="flex items-start gap-3">
        {/* Checkbox — 44px touch target */}
        {isPending ? (
          <button
            type="button"
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-primary"
            onClick={() => onToggle(task.id)}
            aria-label={t('selectItem')}
          >
            {isSelected
              ? <CheckSquare className="h-5 w-5 text-primary" />
              : <Square className="h-5 w-5" />
            }
          </button>
        ) : (
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center">
            {task.status === UnifiedTaskStatus.COMPLETED
              ? <CheckCircle2 className="h-5 w-5 text-primary" />
              : <XCircle className="h-5 w-5 text-red-500" />
            }
          </div>
        )}

        {/* Icon */}
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${config?.color ?? '#5E81F4'}15` }}
        >
          <Icon className="h-4 w-4" style={{ color: config?.color ?? '#5E81F4' }} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="h-5 shrink-0 rounded-md px-1.5 text-[10px] font-medium"
              style={{
                borderColor: `${config?.color ?? '#5E81F4'}40`,
                color: config?.color ?? '#5E81F4',
                backgroundColor: `${config?.color ?? '#5E81F4'}08`,
              }}
            >
              {config?.labelKey ? t(config.labelKey) : task.type}
            </Badge>
            {!!(task.metadata as Record<string, unknown>)?.delegated && (
              <Badge
                variant="outline"
                className="h-5 rounded-md border-indigo-200 bg-primary/10 px-1.5 text-[10px] font-medium text-violet-500"
              >
                {t('delegated')}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-foreground line-clamp-1">
            {task.title}
          </p>
          {task.summary && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {task.summary}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{task.requester?.name}</span>
            {task.requester?.department && (
              <>
                <span className="opacity-40">·</span>
                <span>{task.requester.department}</span>
              </>
            )}
          </div>
        </div>

        {/* Right side: D-day + Actions */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {dday && (
            <Badge variant="outline" className={`h-6 rounded-md px-2 text-[11px] font-semibold ${ddayStyle}`}>
              {dday}
            </Badge>
          )}
          {isPending && (
            <div className="flex items-center gap-1">
              {task.actions?.approveUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-[11px] text-primary/90 hover:bg-primary/10"
                  disabled={isBusy}
                  onClick={(e) => { e.stopPropagation(); onApprove(task) }}
                >
                  {isBusy
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <CheckCircle2 className="h-3.5 w-3.5" />
                  }
                  <span className="hidden sm:inline">{t('actionApprove')}</span>
                </Button>
              )}
              {task.actions?.rejectUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-[11px] text-red-500 hover:bg-destructive/10"
                  disabled={isBusy}
                  onClick={(e) => { e.stopPropagation(); onReject(task) }}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('actionReject')}</span>
                </Button>
              )}
              {task.actions?.detailUrl && (
                <Link href={task.actions.detailUrl}>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:bg-muted">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────

function getDday(dueDate: string): string | null {
  const diff = Math.ceil(
    (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  if (diff < 0) return `D+${Math.abs(diff)}`
  if (diff === 0) return 'D-Day'
  return `D-${diff}`
}

function getDdayStyle(dueDate: string): string {
  const diff = Math.ceil(
    (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  if (diff < 0) return 'bg-destructive/10 text-destructive border-destructive/20'
  if (diff <= 3) return 'bg-amber-500/15 text-amber-700 border-amber-300'
  return 'bg-primary/10 text-primary border-indigo-200'
}
