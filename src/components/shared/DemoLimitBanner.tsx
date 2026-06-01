'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — DemoLimitBanner (N+55 codebase SSOT)
// 위저드 마지막 step에서 데모 한계 안내 — proto `_design-reference/ui.jsx:231-243` 정합
// ═══════════════════════════════════════════════════════════

import { AlertCircle, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  icon?: LucideIcon
  message?: string
  className?: string
}

// ─── Component ──────────────────────────────────────────────

export function DemoLimitBanner({ icon: Icon = AlertCircle, message, className }: Props) {
  const t = useTranslations('demoLimitBanner')
  const displayMessage = message ?? t('defaultMessage')

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2 rounded-md bg-warning-bright/15 px-3 py-2 text-xs text-ctr-warning',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{displayMessage}</span>
    </div>
  )
}
