'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee New Client
// 직원 등록 4-step 위자드
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, ChevronLeft, ChevronRight, User, Briefcase, Building2, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import type { SessionUser, DeptOption, RefOption } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface WizardData {
  // Step 1: 기본정보
  name: string
  nameEn: string
  birthDate: string
  gender: string
  nationality: string
  email: string
  phone: string
  emergencyContact: string
  emergencyContactPhone: string
  // Step 2: 고용정보
  employeeNo: string
  employmentType: string
  hireDate: string
  // Step 3: 배정
  companyId: string
  departmentId: string
  jobGradeId: string
  jobCategoryId: string
  managerId: string
  managerName: string
}

interface ManagerSearchResult {
  id: string
  name: string
  employeeNo: string
  department: { name: string } | null
  jobGrade: { name: string } | null
}

interface EmployeeNewClientProps {
  user: SessionUser
  companies: RefOption[]
  departments: DeptOption[]
  jobGrades: RefOption[]
  jobCategories: RefOption[]
}

// ─── Constants ──────────────────────────────────────────────

const INITIAL_DATA: WizardData = {
  name: '',
  nameEn: '',
  birthDate: '',
  gender: '',
  nationality: '',
  email: '',
  phone: '',
  emergencyContact: '',
  emergencyContactPhone: '',
  employeeNo: '',
  employmentType: '',
  hireDate: '',
  companyId: '',
  departmentId: '',
  jobGradeId: '',
  jobCategoryId: '',
  managerId: '',
  managerName: '',
}

// ─── Field helpers ───────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

