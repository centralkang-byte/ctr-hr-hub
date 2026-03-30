'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Shield } from 'lucide-react'
import ConsentManagementTab from '@/components/compliance/gdpr/ConsentManagementTab'
import DataRequestsTab from '@/components/compliance/gdpr/DataRequestsTab'
import DataRetentionClientContent from '@/components/compliance/gdpr/DataRetentionTabContent'
import DpiaTabContent from '@/components/compliance/gdpr/DpiaTabContent'
import type { SessionUser } from '@/types'

type TabKey = 'consents' | 'requests' | 'retention' | 'dpia'

export default function GdprClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')

  const t = useTranslations('compliance')
  const [activeTab, setActiveTab] = useState<TabKey>('consents')

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'consents', label: t('gdpr.consents') },
    { key: 'requests', label: t('gdpr.requests') },
    { key: 'retention', label: t('gdpr.retention') },
    { key: 'dpia', label: t('gdpr.dpia') },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('gdpr.title')}</h1>
          <p className="text-sm text-[#666]">{t('title')}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={
              activeTab === tab.key
                ? 'px-4 py-2.5 text-sm font-medium border-b-2 border-primary text-primary'
                : 'px-4 py-2.5 text-sm font-medium text-[#666] hover:text-[#333] border-b-2 border-transparent'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'consents' && <ConsentManagementTab />}
        {activeTab === 'requests' && <DataRequestsTab />}
        {activeTab === 'retention' && <DataRetentionClientContent />}
        {activeTab === 'dpia' && <DpiaTabContent />}
      </div>
    </div>
  )
}
