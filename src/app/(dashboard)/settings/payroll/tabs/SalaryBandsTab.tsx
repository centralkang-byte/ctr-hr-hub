'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, TrendingUp } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface SalaryBand { id: string; minSalary: number; midSalary: number; maxSalary: number; jobGrade?: { code: string; name: string }; jobCategory?: { code: string; name: string } }
interface Props { companyId: string | null }

export function SalaryBandsTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [bands, setBands] = useState<SalaryBand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient.get('/api/v1/compensation/salary-bands?limit=50')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => { const list = (res as any)?.data ?? res ?? []; setBands(Array.isArray(list) ? list : []) })
      .catch(() => setBands([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  const fmt = (n: number) => n.toLocaleString()

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="text-base font-semibold text-[#1C1D21]">{t('kr_kec97b0eb_kebb0b4eb')}</h3><p className="text-sm text-[#8181A5]">직급별 최소/중간/최대 급여 범위 {bands.length}건</p></div>
        <Button className={BUTTON_VARIANTS.primary}><Plus className="mr-2 h-4 w-4" />{t('kr_kebb0b4eb_add')}</Button>
      </div>
      {bands.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
          <table className="w-full"><thead><tr className={TABLE_STYLES.header}>
            <th className={TABLE_STYLES.headerCell}>{t('grade')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('kr_keca781ec')}</th>
            <th className={TABLE_STYLES.headerCellRight}>{t('kr_kecb59cec')}</th>
            <th className={TABLE_STYLES.headerCellRight}>{t('kr_keca491ea')}</th>
            <th className={TABLE_STYLES.headerCellRight}>{t('kr_kecb59ceb')}</th>
          </tr></thead><tbody className="divide-y divide-[#F0F0F3]">{bands.map((b) => (
            <tr key={b.id} className={TABLE_STYLES.row}>
              <td className="px-4 py-3 text-sm font-medium text-[#5E81F4]">{b.jobGrade?.code ?? '—'} <span className="text-[#8181A5]">{b.jobGrade?.name ?? ''}</span></td>
              <td className={TABLE_STYLES.cellMuted}>{b.jobCategory?.name ?? '—'}</td>
              <td className="px-4 py-3 text-right text-sm text-[#1C1D21]">{fmt(b.minSalary)}</td>
              <td className="px-4 py-3 text-right text-sm font-medium text-[#1C1D21]">{fmt(b.midSalary)}</td>
              <td className="px-4 py-3 text-right text-sm text-[#1C1D21]">{fmt(b.maxSalary)}</td>
            </tr>
          ))}</tbody></table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#F0F0F3] py-12 text-center">
          <TrendingUp className="mx-auto mb-3 h-8 w-8 text-[#8181A5]" /><p className="text-sm font-medium text-[#1C1D21]">{t('register_keb909c_kec97b0eb_kebb0b4eb_kec9786ec')}</p>
        </div>
      )}
    </div>
  )
}
