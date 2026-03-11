'use client'

import { Save, RotateCcw, Loader2, Bell, Mail, MessageSquare, Smartphone, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import type { NotificationChannelsSetting, NotificationChannelEntry } from '@/types/process-settings'

interface Props { companyId: string | null }

const ICON_MAP: Record<string, LucideIcon> = { email: Mail, push: Smartphone, teams: MessageSquare, slack: MessageSquare }

const DEFAULTS: NotificationChannelsSetting = {
  channels: [
    { key: 'email', label: '이메일', iconKey: 'email', enabled: true },
    { key: 'push', label: '앱 푸시', iconKey: 'push', enabled: true },
    { key: 'teams', label: 'Microsoft Teams', iconKey: 'teams', enabled: false },
    { key: 'slack', label: 'Slack', iconKey: 'slack', enabled: false },
  ],
}

export function NotificationChannelsTab({ companyId }: Props) {
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<NotificationChannelsSetting>({
    category: 'system',
    key: 'notification-channels',
    companyId,
    defaults: DEFAULTS,
    description: '알림 채널 설정',
    merge: (raw, defs) => ({
      channels: Array.isArray(raw.channels) ? (raw.channels as NotificationChannelEntry[]) : defs.channels,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  const toggle = (i: number) => {
    const next = structuredClone(settings)
    next.channels[i].enabled = !next.channels[i].enabled
    setSettings(next)
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">알림 채널</h3>
          <p className="text-sm text-[#8181A5]">이메일/Teams/앱 푸시 채널 설정</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">법인 오버라이드</span>
        )}
      </div>
      <div className="space-y-3">{settings.channels.map((ch, i) => {
        const Icon = ICON_MAP[ch.iconKey] ?? Bell
        return (
          <div key={ch.key} className="flex items-center gap-4 rounded-lg border border-[#F0F0F3] p-4 hover:bg-[#F5F5FA] transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5E81F4]/10"><Icon className="h-5 w-5 text-[#5E81F4]" /></div>
            <div className="flex-1"><span className="text-sm font-medium text-[#1C1D21]">{ch.label}</span></div>
            <button onClick={() => toggle(i)} className={`relative h-6 w-11 rounded-full transition-colors ${ch.enabled ? 'bg-[#5E81F4]' : 'bg-[#F0F0F3]'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${ch.enabled ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        )
      })}</div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={revert} disabled={!hasChanges}>
          <RotateCcw className="mr-2 h-4 w-4" />되돌리기
        </Button>
        <Button className="bg-[#5E81F4] text-white hover:bg-[#4A6FE0]" onClick={save} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}저장
        </Button>
      </div>
    </div>
  )
}
