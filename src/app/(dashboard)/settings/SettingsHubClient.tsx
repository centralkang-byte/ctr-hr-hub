'use client'

// ═══════════════════════════════════════════════════════════
// Settings Hub — Client Component (search deeplink + cards)
// Phase 4: flat tab-level search results with direct deeplink
// ═══════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SETTINGS_CATEGORIES } from '@/components/settings/settings-config'
import type { SettingsCategoryConfig, SettingsTab } from '@/components/settings/settings-config'
import { SettingsCategoryCard } from '@/components/settings/SettingsCategoryCard'
import { EmptyState } from '@/components/ui/EmptyState'

// ─── Types ──────────────────────────────────────────────────

interface FlatSearchResult {
  category: SettingsCategoryConfig
  tab: SettingsTab
}

// ─── Helpers ────────────────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-foreground">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ─── Component ──────────────────────────────────────────────

export function SettingsHubClient() {
  const router = useRouter()
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const resultListRef = useRef<HTMLDivElement>(null)

  // Flat search: tab-level matching across all categories
  const searchResults = useMemo<FlatSearchResult[]>(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    const results: FlatSearchResult[] = []
    for (const category of SETTINGS_CATEGORIES) {
      for (const tab of category.tabs) {
        if (
          tab.label.toLowerCase().includes(q) ||
          tab.description?.toLowerCase().includes(q) ||
          category.label.toLowerCase().includes(q) ||
          category.labelEn.toLowerCase().includes(q)
        ) {
          results.push({ category, tab })
        }
      }
    }
    return results
  }, [search])

  const hasSearch = search.trim().length > 0

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [searchResults.length])

  // Navigate to a specific tab
  const navigateToTab = useCallback((categoryKey: string, tabSlug: string) => {
    router.push(`/settings/${categoryKey}?tab=${tabSlug}`)
  }, [router])

  // Keyboard navigation: ArrowUp/Down/Enter
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!hasSearch || searchResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => {
        const next = prev < searchResults.length - 1 ? prev + 1 : 0
        requestAnimationFrame(() => {
          const item = resultListRef.current?.children[next] as HTMLElement | undefined
          item?.scrollIntoView({ block: 'nearest' })
        })
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : searchResults.length - 1
        requestAnimationFrame(() => {
          const item = resultListRef.current?.children[next] as HTMLElement | undefined
          item?.scrollIntoView({ block: 'nearest' })
        })
        return next
      })
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      const result = searchResults[selectedIndex]
      navigateToTab(result.category.key, result.tab.slug)
    } else if (e.key === 'Escape') {
      setSearch('')
    }
  }, [hasSearch, searchResults, selectedIndex, navigateToTab])

  return (
    <>
      {/* Search bar */}
      <div className="relative mb-8 max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tCommon('placeholderSettingsSearch')}
          className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground shadow-sm transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
        />
        {/* Result count badge */}
        {hasSearch && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {t('searchResultCount', { count: searchResults.length })}
          </span>
        )}
      </div>

      {/* Search results — flat tab list with deeplink */}
      {hasSearch ? (
        searchResults.length > 0 ? (
          <div
            ref={resultListRef}
            className="max-h-[480px] space-y-1 overflow-y-auto rounded-2xl bg-card p-2 shadow-sm"
            role="listbox"
          >
            {searchResults.map((result, idx) => {
              const Icon = result.category.icon
              return (
                <button
                  key={`${result.category.key}-${result.tab.slug}`}
                  type="button"
                  role="option"
                  aria-selected={idx === selectedIndex}
                  onClick={() => navigateToTab(result.category.key, result.tab.slug)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors',
                    idx === selectedIndex
                      ? 'bg-primary/8 text-foreground'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {highlightMatch(result.tab.label, search.trim())}
                    </p>
                    {result.tab.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {highlightMatch(result.tab.description, search.trim())}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {result.category.label}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="py-16 text-center">
            <EmptyState />
          </div>
        )
      ) : (
        /* Card grid — default view */
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {SETTINGS_CATEGORIES.map((config) => (
            <SettingsCategoryCard key={config.key} config={config} />
          ))}
        </div>
      )}
    </>
  )
}
