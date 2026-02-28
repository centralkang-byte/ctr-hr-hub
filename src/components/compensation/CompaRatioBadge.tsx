'use client'

import { getCompaRatioBand, COMPA_RATIO_CONFIG } from '@/lib/compensation'

interface CompaRatioBadgeProps {
  ratio: number
  showLabel?: boolean
}

export default function CompaRatioBadge({ ratio, showLabel = true }: CompaRatioBadgeProps) {
  const band = getCompaRatioBand(ratio)
  const config = COMPA_RATIO_CONFIG[band]

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgClass} ${config.textClass}`}
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {ratio.toFixed(2)}
      {showLabel && <span className="ml-0.5">({config.label})</span>}
    </span>
  )
}
