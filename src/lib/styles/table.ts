export const TABLE_STYLES = {
  wrapper: 'overflow-x-auto',
  table: 'w-full',
  header: 'bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider',
  headerCell: 'px-4 py-3 text-left',
  headerCellRight: 'px-4 py-3 text-right',
  row: 'hover:bg-gray-50/50 border-b border-gray-100 transition-colors duration-150',
  rowClickable: 'hover:bg-gray-50/50 border-b border-gray-100 transition-colors duration-150 cursor-pointer',
  cell: 'px-4 py-3 text-sm text-gray-900',
  cellRight: 'px-4 py-3 text-sm text-gray-900 text-right tabular-nums',
  cellMuted: 'px-4 py-3 text-sm text-gray-500',
  pagination: 'flex items-center justify-between px-4 py-3 border-t border-gray-100',
} as const
