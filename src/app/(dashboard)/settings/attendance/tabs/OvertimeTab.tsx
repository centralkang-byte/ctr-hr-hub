'use client'

// ═══════════════════════════════════════════════════════════
// Tab 6: Overtime — 초과근무 수당 배율 설정
// API: No OvertimeRule model exists → form layout + TODO
// Uses AttendanceSetting for basic overtime toggles
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Loader2, Save, AlertTriangle } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface OvertimeTabProps {
  companyId: string | null
}

// Settings-connected: overtime pre-approval requirement (ATTENDANCE/overtime)
// Settings-connected: overtime pay multipliers (regular/night/holiday)
// Settings-connected: country-level overtime rate overrides

// Reference rates by country (GP#3 design spec section 11):
// KR: 연장 1.5x, 야간 +0.5x, 휴일 1.5x
// RU: 연장 2.0x
// VN: 야간 +0.3x
// MX: 연장 2.0x, 야간 +0.25x

interface OvertimeRate {
  label: string
  description: string
  rate: number
  unit: string
}

export function OvertimeTab({
  companyId }: OvertimeTabProps) {
  const t = useTranslations('settings')
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({
    requirePreApproval: true,
    nightStart: '22:00',
    nightEnd: '06:00',
  })
  const [rates, setRates] = useState<OvertimeRate[]>([
    { label: t('overtime_keca3bcea'), description: t('kr_kebb295ec_kecb488ea_kec8b9c'), rate: 1.5, unit: t('kr_kebb0b0') },
    { label: t('kr_kec95bcea'), description: t('kr_22_00_06_00_keab7bceb_kec8b9c'), rate: 0.5, unit: t('kr_kebb0b0_keab080ec') },
    { label: t('kr_ked9cb4ec'), description: t('kr_kebb295ec_holidays_kebb08f_kec'), rate: 1.5, unit: t('kr_kebb0b0') },
  ])

  useEffect(() => {
    // Try loading from AttendanceSetting 
    setLoading(true)
    apiClient.get('/api/v1/settings/attendance')
      .then(() => {
        // AttendanceSetting doesn't have overtime fields yet
        // Keep defaults
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" />
      </div>
    )
  }

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
        status={companyId ? 'custom' : 'global'}
        companySelected={!!companyId}
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.requirePreApproval}
            onChange={(e) => setSettings((p) => ({ ...p, requirePreApproval: e.target.checked }))}
            className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]"
          />
          <span className="text-[#1C1D21]">{t('kr_kec82acec_approve_ked999cec')}</span>
        </label>
      </SettingFieldWithOverride>

      {/* 야간근무 시간대 */}
      <SettingFieldWithOverride
        label="야간근무 시간대"
        description="야간근무 수당이 적용되는 시간대"
        status="global"
        companySelected={!!companyId}
      >
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={settings.nightStart}
            onChange={(e) => setSettings((p) => ({ ...p, nightStart: e.target.value }))}
            className="w-32"
          />
          <span className="text-sm text-[#8181A5]">~</span>
          <Input
            type="time"
            value={settings.nightEnd}
            onChange={(e) => setSettings((p) => ({ ...p, nightEnd: e.target.value }))}
            className="w-32"
          />
        </div>
      </SettingFieldWithOverride>

      {/* 수당 배율 테이블 */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-[#1C1D21]">{t('kr_kec8898eb_keab384ec_kebb0b0ec')}</h4>
        <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
          <table className="w-full">
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>{t('kr_keab7bceb_kec9ca0ed')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('description')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_kebb0b0ec')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_keb8ba8ec')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F3]">
              {rates.map((rate, idx) => (
                <tr key={idx} className={TABLE_STYLES.row}>
                  <td className={TABLE_STYLES.cell}>{rate.label}</td>
                  <td className={TABLE_STYLES.cellMuted}>{rate.description}</td>
                  <td className="px-4 py-3 text-center">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={rate.rate}
                      onChange={(e) => {
                        const newRates = [...rates]
                        newRates[idx] = { ...rate, rate: Number(e.target.value) }
                        setRates(newRates)
                      }}
                      className="mx-auto w-20 text-center"
                    />
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-[#8181A5]">{rate.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 법인별 참고 배율 */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-[#1C1D21]">{t('company_kebb384_kecb0b8ea_kebb0b0ec')}</h4>
        <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
          <table className="w-full text-sm">
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>{t('company')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_kec97b0ec')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_kec95bcea_keab080ec')}</th>
                <th className={TABLE_STYLES.headerCell}>휴일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F3]">
              <tr className="bg-primary/5">
                <td className={TABLE_STYLES.cell}>🇰🇷 CTR-KR</td>
                <td className={TABLE_STYLES.cell}>{t('kr_1_5kebb0b0')}</td>
                <td className={TABLE_STYLES.cell}>{t('kr_0_5kebb0b0')}</td>
                <td className={TABLE_STYLES.cell}>{t('kr_1_5kebb0b0')}</td>
              </tr>
              <tr>
                <td className={TABLE_STYLES.cell}>🇺🇸 CTR-US</td>
                <td className={TABLE_STYLES.cell}>{t('kr_1_5kebb0b0')}</td>
                <td className="px-4 py-2 text-center text-[#8181A5]">—</td>
                <td className={TABLE_STYLES.cell}>{t('kr_1_5kebb0b0')}</td>
              </tr>
              <tr>
                <td className={TABLE_STYLES.cell}>🇷🇺 CTR-RU</td>
                <td className="px-4 py-2 text-center text-orange-600 font-medium">{t('kr_2_0kebb0b0')}</td>
                <td className={TABLE_STYLES.cell}>{t('kr_0_5kebb0b0')}</td>
                <td className={TABLE_STYLES.cell}>{t('kr_2_0kebb0b0')}</td>
              </tr>
              <tr>
                <td className={TABLE_STYLES.cell}>🇻🇳 CTR-VN</td>
                <td className={TABLE_STYLES.cell}>{t('kr_1_5kebb0b0')}</td>
                <td className="px-4 py-2 text-center text-orange-600 font-medium">{t('kr_0_3kebb0b0')}</td>
                <td className={TABLE_STYLES.cell}>{t('kr_2_0kebb0b0')}</td>
              </tr>
              <tr>
                <td className={TABLE_STYLES.cell}>🇲🇽 CTR-MX</td>
                <td className="px-4 py-2 text-center text-orange-600 font-medium">{t('kr_2_0kebb0b0')}</td>
                <td className="px-4 py-2 text-center text-orange-600 font-medium">{t('kr_0_25kebb0b0')}</td>
                <td className={TABLE_STYLES.cell}>{t('kr_2_0kebb0b0')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[#8181A5]">
          * 위 참고 배율은 각국 근로기준법 기본값입니다. 법인별 CompanySelector를 통해 오버라이드할 수 있습니다.
        </p>
      </div>

      <div className="flex justify-end pt-4">
        <Button className={BUTTON_VARIANTS.primary}>
          <Save className="mr-2 h-4 w-4" />
          {t('save')}
        </Button>
      </div>
    </div>
  )
}
