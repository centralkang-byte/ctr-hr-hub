'use client'

import { useEffect, useState } from 'react'
import { Loader2, ArrowLeftRight } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { TABLE_STYLES } from '@/lib/styles'

interface ExchangeRate { fromCurrency: string; toCurrency: string; rate: number; source: string }
interface Props { companyId: string | null }

export function CurrencyTab({ companyId }: Props) {
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [year] = useState(now.getFullYear())
  const [month] = useState(now.getMonth() + 1)

  useEffect(() => {
    setLoading(true)
    apiClient.get(`/api/v1/payroll/exchange-rates?year=${year}&month=${month}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => { const d = (res as any)?.data ?? res; setRates(d?.rates ?? []) })
      .catch(() => setRates([]))
      .finally(() => setLoading(false))
  }, [companyId, year, month])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1C1D21]">통화/환율</h3>
        <p className="text-sm text-[#8181A5]">{year}년 {month}월 적용 환율 ({rates.length}건)</p>
      </div>
      {rates.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
          <table className="w-full"><thead><tr className={TABLE_STYLES.header}>
            <th className={TABLE_STYLES.headerCell}>FROM</th>
            <th className={TABLE_STYLES.headerCell}></th>
            <th className={TABLE_STYLES.headerCell}>TO</th>
            <th className={TABLE_STYLES.headerCellRight}>환율</th>
            <th className={TABLE_STYLES.headerCell}>출처</th>
          </tr></thead><tbody className="divide-y divide-[#F0F0F3]">{rates.map((r, i) => (
            <tr key={i} className={TABLE_STYLES.row}>
              <td className="px-4 py-3 text-sm font-medium text-[#5E81F4]">{r.fromCurrency}</td>
              <td className="px-4 py-3 text-center"><ArrowLeftRight className="mx-auto h-4 w-4 text-[#8181A5]" /></td>
              <td className="px-4 py-3 text-sm font-medium text-[#5E81F4]">{r.toCurrency}</td>
              <td className="px-4 py-3 text-right text-sm font-medium text-[#1C1D21]">{Number(r.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
              <td className={TABLE_STYLES.cellMuted}>{r.source}</td>
            </tr>
          ))}</tbody></table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#F0F0F3] py-12 text-center">
          <ArrowLeftRight className="mx-auto mb-3 h-8 w-8 text-[#8181A5]" /><p className="text-sm font-medium text-[#1C1D21]">{year}년 {month}월 환율이 등록되지 않았습니다</p>
        </div>
      )}
    </div>
  )
}
