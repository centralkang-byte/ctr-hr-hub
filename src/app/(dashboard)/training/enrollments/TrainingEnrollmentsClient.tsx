'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { PaginationInfo } from '@/types'

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

// ─── Component ───────────────────────────────────────────

export default function TrainingEnrollmentsClient() {
  const t = useTranslations('training')
  const tc = useTranslations('common')
  const { toast } = useToast()
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    ENROLLED: { label: t('enrolled'), className: 'bg-blue-50 text-blue-700 border-blue-200' },
    IN_PROGRESS: { label: t('inProgress'), className: 'bg-amber-50 text-amber-700 border-amber-200' },
    ENROLLMENT_COMPLETED: { label: t('completed'), className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    DROPPED: { label: t('dropped'), className: 'bg-red-50 text-red-700 border-red-200' },
  }

  const fetchEnrollments = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' }
      if (statusFilter) params.status = statusFilter

      const res = await apiClient.getList<EnrollmentRow>('/api/v1/training/enrollments', params)
      setEnrollments(res.data ?? [])
      setPagination(res.pagination ?? null)
    } catch {
      toast({ title: t('loadFailed'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast, statusFilter, t])

  useEffect(() => {
    fetchEnrollments()
  }, [fetchEnrollments])

  const handleStatusChange = async (enrollment: EnrollmentRow, newStatus: string) => {
    try {
      await apiClient.put(`/api/v1/training/enrollments/${enrollment.id}`, {
        status: newStatus,
        ...(newStatus === 'ENROLLMENT_COMPLETED' ? { completedAt: new Date().toISOString() } : {}),
      })
      toast({ title: t('statusChanged') })
      fetchEnrollments()
    } catch {
      toast({ title: t('statusChangeFailed'), variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<EnrollmentRow>[] = [
    {
      key: 'employee',
      header: t('employee'),
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.employee.name}</p>
          <p className="text-xs text-slate-500">{row.employee.employeeNo}</p>
        </div>
      ),
    },
    {
      key: 'course',
      header: t('courses'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <span>{row.course.title}</span>
          {row.course.isMandatory && (
            <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]">{t('mandatoryBadge')}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'enrolledAt',
      header: t('enrolledDate'),
      render: (row) => new Date(row.enrolledAt).toLocaleDateString('ko-KR'),
    },
    {
      key: 'completedAt',
      header: t('completedDate'),
      render: (row) => (row.completedAt ? new Date(row.completedAt).toLocaleDateString('ko-KR') : '-'),
    },
    {
      key: 'status',
      header: tc('status'),
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
      header: t('score'),
      render: (row) => (row.score !== null ? t('scoreUnit', { score: row.score }) : '-'),
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
                {t('inProgress')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-600"
              onClick={() => handleStatusChange(row, 'ENROLLMENT_COMPLETED')}
            >
              {t('completed')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500"
              onClick={() => handleStatusChange(row, 'DROPPED')}
            >
              {t('dropped')}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-xs text-slate-400 mb-1">{t('enrollmentBreadcrumb')}</nav>
          <h1 className="text-2xl font-bold text-slate-900">{t('enrollmentList')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t('allStatus')}</option>
            <option value="ENROLLED">{t('enrolled')}</option>
            <option value="IN_PROGRESS">{t('inProgress')}</option>
            <option value="ENROLLMENT_COMPLETED">{t('completed')}</option>
            <option value="DROPPED">{t('dropped')}</option>
          </select>
        </div>
      </div>

      <DataTable<EnrollmentRow>
        columns={columns}
        data={enrollments}
        pagination={pagination ?? undefined}
        onPageChange={fetchEnrollments}
        loading={loading}
        emptyMessage={t('noEnrollments')}
        rowKey={(row) => row.id}
      />
    </div>
  )
}
