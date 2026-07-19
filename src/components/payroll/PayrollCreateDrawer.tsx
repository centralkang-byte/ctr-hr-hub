'use client'

// ═══════════════════════════════════════════════════════════
// PayrollCreateDrawer.tsx — 급여 실행 생성 (WdDrawer 입력 폼 표준)
// Wave 1: 중앙 Dialog → 우측 슬라이드 전환 (modal→drawer #20).
// 로직 무변경 — POST /api/v1/payroll/runs.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WdDrawer, WdField } from '@/components/shared/WdDrawer'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

// ─── Constants ──────────────────────────────────────────────

const RUN_TYPE_LABEL_KEYS: Record<string, string> = {
  MONTHLY: 'createDialog.monthly',
  BONUS: 'createDialog.bonus',
  SEVERANCE: 'createDialog.severance',
  SPECIAL: 'createDialog.special',
}

// ─── Component ──────────────────────────────────────────────

interface PayrollCreateDrawerProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  /** 월 네비 선택 월 (yyyy-MM) — 드로어 기본 급여 기간 */
  defaultYearMonth?: string
}

export default function PayrollCreateDrawer({ open, onClose, onCreated, defaultYearMonth }: PayrollCreateDrawerProps) {
  const t = useTranslations('payroll')
  const tc = useTranslations('common')
  const initialYearMonth = defaultYearMonth ?? format(new Date(), 'yyyy-MM')

  const [loading, setLoading] = useState(false)
  const [yearMonth, setYearMonth] = useState(initialYearMonth)
  const [runType, setRunType] = useState('MONTHLY')
  const [name, setName] = useState('')
  const [payDate, setPayDate] = useState('')

  // 열릴 때 선택 월 동기화 + 폼 리셋
  useEffect(() => {
    if (open) {
      setYearMonth(initialYearMonth)
      setRunType('MONTHLY')
      setName('')
      setPayDate('')
    }
  }, [open, initialYearMonth])

  const handleSubmit = async () => {
    if (loading || !yearMonth) return
    setLoading(true)

    const [year, month] = yearMonth.split('-').map(Number)
    const periodStart = new Date(Date.UTC(year, month - 1, 1))
    // PayrollRun period fields are UTC date-only values; calculation expands
    // these dates to company-local start/end instants on the server.
    const periodEnd = new Date(Date.UTC(year, month, 0))

    try {
      await apiClient.post('/api/v1/payroll/runs', {
        name: name || `${yearMonth} ${t(RUN_TYPE_LABEL_KEYS[runType])}`,
        runType,
        yearMonth,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        payDate: payDate ? `${payDate}T00:00:00.000Z` : undefined,
      })
      onClose()
      onCreated()
    } catch (err) {
      toast({
        title: t('createDialog.createFailed'),
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <WdDrawer
      open={open}
      onClose={onClose}
      closeDisabled={loading}
      eyebrow={t('dashboard.title')}
      title={t('createDialog.title')}
      secondary={{ label: tc('cancel'), onClick: onClose, disabled: loading }}
      primary={{
        label: loading ? t('createDialog.creating') : t('createDialog.create'),
        onClick: handleSubmit,
        disabled: loading || !yearMonth,
        icon: loading ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined,
      }}
    >
      <p className="text-[12.5px] text-muted-foreground">{t('createDialog.description')}</p>

      {/* Enter 제출 보존 — foot 버튼이 form 밖이라 hidden submit 필요 */}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => { e.preventDefault(); void handleSubmit() }}
      >
      <WdField label={t('createDialog.payPeriod')} required htmlFor="payroll-create-yearMonth">
        <Input
          id="payroll-create-yearMonth"
          type="month"
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          required
        />
      </WdField>

      <WdField label={t('createDialog.runType')} htmlFor="payroll-create-runType">
        <Select value={runType} onValueChange={setRunType}>
          <SelectTrigger id="payroll-create-runType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RUN_TYPE_LABEL_KEYS).map(([value, labelKey]) => (
              <SelectItem key={value} value={value}>
                {t(labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </WdField>

      <WdField label={t('createDialog.runName')} htmlFor="payroll-create-name">
        <Input
          id="payroll-create-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${yearMonth} ${t(RUN_TYPE_LABEL_KEYS[runType])}`}
        />
      </WdField>

      <WdField label={t('createDialog.payDate')} htmlFor="payroll-create-payDate">
        <Input
          id="payroll-create-payDate"
          type="date"
          value={payDate}
          onChange={(e) => setPayDate(e.target.value)}
        />
      </WdField>

      <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </WdDrawer>
  )
}
