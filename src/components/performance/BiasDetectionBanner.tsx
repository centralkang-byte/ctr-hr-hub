'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

interface BiasLog {
  id: string; reviewerId: string; biasType: string; severity: string
  description: string; isAcknowledged: boolean; createdAt: string
}

interface Props {
  cycleId: string
  onRunCheck?: () => void
}

const BIAS_TYPE_LABEL: Record<string, string> = {
  central_tendency: '중심화 경향',
  leniency: '관대화',
  severity: '엄격화',
  recency: '최근 편향',
  tenure: '재직기간 편향',
  gender: '성별 편향',
}

const SEVERITY_STYLE: Record<string, string> = {
  info: 'bg-indigo-500/15 text-primary/90',
  warning: 'bg-amber-500/15 text-amber-700',
  critical: 'bg-destructive/10 text-destructive',
}

export default function BiasDetectionBanner({ cycleId, onRunCheck }: Props) {
  const [logs, setLogs] = useState<BiasLog[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)

  const fetchLogs = useCallback(async () => {
    if (!cycleId) return
    setLoading(true)
    try {
      const res = await apiClient.get<BiasLog[]>('/api/v1/performance/evaluations/bias-check', {
        acknowledged: 'false',
      })
      setLogs(Array.isArray(res.data) ? res.data : [])
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [cycleId])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const handleRunCheck = async () => {
    setChecking(true)
    try {
      await apiClient.post('/api/v1/performance/evaluations/bias-check', { cycleId })
      await fetchLogs()
      onRunCheck?.()
    } catch {
      toast({ title: '편향 감지 분석에 실패했습니다.', variant: 'destructive' })
    } finally {
      setChecking(false)
    }
  }

  if (loading) return null
  if (logs.length === 0) return (
    <div className="flex items-center justify-between bg-emerald-500/15 rounded-lg px-4 py-2.5 mb-4">
      <p className="text-xs text-emerald-700">편향 감지: 현재 경고 없음</p>
      <button
        onClick={handleRunCheck}
        disabled={checking}
        className="text-xs text-emerald-700 underline"
      >
        {checking ? '분석 중...' : '재분석'}
      </button>
    </div>
  )

  const criticalCount = logs.filter((l) => l.severity === 'critical').length
  const warningCount = logs.filter((l) => l.severity === 'warning').length

  return (
    <div className={`rounded-lg border mb-4 ${criticalCount > 0 ? 'border-red-300 bg-destructive/10' : 'border-amber-300 bg-amber-500/15'}`}>
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${criticalCount > 0 ? 'text-destructive' : 'text-amber-700'}`} />
          <span className={`text-sm font-medium ${criticalCount > 0 ? 'text-destructive' : 'text-amber-700'}`}>
            편향 감지 알림 ({logs.length}건)
            {criticalCount > 0 && <span className="ml-1 text-xs">— Critical {criticalCount}건</span>}
            {warningCount > 0 && <span className="ml-1 text-xs">— Warning {warningCount}건</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRunCheck} disabled={checking} className="text-xs text-muted-foreground underline">
            {checking ? '분석 중...' : '재분석'}
          </button>
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-border">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 py-1.5">
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${SEVERITY_STYLE[log.severity] ?? ''}`}>
                {log.severity.toUpperCase()}
              </span>
              <div>
                <span className="text-xs font-medium text-foreground">
                  {BIAS_TYPE_LABEL[log.biasType] ?? log.biasType}
                </span>
                <p className="text-xs text-muted-foreground">{log.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
