'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'

interface Props { companyId: string | null }

interface CalibSettings {
  required: boolean
  scope: 'DEPARTMENT' | 'DIVISION' | 'COMPANY'
  minParticipants: number
  allowManagerOverride: boolean
}

const DEFAULTS: CalibSettings = { required: true, scope: 'DEPARTMENT', minParticipants: 5, allowManagerOverride: false }

export function CalibrationTab({ companyId }: Props) {
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<CalibSettings>({
    category: 'performance',
    key: 'calibration-rules',
    companyId,
    defaults: DEFAULTS,
    description: '캘리브레이션 설정',
    merge: (raw, defs) => ({
      required: typeof raw.required === 'boolean' ? raw.required : defs.required,
      scope: (raw.scope as CalibSettings['scope']) ?? defs.scope,
      minParticipants: (raw.minParticipants as number) ?? defs.minParticipants,
      allowManagerOverride: typeof raw.allowManagerOverride === 'boolean' ? raw.allowManagerOverride : defs.allowManagerOverride,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">캘리브레이션</h3>
          <p className="text-sm text-[#8181A5]">등급 조정 회의 필수 여부 및 참여 범위 설정</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">법인 오버라이드</span>
        )}
      </div>

      <SettingFieldWithOverride label="캘리브레이션 필수" description="평가 프로세스에서 캘리브레이션 단계를 필수로 할지" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.required} onChange={(e) => setSettings((p) => ({ ...p, required: e.target.checked }))} className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]" />
          <span className="text-[#1C1D21]">캘리브레이션 필수</span>
        </label>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="참여 범위" description="캘리브레이션 회의 단위" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <select className="rounded-xl border border-[#F0F0F3] px-3 py-2 text-sm" value={settings.scope} onChange={(e) => setSettings((p) => ({ ...p, scope: e.target.value as CalibSettings['scope'] }))}>
          <option value="DEPARTMENT">부서 단위</option>
          <option value="DIVISION">본부 단위</option>
          <option value="COMPANY">법인 전체</option>
        </select>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="최소 참여 인원" description="캘리브레이션 대상 최소 인원 수" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.minParticipants} onChange={(e) => setSettings((p) => ({ ...p, minParticipants: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-[#8181A5]">명 이상</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="관리자 직접 변경 허용" description="캘리브레이션 없이 관리자가 등급 직접 변경 가능" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.allowManagerOverride} onChange={(e) => setSettings((p) => ({ ...p, allowManagerOverride: e.target.checked }))} className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]" />
          <span className="text-[#1C1D21]">직접 변경 허용</span>
        </label>
      </SettingFieldWithOverride>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={revert} disabled={!hasChanges}>
          <RotateCcw className="mr-2 h-4 w-4" />되돌리기
        </Button>
        <Button className="bg-[#5E81F4] text-white hover:bg-[#4A6FE0]" onClick={save} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}저장
        </Button>
      </div>
    </div>
  )
}
