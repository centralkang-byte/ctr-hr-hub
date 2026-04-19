import Link from 'next/link'
import { Sparkles, Megaphone, Info, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOTION } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

type InsightKind = 'ai-suggestion' | 'announcement' | 'system'

interface InsightAction {
  label: string
  href: string
}

interface InsightStripProps {
  kind: InsightKind
  message: string
  icon?: LucideIcon
  action?: InsightAction
  className?: string
  /** aria-labelledby target id — 부모에서 heading 제공 시. 없으면 aria-label로 대체 */
  labelId?: string
}

// ─── Style map ──────────────────────────────────────────────

const KIND_ICON: Record<InsightKind, LucideIcon> = {
  'ai-suggestion': Sparkles,
  announcement: Megaphone,
  system: Info,
}

const KIND_STYLE: Record<InsightKind, string> = {
  'ai-suggestion': 'bg-primary/5 text-foreground',
  announcement: 'bg-[#6366f1]/10 text-[#4f46e5]',
  system: 'bg-warning-bright/10 text-ctr-warning',
}

const KIND_LABEL: Record<InsightKind, string> = {
  'ai-suggestion': 'AI 추천',
  announcement: '공지',
  system: '시스템 알림',
}

// ─── Component ──────────────────────────────────────────────

/**
 * 1-row context banner.
 * Codex Gate 1 Fix #4: persistent + action links → `<aside aria-label>` 사용.
 * `role="status"` + `aria-live` 금지 (static 컨텐츠를 live update처럼 읽는 오용).
 * Server component.
 */
export function InsightStrip({
  kind,
  message,
  icon,
  action,
  className,
  labelId,
}: InsightStripProps) {
  const Icon = icon ?? KIND_ICON[kind]

  return (
    <aside
      aria-labelledby={labelId}
      aria-label={labelId ? undefined : KIND_LABEL[kind]}
      className={cn(
        'flex items-center gap-3 rounded-lg px-4 py-2.5',
        KIND_STYLE[kind],
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-xs leading-[1.5]">{message}</p>
      {action ? (
        <Link
          href={action.href}
          className={cn(
            'inline-flex min-h-[44px] shrink-0 items-center gap-1 text-xs font-medium',
            'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-sm',
            MOTION.microOut,
          )}
        >
          {action.label}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </aside>
  )
}
