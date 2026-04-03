'use client'

// ═══════════════════════════════════════════════════════════
// CompanySelectionGuide — Empty state for tabs requiring company
// Phase 4: guides users to select a company when companyId=null
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import { Building2 } from 'lucide-react'

export function CompanySelectionGuide() {
  const t = useTranslations('settings')

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Building2 className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-foreground">
        {t('selectCompany')}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {t('selectCompanyDesc')}
      </p>
    </div>
  )
}
