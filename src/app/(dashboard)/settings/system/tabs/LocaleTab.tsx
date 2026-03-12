'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import type { LocaleSetting } from '@/types/process-settings'

interface Props { companyId: string | null }

const DEFAULTS: LocaleSetting = {
  defaultLocale: 'ko',
  defaultTimezone: 'Asia/Seoul',
  supportedLocales: ['ko', 'en', 'zh', 'ru', 'vi', 'es'],
}

const LOCALE_LABELS: Record<string, string> = { ko: '한국어', en: 'English', zh: '中文', ru: 'Русский', vi: 'Tiếng Việt', es: 'Español' }

export function LocaleTab({ companyId }: Props) {
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<LocaleSetting>({
    category: 'system',
    key: 'locale',
    companyId,
    defaults: DEFAULTS,
    description: '법인별 기본 언어 및 타임존 설정',
    merge: (raw, defs) => ({
      defaultLocale: (raw.defaultLocale as string) ?? defs.defaultLocale,
      defaultTimezone: (raw.defaultTimezone as string) ?? defs.defaultTimezone,
      supportedLocales: Array.isArray(raw.supportedLocales) ? (raw.supportedLocales as string[]) : defs.supportedLocales,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">언어/타임존</h3>
          <p className="text-sm text-[#8181A5]">법인별 기본 언어 및 타임존 설정</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">법인 오버라이드</span>
        )}
      </div>

      <SettingFieldWithOverride label="기본 언어" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <select className="rounded-xl border border-[#F0F0F3] px-3 py-2 text-sm" value={settings.defaultLocale} onChange={(e) => setSettings((p) => ({ ...p, defaultLocale: e.target.value }))}>
          {settings.supportedLocales.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l] ?? l}</option>)}
        </select>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="기본 타임존" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <select className="rounded-xl border border-[#F0F0F3] px-3 py-2 text-sm" value={settings.defaultTimezone} onChange={(e) => setSettings((p) => ({ ...p, defaultTimezone: e.target.value }))}>
          <option value="Asia/Seoul">Asia/Seoul (KST, UTC+9)</option>
          <option value="America/New_York">America/New_York (EST, UTC-5)</option>
          <option value="Asia/Shanghai">Asia/Shanghai (CST, UTC+8)</option>
          <option value="Europe/Moscow">Europe/Moscow (MSK, UTC+3)</option>
          <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (ICT, UTC+7)</option>
          <option value="America/Mexico_City">America/Mexico_City (CST, UTC-6)</option>
        </select>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="지원 언어" status="global" companySelected={!!companyId}>
        <div className="flex flex-wrap gap-2">{settings.supportedLocales.map((l) => (
          <span key={l} className="rounded-full bg-[#5E81F4]/10 px-3 py-1 text-sm font-medium text-[#5E81F4]">{LOCALE_LABELS[l] ?? l}</span>
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
