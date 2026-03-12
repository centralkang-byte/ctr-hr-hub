'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Teams Connection Status
// 연결 상태 뱃지 + tenant 정보 + 테스트/연결 해제
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
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
        toast({ title: '성공', description: `연결 테스트 성공: ${res.data.tenantName}` })
      } else {
        toast({ title: '실패', description: res.data.error ?? '연결 테스트 실패', variant: 'destructive' })
      }
    } catch {
      setTestResult({ success: false, error: '연결 테스트 중 오류가 발생했습니다.' })
      toast({ title: '오류', description: '연결 테스트 실패', variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          연결 상태
          {connected ? (
            <Badge className="bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              연결됨
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[#666]">
              <XCircle className="mr-1 h-3 w-3" />
              미연결
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected && (
          <div className="rounded-xl border border-[#E8E8E8] p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#666]">Tenant ID</span>
              <span className="font-mono text-xs">{config.tenantId}</span>
            </div>
            {config.connectedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-[#666]">연결 일시</span>
                <span>{new Date(config.connectedAt).toLocaleString('ko-KR')}</span>
              </div>
            )}
          </div>
        )}

        {testResult && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              testResult.success
                ? 'border-[#A7F3D0] bg-[#D1FAE5] text-[#047857]'
                : 'border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C]'
            }`}
          >
            {testResult.success
              ? `연결 성공 — 테넌트: ${testResult.tenantName}`
              : `연결 실패: ${testResult.error}`}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            연결 테스트
          </Button>

          {connected && (
            <Button variant="outline" onClick={onDisconnect} className="text-[#DC2626] hover:bg-[#FEE2E2]">
              <Unplug className="mr-2 h-4 w-4" />
              연결 해제
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
