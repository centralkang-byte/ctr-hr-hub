'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PayStubBreakdown from '@/components/payroll/PayStubBreakdown'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import type { PayrollItemDetail } from '@/lib/payroll/types'

interface PayslipItem {
  id: string
  grossPay: string | number
  netPay: string | number
  detail: PayrollItemDetail | null
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

export default function PayStubDetailClient({ user, runId }: PayStubDetailClientProps) {
  const router = useRouter()
  const [items, setItems] = useState<PayslipItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
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
    fetch()
  }, [runId])

  const handleDownloadPdf = async () => {
    try {
      const res = await window.fetch(`/api/v1/payroll/me/${runId}/pdf`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payslip_${item?.run.yearMonth ?? 'unknown'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // error handled
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const item = items[0]

  if (!item || !item.detail) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => router.push('/payroll/me')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          돌아가기
        </Button>
        <div className="text-center py-16 text-slate-500">
          급여명세서를 찾을 수 없습니다.
        </div>
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
              <FileText className="h-5 w-5 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">{item.run.yearMonth} 급여명세서</h1>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{item.run.name}</p>
          </div>
        </div>
        <Button
          onClick={handleDownloadPdf}
          variant="outline"
          className="gap-1"
        >
          <Download className="h-4 w-4" />
          PDF 다운로드
        </Button>
      </div>

      {/* Pay Period Info */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">급여 기간</p>
            <p className="font-medium">
              {item.run.periodStart.split('T')[0]} ~ {item.run.periodEnd.split('T')[0]}
            </p>
          </div>
          <div>
            <p className="text-slate-500">지급일</p>
            <p className="font-medium">
              {item.run.paidAt?.split('T')[0] ?? item.run.payDate?.split('T')[0] ?? '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <PayStubBreakdown detail={item.detail} />
      </div>
    </div>
  )
}
