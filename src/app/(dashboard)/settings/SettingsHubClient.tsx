'use client'

// ═══════════════════════════════════════════════════════════
// Settings Hub — Client Component (search + cards)
// ═══════════════════════════════════════════════════════════

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { SETTINGS_CATEGORIES } from '@/components/settings/settings-config'
import { SettingsCategoryCard } from '@/components/settings/SettingsCategoryCard'

export function SettingsHubClient() {
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
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8181A5]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="설정 항목 검색... (예: 휴가, 급여, 등급)"
          className="w-full rounded-xl border border-[#F0F0F3] bg-white py-3 pl-10 pr-4 text-sm text-[#1C1D21] placeholder:text-[#8181A5] shadow-sm transition-colors focus:border-[#5E81F4]/40 focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/10"
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
          <p className="text-sm text-[#8181A5]">
            &quot;{search}&quot;에 대한 검색 결과가 없습니다
          </p>
        </div>
      )}
    </>
  )
}
