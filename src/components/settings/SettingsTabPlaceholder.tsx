'use client'

// ═══════════════════════════════════════════════════════════
// Settings — Tab Placeholder (H-1)
// Used for tabs that will be connected to APIs in H-2
// ═══════════════════════════════════════════════════════════

import { Construction } from 'lucide-react'

interface SettingsTabPlaceholderProps {
  tabLabel: string
  description?: string
  phase?: string
}

export function SettingsTabPlaceholder({ tabLabel, description, phase = 'H-2' }: SettingsTabPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F5FA]">
        <Construction className="h-7 w-7 text-[#8181A5]" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-[#1C1D21]">{tabLabel}</h3>
      {description && (
        <p className="mb-3 max-w-sm text-sm text-[#8181A5]">{description}</p>
      )}
      <p className="rounded-lg bg-[#F5F5FA] px-4 py-2 text-xs text-[#8181A5]">
        이 설정은 Phase {phase}에서 연결됩니다
      </p>
    </div>
  )
}
