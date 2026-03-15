'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, MinusCircle } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface DeductionType { id: string; code: string; name: string; nameEn?: string; category: string; isStatutory: boolean; isActive: boolean }
interface Props { companyId: string | null }

export function DeductionsTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [items, setItems] = useState<DeductionType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient.get('/api/v1/payroll/deduction-types?limit=100')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => { const list = (res as any)?.data ?? res ?? []; setItems(Array.isArray(list) ? list : []) })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="text-base font-semibold text-[#1C1D21]">{t('deductions')}</h3><p className="text-sm text-[#8181A5]">공제 항목 {items.length}개</p></div>
        <Button className={BUTTON_VARIANTS.primary}><Plus className="mr-2 h-4 w-4" />{t('kr_ked95adeb_add')}</Button>
      </div>
      {items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
          <table className="w-full"><thead><tr className={TABLE_STYLES.header}>
            <th className={TABLE_STYLES.headerCell}>{t('kr_kecbd94eb')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('kr_ked95adeb')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('kr_kecb9b4ed')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('kr_kebb295ec')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('status')}</th>
          </tr></thead><tbody className="divide-y divide-[#F0F0F3]">{items.map((item) => (
            <tr key={item.id} className={TABLE_STYLES.row}>
              <td className="px-4 py-3 text-sm font-medium text-[#5E81F4]">{item.code}</td>
              <td className={TABLE_STYLES.cell}>{item.name}</td>
              <td className={TABLE_STYLES.cellMuted}>{item.category}</td>
              <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.isStatutory ? 'bg-primary/5 text-primary' : 'bg-gray-50 text-gray-500'}`}>{item.isStatutory ? '법정' : '비법정'}</span></td>
              <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>{item.isActive ? '활성' : '비활성'}</span></td>
            </tr>
          ))}</tbody></table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#F0F0F3] py-12 text-center">
          <MinusCircle className="mx-auto mb-3 h-8 w-8 text-[#8181A5]" /><p className="text-sm font-medium text-[#1C1D21]">{t('register_keb909c_keab3b5ec_ked95adeb_kec9786ec')}</p>
        </div>
      )}
    </div>
  )
}