export function EmployeeNewClient({
  user,
  companies,
  departments,
  jobGrades,
  jobCategories,
}: EmployeeNewClientProps) {
  const router = useRouter()
  const t = useTranslations('employee')
  const tc = useTranslations('common')

  // ─── Translated label maps ───
  const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
    FULL_TIME: t('fullTime'),
    CONTRACT: t('contract'),
    DISPATCH: t('dispatch'),
    INTERN: t('intern'),
  }

  const STEPS = [
    { label: t('basicInfo'), icon: User },
    { label: t('employmentInfo'), icon: Briefcase },
    { label: t('assignment'), icon: Building2 },
    { label: tc('confirm'), icon: ClipboardCheck },
  ]

  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>({
    ...INITIAL_DATA,
    companyId: user.companyId,
    nationality: t('defaultNationality'),
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Manager search state
  const [managerQuery, setManagerQuery] = useState('')
  const [managerResults, setManagerResults] = useState<ManagerSearchResult[]>([])
  const [managerSearching, setManagerSearching] = useState(false)
  const managerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filtered departments by selected company
  const filteredDepts = departments.filter((d) => d.companyId === data.companyId)

  // ─── Validation per step ───
  function validateStep(stepNum: number, wizardData: WizardData): string | null {
    if (stepNum === 0) {
      if (!wizardData.name.trim()) return t('validationNameRequired')
      if (!wizardData.email.trim()) return t('validationEmailRequired')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wizardData.email)) return t('validationEmailInvalid')
    }
    if (stepNum === 1) {
      if (!wizardData.employeeNo.trim()) return t('validationEmployeeNoRequired')
      if (!wizardData.employmentType) return t('validationEmploymentTypeRequired')
      if (!wizardData.hireDate) return t('validationHireDateRequired')
    }
    if (stepNum === 2) {
      if (!wizardData.companyId) return t('validationCompanyRequired')
      if (!wizardData.departmentId) return t('validationDepartmentRequired')
      if (!wizardData.jobGradeId) return t('validationJobGradeRequired')
      if (!wizardData.jobCategoryId) return t('validationJobCategoryRequired')
    }
    return null
  }

  // ─── Field update helper ───
  const set = useCallback((key: keyof WizardData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }, [])

  // ─── Manager search ───
  useEffect(() => {
    if (!managerQuery.trim()) {
      setManagerResults([])
      return
    }
    if (managerDebounceRef.current) clearTimeout(managerDebounceRef.current)
    managerDebounceRef.current = setTimeout(async () => {
      setManagerSearching(true)
      try {
        const res = await apiClient.get<ManagerSearchResult[]>('/api/v1/search/employees', {
          search: managerQuery,
          limit: 5,
        })
        setManagerResults(res.data)
      } catch {
        setManagerResults([])
      } finally {
        setManagerSearching(false)
      }
    }, 300)
  }, [managerQuery])

  // ─── Navigation ───
  const goNext = useCallback(() => {
    const err = validateStep(step, data)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setStep((s) => s + 1)
  }, [step, data])

  const goBack = useCallback(() => {
    setError(null)
    setStep((s) => s - 1)
  }, [])

  // ─── Submit ───
  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        employeeNo: data.employeeNo,
        name: data.name,
        email: data.email,
        companyId: data.companyId,
        departmentId: data.departmentId,
        jobGradeId: data.jobGradeId,
        jobCategoryId: data.jobCategoryId,
        hireDate: data.hireDate,
        employmentType: data.employmentType,
        status: 'ACTIVE',
        ...(data.nameEn ? { nameEn: data.nameEn } : {}),
        ...(data.birthDate ? { birthDate: data.birthDate } : {}),
        ...(data.gender ? { gender: data.gender } : {}),
        ...(data.nationality ? { nationality: data.nationality } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.emergencyContact ? { emergencyContact: data.emergencyContact } : {}),
        ...(data.emergencyContactPhone ? { emergencyContactPhone: data.emergencyContactPhone } : {}),
        ...(data.managerId ? { managerId: data.managerId } : {}),
      }
      const res = await apiClient.post<{ id: string }>('/api/v1/employees', payload)
      router.push(`/employees/${res.data.id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('createFailed')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }, [data, router, t])

  // ─── Render steps ───

  const renderStep1 = () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={t('nameKorean')} required>
        <Input value={data.name} onChange={(e) => set('name', e.target.value)} placeholder="홍길동" />
      </Field>
      <Field label={t('nameEn')}>
        <Input value={data.nameEn} onChange={(e) => set('nameEn', e.target.value)} placeholder="Gildong Hong" />
      </Field>
      <Field label={t('email')} required>
        <Input type="email" value={data.email} onChange={(e) => set('email', e.target.value)} placeholder="hong@company.com" />
      </Field>
      <Field label={t('phone')}>
        <Input value={data.phone} onChange={(e) => set('phone', e.target.value)} placeholder="010-0000-0000" />
      </Field>
      <Field label={t('birthDate')}>
        <Input type="date" value={data.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
      </Field>
      <Field label={t('gender')}>
        <Select value={data.gender || '__NONE__'} onValueChange={(v) => set('gender', v === '__NONE__' ? '' : v)}>
          <SelectTrigger>
            <SelectValue placeholder={tc('selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__NONE__">{t('noSelection')}</SelectItem>
            <SelectItem value="M">{t('male')}</SelectItem>
            <SelectItem value="F">{t('female')}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={t('nationality')}>
        <Input value={data.nationality} onChange={(e) => set('nationality', e.target.value)} placeholder={t('defaultNationality')} />
      </Field>
      <Field label={t('emergencyContactName')}>
        <Input value={data.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} placeholder={t('emergencyContactName')} />
      </Field>
      <Field label={t('emergencyContactPhone')}>
        <Input value={data.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} placeholder="010-0000-0000" />
      </Field>
    </div>
  )

  const renderStep2 = () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={t('employeeCode')} required>
        <div className="flex gap-2">
          <Input
            value={data.employeeNo}
            onChange={(e) => set('employeeNo', e.target.value)}
            placeholder="EMP-2024-001"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              const year = new Date().getFullYear()
              const seq = String(Date.now() % 100000).padStart(5, '0')
              set('employeeNo', `EMP-${year}-${seq}`)
            }}
          >
            {t('autoGenerate')}
          </Button>
        </div>
      </Field>
      <Field label={t('employmentType')} required>
        <Select value={data.employmentType || '__NONE__'} onValueChange={(v) => set('employmentType', v === '__NONE__' ? '' : v)}>
          <SelectTrigger>
            <SelectValue placeholder={tc('selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__NONE__">{tc('selectPlaceholder')}</SelectItem>
            {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t('hireDate')} required>
        <Input type="date" value={data.hireDate} onChange={(e) => set('hireDate', e.target.value)} />
      </Field>
    </div>
  )

  const renderStep3 = () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={t('companyEntity')} required>
        <Select
          value={data.companyId || '__NONE__'}
          onValueChange={(v) => {
            set('companyId', v === '__NONE__' ? '' : v)
            set('departmentId', '')
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('selectCompany')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__NONE__">{tc('selectPlaceholder')}</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t('department')} required>
        <Select
          value={data.departmentId || '__NONE__'}
          onValueChange={(v) => set('departmentId', v === '__NONE__' ? '' : v)}
          disabled={!data.companyId}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('selectDepartment')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__NONE__">{tc('selectPlaceholder')}</SelectItem>
            {filteredDepts.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t('jobGrade')} required>
        <Select value={data.jobGradeId || '__NONE__'} onValueChange={(v) => set('jobGradeId', v === '__NONE__' ? '' : v)}>
          <SelectTrigger>
            <SelectValue placeholder={t('selectJobGrade')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__NONE__">{tc('selectPlaceholder')}</SelectItem>
            {jobGrades.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t('jobCategory')} required>
        <Select value={data.jobCategoryId || '__NONE__'} onValueChange={(v) => set('jobCategoryId', v === '__NONE__' ? '' : v)}>
          <SelectTrigger>
            <SelectValue placeholder={t('selectJobCategory')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__NONE__">{tc('selectPlaceholder')}</SelectItem>
            {jobCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label={t('managerOptional')}>
          <div className="relative">
            <Input
              value={data.managerId ? data.managerName : managerQuery}
              onChange={(e) => {
                if (data.managerId) {
                  set('managerId', '')
                  set('managerName', '')
                }
                setManagerQuery(e.target.value)
              }}
              placeholder={t('managerSearchPlaceholder')}
            />
            {data.managerId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-7 px-2 text-xs"
                onClick={() => {
                  set('managerId', '')
                  set('managerName', '')
                  setManagerQuery('')
                }}
              >
                {t('change')}
              </Button>
            )}
            {!data.managerId && managerResults.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg">
                {managerSearching && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">{t('searching')}</p>
                )}
                {managerResults.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      set('managerId', emp.id)
                      set('managerName', emp.name)
                      setManagerQuery('')
                      setManagerResults([])
                    }}
                  >
                    <div>
                      <p className="font-medium">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {emp.employeeNo} · {emp.department?.name ?? ''} · {emp.jobGrade?.name ?? ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>
      </div>
    </div>
  )

  const renderStep4 = () => {
    const company = companies.find((c) => c.id === data.companyId)
    const dept = departments.find((d) => d.id === data.departmentId)
    const grade = jobGrades.find((g) => g.id === data.jobGradeId)
    const category = jobCategories.find((c) => c.id === data.jobCategoryId)

    const GENDER_LABELS: Record<string, string> = { M: t('male'), F: t('female') }

    const rows: [string, string][] = [
      [t('name'), data.name],
      [t('nameEn'), data.nameEn || '-'],
      [t('birthDate'), data.birthDate || '-'],
      [t('gender'), (data.gender && GENDER_LABELS[data.gender]) || '-'],
      [t('nationality'), data.nationality || '-'],
      [t('email'), data.email],
      [t('phone'), data.phone || '-'],
      [t('emergencyContactName'), data.emergencyContact || '-'],
      [t('emergencyContactPhone'), data.emergencyContactPhone || '-'],
      [t('employeeCode'), data.employeeNo],
      [t('employmentType'), EMPLOYMENT_TYPE_LABELS[data.employmentType] ?? data.employmentType],
      [t('hireDate'), data.hireDate],
      [t('companyEntity'), company?.name ?? '-'],
      [t('department'), dept?.name ?? '-'],
      [t('jobGrade'), grade?.name ?? '-'],
      [t('jobCategory'), category?.name ?? '-'],
      [t('manager'), data.managerName || '-'],
    ]

    return (
      <div className="rounded-lg border bg-muted/30 p-4">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="w-28 shrink-0 text-sm text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <PageHeader
        title={t('newEmployee')}
        description={t('newEmployeeDescription')}
      />

      {/* ─── Step indicator ─── */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isCompleted = i < step
          const isCurrent = i === step
          return (
            <div key={i} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors',
                    isCompleted
                      ? 'border-ctr-primary bg-ctr-primary text-white'
                      : isCurrent
                        ? 'border-ctr-primary text-ctr-primary'
                        : 'border-muted-foreground/30 text-muted-foreground',
                  ].join(' ')}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={[
                    'text-xs',
                    isCurrent ? 'font-medium text-ctr-primary' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={[
                    'mx-2 h-0.5 flex-1',
                    i < step ? 'bg-ctr-primary' : 'bg-muted-foreground/30',
                  ].join(' ')}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* ─── Step content ─── */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">
          Step {step + 1}: {STEPS[step]!.label}
        </h2>
        {step === 0 && renderStep1()}
        {step === 1 && renderStep2()}
        {step === 2 && renderStep3()}
        {step === 3 && renderStep4()}
      </div>

      {/* ─── Error ─── */}
      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* ─── Navigation buttons ─── */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={step === 0 ? () => router.push('/employees') : goBack}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {step === 0 ? tc('cancel') : tc('prev')}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={goNext} className="bg-ctr-primary hover:bg-ctr-primary/90">
            {tc('next')}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-ctr-primary hover:bg-ctr-primary/90"
          >
            {submitting ? t('creating') : t('newEmployee')}
            <Check className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
