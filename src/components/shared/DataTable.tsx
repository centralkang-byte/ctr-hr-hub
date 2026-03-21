'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — DataTable
// 범용 테이블 컴포넌트 (pagination, sorting, loading, empty)
// virtualScroll 옵션: @tanstack/react-virtual 기반 가상 스크롤
// ═══════════════════════════════════════════════════════════

import { type ReactNode, useCallback, useRef, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Settings2, RotateCcw } from 'lucide-react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PaginationInfo, SortDirection } from '@/types'

// ─── Sort icon (module-level to avoid unmount/remount on parent re-render) ───

function SortIcon({
  columnKey,
  sortBy,
  sortDir,
}: {
  columnKey: string
  sortBy?: string
  sortDir?: SortDirection
}) {
  if (sortBy !== columnKey) {
    return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground" />
  }
  return sortDir === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  )
}

// ─── Types ──────────────────────────────────────────────────

export interface DataTableColumn<T> {
  key: string
  header: string
  render?: (row: T, index: number) => ReactNode
  sortable?: boolean
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  pagination?: PaginationInfo
  onPageChange?: (page: number) => void
  sortBy?: string
  sortDir?: SortDirection
  onSort?: (key: string) => void
  onRowClick?: (row: T, index: number) => void
  loading?: boolean
  emptyMessage?: string
  emptyDescription?: string
  emptyAction?: { label: string; onClick: () => void }
  rowKey?: (row: T, index: number) => string
  /** 가상 스크롤 활성화 (대용량 데이터, pagination 없이 전체 렌더링 시) */
  virtualScroll?: boolean
  /** 가상 스크롤 컨테이너 높이 (px, 기본값 520) */
  virtualScrollHeight?: number
  /** 가상 스크롤 예상 행 높이 (px, 기본값 52) */
  estimatedRowHeight?: number
  /** 스켈레톤 로딩 행 수 (기본값 5, pageSize에 맞추면 자연스러움) */
  skeletonRows?: number
  /** 열 커스터마이징 활성화 (localStorage 키로 사용) */
  tableId?: string
}

