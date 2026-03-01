'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Self-Service Profile (내 프로필)
// 직원 정보 조회 + 수정 요청 + 요청 이력
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
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

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

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
  const t = useTranslations('employee')
  const tc = useTranslations('common')

  const EDITABLE_FIELDS: { key: EditableField; label: string }[] = [
    { key: 'phone', label: t('phone') },
    { key: 'emergencyContact', label: t('emergencyContactName') },
    { key: 'emergencyContactPhone', label: t('emergencyContactPhone') },
  ]

  const FIELD_LABELS: Record<string, string> = {
    phone: t('phone'),
    emergencyContact: t('emergencyContactName'),
    emergencyContactPhone: t('emergencyContactPhone'),
  }

  const STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
    CHANGE_PENDING: { label: t('changePending'), variant: 'outline' },
    CHANGE_APPROVED: { label: t('changeApproved'), variant: 'default' },
    CHANGE_REJECTED: { label: t('changeRejected'), variant: 'destructive' },
  }

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
      setErrorMsg(t('enterNewValue'))
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
        err instanceof Error ? err.message : t('changeRequestError'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('myProfile')} description={t('myProfileDescription')} />
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
        <PageHeader title={t('myProfile')} />
        <EmptyState title={t('profileLoadError')} />
      </div>
    )
  }

  const currentFieldValue =
    editField && profile ? (profile[editField] ?? '') : ''

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('myProfile')}
        description={t('myProfileDescription')}
      />

      {/* ─── Profile Info (read-only) ─── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('basicInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label={t('name')} value={profile.name} />
            {profile.nameEn && (
              <InfoRow label={t('nameEn')} value={profile.nameEn} />
            )}
            <InfoRow label={t('employeeCode')} value={profile.employeeNo} />
            <InfoRow label={t('email')} value={profile.email} />
            <InfoRow label={t('department')} value={profile.department?.name ?? '-'} />
            <InfoRow label={t('jobGrade')} value={profile.jobGrade?.name ?? '-'} />
            <InfoRow label={t('jobCategory')} value={profile.jobCategory?.name ?? '-'} />
            <InfoRow label={t('hireDate')} value={formatDate(profile.hireDate)} />
          </CardContent>
        </Card>

        {/* ─── Editable Fields ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('editableFields')}</CardTitle>
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
                  {t('changeRequest')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ─── Request History ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('changeRequestHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('noChangeRequests')}
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
                        {r.oldValue ?? `(${t('noValue')})`} → {r.newValue}
                      </p>
                      {r.rejectionReason && (
                        <p className="text-xs text-destructive">
                          {t('rejectionReason')}: {r.rejectionReason}
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
              {editField ? FIELD_LABELS[editField] : ''} {t('changeRequest')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-muted-foreground">{t('currentValue')}</Label>
              <Input value={currentFieldValue} readOnly className="mt-1 bg-muted" />
            </div>
            <div>
              <Label>{t('newValueLabel')}</Label>
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={t('enterNewValuePlaceholder')}
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
              {tc('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? t('requesting') : t('changeRequest')}
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
