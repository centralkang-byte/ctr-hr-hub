'use client'

import { EmptyState } from '@/components/ui/EmptyState'

import { useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { WdDrawer, WdField, WdRow } from '@/components/shared/WdDrawer'
import { apiClient } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Permission } from '@/types'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'

interface WorkPermit {
  id: string
  permitType: string
  permitNumber: string | null
  issuingCountry: string
  issuingAuthority: string | null
  issueDate: string
  expiryDate: string | null
  status: string
  notes: string | null
}

interface Props {
  employeeId: string
  permissions: Permission[]
}


export default function WorkPermitsClient({ employeeId, permissions }: Props) {
  const t = useTranslations('employee')
  const tc = useTranslations('common')

  const PERMIT_TYPE_LABELS: Record<string, string> = {
    WORK_VISA: t('permitWorkVisa'),
    WORK_PERMIT: t('permitWorkPermit'),
    RESIDENCE_PERMIT: t('permitResidence'),
    I9_VERIFICATION: t('permitI9'),
    OTHER: t('permitOther'),
  }

  const STATUS_LABELS: Record<string, string> = {
    ACTIVE: t('permitActive'),
    EXPIRED: t('permitExpired'),
    REVOKED: t('permitRevoked'),
    PENDING_RENEWAL: t('permitPendingRenewal'),
  }

  const [permits, setPermits] = useState<WorkPermit[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    permitType: 'WORK_VISA',
    permitNumber: '',
    issuingCountry: '',
    issuingAuthority: '',
    issueDate: '',
    expiryDate: '',
    notes: '',
  })

  const canWrite = permissions.some((p) => p.module === 'employees' && (p.action === 'create' || p.action === 'update'))

  const loadPermits = async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<WorkPermit>(
        `/api/v1/employees/${employeeId}/work-permits`,
        {},
      )
      setPermits(res.data)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    await apiClient.post(`/api/v1/employees/${employeeId}/work-permits`, {
      permitType: form.permitType,
      permitNumber: form.permitNumber || undefined,
      issuingCountry: form.issuingCountry,
      issuingAuthority: form.issuingAuthority || undefined,
      issueDate: form.issueDate,
      expiryDate: form.expiryDate || undefined,
      notes: form.notes || undefined,
    })
    setOpen(false)
    await loadPermits()
  }

  const { guardedSubmit, isSubmitting } = useSubmitGuard(handleSubmit)

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false
    return differenceInDays(new Date(expiryDate), new Date()) <= 90
  }

  if (!loading && permits.length === 0) {
    loadPermits()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('workPermitsTitle')}</h2>
        {canWrite && (
          <Button
            size="sm"
            className="bg-ctr-primary hover:bg-ctr-primary/90"
            onClick={() => setOpen(true)}
          >
            + {t('newWorkPermit')}
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tc('type')}</TableHead>
              <TableHead>{t('permitNumber')}</TableHead>
              <TableHead>{t('issuingCountry')}</TableHead>
              <TableHead>{t('issueDate')}</TableHead>
              <TableHead>{t('expiryDate')}</TableHead>
              <TableHead>{tc('status')}</TableHead>
              <TableHead>{tc('note')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permits.map((p) => (
              <TableRow
                key={p.id}
                className={isExpiringSoon(p.expiryDate) && p.status === 'ACTIVE' ? 'bg-yellow-500/10' : ''}
              >
                <TableCell>{PERMIT_TYPE_LABELS[p.permitType] ?? p.permitType}</TableCell>
                <TableCell className="font-mono tabular-nums text-sm">{p.permitNumber ?? '-'}</TableCell>
                <TableCell>{p.issuingCountry}</TableCell>
                <TableCell>{format(new Date(p.issueDate), 'yyyy-MM-dd')}</TableCell>
                <TableCell>
                  {p.expiryDate ? (
                    <span className={isExpiringSoon(p.expiryDate) && p.status === 'ACTIVE' ? 'font-medium text-amber-700' : ''}>
                      {format(new Date(p.expiryDate), 'yyyy-MM-dd')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={p.status}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.notes ?? '-'}</TableCell>
              </TableRow>
            ))}
            {!permits?.length && (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {canWrite && (
        <WdDrawer
          open={open}
          onClose={() => setOpen(false)}
          title={t('workPermitRegistration')}
          closeDisabled={isSubmitting}
          secondary={{ label: tc('cancel'), onClick: () => setOpen(false), disabled: isSubmitting }}
          primary={{
            label: tc('create'),
            onClick: guardedSubmit,
            disabled: isSubmitting || !form.issuingCountry || !form.issueDate,
          }}
        >
          <WdField label={t('permitType')} htmlFor="permit-type">
            <Select
              value={form.permitType}
              onValueChange={(v) => setForm((f) => ({ ...f, permitType: v }))}
            >
              <SelectTrigger id="permit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PERMIT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WdField>
          <WdRow>
            <WdField label={t('permitNumberOptional')} htmlFor="permit-number">
              <Input
                id="permit-number"
                value={form.permitNumber}
                onChange={(e) => setForm((f) => ({ ...f, permitNumber: e.target.value }))}
              />
            </WdField>
            <WdField label={t('issuingCountry')} required htmlFor="permit-country">
              <Input
                id="permit-country"
                placeholder="KR, PL, US..."
                maxLength={3}
                value={form.issuingCountry}
                onChange={(e) => setForm((f) => ({ ...f, issuingCountry: e.target.value.toUpperCase() }))}
              />
            </WdField>
          </WdRow>
          <WdField label={t('issuingAuthorityOptional')} htmlFor="permit-authority">
            <Input
              id="permit-authority"
              value={form.issuingAuthority}
              onChange={(e) => setForm((f) => ({ ...f, issuingAuthority: e.target.value }))}
            />
          </WdField>
          <WdRow>
            <WdField label={t('issueDate')} required htmlFor="permit-issue-date">
              <Input
                id="permit-issue-date"
                type="date"
                value={form.issueDate}
                onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
              />
            </WdField>
            <WdField label={t('expiryDateOptional')} htmlFor="permit-expiry-date">
              <Input
                id="permit-expiry-date"
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
              />
            </WdField>
          </WdRow>
          <WdField label={tc('memo')} htmlFor="permit-notes">
            <Textarea
              id="permit-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </WdField>
        </WdDrawer>
      )}
    </div>
  )
}
