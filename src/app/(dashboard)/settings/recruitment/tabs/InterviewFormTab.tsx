'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import type { InterviewFormSetting, InterviewFormCategoryEntry } from '@/types/process-settings'

interface Props { companyId: string | null }

const DEFAULTS: InterviewFormSetting = {
  categories: [
    { category: '직무역량', items: ['전문지식', '문제해결력', '실무경험'] },
    { category: '조직적합성', items: ['팀워크', '가치관 부합', '커뮤니케이션'] },
    { category: '성장잠재력', items: ['학습의지', '자기개발', '비전/목표'] },
    { category: '리더십 (관리직)', items: ['조직관리', '의사결정', '코칭'] },
  ],
}

export function InterviewFormTab({ companyId }: Props) {
  const { settings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<InterviewFormSetting>({
    category: 'recruitment',
    key: 'interview-form',
    companyId,
    defaults: DEFAULTS,
    description: '면접 평가항목 기본 템플릿',
    merge: (raw, defs) => ({
      categories: Array.isArray(raw.categories) ? (raw.categories as InterviewFormCategoryEntry[]) : defs.categories,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#1C1D21]">면접 평가항목</h3>
          <p className="text-sm text-[#8181A5]">면접 평가표 기본 항목 관리</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">법인 오버라이드</span>
        )}
      </div>
      {settings.categories.map((cat) => (
        <div key={cat.category}>
          <h4 className="mb-2 text-sm font-semibold text-[#8181A5]">{cat.category}</h4>
          <div className="space-y-1">{cat.items.map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-lg border border-[#F0F0F3] px-4 py-3 hover:bg-[#F5F5FA]">
              <span className="text-sm text-[#1C1D21]">{item}</span>
            </div>
          ))}</div>
        </div>
      ))}

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
