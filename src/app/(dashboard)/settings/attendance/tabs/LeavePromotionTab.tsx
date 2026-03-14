'use client'

// ═══════════════════════════════════════════════════════════
// Tab 4: Leave Promotion — 연차촉진 알림 설정
// API: 현재 하드코딩 (leave-yearend-burn.rule.ts)
//      → H-2a: UI 폼 구축 / 실제 연결은 H-2c
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { Save, Bell, AlertTriangle } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface LeavePromotionTabProps {
  companyId: string | null
}

// Settings-connected: leave promotion notification start date (ATTENDANCE/leave-promotion)
// Settings-connected: leave promotion notification interval
// Settings-connected: leave promotion max notification count
// Settings-connected: unused leave expiry rules

export function LeavePromotionTab({ companyId }: LeavePromotionTabProps) {
  const [settings, setSettings] = useState({
    promotionStartMonth: 11,
    promotionStartDay: 1,
    notifyIntervalDays: 7,
    maxNotifications: 3,
    expiryPolicy: 'year_end' as 'year_end' | 'carry_then_expire',
    expiryWarningDays: 30,
    autoNotify: true,
    includeManager: true,
    includeHR: false,
  })

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1C1D21]">연차촉진</h3>
        <p className="text-sm text-[#8181A5]">
          미사용 연차 소진 알림 및 소멸 규칙 설정
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-[#5E81F4]/20 bg-[#5E81F4]/5 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#5E81F4]" />
        <p className="text-xs text-[#8181A5]">
          연차촉진 규칙은 현재 시스템에 하드코딩되어 있습니다. 이 설정 화면은 H-2c에서 실제 시스템과 연결됩니다.
        </p>
      </div>

      {/* 알림 시작 시점 */}
      <SettingFieldWithOverride
        label="알림 시작 시점"
        description="연말 연차촉진 알림을 시작할 시점"
        status="global"
        companySelected={!!companyId}
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={12}
            value={settings.promotionStartMonth}
            onChange={(e) => setSettings((p) => ({ ...p, promotionStartMonth: Number(e.target.value) }))}
            className="w-16"
          />
          <span className="text-sm text-[#8181A5]">월</span>
          <Input
            type="number"
            min={1}
            max={31}
            value={settings.promotionStartDay}
            onChange={(e) => setSettings((p) => ({ ...p, promotionStartDay: Number(e.target.value) }))}
            className="w-16"
          />
          <span className="text-sm text-[#8181A5]">일 부터</span>
        </div>
      </SettingFieldWithOverride>

      {/* 알림 간격 */}
      <SettingFieldWithOverride
        label="알림 간격"
        description="연차촉진 알림 발송 주기"
        status="global"
        companySelected={!!companyId}
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={30}
            value={settings.notifyIntervalDays}
            onChange={(e) => setSettings((p) => ({ ...p, notifyIntervalDays: Number(e.target.value) }))}
            className="w-20"
          />
          <span className="text-sm text-[#8181A5]">일마다 발송</span>
        </div>
      </SettingFieldWithOverride>

      {/* 최대 알림 횟수 */}
      <SettingFieldWithOverride
        label="최대 알림 횟수"
        description="연차촉진 알림 최대 발송 횟수"
        status="global"
        companySelected={!!companyId}
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={10}
            value={settings.maxNotifications}
            onChange={(e) => setSettings((p) => ({ ...p, maxNotifications: Number(e.target.value) }))}
            className="w-20"
          />
          <span className="text-sm text-[#8181A5]">회</span>
        </div>
      </SettingFieldWithOverride>

      {/* 수신자 설정 */}
      <SettingFieldWithOverride
        label="알림 수신자"
        description="연차촉진 알림을 받을 대상"
        status="global"
        companySelected={!!companyId}
      >
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={true}
              disabled
              className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]"
            />
            <span className="text-[#1C1D21]">본인 (필수)</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.includeManager}
              onChange={(e) => setSettings((p) => ({ ...p, includeManager: e.target.checked }))}
              className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]"
            />
            <span className="text-[#1C1D21]">직속 상사</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.includeHR}
              onChange={(e) => setSettings((p) => ({ ...p, includeHR: e.target.checked }))}
              className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]"
            />
            <span className="text-[#1C1D21]">HR 담당자</span>
          </label>
        </div>
      </SettingFieldWithOverride>

      {/* 미사용 연차 소멸 규칙 */}
      <SettingFieldWithOverride
        label="미사용 연차 소멸"
        description="연말 미사용 연차의 처리 방식"
        status="global"
        companySelected={!!companyId}
      >
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="expiryPolicy"
              checked={settings.expiryPolicy === 'year_end'}
              onChange={() => setSettings((p) => ({ ...p, expiryPolicy: 'year_end' }))}
              className="h-4 w-4 text-[#5E81F4]"
            />
            <span className="text-[#1C1D21]">연말 소멸</span>
            <span className="text-xs text-[#8181A5]">— 12/31에 잔여 연차 전액 소멸</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="expiryPolicy"
              checked={settings.expiryPolicy === 'carry_then_expire'}
              onChange={() => setSettings((p) => ({ ...p, expiryPolicy: 'carry_then_expire' }))}
              className="h-4 w-4 text-[#5E81F4]"
            />
            <span className="text-[#1C1D21]">이월 후 소멸</span>
            <span className="text-xs text-[#8181A5]">— 이월 규칙에 따라 이월 후 잔여분 소멸</span>
          </label>
        </div>
      </SettingFieldWithOverride>

      {/* 소멸 전 경고 */}
      <SettingFieldWithOverride
        label="소멸 경고 알림"
        description="연차 소멸 전 경고 알림 발송 시점"
        status="global"
        companySelected={!!companyId}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#8181A5]">소멸</span>
          <Input
            type="number"
            min={1}
            max={90}
            value={settings.expiryWarningDays}
            onChange={(e) => setSettings((p) => ({ ...p, expiryWarningDays: Number(e.target.value) }))}
            className="w-20"
          />
          <span className="text-sm text-[#8181A5]">일 전 경고</span>
        </div>
      </SettingFieldWithOverride>

      <div className="flex justify-end pt-4">
        <Button className={BUTTON_VARIANTS.primary}>
          <Save className="mr-2 h-4 w-4" />
          저장
        </Button>
      </div>
    </div>
  )
}
