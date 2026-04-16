'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import type { LocaleSetting } from '@/types/process-settings'
import { BUTTON_VARIANTS,  FORM_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Props { companyId: string | null }

const DEFAULTS: LocaleSetting = {
  defaultLocale: 'ko',
  defaultTimezone: 'Asia/Seoul',
  supportedLocales: ['ko', 'en', 'zh', 'vi', 'es'],
}

const LOCALE_LABELS: Record<string, string> = { ko: '한국어', en: 'English', zh: '中文', ru: 'Русский', vi: 'Tiếng Việt', es: 'Español' }

export function LocaleTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<LocaleSetting>({
    category: 'system',
    key: 'locale',
    companyId,
    defaults: DEFAULTS,
    description: t('company_kebb384_keab8b0eb_kec96b8ec_kebb08f_ked8380ec_settings'),
    merge: (raw, defs) => ({
      defaultLocale: (raw.defaultLocale as string) ?? defs.defaultLocale,
      defaultTimezone: (raw.defaultTimezone as string) ?? defs.defaultTimezone,
      supportedLocales: Array.isArray(raw.supportedLocales) ? (raw.supportedLocales as string[]) : defs.supportedLocales,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('kr_kec96b8ec_ked8380ec')}</h3>
          <p className="text-sm text-muted-foreground">{t('company_kebb384_keab8b0eb_kec96b8ec_kebb08f_ked8380ec_settings')}</p>
        </div>
        {isOverridden && (
          <Badge variant="warning">{t('company_kec98a4eb')}</Badge>
        )}
      </div>

      <SettingFieldWithOverride label={t('locale.defaultLangLabel')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <select className={FORM_STYLES.select} value={settings.defaultLocale} onChange={(e) => setSettings((p) => ({ ...p, defaultLocale: e.target.value }))}>
          {settings.supportedLocales.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l] ?? l}</option>)}
        </select>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('locale.defaultTimezoneLabel')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <select className={FORM_STYLES.select} value={settings.defaultTimezone} onChange={(e) => setSettings((p) => ({ ...p, defaultTimezone: e.target.value }))}>
          <option value="Asia/Seoul">Asia/Seoul (KST, UTC+9)</option>
          <option value="America/New_York">America/New_York (EST, UTC-5)</option>
          <option value="Asia/Shanghai">Asia/Shanghai (CST, UTC+8)</option>
          <option value="Europe/Moscow">Europe/Moscow (MSK, UTC+3)</option>
          <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (ICT, UTC+7)</option>
          <option value="America/Mexico_City">America/Mexico_City (CST, UTC-6)</option>
        </select>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('locale.supportedLangsLabel')} status="global" companySelected={!!companyId}>
        <div className="flex flex-wrap gap-2">{settings.supportedLocales.map((l) => (
          <Badge key={l} variant="info">{LOCALE_LABELS[l] ?? l}</Badge>
        ))}</div>
      </SettingFieldWithOverride>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={revert} disabled={!hasChanges}>
          <RotateCcw className="mr-2 h-4 w-4" />{t('kr_keb9098eb')}
        </Button>
        <Button className={BUTTON_VARIANTS.primary} onClick={save} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{t('save')}
        </Button>
      </div>
    </div>
  )
}
