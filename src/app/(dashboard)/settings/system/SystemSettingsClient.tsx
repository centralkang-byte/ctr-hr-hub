'use client'

// import { useTranslations } from 'next-intl'
// import { EmptyState } from '@/components/ui/EmptyState'
// import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
// import { toast } from '@/hooks/use-toast'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { getCategoryConfig, type SystemTabSlug } from '@/components/settings/settings-config'
import { SettingsSubPageLayout } from '@/components/settings/SettingsSubPageLayout'

// Tab components
import { NotificationChannelsTab } from './tabs/NotificationChannelsTab'
import { NotificationRulesTab } from './tabs/NotificationRulesTab'
import { LocaleTab } from './tabs/LocaleTab'
import { RolesTab } from './tabs/RolesTab'
import { AuditLogTab } from './tabs/AuditLogTab'
import { DataRetentionTab } from './tabs/DataRetentionTab'
import { IntegrationsTab } from './tabs/IntegrationsTab'

const config = getCategoryConfig('system')

function SystemSettingsContent() {
  const searchParams = useSearchParams()
  const tab = (searchParams.get('tab') ?? config.tabs[0].slug) as SystemTabSlug

  const renderContent = (companyId: string | null) => {
    switch (tab) {
      case 'notification-channels':
        return <NotificationChannelsTab companyId={companyId} />
      case 'notification-rules':
        return <NotificationRulesTab companyId={companyId} />
      case 'locale':
        return <LocaleTab companyId={companyId} />
      case 'roles':
        return <RolesTab companyId={companyId} />
      case 'audit':
        return <AuditLogTab companyId={companyId} />
      case 'data-retention':
        return <DataRetentionTab companyId={companyId} />
      case 'integrations':
        return <IntegrationsTab companyId={companyId} />
      default:
        return <NotificationChannelsTab companyId={companyId} />
    }
  }

  return (
    <SettingsSubPageLayout config={config} activeTab={tab}>
      {(companyId: string | null) => renderContent(companyId)}
    </SettingsSubPageLayout>
  )
}

export function SystemSettingsClient() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-16 text-[#8181A5]">{'로딩 중...'}</div>}>
      <SystemSettingsContent />
    </Suspense>
  )
}
