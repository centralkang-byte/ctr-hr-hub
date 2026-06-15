'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AddConcurrentDialog
// B-3: 겸직(secondary assignment) 추가 다이얼로그
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WdDrawer, WdField } from '@/components/shared/WdDrawer'
import { apiClient } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import { toast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────

interface AddConcurrentDialogProps {
  employeeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  userRole: string
  userCompanyId: string
}

interface LookupItem {
  id: string
  name?: string
  nameKo?: string
  titleKo?: string
  code?: string
}

const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME', labelKey: 'concurrentEmploymentFullTime' },
  { value: 'CONTRACT', labelKey: 'concurrentEmploymentContract' },
  { value: 'PART_TIME', labelKey: 'concurrentEmploymentPartTime' },
  { value: 'INTERN', labelKey: 'concurrentEmploymentIntern' },
  { value: 'TEMPORARY', labelKey: 'concurrentEmploymentTemporary' },
] as const

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Defensive label extractor for lookup items */
function getLabel(item: LookupItem): string {
  return item.nameKo ?? item.name ?? item.titleKo ?? item.code ?? item.id
}

/** Defensively extract array from API response data */
function extractList<T>(data: unknown, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    for (const key of keys) {
      const val = (data as Record<string, unknown>)[key]
      if (Array.isArray(val)) return val as T[]
    }
  }
  return []
}

// ─── Component ──────────────────────────────────────────────

