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
        <h3 className="text-base font-semibold text-[#1C1D21]">{t('probation')}</h3>
        <p className="text-sm text-[#8181A5]">{t('probation_evaluation_keab8b0ec_kec9e90eb_keca084ed_settings')}</p>
      </div>

      <SettingFieldWithOverride label="기본 수습 기간" description="신규 입사자의 기본 수습 기간" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.defaultDuration} onChange={(e) => setSettings((p) => ({ ...p, defaultDuration: Number(e.target.value) }))} className="w-24" />
          <span className="text-sm text-[#8181A5]">{t('kr_keab09cec')}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="평가 시점" description="수습 기간 중 평가를 실시할 시점" status="global" companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          {settings.evalTimings.map((d, i) => (
            <span key={i} className="rounded-full bg-[#5E81F4]/10 px-3 py-1 text-sm font-medium text-[#5E81F4]">{d}일차</span>
          ))}
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="자동 정규직 전환" description="수습 기간 종료 후 자동 정규직 전환 여부" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.autoConvert} onChange={(e) => setSettings((p) => ({ ...p, autoConvert: e.target.checked }))} className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]" />
          <span className="text-[#1C1D21]">{t('kr_kec8898ec_complete_kec8b9c_kec')}</span>
        </label>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="수습 연장" description="수습 기간 연장 허용 여부 및 최대 연장 기간" status="global" companySelected={!!companyId}>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.extendable} onChange={(e) => setSettings((p) => ({ ...p, extendable: e.target.checked }))} className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]" />
            <span className="text-[#1C1D21]">{t('kr_kec8898ec_kec97b0ec_ked9788ec')}</span>
          </label>
          {settings.extendable && (
            <div className="ml-6 flex items-center gap-2">
              <span className="text-sm text-[#8181A5]">{t('kr_kecb59ceb')}</span>
              <Input type="number" value={settings.maxExtension} onChange={(e) => setSettings((p) => ({ ...p, maxExtension: Number(e.target.value) }))} className="w-20" />
              <span className="text-sm text-[#8181A5]">{t('kr_keab09cec')}</span>
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
