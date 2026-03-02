'use client'

import { useState } from 'react'
import { Sparkles, AlertTriangle, AlertCircle, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'
import type { PayrollAnomalyResult, AnomalySeverity } from '@/lib/payroll/types'

const SEVERITY_CONFIG: Record<AnomalySeverity, { icon: typeof AlertTriangle; color: string; bg: string }> = {
  ERROR: { icon: AlertCircle, color: 'text-[#DC2626]', bg: 'bg-[#FEE2E2]' },
  WARNING: { icon: AlertTriangle, color: 'text-[#D97706]', bg: 'bg-[#FEF3C7]' },
  INFO: { icon: Info, color: 'text-[#00C853]', bg: 'bg-[#E8F5E9]' },
}

const RISK_COLORS: Record<string, string> = {
  LOW: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]',
  MEDIUM: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]',
  HIGH: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]',
}

interface AnomalyPanelProps {
  runId: string
}

export default function AnomalyPanel({ runId }: AnomalyPanelProps) {
  const [result, setResult] = useState<PayrollAnomalyResult | null>(null)
  const [loading, setLoading] = useState(false)

  const runCheck = async () => {
    setLoading(true)
    try {
      const res = await apiClient.post<PayrollAnomalyResult>('/api/v1/ai/payroll-anomaly', {
        runId,
      })
      setResult(res.data)
    } catch {
      // error handled
    } finally {
      setLoading(false)
    }
  }

  if (!result) {
    return (
      <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#6366F1]" />
            <h3 className="text-sm font-semibold text-[#1A1A1A]">AI 이상감지</h3>
            <Badge variant="secondary" className="gap-1 text-xs">
              <Sparkles className="h-3 w-3" />
              AI 생성
            </Badge>
          </div>
          <Button
            onClick={runCheck}
            disabled={loading}
            size="sm"
            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                AI 검증 실행
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-[#666]">
          AI를 활용하여 급여 데이터의 이상 항목을 자동으로 감지합니다.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#6366F1]" />
          <h3 className="text-sm font-semibold text-[#1A1A1A]">AI 이상감지 결과</h3>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${RISK_COLORS[result.risk_level]}`}
          >
            위험도: {result.risk_level}
          </span>
        </div>
        <Button onClick={runCheck} disabled={loading} size="sm" variant="outline">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '재분석'}
        </Button>
      </div>

      {/* Findings */}
      {result.findings.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-[#666] mb-2">주요 발견사항</p>
          <ul className="space-y-1">
            {result.findings.map((f, i) => (
              <li key={i} className="text-sm text-[#333] flex items-start gap-2">
                <span className="text-[#999] mt-0.5">•</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Items to Review */}
      {result.items_to_review.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-[#666] mb-2">검토 필요 항목</p>
          <div className="space-y-2">
            {result.items_to_review.map((item, i) => {
              const config = SEVERITY_CONFIG[item.severity]
              const Icon = config.icon
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 p-2 rounded-lg ${config.bg}`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
                  <div className="text-sm">
                    <span className="font-medium">{item.employeeName}</span>
                    <span className="text-[#555]"> — {item.issue}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div className="bg-[#E0E7FF] rounded-lg p-3">
        <p className="text-xs font-medium text-[#4F46E5] mb-1">AI 권고사항</p>
        <p className="text-sm text-[#3730A3]">{result.recommendation}</p>
      </div>
    </div>
  )
}
