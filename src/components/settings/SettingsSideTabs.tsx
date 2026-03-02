'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { SettingsItem } from '@/lib/settings/categories'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SettingsSideTabsProps {
  categoryHref: string
  items: SettingsItem[]
  activeTab: string
}

export function SettingsSideTabs({ categoryHref, items, activeTab }: SettingsSideTabsProps) {
  const router = useRouter()

  function navigate(tabId: string) {
    router.push(`${categoryHref}?tab=${tabId}`)
  }

  return (
    <>
      {/* Desktop: side tabs */}
      <nav className="hidden w-60 shrink-0 border-r border-gray-200 pr-0 lg:block">
        <ul className="space-y-0.5 py-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => navigate(item.id)}
                className={cn(
                  'w-full rounded-r-lg px-4 py-2.5 text-left text-sm transition-colors',
                  activeTab === item.id
                    ? 'border-l-4 border-[#00C853] bg-green-50/50 font-medium text-gray-900'
                    : 'border-l-4 border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile: select dropdown */}
      <div className="mb-4 lg:hidden">
        <Select value={activeTab} onValueChange={navigate}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  )
}
