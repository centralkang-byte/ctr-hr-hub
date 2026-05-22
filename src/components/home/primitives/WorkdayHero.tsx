'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — WorkdayHero (PR-5A HR Admin 대시보드 카나리)
// 프로토타입 SSOT: _design-reference/page-dashboard-workday.jsx:180-213 (wd-hero 섹션)
// HR Admin 전용 — navy 그라데이션 + eyebrow date + greeting + sub(N건/M건 강조) + CTA 2 + 우측 3-KPI
// 다른 역할 홈은 기존 HeroCard 유지 (HeroCard.tsx 파일 보존)
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ELEVATION, MOTION, TYPOGRAPHY } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

interface HeroCta {
  label: string
  href: string
}

interface HeroKpi {
  /** 큰 숫자 (이미 포맷된 문자열 또는 숫자) */
  value: string | number
  /** 라벨 */
  label: string
}

interface WorkdayHeroProps {
  /** "안녕하세요, {name}님" 사전 포맷 */
  greeting: string
  /** "2026년 5월 21일 목요일" formatToTz 사전 포맷 */
  dateStr: string
  /** 전체 처리 건수 (pendingLeaves + delayed onboarding) */
  totalActions: number
  /** 연체 건수 (overdue, urgentCount) — wd-orange 강조 */
  overdueCount: number
  /** "오늘 처리하실 일이 {N}건 있어요. 그중 {M}건은..." 카피의 N/M 슬롯 */
  copyTemplate: {
    /** "오늘 처리하실 일이 " (앞부분) */
    before: string
    /** "건 있어요. 그중 " (중간) */
    middle: string
    /** "건은 시작일이 지났으니 먼저 살펴봐 주세요." (뒷부분) */
    after: string
  }
  /** 우측 3-KPI */
  kpis: { headcount: HeroKpi; openRoles: HeroKpi; turnoverRate: HeroKpi }
  /** Primary CTA (white bg) */
  ctaPrimary: HeroCta
  /** Secondary CTA (ghost border-white) */
  ctaSecondary: HeroCta
  className?: string
}

// ─── HeroScene SVG (decorative, aria-hidden) ────────────────

/**
 * 프로토타입 wd-hero-scene 단순화 — 빌딩 실루엣 + 점 패턴.
 * 모든 stroke/fill은 currentColor 기반 (text-white/10 등으로 조절).
 */
function HeroScene() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 200"
      className="pointer-events-none absolute inset-y-0 right-0 h-full w-2/3 text-white/10"
      preserveAspectRatio="xMaxYMid slice"
    >
      <defs>
        <pattern id="wd-dot" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="400" height="200" fill="url(#wd-dot)" opacity="0.4" />
      {/* 빌딩 실루엣 4개 */}
      <g fill="currentColor" opacity="0.6">
        <rect x="200" y="80" width="40" height="120" />
        <rect x="248" y="50" width="50" height="150" />
        <rect x="306" y="100" width="35" height="100" />
        <rect x="349" y="70" width="45" height="130" />
      </g>
      {/* 곡선 */}
      <path
        d="M0,180 Q100,140 200,160 T400,150"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.5"
      />
    </svg>
  )
}

// ─── Component ──────────────────────────────────────────────

/**
 * Workday-style navy hero banner.
 * 모바일 (<md): 3-KPI 숨김, 세로 스택.
 * a11y: section aria-labelledby, decorative SVG aria-hidden, focus-visible ring.
 */
export function WorkdayHero({
  greeting,
  dateStr,
  totalActions,
  overdueCount,
  copyTemplate,
  kpis,
  ctaPrimary,
  ctaSecondary,
  className,
}: WorkdayHeroProps) {
  const labelId = 'workday-hero-title'

  return (
    <section
      aria-labelledby={labelId}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary-dim text-white',
        'p-6 md:p-8',
        ELEVATION.sm,
        className,
      )}
    >
      <HeroScene />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          {/* Eyebrow date */}
          <p className="text-xs font-medium text-white/70">{dateStr}</p>

          {/* Greeting */}
          <h1 id={labelId} className={cn(TYPOGRAPHY.cardTitle, 'mt-1 text-white')}>
            {greeting}
          </h1>

          {/* Sub copy with N/M emphasis */}
          <p className="mt-2 text-sm leading-[1.5] text-white/85">
            {copyTemplate.before}
            <strong className="font-semibold text-white">{totalActions}</strong>
            {copyTemplate.middle}
            <strong className="font-semibold text-wd-orange">{overdueCount}</strong>
            {copyTemplate.after}
          </p>

          {/* CTA row */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link
              href={ctaPrimary.href}
              className={cn(
                'inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-primary',
                'hover:bg-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary',
                MOTION.microOut,
              )}
            >
              {ctaPrimary.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={ctaSecondary.href}
              className={cn(
                'inline-flex min-h-[44px] items-center rounded-full border border-white/40 bg-transparent px-4 text-sm font-medium text-white',
                'hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary',
                MOTION.microOut,
              )}
            >
              {ctaSecondary.label}
            </Link>
          </div>
        </div>

        {/* Right 3-KPI — md+ only */}
        <dl className="hidden gap-6 md:flex md:flex-row md:items-end">
          {[kpis.headcount, kpis.openRoles, kpis.turnoverRate].map((k, i) => (
            <div key={i} className="flex flex-col items-end">
              <dd className={cn(TYPOGRAPHY.displaySm, 'font-mono tabular-nums text-white')}>
                {k.value}
              </dd>
              <dt className="text-xs text-white/70">{k.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
