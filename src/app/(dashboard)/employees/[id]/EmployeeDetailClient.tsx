'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Detail Client
// 직원 프로필 5탭: 프로필/발령이력/급여정보/근태현황/평가결과
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ArrowUpDown,
  Building2,
  Check,
  Clock,
  Info,
  TrendingUp,
  User,
  X,
  Shield,
} from 'lucide-react'
import { AssignmentHistoryTab } from '@/components/employees/tabs/AssignmentHistoryTab'
import { AttendanceTab } from '@/components/employees/tabs/AttendanceTab'
import { CompensationTab } from '@/components/employees/tabs/CompensationTab'
import { LoaTab } from '@/components/employees/tabs/LoaTab'
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
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { deriveProbationBadge, deriveContractBadge } from '@/lib/employees/lifecycle'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { EmployeeCell } from '@/components/common/EmployeeCell'
import PayBandChart from '@/components/compensation/PayBandChart'
import { EmployeeWorkerBanner } from '@/components/employees/EmployeeWorkerBanner'
import { PerformanceTab } from '@/components/employees/tabs/PerformanceTab'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import type { SessionUser, RefOption } from '@/types'

// ─── Types ──────────────────────────────────────────────────

type EmployeeDetail = {
  id: string
  employeeNo: string
  name: string
  nameEn: string | null
  birthDate: Date | null
  gender: string | null
  nationality: string | null
  email: string
  phone: string | null
  emergencyContact: string | null
  emergencyContactPhone: string | null
  photoUrl: string | null
  hireDate: Date | null
  resignDate: Date | null
  employmentType: string
  status: string
  locale: string | null
  timezone: string | null
  company: { id: string; name: string } | null
  department: { id: string; name: string; level: number; parent?: { id: string; name: string; level: number; parent?: { id: string; name: string; level: number } | null } | null } | null
  jobGrade: { id: string; name: string } | null
  title: { id: string; name: string } | null
  jobCategory: { id: string; name: string } | null
  position: { id: string; titleKo: string; titleEn: string | null; code: string } | null
  workLocation: { country: string; city: string | null; name: string } | null
  // 수습/계약 라이프사이클
  probationStatus?: string | null
  probationEndDate?: Date | string | null
  contractStartDate?: Date | string | null
  contractEndDate?: Date | string | null
  manager: {
    id: string
    name: string
    photoUrl: string | null
    title: string | null
    department: string | null
  } | null
  companyId: string
}


interface EmployeeDetailClientProps {
  user: SessionUser
  employee: EmployeeDetail
  companies: RefOption[]
  division: string | null
  canViewGrade: boolean
  canViewSensitive: boolean
}

// ─── Constants ──────────────────────────────────────────────


// ─── Helpers ────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR')
}

function calcTenure(hireDate: Date | string | null): { years: number; months: number } | null {
  if (!hireDate) return null
  const start = new Date(hireDate)
  const now = new Date()
  const total = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (total <= 0) return { years: 0, months: 0 }
  return { years: Math.floor(total / 12), months: total % 12 }
}

// ─── Field row for info display ──────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-2.5">
      <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
      <div className="text-sm text-foreground">{value ?? '-'}</div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

