'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Bell } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Trigger { id: string; eventType: string; name: string; channels: string[]; deletedAt: string | null; targetRole?: string }
interface Props { companyId: string | null }

export function NotificationRulesTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient.get('/api/v1/settings/notification-triggers?limit=100')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => { const list = (res as any)?.data ?? res ?? []; setTriggers(Array.isArray(list) ? list : []) })
      .catch(() => setTriggers([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="text-base font-semibold text-foreground">{t('notificationRules.title')}</h3><p className="text-sm text-muted-foreground">{t('notificationRules.subtitle', { count: triggers.length })}</p></div>
        <Button className={BUTTON_VARIANTS.primary}><Plus className="mr-2 h-4 w-4" />{t('kr_keab79cec_add')}</Button>
      </div>
      {triggers.length > 0 ? (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}><tr>
              <th className={TABLE_STYLES.headerCell}>{t('kr_kec9db4eb')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('name')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_kecb184eb')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('status')}</th>
            </tr></thead>
            <tbody>{triggers.map((trig) => (
              <tr key={trig.id} className={TABLE_STYLES.row}>
                <td className={`${TABLE_STYLES.cell} font-medium text-primary`}>{trig.eventType}</td>
                <td className={TABLE_STYLES.cell}>{trig.name}</td>
                <td className={TABLE_STYLES.cell}><div className="flex gap-1">{(trig.channels ?? []).map((ch) => (
                  <span key={ch} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{ch}</span>
                ))}</div></td>
                <td className={`${TABLE_STYLES.cell} text-center`}><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${!trig.deletedAt ? 'bg-tertiary-container/10 text-tertiary' : 'bg-muted/50 text-muted-foreground/60'}`}>{!trig.deletedAt ? t('common.active') : t('common.inactive')}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium text-foreground">{t('register_keb909c_kec958ceb_keab79cec_kec9786ec')}</p>
        </div>
      )}
    </div>
  )
}
