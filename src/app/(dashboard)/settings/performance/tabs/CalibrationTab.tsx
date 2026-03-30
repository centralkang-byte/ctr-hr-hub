'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import { BUTTON_VARIANTS,  FORM_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Props { companyId: string | null }

interface CalibSettings {
  required: boolean
  scope: 'DEPARTMENT' | 'DIVISION' | 'COMPANY'
  minParticipants: number
  allowManagerOverride: boolean
}

const DEFAULTS: CalibSettings = { required: true, scope: 'DEPARTMENT', minParticipants: 5, allowManagerOverride: false }

export function CalibrationTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<CalibSettings>({
    category: 'performance',
    key: 'calibration-rules',
    companyId,
    defaults: DEFAULTS,
    description: t('calibration_settings'),
    merge: (raw, defs) => ({
      required: typeof raw.required === 'boolean' ? raw.required : defs.required,
      scope: (raw.scope as CalibSettings['scope']) ?? defs.scope,
      minParticipants: (raw.minParticipants as number) ?? defs.minParticipants,
      allowManagerOverride: typeof raw.allowManagerOverride === 'boolean' ? raw.allowManagerOverride : defs.allowManagerOverride,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('calibration')}</h3>
          <p className="text-sm text-muted-foreground">{t('kr_keb93b1ea_keca1b0ec_ked9a8cec_')}</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">{t('company_kec98a4eb')}</span>
        )}
      </div>

      <SettingFieldWithOverride label="캘리브레이션 필수" description="평가 프로세스에서 캘리브레이션 단계를 필수로 할지" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.required} onChange={(e) => setSettings((p) => ({ ...p, required: e.target.checked }))} className="h-4 w-4 rounded border-border text-primary" />
          <span className="text-foreground">{t('calibration_required')}</span>
        </label>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="참여 범위" description="캘리브레이션 회의 단위" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <select className={FORM_STYLES.select} value={settings.scope} onChange={(e) => setSettings((p) => ({ ...p, scope: e.target.value as CalibSettings['scope'] }))}>
          <option value="DEPARTMENT">{t('department_keb8ba8ec')}</option>
          <option value="DIVISION">{t('kr_kebb3b8eb_keb8ba8ec')}</option>
          <option value="COMPANY">{t('company_all')}</option>
        </select>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="최소 참여 인원" description="캘리브레이션 대상 최소 인원 수" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.minParticipants} onChange={(e) => setSettings((p) => ({ ...p, minParticipants: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-muted-foreground">{t('persons_kec9db4ec')}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="관리자 직접 변경 허용" description="캘리브레이션 없이 관리자가 등급 직접 변경 가능" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.allowManagerOverride} onChange={(e) => setSettings((p) => ({ ...p, allowManagerOverride: e.target.checked }))} className="h-4 w-4 rounded border-border text-primary" />
          <span className="text-foreground">{t('kr_keca781ec_kebb380ea_ked9788ec')}</span>
        </label>
      </SettingFieldWithOverride>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={revert} disabled={!hasChanges}>
          <RotateCcw className="mr-2 h-4 w-4" />{t('kr_keb9098eb')}
        </Button>
        <Button className={BUTTON_VARIANTS.primary} onClick={save} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}저장
        </Button>
      </div>
    </div>
  )
}
