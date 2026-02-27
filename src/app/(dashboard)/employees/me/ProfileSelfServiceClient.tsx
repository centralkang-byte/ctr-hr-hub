'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Self-Service Profile (내 프로필)
// 직원 정보 조회 + 수정 요청 + 요청 이력
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface EmployeeProfile {
  id: string
  name: string
  nameEn: string | null
  employeeNo: string
  email: string
  phone: string | null
  emergencyContact: string | null
  emergencyContactPhone: string | null
  department: { id: string; name: string } | null
  jobGrade: { id: string; name: string } | null
  jobCategory: { id: string; name: string } | null
  hireDate: string
  status: string
}

interface ChangeRequest {
  id: string
  fieldName: string
  oldValue: string | null
  newValue: string
  status: string
  rejectionReason: string | null
  reviewedAt: string | null
  reviewer: { id: string; name: string } | null
  createdAt: string
}

interface ProfileSelfServiceClientProps {
  user: SessionUser
}

// ─── Constants ──────────────────────────────────────────────

type EditableField = 'phone' | 'emergencyContact' | 'emergencyContactPhone'

const EDITABLE_FIELDS: { key: EditableField; label: string }[] = [
  { key: 'phone', label: '전화번호' },
  { key: 'emergencyContact', label: '비상연락처 이름' },
  { key: 'emergencyContactPhone', label: '비상연락처 전화' },
]

const FIELD_LABELS: Record<string, string> = {
  phone: '전화번호',
  emergencyContact: '비상연락처 이름',
  emergencyContactPhone: '비상연락처 전화',
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  CHANGE_PENDING: { label: '대기', variant: 'outline' },
  CHANGE_APPROVED: { label: '승인', variant: 'default' },
  CHANGE_REJECTED: { label: '반려', variant: 'destructive' },
}

// ─── Helpers ────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Component ──────────────────────────────────────────────

export function ProfileSelfServiceClient({ user }: ProfileSelfServiceClientProps) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editField, setEditField] = useState<EditableField | null>(null)
  const [newValue, setNewValue] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // ─── Fetch data ─────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, requestsRes] = await Promise.all([
        apiClient.get<EmployeeProfile>(`/api/v1/employees/${user.employeeId}`),
        apiClient.get<ChangeRequest[]>('/api/v1/profile/change-requests'),
      ])
      setProfile(profileRes.data)
      setRequests(requestsRes.data)
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [user.employeeId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Open edit dialog ───────────────────────────────────

  function openEditDialog(field: EditableField) {
    setEditField(field)
    setNewValue('')
    setErrorMsg('')
    setDialogOpen(true)
  }

  // ─── Submit change request ──────────────────────────────

  async function handleSubmit() {
    if (!editField || !newValue.trim()) {
      setErrorMsg('새 값을 입력해주세요.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')
    try {
      await apiClient.post('/api/v1/profile/change-requests', {
        fieldName: editField,
        newValue: newValue.trim(),
      })
      setDialogOpen(false)
      await fetchData()
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '요청 중 오류가 발생했습니다.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="내 프로필" description="프로필 조회 및 수정 요청" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <PageHeader title="내 프로필" />
        <EmptyState title="프로필 정보를 불러올 수 없습니다." />
      </div>
    )
  }

  const currentFieldValue =
    editField && profile ? (profile[editField] ?? '') : ''

  return (
    <div className="space-y-6">
      <PageHeader
        title="내 프로필"
        description="프로필 조회 및 수정 요청"
      />

      {/* ─── Profile Info (read-only) ─── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="이름" value={profile.name} />
            {profile.nameEn && (
              <InfoRow label="영문 이름" value={profile.nameEn} />
            )}
            <InfoRow label="사번" value={profile.employeeNo} />
            <InfoRow label="이메일" value={profile.email} />
            <InfoRow label="부서" value={profile.department?.name ?? '-'} />
            <InfoRow label="직급" value={profile.jobGrade?.name ?? '-'} />
            <InfoRow label="직종" value={profile.jobCategory?.name ?? '-'} />
            <InfoRow label="입사일" value={formatDate(profile.hireDate)} />
          </CardContent>
        </Card>

        {/* ─── Editable Fields ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">수정 가능 항목</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {EDITABLE_FIELDS.map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium">
                    {profile[key] || '-'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(key)}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  수정 요청
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ─── Request History ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">변경 요청 이력</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              변경 요청 이력이 없습니다.
            </p>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => {
                const status = STATUS_MAP[r.status] ?? {
                  label: r.status,
                  variant: 'outline' as BadgeVariant,
                }
                return (
                  <div
                    key={r.id}
                    className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">
                        {FIELD_LABELS[r.fieldName] ?? r.fieldName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.oldValue ?? '(없음)'} → {r.newValue}
                      </p>
                      {r.rejectionReason && (
                        <p className="text-xs text-destructive">
                          반려 사유: {r.rejectionReason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDateTime(r.createdAt)}</span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editField ? FIELD_LABELS[editField] : ''} 수정 요청
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-muted-foreground">현재 값</Label>
              <Input value={currentFieldValue} readOnly className="mt-1 bg-muted" />
            </div>
            <div>
              <Label>새 값</Label>
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="변경할 값을 입력하세요"
                className="mt-1"
              />
            </div>
            {errorMsg && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '요청 중...' : '수정 요청'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Sub-component ──────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
