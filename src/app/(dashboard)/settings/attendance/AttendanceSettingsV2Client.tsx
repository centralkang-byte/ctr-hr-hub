'use client'


// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Settings V2 (H-2a: All 8 tabs working)
// Gold-standard reference for H-2b~d (Payroll, Performance, etc.)
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Loader2, Save } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
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
import { DesignatedLeaveTab } from './tabs/DesignatedLeaveTab'
import { HolidaysTab } from './tabs/HolidaysTab'
import { OvertimeTab } from './tabs/OvertimeTab'
import { LoaTypesTab } from './tabs/LoaTypesTab'
import { BUTTON_VARIANTS } from '@/lib/styles'

const config = getCategoryConfig('attendance')

// ─── Work Schedules Tab ──────────────────────────────────

function WorkSchedulesTab({ companyId }: { companyId: string | null }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    standardHoursPerDay: 8,
    standardDaysPerWeek: 5,
    workStartTime: '08:30',
    workEndTime: '17:30',
    lunchStartTime: '12:00',
    lunchEndTime: '13:00',
    flexEnabled: false,
  })

  useEffect(() => {
    setLoading(true)
    // SUPER_ADMIN 법인 선택 시 해당 법인 설정 조회 (API가 resolveCompanyId로 검증)
    const query = companyId ? `?companyId=${companyId}` : ''
    apiClient.get(`/api/v1/settings/attendance${query}`).then((res) => {
      if (res.data) {
        const d = res.data as Record<string, unknown>
        setSettings((prev) => ({
          ...prev,
          standardHoursPerDay: (d.standardHoursPerDay as number) ?? 8,
          standardDaysPerWeek: (d.standardDaysPerWeek as number) ?? 5,
          workStartTime: (d.workStartTime as string) ?? '08:30',
          workEndTime: (d.workEndTime as string) ?? '17:30',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          flexEnabled: (d.flexWork as any)?.flexEnabled as boolean ?? false,
        }))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [companyId])

  const handleSave = async () => {
    try {
      setSaving(true)
      await apiClient.put('/api/v1/settings/attendance', {
        standardHoursPerDay: settings.standardHoursPerDay,
        standardDaysPerWeek: settings.standardDaysPerWeek,
        workStartTime: settings.workStartTime,
        workEndTime: settings.workEndTime,
        // 선택 법인이 저장 대상 법인 (미전달 시 본인 법인) — r2-3
        ...(companyId ? { companyId } : {}),
      })
      toast({ title: '저장되었습니다' })
    } catch (err) {
      toast({
        title: '저장 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{t('workScheduleTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('workScheduleDesc')}</p>
      </div>

      <SettingFieldWithOverride label={t('dailyStandardHours')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={settings.standardHoursPerDay}
            onChange={(e) => setSettings((p) => ({ ...p, standardHoursPerDay: Number(e.target.value) }))}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">{t('hourUnit')}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('weeklyWorkDays')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={settings.standardDaysPerWeek}
            onChange={(e) => setSettings((p) => ({ ...p, standardDaysPerWeek: Number(e.target.value) }))}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">{t('dayUnit')}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('workBaseHours')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={settings.workStartTime}
            onChange={(e) => setSettings((p) => ({ ...p, workStartTime: e.target.value }))}
            className="w-32"
            aria-label={t('workBaseHours')}
          />
          <span className="text-sm text-muted-foreground">~</span>
          <Input
            type="time"
            value={settings.workEndTime}
            onChange={(e) => setSettings((p) => ({ ...p, workEndTime: e.target.value }))}
            className="w-32"
          />
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('lunchTime')} status="global" companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={settings.lunchStartTime}
            onChange={(e) => setSettings((p) => ({ ...p, lunchStartTime: e.target.value }))}
            className="w-32"
          />
          <span className="text-sm text-muted-foreground">~</span>
          <Input
            type="time"
            value={settings.lunchEndTime}
            onChange={(e) => setSettings((p) => ({ ...p, lunchEndTime: e.target.value }))}
            className="w-32"
          />
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('flexWork')} status="global" companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.flexEnabled}
            onChange={(e) => setSettings((p) => ({ ...p, flexEnabled: e.target.checked }))}
            className="h-4 w-4 rounded border-border text-primary"
          />
          <span className="text-foreground">{t('flexWorkEnabled')}</span>
        </label>
      </SettingFieldWithOverride>

      <div className="flex justify-end pt-4">
        <Button className={BUTTON_VARIANTS.primary} onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {tc('save')}
        </Button>
      </div>
    </div>
  )
}

// ─── Weekly Hours Tab ────────────────────────────────────

function WeeklyHoursTab({ companyId }: { companyId: string | null }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
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

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{t('weeklyHoursLimitTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('weeklyHoursLimitDesc')}</p>
      </div>

      {/* Settings-connected: weekly hours alert thresholds (ATTENDANCE/alert-thresholds) */}
      <SettingFieldWithOverride label={t('legalMaxWeeklyHours')} status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={hours.weeklyMax} onChange={(e) => setHours((p) => ({ ...p, weeklyMax: Number(e.target.value) }))} className="w-24" />
          <span className="text-sm text-muted-foreground">{t('hoursByLaborLaw')}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('cautionAlert')} status={companyId ? 'custom' : 'global'} description={t('cautionAlertDesc')} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={hours.caution} onChange={(e) => setHours((p) => ({ ...p, caution: Number(e.target.value) }))} className="w-24" />
          <span className="text-sm text-muted-foreground">{t('hourUnit')}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('warningAlert')} status={companyId ? 'custom' : 'global'} description={t('warningAlertDesc')} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={hours.warning} onChange={(e) => setHours((p) => ({ ...p, warning: Number(e.target.value) }))} className="w-24" />
          <span className="text-sm text-muted-foreground">{t('hourUnit')}</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label={t('blockedAlert')} status={companyId ? 'custom' : 'global'} description={t('blockedAlertDesc')} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={hours.blocked} onChange={(e) => setHours((p) => ({ ...p, blocked: Number(e.target.value) }))} className="w-24" />
          <span className="text-sm text-muted-foreground">{t('hourUnit')}</span>
        </div>
      </SettingFieldWithOverride>

      <div className="flex justify-end pt-4">
        <Button className={BUTTON_VARIANTS.primary}>
          <Save className="mr-2 h-4 w-4" />
          {tc('save')}
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
      case 'designated-leave':
        return <DesignatedLeaveTab companyId={companyId} />
      case 'holidays':
        return <HolidaysTab companyId={companyId} />
      case 'overtime':
        return <OvertimeTab companyId={companyId} />
      case 'loa-types':
        return <LoaTypesTab companyId={companyId} />
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
    <Suspense fallback={<div className="flex items-center justify-center p-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <AttendanceSettingsContent />
    </Suspense>
  )
}
