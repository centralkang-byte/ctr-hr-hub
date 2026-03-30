'use client'

import { useEffect, useState } from 'react'
import { Loader2, ArrowLeftRight } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface ExchangeRate { fromCurrency: string; toCurrency: string; rate: number; source: string }
interface Props { companyId: string | null }

export function CurrencyTab({
  companyId }: Props) {
  const t = useTranslations('settings')
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

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{t('kr_ked86b5ed_ked9998ec')}</h3>
        <p className="text-sm text-muted-foreground">{year}년 {month}월 적용 환율 ({rates.length}건)</p>
      </div>
      {rates.length > 0 ? (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}><tr>
              <th className={TABLE_STYLES.headerCell}>FROM</th>
              <th className={TABLE_STYLES.headerCell}></th>
              <th className={TABLE_STYLES.headerCell}>TO</th>
              <th className={TABLE_STYLES.headerCellRight}>{t('kr_ked9998ec')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_kecb69cec')}</th>
            </tr></thead>
            <tbody>{rates.map((r, i) => (
              <tr key={i} className={TABLE_STYLES.row}>
                <td className={`${TABLE_STYLES.cell} font-medium text-primary`}>{r.fromCurrency}</td>
                <td className={`${TABLE_STYLES.cell} text-center`}><ArrowLeftRight className="mx-auto h-4 w-4 text-muted-foreground" /></td>
                <td className={`${TABLE_STYLES.cell} font-medium text-primary`}>{r.toCurrency}</td>
                <td className={`${TABLE_STYLES.cell} text-right font-medium`}>{Number(r.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>{r.source}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <ArrowLeftRight className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium text-foreground">{year}년 {month}월 환율이 등록되지 않았습니다</p>
        </div>
      )}
    </div>
  )
}
