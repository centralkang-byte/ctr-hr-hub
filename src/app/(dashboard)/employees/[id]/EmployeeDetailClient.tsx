'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Detail Client
// 직원 프로필 5탭: 프로필/발령이력/급여정보/근태현황/평가결과
// ═══════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ArrowUpDown,
  Building2,
  Check,
  Clock,
  Pencil,
  TrendingUp,
  User,
  X,
} from 'lucide-react'
import { AssignmentHistoryTab } from '@/components/employees/tabs/AssignmentHistoryTab'
import { AttendanceTab } from '@/components/employees/tabs/AttendanceTab'
import { CompensationTab } from '@/components/employees/tabs/CompensationTab'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ProfileSidebar } from '@/components/employees/ProfileSidebar'
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
import type { SessionUser, DeptOption, RefOption } from '@/types'
import { toast } from '@/hooks/use-toast'

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
  department: { id: string; name: string } | null
  jobGrade: { id: string; name: string } | null
  jobCategory: { id: string; name: string } | null
  manager: {
    id: string
    name: string
    photoUrl: string | null
    employeeNo: string
    department: { name: string } | null
    jobGrade: { name: string } | null
  } | null
  companyId: string
}


interface EmployeeDetailClientProps {
  user: SessionUser
  employee: EmployeeDetail
  companies: RefOption[]
  departments: DeptOption[]
  jobGrades: RefOption[]
  jobCategories: RefOption[]
}

// ─── Constants ──────────────────────────────────────────────

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  ACTIVE: 'default',
  ON_LEAVE: 'secondary',
  RESIGNED: 'outline',
  TERMINATED: 'destructive',
}

// ─── Helpers ────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR')
}

function calcTenure(hireDate: Date | string | null): string {
  if (!hireDate) return '-'
  const start = new Date(hireDate)
  const now = new Date()
  const years = now.getFullYear() - start.getFullYear()
  const months = now.getMonth() - start.getMonth()
  const total = years * 12 + months
  if (total <= 0) return '0개월'
  const y = Math.floor(total / 12)
  const m = total % 12
  return y > 0 ? `${y}년 ${m}개월` : `${m}개월`
}

function getInitials(name: string): string {
  return name.slice(0, 2)
}


// ─── Avatar ─────────────────────────────────────────────────

