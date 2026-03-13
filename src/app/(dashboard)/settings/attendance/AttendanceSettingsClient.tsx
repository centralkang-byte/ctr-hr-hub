'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Settings Client (B6-1)
// /settings/attendance — 근무유형 / 52시간 관리 / 교대근무
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  Calendar,
  Clock,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Save,
  RotateCcw,
  Info,
} from 'lucide-react'
import Link from 'next/link'

import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BUTTON_VARIANTS,  FORM_STYLES } from '@/lib/styles'

// ─── Types ───────────────────────────────────────────────

interface AlertThresholds {
  caution: number
  warning: number
  blocked: number
}

interface FlexWork {
  flexEnabled: boolean
  coreTimeStart: string
  coreTimeEnd: string
  minDailyHours: number
}

interface AttendanceSetting {
  standardHoursPerDay: number
  standardDaysPerWeek: number
  weeklyMaxHours: number
  shiftEnabled: boolean
  flexWork: FlexWork
  alertThresholds: AlertThresholds
  enableBlocking: boolean
  timezone: string
  isCustom: boolean
}

type TabId = 'work-type' | '52h' | 'shift'

interface Props {
  user: SessionUser
}

// ─── Toggle Switch ────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#E8E8E8] bg-white p-4">
      <div>
        <p className="text-sm font-medium text-[#1A1A1A]">{label}</p>
        {description && <p className="text-xs text-[#666] mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30 ${
          checked ? 'bg-[#4F46E5]' : 'bg-[#E8E8E8]'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

// ─── Number Input ─────────────────────────────────────────

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  unit,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  unit?: string
  hint?: string
}) {
  return (
    <div>
      <Label className="text-sm font-medium text-[#333]">{label}</Label>
      {hint && <p className="text-xs text-[#888] mt-0.5 mb-1">{hint}</p>}
      <div className="flex items-center gap-2 mt-1">
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 border-[#D4D4D4] text-sm focus:ring-2 focus:ring-[#4F46E5]/10"
        />
        {unit && <span className="text-sm text-[#666]">{unit}</span>}
      </div>
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-[#1A1A1A]">{title}</h3>
      {description && <p className="text-sm text-[#666] mt-0.5">{description}</p>}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────

export function AttendanceSettingsClient({ user: _user }: Props) {
  const [tab, setTab] = useState<TabId>('work-type')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [settings, setSettings] = useState<AttendanceSetting>({
    standardHoursPerDay: 8,
    standardDaysPerWeek: 5,
    weeklyMaxHours: 52,
    shiftEnabled: false,
    flexWork: {
      flexEnabled: false,
      coreTimeStart: '10:00',
      coreTimeEnd: '16:00',
      minDailyHours: 8,
    },
    alertThresholds: { caution: 44, warning: 48, blocked: 52 },
    enableBlocking: false,
    timezone: 'Asia/Seoul',
    isCustom: false,
  })

  // ─── Fetch ──────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<AttendanceSetting>('/api/v1/settings/attendance')
      if (res.data) setSettings(res.data)
    } catch {
      setError('설정을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  // ─── Save ───────────────────────────────────────────────

  const handleSave = async () => {
    const { caution, warning, blocked } = settings.alertThresholds
    if (caution >= warning || warning >= blocked) {
      setError('경고 임계값은 주의 < 경고 < 차단 순서여야 합니다.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { isCustom, ...payload } = settings
      await apiClient.put('/api/v1/settings/attendance', payload)
      setSuccessMsg('설정이 저장되었습니다.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch {
      setError('저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  // ─── Patch helpers ───────────────────────────────────────

  const patchSettings = (patch: Partial<AttendanceSetting>) =>
    setSettings((prev) => ({ ...prev, ...patch }))

  const patchFlexWork = (patch: Partial<FlexWork>) =>
    setSettings((prev) => ({ ...prev, flexWork: { ...prev.flexWork, ...patch } }))

  const patchThresholds = (patch: Partial<AlertThresholds>) =>
    setSettings((prev) => ({
      ...prev,
      alertThresholds: { ...prev.alertThresholds, ...patch },
    }))

  // ─── Tabs ───────────────────────────────────────────────

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'work-type', label: '근무유형 설정', icon: <Clock className="h-4 w-4" /> },
    { id: '52h', label: '52시간 관리', icon: <AlertTriangle className="h-4 w-4" /> },
    { id: 'shift', label: '교대근무', icon: <Calendar className="h-4 w-4" /> },
  ]

  // ─── Tab: 근무유형 ────────────────────────────────────────

  const renderWorkTypeTab = () => (
    <div className="space-y-6">
      {/* 기본 근무시간 */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
        <SectionHeader
          title="기본 근무시간"
          description="법인 기준 표준 근무시간을 설정합니다."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumberInput
            label="일 기준 근무시간"
            value={settings.standardHoursPerDay}
            onChange={(v) => patchSettings({ standardHoursPerDay: v })}
            min={1}
            max={24}
            unit="시간"
          />
          <NumberInput
            label="주 근무일수"
            value={settings.standardDaysPerWeek}
            onChange={(v) => patchSettings({ standardDaysPerWeek: v })}
            min={1}
            max={7}
            unit="일"
          />
          <NumberInput
            label="주 최대 근무시간"
            value={settings.weeklyMaxHours}
            onChange={(v) => patchSettings({ weeklyMaxHours: v })}
            min={1}
            max={168}
            unit="시간"
            hint="한국 52시간제: 최대 52"
          />
        </div>
      </div>

      {/* 유연근무제 */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
        <SectionHeader
          title="유연근무제 (Flex Time)"
          description="코어 타임과 최소 일일 근무시간을 설정합니다."
        />
        <div className="space-y-4">
          <Toggle
            checked={settings.flexWork.flexEnabled}
            onChange={(v) => patchFlexWork({ flexEnabled: v })}
            label="유연근무제 활성화"
            description="직원이 코어 타임 내에서 출퇴근 시간을 자유롭게 조정합니다."
          />

          {settings.flexWork.flexEnabled && (
            <div className="ml-0 grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-lg bg-[#FAFAFA] border border-[#F0F0F0] p-4">
              <div>
                <Label className="text-sm font-medium text-[#333]">코어 타임 시작</Label>
                <Input
                  type="time"
                  value={settings.flexWork.coreTimeStart}
                  onChange={(e) => patchFlexWork({ coreTimeStart: e.target.value })}
                  className="mt-1 border-[#D4D4D4] text-sm focus:ring-2 focus:ring-[#4F46E5]/10"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-[#333]">코어 타임 종료</Label>
                <Input
                  type="time"
                  value={settings.flexWork.coreTimeEnd}
                  onChange={(e) => patchFlexWork({ coreTimeEnd: e.target.value })}
                  className="mt-1 border-[#D4D4D4] text-sm focus:ring-2 focus:ring-[#4F46E5]/10"
                />
              </div>
              <NumberInput
                label="최소 일일 근무시간"
                value={settings.flexWork.minDailyHours ?? 8}
                onChange={(v) => patchFlexWork({ minDailyHours: v })}
                min={1}
                max={24}
                unit="시간"
              />
            </div>
          )}
        </div>
      </div>

      {/* 타임존 */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
        <SectionHeader title="타임존" description="근태 기록 기준 타임존입니다." />
        <div className="max-w-xs">
          <Label className="text-sm font-medium text-[#333]">타임존</Label>
          <select
            value={settings.timezone}
            onChange={(e) => patchSettings({ timezone: e.target.value })}
            className={`mt-1 ${FORM_STYLES.input}`}
          >
            <option value="Asia/Seoul">Asia/Seoul (KST, UTC+9)</option>
            <option value="Asia/Shanghai">Asia/Shanghai (CST, UTC+8)</option>
            <option value="Europe/Moscow">Europe/Moscow (MSK, UTC+3)</option>
            <option value="America/New_York">America/New_York (EST, UTC-5)</option>
            <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (ICT, UTC+7)</option>
            <option value="America/Mexico_City">America/Mexico_City (CST, UTC-6)</option>
          </select>
        </div>
      </div>
    </div>
  )

  // ─── Tab: 52시간 관리 ──────────────────────────────────────

  const render52hTab = () => (
    <div className="space-y-6">
      {/* 3단계 알림 임계값 */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
        <SectionHeader
          title="3단계 알림 임계값"
          description="주간 누적 근무시간이 임계값에 도달하면 알림이 발송됩니다."
        />

        {/* 시각적 타임라인 */}
        <div className="mb-6 rounded-lg bg-[#FAFAFA] border border-[#F0F0F0] p-4">
          <div className="flex items-center gap-0">
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-[#1A1A1A]">0</div>
              <div className="text-xs text-[#999]">시작</div>
            </div>
            <div className="flex-1 h-2 rounded-l-full bg-[#D1FAE5]" />
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-[#B45309]">{settings.alertThresholds.caution}</div>
              <div className="text-xs text-[#B45309]">주의</div>
            </div>
            <div className="flex-1 h-2 bg-[#FEF3C7]" />
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-[#C2410C]">{settings.alertThresholds.warning}</div>
              <div className="text-xs text-[#C2410C]">경고</div>
            </div>
            <div className="flex-1 h-2 bg-[#FED7AA]" />
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-[#B91C1C]">{settings.alertThresholds.blocked}</div>
              <div className="text-xs text-[#B91C1C]">차단</div>
            </div>
            <div className="flex-1 h-2 rounded-r-full bg-[#FEE2E2]" />
          </div>
          <div className="mt-1 text-center text-xs text-[#999]">단위: 시간/주</div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-[#FCD34D] bg-[#FFFBEB] p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="h-3 w-3 rounded-full bg-[#F59E0B]" />
              <span className="text-sm font-semibold text-[#B45309]">주의 (Caution)</span>
            </div>
            <NumberInput
              label="임계값"
              value={settings.alertThresholds.caution}
              onChange={(v) => patchThresholds({ caution: v })}
              min={1}
              max={100}
              unit="시간"
              hint="HR 알림 발송"
            />
          </div>
          <div className="rounded-lg border border-[#FED7AA] bg-[#FFF7ED] p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="h-3 w-3 rounded-full bg-[#F97316]" />
              <span className="text-sm font-semibold text-[#C2410C]">경고 (Warning)</span>
            </div>
            <NumberInput
              label="임계값"
              value={settings.alertThresholds.warning}
              onChange={(v) => patchThresholds({ warning: v })}
              min={1}
              max={100}
              unit="시간"
              hint="매니저 + HR 알림"
            />
          </div>
          <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="h-3 w-3 rounded-full bg-[#EF4444]" />
              <span className="text-sm font-semibold text-[#B91C1C]">차단 (Blocked)</span>
            </div>
            <NumberInput
              label="임계값"
              value={settings.alertThresholds.blocked}
              onChange={(v) => patchThresholds({ blocked: v })}
              min={1}
              max={168}
              unit="시간"
              hint="초과 근무 차단"
            />
          </div>
        </div>

        {settings.alertThresholds.caution >= settings.alertThresholds.warning ||
        settings.alertThresholds.warning >= settings.alertThresholds.blocked ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#FEF2F2] border border-[#FECACA] px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-[#EF4444] shrink-0" />
            <span className="text-xs text-[#B91C1C]">
              임계값 순서: 주의 {'<'} 경고 {'<'} 차단 이어야 합니다.
            </span>
          </div>
        ) : null}
      </div>

      {/* 차단 옵션 */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
        <SectionHeader
          title="초과근무 차단"
          description="차단 임계값 도달 시 클락인을 차단합니다."
        />
        <div className="space-y-3">
          <Toggle
            checked={settings.enableBlocking}
            onChange={(v) => patchSettings({ enableBlocking: v })}
            label="클락인 차단 활성화"
            description="차단 임계값 초과 시 직원의 출근 기록이 자동으로 거부됩니다."
          />
          {settings.enableBlocking && (
            <div className="flex items-start gap-2 rounded-lg bg-[#FFF7ED] border border-[#FED7AA] px-3 py-2">
              <Info className="h-4 w-4 text-[#F97316] shrink-0 mt-0.5" />
              <p className="text-xs text-[#C2410C]">
                차단이 활성화되면 클락인 API에서 52시간 초과 여부를 확인합니다.
                HR 관리자만 차단을 해제할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ─── Tab: 교대근무 ────────────────────────────────────────

  const renderShiftTab = () => (
    <div className="space-y-6">
      {/* 교대근무 활성화 */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
        <SectionHeader
          title="교대근무 활성화"
          description="법인에서 교대근무(2교대/3교대)를 운영합니다."
        />
        <Toggle
          checked={settings.shiftEnabled}
          onChange={(v) => patchSettings({ shiftEnabled: v })}
          label="교대근무 사용"
          description="활성화하면 교대근무 패턴 및 그룹 관리 기능이 활성화됩니다."
        />
      </div>

      {/* 교대근무 패턴 관리 링크 */}
      {settings.shiftEnabled && (
        <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
          <SectionHeader title="교대근무 상세 설정" />
          <div className="space-y-3">
            <Link
              href="/settings/shift-patterns"
              className="flex items-center justify-between rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3 hover:bg-[#F0F0F0] transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-[#1A1A1A]">교대 패턴 관리</p>
                <p className="text-xs text-[#666]">2교대/3교대 패턴 정의 및 슬롯 설정</p>
              </div>
              <ChevronRight className="h-4 w-4 text-[#999]" />
            </Link>
            <Link
              href="/settings/shift-roster"
              className="flex items-center justify-between rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3 hover:bg-[#F0F0F0] transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-[#1A1A1A]">교대 로스터</p>
                <p className="text-xs text-[#666]">월별 교대 일정 배정 및 조 편성</p>
              </div>
              <ChevronRight className="h-4 w-4 text-[#999]" />
            </Link>
          </div>
        </div>
      )}

      {/* 안내 */}
      <div className="rounded-xl border border-[#E0E7FF] bg-[#EEF2FF] p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-[#4338CA] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[#4338CA]">교대근무 야간 수당 안내</p>
          <p className="text-xs text-[#6366F1] mt-0.5">
            야간 교대(22:00~06:00) 근무는 야간 수당이 자동 계산됩니다.
            급여 설정에서 수당 비율을 조정하세요.
          </p>
        </div>
      </div>
    </div>
  )

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="p-6">
      <PageHeader
        title="근태 설정"
        description="근무유형, 52시간 관리, 교대근무 정책을 설정합니다."
      />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#4F46E5]" />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Tabs */}
          <div className="flex border-b border-[#E8E8E8]">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-[#4F46E5] text-[#4F46E5]'
                    : 'border-transparent text-[#666] hover:text-[#333]'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div>
            {tab === 'work-type' && renderWorkTypeTab()}
            {tab === '52h' && render52hTab()}
            {tab === 'shift' && renderShiftTab()}
          </div>

          {/* Messages */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-[#FEF2F2] border border-[#FECACA] px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-[#EF4444] shrink-0" />
              <span className="text-sm text-[#B91C1C]">{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-[#D1FAE5] border border-[#A7F3D0] px-4 py-3">
              <span className="text-sm text-[#047857]">{successMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between border-t border-[#E8E8E8] pt-4">
            <div className="flex items-center gap-2">
              {settings.isCustom && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EEF2FF] text-[#4338CA] border border-[#EEF2FF]">
                  법인 커스텀 설정
                </span>
              )}
              {!settings.isCustom && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FAFAFA] text-[#555] border border-[#E8E8E8]">
                  글로벌 기본값
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { void fetchSettings() }}
                className="border-[#D4D4D4] text-[#333] hover:bg-[#FAFAFA]"
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                초기화
              </Button>
              <Button
                size="sm"
                onClick={() => { void handleSave() }}
                disabled={saving}
                className={BUTTON_VARIANTS.primary}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                저장
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