export default function AddConcurrentDialog({
  employeeId,
  open,
  onOpenChange,
  onSuccess,
  userRole,
  userCompanyId,
}: AddConcurrentDialogProps) {
  const t = useTranslations('employee')
  const tc = useTranslations('common')

  // Form state
  const [companyId, setCompanyId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [jobGradeId, setJobGradeId] = useState('')
  const [positionId, setPositionId] = useState('')
  const [employmentType, setEmploymentType] = useState('FULL_TIME')
  const [effectiveDate, setEffectiveDate] = useState(getToday)
  const [reason, setReason] = useState('')

  // Lookup data
  const [companies, setCompanies] = useState<LookupItem[]>([])
  const [departments, setDepartments] = useState<LookupItem[]>([])
  const [jobGrades, setJobGrades] = useState<LookupItem[]>([])
  const [positions, setPositions] = useState<LookupItem[]>([])

  // UI state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const _isSuperAdmin = userRole === ROLE.SUPER_ADMIN
  const isHrAdmin = userRole === ROLE.HR_ADMIN

  // ─── Reset form on open ─────────────────────────────────

  const resetForm = useCallback(() => {
    const defaultCompany = isHrAdmin ? userCompanyId : ''
    setCompanyId(defaultCompany)
    setDepartmentId('')
    setJobGradeId('')
    setPositionId('')
    setEmploymentType('FULL_TIME')
    setEffectiveDate(getToday())
    setReason('')
    setError('')
    setDepartments([])
    setPositions([])
  }, [isHrAdmin, userCompanyId])

  // ─── Fetch companies on open ────────────────────────────

  useEffect(() => {
    if (!open) return
    resetForm()

    const fetchLookups = async () => {
      try {
        const [companiesRes, jobGradesRes] = await Promise.all([
          apiClient.get<unknown>('/api/v1/companies'),
          apiClient.get<unknown>('/api/v1/job-grades'),
        ])
        setCompanies(extractList<LookupItem>(companiesRes.data, 'companies', 'data'))
        setJobGrades(extractList<LookupItem>(jobGradesRes.data, 'jobGrades', 'data'))
      } catch {
        // Non-critical: lookup data may fail in dev
        setCompanies([])
        setJobGrades([])
      }
    }

    fetchLookups()
  }, [open, resetForm])

  // ─── Fetch departments when company changes ──────────────

  useEffect(() => {
    if (!companyId) {
      setDepartments([])
      setPositions([])
      return
    }

    const fetchDepartments = async () => {
      try {
        const res = await apiClient.get<unknown>('/api/v1/departments', { companyId })
        setDepartments(extractList<LookupItem>(res.data, 'departments', 'data'))
      } catch {
        setDepartments([])
      }
    }

    fetchDepartments()
  }, [companyId])

  // ─── Fetch positions when company/dept changes ───────────

  useEffect(() => {
    if (!companyId) {
      setPositions([])
      return
    }

    const fetchPositions = async () => {
      try {
        const params: Record<string, string> = { companyId }
        if (departmentId) params.departmentId = departmentId
        const res = await apiClient.get<unknown>('/api/v1/positions', params)
        setPositions(extractList<LookupItem>(res.data, 'positions', 'data'))
      } catch {
        setPositions([])
      }
    }

    fetchPositions()
  }, [companyId, departmentId])

  // ─── Handle company change ──────────────────────────────

  const handleCompanyChange = (value: string) => {
    const resolved = value === '__NONE__' ? '' : value
    setCompanyId(resolved)
    setDepartmentId('')
    setPositionId('')
  }

  // ─── Submit ──────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!companyId) {
      setError(t('concurrentCompanyRequired'))
      return
    }
    if (!effectiveDate) {
      setError(t('concurrentEffectiveDateRequired'))
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await apiClient.post(`/api/v1/employees/${employeeId}/assignments/concurrent`, {
        companyId,
        departmentId: departmentId || undefined,
        jobGradeId: jobGradeId || undefined,
        positionId: positionId || undefined,
        employmentType,
        effectiveDate,
        reason: reason || undefined,
      })

      toast({ title: t('concurrentAddSuccess') })
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('concurrentAddError')
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────

  return (
    <WdDrawer
      open={open}
      onClose={() => onOpenChange(false)}
      title={t('concurrentAddTitle')}
      closeDisabled={submitting}
      secondary={{ label: t('cancel'), onClick: () => onOpenChange(false), disabled: submitting }}
      primary={{
        label: submitting ? t('processing') : tc('add'),
        onClick: handleSubmit,
        disabled: submitting,
      }}
    >
      <p className="text-sm text-muted-foreground">{t('concurrentAddDescription')}</p>

      {/* 법인 */}
      <WdField label={t('concurrentCompanyLabel')} htmlFor="company">
        {isHrAdmin ? (
          <Input
            id="company"
            value={
              companies.find((c) => c.id === userCompanyId)
                ? getLabel(companies.find((c) => c.id === userCompanyId)!)
                : userCompanyId
            }
            disabled
          />
        ) : (
          <Select value={companyId || '__NONE__'} onValueChange={handleCompanyChange}>
            <SelectTrigger id="company">
              <SelectValue placeholder={t('concurrentSelectCompany')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__NONE__">{t('noSelection')}</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {getLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </WdField>

      {/* 부서 */}
      <WdField label={t('concurrentDepartment')} htmlFor="department">
        <Select
          value={departmentId || '__NONE__'}
          onValueChange={(v) => {
            const resolved = v === '__NONE__' ? '' : v
            setDepartmentId(resolved)
            setPositionId('')
          }}
          disabled={!companyId}
        >
          <SelectTrigger id="department">
            <SelectValue placeholder={t('concurrentSelectDepartment')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__NONE__">{t('noSelection')}</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {getLabel(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </WdField>

      {/* 직급 */}
      <WdField label={t('concurrentGrade')} htmlFor="jobGrade">
        <Select
          value={jobGradeId || '__NONE__'}
          onValueChange={(v) => setJobGradeId(v === '__NONE__' ? '' : v)}
        >
          <SelectTrigger id="jobGrade">
            <SelectValue placeholder={t('concurrentSelectGrade')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__NONE__">{t('noSelection')}</SelectItem>
            {jobGrades.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {getLabel(g)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </WdField>

      {/* 직책/Position */}
      <WdField label={t('concurrentPosition')} htmlFor="position">
        <Select
          value={positionId || '__NONE__'}
          onValueChange={(v) => setPositionId(v === '__NONE__' ? '' : v)}
          disabled={!companyId}
        >
          <SelectTrigger id="position">
            <SelectValue placeholder={t('concurrentSelectPosition')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__NONE__">{t('noSelection')}</SelectItem>
            {positions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {getLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </WdField>

      {/* 고용형태 */}
      <WdField label={t('concurrentEmploymentType')} htmlFor="employmentType">
        <Select value={employmentType} onValueChange={setEmploymentType}>
          <SelectTrigger id="employmentType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMPLOYMENT_TYPES.map((et) => (
              <SelectItem key={et.value} value={et.value}>
                {t(et.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </WdField>

      {/* 발효일 */}
      <WdField label={t('concurrentEffectiveDate')} htmlFor="effectiveDate">
        <Input
          id="effectiveDate"
          type="date"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
        />
      </WdField>

      {/* 사유 */}
      <WdField label={t('concurrentReason')} htmlFor="reason">
        <Input
          id="reason"
          placeholder={t('concurrentReasonPlaceholder')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </WdField>

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </WdDrawer>
  )
}
