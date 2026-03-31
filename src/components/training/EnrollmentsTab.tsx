'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { PaginationInfo } from '@/types'
import { STATUS_VARIANT } from '@/lib/styles/status'

// ─── Types ───────────────────────────────────────────────

type EnrollmentRow = {
  id: string
  status: string
  enrolledAt: string
  completedAt: string | null
  score: number | null
  employee: { id: string; name: string; employeeNo: string }
  course: { id: string; title: string; category: string; isMandatory: boolean }
  [key: string]: unknown
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ENROLLED: { label: '등록', className: STATUS_VARIANT.info },
  IN_PROGRESS: { label: '진행중', className: STATUS_VARIANT.warning },
  ENROLLMENT_COMPLETED: { label: '완료', className: STATUS_VARIANT.success },
  DROPPED: { label: '탈락', className: STATUS_VARIANT.error },
}

// ─── Component ───────────────────────────────────────────

export default function EnrollmentsTab() {
  const { toast } = useToast()
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchEnrollments = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const res = await apiClient.getList<EnrollmentRow>('/api/v1/training/enrollments', {
        page: String(page),
        limit: '20',
      })
      setEnrollments(res.data ?? [])
      setPagination(res.pagination ?? null)
    } catch {
      toast({ title: '수강현황 로드 실패', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchEnrollments()
  }, [fetchEnrollments])

  const handleStatusChange = async (enrollment: EnrollmentRow, newStatus: string) => {
    try {
      await apiClient.put(`/api/v1/training/enrollments/${enrollment.id}`, {
        status: newStatus,
        ...(newStatus === 'ENROLLMENT_COMPLETED' ? { completedAt: new Date().toISOString() } : {}),
      })
      toast({ title: `상태가 변경되었습니다.` })
      fetchEnrollments()
    } catch {
      toast({ title: '상태 변경 실패', variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<EnrollmentRow>[] = [
    {
      key: 'employee',
      header: '직원',
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.employee.name}</p>
          <p className="text-xs text-muted-foreground">{row.employee.employeeNo}</p>
        </div>
      ),
    },
    {
      key: 'course',
      header: '교육과정',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span>{row.course.title}</span>
          {row.course.isMandatory && (
            <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">필수</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'enrolledAt',
      header: '등록일',
      render: (row) => new Date(row.enrolledAt).toLocaleDateString('ko-KR'),
    },
    {
      key: 'status',
      header: '상태',
      render: (row) => {
        const badge = STATUS_BADGE[row.status]
        return badge ? (
          <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
        ) : (
          <Badge variant="outline">{row.status}</Badge>
        )
      },
    },
    {
      key: 'score',
      header: '점수',
      render: (row) => (row.score !== null ? `${row.score}점` : '-'),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        if (row.status === 'ENROLLMENT_COMPLETED' || row.status === 'DROPPED') return null
        return (
          <div className="flex gap-1">
            {row.status === 'ENROLLED' && (
              <Button variant="ghost" size="sm" onClick={() => handleStatusChange(row, 'IN_PROGRESS')}>
                진행중
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-600"
              onClick={() => handleStatusChange(row, 'ENROLLMENT_COMPLETED')}
            >
              완료
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500"
              onClick={() => handleStatusChange(row, 'DROPPED')}
            >
              탈락
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <DataTable<EnrollmentRow>
      columns={columns}
      data={enrollments}
      pagination={pagination ?? undefined}
      onPageChange={fetchEnrollments}
      loading={loading}
      emptyMessage="수강 기록이 없습니다."
      rowKey={(row) => row.id}
    />
  )
}
