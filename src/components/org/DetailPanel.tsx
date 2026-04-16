// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Org Detail Panel
// Phase 4 Batch 8: 부서 상세 사이드 패널
// ═══════════════════════════════════════════════════════════

'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { apiClient } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────

type DeptHead = {
  employeeId: string
  name: string
  nameEn: string | null
  title: string | null
}

type DeptNode = {
  id: string
  name: string
  nameEn: string | null
  code: string
  level: number
  sortOrder: number
  deletedAt: string | null
  parentId: string | null
  employeeCount: number
  head: DeptHead | null
  children: DeptNode[]
}

type EmployeeRow = {
  id: string
  name: string
  employeeNo: string
  jobGrade?: { name: string } | null
}

interface DetailPanelProps {
  dept: DeptNode | null
  onClose: () => void
}

// ─── Helpers ────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

export function DetailPanel({ dept, onClose }: DetailPanelProps) {
  const t = useTranslations('org')
  const tc = useTranslations('common')
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [loadingEmps, setLoadingEmps] = useState(false)

  useEffect(() => {
    if (!dept) return
    setLoadingEmps(true)
    apiClient
      .getList<EmployeeRow>('/api/v1/employees', {
        departmentId: dept.id,
        limit: 50,
      })
      .then((res) => setEmployees(res.data))
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmps(false))
  }, [dept])

  if (!dept) return null

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-card shadow-lg z-10 flex flex-col overflow-hidden rounded-l-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 shrink-0">
        <h3 className="font-semibold text-sm truncate text-foreground">{dept.name}</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground ml-2"
          aria-label={t('close')}
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Dept Info */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">{t('deptInfo')}</h4>
          <div className="bg-background rounded-lg p-3 space-y-1.5 text-sm">
            <InfoRow label={t('code')} value={dept.code} />
            <InfoRow label={t('level')} value={String(dept.level)} />
            <InfoRow label={t('status')} value={!dept.deletedAt ? tc('active') : tc('inactive')} />
            <InfoRow label={t('headcount')} value={t('headcountUnit', { count: dept.employeeCount })} />
            {dept.nameEn && <InfoRow label={t('nameEn')} value={dept.nameEn} />}
          </div>
        </div>

        {/* Sub-departments */}
        {dept.children.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">
              {t('subDepartments')} ({dept.children.length})
            </h4>
            <ul className="space-y-1">
              {dept.children.map((child) => (
                <li key={child.id} className="text-sm px-3 py-1.5 bg-background rounded flex justify-between">
                  <span className="text-foreground">{child.name}</span>
                  <span className="text-muted-foreground text-xs">{t('headcountUnit', { count: child.employeeCount })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Employees */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">{t('employees')}</h4>
          {loadingEmps ? (
            <p className="text-xs text-muted-foreground py-2">{t('loadingData')}</p>
          ) : employees.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">{t('noEmployees')}</p>
          ) : (
            <ul className="space-y-1">
              {employees.map((emp) => (
                <li key={emp.id} className="text-sm px-3 py-1.5 bg-background rounded flex justify-between items-center">
                  <span className="text-foreground">{emp.name}</span>
                  <span className="text-muted-foreground text-xs">{emp.jobGrade?.name ?? emp.employeeNo}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
