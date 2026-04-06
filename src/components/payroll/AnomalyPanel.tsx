'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles, AlertTriangle, AlertCircle, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'
import type { PayrollAnomalyResult, AnomalySeverity } from '@/lib/payroll/types'

const SEVERITY_CONFIG: Record<AnomalySeverity, { icon: typeof AlertTriangle; color: string; bg: string }> = {
  ERROR: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-500/15' },
  INFO: { icon: Info, color: 'text-primary', bg: 'bg-primary/10' },
}

const RISK_COLORS: Record<string, string> = {
  LOW: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  MEDIUM: 'bg-amber-500/15 text-amber-700 border-amber-300',
  HIGH: 'bg-destructive/10 text-destructive border-destructive/20',
}

interface AnomalyPanelProps {
  runId: string
}

export default function AnomalyPanel({ runId }: AnomalyPanelProps) {
  const t = useTranslations('payroll')
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
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            <h3 className="text-sm font-semibold text-foreground">{t('anomaly.aiDetection')}</h3>
            <Badge variant="secondary" className="gap-1 text-xs">
              <Sparkles className="h-3 w-3" />
              {t('anomaly.aiGenerated')}
            </Badge>
          </div>
          <Button
            onClick={runCheck}
            disabled={loading}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                {t('anomaly.analyzing')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                {t('anomaly.runAiVerification')}
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('anomaly.description')}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-500" />
          <h3 className="text-sm font-semibold text-foreground">{t('anomaly.aiResult')}</h3>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${RISK_COLORS[result.risk_level]}`}
          >
            {t('anomaly.riskLevel', { level: result.risk_level })}
          </span>
        </div>
        <Button onClick={runCheck} disabled={loading} size="sm" variant="outline">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('anomaly.reanalyze')}
        </Button>
      </div>

      {/* Findings */}
      {result.findings.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('anomaly.keyFindings')}</p>
          <ul className="space-y-1">
            {result.findings.map((f, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <span className="text-muted-foreground mt-0.5">•</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Items to Review */}
      {result.items_to_review.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('anomaly.reviewItems')}</p>
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
                    <span className="text-muted-foreground"> — {item.issue}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div className="bg-indigo-500/15 rounded-lg p-3">
        <p className="text-xs font-medium text-primary mb-1">{t('anomaly.aiRecommendation')}</p>
        <p className="text-sm text-indigo-800">{result.recommendation}</p>
      </div>
    </div>
  )
}
