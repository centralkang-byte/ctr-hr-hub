'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — AddConcurrentDialog
// B-3: 겸직(secondary assignment) 추가 다이얼로그
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  { value: 'FULL_TIME', label: '정규직' },
  { value: 'CONTRACT', label: '계약직' },
  { value: 'PART_TIME', label: '파트타임' },
  { value: 'INTERN', label: '인턴' },
  { value: 'TEMPORARY', label: '임시직' },
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
      setError('법인을 선택해주세요.')
      return
    }
    if (!effectiveDate) {
      setError('발효일을 입력해주세요.')
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

      toast({ title: '겸직이 추가되었습니다.' })
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '겸직 추가 중 오류가 발생했습니다.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>겸직 추가</DialogTitle>
          <DialogDescription>
            새로운 겸직(부 발령)을 추가합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 법인 */}
          <div className="grid gap-2">
            <Label htmlFor="company">법인 *</Label>
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
                  <SelectValue placeholder="법인 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">선택 안 함</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {getLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 부서 */}
          <div className="grid gap-2">
            <Label htmlFor="department">부서</Label>
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
                <SelectValue placeholder="부서 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">선택 안 함</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {getLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 직급 */}
          <div className="grid gap-2">
            <Label htmlFor="jobGrade">직급</Label>
            <Select
              value={jobGradeId || '__NONE__'}
              onValueChange={(v) => setJobGradeId(v === '__NONE__' ? '' : v)}
            >
              <SelectTrigger id="jobGrade">
                <SelectValue placeholder="직급 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">선택 안 함</SelectItem>
                {jobGrades.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {getLabel(g)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 직책/Position */}
          <div className="grid gap-2">
            <Label htmlFor="position">직책</Label>
            <Select
              value={positionId || '__NONE__'}
              onValueChange={(v) => setPositionId(v === '__NONE__' ? '' : v)}
              disabled={!companyId}
            >
              <SelectTrigger id="position">
                <SelectValue placeholder="직책 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">선택 안 함</SelectItem>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {getLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 고용형태 */}
          <div className="grid gap-2">
            <Label htmlFor="employmentType">고용형태</Label>
            <Select value={employmentType} onValueChange={setEmploymentType}>
              <SelectTrigger id="employmentType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 발효일 */}
          <div className="grid gap-2">
            <Label htmlFor="effectiveDate">발효일 *</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>

          {/* 사유 */}
          <div className="grid gap-2">
            <Label htmlFor="reason">사유</Label>
            <Input
              id="reason"
              placeholder="겸직 사유를 입력하세요"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            취소
          </Button>
          <Button
            className="bg-ctr-primary hover:bg-ctr-primary/90"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '처리 중...' : '추가'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
