'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Props { companyId: string | null }

interface DistSettings {
  guidePcts: number[]
  forced: boolean
  minParticipants: number
}

const DEFAULTS: DistSettings = { guidePcts: [10, 30, 50, 10], forced: false, minParticipants: 10 }
const GRADE_LABELS = ['E (탁월)', 'M+ (우수)', 'M (보통)', 'B (미흡)']

export function DistributionTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<DistSettings>({
    category: 'performance',
    key: 'calibration-distribution',
    companyId,
    defaults: DEFAULTS,
    description: t('kr_kebb0b0eb_keab080ec_settings'),
    merge: (raw, defs) => ({
      guidePcts: Array.isArray(raw.guidePcts) ? (raw.guidePcts as number[]) : defs.guidePcts,
      forced: typeof raw.forced === 'boolean' ? raw.forced : !!raw.enforced,
      minParticipants: (raw.minParticipants as number) ?? defs.minParticipants,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('kr_kebb0b0eb_keab080ec')}</h3>
          <p className="text-sm text-muted-foreground">{t('kr_keb93b1ea_recommended_kebb0b0e')}</p>
        </div>
        {isOverridden && (
          <Badge variant="warning">{t('company_kec98a4eb')}</Badge>
        )}
      </div>

      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}><thead><tr className={TABLE_STYLES.header}>
          <th className={TABLE_STYLES.headerCell}>{t('kr_keb93b1ea')}</th>
          <th className={TABLE_STYLES.headerCellRight}>{t('recommended_rate')}</th>
        </tr></thead><tbody className="divide-y divide-border">{settings.guidePcts.map((pct, i) => (
          <tr key={i} className={TABLE_STYLES.row}>
            <td className={TABLE_STYLES.cell}>{GRADE_LABELS[i]}</td>
            <td className="px-4 py-3 text-right"><Input type="number" value={pct} min={0} max={100} onChange={(e) => { const next = structuredClone(settings); next.guidePcts[i] = Number(e.target.value); setSettings(next) }} className="ml-auto w-20 text-right" /></td>
          </tr>
        ))}</tbody></table>
      </div>
      <div className="text-right text-sm text-muted-foreground">{t('distribution.total', { pct: settings.guidePcts.reduce((a, b) => a + b, 0) })}</div>

      <SettingFieldWithOverride label={t('distribution.forcedLabel')} description={t('distribution.forcedDesc')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.forced} onChange={(e) => setSettings((p) => ({ ...p, forced: e.target.checked }))} className="h-4 w-4 rounded border-border text-primary" />
          <span className="text-foreground">{t('kr_keab095ec_kebb0b0eb_keca081ec')}</span>
        </label>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('distribution.minParticipantsLabel')} description={t('distribution.minParticipantsDesc')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.minParticipants} onChange={(e) => setSettings((p) => ({ ...p, minParticipants: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-muted-foreground">{t('persons_kec9db4ec')}</span>
        </div>
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
