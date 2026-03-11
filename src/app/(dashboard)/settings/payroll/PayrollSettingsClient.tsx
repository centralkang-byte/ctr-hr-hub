'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { getCategoryConfig, type PayrollTabSlug } from '@/components/settings/settings-config'
import { SettingsSubPageLayout } from '@/components/settings/SettingsSubPageLayout'

// Tab components
import { EarningsTab } from './tabs/EarningsTab'
import { DeductionsTab } from './tabs/DeductionsTab'
import { TaxFreeTab } from './tabs/TaxFreeTab'
import { SalaryBandsTab } from './tabs/SalaryBandsTab'
import { MeritMatrixTab } from './tabs/MeritMatrixTab'
import { BonusRulesTab } from './tabs/BonusRulesTab'
import { PayScheduleTab } from './tabs/PayScheduleTab'
import { CurrencyTab } from './tabs/CurrencyTab'

const config = getCategoryConfig('payroll')

function PayrollSettingsContent() {
  const searchParams = useSearchParams()
  const tab = (searchParams.get('tab') ?? config.tabs[0].slug) as PayrollTabSlug

  const renderContent = (companyId: string | null) => {
    switch (tab) {
      case 'earnings':
        return <EarningsTab companyId={companyId} />
      case 'deductions':
        return <DeductionsTab companyId={companyId} />
      case 'tax-free':
        return <TaxFreeTab companyId={companyId} />
      case 'salary-bands':
        return <SalaryBandsTab companyId={companyId} />
      case 'merit-matrix':
        return <MeritMatrixTab companyId={companyId} />
      case 'bonus-rules':
        return <BonusRulesTab companyId={companyId} />
      case 'pay-schedule':
        return <PayScheduleTab companyId={companyId} />
      case 'currency':
        return <CurrencyTab companyId={companyId} />
      default:
        return <EarningsTab companyId={companyId} />
    }
  }

  return (
    <SettingsSubPageLayout config={config} activeTab={tab}>
      {(companyId: string | null) => renderContent(companyId)}
    </SettingsSubPageLayout>
  )
}

export function PayrollSettingsClient() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-16 text-[#8181A5]">로딩 중...</div>}>
      <PayrollSettingsContent />
    </Suspense>
  )
}
