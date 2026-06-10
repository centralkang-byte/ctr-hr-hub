import type { Density } from './density'

// Wave 0: proto workday .tbl 정렬 (styles.css:1228-1241 + 4705) — 13px 본문,
// th 11px/600/uppercase/0.04em/bg-sunk, 가시 보더, 행 border-b
export const TABLE_STYLES = {
  wrapper: 'relative w-full overflow-auto rounded-2xl border border-border shadow-sm bg-card',
  table: 'w-full caption-bottom text-[13px] border-collapse text-left',
  header: 'sticky top-0 z-10 bg-muted',
  headerCell: 'px-4 py-3 text-left align-middle text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.04em]',
  headerCellRight: 'px-4 py-3 text-right align-middle text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.04em]',
  row: 'border-b border-border last:border-0 transition-colors hover:bg-muted/60 data-[state=selected]:bg-accent group',
  rowClickable: 'border-b border-border last:border-0 transition-colors hover:bg-muted/60 data-[state=selected]:bg-accent group cursor-pointer',
  cell: 'px-4 py-[13px] align-middle text-[13px] text-foreground',
  cellRight: 'px-4 py-[13px] align-middle text-[13px] text-foreground text-right tabular-nums',
  cellMuted: 'px-4 py-[13px] align-middle text-[13px] text-muted-foreground',
  pagination: 'flex items-center justify-between px-4 py-3 bg-muted/50',
} as const

/** DESIGN.md — Zebra Stripe tokens (opt-in for payroll/attendance/audit) */
export const TABLE_ZEBRA = {
  header: 'sticky top-0 z-10 bg-muted',
  headerCell: 'h-9 px-3 py-2 text-left align-middle text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.04em]',
  rowEven: 'bg-muted/30',
} as const

/** DESIGN.md §8 — density-aware table cells */
const TABLE_DENSITY_MAP = {
  compact: {
    headerCell: 'h-9 px-3 py-2 text-left align-middle text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.04em]',
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
    headerCell: 'h-14 px-5 py-4 text-left align-middle text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.04em]',
    cell: 'px-5 py-3.5 align-middle text-[13px] text-foreground',
    cellRight: 'px-5 py-3.5 align-middle text-[13px] text-foreground text-right tabular-nums',
    cellMuted: 'px-5 py-3.5 align-middle text-[13px] text-muted-foreground',
  },
} as const

export function tableByDensity(density: Density) {
  return { ...TABLE_STYLES, ...TABLE_DENSITY_MAP[density] }
}
