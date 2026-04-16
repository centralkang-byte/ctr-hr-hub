'use client'

// ═══════════════════════════════════════════════════════════
// Settings Hub — Category Card (H-1)
// Displays category icon, label, tab count, and preview items
// ═══════════════════════════════════════════════════════════

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import type { SettingsCategoryConfig } from './settings-config'

interface SettingsCategoryCardProps {
  config: SettingsCategoryConfig
}

export function SettingsCategoryCard({ config }: SettingsCategoryCardProps) {
  const router = useRouter()
  const t = useTranslations('settings')
  const Icon = config.icon
  const previewTabs = config.tabs.slice(0, 3)

  return (
    <button
      type="button"
      onClick={() => router.push(`/settings/${config.key}`)}
      className="group w-full rounded-2xl bg-card p-6 text-left shadow-sm transition-all duration-200 hover:shadow-md"
    >
      {/* Icon + Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {/* Labels */}
      <h3 className="text-base font-semibold text-foreground">{t(`categories.${config.key}`)}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{config.labelEn}</p>

      {/* Tab count */}
      <p className="mt-3 text-sm text-muted-foreground">
        {t('tabCount', { count: config.tabs.length })}
      </p>

      {/* Preview */}
      <ul className="mt-2 space-y-1">
        {previewTabs.map((tab) => (
          <li key={tab.slug} className="flex items-center gap-1.5 text-sm text-foreground/70">
            <span className="text-primary">·</span>
            {t(`tabs.${tab.slug}`)}
          </li>
        ))}
        {config.tabs.length > 3 && (
          <li className="text-xs text-muted-foreground">
            {t('moreItems', { count: config.tabs.length - 3 })}
          </li>
        )}
      </ul>
    </button>
  )
}
