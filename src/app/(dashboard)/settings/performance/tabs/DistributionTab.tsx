'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import { TABLE_STYLES } from '@/lib/styles'

interface Props { companyId: string | null }

interface DistSettings {
  guidePcts: number[]
  forced: boolean
  minParticipants: number
}

const DEFAULTS: DistSettings = { guidePcts: [10, 30, 50, 10], forced: false, minParticipants: 10 }
const GRADE_LABELS = ['E (탁월)', 'M+ (우수)', 'M (보통)', 'B (미흡)']

export function DistributionTab({ companyId }: Props) {
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<DistSettings>({
    category: 'performance',
    key: 'calibration-distribution',
    companyId,
    defaults: DEFAULTS,
    description: '배분 가이드라인 설정',
    merge: (raw, defs) => ({
      guidePcts: Array.isArray(raw.guidePcts) ? (raw.guidePcts as number[]) : defs.guidePcts,
      forced: typeof raw.forced === 'boolean' ? raw.forced : !!raw.enforced,
      minParticipants: (raw.minParticipants as number) ?? defs.minParticipants,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">배분 가이드라인</h3>
          <p className="text-sm text-[#8181A5]">등급별 권장 배분 비율</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">법인 오버라이드</span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
        <table className="w-full"><thead><tr className={TABLE_STYLES.header}>
          <th className={TABLE_STYLES.headerCell}>등급</th>
          <th className={TABLE_STYLES.headerCellRight}>권장 비율 (%)</th>
        </tr></thead><tbody className="divide-y divide-[#F0F0F3]">{settings.guidePcts.map((pct, i) => (
          <tr key={i} className={TABLE_STYLES.row}>
            <td className={TABLE_STYLES.cell}>{GRADE_LABELS[i]}</td>
            <td className="px-4 py-3 text-right"><Input type="number" value={pct} min={0} max={100} onChange={(e) => { const next = structuredClone(settings); next.guidePcts[i] = Number(e.target.value); setSettings(next) }} className="ml-auto w-20 text-right" /></td>
          </tr>
        ))}</tbody></table>
      </div>
      <div className="text-right text-sm text-[#8181A5]">합계: {settings.guidePcts.reduce((a, b) => a + b, 0)}%</div>

      <SettingFieldWithOverride label="강제 배분" description="가이드라인을 필수로 적용할지 선택" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.forced} onChange={(e) => setSettings((p) => ({ ...p, forced: e.target.checked }))} className="h-4 w-4 rounded border-[#F0F0F3] text-[#5E81F4]" />
          <span className="text-[#1C1D21]">강제 배분 적용</span>
        </label>
      </SettingFieldWithOverride>

      <SettingFieldWithOverride label="최소 참여 인원" description="배분 가이드라인 적용을 위한 최소 평가 대상 인원" status={companyId ? 'custom' : 'global'} companySelected={!!companyId}>
        <div className="flex items-center gap-2">
          <Input type="number" value={settings.minParticipants} onChange={(e) => setSettings((p) => ({ ...p, minParticipants: Number(e.target.value) }))} className="w-20" />
          <span className="text-sm text-[#8181A5]">명 이상</span>
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
