'use client'

import { EmptyState } from '@/components/ui/EmptyState'

import { useCallback, useEffect, useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { WdDrawer, WdField, WdRow } from '@/components/shared/WdDrawer'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { Permission } from '@/types'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'

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
  PERMANENT: 'bg-primary/10 text-primary/90',
  FIXED_TERM: 'bg-yellow-500/15 text-yellow-800',
  DISPATCH: 'bg-muted text-foreground',
  INTERN: 'bg-wt-4/10 text-wt-4',
  PROBATION_ONLY: 'bg-orange-500/15 text-orange-800',
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
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    contractType: 'PERMANENT',
    startDate: '',
    endDate: '',
    salaryAmount: '',
    notes: '',
  })

  const canWrite = permissions.some((p) => p.module === 'employees' && (p.action === 'create' || p.action === 'update'))

  const loadContracts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<ContractHistory>(
        `/api/v1/employees/${employeeId}/contracts`,
        {},
      )
      setContracts(res.data)
    } catch (err) {
      toast({
        title: '계약 이력 로드 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => { loadContracts() }, [loadContracts])

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

  const { guardedSubmit, isSubmitting } = useSubmitGuard(handleSubmit)

  const isExpiringSoon = (endDate: string | null) => {
    if (!endDate) return false
    return differenceInDays(new Date(endDate), new Date()) <= 30
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('contractHistory')}</h2>
        {canWrite && (
          <Button
            size="sm"
            className="bg-ctr-primary hover:bg-ctr-primary/90"
            onClick={() => setOpen(true)}
          >
            + {t('newContract')}
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('contractSequenceHeader')}</TableHead>
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
                className={isExpiringSoon(c.endDate) ? 'bg-yellow-500/10' : ''}
              >
                <TableCell>{c.contractNumber}{t('contractSequenceSuffix')}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CONTRACT_TYPE_COLORS[c.contractType] ?? 'bg-muted text-foreground'}`}
                  >
                    {CONTRACT_TYPE_LABELS[c.contractType] ?? c.contractType}
                  </span>
                </TableCell>
                <TableCell>{format(new Date(c.startDate), 'yyyy-MM-dd')}</TableCell>
                <TableCell>
                  {c.endDate ? (
                    <span className={isExpiringSoon(c.endDate) ? 'font-medium text-amber-700' : ''}>
                      {format(new Date(c.endDate), 'yyyy-MM-dd')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t('indefinite')}</span>
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
                <TableCell className="text-sm text-muted-foreground">{c.notes ?? '-'}</TableCell>
              </TableRow>
            ))}
            {!contracts?.length && (
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
          title={t('newContractRegistration')}
          closeDisabled={isSubmitting}
          secondary={{ label: tc('cancel'), onClick: () => setOpen(false), disabled: isSubmitting }}
          primary={{ label: tc('create'), onClick: guardedSubmit, disabled: isSubmitting }}
        >
          <WdField label={t('contractType')} htmlFor="contract-type">
            <Select
              value={form.contractType}
              onValueChange={(v) => setForm((f) => ({ ...f, contractType: v }))}
            >
              <SelectTrigger id="contract-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WdField>
          <WdRow>
            <WdField label={t('contractStartDate')} htmlFor="contract-start">
              <Input
                id="contract-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </WdField>
            <WdField label={t('contractEndDateOptional')} htmlFor="contract-end">
              <Input
                id="contract-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </WdField>
          </WdRow>
          <WdField label={t('salaryAmountOptional')} htmlFor="contract-salary">
            <Input
              id="contract-salary"
              type="number"
              placeholder="0"
              value={form.salaryAmount}
              onChange={(e) => setForm((f) => ({ ...f, salaryAmount: e.target.value }))}
            />
          </WdField>
          <WdField label={tc('memo')} htmlFor="contract-notes">
            <Textarea
              id="contract-notes"
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
