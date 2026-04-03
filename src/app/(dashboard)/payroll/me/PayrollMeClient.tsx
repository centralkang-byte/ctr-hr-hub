'use client'

import { toast } from '@/hooks/use-toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FileText, Wallet, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'
import type { SessionUser } from '@/types'

interface PayslipItem {
  id: string
  payslipId: string | null
  isViewed: boolean
  viewedAt: string | null
  baseSalary: string | number
  grossPay: string | number
  deductions: string | number
  netPay: string | number
  run: {
    id: string
    name: string
    yearMonth: string
    periodStart: string
    periodEnd: string
    payDate: string | null
    paidAt: string | null
  }
}

interface PayrollMeClientProps {
  user: SessionUser
}

// ─── MoM Delta ─────────────────────────────────────────

function MoMDelta({ current, previous, sameLabel }: { current: number; previous: number | null; sameLabel: string }) {
  if (!previous || previous === 0) return null
  const diff = current - previous
  const pct = Math.round((diff / previous) * 100)
  if (diff === 0) return (
    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
      <Minus className="h-3 w-3" /> {sameLabel}
    </span>
  )
  if (diff > 0) return (
    <span className="text-xs text-emerald-600 flex items-center gap-0.5">
      <TrendingUp className="h-3 w-3" /> +{pct}% ({formatCurrency(diff)})
    </span>
  )
  return (
    <span className="text-xs text-destructive flex items-center gap-0.5">
      <TrendingDown className="h-3 w-3" /> {pct}% ({formatCurrency(diff)})
    </span>
  )
}

export default function PayrollMeClient({
 user: _user }: PayrollMeClientProps) {
  const t = useTranslations('payrollMe')
  const router = useRouter()
  const [items, setItems] = useState<PayslipItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await apiClient.get<PayslipItem[]>('/api/v1/payroll/me')
        setItems(res.data ?? [])
      } catch (err) {
        toast({ title: t('loadError'), description: err instanceof Error ? err.message : t('loadErrorDesc'), variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    void fetchItems()
  }, [])

  if (loading) return <TableSkeleton rows={8} />

  const newCount = items.filter((i) => !i.isViewed).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          {newCount > 0 && (
            <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {t('unreadCount', { count: newCount })}
            </p>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wallet className="h-12 w-12 mx-auto mb-3 text-border" />
          <p>{t('emptyMessage')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!items?.length && <EmptyState />}
              {items?.map((item, idx) => {
            const prevItem = items[idx + 1]  // sorted desc — next item is previous month
            const isNew = !item.isViewed
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(`/payroll/me/${item.run.id}`)}
                className={`bg-card rounded-xl border p-5 text-left hover:shadow-md transition-shadow relative overflow-hidden ${isNew ? 'border-primary ring-1 ring-primary/30' : 'border-border'
                  }`}
              >
                {/* NEW badge */}
                {isNew && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white uppercase">
                    <Sparkles className="h-2.5 w-2.5" /> NEW
                  </span>
                )}

                <div className="flex items-center justify-between mb-3 pr-12">
                  <h3 className="text-sm font-semibold text-foreground">
                    {item.run.yearMonth}
                  </h3>
                  {!isNew && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {t('paid')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{item.run.name}</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('grossPay')}</span>
                    <span className="font-medium">{formatCurrency(Number(item.grossPay))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('deductions')}</span>
                    <span className="text-destructive">-{formatCurrency(Number(item.deductions))}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-border">
                    <span className="text-primary/90">{t('netPay')}</span>
                    <span className="text-primary/90">{formatCurrency(Number(item.netPay))}</span>
                  </div>
                  {/* MoM comparison mini-widget */}
                  {prevItem && (
                    <div className="pt-1.5 flex justify-end">
                      <MoMDelta current={Number(item.netPay)} previous={Number(prevItem.netPay)} sameLabel={t('momSame')} />
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
