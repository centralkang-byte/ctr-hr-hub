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
import { TABLE_STYLES } from '@/lib/styles'

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

export function OvertimeTab({ companyId }: OvertimeTabProps) {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({
    requirePreApproval: true,
    nightStart: '22:00',
    nightEnd: '06:00',
  })
  const [rates, setRates] = useState<OvertimeRate[]>([
    { label: '연장근무 (주간)', description: '법정근로시간 초과 시', rate: 1.5, unit: '배' },
    { label: '야간근무', description: '22:00~06:00 근무 시', rate: 0.5, unit: '배 가산' },
    { label: '휴일근무', description: '법정 공휴일 및 주말 근무 시', rate: 1.5, unit: '배' },
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
        <h3 className="text-base font-semibold text-[#1C1D21]">초과근무</h3>
        <p className="text-sm text-[#8181A5]">
          사전승인, 수당 배율, 야간근무 기준 설정
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div>
          <p className="text-xs font-medium text-amber-800">법인별 수당 배율이 다릅니다</p>
          <p className="mt-0.5 text-xs text-amber-700">
            KR: 연장 1.5배 / RU: 2.0배 / VN: 야간 +0.3배 / MX: 연장 2.0배
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
          <span className="text-[#1C1D21]">사전 승인 활성화</span>
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
        <h4 className="mb-3 text-sm font-semibold text-[#1C1D21]">수당 계산 배율</h4>
        <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
          <table className="w-full">
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>근무 유형</th>
                <th className={TABLE_STYLES.headerCell}>설명</th>
                <th className={TABLE_STYLES.headerCell}>배율</th>
                <th className={TABLE_STYLES.headerCell}>단위</th>
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
        <h4 className="mb-3 text-sm font-semibold text-[#1C1D21]">법인별 참고 배율</h4>
        <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
          <table className="w-full text-sm">
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>법인</th>
                <th className={TABLE_STYLES.headerCell}>연장</th>
                <th className={TABLE_STYLES.headerCell}>야간 가산</th>
                <th className={TABLE_STYLES.headerCell}>휴일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F3]">
              <tr className="bg-primary/5">
                <td className={TABLE_STYLES.cell}>🇰🇷 CTR-KR</td>
                <td className={TABLE_STYLES.cell}>1.5배</td>
                <td className={TABLE_STYLES.cell}>+0.5배</td>
                <td className={TABLE_STYLES.cell}>1.5배</td>
              </tr>
              <tr>
                <td className={TABLE_STYLES.cell}>🇺🇸 CTR-US</td>
                <td className={TABLE_STYLES.cell}>1.5배</td>
                <td className="px-4 py-2 text-center text-[#8181A5]">—</td>
                <td className={TABLE_STYLES.cell}>1.5배</td>
              </tr>
              <tr>
                <td className={TABLE_STYLES.cell}>🇷🇺 CTR-RU</td>
                <td className="px-4 py-2 text-center text-orange-600 font-medium">2.0배</td>
                <td className={TABLE_STYLES.cell}>+0.5배</td>
                <td className={TABLE_STYLES.cell}>2.0배</td>
              </tr>
              <tr>
                <td className={TABLE_STYLES.cell}>🇻🇳 CTR-VN</td>
                <td className={TABLE_STYLES.cell}>1.5배</td>
                <td className="px-4 py-2 text-center text-orange-600 font-medium">+0.3배</td>
                <td className={TABLE_STYLES.cell}>2.0배</td>
              </tr>
              <tr>
                <td className={TABLE_STYLES.cell}>🇲🇽 CTR-MX</td>
                <td className="px-4 py-2 text-center text-orange-600 font-medium">2.0배</td>
                <td className="px-4 py-2 text-center text-orange-600 font-medium">+0.25배</td>
                <td className={TABLE_STYLES.cell}>2.0배</td>
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
          저장
        </Button>
      </div>
    </div>
  )
}
