'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, ClipboardCheck } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Checklist { id: string; name: string; targetType: string; deletedAt: string | null; _count?: { offboardingTasks?: number } }
interface Props { companyId: string | null }

export function OffboardingChecklistTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = companyId ? `?companyId=${companyId}&limit=50` : '?limit=50'
    apiClient.get(`/api/v1/offboarding/checklists${params}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => { const list = (res as any)?.data ?? res ?? []; setChecklists(Array.isArray(list) ? list : []) })
      .catch(() => setChecklists([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  const typeLabels: Record<string,string> = { VOLUNTARY: t('offboarding.voluntary'), INVOLUNTARY: t('offboarding.involuntary'), RETIREMENT: t('offboarding.retirement'), CONTRACT_END: t('offboarding.contractEnd') }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="text-base font-semibold text-foreground">{t('kr_kec98a4ed_kecb2b4ed')}</h3><p className="text-sm text-muted-foreground">{t('offboarding.subtitle', { count: checklists.length })}</p></div>
        <Button className={BUTTON_VARIANTS.primary}><Plus className="mr-2 h-4 w-4" />{t('kr_kecb2b4ed_add')}</Button>
      </div>
      {checklists.length > 0 ? (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}><thead><tr className={TABLE_STYLES.header}>
            <th className={TABLE_STYLES.headerCell}>{t('kr_kecb2b4ed')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('kr_keb8c80ec_kec9ca0ed')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('kr_ked839cec_kec8898')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('status')}</th>
          </tr></thead><tbody className="divide-y divide-border">{checklists.map((c) => (
            <tr key={c.id} className={TABLE_STYLES.row}>
              <td className={TABLE_STYLES.cell}>{c.name}</td>
              <td className={TABLE_STYLES.cellMuted}>{typeLabels[c.targetType] ?? c.targetType}</td>
              <td className="px-4 py-3 text-center text-sm text-muted-foreground">{c._count?.offboardingTasks ?? 0}</td>
              <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${!c.deletedAt ? 'bg-tertiary-container/10 text-tertiary' : 'bg-muted/50 text-muted-foreground/60'}`}>{!c.deletedAt ? t('common.active') : t('common.inactive')}</span></td>
            </tr>
          ))}</tbody></table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium text-foreground">{t('register_keb909c_kecb2b4ed_kec9786ec')}</p>
        </div>
      )}
    </div>
  )
}
