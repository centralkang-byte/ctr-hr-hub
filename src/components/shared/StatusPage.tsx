'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shared Status Page (Error/NotFound/Forbidden)
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { AlertCircle, FileQuestion, ShieldAlert, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ──────────────────────────────────────────────────

type StatusVariant = 'error' | 'notFound' | 'forbidden'

interface StatusPageProps {
  variant: StatusVariant
  digest?: string
  onRetry?: () => void
}

const ICON_MAP = {
  error: AlertCircle,
  notFound: FileQuestion,
  forbidden: ShieldAlert,
} as const

const ICON_CONTAINER_CLASS = {
  error: 'bg-destructive/10',
  notFound: 'bg-primary/10',
  forbidden: 'bg-destructive/10',
} as const

const ICON_CLASS = {
  error: 'text-ctr-accent',
  notFound: 'text-ctr-primary',
  forbidden: 'text-ctr-accent',
} as const

// ─── Component ──────────────────────────────────────────────

export default function StatusPage({ variant, digest, onRetry }: StatusPageProps) {
  const t = useTranslations('errorPage')
  const Icon = ICON_MAP[variant]

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 px-4">
      <div className="text-center">
        <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${ICON_CONTAINER_CLASS[variant]}`}>
          <Icon className={`h-10 w-10 ${ICON_CLASS[variant]}`} />
        </div>
        <h1 className="text-4xl font-bold text-foreground">
          {t(`${variant}.code`)}
        </h1>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          {t(`${variant}.title`)}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(`${variant}.description`)}
          <br />
          {t(`${variant}.action`)}
        </p>
        {digest && (
          <p className="mt-2 text-xs text-muted-foreground/60">
            {t('errorCode', { code: digest })}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          {onRetry && (
            <Button onClick={onRetry} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              {t('retry')}
            </Button>
          )}
          <Link href="/">
            <Button className="bg-ctr-primary hover:bg-ctr-primary/90">
              {t('goHome')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
