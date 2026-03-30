'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Russia Compliance Client Component
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Shield } from 'lucide-react'
import MilitaryRegistrationTab from '@/components/compliance/ru/MilitaryRegistrationTab'
import KedoDocumentsTab from '@/components/compliance/ru/KedoDocumentsTab'
import RuReportsTab from '@/components/compliance/ru/RuReportsTab'
import type { SessionUser } from '@/types'

type TabKey = 'military' | 'kedo' | 'reports'

export default function RuComplianceClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')

  const t = useTranslations('compliance')
  const [activeTab, setActiveTab] = useState<TabKey>('military')

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'military', label: t('ru.military') },
    { key: 'kedo', label: t('ru.kedo') },
    { key: 'reports', label: t('ru.reports') },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('ru.title')}</h1>
          <p className="text-sm text-[#666] mt-0.5">
            {t('kr_keab5b0eb_register_keca084ec_k')}
          </p>
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
        {activeTab === 'military' && <MilitaryRegistrationTab />}
        {activeTab === 'kedo' && <KedoDocumentsTab />}
        {activeTab === 'reports' && <RuReportsTab />}
      </div>
    </div>
  )
}
