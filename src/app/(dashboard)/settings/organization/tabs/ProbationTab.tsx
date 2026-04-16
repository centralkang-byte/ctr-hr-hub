'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Props { companyId: string | null }

export function ProbationTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [settings, setSettings] = useState({
    defaultDuration: 3,
    evalTimings: [30, 60, 90],
    autoConvert: true,
    extendable: true,
    maxExtension: 3,
  })

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{t('probation.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('probation_evaluation_keab8b0ec_kec9e90eb_keca084ed_settings')}</p>
      </div>

      <SettingFieldWithOverride label={t('probation.durationLabel')} description={t('probation.durationDesc')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.defaultDuration} onChange={(e) => setSettings((p) => ({ ...p, defaultDuration: Number(e.target.value) }))} className="w-24" />
          <span className="text-sm text-muted-foreground">{t('kr_keab09cec')}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('probation.evalTimingLabel')} description={t('probation.evalTimingDesc')} status="global" companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          {settings.evalTimings.map((d, i) => (
            <span key={i} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">{t('probation.dayN', { day: d })}</span>
          ))}
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('probation.autoConvertLabel')} description={t('probation.autoConvertDesc')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.autoConvert} onChange={(e) => setSettings((p) => ({ ...p, autoConvert: e.target.checked }))} className="h-4 w-4 rounded border-border text-primary" />
          <span className="text-foreground">{t('kr_kec8898ec_complete_kec8b9c_kec')}</span>
        </label>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('probation.extensionLabel')} description={t('probation.extensionDesc')} status="global" companySelected={!!companyId}>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.extendable} onChange={(e) => setSettings((p) => ({ ...p, extendable: e.target.checked }))} className="h-4 w-4 rounded border-border text-primary" />
            <span className="text-foreground">{t('kr_kec8898ec_kec97b0ec_ked9788ec')}</span>
          </label>
          {settings.extendable && (
            <div className="ml-6 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('kr_kecb59ceb')}</span>
              <Input type="number" value={settings.maxExtension} onChange={(e) => setSettings((p) => ({ ...p, maxExtension: Number(e.target.value) }))} className="w-20" />
              <span className="text-sm text-muted-foreground">{t('kr_keab09cec')}</span>
            </div>
          )}
        </div>
      </SettingFieldWithOverride>

      <div className="flex justify-end pt-4">
        <Button className={BUTTON_VARIANTS.primary}><Save className="mr-2 h-4 w-4" />{t('save')}</Button>
      </div>
    </div>
  )
}
