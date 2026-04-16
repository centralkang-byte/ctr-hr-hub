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

interface ProbationSettings {
  evalTimings: number[]
  passingScore: number
  autoConfirm: boolean
}

const DEFAULTS: ProbationSettings = { evalTimings: [30, 60, 90], passingScore: 70, autoConfirm: true }

export function ProbationEvalTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<ProbationSettings>({
    category: 'onboarding',
    key: 'probation-eval',
    companyId,
    defaults: DEFAULTS,
    description: t('probationEval_settings'),
    merge: (raw, defs) => ({
      evalTimings: Array.isArray(raw.evalTimings) ? (raw.evalTimings as number[]) : defs.evalTimings,
      passingScore: (raw.passingScore as number) ?? defs.passingScore,
      autoConfirm: typeof raw.autoConfirm === 'boolean' ? raw.autoConfirm : defs.autoConfirm,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('probationEval.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('probation_keca491_evaluation_kec8b9cec_kebb08f_keab8b0ec_settings')}</p>
        </div>
        {isOverridden && (
          <Badge variant="warning">{t('company_kec98a4eb')}</Badge>
        )}
      </div>

      <SettingFieldWithOverride label={t('probationEval.evalTimingLabel')} description={t('probationEval.evalTimingDesc')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">{settings.evalTimings.map((d, i) => (
          <Badge key={i} variant="info">{t('probationEval.dayN', { day: d })}</Badge>
        ))}</div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('probationEval.passingScoreLabel')} description={t('probationEval.passingScoreDesc')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.passingScore} min={0} max={100} onChange={(e) => setSettings((p) => ({ ...p, passingScore: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-muted-foreground">{t('kr_keca090_kec9db4ec')}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('probationEval.autoConfirmLabel')} description={t('probationEval.autoConfirmDesc')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.autoConfirm} onChange={(e) => setSettings((p) => ({ ...p, autoConfirm: e.target.checked }))} className="h-4 w-4 rounded border-border text-primary" />
          <span className="text-foreground">{t('passed_kec8b9c_kec9e90eb_keca084ed')}</span>
        </label>
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
