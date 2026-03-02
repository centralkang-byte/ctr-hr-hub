'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { SettingsCategory } from '@/lib/settings/categories'

interface SettingsCardProps {
  category: SettingsCategory
}

export function SettingsCard({ category }: SettingsCardProps) {
  const router = useRouter()
  const Icon = category.icon
  const previewItems = category.items.slice(0, 3)

  return (
    <button
      type="button"
      onClick={() => router.push(category.href)}
      className={cn(
        'group w-full rounded-xl border border-gray-200 bg-white p-6 text-left',
        'shadow-sm transition-all duration-150',
        'hover:border-l-4 hover:border-[#00C853] hover:shadow-md',
        category.disabled && 'cursor-not-allowed opacity-50',
      )}
      disabled={category.disabled}
    >
      {/* Icon */}
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 p-2">
        <Icon className="h-6 w-6 text-gray-600" />
      </div>

      {/* Labels */}
      <div className="mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{category.label}</h3>
        <p className="mt-0.5 text-xs text-gray-400">{category.labelEn}</p>
      </div>

      {/* Item count badge */}
      <p className="mb-3 text-sm text-gray-500">{category.items.length}개 항목</p>

      {/* Preview list */}
      <ul className="space-y-1">
        {previewItems.map((item) => (
          <li key={item.id} className="flex items-center gap-1.5 text-sm text-gray-600">
            <span className="text-gray-400">·</span>
            {item.label}
          </li>
        ))}
      </ul>
    </button>
  )
}
