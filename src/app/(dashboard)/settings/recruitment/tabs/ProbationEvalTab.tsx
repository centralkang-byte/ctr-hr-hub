'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'

interface Props { companyId: string | null }

interface ProbationSettings {
  evalTimings: number[]
  passingScore: number
  autoConfirm: boolean
}

const DEFAULTS: ProbationSettings = { evalTimings: [30, 60, 90], passingScore: 70, autoConfirm: true }

export function ProbationEvalTab({ companyId }: Props) {
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<ProbationSettings>({
    category: 'onboarding',
    key: 'probation-eval',
    companyId,
    defaults: DEFAULTS,
    description: '수습 평가 설정',
    merge: (raw, defs) => ({
      evalTimings: Array.isArray(raw.evalTimings) ? (raw.evalTimings as number[]) : defs.evalTimings,
      passingScore: (raw.passingScore as number) ?? defs.passingScore,
      autoConfirm: typeof raw.autoConfirm === 'boolean' ? raw.autoConfirm : defs.autoConfirm,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">수습 평가</h3>
          <p className="text-sm text-[#8181A5]">수습 기간 중 평가 시점 및 기준 설정</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">법인 오버라이드</span>
        )}
      </div>

      <SettingFieldWithOverride label="평가 시점" description="수습 기간 중 평가를 실시할 시점" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">{settings.evalTimings.map((d, i) => (
          <span key={i} className="rounded-full bg-[#5E81F4]/10 px-3 py-1 text-sm font-medium text-[#5E81F4]">{d}일차</span>
        ))}</div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="합격 기준 점수" description="수습 평가 합격 기준 점수 (100점 만점)" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.passingScore} min={0} max={100} onChange={(e) => setSettings((p) => ({ ...p, passingScore: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-[#8181A5]">점 이상</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="자동 정규직 전환" description="합격 시 자동 정규직 전환 여부" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.autoConfirm} onChange={(e) => setSettings((p) => ({ ...p, autoConfirm: e.target.checked }))} className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]" />
          <span className="text-[#1C1D21]">합격 시 자동 전환</span>
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
