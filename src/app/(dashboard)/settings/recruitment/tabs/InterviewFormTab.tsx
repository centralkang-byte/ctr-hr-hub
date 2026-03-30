'use client'

import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import type { InterviewFormSetting, InterviewFormCategoryEntry } from '@/types/process-settings'
import { BUTTON_VARIANTS } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Props { companyId: string | null }

const DEFAULTS: InterviewFormSetting = {
  categories: [
    { category: '직무역량', items: ['전문지식', '문제해결력', '실무경험'] },
    { category: '조직적합성', items: ['팀워크', '가치관 부합', '커뮤니케이션'] },
    { category: '성장잠재력', items: ['학습의지', '자기개발', '비전/목표'] },
    { category: '리더십 (관리직)', items: ['조직관리', '의사결정', '코칭'] },
  ],
}

export function InterviewFormTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const { settings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<InterviewFormSetting>({
    category: 'recruitment',
    key: 'interview-form',
    companyId,
    defaults: DEFAULTS,
    description: t('interview_ked8f89ea_keab8b0eb_ked859ced'),
    merge: (raw, defs) => ({
      categories: Array.isArray(raw.categories) ? (raw.categories as InterviewFormCategoryEntry[]) : defs.categories,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('interview_ked8f89ea')}</h3>
          <p className="text-sm text-muted-foreground">{t('interview_ked8f89ea_keab8b0eb_ked95adeb_management')}</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">{t('company_kec98a4eb')}</span>
        )}
      </div>
      {settings.categories.map((cat) => (
        <div key={cat.category}>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{cat.category}</h4>
          <div className="space-y-1">{cat.items.map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:bg-muted">
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}</div>
        </div>
      ))}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={revert} disabled={!hasChanges}>
          <RotateCcw className="mr-2 h-4 w-4" />{t('kr_keb9098eb')}
        </Button>
        <Button className={BUTTON_VARIANTS.primary} onClick={save} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}저장
        </Button>
      </div>
    </div>
  )
}
