'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, ClipboardList } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Template { id: string; name: string; targetType: string; deletedAt: string | null; _count?: { onboardingTasks?: number } }
interface Props { companyId: string | null }

export function OnboardingTemplatesTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = companyId ? `?companyId=${companyId}&limit=50` : '?limit=50'
    apiClient.get(`/api/v1/onboarding/templates${params}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => { const list = (res as any)?.data ?? res ?? []; setTemplates(Array.isArray(list) ? list : []) })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  const typeLabels: Record<string,string> = { NEW_HIRE: t('onboardingTemplates.newHire'), TRANSFER: t('onboardingTemplates.transfer'), REHIRE: t('onboardingTemplates.rehire') }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="text-base font-semibold text-foreground">{t('onboardingTemplates.title')}</h3><p className="text-sm text-muted-foreground">{t('onboardingTemplates.subtitle', { count: templates.length })}</p></div>
        <Button className={BUTTON_VARIANTS.primary}><Plus className="mr-2 h-4 w-4" />{t('kr_ked859ced_add')}</Button>
      </div>
      {templates.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full"><thead><tr className={TABLE_STYLES.header}>
            <th className={TABLE_STYLES.headerCell}>{t('kr_ked859ced')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('kr_keb8c80ec')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('kr_ked839cec_kec8898')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('status')}</th>
          </tr></thead><tbody className="divide-y divide-border">{templates.map((tmpl) => (
            <tr key={tmpl.id} className={TABLE_STYLES.row}>
              <td className={TABLE_STYLES.cell}>{tmpl.name}</td>
              <td className={TABLE_STYLES.cellMuted}>{typeLabels[tmpl.targetType] ?? tmpl.targetType}</td>
              <td className="px-4 py-3 text-center text-sm text-muted-foreground">{tmpl._count?.onboardingTasks ?? 0}</td>
              <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${!tmpl.deletedAt ? 'bg-tertiary-container/10 text-tertiary' : 'bg-muted/50 text-muted-foreground/60'}`}>{!tmpl.deletedAt ? t('common.active') : t('common.inactive')}</span></td>
            </tr>
          ))}</tbody></table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium text-foreground">{t('register_keb909c_kec98a8eb_ked859ced_kec9786ec')}</p>
        </div>
      )}
    </div>
  )
}
