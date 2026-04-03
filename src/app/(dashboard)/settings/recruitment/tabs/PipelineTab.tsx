'use client'

import { Save, RotateCcw, Loader2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import type { PipelineStageSetting, PipelineStageEntry } from '@/types/process-settings'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface Props { companyId: string | null }

const DEFAULTS: PipelineStageSetting = {
  stages: [
    { id: '1', name: '서류접수', nameEn: 'Application', color: '#8181A5' },
    { id: '2', name: '서류심사', nameEn: 'Screening', color: '#5E81F4' },
    { id: '3', name: 'AI 스크리닝', nameEn: 'AI Screening', color: '#7C5CFC' },
    { id: '4', name: '1차 면접', nameEn: '1st Interview', color: '#00C48C' },
    { id: '5', name: '2차 면접', nameEn: '2nd Interview', color: '#00C48C' },
    { id: '6', name: '처우 협의', nameEn: 'Offer', color: '#FF9F43' },
    { id: '7', name: '최종합격', nameEn: 'Hired', color: '#00C48C' },
    { id: '8', name: '실패', nameEn: 'Rejected', color: '#FF6B6B' },
  ],
}

export function PipelineTab({
  companyId }: Props) {
//   const t = useTranslations('settings')
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<PipelineStageSetting>({
    category: 'recruitment',
    key: 'pipeline-stages',
    companyId,
    defaults: DEFAULTS,
    description: '채용 파이프라인 단계',
    merge: (raw, defs) => ({
      stages: Array.isArray(raw.stages) ? (raw.stages as PipelineStageEntry[]) : defs.stages,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  const move = (i: number, dir: -1 | 1) => {
    const next = structuredClone(settings)
    const j = i + dir
    if (j < 0 || j >= next.stages.length) return
    ;[next.stages[i], next.stages[j]] = [next.stages[j], next.stages[i]]
    setSettings(next)
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{'채용 파이프라인'}</h3>
          <p className="text-sm text-muted-foreground">{settings.stages.length}단계 파이프라인</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">{'법인 오버라이드'}</span>
        )}
      </div>
      <div className="space-y-2">{settings.stages.map((s, i) => (
        <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted transition-colors">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
          <span className="flex-1 text-sm font-medium text-foreground">{s.name}</span>
          <span className="text-xs text-muted-foreground">{s.nameEn}</span>
          <div className="flex gap-1">
            <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 hover:bg-border disabled:opacity-30"><ArrowUp className="h-3 w-3 text-muted-foreground" /></button>
            <button onClick={() => move(i, 1)} disabled={i === settings.stages.length - 1} className="rounded p-1 hover:bg-border disabled:opacity-30"><ArrowDown className="h-3 w-3 text-muted-foreground" /></button>
          </div>
        </div>
      ))}</div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={revert} disabled={!hasChanges}>
          <RotateCcw className="mr-2 h-4 w-4" />{'되돌리기'}
        </Button>
        <Button className={BUTTON_VARIANTS.primary} onClick={save} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}저장
        </Button>
      </div>
    </div>
  )
}
