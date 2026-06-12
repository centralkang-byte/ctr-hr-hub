'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — WorkletGrid (PR-5A HR Admin 대시보드 카나리)
// 프로토타입 SSOT: _design-reference/page-dashboard-workday.jsx:247-266 (wd-worklets 섹션)
// 8 distinct colored 타일 — proto --wt-1~--wt-8 정합.
// HrAdminHomeV2 전용 — 표현 컴포넌트 (데이터는 caller에서 derive)
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ELEVATION, MOTION, TYPOGRAPHY } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

// Wave 1: proto --wt-1~8 토큰 배선 (styles.css:825-832 — 메뉴 매핑은 proto worklets 순서)
export type WorkletTone =
  | 'wt-1' // employees (navy)
  | 'wt-2' // attendance (teal)
  | 'wt-3' // recruitment (terracotta)
  | 'wt-4' // leave (purple)
  | 'wt-5' // performance (forest)
  | 'wt-6' // payroll (gold)
  | 'wt-7' // organization (steel)
  | 'wt-8' // analytics (coral)

export interface WorkletTile {
  id: string
  icon: LucideIcon
  tone: WorkletTone
  title: string
  subtitle: string
  href: string
  /** 우상단 배지 (옵셔널) — 미정의 시 미표시 */
  count?: number
}

interface WorkletGridProps {
  tiles: WorkletTile[]
  className?: string
}

// ─── Tone styles ────────────────────────────────────────────

const TILE_BG: Record<WorkletTone, string> = {
  'wt-1': 'bg-wt-1',
  'wt-2': 'bg-wt-2',
  'wt-3': 'bg-wt-3',
  'wt-4': 'bg-wt-4',
  'wt-5': 'bg-wt-5',
  'wt-6': 'bg-wt-6',
  'wt-7': 'bg-wt-7',
  'wt-8': 'bg-wt-8',
}

// ─── Component ──────────────────────────────────────────────

/**
 * 8 distinct colored worklet 타일 그리드.
 * - Mobile: 2 cols / sm: 3 cols / lg: 4 cols.
 * - 각 타일: Link wrapping article — 아이콘 + 제목·부제 2줄 가로 헤더 (컴팩트).
 */
export function WorkletGrid({ tiles, className }: WorkletGridProps) {
  return (
    <ul
      className={cn(
        // auto-rows-fr: 모든 행 등높이 (부제 줄바꿈 길이차로 카드 높이 어긋남 방지; 카드는 h-full로 채움)
        'grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4',
        className,
      )}
      role="list"
    >
      {tiles.map((tile) => {
        const Icon = tile.icon
        const titleId = `worklet-${tile.id}-title`

        return (
          <li key={tile.id} className="list-none">
            <Link
              href={tile.href}
              aria-labelledby={titleId}
              className={cn(
                // Wave 1: proto .wd-worklet — 1px 가시 보더 (styles.css:798-811)
                'relative flex h-full flex-col gap-2 rounded-2xl border border-border bg-card p-4',
                ELEVATION.xs,
                MOTION.hoverLift,
                'hover:-translate-y-0.5 hover:shadow-md',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
            >
              {/* Count badge — 우상단. Wave 1: proto .wd-w-count = wd-orange (styles.css:879-887) — 단순 대기 카운트, destructive 시맨틱 아님 */}
              {typeof tile.count === 'number' && tile.count > 0 ? (
                <span
                  className="absolute right-3 top-3 inline-flex min-w-[20px] items-center justify-center rounded-full bg-wd-orange px-1.5 text-xs font-semibold text-white"
                  aria-label={`${tile.count}건 대기`}
                >
                  {tile.count}
                </span>
              ) : null}

              {/* Header: 아이콘 + 2줄 텍스트(제목·부제) 가로 배치 — 세로 공간 절약 (CEO 컴팩트 요청, proto 세로 스택 대비 의도적 편차) */}
              <div className="flex items-center gap-3">
                {/* Icon tile 56×56 — proto .wd-tile (styles.css:816-833): wt 토큰 + 135deg 다크닝 그라데이션 */}
                <div
                  className={cn(
                    'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white',
                    'bg-gradient-to-br from-transparent to-black/15',
                    TILE_BG[tile.tone],
                  )}
                  aria-hidden="true"
                >
                  <Icon className="h-[26px] w-[26px]" strokeWidth={1.6} />
                </div>

                {/* Title + Subtitle */}
                <div className="min-w-0">
                  <h3 id={titleId} className={cn(TYPOGRAPHY.statLabel, 'text-sm font-semibold text-foreground')}>
                    {tile.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{tile.subtitle}</p>
                </div>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
