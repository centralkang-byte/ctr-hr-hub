'use client'

import { useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api'
import type { Permission } from '@/types'

interface ContractHistory {
  id: string
  contractNumber: number
  contractType: string
  startDate: string
  endDate: string | null
  probationEndDate: string | null
  salaryAmount: string | null
  signedAt: string | null
  termsDocumentKey: string | null
  notes: string | null
  autoConvertTriggered: boolean
}

interface Props {
  employeeId: string
  permissions: Permission[]
}

const CONTRACT_TYPE_COLORS: Record<string, string> = {
  PERMANENT: 'bg-blue-100 text-blue-800',
  FIXED_TERM: 'bg-yellow-100 text-yellow-800',
  DISPATCH: 'bg-gray-100 text-gray-800',
  INTERN: 'bg-purple-100 text-purple-800',
  PROBATION_ONLY: 'bg-orange-100 text-orange-800',
}

export default function ContractsClient({ employeeId, permissions }: Props) {
  const t = useTranslations('employee')
  const tc = useTranslations('common')

  const CONTRACT_TYPE_LABELS: Record<string, string> = {
    PERMANENT: t('contractPermanent'),
    FIXED_TERM: t('contractFixedTerm'),
    DISPATCH: t('dispatch'),
    INTERN: t('intern'),
    PROBATION_ONLY: t('contractProbation'),
  }

  const [contracts, setContracts] = useState<ContractHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    contractType: 'PERMANENT',
    startDate: '',
    endDate: '',
    salaryAmount: '',
    notes: '',
  })

  const canWrite = permissions.some((p) => p.module === 'employees' && (p.action === 'create' || p.action === 'update'))

  const loadContracts = async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<ContractHistory>(
        `/api/v1/employees/${employeeId}/contracts`,
        {},
      )
      setContracts(res.data)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    await apiClient.post(`/api/v1/employees/${employeeId}/contracts`, {
      contractType: form.contractType,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      salaryAmount: form.salaryAmount ? Number(form.salaryAmount) : undefined,
      notes: form.notes || undefined,
    })
    setOpen(false)
    await loadContracts()
  }

  const isExpiringSoon = (endDate: string | null) => {
    if (!endDate) return false
    return differenceInDays(new Date(endDate), new Date()) <= 30
  }

  // 컴포넌트 마운트 시 로드
  if (!loading && contracts.length === 0) {
    loadContracts()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('contractHistory')}</h2>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-ctr-primary hover:bg-ctr-primary/90">
                + {t('newContract')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('newContractRegistration')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>{t('contractType')}</Label>
                  <Select
                    value={form.contractType}
                    onValueChange={(v) => setForm((f) => ({ ...f, contractType: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>{t('contractStartDate')}</Label>
                    <Input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('contractEndDateOptional')}</Label>
                    <Input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{t('salaryAmountOptional')}</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.salaryAmount}
                    onChange={(e) => setForm((f) => ({ ...f, salaryAmount: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{tc('memo')}</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
                <Button onClick={handleSubmit} className="w-full bg-ctr-primary">
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
              <TableHead>{t('contractSequence')}</TableHead>
              <TableHead>{tc('type')}</TableHead>
              <TableHead>{tc('startDate')}</TableHead>
              <TableHead>{tc('endDate')}</TableHead>
              <TableHead>{t('probationEndDate')}</TableHead>
              <TableHead>{t('signedDate')}</TableHead>
              <TableHead>{tc('note')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((c) => (
              <TableRow
                key={c.id}
                className={isExpiringSoon(c.endDate) ? 'bg-yellow-50' : ''}
              >
                <TableCell>{c.contractNumber}{t('contractSequenceSuffix')}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CONTRACT_TYPE_COLORS[c.contractType] ?? 'bg-gray-100 text-gray-800'}`}
                  >
                    {CONTRACT_TYPE_LABELS[c.contractType] ?? c.contractType}
                  </span>
                </TableCell>
                <TableCell>{format(new Date(c.startDate), 'yyyy-MM-dd')}</TableCell>
                <TableCell>
                  {c.endDate ? (
                    <span className={isExpiringSoon(c.endDate) ? 'font-medium text-yellow-700' : ''}>
                      {format(new Date(c.endDate), 'yyyy-MM-dd')}
                    </span>
                  ) : (
                    <span className="text-gray-400">{t('indefinite')}</span>
                  )}
                </TableCell>
                <TableCell>
                  {c.probationEndDate
                    ? format(new Date(c.probationEndDate), 'yyyy-MM-dd')
                    : '-'}
                </TableCell>
                <TableCell>
                  {c.signedAt ? format(new Date(c.signedAt), 'yyyy-MM-dd') : '-'}
                </TableCell>
                <TableCell className="text-sm text-gray-500">{c.notes ?? '-'}</TableCell>
              </TableRow>
            ))}
            {contracts.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-400">
                  {t('noContractHistory')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
