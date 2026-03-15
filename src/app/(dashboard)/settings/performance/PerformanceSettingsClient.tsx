'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { getCategoryConfig, type PerformanceTabSlug } from '@/components/settings/settings-config'
import { SettingsSubPageLayout } from '@/components/settings/SettingsSubPageLayout'

// Tab components
import { EvalCycleTab } from './tabs/EvalCycleTab'
import { MethodologyTab } from './tabs/MethodologyTab'
import { GradeScaleTab } from './tabs/GradeScaleTab'
import { DistributionTab } from './tabs/DistributionTab'
import { CalibrationTab } from './tabs/CalibrationTab'
import { CfrTab } from './tabs/CfrTab'
import { CompetencyTab } from './tabs/CompetencyTab'

const config = getCategoryConfig('performance')

function PerformanceSettingsContent() {
  const searchParams = useSearchParams()
  const tab = (searchParams.get('tab') ?? config.tabs[0].slug) as PerformanceTabSlug

  const renderContent = (companyId: string | null) => {
    switch (tab) {
      case 'cycle':
        return <EvalCycleTab companyId={companyId} />
      case 'methodology':
        return <MethodologyTab companyId={companyId} />
      case 'grade-scale':
        return <GradeScaleTab companyId={companyId} />
      case 'distribution':
        return <DistributionTab companyId={companyId} />
      case 'calibration':
        return <CalibrationTab companyId={companyId} />
      case 'cfr':
        return <CfrTab companyId={companyId} />
      case 'competency':
        return <CompetencyTab companyId={companyId} />
      default:
        return <EvalCycleTab companyId={companyId} />
    }
  }

  return (
    <SettingsSubPageLayout config={config} activeTab={tab}>
      {(companyId: string | null) => renderContent(companyId)}
    </SettingsSubPageLayout>
  )
}

export function PerformanceSettingsClient() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-16 text-[#8181A5]">{'로딩 중...'}</div>}>
      <PerformanceSettingsContent />
    </Suspense>
  )
}
