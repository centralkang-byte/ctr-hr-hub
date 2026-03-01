'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Russia Compliance Client Component
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Shield } from 'lucide-react'
import MilitaryRegistrationTab from '@/components/compliance/ru/MilitaryRegistrationTab'
import KedoDocumentsTab from '@/components/compliance/ru/KedoDocumentsTab'
import RuReportsTab from '@/components/compliance/ru/RuReportsTab'

type TabKey = 'military' | 'kedo' | 'reports'

export default function RuComplianceClient() {
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
        <div className="p-2 bg-blue-50 rounded-lg">
          <Shield className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('ru.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            군복무 등록, 전자문서(КЭДО) 및 법정 보고서 관리
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={
              activeTab === tab.key
                ? 'px-4 py-2.5 text-sm font-medium border-b-2 border-blue-600 text-blue-600'
                : 'px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent'
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
