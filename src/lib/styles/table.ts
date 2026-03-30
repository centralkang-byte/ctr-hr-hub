import type { Density } from './density'

export const TABLE_STYLES = {
  wrapper: 'relative w-full overflow-auto rounded-xl border border-border dark:border-slate-700 shadow-sm bg-white dark:bg-slate-900',
  table: 'w-full caption-bottom text-sm border-collapse text-left',
  header: 'sticky top-0 z-10 bg-muted/50 dark:bg-slate-800 [&_tr]:border-b border-border dark:border-slate-700',
  headerCell: 'h-12 px-5 py-3.5 text-left align-middle text-[11px] font-semibold text-muted-foreground dark:text-slate-400 uppercase tracking-wider',
  headerCellRight: 'h-12 px-5 py-3.5 text-right align-middle text-[11px] font-semibold text-muted-foreground dark:text-slate-400 uppercase tracking-wider',
  row: 'border-b border-border dark:border-slate-700 transition-colors hover:bg-muted/50 dark:hover:bg-slate-800 data-[state=selected]:bg-muted dark:data-[state=selected]:bg-slate-800 group',
  rowClickable: 'border-b border-border dark:border-slate-700 transition-colors hover:bg-muted/50 dark:hover:bg-slate-800 data-[state=selected]:bg-muted dark:data-[state=selected]:bg-slate-800 group cursor-pointer',
  cell: 'p-5 py-3 align-middle text-sm text-foreground dark:text-slate-50',
  cellRight: 'p-5 py-3 align-middle text-sm text-foreground dark:text-slate-50 text-right tabular-nums',
  cellMuted: 'p-5 py-3 align-middle text-sm text-muted-foreground dark:text-slate-400',
  pagination: 'flex items-center justify-between px-5 py-3 border-t border-border dark:border-slate-700 bg-muted/50 dark:bg-slate-800',
} as const

/** DESIGN.md §8 — density-aware table cells */
const TABLE_DENSITY_MAP = {
  compact: {
    headerCell: 'h-9 px-3 py-2 text-left align-middle text-[11px] font-semibold text-muted-foreground dark:text-slate-400 uppercase tracking-wider',
    cell: 'px-3 py-1 align-middle text-xs text-foreground dark:text-slate-50',
    cellRight: 'px-3 py-1 align-middle text-xs text-foreground dark:text-slate-50 text-right tabular-nums',
    cellMuted: 'px-3 py-1 align-middle text-xs text-muted-foreground dark:text-slate-400',
  },
  comfortable: {
    headerCell: TABLE_STYLES.headerCell,
    cell: TABLE_STYLES.cell,
    cellRight: TABLE_STYLES.cellRight,
    cellMuted: TABLE_STYLES.cellMuted,
  },
  spacious: {
    headerCell: 'h-14 px-5 py-4 text-left align-middle text-[11px] font-semibold text-muted-foreground dark:text-slate-400 uppercase tracking-wider',
    cell: 'px-5 py-3.5 align-middle text-sm text-foreground dark:text-slate-50',
    cellRight: 'px-5 py-3.5 align-middle text-sm text-foreground dark:text-slate-50 text-right tabular-nums',
    cellMuted: 'px-5 py-3.5 align-middle text-sm text-muted-foreground dark:text-slate-400',
  },
} as const

export function tableByDensity(density: Density) {
  return { ...TABLE_STYLES, ...TABLE_DENSITY_MAP[density] }
}
