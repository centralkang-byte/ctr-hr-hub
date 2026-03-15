'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Hash } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface EnumOption { id: string; enumGroup: string; optionKey: string; label: string; color?: string; sortOrder: number }
interface Props { companyId: string | null }

export function CodeManagementTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [options, setOptions] = useState<EnumOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient.get('/api/v1/settings/enums?limit=200')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => { const list = (res as any)?.data ?? res ?? []; setOptions(Array.isArray(list) ? list : []) })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  const grouped = options.reduce<Record<string, EnumOption[]>>((acc, o) => { (acc[o.enumGroup] ??= []).push(o); return acc }, {})

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="text-base font-semibold text-[#1C1D21]">{t('codeManagement')}</h3><p className="text-sm text-[#8181A5]">시스템 코드/열거형 {Object.keys(grouped).length}개 그룹</p></div>
        <Button className={BUTTON_VARIANTS.primary}><Plus className="mr-2 h-4 w-4" />{t('kr_kecbd94eb_add')}</Button>
      </div>
      {Object.keys(grouped).length > 0 ? Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).map(([group, items]) => (
        <div key={group}>
          <h4 className="mb-2 text-sm font-semibold text-[#8181A5]">{group} ({items.length})</h4>
          <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
            <table className="w-full">
              <thead><tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>{t('kr_ked82a4')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_keb9dbceb')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_kec8389ec')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_kec889cec')}</th>
              </tr></thead>
              <tbody className="divide-y divide-[#F0F0F3]">{items.sort((a,b) => a.sortOrder - b.sortOrder).map((o) => (
                <tr key={o.id} className={TABLE_STYLES.row}>
                  <td className="px-4 py-2 text-sm font-medium text-[#5E81F4]">{o.optionKey}</td>
                  <td className="px-4 py-2 text-sm text-[#1C1D21]">{o.label}</td>
                  <td className="px-4 py-2 text-center">{o.color ? <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: o.color }} /> : '—'}</td>
                  <td className="px-4 py-2 text-center text-sm text-[#8181A5]">{o.sortOrder}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )) : (
        <div className="rounded-xl border border-dashed border-[#F0F0F3] py-12 text-center">
          <Hash className="mx-auto mb-3 h-8 w-8 text-[#8181A5]" /><p className="text-sm font-medium text-[#1C1D21]">{t('register_keb909c_kecbd94eb_kec9786ec')}</p>
        </div>
      )}
    </div>
  )
}
