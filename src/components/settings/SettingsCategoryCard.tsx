'use client'

// ═══════════════════════════════════════════════════════════
// Settings Hub — Category Card (H-1)
// Displays category icon, label, tab count, and preview items
// ═══════════════════════════════════════════════════════════

import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import type { SettingsCategoryConfig } from './settings-config'

interface SettingsCategoryCardProps {
  config: SettingsCategoryConfig
}

export function SettingsCategoryCard({ config }: SettingsCategoryCardProps) {
  const router = useRouter()
  const Icon = config.icon
  const previewTabs = config.tabs.slice(0, 3)

  return (
    <button
      type="button"
      onClick={() => router.push(`/settings/${config.key}`)}
      className="group w-full rounded-xl border border-[#F0F0F3] bg-white p-6 text-left shadow-sm transition-all duration-200 hover:shadow-md hover:border-[#5E81F4]/30"
    >
      {/* Icon + Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5E81F4]/10">
          <Icon className="h-5 w-5 text-[#5E81F4]" />
        </div>
        <ChevronRight className="h-4 w-4 text-[#8181A5] opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {/* Labels */}
      <h3 className="text-base font-semibold text-[#1C1D21]">{config.label}</h3>
      <p className="mt-0.5 text-xs text-[#8181A5]">{config.labelEn}</p>

      {/* Tab count */}
      <p className="mt-3 text-sm text-[#8181A5]">
        {config.tabs.length}개 설정 항목
      </p>

      {/* Preview */}
      <ul className="mt-2 space-y-1">
        {previewTabs.map((tab) => (
          <li key={tab.slug} className="flex items-center gap-1.5 text-sm text-[#1C1D21]/70">
            <span className="text-[#5E81F4]">·</span>
            {tab.label}
          </li>
        ))}
        {config.tabs.length > 3 && (
          <li className="text-xs text-[#8181A5]">
            +{config.tabs.length - 3}개 더보기
          </li>
        )}
      </ul>
    </button>
  )
}
