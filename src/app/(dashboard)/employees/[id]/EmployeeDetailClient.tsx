'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Detail Client
// 직원 프로필 5탭: 기본정보/인사이력/문서/징계상벌/연봉이력
// ═══════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: '정규직',
  CONTRACT: '계약직',
  DISPATCH: '파견직',
  INTERN: '인턴',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '재직',
  ON_LEAVE: '휴직',
  RESIGNED: '퇴직',
  TERMINATED: '해고',
}

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

const DOC_TYPE_LABELS: Record<string, string> = {
  CONTRACT: '계약서',
  ID_CARD: '신분증',
  CERTIFICATE: '증명서',
  RESUME: '이력서',
  HANDOVER: '인수인계',
  OTHER: '기타',
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
  const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

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
      setEditError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }, [editData, employee.id])

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
              <Label>이름 (한글) <span className="text-destructive">*</span></Label>
              <Input value={editData.name} onChange={(e) => setEditData((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>영문명</Label>
              <Input value={editData.nameEn} onChange={(e) => setEditData((p) => ({ ...p, nameEn: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>이메일 <span className="text-destructive">*</span></Label>
              <Input type="email" value={editData.email} onChange={(e) => setEditData((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>전화번호</Label>
              <Input value={editData.phone} onChange={(e) => setEditData((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>생년월일</Label>
              <Input type="date" value={editData.birthDate} onChange={(e) => setEditData((p) => ({ ...p, birthDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>성별</Label>
              <Select value={editData.gender || '__NONE__'} onValueChange={(v) => setEditData((p) => ({ ...p, gender: v === '__NONE__' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">선택 안함</SelectItem>
                  <SelectItem value="M">남</SelectItem>
                  <SelectItem value="F">여</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>국적</Label>
              <Input value={editData.nationality} onChange={(e) => setEditData((p) => ({ ...p, nationality: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>비상연락처</Label>
              <Input value={editData.emergencyContact} onChange={(e) => setEditData((p) => ({ ...p, emergencyContact: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>비상연락처 전화</Label>
              <Input value={editData.emergencyContactPhone} onChange={(e) => setEditData((p) => ({ ...p, emergencyContactPhone: e.target.value }))} />
            </div>
            {/* Employment */}
            <div className="space-y-1.5">
              <Label>부서</Label>
              <Select value={editData.departmentId || '__NONE__'} onValueChange={(v) => setEditData((p) => ({ ...p, departmentId: v === '__NONE__' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">선택</SelectItem>
                  {filteredDepts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>직급</Label>
              <Select value={editData.jobGradeId || '__NONE__'} onValueChange={(v) => setEditData((p) => ({ ...p, jobGradeId: v === '__NONE__' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">선택</SelectItem>
                  {jobGrades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>직군</Label>
              <Select value={editData.jobCategoryId || '__NONE__'} onValueChange={(v) => setEditData((p) => ({ ...p, jobCategoryId: v === '__NONE__' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">선택</SelectItem>
                  {jobCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>고용형태</Label>
              <Select value={editData.employmentType} onValueChange={(v) => setEditData((p) => ({ ...p, employmentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>상태</Label>
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
              {saving ? '저장 중...' : '저장'}
            </Button>
            <Button variant="outline" onClick={() => { setEditing(false); setEditError(null) }}>
              <X className="mr-1 h-4 w-4" />
              취소
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">개인정보</h3>
          <dl className="grid grid-cols-1 gap-0 divide-y sm:grid-cols-2 sm:divide-y-0">
            <InfoRow label="이름 (한글)" value={employee.name} />
            <InfoRow label="영문명" value={employee.nameEn} />
            <InfoRow label="생년월일" value={formatDate(employee.birthDate)} />
            <InfoRow label="성별" value={employee.gender === 'M' ? '남' : employee.gender === 'F' ? '여' : '-'} />
            <InfoRow label="국적" value={employee.nationality} />
            <InfoRow label="이메일" value={employee.email} />
            <InfoRow label="전화번호" value={employee.phone} />
            <InfoRow label="비상연락처" value={employee.emergencyContact} />
            <InfoRow label="비상연락처 전화" value={employee.emergencyContactPhone} />
          </dl>
        </div>
        <Separator />
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">고용정보</h3>
          <dl className="grid grid-cols-1 gap-0 divide-y sm:grid-cols-2 sm:divide-y-0">
            <InfoRow label="사번" value={<span className="font-mono">{employee.employeeNo}</span>} />
            <InfoRow label="법인" value={employee.company?.name} />
            <InfoRow label="부서" value={employee.department?.name} />
            <InfoRow label="직급" value={employee.jobGrade?.name} />
            <InfoRow label="직군" value={employee.jobCategory?.name} />
            <InfoRow label="고용형태" value={EMPLOYMENT_TYPE_LABELS[employee.employmentType] ?? employee.employmentType} />
            <InfoRow label="상태" value={<Badge variant={STATUS_VARIANTS[employee.status] ?? 'outline'}>{STATUS_LABELS[employee.status] ?? employee.status}</Badge>} />
            <InfoRow label="입사일" value={formatDate(employee.hireDate)} />
            <InfoRow label="퇴직일" value={formatDate(employee.resignDate)} />
          </dl>
        </div>
      </div>
    )
  }

  // ─── Tab 2: 인사이력 ────────────────────────────────────────

  const historyColumns = useMemo<DataTableColumn<HistoryRow>[]>(() => [
    {
      key: 'changeType',
      header: '유형',
      render: (row) => (
        <span className="flex items-center gap-1.5">
          <span>{HISTORY_TYPE_ICONS[row.changeType] ?? '📋'}</span>
          <span className="text-sm">{row.changeType}</span>
        </span>
      ),
    },
    {
      key: 'detail',
      header: '내용',
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
      header: '승인자',
      render: (row) => <span className="text-sm">{row.approver?.name ?? '-'}</span>,
    },
    {
      key: 'createdAt',
      header: '일자',
      sortable: true,
      render: (row) => <span className="text-sm">{formatDate(row.createdAt)}</span>,
    },
  ], [])

  // ─── Tab 3: 문서 ────────────────────────────────────────────

  const docColumns = useMemo<DataTableColumn<DocumentRow>[]>(() => [
    {
      key: 'docType',
      header: '유형',
      render: (row) => (
        <span className="flex items-center gap-1">
          {DOC_TYPE_LABELS[row.docType] ?? row.docType}
          {SENSITIVE_DOC_TYPES.includes(row.docType) && (
            <Badge variant="outline" className="ml-1 text-xs">민감</Badge>
          )}
        </span>
      ),
    },
    { key: 'title', header: '제목', render: (row) => <span className="text-sm font-medium">{row.title}</span> },
    {
      key: 'uploader',
      header: '업로더',
      render: (row) => <span className="text-sm">{row.uploader?.name ?? '-'}</span>,
    },
    {
      key: 'fileSize',
      header: '크기',
      render: (row) => <span className="text-sm">{formatFileSize(row.fileSize)}</span>,
    },
    { key: 'createdAt', header: '업로드일', render: (row) => <span className="text-sm">{formatDate(row.createdAt)}</span> },
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
          다운로드
        </Button>
      ),
    },
  ], [isHrAdmin, initialEmployee.id])

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
                기본정보
              </TabsTrigger>
              <TabsTrigger value="histories">
                <ArrowUpDown className="mr-1.5 h-4 w-4" />
                인사이력
              </TabsTrigger>
              <TabsTrigger value="documents">
                <FileText className="mr-1.5 h-4 w-4" />
                문서
              </TabsTrigger>
              <TabsTrigger value="discipline">
                <Trophy className="mr-1.5 h-4 w-4" />
                징계·상벌
              </TabsTrigger>
              {isHrAdmin && (
                <TabsTrigger value="compensation">
                  <Building2 className="mr-1.5 h-4 w-4" />
                  연봉이력
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
                      인라인 편집
                    </Button>
                  </div>
                )}
                {renderBasicInfo()}
              </div>
            </TabsContent>

            {/* Tab 2: 인사이력 */}
            <TabsContent value="histories" className="mt-0">
              <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold">인사이력</h2>
                <DataTable<HistoryRow>
                  columns={historyColumns}
                  data={histories}
                  pagination={historiesPag ?? undefined}
                  onPageChange={loadHistories}
                  loading={historiesLoading}
                  emptyMessage="인사이력이 없습니다"
                  rowKey={(row) => row.id}
                />
              </div>
            </TabsContent>

            {/* Tab 3: 문서 */}
            <TabsContent value="documents" className="mt-0">
              <div className="rounded-lg border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">문서</h2>
                  {isHrAdmin && (
                    <Button size="sm" className="bg-ctr-primary hover:bg-ctr-primary/90">
                      <FileText className="mr-1 h-4 w-4" />
                      문서 업로드
                    </Button>
                  )}
                </div>
                <DataTable<DocumentRow>
                  columns={docColumns}
                  data={documents}
                  loading={documentsLoading}
                  emptyMessage="등록된 문서가 없습니다"
                  rowKey={(row) => row.id}
                />
              </div>
            </TabsContent>

            {/* Tab 4: 징계·상벌 */}
            <TabsContent value="discipline" className="mt-0">
              <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold">징계·상벌</h2>
                <EmptyState
                  title="징계·상벌 이력이 없습니다"
                  description="STEP 5에서 징계·포상 기능이 추가될 예정입니다."
                />
              </div>
            </TabsContent>

            {/* Tab 5: 연봉이력 (HR_ADMIN only) */}
            {isHrAdmin && (
              <TabsContent value="compensation" className="mt-0">
                <div className="rounded-lg border bg-card p-6">
                  <h2 className="mb-4 text-lg font-semibold">연봉이력</h2>
                  <EmptyState
                    title="연봉이력이 없습니다"
                    description="STEP 6에서 연봉·보상 기능이 추가될 예정입니다."
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
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">매니저</h3>
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
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">재직 기간</h3>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{calcTenure(employee.hireDate)}</span>
            </div>
            {employee.hireDate && (
              <p className="mt-1 text-xs text-muted-foreground">
                입사일: {formatDate(employee.hireDate)}
              </p>
            )}
          </div>

          {/* Resign button (HR_ADMIN + ACTIVE) */}
          {isHrAdmin && employee.status === 'ACTIVE' && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">퇴직 처리</h3>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => {
                  if (confirm('정말 퇴직 처리하시겠습니까?')) {
                    apiClient
                      .put(`/api/v1/employees/${employee.id}`, {
                        status: 'RESIGNED',
                        resignDate: new Date().toISOString().split('T')[0],
                      })
                      .then(() => router.push('/employees'))
                      .catch(() => alert('퇴직 처리에 실패했습니다.'))
                  }
                }}
              >
                퇴직 처리
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
