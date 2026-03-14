'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface Props { companyId: string | null }

interface RetentionSettings {
  retentionMonths: number
  piiMasking: boolean
  autoDeleteEnabled: boolean
  gdprCompliant: boolean
}

const DEFAULTS: RetentionSettings = { retentionMonths: 36, piiMasking: true, autoDeleteEnabled: false, gdprCompliant: true }

export function DataRetentionTab({ companyId }: Props) {
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<RetentionSettings>({
    category: 'system',
    key: 'data-retention',
    companyId,
    defaults: DEFAULTS,
    description: '데이터 보존 정책',
    merge: (raw, defs) => ({
      retentionMonths: (raw.defaultRetentionDays as number) ? Math.round((raw.defaultRetentionDays as number) / 30) : (raw.retentionMonths as number) ?? defs.retentionMonths,
      piiMasking: typeof raw.piiMaskingEnabled === 'boolean' ? raw.piiMaskingEnabled : typeof raw.piiMasking === 'boolean' ? raw.piiMasking : defs.piiMasking,
      autoDeleteEnabled: typeof raw.autoDeleteEnabled === 'boolean' ? raw.autoDeleteEnabled : defs.autoDeleteEnabled,
      gdprCompliant: typeof raw.gdprCompliant === 'boolean' ? raw.gdprCompliant : defs.gdprCompliant,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">데이터 보존</h3>
          <p className="text-sm text-[#8181A5]">GDPR 삭제 주기, PII 마스킹 정책</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">법인 오버라이드</span>
        )}
      </div>

      <SettingFieldWithOverride label="데이터 보존 기간" description="퇴사자 데이터 보존 기간" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.retentionMonths} onChange={(e) => setSettings((p) => ({ ...p, retentionMonths: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-[#8181A5]">개월</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="PII 마스킹" description="개인식별정보 자동 마스킹" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.piiMasking} onChange={(e) => setSettings((p) => ({ ...p, piiMasking: e.target.checked }))} className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]" />
          <span className="text-[#1C1D21]">PII 마스킹 활성화</span>
        </label>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="자동 삭제" description="보존 기간 경과 후 자동 삭제" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.autoDeleteEnabled} onChange={(e) => setSettings((p) => ({ ...p, autoDeleteEnabled: e.target.checked }))} className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]" />
          <span className="text-[#1C1D21]">자동 삭제 활성화</span>
        </label>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="GDPR 준수" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.gdprCompliant} onChange={(e) => setSettings((p) => ({ ...p, gdprCompliant: e.target.checked }))} className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]" />
          <span className="text-[#1C1D21]">GDPR 정책 준수 모드</span>
        </label>
      </SettingFieldWithOverride>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={revert} disabled={!hasChanges}>
          <RotateCcw className="mr-2 h-4 w-4" />되돌리기
        </Button>
        <Button className={BUTTON_VARIANTS.primary} onClick={save} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}저장
        </Button>
      </div>
    </div>
  )
}
