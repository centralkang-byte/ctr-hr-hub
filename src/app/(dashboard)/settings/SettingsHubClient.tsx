'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// Settings Hub — Client Component (search + cards)
// ═══════════════════════════════════════════════════════════

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { SETTINGS_CATEGORIES } from '@/components/settings/settings-config'
import { SettingsCategoryCard } from '@/components/settings/SettingsCategoryCard'

export function SettingsHubClient() {
  const tCommon = useTranslations('common')
  const [search, setSearch] = useState('')

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return SETTINGS_CATEGORIES
    const q = search.toLowerCase()
    return SETTINGS_CATEGORIES.filter((cat) =>
      cat.label.toLowerCase().includes(q) ||
      cat.labelEn.toLowerCase().includes(q) ||
      cat.tabs.some((tab) =>
        tab.label.toLowerCase().includes(q) ||
        (tab.description?.toLowerCase().includes(q))
      )
    )
  }, [search])

  return (
    <>
      {/* Search bar */}
      <div className="relative mb-8 max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tCommon('placeholderSettingsSearch')}
          className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground shadow-sm transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
        />
      </div>

      {/* Card grid */}
      {filteredCategories.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredCategories.map((config) => (
            <SettingsCategoryCard key={config.key} config={config} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <EmptyState />
        </div>
      )}
    </>
  )
}
