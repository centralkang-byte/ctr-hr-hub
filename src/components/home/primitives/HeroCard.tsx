'use client'

import Link from 'next/link'
import { ArrowRight, Sunrise, Target, PartyPopper, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ELEVATION, MOTION, TYPOGRAPHY } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

interface HeroCta {
  label: string
  href: string
}

interface HeroFocus {
  title: string
  description?: string
  cta: HeroCta
}

interface HeroSecondary {
  label: string
  href: string
  icon?: LucideIcon
}

interface HeroCardProps {
  /** "좋은 아침입니다, 홍길동님" 등 */
  greeting: string
  /** 오늘의 포커스 액션 — title + CTA. title은 한국어 문장 */
  focus: HeroFocus
  /** 최대 2개 보조 링크 */
  secondary?: HeroSecondary[]
  /** 시각 일러스트 — 시간대/상황에 따라 선택 */
  illustration?: 'sunrise' | 'focus' | 'celebration'
  className?: string
}

// ─── Illustration map ───────────────────────────────────────

const ILLUSTRATION_ICON: Record<NonNullable<HeroCardProps['illustration']>, LucideIcon> = {
  sunrise: Sunrise,
  focus: Target,
  celebration: PartyPopper,
}

// ─── Component ──────────────────────────────────────────────

/**
 * Focus-first hero widget.
 * Greeting + 오늘의 핵심 액션 1개 + 최대 2 secondary links.
 * Accessibility: semantic section, primary CTA 44px tap, focus-visible ring,
 * illustration icon is decorative (aria-hidden).
 */
export function HeroCard({
  greeting,
  focus,
  secondary = [],
  illustration,
  className,
}: HeroCardProps) {
  const Illustration = illustration ? ILLUSTRATION_ICON[illustration] : null

  return (
    <section
      aria-label={greeting}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-card p-6 md:p-8',
        'bg-gradient-to-br from-primary/5 via-transparent to-accent/5',
        ELEVATION.sm,
        className,
      )}
    >
      {/* Greeting */}
      <p className={TYPOGRAPHY.heroGreeting}>{greeting}</p>

      {/* Focus title + description */}
      <div className="mt-3 max-w-2xl">
        <h2 className={cn(TYPOGRAPHY.cardTitle, 'leading-[1.4]')}>
          {focus.title}
        </h2>
        {focus.description ? (
          <p className="mt-2 text-sm text-muted-foreground leading-[1.5]">
            {focus.description}
          </p>
        ) : null}
      </div>

      {/* Primary CTA + Secondary links */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link
          href={focus.cta.href}
          className={cn(
            'inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground',
            'hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            MOTION.microOut,
          )}
        >
          {focus.cta.label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>

        {secondary.slice(0, 2).map((s) => {
          const Icon = s.icon
          return (
            <Link
              key={s.href}
              href={s.href}
              className={cn(
                'inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-medium text-foreground',
                'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                MOTION.microOut,
              )}
            >
              {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
              {s.label}
            </Link>
          )
        })}
      </div>

      {/* Illustration — decorative, top-right, hidden on mobile */}
      {Illustration ? (
        <Illustration
          className="pointer-events-none absolute -right-2 -top-2 hidden h-32 w-32 text-primary/10 md:block"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      ) : null}
    </section>
  )
}
