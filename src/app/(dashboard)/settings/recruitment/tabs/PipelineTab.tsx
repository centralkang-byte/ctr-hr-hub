'use client'

import { useTranslations } from 'next-intl'
import { Save, RotateCcw, Loader2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OverrideBadge } from '@/components/settings/OverrideBadge'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import type { PipelineStageSetting, PipelineStageEntry } from '@/types/process-settings'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface Props { companyId: string | null }

// 도메인 고유 단계색 (DESIGN.md 예외#3 — 파이프라인 단계 팔레트). 기본 단계 id 기준.
// recruitment 런타임 팔레트(chart.ts RECRUITMENT_STAGE_COLORS)와 시맨틱 정합: neutral/navy/amber/success/error.
// 색 편집 UI 없음 → 표시 전용. (#169 머지 후 chart.ts SSOT import로 통합 예정)
const STAGE_COLORS: Record<string, string> = {
  '1': '#64748b', // 서류접수 Application — neutral
  '2': '#004964', // 서류심사 Screening — navy
  '3': '#004964', // AI 스크리닝 — navy (구 violet #7C5CFC = 브랜드 금지색)
  '4': '#004964', // 1차 면접 — navy
  '5': '#004964', // 2차 면접 — navy
  '6': '#d0901e', // 처우 협의 Offer — warning amber
  '7': '#008b4e', // 최종합격 Hired — success
  '8': '#d73337', // 실패 Rejected — error
}

const DEFAULTS: PipelineStageSetting = {
  stages: [
    { id: '1', name: '서류접수', nameEn: 'Application', color: STAGE_COLORS['1'] },
    { id: '2', name: '서류심사', nameEn: 'Screening', color: STAGE_COLORS['2'] },
    { id: '3', name: 'AI 스크리닝', nameEn: 'AI Screening', color: STAGE_COLORS['3'] },
    { id: '4', name: '1차 면접', nameEn: '1st Interview', color: STAGE_COLORS['4'] },
    { id: '5', name: '2차 면접', nameEn: '2nd Interview', color: STAGE_COLORS['5'] },
    { id: '6', name: '처우 협의', nameEn: 'Offer', color: STAGE_COLORS['6'] },
    { id: '7', name: '최종합격', nameEn: 'Hired', color: STAGE_COLORS['7'] },
    { id: '8', name: '실패', nameEn: 'Rejected', color: STAGE_COLORS['8'] },
  ],
}

export function PipelineTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<PipelineStageSetting>({
    category: 'recruitment',
    key: 'pipeline-stages',
    companyId,
    defaults: DEFAULTS,
    description: t('pipeline.description'),
    merge: (raw, defs) => ({
      // 저장 데이터는 그대로 보존(편집 UI 없음). 색 정규화는 렌더 시점에만 → 저장본 변형 없음(display-only).
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
          <h3 className="text-base font-semibold text-foreground">{t('pipeline.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('pipeline.subtitle', { count: settings.stages.length })}</p>
        </div>
        {isOverridden && (
          <OverrideBadge>{t('company_kec98a4eb')}</OverrideBadge>
        )}
      </div>
      <div className="space-y-2">{settings.stages.map((s, i) => (
        <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted transition-colors">
          <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: STAGE_COLORS[s.id] ?? s.color }} aria-hidden="true" />
          <span className="flex-1 text-sm font-medium text-foreground">{s.name}</span>
          <span className="text-xs text-muted-foreground">{s.nameEn}</span>
          <div className="flex gap-1">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${s.name} 단계 위로 이동`} className="rounded p-1 hover:bg-border disabled:opacity-30"><ArrowUp className="h-3 w-3 text-muted-foreground" aria-hidden="true" /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === settings.stages.length - 1} aria-label={`${s.name} 단계 아래로 이동`} className="rounded p-1 hover:bg-border disabled:opacity-30"><ArrowDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" /></button>
          </div>
        </div>
      ))}</div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={revert} disabled={!hasChanges}>
          <RotateCcw className="mr-2 h-4 w-4" />{t('kr_keb9098eb')}
        </Button>
        <Button className={BUTTON_VARIANTS.primary} onClick={save} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{t('save')}
        </Button>
      </div>
    </div>
  )
}
