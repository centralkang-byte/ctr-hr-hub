'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — WdLeaveBalanceCard (Phase 3a Stage4 PR-1)
// WdGroupedStatCard 위 얇은 휴가 도메인 래퍼.
// 카테고리 그룹핑 + 잔여율 의미색(Q7) 주입. 잔여 카드 SSOT.
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  WdGroupedStatCard,
  type WdGroupedStatGroup,
  type WdStatTone,
} from '@/components/shared/WdGroupedStatCard'

// ─── Types ──────────────────────────────────────────────────

/** LeaveClient LeaveBalanceLocal 와 구조 호환 (필요 필드만) */
export interface WdLeaveBalanceInput {
  id: string
  entitled: number
  used: number
  pending: number
  carriedOver: number
  adjusted: number
  remaining?: number
  leaveTypeDef?: { name: string; code: string | null } | null
  policy?: { name: string } | null
}

interface WdLeaveBalanceCardProps {
  balances: WdLeaveBalanceInput[]
  loading?: boolean
}

// ─── Constants ──────────────────────────────────────────────

const CATEGORY_ORDER = [
  'annual', 'sick', 'maternity', 'paternity',
  'bereavement', 'special', 'compensatory', 'other',
] as const

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  annual: 'category.annual', sick: 'category.health', maternity: 'category.maternity',
  paternity: 'category.paternity', bereavement: 'category.familyEvent', special: 'category.special',
  compensatory: 'category.compensatory', other: 'category.other',
}

// ─── Helpers ────────────────────────────────────────────────

function getRemainingDays(b: WdLeaveBalanceInput): number {
  return b.remaining ?? (b.entitled + b.carriedOver + b.adjusted - b.used - b.pending)
}

/**
 * Q7 잔여율 의미색 (휴가 카드 §7 결정):
 * ≥30% success / 10–30% accent / <10% warning. total<=0 → neutral.
 */
function remainingRatioToTone(remaining: number, total: number): WdStatTone {
  if (total <= 0) return 'neutral'
  const ratio = remaining / total
  if (ratio >= 0.3) return 'success'
  if (ratio >= 0.1) return 'accent'
  return 'warning'
}

// ─── Component ──────────────────────────────────────────────

export function WdLeaveBalanceCard({ balances, loading }: WdLeaveBalanceCardProps) {
  const t = useTranslations('leave')

  if (loading) return null

  const buckets: Record<string, WdLeaveBalanceInput[]> = {}
  for (const b of balances) {
    const code = b.leaveTypeDef?.code ?? 'other'
    const cat = CATEGORY_LABEL_KEYS[code] ? code : 'other'
    ;(buckets[cat] ??= []).push(b)
  }

  const groups: WdGroupedStatGroup[] = CATEGORY_ORDER
    .filter((c) => buckets[c]?.length)
    .map((cat) => ({
      label: t(CATEGORY_LABEL_KEYS[cat]),
      items: buckets[cat].map((b) => {
        const remaining = getRemainingDays(b)
        const total = b.entitled + b.carriedOver + b.adjusted
        const usedRatio = total > 0 ? Math.min((total - remaining) / total, 1) : 0
        return {
          id: b.id,
          label: b.leaveTypeDef?.name ?? b.policy?.name ?? '-',
          value: remaining,
          unit: `/ ${total} ${t('fullDay')}`,
          caption: `${t('usedDays')} ${b.used}${t('fullDay')} / ${t('pendingDays')} ${b.pending}${t('fullDay')}`,
          progress: { ratio: usedRatio, tone: remainingRatioToTone(remaining, total) },
        }
      }),
    }))

  return (
    <WdGroupedStatCard
      title={t('balance')}
      groups={groups}
      layout="cards"
      emptyState={<EmptyState />}
    />
  )
}
