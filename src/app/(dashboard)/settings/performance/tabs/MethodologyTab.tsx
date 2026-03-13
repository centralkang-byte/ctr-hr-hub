'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface Props { companyId: string | null }

interface MethodSettings {
  maxGoals: number
  weightSumRequired: boolean
  weightSum: number
  categories: string[]
  allowSelfWeight: boolean
}

const DEFAULTS: MethodSettings = {
  maxGoals: 5,
  weightSumRequired: true,
  weightSum: 100,
  categories: ['업무목표', '역량개발', '조직기여'],
  allowSelfWeight: false,
}

export function MethodologyTab({ companyId }: Props) {
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<MethodSettings>({
    category: 'performance',
    key: 'methodology',
    companyId,
    defaults: DEFAULTS,
    description: '평가 방법론 설정',
    merge: (raw, defs) => ({
      maxGoals: (raw.maxGoals as number) ?? defs.maxGoals,
      weightSumRequired: typeof raw.weightSumRequired === 'boolean' ? raw.weightSumRequired : defs.weightSumRequired,
      weightSum: (raw.weightSum as number) ?? defs.weightSum,
      categories: Array.isArray(raw.categories) ? (raw.categories as string[]) : defs.categories,
      allowSelfWeight: typeof raw.allowSelfWeight === 'boolean' ? raw.allowSelfWeight : defs.allowSelfWeight,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#4F46E5]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">평가 방법론</h3>
          <p className="text-sm text-[#8181A5]">MBO:BEI 비중, 목표 수 제한, 가중치 설정</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">법인 오버라이드</span>
        )}
      </div>

      <SettingFieldWithOverride label="최대 목표 수" description="직원 1인당 설정 가능한 최대 목표 개수" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.maxGoals} min={1} max={20} onChange={(e) => setSettings((p) => ({ ...p, maxGoals: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-[#8181A5]">개</span>
        </div>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="가중치 합계 검증" description="목표 가중치의 합이 반드시 100%여야 하는지" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.weightSumRequired} onChange={(e) => setSettings((p) => ({ ...p, weightSumRequired: e.target.checked }))} className="h-4 w-4 rounded border-[#F0F0F3] text-[#4F46E5]" />
          <span className="text-[#1C1D21]">가중치 합계 {settings.weightSum}% 필수</span>
        </label>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="목표 카테고리" description="사용 가능한 목표 분류 항목" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex flex-wrap gap-2">
          {settings.categories.map((cat, i) => (
            <span key={i} className="rounded-full bg-[#4F46E5]/10 px-3 py-1 text-sm font-medium text-[#4F46E5]">{cat}</span>
          ))}
        </div>
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
