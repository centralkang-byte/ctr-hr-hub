'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

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
import type { SessionUser } from '@/types'

type TabKey = 'workHours' | 'mandatoryTraining' | 'severanceInterim'

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: 'workHours', labelKey: 'kr.workHours' },
  { key: 'mandatoryTraining', labelKey: 'kr.mandatoryTraining' },
  { key: 'severanceInterim', labelKey: 'kr.severanceInterim' },
]

export default function KrComplianceClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')

  const t = useTranslations('compliance')
  const [activeTab, setActiveTab] = useState<TabKey>('workHours')

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Page Header */}
      <div className="bg-white border-b border-[#E8E8E8] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-[#EDF1FE] rounded-lg">
            <ShieldCheck className="w-5 h-5 text-[#5E81F4]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">
              {t('kr.title')}
            </h1>
            <p className="text-sm text-[#666] mt-0.5">
              {t('kr.subtitle')}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mt-5 border-b border-[#E8E8E8] -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? 'px-4 py-2.5 text-sm font-medium border-b-2 border-[#5E81F4] text-[#5E81F4]'
                  : 'px-4 py-2.5 text-sm font-medium text-[#666] hover:text-[#333]'
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
