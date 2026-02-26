'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — DataTable
// 범용 테이블 컴포넌트 (pagination, sorting, loading, empty)
// ═══════════════════════════════════════════════════════════

import { type ReactNode, useCallback } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react'
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
import type { PaginationInfo, SortDirection } from '@/types'

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
  loading?: boolean
  emptyMessage?: string
  emptyDescription?: string
  rowKey?: (row: T, index: number) => string
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
  loading = false,
  emptyMessage = '데이터가 없습니다',
  emptyDescription,
  rowKey,
}: DataTableProps<T>) {
  const handleSort = useCallback(
    (key: string) => {
      onSort?.(key)
    },
    [onSort],
  )

  // ─── Skeleton rows when loading ───
  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {columns.map((col) => (
                  <TableCell key={`skeleton-${i}-${col.key}`}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  // ─── Empty state ───
  if (data.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
        <EmptyState title={emptyMessage} description={emptyDescription} />
      </div>
    )
  }

  // ─── Sort icon ───
  function SortIcon({ columnKey }: { columnKey: string }) {
    if (sortBy !== columnKey) {
      return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground" />
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.header}
                      <SortIcon columnKey={col.key} />
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={rowKey ? rowKey(row, index) : index}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {col.render
                      ? col.render(row, index)
                      : String(row[col.key] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ─── Pagination ─── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
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
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              이전
            </Button>
            <span className="text-sm text-muted-foreground">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange?.(pagination.page + 1)}
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
