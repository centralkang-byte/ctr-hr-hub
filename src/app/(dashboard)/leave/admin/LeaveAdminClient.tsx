'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Admin Client
// 휴가 관리 (관리자): KPI, 부서별 사용률, 일괄 부여
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface DepartmentUsage {
  departmentName: string
  totalGranted: number
  totalUsed: number
  usageRate: number
}

interface LeaveAdminStats {
  year: number
  stats: {
    pending: number
    approved: number
    rejected: number
    cancelled: number
  }
  departmentUsage: DepartmentUsage[]
}

interface LeavePolicyOption {
  id: string
  name: string
}

interface DepartmentOption {
  id: string
  name: string
}

// ─── Helpers ────────────────────────────────────────────────

function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = 2024; y <= currentYear + 1; y++) {
    years.push(y)
  }
  return years
}

function getBarColor(usageRate: number): string {
  if (usageRate > 90) return 'bg-[#F44336]'
  if (usageRate >= 70) return 'bg-[#FF9800]'
  return 'bg-[#00C853]'
}

// ─── Component ──────────────────────────────────────────────

export function LeaveAdminClient({ user }: { user: SessionUser }) {
  void user

  const t = useTranslations('leave')
  const tc = useTranslations('common')

  const currentYear = new Date().getFullYear()

  const [year, setYear] = useState(String(currentYear))
  const [data, setData] = useState<LeaveAdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Bulk grant dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [policies, setPolicies] = useState<LeavePolicyOption[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [bulkForm, setBulkForm] = useState({
    policyId: '',
    year: String(currentYear),
    days: '',
    departmentId: '',
  })
  const [bulkLoading, setBulkLoading] = useState(false)

  // ─── Fetch admin stats ───
  const fetchStats = useCallback(async (y: string) => {
    setLoading(true)
    try {
      const res = await apiClient.get<LeaveAdminStats>('/api/v1/leave/admin', {
        year: y,
      })
      setData(res.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStats(year)
  }, [year, fetchStats])

  // ─── Fetch policies & departments for bulk grant ───
  const fetchBulkOptions = useCallback(async () => {
    try {
      const [pRes, dRes] = await Promise.all([
        apiClient.get<LeavePolicyOption[]>('/api/v1/leave/policies'),
        apiClient.get<DepartmentOption[]>('/api/v1/org/departments'),
      ])
      setPolicies(pRes.data ?? [])
      setDepartments(dRes.data ?? [])
    } catch {
      setPolicies([])
      setDepartments([])
    }
  }, [])

  const openBulkDialog = useCallback(() => {
    setBulkForm({
      policyId: '',
      year: year,
      days: '',
      departmentId: '',
    })
    setBulkDialogOpen(true)
    void fetchBulkOptions()
  }, [year, fetchBulkOptions])

  // ─── Bulk grant submit ───
  const handleBulkGrant = useCallback(async () => {
    if (!bulkForm.policyId || !bulkForm.departmentId || !bulkForm.days) return
    setBulkLoading(true)
    try {
      // Fetch employees in the selected department
      const empRes = await apiClient.get<{ employeeId: string }[]>(
        '/api/v1/employees',
        {
          departmentId: bulkForm.departmentId,
          limit: 500,
        },
      )
      const employeeIds = (empRes.data ?? []).map((e) => e.employeeId)

      if (employeeIds.length === 0) {
        setBulkLoading(false)
        return
      }

      await apiClient.post('/api/v1/leave/bulk-grant', {
        policyId: bulkForm.policyId,
        year: Number(bulkForm.year),
        employeeIds,
        days: Number(bulkForm.days),
      })

      setBulkDialogOpen(false)
      await fetchStats(year)
    } catch {
      // Error handled by apiClient
    } finally {
      setBulkLoading(false)
    }
  }, [bulkForm, year, fetchStats])

  // ─── Loading skeleton ───
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const stats = data?.stats ?? { pending: 0, approved: 0, rejected: 0, cancelled: 0 }
  const deptUsage = data?.departmentUsage ?? []

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t('adminTitle')}
        actions={
          <Button onClick={openBulkDialog}>{t('bulkGrant')}</Button>
        }
      />

      {/* ─── Year Selector ─── */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium">{tc('year')}</Label>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getYearOptions().map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}{t('yearSuffix')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 border-l-4 border-l-[#FF9800]">
          <p className="text-xs text-[#999] font-medium mb-2">{t('pending')}</p>
          <p className="text-3xl font-bold text-[#FF9800] tracking-[-0.02em]">{stats.pending}</p>
          {stats.pending > 0 && (
            <span className="text-xs font-semibold text-[#E65100]">{t('actionRequired')}</span>
          )}
        </div>

        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <p className="text-xs text-[#999] font-medium mb-2">{t('approved')}</p>
          <p className="text-3xl font-bold text-[#00C853] tracking-[-0.02em]">{stats.approved}</p>
        </div>

        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <p className="text-xs text-[#999] font-medium mb-2">{t('rejected')}</p>
          <p className="text-3xl font-bold text-[#1A1A1A] tracking-[-0.02em]">{stats.rejected}</p>
        </div>

        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <p className="text-xs text-[#999] font-medium mb-2">{t('cancelled')}</p>
          <p className="text-3xl font-bold text-[#1A1A1A] tracking-[-0.02em]">{stats.cancelled}</p>
        </div>
      </div>

      {/* ─── Department Usage ─── */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
        <h3 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em] mb-4">{t('departmentUsageRate')}</h3>
          {deptUsage.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#999]">
              {tc('noData')}
            </p>
          ) : (
            <div className="space-y-4">
              {deptUsage.map((dept) => (
                <div key={dept.departmentName} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[#1A1A1A]">{dept.departmentName}</span>
                    <span className="text-[#999]">
                      {dept.totalUsed}/{dept.totalGranted}
                      {t('days')} ({dept.usageRate.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#E8E8E8]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${getBarColor(dept.usageRate)}`}
                      style={{
                        width: `${Math.min(dept.usageRate, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* ─── Bulk Grant Dialog ─── */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('bulkGrant')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Policy */}
            <div className="space-y-2">
              <Label>{t('policy')}</Label>
              <Select
                value={bulkForm.policyId}
                onValueChange={(v) =>
                  setBulkForm((f) => ({ ...f, policyId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={tc('selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {policies.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label>{tc('department')}</Label>
              <Select
                value={bulkForm.departmentId}
                onValueChange={(v) =>
                  setBulkForm((f) => ({ ...f, departmentId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={tc('selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year */}
            <div className="space-y-2">
              <Label>{tc('year')}</Label>
              <Input
                type="number"
                value={bulkForm.year}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, year: e.target.value }))
                }
                min={2024}
                max={currentYear + 1}
              />
            </div>

            {/* Days */}
            <div className="space-y-2">
              <Label>{t('days')}</Label>
              <Input
                type="number"
                value={bulkForm.days}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, days: e.target.value }))
                }
                min={0}
                step={0.5}
                placeholder={t('daysToGrant')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDialogOpen(false)}
            >
              {tc('cancel')}
            </Button>
            <Button
              onClick={handleBulkGrant}
              disabled={
                bulkLoading ||
                !bulkForm.policyId ||
                !bulkForm.departmentId ||
                !bulkForm.days
              }
            >
              {bulkLoading ? tc('loading') : tc('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
