'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Teams Settings Page
// 4탭: 연결 / 채널 / 봇 / 다이제스트
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, Wifi, WifiOff } from 'lucide-react'

import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { TeamsConnectionStatus } from './TeamsConnectionStatus'
import { TeamsChannelSelector } from './TeamsChannelSelector'
import { DigestPreview } from './DigestPreview'
import { TeamsWebhookSection } from './TeamsWebhookSection'

interface TeamsConfig {
  id?: string
  companyId?: string
  tenantId: string
  teamId: string | null
  channelId: string | null
  webhookUrl: string | null
  botEnabled: boolean
  presenceSync: boolean
  digestEnabled: boolean
  digestDay: number
  digestHour: number
  connectedAt: string | null
  connectedBy: string | null
}

const EMPTY_CONFIG: TeamsConfig = {
  tenantId: '',
  teamId: null,
  channelId: null,
  webhookUrl: null,
  botEnabled: false,
  presenceSync: false,
  digestEnabled: false,
  digestDay: 1,
  digestHour: 9,
  connectedAt: null,
  connectedBy: null,
}

const TABS = ['연결', '채널', '봇', '다이제스트'] as const

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function TeamsSettingsPage({ user: _user }: { user: SessionUser }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [config, setConfig] = useState<TeamsConfig>(EMPTY_CONFIG)
  const [connected, setConnected] = useState(false)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<TeamsConfig | null>('/api/v1/teams/config')
      if (res.data) {
        setConfig(res.data)
        setConnected(!!res.data.connectedAt)
      } else {
        setConfig(EMPTY_CONFIG)
        setConnected(false)
      }
    } catch {
      toast({ title: '오류', description: 'Teams 설정을 불러올 수 없습니다.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void fetchConfig()
  }, [fetchConfig])

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiClient.put('/api/v1/teams/config', config)
      toast({ title: '성공', description: 'Teams 설정이 저장되었습니다.' })
      void fetchConfig()
    } catch {
      toast({ title: '오류', description: '저장 중 오류가 발생했습니다.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await apiClient.post('/api/v1/teams/config/disconnect', {})
      toast({ title: '성공', description: 'Teams 연결이 해제되었습니다.' })
      setConfig(EMPTY_CONFIG)
      setConnected(false)
    } catch {
      toast({ title: '오류', description: '연결 해제 중 오류가 발생했습니다.', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Teams 연동"
        description="Microsoft Teams와 HR Hub를 연동하여 알림, 봇, 주간 다이제스트를 설정합니다."
        actions={
          <div className="flex items-center gap-2">
            {connected ? (
              <span className="flex items-center gap-1.5 text-sm text-[#059669]">
                <Wifi className="h-4 w-4" /> 연결됨
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-[#999]">
                <WifiOff className="h-4 w-4" /> 미연결
              </span>
            )}
          </div>
        }
      />

      {/* ─── Tabs ─── */}
      <div className="flex border-b border-[#E8E8E8]">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === i
                ? 'border-b-2 border-[#00C853] text-[#00C853]'
                : 'text-[#666] hover:text-[#333]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ─── Tab Content ─── */}
      <div className="space-y-6">
        {activeTab === 0 && (
          <TeamsConnectionStatus
            config={config}
            connected={connected}
            onDisconnect={handleDisconnect}
            onRefresh={fetchConfig}
          />
        )}

        {activeTab === 1 && (
          <TeamsChannelSelector
            teamId={config.teamId}
            channelId={config.channelId}
            onSelect={(teamId, channelId) =>
              setConfig((prev) => ({ ...prev, teamId, channelId }))
            }
          />
        )}

        {activeTab === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">봇 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">봇 활성화</Label>
                  <p className="text-xs text-[#666]">
                    Teams에서 휴가, 급여, 근태 조회 명령을 사용할 수 있습니다.
                  </p>
                </div>
                <Switch
                  checked={config.botEnabled}
                  onCheckedChange={(v) =>
                    setConfig((prev) => ({ ...prev, botEnabled: v }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">프레전스 동기화</Label>
                  <p className="text-xs text-[#666]">
                    Teams 재석 상태를 HR Hub와 동기화합니다.
                  </p>
                </div>
                <Switch
                  checked={config.presenceSync}
                  onCheckedChange={(v) =>
                    setConfig((prev) => ({ ...prev, presenceSync: v }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 3 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">주간 다이제스트</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">다이제스트 발송</Label>
                    <p className="text-xs text-[#666]">
                      매주 선택한 요일/시간에 HR 주간 요약을 Teams 채널에 포스팅합니다.
                    </p>
                  </div>
                  <Switch
                    checked={config.digestEnabled}
                    onCheckedChange={(v) =>
                      setConfig((prev) => ({ ...prev, digestEnabled: v }))
                    }
                  />
                </div>

                {config.digestEnabled && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">발송 요일</Label>
                      <div className="flex gap-1">
                        {DAY_LABELS.map((label, i) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() =>
                              setConfig((prev) => ({ ...prev, digestDay: i }))
                            }
                            className={`h-8 w-8 rounded-full text-xs font-medium transition-colors ${
                              config.digestDay === i
                                ? 'bg-[#00C853] text-white'
                                : 'bg-[#F5F5F5] text-[#555] hover:bg-[#E8E8E8]'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">발송 시간</Label>
                      <select
                        value={config.digestHour}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            digestHour: parseInt(e.target.value),
                          }))
                        }
                        className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
                      >
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, '0')}:00
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <DigestPreview />
          </div>
        )}
      </div>

      {/* ─── Webhook Channels ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <TeamsWebhookSection />
      </div>

      {/* ─── Save Button ─── */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          저장
        </Button>
      </div>
    </div>
  )
}