export function EmployeeDetailClient({
  user,
  employee: initialEmployee,
  companies: _companies,
  division,
  canViewGrade,
  canViewSensitive,
}: EmployeeDetailClientProps) {
  const router = useRouter()
  const t = useTranslations('employee')
  const tc = useTranslations('common')
  const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

  // ─── Translated label maps ───
  const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
    FULL_TIME: t('fullTime'),
    CONTRACT: t('contract'),
    DISPATCH: t('dispatch'),
    INTERN: t('intern'),
  }

  const STATUS_LABELS: Record<string, string> = {
    ACTIVE: t('statusActive'),
    ON_LEAVE: t('statusOnLeave'),
    RESIGNED: t('statusResigned'),
    TERMINATED: t('statusTerminated'),
  }

  const [employee, setEmployee] = useState(initialEmployee)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: initialEmployee.name,
    nameEn: initialEmployee.nameEn ?? '',
    email: initialEmployee.email,
    phone: initialEmployee.phone ?? '',
    birthDate: initialEmployee.birthDate
      ? new Date(initialEmployee.birthDate).toISOString().split('T')[0]
      : '',
    gender: initialEmployee.gender ?? '',
    nationality: initialEmployee.nationality ?? '',
    emergencyContact: initialEmployee.emergencyContact ?? '',
    emergencyContactPhone: initialEmployee.emergencyContactPhone ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // ─── Compensation band data for ProfileSidebar (Tier 2) ───
  const [compensationData, setCompensationData] = useState<{
    currentSalary: number; bandMin: number; bandMid: number; bandMax: number
  } | null>(null)
  const [compensationLoading, setCompensationLoading] = useState(canViewGrade)

  useEffect(() => {
    if (!canViewGrade) return
    setCompensationLoading(true)
    apiClient.get<{
      latestComp: { newBaseSalary: number } | null
      salaryBand: { minSalary: number; midSalary: number; maxSalary: number } | null
    }>(`/api/v1/employees/${employee.id}/compensation`)
      .then((res) => {
        const { latestComp, salaryBand } = res.data
        if (latestComp && salaryBand) {
          setCompensationData({
            currentSalary: latestComp.newBaseSalary,
            bandMin: salaryBand.minSalary,
            bandMid: salaryBand.midSalary,
            bandMax: salaryBand.maxSalary,
          })
        }
      })
      .catch(() => { /* 밴드 데이터 로드 실패 — silent (보조 정보) */ })
      .finally(() => setCompensationLoading(false))
  }, [canViewGrade, employee.id])

  // ─── Offboarding wizard state ───
  const [offboardingOpen, setOffboardingOpen] = useState(false)
  const [offboardingStep, setOffboardingStep] = useState(1)
  const [offboardingSubmitting, setOffboardingSubmitting] = useState(false)
  const [offboardingError, setOffboardingError] = useState<string | null>(null)
  const [offboardingData, setOffboardingData] = useState({
    resignType: '' as '' | 'VOLUNTARY' | 'INVOLUNTARY' | 'RETIREMENT' | 'CONTRACT_END',
    lastWorkingDate: '',
    resignReasonCode: '',
    resignReasonDetail: '',
    handoverToId: '',
  })

  const RESIGN_TYPE_LABELS: Record<string, string> = {
    VOLUNTARY: t('resignVoluntary'),
    INVOLUNTARY: t('resignInvoluntary'),
    RETIREMENT: t('resignRetirement'),
    CONTRACT_END: t('resignContractEnd'),
  }

  const resetOffboarding = useCallback(() => {
    setOffboardingStep(1)
    setOffboardingError(null)
    setOffboardingData({
      resignType: '',
      lastWorkingDate: '',
      resignReasonCode: '',
      resignReasonDetail: '',
      handoverToId: '',
    })
  }, [])

  const handleOffboardingSubmit = useCallback(async () => {
    setOffboardingSubmitting(true)
    setOffboardingError(null)
    try {
      await apiClient.post(`/api/v1/employees/${employee.id}/offboarding/start`, {
        resignType: offboardingData.resignType,
        lastWorkingDate: new Date(offboardingData.lastWorkingDate).toISOString(),
        ...(offboardingData.resignReasonCode ? { resignReasonCode: offboardingData.resignReasonCode } : {}),
        ...(offboardingData.resignReasonDetail ? { resignReasonDetail: offboardingData.resignReasonDetail } : {}),
        ...(offboardingData.handoverToId ? { handoverToId: offboardingData.handoverToId } : {}),
      })
      setOffboardingOpen(false)
      resetOffboarding()
      router.push('/offboarding')
    } catch (err: unknown) {
      setOffboardingError(err instanceof Error ? err.message : t('offboardingFailed'))
    } finally {
      setOffboardingSubmitting(false)
    }
  }, [employee.id, offboardingData, resetOffboarding, router, t])

  // ─── Save edit ───
  const handleSave = useCallback(async () => {
    setSaving(true)
    setEditError(null)
    try {
      // 부서/직급/직무군/고용형태/상태는 발령(조직변경)으로만 변경 — PUT이 silent-strip
      // 하던 가짜 성공 제거 (S276 ed-01). 본인 신상 정보만 전송한다.
      const payload: Record<string, string | null> = {
        name: editData.name,
        nameEn: editData.nameEn || null,
        email: editData.email,
        phone: editData.phone || null,
        birthDate: editData.birthDate || null,
        gender: editData.gender || null,
        nationality: editData.nationality || null,
        emergencyContact: editData.emergencyContact || null,
        emergencyContactPhone: editData.emergencyContactPhone || null,
      }
      const res = await apiClient.put<EmployeeDetail>(`/api/v1/employees/${employee.id}`, payload)
      setEmployee((prev) => ({ ...prev, ...res.data }))
      setEditing(false)
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }, [editData, employee.id, t])

  // ─── Tab 1: 기본정보 ────────────────────────────────────────

  const renderBasicInfo = () => {
    const tenure = calcTenure(employee.hireDate)
    const tenureText = tenure
      ? tenure.years > 0
        ? t('tenureYearsMonths', tenure)
        : tenure.months > 0
          ? t('tenureMonthsOnly', tenure)
          : t('tenureZeroMonths')
      : '-'
    if (editing) {
      return (
        <div className="space-y-6">
          {editError && (
            <p className="rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {editError}
            </p>
          )}

          {/* Section 1: Personal Information */}
          <div className="rounded-2xl shadow-sm bg-card p-6 space-y-5">
            <h3 className="text-base font-bold text-foreground tracking-ctr">{t('personalInfo')}</h3>
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('nameKorean')} <span className="text-destructive">*</span></Label>
                <Input value={editData.name} onChange={(e) => setEditData((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('nameEn')}</Label>
                <Input value={editData.nameEn} onChange={(e) => setEditData((p) => ({ ...p, nameEn: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('email')} <span className="text-destructive">*</span></Label>
                <Input type="email" value={editData.email} onChange={(e) => setEditData((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('phone')}</Label>
                <Input value={editData.phone} onChange={(e) => setEditData((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('birthDate')}</Label>
                <Input type="date" value={editData.birthDate} onChange={(e) => setEditData((p) => ({ ...p, birthDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('gender')}</Label>
                <Select value={editData.gender || '__NONE__'} onValueChange={(v) => setEditData((p) => ({ ...p, gender: v === '__NONE__' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">{t('noSelection')}</SelectItem>
                    <SelectItem value="M">{t('male')}</SelectItem>
                    <SelectItem value="F">{t('female')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('nationality')}</Label>
                <Input value={editData.nationality} onChange={(e) => setEditData((p) => ({ ...p, nationality: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Section 2: Emergency Contact */}
          <div className="rounded-2xl shadow-sm bg-card p-6 space-y-5">
            <h3 className="text-base font-bold text-foreground tracking-ctr">{t('emergencyContactName')}</h3>
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('emergencyContactName')}</Label>
                <Input value={editData.emergencyContact} onChange={(e) => setEditData((p) => ({ ...p, emergencyContact: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('emergencyContactPhone')}</Label>
                <Input value={editData.emergencyContactPhone} onChange={(e) => setEditData((p) => ({ ...p, emergencyContactPhone: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Section 3: Employment Information — 읽기 전용.
              부서/직급/직무군/고용형태/상태는 발령 이력(append-only)이 SSOT라
              여기서 편집하면 서버가 조용히 무시했음 (S276 ed-01: 가짜 성공 제거) */}
          <div className="rounded-2xl shadow-sm bg-card p-6 space-y-5">
            <h3 className="text-base font-bold text-foreground tracking-ctr">{t('employmentInfo')}</h3>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t('employmentEditViaOrgChange')}
            </p>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-0 md:grid-cols-2">
              <InfoRow label={t('department')} value={employee.department?.name} />
              <InfoRow label={t('jobGrade')} value={employee.jobGrade?.name} />
              <InfoRow label={t('jobCategory')} value={employee.jobCategory?.name} />
              <InfoRow label={t('employmentType')} value={EMPLOYMENT_TYPE_LABELS[employee.employmentType] ?? employee.employmentType} />
              <InfoRow label={tc('status')} value={STATUS_LABELS[employee.status] ?? employee.status} />
            </dl>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="bg-ctr-primary hover:bg-ctr-primary-dark text-white">
              <Check className="mr-1 h-4 w-4" />
              {saving ? t('saving') : tc('save')}
            </Button>
            <Button variant="outline" onClick={() => { setEditing(false); setEditError(null) }}>
              <X className="mr-1 h-4 w-4" />
              {tc('cancel')}
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-base font-bold text-foreground tracking-ctr">{t('personalInfo')}</h3>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-0 md:grid-cols-2">
            <InfoRow label={t('nameKorean')} value={employee.name} />
            <InfoRow label={t('nameEn')} value={employee.nameEn} />
            <InfoRow label={t('birthDate')} value={formatDate(employee.birthDate)} />
            <InfoRow label={t('gender')} value={employee.gender === 'M' ? t('male') : employee.gender === 'F' ? t('female') : '-'} />
            <InfoRow label={t('nationality')} value={employee.nationality} />
            <InfoRow label={t('email')} value={employee.email} />
            <InfoRow label={t('phone')} value={employee.phone} />
            {canViewSensitive && <InfoRow label={t('emergencyContactName')} value={employee.emergencyContact} />}
            {canViewSensitive && <InfoRow label={t('emergencyContactPhone')} value={employee.emergencyContactPhone} />}
          </dl>
        </div>
        <Separator />
        <div>
          <h3 className="mb-3 text-base font-bold text-foreground tracking-ctr">{t('employmentInfo')}</h3>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-0 md:grid-cols-2">
            <InfoRow label={t('employeeCode')} value={<span className="font-mono tabular-nums">{employee.employeeNo}</span>} />
            <InfoRow label={t('companyEntity')} value={employee.company?.name} />
            {division && <InfoRow label={t('detailDivision')} value={division} />}
            <InfoRow label={t('department')} value={employee.department?.name} />
            {employee.title && <InfoRow label={t('employeeTitle')} value={employee.title.name} />}
            {employee.position && <InfoRow label={t('detailPositionLabel')} value={employee.position.titleKo} />}
            {canViewGrade && <InfoRow label={t('jobGrade')} value={employee.jobGrade?.name} />}
            <InfoRow label={t('jobCategory')} value={employee.jobCategory?.name} />
            {employee.workLocation && (
              <InfoRow
                label={t('detailWorkLocation')}
                value={[employee.workLocation.country, employee.workLocation.city]
                  .filter(Boolean)
                  .join(', ')}
              />
            )}
            {canViewSensitive && <InfoRow label={t('employmentType')} value={EMPLOYMENT_TYPE_LABELS[employee.employmentType] ?? employee.employmentType} />}
            <InfoRow label={tc('status')} value={<StatusBadge status={employee.status}>{STATUS_LABELS[employee.status] ?? employee.status}</StatusBadge>} />
            <InfoRow label={t('hireDate')} value={formatDate(employee.hireDate)} />
            <InfoRow label={t('detailTenureLabel')} value={tenureText} />
            <InfoRow label={t('resignDate')} value={formatDate(employee.resignDate)} />
            {(() => {
              // 수습/계약 라이프사이클 — 값이 있을 때만 표시 (HR_UP 응답 한정)
              const now = new Date()
              const probation = deriveProbationBadge(employee.probationEndDate ?? null, employee.probationStatus ?? null, now)
              const contract = deriveContractBadge(employee.contractEndDate ?? null, now)
              return (
                <>
                  {employee.probationEndDate && (
                    <InfoRow
                      label={t('lifecycle.probationEndDate')}
                      value={
                        <span className="flex flex-wrap items-center gap-1.5">
                          {formatDate(employee.probationEndDate)}
                          {probation && (
                            <Badge variant={probation.variant}>
                              {t(`lifecycle.${probation.labelKey}`, { days: Math.abs(probation.daysLeft) })}
                            </Badge>
                          )}
                        </span>
                      }
                    />
                  )}
                  {employee.contractEndDate && (
                    <InfoRow
                      label={t('lifecycle.contractEndDate')}
                      value={
                        <span className="flex flex-wrap items-center gap-1.5">
                          {formatDate(employee.contractEndDate)}
                          {contract && (
                            <Badge variant={contract.variant}>
                              {t(`lifecycle.${contract.labelKey}`, { days: Math.abs(contract.daysLeft) })}
                            </Badge>
                          )}
                        </span>
                      }
                    />
                  )}
                </>
              )
            })()}
          </dl>
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-5 md:p-6">
      {/* ─── Worker Banner (페이지 헤더 — DESIGN_RULES §5 시그니처) ─── */}
      <EmployeeWorkerBanner
        name={employee.name}
        nameEn={employee.nameEn}
        employeeNo={employee.employeeNo}
        photoUrl={employee.photoUrl}
        title={employee.title?.name ?? employee.position?.titleKo ?? null}
        department={employee.department?.name ?? null}
        company={employee.company?.name ?? null}
        status={employee.status}
        statusLabel={STATUS_LABELS[employee.status] ?? employee.status}
        canEdit={isHrAdmin}
        backLabel={t('detailBackToList')}
        editLabel={t('detailEdit')}
        onBack={() => router.push('/employees')}
        onEdit={() => setEditing(true)}
      />

      <Tabs defaultValue="profile">
        <TabsList className="mb-4 w-full justify-start overflow-x-auto">
          <TabsTrigger value="profile">
            <User className="mr-1.5 h-4 w-4" />
            {t('detailTabProfile')}
          </TabsTrigger>
          <TabsTrigger value="assignment-history">
            <ArrowUpDown className="mr-1.5 h-4 w-4" />
            {t('detailTabAssignment')}
          </TabsTrigger>
          {isHrAdmin && (
            <TabsTrigger value="compensation-info">
              <Building2 className="mr-1.5 h-4 w-4" />
              {t('detailTabCompensation')}
            </TabsTrigger>
          )}
          <TabsTrigger value="attendance">
            <Clock className="mr-1.5 h-4 w-4" />
            {t('detailTabAttendance')}
          </TabsTrigger>
          <TabsTrigger value="loa">
            <Shield className="mr-1.5 h-4 w-4" />
            {t('detailTabLoa')}
          </TabsTrigger>
          <TabsTrigger value="performance">
            <TrendingUp className="mr-1.5 h-4 w-4" />
            {t('detailTabPerformance')}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: 프로필 */}
        <TabsContent value="profile">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-border bg-card p-6">
                {editing && (
                  <div className="mb-4 rounded-lg border border-warning-bright/30 bg-warning-bright/15 px-4 py-3">
                    <p className="flex items-center gap-1.5 text-xs text-ctr-warning">
                      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {t('detailAssignmentWarning')}
                    </p>
                  </div>
                )}
                {renderBasicInfo()}
              </div>
            </div>

            {/* 우측 레일: 직속 상사 + 급여 밴드 (ProfileSidebar에서 이전) */}
            <div className="space-y-4">
              {employee.manager && (
                <section
                  aria-labelledby="profile-manager-title"
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <h3
                    id="profile-manager-title"
                    className="mb-3 text-sm font-semibold text-foreground"
                  >
                    {t('manager')}
                  </h3>
                  <EmployeeCell
                    name={employee.manager.name}
                    photoUrl={employee.manager.photoUrl}
                    department={employee.manager.department}
                    jobTitle={employee.manager.title}
                    size="sm"
                    onClick={() =>
                      employee.manager && router.push(`/employees/${employee.manager.id}`)
                    }
                  />
                </section>
              )}

              {canViewGrade && employee.jobGrade?.name && (
                <section
                  aria-labelledby="profile-payband-title"
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <h3
                    id="profile-payband-title"
                    className="mb-3 text-sm font-semibold text-foreground"
                  >
                    {t('detailPayBand')}
                  </h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {t('jobGrade')}:{' '}
                    <span className="font-medium text-foreground">{employee.jobGrade.name}</span>
                  </p>
                  {compensationLoading ? (
                    <div className="h-2 animate-pulse rounded-full bg-muted" />
                  ) : compensationData ? (
                    <PayBandChart
                      compact
                      currentSalary={compensationData.currentSalary}
                      minSalary={compensationData.bandMin}
                      midSalary={compensationData.bandMid}
                      maxSalary={compensationData.bandMax}
                    />
                  ) : null}
                </section>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: 발령이력 */}
        <TabsContent value="assignment-history">
          <AssignmentHistoryTab
            employeeId={employee.id}
            hireDate={employee.hireDate}
            user={user}
          />
        </TabsContent>

        {/* Tab 3: 급여정보 (HR Admin only) */}
        {isHrAdmin && (
          <TabsContent value="compensation-info">
            <div className="rounded-xl border border-border bg-card p-6">
              <CompensationTab employeeId={employee.id} />
            </div>
          </TabsContent>
        )}

        {/* Tab 4: 근태현황 (B6-1) */}
        <TabsContent value="attendance">
          <AttendanceTab employeeId={employee.id} />
        </TabsContent>

        {/* Tab 5: 휴직 이력 */}
        <TabsContent value="loa">
          <LoaTab employeeId={employee.id} />
        </TabsContent>

        {/* Tab 6: 평가결과 (성과평가 재배치 — /insights + 받은 칭찬) */}
        <TabsContent value="performance">
          <PerformanceTab employeeId={employee.id} />
        </TabsContent>
      </Tabs>

      {/* ─── Offboarding action (HR_ADMIN + ACTIVE) ─── */}
      {isHrAdmin && employee.status === 'ACTIVE' && (
        <div className="border-t border-border pt-6">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              resetOffboarding()
              setOffboardingOpen(true)
            }}
          >
            {t('offboarding')}
          </Button>
        </div>
      )}

          {/* Offboarding wizard dialog */}
          <Dialog open={offboardingOpen} onOpenChange={(open) => { setOffboardingOpen(open); if (!open) resetOffboarding() }}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('offboarding')} ({offboardingStep}/3)</DialogTitle>
              </DialogHeader>

              {offboardingError && (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {offboardingError}
                </p>
              )}

              {/* Step 1: 퇴직 유형 + 최종 근무일 */}
              {offboardingStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>{t('resignType')} <span className="text-destructive">*</span></Label>
                    <Select
                      value={offboardingData.resignType || '__NONE__'}
                      onValueChange={(v) => setOffboardingData((p) => ({ ...p, resignType: v === '__NONE__' ? '' as const : v as typeof p.resignType }))}
                    >
                      <SelectTrigger><SelectValue placeholder={t('selectResignType')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__">{tc('selectPlaceholder')}</SelectItem>
                        <SelectItem value="VOLUNTARY">{t('resignVoluntary')}</SelectItem>
                        <SelectItem value="INVOLUNTARY">{t('resignInvoluntary')}</SelectItem>
                        <SelectItem value="RETIREMENT">{t('resignRetirement')}</SelectItem>
                        <SelectItem value="CONTRACT_END">{t('resignContractEnd')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('lastWorkingDate')} <span className="text-destructive">*</span></Label>
                    <Input
                      type="date"
                      value={offboardingData.lastWorkingDate}
                      onChange={(e) => setOffboardingData((p) => ({ ...p, lastWorkingDate: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: 사유 + 인수자 */}
              {offboardingStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>{t('resignReasonCode')}</Label>
                    <Input
                      placeholder={t('resignReasonCodePlaceholder')}
                      value={offboardingData.resignReasonCode}
                      onChange={(e) => setOffboardingData((p) => ({ ...p, resignReasonCode: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('resignReasonDetail')}</Label>
                    <Textarea
                      placeholder={t('resignReasonDetailPlaceholder')}
                      rows={3}
                      value={offboardingData.resignReasonDetail}
                      onChange={(e) => setOffboardingData((p) => ({ ...p, resignReasonDetail: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('handoverToId')}</Label>
                    <Input
                      placeholder={t('handoverToIdPlaceholder')}
                      value={offboardingData.handoverToId}
                      onChange={(e) => setOffboardingData((p) => ({ ...p, handoverToId: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* Step 3: 확인 */}
              {offboardingStep === 3 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">{t('finalConfirmation')}</h4>
                  <div className="rounded-md border bg-muted/30 p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('employeeLabel')}</span>
                      <span className="font-medium">{employee.name} ({employee.employeeNo})</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('resignType')}</span>
                      <span className="font-medium">{RESIGN_TYPE_LABELS[offboardingData.resignType] ?? '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('lastWorkingDate')}</span>
                      <span className="font-medium">{offboardingData.lastWorkingDate || '-'}</span>
                    </div>
                    {offboardingData.resignReasonCode && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('resignReasonCode')}</span>
                        <span className="font-medium">{offboardingData.resignReasonCode}</span>
                      </div>
                    )}
                    {offboardingData.resignReasonDetail && (
                      <div>
                        <span className="text-muted-foreground">{t('resignReasonDetail')}</span>
                        <p className="mt-1 font-medium">{offboardingData.resignReasonDetail}</p>
                      </div>
                    )}
                    {offboardingData.handoverToId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('handoverToId')}</span>
                        <span className="font-mono tabular-nums text-xs font-medium">{offboardingData.handoverToId}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-destructive">
                    {t('offboardingWarning')}
                  </p>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                {offboardingStep > 1 && (
                  <Button variant="outline" onClick={() => setOffboardingStep((s) => s - 1)} disabled={offboardingSubmitting}>
                    {tc('prev')}
                  </Button>
                )}
                {offboardingStep < 3 && (
                  <Button
                    className="bg-ctr-primary hover:bg-ctr-primary-dark text-white"
                    disabled={
                      offboardingStep === 1 && (!offboardingData.resignType || !offboardingData.lastWorkingDate)
                    }
                    onClick={() => setOffboardingStep((s) => s + 1)}
                  >
                    {tc('next')}
                  </Button>
                )}
                {offboardingStep === 3 && (
                  <Button
                    variant="destructive"
                    disabled={offboardingSubmitting}
                    onClick={handleOffboardingSubmit}
                  >
                    {offboardingSubmitting ? t('processing') : t('startOffboarding')}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
    </div>
  )
}
