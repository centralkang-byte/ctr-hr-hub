'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Korean Compliance Client Component
// 탭: 52시간 모니터링 / 법정의무교육 / 퇴직금 중간정산
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ShieldCheck } from 'lucide-react'
import WorkHoursMonitorTab from '@/components/compliance/kr/WorkHoursMonitorTab'
import MandatoryTrainingTab from '@/components/compliance/kr/MandatoryTrainingTab'
import SeveranceInterimTab from '@/components/compliance/kr/SeveranceInterimTab'

type TabKey = 'workHours' | 'mandatoryTraining' | 'severanceInterim'

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: 'workHours', labelKey: 'kr.workHours' },
  { key: 'mandatoryTraining', labelKey: 'kr.mandatoryTraining' },
  { key: 'severanceInterim', labelKey: 'kr.severanceInterim' },
]

export default function KrComplianceClient() {
  const t = useTranslations('compliance')
  const [activeTab, setActiveTab] = useState<TabKey>('workHours')

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {t('kr.title')}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {t('kr.subtitle')}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mt-5 border-b border-slate-200 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? 'px-4 py-2.5 text-sm font-medium border-b-2 border-blue-600 text-blue-600'
                  : 'px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700'
              }
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'workHours' && <WorkHoursMonitorTab />}
        {activeTab === 'mandatoryTraining' && <MandatoryTrainingTab />}
        {activeTab === 'severanceInterim' && <SeveranceInterimTab />}
      </div>
    </div>
  )
}
