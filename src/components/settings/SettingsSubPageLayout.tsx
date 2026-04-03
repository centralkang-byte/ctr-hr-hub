'use client'

// ═══════════════════════════════════════════════════════════
// Settings — Sub-page Shared Layout (H-1 → H-2a → Phase 4)
// Breadcrumb + CompanySelector + Side Tabs + Content
// Phase 4: global banner + DESIGN.md alignment (No-Line Rule)
// ═══════════════════════════════════════════════════════════

import { useCallback, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronRight, Globe, Lock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CompanySettingSelector } from './CompanySettingSelector'
import type { SettingsCategoryConfig, SettingsTabSlug } from './settings-config'

// ─── Constants ──────────────────────────────────────────────

const BANNER_DISMISS_KEY = 'settings-global-banner-dismissed'

// ─── Types ──────────────────────────────────────────────────

interface SettingsSubPageLayoutProps {
  config: SettingsCategoryConfig
  activeTab: SettingsTabSlug
  children: React.ReactNode | ((companyId: string | null) => React.ReactNode)
}

// ─── Component ──────────────────────────────────────────────

export function SettingsSubPageLayout({ config, activeTab, children }: SettingsSubPageLayoutProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('settings')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(true) // default true to prevent flash

  const currentTab = config.tabs.find((t) => t.slug === activeTab) ?? config.tabs[0]
  const isGlobalOnlyTab = currentTab?.isGlobalOnly ?? false
  const Icon = config.icon

  // Hydration-safe: read sessionStorage after mount
  useEffect(() => {
    const dismissed = sessionStorage.getItem(BANNER_DISMISS_KEY) === 'true'
    setBannerDismissed(dismissed)
  }, [])

  const handleDismissBanner = useCallback(() => {
    setBannerDismissed(true)
    sessionStorage.setItem(BANNER_DISMISS_KEY, 'true')
  }, [])

  const handleTabChange = useCallback((slug: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', slug)
    router.push(`/settings/${config.key}?${params.toString()}`)
  }, [router, searchParams, config.key])

  // Show banner: global mode + not dismissed + not a global-only tab
  const showGlobalBanner = companyId === null && !bannerDismissed && !isGlobalOnlyTab

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
        <div className="flex gap-0 rounded-2xl bg-card shadow-sm">
          {/* Side Tabs — Desktop */}
          <nav className="hidden w-[220px] shrink-0 border-r border-border/30 lg:block">
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
          <div className="block border-b border-border/30 p-3 lg:hidden">
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
            {/* Global mode info banner */}
            {showGlobalBanner && (
              <div className="mb-4 flex items-start gap-3 rounded-xl bg-primary/5 p-3">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{t('globalBanner')}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t('globalBannerDesc')}</p>
                </div>
                <button
                  type="button"
                  onClick={handleDismissBanner}
                  className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {resolvedChildren}
          </div>
        </div>
      </div>
    </div>
  )
}
