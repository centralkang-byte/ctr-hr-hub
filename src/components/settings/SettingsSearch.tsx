'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { SETTINGS_CATEGORIES, type SettingsCategory, type SettingsItem } from '@/lib/settings/categories'

interface SearchResult {
  category: SettingsCategory
  item: SettingsItem
}

interface SettingsSearchProps {
  onQueryChange?: (query: string) => void
}

export function SettingsSearch({ onQueryChange }: SettingsSearchProps) {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const results: SearchResult[] = query.trim().length < 2
    ? []
    : SETTINGS_CATEGORIES.flatMap((category) =>
        category.items
          .filter(
            (item) =>
              item.label.includes(query) ||
              item.description.includes(query),
          )
          .map((item) => ({ category, item })),
      )

  function handleChange(value: string) {
    setQuery(value)
    onQueryChange?.(value)
  }

  function handleResultClick(category: SettingsCategory, item: SettingsItem) {
    router.push(`${category.href}?tab=${item.id}`)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="설정 검색... (예: 급여밴드, 공휴일)"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          className="h-10 pl-9 text-sm"
        />
      </div>

      {/* Dropdown results */}
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map(({ category, item }) => (
            <button
              key={`${category.id}-${item.id}`}
              type="button"
              onClick={() => handleResultClick(category, item)}
              className="flex w-full flex-col px-4 py-3 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
            >
              <span className="text-sm font-medium text-gray-900">{item.label}</span>
              <span className="mt-0.5 text-xs text-gray-400">
                {category.label} · {item.description.slice(0, 50)}…
              </span>
            </button>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
          <p className="text-sm text-gray-500">
            &ldquo;{query}&rdquo;에 해당하는 설정 항목이 없습니다.
          </p>
        </div>
      )}
    </div>
  )
}
