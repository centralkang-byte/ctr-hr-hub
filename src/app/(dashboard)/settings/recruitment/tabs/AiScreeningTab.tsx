'use client'

import { Save, RotateCcw, Loader2, Lock, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import type { AiScreeningSetting, AiScreeningFeatureEntry } from '@/types/process-settings'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface Props { companyId: string | null }

const DEFAULTS: AiScreeningSetting = {
  enabled: true,
  minScore: 60,
  features: [
    { key: 'resume_parse', label: '이력서 자동 파싱', desc: 'PDF/Word 이력서에서 경력/학력/스킬 자동 추출', enabled: true },
    { key: 'jd_match', label: 'JD 매칭 점수', desc: '채용공고 요구사항과 지원자 프로필 매칭률 산출', enabled: true },
    { key: 'bias_filter', label: '편향 필터', desc: '나이/성별/출신교 등 편향 요소 자동 마스킹', enabled: true },
    { key: 'skill_gap', label: '스킬 갭 분석', desc: '필수 스킬 대비 지원자 보유 스킬 갭 분석', enabled: false },
  ],
}

export function AiScreeningTab({ companyId }: Props) {
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<AiScreeningSetting>({
    category: 'recruitment',
    key: 'ai-screening',
    companyId,
    defaults: DEFAULTS,
    description: 'AI 기반 서류 심사 자동화 설정',
    merge: (raw, defs) => ({
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : defs.enabled,
      minScore: (raw.minScore as number) ?? defs.minScore,
      features: Array.isArray(raw.features) ? (raw.features as AiScreeningFeatureEntry[]) : defs.features,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#4F46E5]" /></div>

  const toggleFeature = (i: number) => {
    const next = structuredClone(settings)
    next.features[i].enabled = !next.features[i].enabled
    setSettings(next)
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[#1C1D21]">AI 스크리닝</h3>
            {!companyId && (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600"><Lock className="h-3 w-3" />글로벌 고정</span>
            )}
          </div>
          <p className="text-sm text-[#8181A5]">AI 기반 서류 심사 자동화 설정</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">법인 오버라이드</span>
        )}
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-[#F0F0F3] p-4">
        <span className="text-sm font-medium text-[#1C1D21]">최소 합격 점수</span>
        <Input
          type="number"
          value={settings.minScore}
          min={0}
          max={100}
          onChange={(e) => setSettings((p) => ({ ...p, minScore: Number(e.target.value) }))}
          className="w-20"
        />
        <span className="text-sm text-[#8181A5]">점 이상</span>
      </div>

      <div className="space-y-3">{settings.features.map((f, i) => (
        <div key={f.key} className="flex items-start gap-4 rounded-xl border border-[#F0F0F3] p-4 hover:bg-[#F5F5FA] transition-colors">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#7C5CFC]/10">
            <Bot className="h-4 w-4 text-[#7C5CFC]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#1C1D21]">{f.label}</span>
              <button
                onClick={() => toggleFeature(i)}
                className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${f.enabled ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
              >
                {f.enabled ? '활성' : '비활성'}
              </button>
            </div>
            <p className="text-xs text-[#8181A5]">{f.desc}</p>
          </div>
        </div>
      ))}</div>

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
