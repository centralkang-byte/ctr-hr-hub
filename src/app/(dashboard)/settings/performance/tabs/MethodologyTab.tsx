'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import { BUTTON_VARIANTS } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Props { companyId: string | null }

interface MethodSettings {
  maxGoals: number
  weightSumRequired: boolean
  weightSum: number
  categories: string[]
  allowSelfWeight: boolean
}

const DEFAULTS: MethodSettings = {
  maxGoals: 5,
  weightSumRequired: true,
  weightSum: 100,
  categories: ['업무목표', '역량개발', '조직기여'],
  allowSelfWeight: false,
}

export function MethodologyTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<MethodSettings>({
    category: 'performance',
    key: 'methodology',
    companyId,
    defaults: DEFAULTS,
    description: t('evaluation_kebb0a9eb_settings'),
    merge: (raw, defs) => ({
      maxGoals: (raw.maxGoals as number) ?? defs.maxGoals,
      weightSumRequired: typeof raw.weightSumRequired === 'boolean' ? raw.weightSumRequired : defs.weightSumRequired,
      weightSum: (raw.weightSum as number) ?? defs.weightSum,
      categories: Array.isArray(raw.categories) ? (raw.categories as string[]) : defs.categories,
      allowSelfWeight: typeof raw.allowSelfWeight === 'boolean' ? raw.allowSelfWeight : defs.allowSelfWeight,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('evaluation_kebb0a9eb')}</h3>
          <p className="text-sm text-muted-foreground">{t('kr_mbo_bei_kebb984ec_goals_kec889')}</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">{t('company_kec98a4eb')}</span>
        )}
      </div>

      <SettingFieldWithOverride label="최대 목표 수" description="직원 1인당 설정 가능한 최대 목표 개수" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.maxGoals} min={1} max={20} onChange={(e) => setSettings((p) => ({ ...p, maxGoals: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-muted-foreground">{t('kr_keab09c')}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="가중치 합계 검증" description="목표 가중치의 합이 반드시 100%여야 하는지" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.weightSumRequired} onChange={(e) => setSettings((p) => ({ ...p, weightSumRequired: e.target.checked }))} className="h-4 w-4 rounded border-border text-primary" />
          <span className="text-foreground">가중치 합계 {settings.weightSum}% 필수</span>
        </label>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="목표 카테고리" description="사용 가능한 목표 분류 항목" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex flex-wrap gap-2">
          {settings.categories.map((cat, i) => (
            <span key={i} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">{cat}</span>
          ))}
        </div>
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
