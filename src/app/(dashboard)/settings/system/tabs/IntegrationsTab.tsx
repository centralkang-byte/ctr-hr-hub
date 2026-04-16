'use client'

// import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Info, Plug } from 'lucide-react'

interface Props { companyId: string | null }

const INTEGRATIONS = [
  { key: 'teams', label: 'Microsoft Teams', descKey: 'integrations.descTeams', status: 'available', icon: '🔗' },
  { key: 'sso', label: 'SSO/SAML', descKey: 'integrations.descSso', status: 'available', icon: '🔐' },
  { key: 'erp', labelKey: 'integrations.labelErp', descKey: 'integrations.descErp', status: 'planned', icon: '🏢' },
  { key: 'api', labelKey: 'integrations.labelApi', descKey: 'integrations.descApi', status: 'planned', icon: '🔑' },
  { key: 'slack', label: 'Slack', descKey: 'integrations.descSlack', status: 'planned', icon: '💬' },
  { key: 'calendar', label: 'Google Calendar', descKey: 'integrations.descCalendar', status: 'planned', icon: '📅' },
] as const

export function IntegrationsTab({
  companyId: _companyId }: Props) {
  const t = useTranslations('settings')
  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{t('integrations.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('integrations.subtitle')}</p>
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">{t('integrations.infoNote')}</p>
      </div>
      <div className="space-y-3">{INTEGRATIONS.map((int) => (
        <div key={int.key} className="flex items-center gap-4 rounded-xl border border-border p-4 hover:bg-muted transition-colors">
          <span className="text-2xl">{int.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{'labelKey' in int ? t(int.labelKey) : int.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${int.status === 'available' ? 'bg-tertiary-container/10 text-tertiary' : 'bg-muted/50 text-muted-foreground/60'}`}>
                {int.status === 'available' ? t('integrations.available') : t('integrations.planned')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t(int.descKey)}</p>
          </div>
          {int.status === 'available' && <Plug className="h-4 w-4 text-muted-foreground" />}
        </div>
      ))}</div>
    </div>
  )
}
