'use client'

// import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Info, Plug, MessageSquare, Lock, Building2, KeyRound, Calendar, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Props { companyId: string | null }

const INTEGRATIONS = [
  { key: 'teams', label: 'Microsoft Teams', descKey: 'integrations.descTeams', status: 'available', iconKey: 'teams' },
  { key: 'sso', label: 'SSO/SAML', descKey: 'integrations.descSso', status: 'available', iconKey: 'sso' },
  { key: 'erp', labelKey: 'integrations.labelErp', descKey: 'integrations.descErp', status: 'planned', iconKey: 'erp' },
  { key: 'api', labelKey: 'integrations.labelApi', descKey: 'integrations.descApi', status: 'planned', iconKey: 'api' },
  { key: 'slack', label: 'Slack', descKey: 'integrations.descSlack', status: 'planned', iconKey: 'slack' },
  { key: 'calendar', label: 'Google Calendar', descKey: 'integrations.descCalendar', status: 'planned', iconKey: 'calendar' },
] as const

const ICON_MAP: Record<string, LucideIcon> = {
  teams: MessageSquare,
  sso: Lock,
  erp: Building2,
  api: KeyRound,
  slack: MessageSquare,
  calendar: Calendar,
}

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
      <div className="space-y-3">{INTEGRATIONS.map((int) => {
        const Icon = ICON_MAP[int.iconKey] ?? Plug
        return (
        <div key={int.key} className="flex items-center gap-4 rounded-xl border border-border p-4 hover:bg-muted transition-colors">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{'labelKey' in int ? t(int.labelKey) : int.label}</span>
              <Badge variant={int.status === 'available' ? 'success' : 'neutral'}>
                {int.status === 'available' ? t('integrations.available') : t('integrations.planned')}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t(int.descKey)}</p>
          </div>
          {int.status === 'available' && <Plug className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        </div>
        )
      })}</div>
    </div>
  )
}
