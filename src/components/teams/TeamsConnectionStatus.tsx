'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Teams Connection Status
// 연결 상태 뱃지 + tenant 정보 + 테스트/연결 해제
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2, XCircle, RefreshCw, Unplug } from 'lucide-react'

import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

interface Props {
  config: {
    tenantId: string
    connectedAt: string | null
    connectedBy: string | null
  }
  connected: boolean
  onDisconnect: () => void
  onRefresh: () => void
}

export function TeamsConnectionStatus({
  config,
  connected,
  onDisconnect,
  onRefresh,
}: Props) {
  const t = useTranslations('teams')
  const { toast } = useToast()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    tenantName?: string
    error?: string
  } | null>(null)

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await apiClient.post<{
        success: boolean
        tenantName?: string
        error?: string
      }>('/api/v1/teams/config/test', {})
      setTestResult(res.data)
      if (res.data.success) {
        toast({ title: t('ui.connection.testSuccess', { name: res.data.tenantName ?? '' }) })
      } else {
        toast({ title: t('ui.connection.testFail', { error: res.data.error ?? '' }), variant: 'destructive' })
      }
    } catch {
      setTestResult({ success: false, error: t('ui.connection.testFail', { error: '' }) })
      toast({ title: t('ui.connection.testFail', { error: '' }), variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {t('ui.connection.title')}
          {connected ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              {t('ui.connection.connected')}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <XCircle className="mr-1 h-3 w-3" />
              {t('ui.connection.disconnected')}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected && (
          <div className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tenant ID</span>
              <span className="font-mono tabular-nums text-xs">{config.tenantId}</span>
            </div>
            {config.connectedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('ui.connection.connectedAt')}</span>
                <span>{new Date(config.connectedAt).toLocaleString('ko-KR')}</span>
              </div>
            )}
          </div>
        )}

        {testResult && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              testResult.success
                ? 'border-emerald-200 bg-emerald-500/15 text-emerald-700'
                : 'border-destructive/20 bg-destructive/10 text-destructive'
            }`}
          >
            {testResult.success
              ? t('ui.connection.testSuccess', { name: testResult.tenantName ?? '' })
              : t('ui.connection.testFail', { error: testResult.error ?? '' })}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {t('ui.connection.testBtn')}
          </Button>

          {connected && (
            <Button variant="outline" onClick={onDisconnect} className="text-destructive hover:bg-destructive/10">
              <Unplug className="mr-2 h-4 w-4" />
              {t('ui.connection.disconnectBtn')}
            </Button>
          )}

          <Button variant="ghost" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
