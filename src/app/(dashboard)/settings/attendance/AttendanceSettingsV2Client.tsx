'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Settings V2 (H-2a: All 8 tabs working)
// Gold-standard reference for H-2b~d (Payroll, Performance, etc.)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Save } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { getCategoryConfig, type AttendanceTabSlug } from '@/components/settings/settings-config'
import { SettingsSubPageLayout } from '@/components/settings/SettingsSubPageLayout'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// Tab components (H-2a)
import { ShiftPatternsTab } from './tabs/ShiftPatternsTab'
import { LeaveTypesTab } from './tabs/LeaveTypesTab'
import { LeaveAccrualTab } from './tabs/LeaveAccrualTab'
import { LeavePromotionTab } from './tabs/LeavePromotionTab'
import { HolidaysTab } from './tabs/HolidaysTab'
import { OvertimeTab } from './tabs/OvertimeTab'
import { BUTTON_VARIANTS } from '@/lib/styles'

const config = getCategoryConfig('attendance')

// ─── Work Schedules Tab ──────────────────────────────────

function WorkSchedulesTab({ companyId }: { companyId: string | null }) {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({
    standardHoursPerDay: 8,
    standardDaysPerWeek: 5,
    lunchStartTime: '12:00',
    lunchEndTime: '13:00',
    flexEnabled: false,
  })

  useEffect(() => {
    setLoading(true)
    apiClient.get('/api/v1/settings/attendance').then((res) => {
      if (res.data) {
        const d = res.data as Record<string, unknown>
        setSettings((prev) => ({
          ...prev,
          standardHoursPerDay: (d.standardHoursPerDay as number) ?? 8,
          standardDaysPerWeek: (d.standardDaysPerWeek as number) ?? 5,
          flexEnabled: (d.flexWork as Record<string, unknown>)?.flexEnabled as boolean ?? false,
        }))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1C1D21]">{'근무 스케줄'}</h3>
        <p className="text-sm text-[#8181A5]">{'기본 근무시간, 점심시간, 유연근무 설정'}</p>
      </div>

      <SettingFieldWithOverride label="일일 소정근로시간" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={settings.standardHoursPerDay}
            onChange={(e) => setSettings((p) => ({ ...p, standardHoursPerDay: Number(e.target.value) }))}
            className="w-24"
          />
          <span className="text-sm text-[#8181A5]">{'시간'}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="주간 근무일수" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={settings.standardDaysPerWeek}
            onChange={(e) => setSettings((p) => ({ ...p, standardDaysPerWeek: Number(e.target.value) }))}
            className="w-24"
          />
          <span className="text-sm text-[#8181A5]">{'일'}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="점심시간" status="global" companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={settings.lunchStartTime}
            onChange={(e) => setSettings((p) => ({ ...p, lunchStartTime: e.target.value }))}
            className="w-32"
          />
          <span className="text-sm text-[#8181A5]">~</span>
          <Input
            type="time"
            value={settings.lunchEndTime}
            onChange={(e) => setSettings((p) => ({ ...p, lunchEndTime: e.target.value }))}
            className="w-32"
          />
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="유연근무제" status="global" companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.flexEnabled}
            onChange={(e) => setSettings((p) => ({ ...p, flexEnabled: e.target.checked }))}
            className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]"
          />
          <span className="text-[#1C1D21]">{'유연근무제 활성화'}</span>
        </label>
      </SettingFieldWithOverride>

      <div className="flex justify-end pt-4">
        <Button className={BUTTON_VARIANTS.primary}>
          <Save className="mr-2 h-4 w-4" />
          {'저장'}
        </Button>
      </div>
    </div>
  )
}

// ─── Weekly Hours Tab ────────────────────────────────────

function WeeklyHoursTab({ companyId }: { companyId: string | null }) {
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState({
    caution: 44,
    warning: 48,
    blocked: 52,
    weeklyMax: 52,
  })

  useEffect(() => {
    setLoading(true)
    apiClient.get('/api/v1/settings/attendance').then((res) => {
      if (res.data) {
        const d = res.data as Record<string, unknown>
        const alert = d.alertThresholds as Record<string, number> | undefined
        setHours({
          caution: alert?.caution ?? 44,
          warning: alert?.warning ?? 48,
          blocked: alert?.blocked ?? 52,
          weeklyMax: (d.weeklyMaxHours as number) ?? 52,
        })
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1C1D21]">{'주간 근무한도'}</h3>
        <p className="text-sm text-[#8181A5]">{'법정 주간 근무 상한과 알림 임계값 설정'}</p>
      </div>

      {/* Settings-connected: weekly hours alert thresholds (ATTENDANCE/alert-thresholds) */}
      <SettingFieldWithOverride label="법정 주간 최대 근로시간" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={hours.weeklyMax} onChange={(e) => setHours((p) => ({ ...p, weeklyMax: Number(e.target.value) }))} className="w-24" />
          <span className="text-sm text-[#8181A5]">{'시간 (근로기준법 기준)'}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="주의 알림 (Caution)" status={companyId ? 'custom' : 'global'} description="이 시간을 초과하면 주의 알림이 발송됩니다" companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={hours.caution} onChange={(e) => setHours((p) => ({ ...p, caution: Number(e.target.value) }))} className="w-24" />
          <span className="text-sm text-[#8181A5]">{'시간'}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="경고 알림 (Warning)" status={companyId ? 'custom' : 'global'} description="이 시간을 초과하면 경고 알림이 발송됩니다" companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={hours.warning} onChange={(e) => setHours((p) => ({ ...p, warning: Number(e.target.value) }))} className="w-24" />
          <span className="text-sm text-[#8181A5]">{'시간'}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="차단 (Blocked)" status={companyId ? 'custom' : 'global'} description="이 시간을 초과하면 근무 등록이 차단됩니다" companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={hours.blocked} onChange={(e) => setHours((p) => ({ ...p, blocked: Number(e.target.value) }))} className="w-24" />
          <span className="text-sm text-[#8181A5]">{'시간'}</span>
        </div>
      </SettingFieldWithOverride>

      <div className="flex justify-end pt-4">
        <Button className={BUTTON_VARIANTS.primary}>
          <Save className="mr-2 h-4 w-4" />
          {'저장'}
        </Button>
      </div>
    </div>
  )
}

// ─── Main Content Router ─────────────────────────────────

function AttendanceSettingsContent() {
  const searchParams = useSearchParams()
  const tab = (searchParams.get('tab') ?? config.tabs[0].slug) as AttendanceTabSlug

  const renderContent = (companyId: string | null) => {
    switch (tab) {
      case 'work-schedules':
        return <WorkSchedulesTab companyId={companyId} />
      case 'weekly-hours':
        return <WeeklyHoursTab companyId={companyId} />
      case 'shift-patterns':
        return <ShiftPatternsTab companyId={companyId} />
      case 'leave-types':
        return <LeaveTypesTab companyId={companyId} />
      case 'leave-accrual':
        return <LeaveAccrualTab companyId={companyId} />
      case 'leave-promotion':
        return <LeavePromotionTab companyId={companyId} />
      case 'holidays':
        return <HolidaysTab companyId={companyId} />
      case 'overtime':
        return <OvertimeTab companyId={companyId} />
      default:
        return <WorkSchedulesTab companyId={companyId} />
    }
  }

  return (
    <SettingsSubPageLayout config={config} activeTab={tab}>
      {(companyId: string | null) => renderContent(companyId)}
    </SettingsSubPageLayout>
  )
}

export function AttendanceSettingsV2Client() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-16 text-[#8181A5]">{'로딩 중...'}</div>}>
      <AttendanceSettingsContent />
    </Suspense>
  )
}
