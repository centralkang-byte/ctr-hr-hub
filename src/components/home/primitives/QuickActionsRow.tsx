'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — QuickActionsRow (Wave 1 홈)
// 프로토타입 SSOT: _design-reference/page-dashboard-workday.jsx:216-237 (wd-quick-row)
//                  styles.css:1097-1123 (.wd-quick — pill 칩 + 22px ico)
// 라벨 원칙 (Codex G1 P1-6): 직접 생성 URL이 있을 때만 액션 라벨,
//   없으면 "X 관리"로 강등 — 동작 과장 금지. 라벨/href는 caller가 결정.
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOTION } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

export interface QuickAction {
  id: string
  icon: LucideIcon
  label: string
  href: string
}

interface QuickActionsRowProps {
  actions: QuickAction[]
  /** `<nav aria-label>` — 예: "빠른 작업" */
  ariaLabel: string
  className?: string
}

// ─── Component ──────────────────────────────────────────────

/**
 * 홈 상단 빠른 작업 pill 행 (proto .wd-quick-row).
 * a11y: nav + list 구조, 44px 터치 타깃, focus-visible ring.
 */
export function QuickActionsRow({ actions, ariaLabel, className }: QuickActionsRowProps) {
  return (
    <nav aria-label={ariaLabel} className={className}>
      <ul role="list" className="flex flex-wrap gap-2.5">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <li key={action.id} className="list-none">
              <Link
                href={action.href}
                className={cn(
                  'inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-card py-2 pl-3.5 pr-4',
                  'text-[13px] font-medium text-foreground',
                  'hover:border-primary hover:text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  MOTION.microOut,
                )}
              >
                <span
                  className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-primary/10 text-primary"
                  aria-hidden="true"
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                {action.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
