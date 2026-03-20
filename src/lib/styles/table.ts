export const TABLE_STYLES = {
  wrapper: 'relative w-full overflow-auto rounded-xl border border-[#F0F0F3] shadow-sm bg-white',
  table: 'w-full caption-bottom text-sm border-collapse text-left',
  header: 'sticky top-0 z-10 bg-[#F8F9FA] [&_tr]:border-b border-[#F0F0F3]',
  headerCell: 'h-12 px-5 py-3.5 text-left align-middle text-[11px] font-semibold text-[#8181A5] uppercase tracking-wider',
  headerCellRight: 'h-12 px-5 py-3.5 text-right align-middle text-[11px] font-semibold text-[#8181A5] uppercase tracking-wider',
  row: 'border-b border-[#F0F0F3] transition-colors hover:bg-[#F8F9FA] data-[state=selected]:bg-[#F5F5FA] group',
  rowClickable: 'border-b border-[#F0F0F3] transition-colors hover:bg-[#F8F9FA] data-[state=selected]:bg-[#F5F5FA] group cursor-pointer',
  cell: 'p-5 py-3 align-middle text-sm text-[#1C1D21]',
  cellRight: 'p-5 py-3 align-middle text-sm text-[#1C1D21] text-right tabular-nums',
  cellMuted: 'p-5 py-3 align-middle text-sm text-[#8181A5]',
  pagination: 'flex items-center justify-between px-5 py-3 border-t border-[#F0F0F3] bg-[#F8F9FA]',
} as const
