import type { Density } from './density'

export const TABLE_STYLES = {
  wrapper: 'relative w-full overflow-auto rounded-2xl shadow-sm bg-card',
  table: 'w-full caption-bottom text-sm border-collapse text-left',
  header: 'sticky top-0 z-10 bg-muted/50',
  headerCell: 'h-12 px-5 py-3.5 text-left align-middle text-[11px] font-semibold text-muted-foreground uppercase tracking-wider',
  headerCellRight: 'h-12 px-5 py-3.5 text-right align-middle text-[11px] font-semibold text-muted-foreground uppercase tracking-wider',
  row: 'transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted group',
  rowClickable: 'transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted group cursor-pointer',
  cell: 'p-5 py-3 align-middle text-sm text-foreground',
  cellRight: 'p-5 py-3 align-middle text-sm text-foreground text-right tabular-nums',
  cellMuted: 'p-5 py-3 align-middle text-sm text-muted-foreground',
  pagination: 'flex items-center justify-between px-5 py-3 bg-muted/50',
} as const

/** DESIGN.md — Zebra Stripe tokens (opt-in for payroll/attendance/audit) */
export const TABLE_ZEBRA = {
  header: 'sticky top-0 z-10 bg-muted',
  headerCell: 'h-9 px-3 py-2 text-left align-middle text-[11px] font-semibold text-muted-foreground uppercase tracking-wider',
  rowEven: 'bg-muted/30',
} as const

/** DESIGN.md §8 — density-aware table cells */
const TABLE_DENSITY_MAP = {
  compact: {
    headerCell: 'h-9 px-3 py-2 text-left align-middle text-[11px] font-semibold text-muted-foreground uppercase tracking-wider',
    cell: 'px-3 py-1 align-middle text-xs text-foreground',
    cellRight: 'px-3 py-1 align-middle text-xs text-foreground text-right tabular-nums',
    cellMuted: 'px-3 py-1 align-middle text-xs text-muted-foreground',
  },
  comfortable: {
    headerCell: TABLE_STYLES.headerCell,
    cell: TABLE_STYLES.cell,
    cellRight: TABLE_STYLES.cellRight,
    cellMuted: TABLE_STYLES.cellMuted,
  },
  spacious: {
    headerCell: 'h-14 px-5 py-4 text-left align-middle text-[11px] font-semibold text-muted-foreground uppercase tracking-wider',
    cell: 'px-5 py-3.5 align-middle text-sm text-foreground',
    cellRight: 'px-5 py-3.5 align-middle text-sm text-foreground text-right tabular-nums',
    cellMuted: 'px-5 py-3.5 align-middle text-sm text-muted-foreground',
  },
} as const

export function tableByDensity(density: Density) {
  return { ...TABLE_STYLES, ...TABLE_DENSITY_MAP[density] }
}
