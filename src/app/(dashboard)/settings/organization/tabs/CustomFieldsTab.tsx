'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Settings2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface CustomField { id: string; entityType: string; fieldKey: string; fieldLabel: string; fieldType: string; isRequired: boolean; isSearchable: boolean; sortOrder: number }
interface Props { companyId: string | null }

export function CustomFieldsTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient.get('/api/v1/settings/custom-fields?limit=100')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => { const list = (res as any)?.data ?? res ?? []; setFields(Array.isArray(list) ? list : []) })
      .catch(() => setFields([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  const grouped = fields.reduce<Record<string, CustomField[]>>((acc, f) => { (acc[f.entityType] ??= []).push(f); return acc }, {})

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="text-base font-semibold text-foreground">{t('customFields')}</h3><p className="text-sm text-muted-foreground">사용자 정의 필드 {fields.length}개</p></div>
        <Button className={BUTTON_VARIANTS.primary}><Plus className="mr-2 h-4 w-4" />{t('kr_ked9584eb_add')}</Button>
      </div>
      {fields.length > 0 ? Object.entries(grouped).map(([entity, items]) => (
        <div key={entity}>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{entity}</h4>
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead className={TABLE_STYLES.header}><tr>
                <th className={TABLE_STYLES.headerCell}>{t('kr_ked9584eb_ked82a4')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_keb9dbceb')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_ked8380ec')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('required')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('search')}</th>
              </tr></thead>
              <tbody>{items.map((f) => (
                <tr key={f.id} className={TABLE_STYLES.row}>
                  <td className={`${TABLE_STYLES.cell} font-medium text-primary`}>{f.fieldKey}</td>
                  <td className={TABLE_STYLES.cell}>{f.fieldLabel}</td>
                  <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>{f.fieldType}</td>
                  <td className={`${TABLE_STYLES.cell} text-center`}>{f.isRequired ? '✓' : '—'}</td>
                  <td className={`${TABLE_STYLES.cell} text-center`}>{f.isSearchable ? '✓' : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Settings2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium text-foreground">{t('register_keb909c_kecbba4ec_ked9584eb_kec9786ec')}</p>
        </div>
      )}
    </div>
  )
}
