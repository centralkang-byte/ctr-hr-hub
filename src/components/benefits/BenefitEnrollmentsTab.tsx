'use client'

import { useState, useCallback, useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import { apiClient } from '@/lib/api'
import { STATUS_VARIANT } from '@/lib/styles/status'
import { useToast } from '@/hooks/use-toast'
import type { PaginationInfo } from '@/types'

// ─── Types ───────────────────────────────────────────────

type EnrollmentRow = {
  id: string
  status: string
  enrolledAt: string
  expiredAt: string | null
  note: string | null
  employee: { id: string; name: string; employeeNo: string }
  policy: { id: string; name: string; category: string }
  [key: string]: unknown
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: '활성', className: STATUS_VARIANT.success },
  SUSPENDED: { label: '일시중지', className: STATUS_VARIANT.warning },
  EXPIRED: { label: '만료', className: STATUS_VARIANT.error },
}

// ─── Component ───────────────────────────────────────────

export default function BenefitEnrollmentsTab() {
  const { toast } = useToast()
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchEnrollments = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const res = await apiClient.getList<EnrollmentRow>('/api/v1/benefits/enrollments', {
        page: String(page),
        limit: '20',
      })
      setEnrollments(res.data ?? [])
      setPagination(res.pagination ?? null)
    } catch {
      toast({ title: '신청현황 로드 실패', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchEnrollments()
  }, [fetchEnrollments])

  const handleStatusChange = async (enrollment: EnrollmentRow, newStatus: string) => {
    try {
      await apiClient.put(`/api/v1/benefits/enrollments/${enrollment.id}`, {
        status: newStatus,
        ...(newStatus === 'EXPIRED' ? { expiredAt: new Date().toISOString() } : {}),
      })
      toast({ title: `상태가 ${STATUS_BADGE[newStatus]?.label ?? newStatus}(으)로 변경되었습니다.` })
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
      key: 'policy',
      header: '정책',
      render: (row) => row.policy.name,
    },
    {
      key: 'enrolledAt',
      header: '신청일',
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
      key: 'actions',
      header: '',
      render: (row) => {
        if (row.status === 'EXPIRED') return null
        return (
          <div className="flex gap-1">
            {row.status === 'ACTIVE' && (
              <Button variant="ghost" size="sm" onClick={() => handleStatusChange(row, 'SUSPENDED')}>
                일시중지
              </Button>
            )}
            {row.status === 'SUSPENDED' && (
              <Button variant="ghost" size="sm" onClick={() => handleStatusChange(row, 'ACTIVE')}>
                <CheckCircle2 className="mr-1 h-4 w-4" />
                재활성
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500"
              onClick={() => handleStatusChange(row, 'EXPIRED')}
            >
              만료처리
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
      emptyMessage="복리후생 신청 내역이 없습니다."
      rowKey={(row) => row.id}
    />
  )
}
