'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — ManagerPilotClient
// R2 pilot: ManagerHomeV2 + 얇은 viewport/dark-mode 툴바.
// 툴바는 /home-preview/PreviewClient.tsx의 패턴을 인라인 복제 — R3에서 4역할 pilot 확장 시 PreviewToolbar로 추출 예정.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { Monitor, Moon, Smartphone, Sun, Tablet } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import type { SessionUser } from '@/types'
import { cn } from '@/lib/utils'
import { ManagerHomeV2 } from '@/components/home/ManagerHomeV2'

// ─── Types ──────────────────────────────────────────────────

type Viewport = 'mobile' | 'tablet' | 'desktop' | 'full'

interface Props {
  user: SessionUser
}

// ─── Constants ──────────────────────────────────────────────

const VIEWPORT_WIDTH: Record<Viewport, string> = {
  mobile: 'max-w-[375px]',
  tablet: 'max-w-[768px]',
  desktop: 'max-w-[1280px]',
  full: 'max-w-[1440px]',
}

const VIEWPORT_ICON = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  full: Monitor,
} as const

// ─── Component ──────────────────────────────────────────────

export function ManagerPilotClient({ user }: Props) {
  const [viewport, setViewport] = useState<Viewport>('full')
  const { setTheme, resolvedTheme } = useTheme()
  const t = useTranslations('home.manager.v2.pilotBanner')
  const tPreview = useTranslations('home.preview')

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pilot Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-card px-4 py-3">
        <div className="flex flex-col gap-0.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{t('title')}</span>
            <span className="text-xs text-muted-foreground">
              {t('envLabel', { role: user.role })}
            </span>
          </div>
          <p className="text-[11px] leading-[1.4] text-muted-foreground">
            {tPreview('breakpointHint')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['mobile', 'tablet', 'desktop', 'full'] as Viewport[]).map((vp) => {
            const Icon = VIEWPORT_ICON[vp]
            const isActive = viewport === vp
            const vpLabel = tPreview(`viewport.${vp}` as 'viewport.mobile')
            return (
              <button
                key={vp}
                type="button"
                onClick={() => setViewport(vp)}
                aria-label={tPreview('viewport.switchTo', { viewport: vpLabel })}
                aria-pressed={isActive}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-muted/70',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{vpLabel}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              resolvedTheme === 'dark'
                ? tPreview('theme.switchToLight')
                : tPreview('theme.switchToDark')
            }
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-lg bg-muted px-3 text-xs font-medium hover:bg-muted/70',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {resolvedTheme === 'dark' ? tPreview('theme.light') : tPreview('theme.dark')}
          </button>
        </div>
      </div>

      {/* Viewport-constrained pilot */}
      <div
        className={cn(
          'mx-auto w-full transition-[max-width] duration-300',
          VIEWPORT_WIDTH[viewport],
        )}
      >
        <ManagerHomeV2 user={user} />
      </div>
    </div>
  )
}