// ─── Component ──────────────────────────────────────────────

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  pagination,
  onPageChange,
  sortBy,
  sortDir,
  onSort,
  onRowClick,
  loading = false,
  emptyMessage = '데이터가 없습니다',
  emptyDescription,
  emptyAction,
  rowKey,
  virtualScroll = false,
  virtualScrollHeight = 520,
  estimatedRowHeight = 52,
  skeletonRows = 5,
  tableId,
}: DataTableProps<T>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleSort = useCallback(
    (key: string) => {
      onSort?.(key)
    },
    [onSort],
  )

  // ─── Column visibility (opt-in via tableId) ───
  const STORAGE_VERSION = 'v1'
  const allColumnKeys = columns.map((c) => c.key)

  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!tableId) return
    try {
      const key = `table_cols_${tableId}_${STORAGE_VERSION}`
      const saved = JSON.parse(localStorage.getItem(key) || 'null') as string[] | null
      if (saved && Array.isArray(saved)) {
        // 유효성 검증: 현재 존재하는 컬럼만 필터
        const validHidden = saved.filter((k) => allColumnKeys.includes(k))
        // 모든 컬럼이 숨겨진 경우 → silent reset
        if (validHidden.length < allColumnKeys.length) {
          setHiddenColumns(new Set(validHidden))
        } else {
          localStorage.removeItem(key)
        }
      }
    } catch {
      // localStorage 접근 실패 무시
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  const toggleColumn = useCallback((colKey: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      if (next.has(colKey)) {
        next.delete(colKey)
      } else {
        // 최소 1개 컬럼은 보여야 함
        if (allColumnKeys.length - next.size <= 1) return prev
        next.add(colKey)
      }
      if (tableId) {
        const key = `table_cols_${tableId}_${STORAGE_VERSION}`
        localStorage.setItem(key, JSON.stringify([...next]))
      }
      return next
    })
  }, [allColumnKeys.length, tableId])

  const resetColumns = useCallback(() => {
    setHiddenColumns(new Set())
    if (tableId) {
      localStorage.removeItem(`table_cols_${tableId}_${STORAGE_VERSION}`)
    }
  }, [tableId])

  // 보이는 컬럼만 필터
  const visibleColumns = tableId
    ? columns.filter((c) => !hiddenColumns.has(c.key))
    : columns

  // ─── Virtual rows (only active when virtualScroll=true) ───
  const virtualizer = useVirtualizer({
    count: virtualScroll ? data.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 5,
  })

  // ─── Column settings button ───
  const columnSettingsButton = tableId ? (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 border-[#F0F0F3] text-[#8181A5] hover:bg-[#F5F5FA]">
            <Settings2 className="h-3.5 w-3.5" />
            열 설정
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {columns.map((col) => (
            <DropdownMenuCheckboxItem
              key={col.key}
              checked={!hiddenColumns.has(col.key)}
              onCheckedChange={() => toggleColumn(col.key)}
            >
              {col.header}
            </DropdownMenuCheckboxItem>
          ))}
          {hiddenColumns.size > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={false} onCheckedChange={resetColumns}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                기본값 복원
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : null

  // ─── Skeleton rows when loading ───
  if (loading) {
    return (
      <div className="space-y-4">
        {columnSettingsButton}
        <div className="rounded-xl border border-[#F0F0F3] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map((col) => (
                  <TableHead key={col.key}>{col.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {visibleColumns.map((col) => (
                    <TableCell key={`skeleton-${i}-${col.key}`}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  // ─── Empty state ───
  if (data.length === 0) {
    return (
      <div className="space-y-4">
        {columnSettingsButton}
        <div className="rounded-xl border border-[#F0F0F3] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map((col) => (
                  <TableHead key={col.key}>{col.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
          </Table>
          <EmptyState title={emptyMessage} description={emptyDescription} action={emptyAction} />
        </div>
      </div>
    )
  }

  // ─── Shared header ───
  const headerRow = (
    <TableHeader>
      <TableRow>
        {visibleColumns.map((col) => (
          <TableHead key={col.key}>
            {col.sortable && onSort ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 font-bold text-[#8181A5] hover:text-[#1C1D21]"
                onClick={() => handleSort(col.key)}
              >
                {col.header}
                <SortIcon columnKey={col.key} sortBy={sortBy} sortDir={sortDir} />
              </button>
            ) : (
              col.header
            )}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )

  // ─── Row renderer ───
  const renderRow = (row: T, index: number) => (
    <TableRow
      key={rowKey ? rowKey(row, index) : index}
      onClick={onRowClick ? () => onRowClick(row, index) : undefined}
      className={onRowClick ? 'cursor-pointer hover:bg-[#F5F5FA]' : ''}
    >
      {visibleColumns.map((col) => (
        <TableCell key={col.key}>
          {col.render ? col.render(row, index) : String(row[col.key] ?? '')}
        </TableCell>
      ))}
    </TableRow>
  )

  return (
    <div className="space-y-4">
      {columnSettingsButton}
      {virtualScroll ? (
        /* ── Virtual scroll mode ── */
        <div className="rounded-xl border border-[#F0F0F3] overflow-hidden">
          <div
            ref={scrollContainerRef}
            style={{ height: virtualScrollHeight, overflowY: 'auto' }}
          >
            <Table>
              {/* Sticky header inside scroll container */}
              <thead className="sticky top-0 z-10 bg-white">
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-[13px] font-bold text-[#8181A5] border-b border-[#F0F0F3]"
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-bold text-[#8181A5] hover:text-[#1C1D21]"
                        onClick={() => handleSort(col.key)}
                      >
                        {col.header}
                        <SortIcon columnKey={col.key} sortBy={sortBy} sortDir={sortDir} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </thead>
              <tbody>
                {/* Top spacer row */}
                {virtualizer.getVirtualItems().length > 0 && (
                  <tr>
                    <td
                      colSpan={visibleColumns.length}
                      style={{
                        height: virtualizer.getVirtualItems()[0].start,
                        padding: 0,
                        border: 'none',
                      }}
                    />
                  </tr>
                )}
                {/* Visible virtual rows */}
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = data[virtualRow.index]
                  return (
                    <tr
                      key={rowKey ? rowKey(row, virtualRow.index) : virtualRow.index}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      onClick={onRowClick ? () => onRowClick(row, virtualRow.index) : undefined}
                      className={`border-b border-[#F0F0F3] ${onRowClick ? 'cursor-pointer hover:bg-[#F5F5FA]' : ''}`}
                    >
                      {visibleColumns.map((col) => (
                        <td
                          key={col.key}
                          className="px-4 py-3 text-sm text-[#1C1D21]"
                        >
                          {col.render
                            ? col.render(row, virtualRow.index)
                            : String(row[col.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {/* Bottom spacer row */}
                {virtualizer.getVirtualItems().length > 0 && (
                  <tr>
                    <td
                      colSpan={visibleColumns.length}
                      style={{
                        height:
                          virtualizer.getTotalSize() -
                          (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                        padding: 0,
                        border: 'none',
                      }}
                    />
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </div>
      ) : (
        /* ── Normal (paginated) mode ── */
        <div className="rounded-xl border border-[#F0F0F3] overflow-hidden">
          <Table>
            {headerRow}
            <TableBody>
              {data.map((row, index) => renderRow(row, index))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ─── Pagination ─── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-[#8181A5]">
            전체 {pagination.total.toLocaleString()}건 중{' '}
            {((pagination.page - 1) * pagination.limit + 1).toLocaleString()}–
            {Math.min(pagination.page * pagination.limit, pagination.total).toLocaleString()}건
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
              className="border-[#F0F0F3] text-[#1C1D21] hover:bg-[#F5F5FA]"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              이전
            </Button>
            <span className="text-sm text-[#8181A5]">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange?.(pagination.page + 1)}
              className="border-[#F0F0F3] text-[#1C1D21] hover:bg-[#F5F5FA]"
            >
              다음
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
