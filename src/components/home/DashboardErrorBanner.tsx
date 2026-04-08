'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Dashboard Error Banner
// 대시보드 위젯 fetch 실패 시 인라인 에러 표시 + 재시도.
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  message: string
  onRetry?: () => void
  className?: string
}

// ─── Component ──────────────────────────────────────────────

export function DashboardErrorBanner({ message, onRetry, className }: Props) {
  const t = useTranslations('common')

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl bg-error-container/5 py-8 text-center',
        className,
      )}
    >
      <AlertCircle className="mb-2 h-7 w-7 text-error/60" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <RefreshCw className="h-3 w-3" />
          {t('retry')}
        </button>
      )}
    </div>
  )
}