function Avatar({ name, photoUrl, size = 'md' }: { name: string; photoUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-20 w-20 text-2xl' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-12 w-12 text-base'
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`${sizeClass} rounded-full object-cover`} />
  }
  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-full bg-ctr-primary-light font-semibold text-ctr-primary`}>
      {getInitials(name)}
    </div>
  )
}

// ─── Field row for info display ──────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-2.5">
      <p className="text-xs text-[#999] font-medium mb-1">{label}</p>
      <div className="text-sm text-[#1A1A1A]">{value ?? '-'}</div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

export function EmployeeDetailClient({
  user,
  employee: initialEmployee,
  companies,
  departments,
  jobGrades,
  jobCategories,
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
    departmentId: initialEmployee.department?.id ?? '',
    jobGradeId: initialEmployee.jobGrade?.id ?? '',
    jobCategoryId: initialEmployee.jobCategory?.id ?? '',
    employmentType: initialEmployee.employmentType,
    status: initialEmployee.status,
  })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

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
        departmentId: editData.departmentId,
        jobGradeId: editData.jobGradeId,
        jobCategoryId: editData.jobCategoryId,
        employmentType: editData.employmentType,
        status: editData.status,
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

  // ─── Filtered depts by company ───
  const filteredDepts = useMemo(
    () => departments.filter((d) => d.companyId === employee.companyId),
    [departments, employee.companyId],
  )

  // ─── Tab 1: 기본정보 ────────────────────────────────────────

  const renderBasicInfo = () => {
    if (editing) {
      return (
        <div className="space-y-4">
          {editError && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {editError}
            </p>
          )}
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
            {/* Personal */}
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
            <div className="space-y-1.5">
              <Label>{t('emergencyContactName')}</Label>
              <Input value={editData.emergencyContact} onChange={(e) => setEditData((p) => ({ ...p, emergencyContact: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('emergencyContactPhone')}</Label>
              <Input value={editData.emergencyContactPhone} onChange={(e) => setEditData((p) => ({ ...p, emergencyContactPhone: e.target.value }))} />
            </div>
            {/* Employment */}
            <div className="space-y-1.5">
              <Label>{t('department')}</Label>
              <Select value={editData.departmentId || '__NONE__'} onValueChange={(v) => setEditData((p) => ({ ...p, departmentId: v === '__NONE__' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">{tc('selectPlaceholder')}</SelectItem>
                  {filteredDepts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('jobGrade')}</Label>
              <Select value={editData.jobGradeId || '__NONE__'} onValueChange={(v) => setEditData((p) => ({ ...p, jobGradeId: v === '__NONE__' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">{tc('selectPlaceholder')}</SelectItem>
                  {jobGrades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('jobCategory')}</Label>
              <Select value={editData.jobCategoryId || '__NONE__'} onValueChange={(v) => setEditData((p) => ({ ...p, jobCategoryId: v === '__NONE__' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">{tc('selectPlaceholder')}</SelectItem>
                  {jobCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('employmentType')}</Label>
              <Select value={editData.employmentType} onValueChange={(v) => setEditData((p) => ({ ...p, employmentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{tc('status')}</Label>
              <Select value={editData.status} onValueChange={(v) => setEditData((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
          <h3 className="mb-3 text-base font-bold text-[#1A1A1A] tracking-ctr">{t('personalInfo')}</h3>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-0 md:grid-cols-2">
            <InfoRow label={t('nameKorean')} value={employee.name} />
            <InfoRow label={t('nameEn')} value={employee.nameEn} />
            <InfoRow label={t('birthDate')} value={formatDate(employee.birthDate)} />
            <InfoRow label={t('gender')} value={employee.gender === 'M' ? t('male') : employee.gender === 'F' ? t('female') : '-'} />
            <InfoRow label={t('nationality')} value={employee.nationality} />
            <InfoRow label={t('email')} value={employee.email} />
            <InfoRow label={t('phone')} value={employee.phone} />
            <InfoRow label={t('emergencyContactName')} value={employee.emergencyContact} />
            <InfoRow label={t('emergencyContactPhone')} value={employee.emergencyContactPhone} />
          </dl>
        </div>
        <Separator />
        <div>
          <h3 className="mb-3 text-base font-bold text-[#1A1A1A] tracking-ctr">{t('employmentInfo')}</h3>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-0 md:grid-cols-2">
            <InfoRow label={t('employeeCode')} value={<span className="font-mono tabular-nums">{employee.employeeNo}</span>} />
            <InfoRow label={t('companyEntity')} value={employee.company?.name} />
            <InfoRow label={t('department')} value={employee.department?.name} />
            <InfoRow label={t('jobGrade')} value={employee.jobGrade?.name} />
            <InfoRow label={t('jobCategory')} value={employee.jobCategory?.name} />
            <InfoRow label={t('employmentType')} value={EMPLOYMENT_TYPE_LABELS[employee.employmentType] ?? employee.employmentType} />
            <InfoRow label={tc('status')} value={<Badge variant={STATUS_VARIANTS[employee.status] ?? 'outline'}>{STATUS_LABELS[employee.status] ?? employee.status}</Badge>} />
            <InfoRow label={t('hireDate')} value={formatDate(employee.hireDate)} />
            <InfoRow label={t('resignDate')} value={formatDate(employee.resignDate)} />
          </dl>
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="flex h-full">
      {/* ─── Left: Profile Sidebar (P04) ─── */}
      <ProfileSidebar
        name={employee.name}
        nameEn={employee.nameEn}
        photoUrl={employee.photoUrl}
        department={employee.department?.name ?? null}
        jobGrade={employee.jobGrade?.name ?? null}
        email={employee.email}
        phone={employee.phone}
        hireDate={employee.hireDate}
        status={employee.status}
        statusLabel={STATUS_LABELS[employee.status] ?? employee.status}
        tenureText={calcTenure(employee.hireDate)}
        company={employee.company?.name ?? null}
        manager={employee.manager ? {
          id: employee.manager.id,
          name: employee.manager.name,
          photoUrl: employee.manager.photoUrl,
          department: employee.manager.department?.name ?? null,
          jobGrade: employee.manager.jobGrade?.name ?? null,
        } : null}
        onManagerClick={(id) => router.push(`/employees/${id}`)}
      />

      {/* ─── Right: Main Content ─── */}
      <div className="flex-1 min-w-0 overflow-auto">
        {/* Mobile profile header (shown on small screens) */}
        <div className="lg:hidden p-6 pb-0">
          <div className="flex items-center gap-4">
            <Avatar name={employee.name} photoUrl={employee.photoUrl} size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-ctr">{employee.name}</h1>
              <p className="text-sm text-[#999]">
                {employee.department?.name ?? '-'}{employee.jobGrade ? ` · ${employee.jobGrade.name}` : ''}
              </p>
              <Badge variant={STATUS_VARIANTS[employee.status] ?? 'outline'} className="mt-1">
                {STATUS_LABELS[employee.status] ?? employee.status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="p-6">
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="profile">
            <TabsList className="mb-4">
              <TabsTrigger value="profile">
                <User className="mr-1.5 h-4 w-4" />
                프로필
              </TabsTrigger>
              <TabsTrigger value="assignment-history">
                <ArrowUpDown className="mr-1.5 h-4 w-4" />
                발령이력
              </TabsTrigger>
              {isHrAdmin && (
                <TabsTrigger value="compensation-info">
                  <Building2 className="mr-1.5 h-4 w-4" />
                  급여정보
                </TabsTrigger>
              )}
              <TabsTrigger value="attendance">
                <Clock className="mr-1.5 h-4 w-4" />
                근태현황
              </TabsTrigger>
              <TabsTrigger value="performance">
                <TrendingUp className="mr-1.5 h-4 w-4" />
                평가결과
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: 프로필 */}
            <TabsContent value="profile" className="mt-0">
              <div className="rounded-xl border border-[#E8E8E8] bg-white p-6">
                {isHrAdmin && !editing && (
                  <div className="mb-4 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      <Pencil className="mr-1 h-4 w-4" />
                      편집
                    </Button>
                  </div>
                )}
                {editing && (
                  <div className="mb-4 rounded-lg bg-[#FEF3C7] border border-[#FCD34D] px-4 py-3">
                    <p className="text-xs text-[#B45309]">
                      ⚠️ 소속정보(부서/직급/고용형태)는 발령 프로세스를 통해서만 변경 가능합니다.
                    </p>
                  </div>
                )}
                {renderBasicInfo()}
              </div>
            </TabsContent>

            {/* Tab 2: 발령이력 */}
            <TabsContent value="assignment-history" className="mt-0">
              <AssignmentHistoryTab
                employeeId={employee.id}
                hireDate={employee.hireDate}
                user={user}
              />
            </TabsContent>

            {/* Tab 3: 급여정보 (HR Admin only) */}
            {isHrAdmin && (
              <TabsContent value="compensation-info" className="mt-0">
                <div className="rounded-xl border border-[#E8E8E8] bg-white p-6">
                  <CompensationTab employeeId={employee.id} />
                </div>
              </TabsContent>
            )}

            {/* Tab 4: 근태현황 (B6-1) */}
            <TabsContent value="attendance" className="mt-0">
              <AttendanceTab employeeId={employee.id} />
            </TabsContent>

            {/* Tab 5: 평가결과 (comingSoon - B3) */}
            <TabsContent value="performance" className="mt-0">
              <div className="rounded-xl border border-[#E8E8E8] bg-white p-6">
                <div className="flex flex-col items-center py-12 text-[#999]">
                  <TrendingUp className="h-10 w-10 mb-3 text-[#E8E8E8]" />
                  <p className="text-sm font-medium text-[#666]">평가결과</p>
                  <p className="text-xs mt-1">B3 세션에서 구현 예정입니다.</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ─── Offboarding action (HR_ADMIN + ACTIVE) ─── */}
        {isHrAdmin && employee.status === 'ACTIVE' && (
          <div className="mt-6 pt-6 border-t border-[#E8E8E8]">
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

        </div>{/* end p-6 */}
        </div>{/* end flex-1 overflow */}

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
