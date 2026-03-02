'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FileText, Wallet } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'
import type { SessionUser } from '@/types'

interface PayslipItem {
  id: string
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

export default function PayrollMeClient({ user }: PayrollMeClientProps) {
  const router = useRouter()
  const t = useTranslations('payrollMe')
  const [items, setItems] = useState<PayslipItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiClient.get<PayslipItem[]>('/api/v1/payroll/me')
        setItems(res.data ?? [])
      } catch {
        // error handled
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-[#00C853] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-[#00C853]" />
        <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('title')}</h1>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-[#666]">
          <Wallet className="h-12 w-12 mx-auto mb-3 text-[#D4D4D4]" />
          <p>{t('emptyMessage')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(`/payroll/me/${item.run.id}`)}
              className="bg-white rounded-xl border border-[#E8E8E8] p-5 text-left hover:border-[#E8F5E9] hover:transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#1A1A1A]">
                  {item.run.yearMonth}
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E0E7FF] text-[#4338CA] border border-[#C7D2FE]">
                  {t('paid')}
                </span>
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
                  <span className="text-[#00A844]">{t('netPay')}</span>
                  <span className="text-[#00A844]">{formatCurrency(Number(item.netPay))}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
