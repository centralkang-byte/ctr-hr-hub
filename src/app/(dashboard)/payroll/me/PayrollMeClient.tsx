'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

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

function MoMDelta({ current, previous }: { current: number; previous: number | null }) {
  if (!previous || previous === 0) return null
  const diff = current - previous
  const pct = Math.round((diff / previous) * 100)
  if (diff === 0) return (
    <span className="text-xs text-[#999] flex items-center gap-0.5">
      <Minus className="h-3 w-3" /> 전월 동일
    </span>
  )
  if (diff > 0) return (
    <span className="text-xs text-[#059669] flex items-center gap-0.5">
      <TrendingUp className="h-3 w-3" /> +{pct}% ({formatCurrency(diff)})
    </span>
  )
  return (
    <span className="text-xs text-[#DC2626] flex items-center gap-0.5">
      <TrendingDown className="h-3 w-3" /> {pct}% ({formatCurrency(diff)})
    </span>
  )
}

export default function PayrollMeClient({
 user: _user }: PayrollMeClientProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('payrollMe')
  const router = useRouter()
  const [items, setItems] = useState<PayslipItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await apiClient.get<PayslipItem[]>('/api/v1/payroll/me')
        setItems(res.data ?? [])
      } catch {
        // error handled
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
        <FileText className="h-6 w-6 text-[#5E81F4]" />
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('title')}</h1>
          {newCount > 0 && (
            <p className="text-xs text-[#D97706] mt-0.5 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              미열람 명세서 {newCount}건
            </p>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-[#666]">
          <Wallet className="h-12 w-12 mx-auto mb-3 text-[#D4D4D4]" />
          <p>{t('emptyMessage')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!items?.length && <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />}
              {items?.map((item, idx) => {
            const prevItem = items[idx + 1]  // sorted desc — next item is previous month
            const isNew = !item.isViewed
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(`/payroll/me/${item.run.id}`)}
                className={`bg-white rounded-xl border p-5 text-left hover:shadow-md transition-shadow relative overflow-hidden ${isNew ? 'border-[#5E81F4] ring-1 ring-[#5E81F4]/30' : 'border-[#E8E8E8]'
                  }`}
              >
                {/* NEW badge */}
                {isNew && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#5E81F4] text-white uppercase">
                    <Sparkles className="h-2.5 w-2.5" /> NEW
                  </span>
                )}

                <div className="flex items-center justify-between mb-3 pr-12">
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">
                    {item.run.yearMonth}
                  </h3>
                  {!isNew && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E0E7FF] text-[#4B6DE0] border border-[#C7D2FE]">
                      {t('paid')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#666] mb-3">{item.run.name}</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#666]">{t('grossPay')}</span>
                    <span className="font-medium">{formatCurrency(Number(item.grossPay))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#666]">{t('deductions')}</span>
                    <span className="text-[#DC2626]">-{formatCurrency(Number(item.deductions))}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-[#F5F5F5]">
                    <span className="text-[#4B6DE0]">{t('netPay')}</span>
                    <span className="text-[#4B6DE0]">{formatCurrency(Number(item.netPay))}</span>
                  </div>
                  {/* MoM comparison mini-widget */}
                  {prevItem && (
                    <div className="pt-1.5 flex justify-end">
                      <MoMDelta current={Number(item.netPay)} previous={Number(prevItem.netPay)} />
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
