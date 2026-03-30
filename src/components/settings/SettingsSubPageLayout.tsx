'use client'

// ═══════════════════════════════════════════════════════════
// Settings — Sub-page Shared Layout (H-1 → H-2a upgrade)
// Breadcrumb + CompanySelector + Side Tabs + Content
// Now exposes companyId via render-prop children
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CompanySettingSelector } from './CompanySettingSelector'
import type { SettingsCategoryConfig, SettingsTabSlug } from './settings-config'

interface SettingsSubPageLayoutProps {
  config: SettingsCategoryConfig
  activeTab: SettingsTabSlug
  children: React.ReactNode | ((companyId: string | null) => React.ReactNode)
}

export function SettingsSubPageLayout({ config, activeTab, children }: SettingsSubPageLayoutProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [companyId, setCompanyId] = useState<string | null>(null)

  const currentTab = config.tabs.find((t) => t.slug === activeTab) ?? config.tabs[0]
  const Icon = config.icon

  const handleTabChange = useCallback((slug: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', slug)
    router.push(`/settings/${config.key}?${params.toString()}`)
  }, [router, searchParams, config.key])

  // Resolve children: support both ReactNode and render-prop
  const resolvedChildren = typeof children === 'function' ? children(companyId) : children

  return (
    <div className="min-h-screen bg-muted">
      <div className="p-6">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-1.5 text-sm">
          <Link href="/settings" className="text-muted-foreground transition-colors hover:text-primary">
            설정
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{config.label}</span>
          {currentTab && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-foreground">{currentTab.label}</span>
            </>
          )}
        </nav>

        {/* Header + Company Selector */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{config.label}</h1>
              <p className="text-xs text-muted-foreground">{config.labelEn}</p>
            </div>
          </div>
          <CompanySettingSelector value={companyId} onChange={setCompanyId} />
        </div>

        {/* Main Area: Side Tabs + Content */}
        <div className="flex gap-0 rounded-xl border border-border bg-card shadow-sm">
          {/* Side Tabs — Desktop */}
          <nav className="hidden w-[220px] shrink-0 border-r border-border lg:block">
            <div className="p-2">
              {config.tabs.map((tab) => (
                <button
                  key={tab.slug}
                  type="button"
                  onClick={() => handleTabChange(tab.slug)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    activeTab === tab.slug
                      ? 'bg-primary/8 font-medium text-primary border-l-2 border-primary'
                      : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span className="flex-1">{tab.label}</span>
                  {tab.isGlobalOnly && (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          </nav>

          {/* Side Tabs — Mobile */}
          <div className="block border-b border-border p-3 lg:hidden">
            <select
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
            >
              {config.tabs.map((tab) => (
                <option key={tab.slug} value={tab.slug}>
                  {tab.label} {tab.isGlobalOnly ? '🔒' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6">
            {resolvedChildren}
          </div>
        </div>
      </div>
    </div>
  )
}
