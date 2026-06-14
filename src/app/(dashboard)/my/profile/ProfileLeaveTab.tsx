'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Profile · Leave Summary Tab
// 본인 휴가 요약 (LeaveYearBalance SSOT — /api/v1/leave/balances)
// ═══════════════════════════════════════════════════════════

// ─── Imports ────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { CalendarDays, Percent, ArrowRight } from 'lucide-react'
import { WdStatStrip } from '@/components/shared/WdStatStrip'
import { EmptyState } from '@/components/ui/EmptyState'
import { KpiCardsSkeleton } from '@/components/shared/PageSkeleton'
import { apiClient } from '@/lib/api'
import { CARD_STYLES } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────
interface LeaveBalance {
  id: string
  year: number
  entitled: number | string
  carriedOver: number | string
  adjusted: number | string
  used: number | string
  pending: number | string
  remaining: number | string
  leaveTypeDef: { code: string; name: string; category: string }
}

// ─── Helpers ────────────────────────────────────────────────
const n = (v: number | string | null | undefined): number => Number(v ?? 0)

// ─── Component ──────────────────────────────────────────────
export function ProfileLeaveTab() {
  const t = useTranslations('mySpace')
  const [balances, setBalances] = useState<LeaveBalance[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(false)
      const res = await apiClient.get<LeaveBalance[]>('/api/v1/leave/balances')
      setBalances(res.data ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <KpiCardsSkeleton count={3} />
  if (error) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={t('profile.summary.loadError')}
        action={{ label: t('profile.summary.retry'), onClick: load }}
      />
    )
  }

  const list = balances ?? []
  if (list.length === 0) {
    return <EmptyState icon={CalendarDays} title={t('profile.leaveTab.empty')} />
  }

  const annual = list.find((b) => b.leaveTypeDef.code === 'annual')
  const annualTotal = annual ? n(annual.entitled) + n(annual.carriedOver) + n(annual.adjusted) : 0
  const annualRemaining = annual ? n(annual.remaining) : 0
  const annualUsed = annual ? n(annual.used) : 0
  const usageRate = annualTotal > 0 ? Math.round((annualUsed / annualTotal) * 100) : 0

  return (
    <div className="space-y-6">
      <WdStatStrip
        items={[
          {
            label: t('profile.leaveTab.annualRemaining'),
            value: annual ? annualRemaining.toFixed(1) : '-',
            icon: CalendarDays,
            tone: 'info',
            foot: annual ? t('profile.leaveTab.ofTotal', { total: annualTotal.toFixed(1) }) : undefined,
          },
          {
            label: t('profile.leaveTab.used'),
            value: annual ? annualUsed.toFixed(1) : '-',
            icon: CalendarDays,
            tone: 'default',
            foot: t('profile.leaveTab.daysUnit'),
          },
          {
            label: t('profile.leaveTab.usageRate'),
            value: annual ? `${usageRate}%` : '-',
            icon: Percent,
            tone: usageRate >= 80 ? 'warning' : 'success',
          },
        ]}
      />

      <div className={CARD_STYLES.padded}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-foreground">{t('profile.leaveTab.byType')}</h2>
          <Link href="/leave" className="flex items-center gap-1 text-sm text-primary hover:underline">
            {t('profile.summary.viewDetail')} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div role="list" className="divide-y divide-border">
          {list.map((b) => {
            const total = n(b.entitled) + n(b.carriedOver) + n(b.adjusted)
            const remaining = n(b.remaining)
            return (
              <div key={b.id} role="listitem" className="flex items-center justify-between py-2.5">
                <span className="text-sm text-foreground">{b.leaveTypeDef.name}</span>
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {remaining.toFixed(1)} / {total.toFixed(1)}{t('profile.leaveTab.daysUnit')}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
