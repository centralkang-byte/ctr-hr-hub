'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'

interface Props { companyId: string | null }

interface CfrSettings {
  minFrequency: number
  anonymous: boolean
  reminderDays: number
  feedbackCategories: string[]
}

const DEFAULTS: CfrSettings = { minFrequency: 2, anonymous: false, reminderDays: 7, feedbackCategories: ['업무성과', '협업/소통', '리더십', '성장/발전'] }

export function CfrTab({ companyId }: Props) {
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<CfrSettings>({
    category: 'performance',
    key: 'cfr-settings',
    companyId,
    defaults: DEFAULTS,
    description: 'CFR 설정',
    merge: (raw, defs) => ({
      minFrequency: (raw.minFrequency as number) ?? defs.minFrequency,
      anonymous: typeof raw.anonymous === 'boolean' ? raw.anonymous : defs.anonymous,
      reminderDays: (raw.reminderDays as number) ?? defs.reminderDays,
      feedbackCategories: Array.isArray(raw.feedbackCategories) ? (raw.feedbackCategories as string[]) : defs.feedbackCategories,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">CFR 설정</h3>
          <p className="text-sm text-[#8181A5]">Continuous Feedback &amp; Recognition 주기 및 피드백 설정</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">법인 오버라이드</span>
        )}
      </div>

      <SettingFieldWithOverride label="1:1 최소 빈도" description="월간 최소 1:1 면담 횟수" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#8181A5]">월</span>
          <Input type="number" value={settings.minFrequency} min={1} max={10} onChange={(e) => setSettings((p) => ({ ...p, minFrequency: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-[#8181A5]">회 이상</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="피드백 익명 여부" description="동료 피드백 익명 허용" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.anonymous} onChange={(e) => setSettings((p) => ({ ...p, anonymous: e.target.checked }))} className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]" />
          <span className="text-[#1C1D21]">익명 피드백 허용</span>
        </label>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="리마인더" description="1:1 미완료 시 알림 주기" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.reminderDays} onChange={(e) => setSettings((p) => ({ ...p, reminderDays: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-[#8181A5]">일마다 리마인더</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="피드백 카테고리" description="사용 가능한 피드백 분류" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex flex-wrap gap-2">{settings.feedbackCategories.map((cat, i) => (
          <span key={i} className="rounded-full bg-[#5E81F4]/10 px-3 py-1 text-sm font-medium text-[#5E81F4]">{cat}</span>
        ))}</div>
      </SettingFieldWithOverride>

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
