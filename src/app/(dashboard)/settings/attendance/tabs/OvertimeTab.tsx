'use client'

// ═══════════════════════════════════════════════════════════
// Tab 6: Overtime — 초과근무 수당 배율 설정
// Connected to: ATTENDANCE/overtime-rules via useProcessSetting
// S-Fix-3: Full CRUD implementation
// ═══════════════════════════════════════════════════════════

import { Loader2, Save, AlertTriangle, RotateCcw } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'
import { useProcessSetting } from '@/hooks/useProcessSetting'

interface OvertimeTabProps {
  companyId: string | null
}

interface OvertimeSettings {
  requiresApproval: boolean
  multipliers: {
    weekdayOt: number
    weekend: number
    holiday: number
    night: number
  }
  nightStartHour: number
  nightEndHour: number
}

const DEFAULT_SETTINGS: OvertimeSettings = {
  requiresApproval: true,
  multipliers: {
    weekdayOt: 1.5,
    weekend: 1.5,
    holiday: 2.0,
    night: 0.5,
  },
  nightStartHour: 22,
  nightEndHour: 6,
}

// Country reference rates (from laborConfig, read-only)
const COUNTRY_RATES = [
  { flag: '🇰🇷', code: 'CTR', weekday: 1.5, night: 0.5, holiday: 1.5 },
  { flag: '🇨🇳', code: 'CTR-CN', weekday: 1.5, night: 0, holiday: 3.0 },
  { flag: '🇺🇸', code: 'CTR-US', weekday: 1.5, night: 0, holiday: 1.5 },
  { flag: '🇻🇳', code: 'CTR-VN', weekday: 2.0, night: 0.3, holiday: 3.0 },
  { flag: '🇷🇺', code: 'CTR-RU', weekday: 1.5, night: 0.2, holiday: 2.0 },
  // CTR-MX removed (→ CTR-US Location)
  { flag: '🇪🇺', code: 'CTR-EU', weekday: 1.5, night: 0, holiday: 2.0 },
] as const

