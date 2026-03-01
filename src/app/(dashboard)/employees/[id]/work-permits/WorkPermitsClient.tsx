'use client'

import { useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api'
import type { Permission } from '@/types'

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

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-red-100 text-red-800',
  REVOKED: 'bg-gray-100 text-gray-800',
  PENDING_RENEWAL: 'bg-yellow-100 text-yellow-800',
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-ctr-primary hover:bg-ctr-primary/90">
                + {t('newWorkPermit')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('workPermitRegistration')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>{t('permitType')}</Label>
                  <Select
                    value={form.permitType}
                    onValueChange={(v) => setForm((f) => ({ ...f, permitType: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PERMIT_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>{t('permitNumberOptional')}</Label>
                    <Input
                      value={form.permitNumber}
                      onChange={(e) => setForm((f) => ({ ...f, permitNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('issuingCountry')} *</Label>
                    <Input
                      placeholder="KR, PL, US..."
                      maxLength={3}
                      value={form.issuingCountry}
                      onChange={(e) => setForm((f) => ({ ...f, issuingCountry: e.target.value.toUpperCase() }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{t('issuingAuthorityOptional')}</Label>
                  <Input
                    value={form.issuingAuthority}
                    onChange={(e) => setForm((f) => ({ ...f, issuingAuthority: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>{t('issueDate')} *</Label>
                    <Input
                      type="date"
                      value={form.issueDate}
                      onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('expiryDateOptional')}</Label>
                    <Input
                      type="date"
                      value={form.expiryDate}
                      onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{tc('memo')}</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={!form.issuingCountry || !form.issueDate}
                  className="w-full bg-ctr-primary"
                >
                  {tc('create')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">{tc('loading')}</p>
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
                className={isExpiringSoon(p.expiryDate) && p.status === 'ACTIVE' ? 'bg-yellow-50' : ''}
              >
                <TableCell>{PERMIT_TYPE_LABELS[p.permitType] ?? p.permitType}</TableCell>
                <TableCell className="font-mono text-sm">{p.permitNumber ?? '-'}</TableCell>
                <TableCell>{p.issuingCountry}</TableCell>
                <TableCell>{format(new Date(p.issueDate), 'yyyy-MM-dd')}</TableCell>
                <TableCell>
                  {p.expiryDate ? (
                    <span className={isExpiringSoon(p.expiryDate) && p.status === 'ACTIVE' ? 'font-medium text-yellow-700' : ''}>
                      {format(new Date(p.expiryDate), 'yyyy-MM-dd')}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-800'}`}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-gray-500">{p.notes ?? '-'}</TableCell>
              </TableRow>
            ))}
            {permits.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-400">
                  {t('noWorkPermits')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
