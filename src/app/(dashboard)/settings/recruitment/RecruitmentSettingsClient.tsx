'use client'

// import { useTranslations } from 'next-intl'
// import { EmptyState } from '@/components/ui/EmptyState'
// import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
// import { toast } from '@/hooks/use-toast'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { getCategoryConfig, type RecruitmentTabSlug } from '@/components/settings/settings-config'
import { SettingsSubPageLayout } from '@/components/settings/SettingsSubPageLayout'

// Tab components
import { PipelineTab } from './tabs/PipelineTab'
import { InterviewFormTab } from './tabs/InterviewFormTab'
import { AiScreeningTab } from './tabs/AiScreeningTab'
import { OnboardingTemplatesTab } from './tabs/OnboardingTemplatesTab'
import { OffboardingChecklistTab } from './tabs/OffboardingChecklistTab'
import { ProbationEvalTab } from './tabs/ProbationEvalTab'

const config = getCategoryConfig('recruitment')

function RecruitmentSettingsContent() {
  const searchParams = useSearchParams()
  const tab = (searchParams.get('tab') ?? config.tabs[0].slug) as RecruitmentTabSlug

  const renderContent = (companyId: string | null) => {
    switch (tab) {
      case 'pipeline':
        return <PipelineTab companyId={companyId} />
      case 'interview-form':
        return <InterviewFormTab companyId={companyId} />
      case 'ai-screening':
        return <AiScreeningTab companyId={companyId} />
      case 'onboarding-templates':
        return <OnboardingTemplatesTab companyId={companyId} />
      case 'offboarding-checklist':
        return <OffboardingChecklistTab companyId={companyId} />
      case 'probation-eval':
        return <ProbationEvalTab companyId={companyId} />
      default:
        return <PipelineTab companyId={companyId} />
    }
  }

  return (
    <SettingsSubPageLayout config={config} activeTab={tab}>
      {(companyId: string | null) => renderContent(companyId)}
    </SettingsSubPageLayout>
  )
}

export function RecruitmentSettingsClient() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-16 text-muted-foreground">{'로딩 중...'}</div>}>
      <RecruitmentSettingsContent />
    </Suspense>
  )
}