export function OvertimeTab({ companyId }: OvertimeTabProps) {
  const t = useTranslations('settings')

  const {
    settings,
    setSettings,
    loading,
    saving,
    isOverridden,
    hasChanges,
    save,
    revert,
  } = useProcessSetting<OvertimeSettings>({
    category: 'attendance',
    key: 'overtime-rules',
    companyId,
    defaults: DEFAULT_SETTINGS,
    description: '초과근무 관리 규칙',
    merge: (raw, defaults) => ({
      requiresApproval: (raw.requiresApproval as boolean) ?? defaults.requiresApproval,
      multipliers: {
        weekdayOt: ((raw.multipliers as Record<string, number>)?.weekdayOt as number) ?? defaults.multipliers.weekdayOt,
        weekend: ((raw.multipliers as Record<string, number>)?.weekend as number) ?? defaults.multipliers.weekend,
        holiday: ((raw.multipliers as Record<string, number>)?.holiday as number) ?? defaults.multipliers.holiday,
        night: ((raw.multipliers as Record<string, number>)?.night as number) ?? defaults.multipliers.night,
      },
      nightStartHour: (raw.nightStartHour as number) ?? defaults.nightStartHour,
      nightEndHour: (raw.nightEndHour as number) ?? defaults.nightEndHour,
    }),
  })

  const updateMultiplier = (key: keyof OvertimeSettings['multipliers'], value: number) => {
    setSettings((prev) => ({
      ...prev,
      multipliers: { ...prev.multipliers, [key]: value },
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" />
      </div>
    )
  }

  const rateRows: { key: keyof OvertimeSettings['multipliers']; label: string; desc: string }[] = [
    { key: 'weekdayOt', label: t('overtime_keca3bcea'), desc: '평일 법정근로시간 초과 시' },
    { key: 'weekend', label: '휴일근로', desc: '주말/휴일 근무 시' },
    { key: 'holiday', label: '공휴일근로', desc: '법정 공휴일 근무 시' },
    { key: 'night', label: '야간 할증', desc: '야간근무 시간대 가산' },
  ]

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1C1D21]">{t('kr_kecb488ea')}</h3>
        <p className="text-sm text-[#8181A5]">
          {t('kr_kec82acec_kec8898eb_kebb0b0ec_')}
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div>
          <p className="text-xs font-medium text-amber-800">{t('company_kebb384_kec8898eb_kebb0b0ec_keb8ba4eb')}</p>
          <p className="mt-0.5 text-xs text-amber-700">
            {t('kr_kr_kec97b0ec_1_5kebb0b0_ru_2_0')}
          </p>
        </div>
      </div>

      {/* 사전 승인 */}
      <SettingFieldWithOverride
        label="사전 승인 필수"
        description="초과근무 전 관리자 승인을 필수로 요구합니다"
        status={isOverridden ? 'custom' : 'global'}
        companySelected={!!companyId}
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.requiresApproval}
            onChange={(e) => setSettings((p) => ({ ...p, requiresApproval: e.target.checked }))}
            className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]"
          />
          <span className="text-[#1C1D21]">{t('kr_kec82acec_approve_ked999cec')}</span>
        </label>
      </SettingFieldWithOverride>

      {/* 야간근무 시간대 */}
      <SettingFieldWithOverride
        label="야간근무 시간대"
        description="야간근무 수당이 적용되는 시간대"
        status={isOverridden ? 'custom' : 'global'}
        companySelected={!!companyId}
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={23}
            value={settings.nightStartHour}
            onChange={(e) => setSettings((p) => ({ ...p, nightStartHour: Number(e.target.value) }))}
            className="w-20 text-center"
          />
          <span className="text-sm text-[#8181A5]">시 ~</span>
          <Input
            type="number"
            min={0}
            max={23}
            value={settings.nightEndHour}
            onChange={(e) => setSettings((p) => ({ ...p, nightEndHour: Number(e.target.value) }))}
            className="w-20 text-center"
          />
          <span className="text-sm text-[#8181A5]">시</span>
        </div>
      </SettingFieldWithOverride>

      {/* 수당 배율 테이블 */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-[#1C1D21]">{t('kr_kec8898eb_keab384ec_kebb0b0ec')}</h4>
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>{t('kr_keab7bceb_kec9ca0ed')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('description')}</th>
                <th className={TABLE_STYLES.headerCell}>배율</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F3]">
              {rateRows.map((row) => (
                <tr key={row.key} className={TABLE_STYLES.row}>
                  <td className={TABLE_STYLES.cell}>{row.label}</td>
                  <td className={TABLE_STYLES.cellMuted}>{row.desc}</td>
                  <td className="px-4 py-3 text-center">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={settings.multipliers[row.key]}
                      onChange={(e) => updateMultiplier(row.key, Number(e.target.value))}
                      className="mx-auto w-20 text-center"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 법인별 참고 배율 */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-[#1C1D21]">{t('company_kebb384_kecb0b8ea_kebb0b0ec')}</h4>
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>{t('company')}</th>
                <th className={TABLE_STYLES.headerCell}>연장</th>
                <th className={TABLE_STYLES.headerCell}>야간 가산</th>
                <th className={TABLE_STYLES.headerCell}>휴일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F3]">
              {COUNTRY_RATES.map((cr) => (
                <tr key={cr.code} className={TABLE_STYLES.row}>
                  <td className={TABLE_STYLES.cell}>{cr.flag} {cr.code}</td>
                  <td className={TABLE_STYLES.cell}>{cr.weekday}x</td>
                  <td className={cr.night > 0 ? TABLE_STYLES.cell : 'px-4 py-2 text-center text-[#8181A5]'}>
                    {cr.night > 0 ? `+${cr.night}x` : '—'}
                  </td>
                  <td className={TABLE_STYLES.cell}>{cr.holiday}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[#8181A5]">
          * 위 참고 배율은 각국 근로기준법 기본값입니다. 법인별 CompanySelector를 통해 오버라이드할 수 있습니다.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4">
        {hasChanges && (
          <Button variant="outline" onClick={revert} disabled={saving}>
            <RotateCcw className="mr-2 h-4 w-4" />
            되돌리기
          </Button>
        )}
        <Button
          className={BUTTON_VARIANTS.primary}
          onClick={save}
          disabled={!hasChanges || saving}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {t('save')}
        </Button>
      </div>
    </div>
  )
}
