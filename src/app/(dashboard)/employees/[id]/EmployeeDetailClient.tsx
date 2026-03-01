'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Detail Client
// 직원 프로필 5탭: 기본정보/인사이력/문서/징계상벌/연봉이력
// ═══════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ArrowUpDown,
  Building2,
  Calendar,
  Check,
  FileText,
  Pencil,
  Trophy,
  User,
  X,
} from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { apiClient } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import type { SessionUser, PaginationInfo, DeptOption, RefOption } from '@/types'

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

type HistoryRow = {
  id: string
  changeType: string
  notes: string | null
  createdAt: string
  fromDept: { name: string } | null
  toDept: { name: string } | null
  fromGrade: { name: string } | null
  toGrade: { name: string } | null
  approver: { name: string } | null
}

type DocumentRow = {
  id: string
  docType: string
  title: string
  fileKey: string
  fileSize: number | null
  mimeType: string | null
  createdAt: string
  uploader: { name: string } | null
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

const HISTORY_TYPE_ICONS: Record<string, string> = {
  HIRE: '🟢',
  TRANSFER: '🔄',
  PROMOTION: '⬆️',
  DEMOTION: '⬇️',
  RESIGN: '🔴',
  TRANSFER_CROSS_COMPANY: '🌐',
}

const SENSITIVE_DOC_TYPES = ['CONTRACT', 'ID_CARD']

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

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Avatar ─────────────────────────────────────────────────

function Avatar({ name, photoUrl, size = 'md' }: { name: string; photoUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-20 w-20 text-2xl' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-12 w-12 text-base'
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`${sizeClass} rounded-full object-cover`} />
  }
  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-full bg-ctr-primary font-semibold text-white`}>
      {getInitials(name)}
    </div>
  )
}

// ─── Field row for info display ──────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1.5">
      <dt className="w-36 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? '-'}</dd>
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

  const DOC_TYPE_LABELS: Record<string, string> = {
    CONTRACT: t('docContract'),
    ID_CARD: t('docIdCard'),
    CERTIFICATE: t('docCertificate'),
    RESUME: t('docResume'),
    HANDOVER: t('docHandover'),
    OTHER: t('docOther'),
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

  // ─── Histories tab ───
  const [histories, setHistories] = useState<HistoryRow[]>([])
  const [historiesPag, setHistoriesPag] = useState<PaginationInfo | null>(null)
  const [historiesLoading, setHistoriesLoading] = useState(false)

  const loadHistories = useCallback((page: number) => {
    setHistoriesLoading(true)
    apiClient
      .getList<HistoryRow>(`/api/v1/employees/${initialEmployee.id}/histories`, { page, limit: 20, orderBy: 'createdAt', order: 'desc' })
      .then((res) => {
        setHistories(res.data)
        setHistoriesPag(res.pagination)
      })
      .catch(() => setHistories([]))
      .finally(() => setHistoriesLoading(false))
  }, [initialEmployee.id])

  // ─── Documents tab ───
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)

  const loadDocuments = useCallback(() => {
    setDocumentsLoading(true)
    apiClient
      .get<DocumentRow[]>(`/api/v1/employees/${initialEmployee.id}/documents`)
      .then((res) => setDocuments(res.data))
      .catch(() => setDocuments([]))
      .finally(() => setDocumentsLoading(false))
  }, [initialEmployee.id])

  // ─── Tab change handler ───
  const handleTabChange = useCallback(
    (tab: string) => {
      if (tab === 'histories' && histories.length === 0 && !historiesLoading) loadHistories(1)
      if (tab === 'documents' && documents.length === 0 && !documentsLoading) loadDocuments()
    },
    [histories.length, documents.length, loadHistories, loadDocuments],
  )

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <Button onClick={handleSave} disabled={saving} className="bg-ctr-primary hover:bg-ctr-primary/90">
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
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('personalInfo')}</h3>
          <dl className="grid grid-cols-1 gap-0 divide-y sm:grid-cols-2 sm:divide-y-0">
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
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('employmentInfo')}</h3>
          <dl className="grid grid-cols-1 gap-0 divide-y sm:grid-cols-2 sm:divide-y-0">
            <InfoRow label={t('employeeCode')} value={<span className="font-mono">{employee.employeeNo}</span>} />
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

  // ─── Tab 2: 인사이력 ────────────────────────────────────────

  const historyColumns = useMemo<DataTableColumn<HistoryRow>[]>(() => [
    {
      key: 'changeType',
      header: tc('type'),
      render: (row) => (
        <span className="flex items-center gap-1.5">
          <span>{HISTORY_TYPE_ICONS[row.changeType] ?? '📋'}</span>
          <span className="text-sm">{row.changeType}</span>
        </span>
      ),
    },
    {
      key: 'detail',
      header: t('historyDetail'),
      render: (row) => {
        const parts: string[] = []
        if (row.fromDept && row.toDept) parts.push(`${row.fromDept.name} → ${row.toDept.name}`)
        if (row.fromGrade && row.toGrade) parts.push(`${row.fromGrade.name} → ${row.toGrade.name}`)
        if (row.notes) parts.push(row.notes)
        return <span className="text-sm">{parts.join(' / ') || '-'}</span>
      },
    },
    {
      key: 'approver',
      header: t('approver'),
      render: (row) => <span className="text-sm">{row.approver?.name ?? '-'}</span>,
    },
    {
      key: 'createdAt',
      header: tc('date'),
      sortable: true,
      render: (row) => <span className="text-sm">{formatDate(row.createdAt)}</span>,
    },
  ], [t, tc])

  // ─── Tab 3: 문서 ────────────────────────────────────────────

  const docColumns = useMemo<DataTableColumn<DocumentRow>[]>(() => [
    {
      key: 'docType',
      header: tc('type'),
      render: (row) => (
        <span className="flex items-center gap-1">
          {DOC_TYPE_LABELS[row.docType] ?? row.docType}
          {SENSITIVE_DOC_TYPES.includes(row.docType) && (
            <Badge variant="outline" className="ml-1 text-xs">{t('sensitive')}</Badge>
          )}
        </span>
      ),
    },
    { key: 'title', header: t('docTitle'), render: (row) => <span className="text-sm font-medium">{row.title}</span> },
    {
      key: 'uploader',
      header: t('uploader'),
      render: (row) => <span className="text-sm">{row.uploader?.name ?? '-'}</span>,
    },
    {
      key: 'fileSize',
      header: t('fileSize'),
      render: (row) => <span className="text-sm">{formatFileSize(row.fileSize)}</span>,
    },
    { key: 'createdAt', header: t('uploadDate'), render: (row) => <span className="text-sm">{formatDate(row.createdAt)}</span> },
    {
      key: 'download',
      header: '',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={SENSITIVE_DOC_TYPES.includes(row.docType) && !isHrAdmin}
          onClick={() => {
            // TODO: S3 presigned URL download (STEP3)
            window.open(`/api/v1/employees/${initialEmployee.id}/documents/${row.id}/download`, '_blank')
          }}
        >
          {tc('download')}
        </Button>
      ),
    },
  ], [isHrAdmin, initialEmployee.id, t, tc, DOC_TYPE_LABELS])

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* ─── Profile header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={employee.name} photoUrl={employee.photoUrl} size="lg" />
          <div>
            <h1 className="text-2xl font-bold">{employee.name}</h1>
            {employee.nameEn && <p className="text-sm text-muted-foreground">{employee.nameEn}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">{employee.employeeNo}</span>
              {employee.department && (
                <>
                  <span>·</span>
                  <span>{employee.department.name}</span>
                </>
              )}
              {employee.jobGrade && (
                <>
                  <span>·</span>
                  <span>{employee.jobGrade.name}</span>
                </>
              )}
            </div>
            <div className="mt-2">
              <Badge variant={STATUS_VARIANTS[employee.status] ?? 'outline'}>
                {STATUS_LABELS[employee.status] ?? employee.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Side info cards + main tabs ─── */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ─── Left: tabs ─── */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="basic" onValueChange={handleTabChange}>
            <TabsList className="mb-4">
              <TabsTrigger value="basic">
                <User className="mr-1.5 h-4 w-4" />
                {t('basicInfo')}
              </TabsTrigger>
              <TabsTrigger value="histories">
                <ArrowUpDown className="mr-1.5 h-4 w-4" />
                {t('hrHistory')}
              </TabsTrigger>
              <TabsTrigger value="documents">
                <FileText className="mr-1.5 h-4 w-4" />
                {t('documents')}
              </TabsTrigger>
              <TabsTrigger value="discipline">
                <Trophy className="mr-1.5 h-4 w-4" />
                {t('discipline')}
              </TabsTrigger>
              {isHrAdmin && (
                <TabsTrigger value="compensation">
                  <Building2 className="mr-1.5 h-4 w-4" />
                  {t('compensationHistory')}
                </TabsTrigger>
              )}
            </TabsList>

            {/* Tab 1: 기본정보 */}
            <TabsContent value="basic" className="mt-0">
              <div className="rounded-lg border bg-card p-6">
                {isHrAdmin && !editing && (
                  <div className="mb-4 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      <Pencil className="mr-1 h-4 w-4" />
                      {t('inlineEdit')}
                    </Button>
                  </div>
                )}
                {renderBasicInfo()}
              </div>
            </TabsContent>

            {/* Tab 2: 인사이력 */}
            <TabsContent value="histories" className="mt-0">
              <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold">{t('hrHistory')}</h2>
                <DataTable<HistoryRow>
                  columns={historyColumns}
                  data={histories}
                  pagination={historiesPag ?? undefined}
                  onPageChange={loadHistories}
                  loading={historiesLoading}
                  emptyMessage={t('noHrHistory')}
                  rowKey={(row) => row.id}
                />
              </div>
            </TabsContent>

            {/* Tab 3: 문서 */}
            <TabsContent value="documents" className="mt-0">
              <div className="rounded-lg border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t('documents')}</h2>
                  {isHrAdmin && (
                    <Button size="sm" className="bg-ctr-primary hover:bg-ctr-primary/90">
                      <FileText className="mr-1 h-4 w-4" />
                      {t('uploadDocument')}
                    </Button>
                  )}
                </div>
                <DataTable<DocumentRow>
                  columns={docColumns}
                  data={documents}
                  loading={documentsLoading}
                  emptyMessage={t('noDocuments')}
                  rowKey={(row) => row.id}
                />
              </div>
            </TabsContent>

            {/* Tab 4: 징계·상벌 */}
            <TabsContent value="discipline" className="mt-0">
              <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold">{t('discipline')}</h2>
                <EmptyState
                  title={t('noDiscipline')}
                  description={t('disciplineComingSoon')}
                />
              </div>
            </TabsContent>

            {/* Tab 5: 연봉이력 (HR_ADMIN only) */}
            {isHrAdmin && (
              <TabsContent value="compensation" className="mt-0">
                <div className="rounded-lg border bg-card p-6">
                  <h2 className="mb-4 text-lg font-semibold">{t('compensationHistory')}</h2>
                  <EmptyState
                    title={t('noCompensationHistory')}
                    description={t('compensationComingSoon')}
                  />
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* ─── Right sidebar ─── */}
        <div className="w-full space-y-4 lg:w-72 shrink-0">
          {/* Manager card */}
          {employee.manager && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('manager')}</h3>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/employees/${employee.manager!.id}`)}
              >
                <Avatar name={employee.manager.name} photoUrl={employee.manager.photoUrl} size="sm" />
                <div>
                  <p className="text-sm font-medium">{employee.manager.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {employee.manager.department?.name ?? ''}{employee.manager.jobGrade ? ` · ${employee.manager.jobGrade.name}` : ''}
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Tenure */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{t('tenure')}</h3>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{calcTenure(employee.hireDate)}</span>
            </div>
            {employee.hireDate && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('hireDate')}: {formatDate(employee.hireDate)}
              </p>
            )}
          </div>

          {/* Offboarding wizard (HR_ADMIN + ACTIVE) */}
          {isHrAdmin && employee.status === 'ACTIVE' && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{t('offboarding')}</h3>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
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
                        <span className="font-mono text-xs font-medium">{offboardingData.handoverToId}</span>
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
                    className="bg-ctr-primary hover:bg-ctr-primary/90"
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
      </div>
    </div>
  )
}
