import type { Density } from './density'

const BASE = 'bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-ctr-slate-200 dark:border-slate-700'

export const CARD_STYLES = {
  base: BASE,
  padded: `${BASE} p-6`,
  header: 'flex items-center justify-between mb-4',
  title: 'text-lg font-semibold text-ctr-slate-900 dark:text-slate-50',
  kpi: `${BASE} p-5 hover:shadow-md transition-shadow duration-150`,
  clickable: `${BASE} p-6 hover:shadow-md hover:-translate-y-px transition-all duration-150 cursor-pointer`,
} as const

/** DESIGN.md §8 — density-aware card padding */
const CARD_DENSITY_MAP = {
  compact: `${BASE} p-4`,
  comfortable: `${BASE} p-6`,
  spacious: `${BASE} p-8`,
} as const

export function cardByDensity(density: Density) {
  return CARD_DENSITY_MAP[density]
}
