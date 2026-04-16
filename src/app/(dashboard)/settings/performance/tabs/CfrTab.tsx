'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import { BUTTON_VARIANTS } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Props { companyId: string | null }

interface CfrSettings {
  minFrequency: number
  anonymous: boolean
  reminderDays: number
  feedbackCategories: string[]
}

const DEFAULTS: CfrSettings = { minFrequency: 2, anonymous: false, reminderDays: 7, feedbackCategories: ['업무성과', '협업/소통', '리더십', '성장/발전'] }

export function CfrTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<CfrSettings>({
    category: 'performance',
    key: 'cfr-settings',
    companyId,
    defaults: DEFAULTS,
    description: t('cfr_settings'),
    merge: (raw, defs) => ({
      minFrequency: (raw.minFrequency as number) ?? defs.minFrequency,
      anonymous: typeof raw.anonymous === 'boolean' ? raw.anonymous : defs.anonymous,
      reminderDays: (raw.reminderDays as number) ?? defs.reminderDays,
      feedbackCategories: Array.isArray(raw.feedbackCategories) ? (raw.feedbackCategories as string[]) : defs.feedbackCategories,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('cfr_settings')}</h3>
          <p className="text-sm text-muted-foreground">{t('kr_continuous_feedback_amp_recogn')}</p>
        </div>
        {isOverridden && (
          <Badge variant="warning">{t('company_kec98a4eb')}</Badge>
        )}
      </div>

      <SettingFieldWithOverride label={t('cfr.minFreqLabel')} description={t('cfr.minFreqDesc')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('month')}</span>
          <Input type="number" value={settings.minFrequency} min={1} max={10} onChange={(e) => setSettings((p) => ({ ...p, minFrequency: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-muted-foreground">{t('kr_ked9a8c_kec9db4ec')}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('cfr.anonymousLabel')} description={t('cfr.anonymousDesc')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.anonymous} onChange={(e) => setSettings((p) => ({ ...p, anonymous: e.target.checked }))} className="h-4 w-4 rounded border-border text-primary" />
          <span className="text-foreground">{t('kr_kec9db5eb_ked94bceb_ked9788ec')}</span>
        </label>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('cfr.reminderLabel')} description={t('cfr.reminderDesc')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.reminderDays} onChange={(e) => setSettings((p) => ({ ...p, reminderDays: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-muted-foreground">{t('kr_kec9dbceb_keba6aceb')}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('cfr.categoriesLabel')} description={t('cfr.categoriesDesc')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex flex-wrap gap-2">{settings.feedbackCategories.map((cat, i) => (
          <Badge key={i} variant="info">{cat}</Badge>
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
