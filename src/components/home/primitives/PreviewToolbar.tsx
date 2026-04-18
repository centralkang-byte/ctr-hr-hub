'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PreviewToolbar primitive
// 공용 viewport 스위처 + 다크모드 토글 + viewport-constrained wrapper.
// R3에서 /home-preview (primitive showcase) + 4 역할 pilot client가 공유.
// Session 177 ManagerPilotClient / PreviewClient의 ~60줄 툴바 중복을 이관.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Monitor, Moon, Smartphone, Sun, Tablet } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

type Viewport = 'mobile' | 'tablet' | 'desktop' | 'full'

interface PreviewToolbarProps {
  /** 좌측 상단 헤드라인 — 예: `home.preview.title` 또는 `home.manager.v2.pilotBanner.title` */
  title: string
  /** 헤드라인 보조 문자열 — env label, 사용자 이메일 등. Codex Gate 1 F: ReactNode → string */
  subtitle: string
  /** Viewport-constrained 영역 내용 */
  children: React.ReactNode
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

const VIEWPORT_ORDER: Viewport[] = ['mobile', 'tablet', 'desktop', 'full']

// ─── Component ──────────────────────────────────────────────

/**
 * Preview chrome — viewport max-width simulator + dark/light toggle.
 *
 * NOTE: max-width 기반 preview는 실제 viewport를 바꾸지 않아 Tailwind breakpoint는
 * 트리거되지 않는다. 정확한 모바일/태블릿 레이아웃 검증은 브라우저 DevTools의
 * Device Emulation 사용 (Codex R1 Gate 2 P2 안내 유지).
 */
export function PreviewToolbar({ title, subtitle, children }: PreviewToolbarProps) {
  const [viewport, setViewport] = useState<Viewport>('full')
  const { setTheme, resolvedTheme } = useTheme()
  const t = useTranslations('home.preview')

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-card px-4 py-3">
        <div className="flex flex-col gap-0.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{title}</span>
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          </div>
          <p className="text-[11px] leading-[1.4] text-muted-foreground">
            {t('breakpointHint')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {VIEWPORT_ORDER.map((vp) => {
            const Icon = VIEWPORT_ICON[vp]
            const isActive = viewport === vp
            const vpLabel = t(`viewport.${vp}` as 'viewport.mobile')
            return (
              <button
                key={vp}
                type="button"
                onClick={() => setViewport(vp)}
                aria-label={t('viewport.switchTo', { viewport: vpLabel })}
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
              resolvedTheme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')
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
            {resolvedTheme === 'dark' ? t('theme.light') : t('theme.dark')}
          </button>
        </div>
      </div>

      {/* Viewport-constrained content */}
      <div
        className={cn(
          'mx-auto w-full transition-[max-width] duration-300',
          VIEWPORT_WIDTH[viewport],
        )}
      >
        {children}
      </div>
    </div>
  )
}
