'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PayStubBreakdown from '@/components/payroll/PayStubBreakdown'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import type { PayrollItemDetail } from '@/lib/payroll/types'

// ─── Raw DB detail shape (from seed script) ──────────────────
interface RawDetail {
  grade?: string
  persona?: string
  components?: {
    base?: number
    meal?: number
    transport?: number
    overtime?: number
    positionAllowance?: number
    nightShift?: number
    holiday?: number
    bonus?: number
  }
  deductions?: {
    nationalPension?: number
    healthInsurance?: number
    longTermCare?: number
    employmentInsurance?: number
    incomeTax?: number
    localIncomeTax?: number
    otherDeductions?: number
  }
}

// ─── Normalise any detail format → PayrollItemDetail ─────────
function normaliseDetail(
  raw: unknown,
  grossPay: number,
  netPay: number,
): PayrollItemDetail | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>

  // Already in PayrollItemDetail format (has earnings key)
  if (d.earnings && typeof d.earnings === 'object') {
    return raw as PayrollItemDetail
  }

  // Raw seed format: { components, deductions }
  const rd = raw as RawDetail
  const c = rd.components ?? {}
  const ded = rd.deductions ?? {}

  const earnings = {
    baseSalary:             c.base ?? 0,
    fixedOvertimeAllowance: 0,
    mealAllowance:          c.meal ?? 0,
    transportAllowance:     c.transport ?? 0,
    overtimePay:            c.overtime ?? 0,
    nightShiftPay:          c.nightShift ?? 0,
    holidayPay:             c.holiday ?? 0,
    bonuses:                c.bonus ?? 0,
    otherEarnings:          c.positionAllowance ?? 0,
  }
  const deductions = {
    nationalPension:     ded.nationalPension ?? 0,
    healthInsurance:     ded.healthInsurance ?? 0,
    longTermCare:        ded.longTermCare ?? 0,
    employmentInsurance: ded.employmentInsurance ?? 0,
    incomeTax:           ded.incomeTax ?? 0,
    localIncomeTax:      ded.localIncomeTax ?? 0,
    otherDeductions:     ded.otherDeductions ?? 0,
  }
  const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0)

  return {
    earnings,
    deductions,
    overtime: {
      hourlyWage: 0,
      totalOvertimeHours: 0,
      weekdayOTHours: 0,
      weekendHours: 0,
      holidayHours: 0,
      nightHours: 0,
    },
    grossPay: Number(grossPay) || 0,
    totalDeductions,
    netPay: Number(netPay) || 0,
  }
}

// ─── API response shape ───────────────────────────────────────
interface PayslipItem {
  id: string
  grossPay: string | number
  netPay: string | number
  deductions: string | number
  detail: unknown   // may be raw or already-normalised
  run: {
    id: string
    name: string
    yearMonth: string
    periodStart: string
    periodEnd: string
    payDate: string | null
    paidAt: string | null
  }
}

interface PayStubDetailClientProps {
  user: SessionUser
  runId: string
}

export default function PayStubDetailClient({ user: _user, runId }: PayStubDetailClientProps) {
  const router = useRouter()
  const t = useTranslations('payStubDetail')
  const tCommon = useTranslations('common')
  const [items, setItems] = useState<PayslipItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get<PayslipItem[]>('/api/v1/payroll/me')
        const data = (res.data ?? []) as PayslipItem[]
        setItems(data.filter((i) => i.run.id === runId))
      } catch {
        // error handled
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [runId])

  const handleDownloadPdf = async () => {
    try {
      const res = await window.fetch(`/api/v1/payroll/me/${runId}/pdf`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payslip_${item?.run.yearMonth ?? 'unknown'}.html`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // error handled
    }
  }

  if (loading) return <TableSkeleton rows={8} />

  const raw = items[0]
  if (!raw) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => router.push('/payroll/me')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {tCommon('back')}
        </Button>
        <div className="text-center py-16 text-[#666]">{t('notFound')}</div>
      </div>
    )
  }

  // Normalise detail on the client — handles both raw and pre-normalised formats
  const detail: PayrollItemDetail | null = normaliseDetail(
    raw.detail,
    Number(raw.grossPay),
    Number(raw.netPay),
  )

  // item alias for use in JSX below
  const item = raw

  if (!detail) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => router.push('/payroll/me')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {tCommon('back')}
        </Button>
        <div className="text-center py-16 text-[#666]">{t('notFound')}</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/payroll/me')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">
                {t('titleWithMonth', { month: item.run.yearMonth })}
              </h1>
            </div>
            <p className="text-sm text-[#666] mt-0.5">{item.run.name}</p>
          </div>
        </div>
        <Button onClick={handleDownloadPdf} variant="outline" className="gap-1">
          <Download className="h-4 w-4" />
          {t('downloadPdf')}
        </Button>
      </div>

      {/* Pay Period Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[#666]">{t('payPeriod')}</p>
            <p className="font-medium">
              {item.run.periodStart.split('T')[0]} ~ {item.run.periodEnd.split('T')[0]}
            </p>
          </div>
          <div>
            <p className="text-[#666]">{t('payDate')}</p>
            <p className="font-medium">
              {item.run.paidAt?.split('T')[0] ?? item.run.payDate?.split('T')[0] ?? '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <PayStubBreakdown detail={detail} />
      </div>
    </div>
  )
}
