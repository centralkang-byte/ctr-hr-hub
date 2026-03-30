import type { Density } from './density'

const BASE = 'bg-card rounded-2xl shadow-sm'

export const CARD_STYLES = {
  base: BASE,
  padded: `${BASE} p-6`,
  header: 'flex items-center justify-between mb-4',
  title: 'text-lg font-semibold text-foreground',
  kpi: `${BASE} p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150`,
  clickable: `${BASE} p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer`,
} as const

/** DESIGN.md §8 — density-aware card padding */
const CARD_DENSITY_MAP = {
  compact: `${BASE} p-4`,
  comfortable: `${BASE} p-6`,
  spacious: `${BASE} p-8 gap-6`,
} as const

export function cardByDensity(density: Density) {
  return CARD_DENSITY_MAP[density]
}
