'use client'

import { ReactNode, useState } from 'react'
import { CompanySelector } from './CompanySelector'
import { GlobalOverrideBadge } from './GlobalOverrideBadge'

type SettingsEndpoint = 'evaluation' | 'promotion' | 'compensation'

interface SettingsPageLayoutProps {
  title: string
  description: string
  endpoint: SettingsEndpoint
  defaultCompanyId: string
  isOverride: boolean
  onCompanyChange: (companyId: string) => void
  onOverrideChange: () => void
  children: ReactNode
  actions?: ReactNode
}

export function SettingsPageLayout({
  title,
  description,
  endpoint,
  defaultCompanyId,
  isOverride,
  onCompanyChange,
  onOverrideChange,
  children,
  actions,
}: SettingsPageLayoutProps) {
  const [companyId, setCompanyId] = useState(defaultCompanyId)

  const handleCompanyChange = (id: string) => {
    setCompanyId(id)
    onCompanyChange(id)
  }

  return (
    <div>
      {/* 헤더 영역 */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-[#666]">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {actions}
        </div>
      </div>

      {/* 법인 선택 + 오버라이드 뱃지 */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#555]">법인:</span>
          <CompanySelector
            selectedCompanyId={companyId}
            onCompanyChange={handleCompanyChange}
          />
        </div>

        <div className="h-4 w-px bg-border" />

        <GlobalOverrideBadge
          isOverride={isOverride}
          companyId={companyId}
          endpoint={endpoint}
          onChanged={onOverrideChange}
        />
      </div>

      {/* 콘텐츠 */}
      <div>{children}</div>
    </div>
  )
}
