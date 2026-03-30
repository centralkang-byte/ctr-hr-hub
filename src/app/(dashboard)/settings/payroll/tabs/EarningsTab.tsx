'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, DollarSign } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface AllowanceType { id: string; code: string; name: string; nameEn?: string; category: string; isTaxable: boolean; deletedAt: string | null }
interface Props { companyId: string | null }

export function EarningsTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [items, setItems] = useState<AllowanceType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient.get('/api/v1/payroll/allowance-types?limit=100')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => { const list = (res as any)?.data ?? res ?? []; setItems(Array.isArray(list) ? list : []) })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="text-base font-semibold text-foreground">{t('kr_keab889ec_ked95adeb')}</h3><p className="text-sm text-muted-foreground">수당/지급 항목 {items.length}개</p></div>
        <Button className={BUTTON_VARIANTS.primary}><Plus className="mr-2 h-4 w-4" />{t('kr_ked95adeb_add')}</Button>
      </div>
      {items.length > 0 ? (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}><tr>
              <th className={TABLE_STYLES.headerCell}>{t('kr_kecbd94eb')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_ked95adeb')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_kecb9b4ed')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_keab3bcec')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('status')}</th>
            </tr></thead>
            <tbody>{items.map((item) => (
              <tr key={item.id} className={TABLE_STYLES.row}>
                <td className={`${TABLE_STYLES.cell} font-medium text-primary`}>{item.code}</td>
                <td className={TABLE_STYLES.cell}>{item.name}</td>
                <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>{item.category}</td>
                <td className={`${TABLE_STYLES.cell} text-center`}><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.isTaxable ? 'bg-destructive/5 text-destructive' : 'bg-tertiary-container/10 text-tertiary'}`}>{item.isTaxable ? '과세' : '비과세'}</span></td>
                <td className={`${TABLE_STYLES.cell} text-center`}><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${!item.deletedAt ? 'bg-tertiary-container/10 text-tertiary' : 'bg-muted/50 text-muted-foreground/60'}`}>{!item.deletedAt ? '활성' : '비활성'}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <DollarSign className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium text-foreground">{t('register_keb909c_keab889ec_ked95adeb_kec9786ec')}</p>
        </div>
      )}
    </div>
  )
}
