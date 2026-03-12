'use client'

import { useEffect, useState, useCallback } from 'react'
import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import { FORM_STYLES } from '@/lib/styles'

interface Props { companyId: string | null }

interface PayScheduleSettings {
  payDay: number
  cutoffDay: number
  paymentMethod: 'BANK_TRANSFER' | 'CHECK'
}

const DEFAULTS: PayScheduleSettings = { payDay: 25, cutoffDay: 20, paymentMethod: 'BANK_TRANSFER' }

export function PayScheduleTab({ companyId }: Props) {
  const [settings, setSettings] = useState<PayScheduleSettings>(() => structuredClone(DEFAULTS))
  const [original, setOriginal] = useState<PayScheduleSettings>(() => structuredClone(DEFAULTS))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOverridden, setIsOverridden] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const qs = companyId ? `?key=pay-schedule&companyId=${companyId}` : '?key=pay-schedule'
      const res = await apiClient.get(`/api/v1/process-settings/payroll${qs}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (res as any)?.data ?? res ?? []
      const setting = Array.isArray(items) ? items[0] : null

      if (setting?.settingValue) {
        const sv = setting.settingValue as Record<string, unknown>
        setIsOverridden(!!setting.isOverridden)
        const merged: PayScheduleSettings = {
          payDay: (sv.payDay as number) ?? DEFAULTS.payDay,
          cutoffDay: (sv.closingDay as number) ?? (sv.cutoffDay as number) ?? DEFAULTS.cutoffDay,
          paymentMethod: (sv.paymentMethod as PayScheduleSettings['paymentMethod']) ?? DEFAULTS.paymentMethod,
        }
        setSettings(structuredClone(merged))
        setOriginal(structuredClone(merged))
      } else {
        setSettings(structuredClone(DEFAULTS))
        setOriginal(structuredClone(DEFAULTS))
      }
    } catch {
      setSettings(structuredClone(DEFAULTS))
      setOriginal(structuredClone(DEFAULTS))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiClient.put('/api/v1/process-settings/payroll', {
        key: 'pay-schedule',
        value: { payDay: settings.payDay, closingDay: settings.cutoffDay, paymentMethod: settings.paymentMethod },
        companyId: companyId ?? undefined,
        description: '급여 지급일/마감일 설정',
      })
      toast({ title: '저장되었습니다', description: '급여 일정이 업데이트되었습니다.' })
      setOriginal(structuredClone(settings))
    } catch {
      toast({ title: '저장 실패', description: '다시 시도해 주세요.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleRevert = () => {
    setSettings(structuredClone(original))
    toast({ title: '변경을 취소했습니다' })
  }

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(original)

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">급여일</h3>
          <p className="text-sm text-[#8181A5]">매월 급여 지급일 설정 (법인별)</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">법인 오버라이드</span>
        )}
      </div>

      <SettingFieldWithOverride label="급여 지급일" description="매월 급여가 지급되는 날짜" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#8181A5]">매월</span>
          <Input type="number" value={settings.payDay} min={1} max={31} onChange={(e) => setSettings((p) => ({ ...p, payDay: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-[#8181A5]">일</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="급여 마감일" description="급여 계산 기준 마감일" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#8181A5]">매월</span>
          <Input type="number" value={settings.cutoffDay} min={1} max={31} onChange={(e) => setSettings((p) => ({ ...p, cutoffDay: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-[#8181A5]">일</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="지급 방법" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <select className={FORM_STYLES.select} value={settings.paymentMethod} onChange={(e) => setSettings((p) => ({ ...p, paymentMethod: e.target.value as PayScheduleSettings['paymentMethod'] }))}>
          <option value="BANK_TRANSFER">계좌이체</option>
          <option value="CHECK">수표</option>
        </select>
      </SettingFieldWithOverride>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={handleRevert} disabled={!hasChanges}>
          <RotateCcw className="mr-2 h-4 w-4" />되돌리기
        </Button>
        <Button className={BUTTON_VARIANTS.primary} onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}저장
        </Button>
      </div>
    </div>
  )
}
