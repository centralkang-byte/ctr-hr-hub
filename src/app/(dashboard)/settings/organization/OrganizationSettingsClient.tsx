'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { getCategoryConfig, type OrganizationTabSlug } from '@/components/settings/settings-config'
import { SettingsSubPageLayout } from '@/components/settings/SettingsSubPageLayout'

// Tab components
import { CompanyInfoTab } from './tabs/CompanyInfoTab'
import { DepartmentsTab } from './tabs/DepartmentsTab'
import { JobGradesTab } from './tabs/JobGradesTab'
import { JobFamiliesTab } from './tabs/JobFamiliesTab'
import { AssignmentRulesTab } from './tabs/AssignmentRulesTab'
import { ProbationTab } from './tabs/ProbationTab'
import { CustomFieldsTab } from './tabs/CustomFieldsTab'
import { CodeManagementTab } from './tabs/CodeManagementTab'

const config = getCategoryConfig('organization')

function OrganizationSettingsContent() {
  const searchParams = useSearchParams()
  const tab = (searchParams.get('tab') ?? config.tabs[0].slug) as OrganizationTabSlug

  const renderContent = (companyId: string | null) => {
    // Lazy loading: only the active tab renders (prevents N simultaneous useEffect calls)
    switch (tab) {
      case 'company-info':
        return <CompanyInfoTab companyId={companyId} />
      case 'departments':
        return <DepartmentsTab companyId={companyId} />
      case 'job-grades':
        return <JobGradesTab companyId={companyId} />
      case 'job-families':
        return <JobFamiliesTab companyId={companyId} />
      case 'assignment-rules':
        return <AssignmentRulesTab companyId={companyId} />
      case 'probation':
        return <ProbationTab companyId={companyId} />
      case 'custom-fields':
        return <CustomFieldsTab companyId={companyId} />
      case 'code-management':
        return <CodeManagementTab companyId={companyId} />
      default:
        return <CompanyInfoTab companyId={companyId} />
    }
  }

  return (
    <SettingsSubPageLayout config={config} activeTab={tab}>
      {(companyId: string | null) => renderContent(companyId)}
    </SettingsSubPageLayout>
  )
}

export function OrganizationSettingsClient() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-16 text-[#8181A5]">{'로딩 중...'}</div>}>
      <OrganizationSettingsContent />
    </Suspense>
  )
}
