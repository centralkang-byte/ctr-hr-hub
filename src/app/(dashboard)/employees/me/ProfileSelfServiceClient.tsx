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
import { useSubmitGuard } from '@/hooks/useSubmitGuard'
import { formatDate, formatDateTime } from '@/lib/format/date'

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


// ─── Component ──────────────────────────────────────────────

export function ProfileSelfServiceClient({ user }: ProfileSelfServiceClientProps) {
  const tc = useTranslations('common')
  const t = useTranslations('employee')

  const EDITABLE_FIELDS: { key: EditableField; labelKey: string }[] = [
    { key: 'phone', labelKey: 'selfServicePhone' },
    { key: 'emergencyContact', labelKey: 'selfServiceEmergencyName' },
    { key: 'emergencyContactPhone', labelKey: 'selfServiceEmergencyPhone' },
  ]

  const FIELD_LABELS: Record<string, string> = {
    phone: t('selfServicePhone'),
    emergencyContact: t('selfServiceEmergencyName'),
    emergencyContactPhone: t('selfServiceEmergencyPhone'),
  }

  const STATUS_MAP: Record<string, { labelKey: string; variant: BadgeVariant }> = {
    CHANGE_PENDING: { labelKey: 'selfServiceStatusPending', variant: 'outline' },
    CHANGE_APPROVED: { labelKey: 'selfServiceStatusApproved', variant: 'default' },
    CHANGE_REJECTED: { labelKey: 'selfServiceStatusRejected', variant: 'destructive' },
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
      setErrorMsg(t('selfServiceEnterNewValueError'))
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
        err instanceof Error ? err.message : t('selfServiceSubmitError'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const { guardedSubmit } = useSubmitGuard(handleSubmit)

  // ─── Render ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('selfServiceMyProfile')} description={t('selfServiceDescription')} />
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
        <PageHeader title={t('selfServiceMyProfile')} />
        <EmptyState title={t('selfServiceLoadError')} />
      </div>
    )
  }

  const currentFieldValue =
    editField && profile ? (profile[editField] ?? '') : ''

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('selfServiceMyProfile')}
        description={t('selfServiceDescription')}
      />

      {/* ─── Profile Info (read-only) ─── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('selfServiceBasicInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label={t('nameKorean')} value={profile.name} />
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
            <CardTitle className="text-lg">{t('selfServiceEditableFields')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {EDITABLE_FIELDS.map(({ key, labelKey }) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="text-xs text-muted-foreground">{t(labelKey)}</p>
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
                  {t('selfServiceChangeRequest')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ─── Request History ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('selfServiceChangeHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('selfServiceNoHistory')}
            </p>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => {
                const statusEntry = STATUS_MAP[r.status] ?? {
                  labelKey: null,
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
                        {r.oldValue ?? `(${t('selfServiceNoValue')})`} → {r.newValue}
                      </p>
                      {r.rejectionReason && (
                        <p className="text-xs text-destructive">
                          {t('selfServiceRejectionReason')}: {r.rejectionReason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDateTime(r.createdAt)}</span>
                      <Badge variant={statusEntry.variant}>{statusEntry.labelKey ? t(statusEntry.labelKey) : r.status}</Badge>
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
              {editField ? FIELD_LABELS[editField] : ''} {t('selfServiceChangeRequest')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-muted-foreground">{t('selfServiceCurrentValue')}</Label>
              <Input value={currentFieldValue} readOnly className="mt-1 bg-muted" />
            </div>
            <div>
              <Label>{t('selfServiceNewValue')}</Label>
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={t('selfServiceEnterNewValue')}
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
            <Button onClick={guardedSubmit} disabled={submitting}>
              {submitting ? t('selfServiceRequesting') : t('selfServiceChangeRequest')}
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
