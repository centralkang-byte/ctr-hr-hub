/** DESIGN.md §8 — Density Tokens (compact / comfortable / spacious) */

export type Density = 'compact' | 'comfortable' | 'spacious'

export const DENSITY = {
  compact: {
    card: 'p-4',
    cell: 'px-3 py-1',
    gap: 'gap-2',
    text: 'text-xs',
    sectionGap: 'space-y-4',
  },
  comfortable: {
    card: 'p-6',
    cell: 'px-5 py-3',
    gap: 'gap-4',
    text: 'text-sm',
    sectionGap: 'space-y-6',
  },
  spacious: {
    card: 'p-8',
    cell: 'px-5 py-3.5',
    gap: 'gap-6',
    text: 'text-base',
    sectionGap: 'space-y-6',
  },
} as const
