'use client'

import { useTranslations } from 'next-intl'
import { Save, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProcessSetting } from '@/hooks/useProcessSetting'
import type { AssignmentRulesSetting } from '@/types/process-settings'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'

interface Props { companyId: string | null }

const DEFAULTS: AssignmentRulesSetting = {
  rules: [
    { code: 'PROMOTION', label: '승진', desc: '직급 상향 변경', requiresApproval: true },
    { code: 'TRANSFER', label: '전문성', desc: '부서 이동', requiresApproval: true },
    { code: 'ROTATION', label: '순환보직', desc: '직무 순환 배치', requiresApproval: true },
    { code: 'SECONDMENT', label: '파견', desc: '타 법인/기관 파견', requiresApproval: true },
    { code: 'CONCURRENT', label: '겸직', desc: '2개 이상 직무 겸임', requiresApproval: true },
    { code: 'LEAVE_OF_ABSENCE', label: '휴직', desc: '육아/병가 등 장기 휴직', requiresApproval: true },
    { code: 'REINSTATEMENT', label: '복원', desc: '휴직 후 복귀', requiresApproval: false },
    { code: 'DEMOTION', label: '강등', desc: '직급 하향 변경', requiresApproval: true },
  ],
}

export function AssignmentRulesTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const { settings, setSettings, loading, saving, isOverridden, hasChanges, save, revert } = useProcessSetting<AssignmentRulesSetting>({
    category: 'organization',
    key: 'assignment-rules',
    companyId,
    defaults: DEFAULTS,
    description: t('assignmentRules.description'),
    merge: (raw, defs) => ({
      rules: Array.isArray(raw.rules) ? (raw.rules as AssignmentRulesSetting['rules']) : defs.rules,
    }),
  })

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  const toggleApproval = (i: number) => {
    const next = structuredClone(settings)
    next.rules[i].requiresApproval = !next.rules[i].requiresApproval
    setSettings(next)
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('assignmentRules.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('assignmentRules.subtitle')}</p>
        </div>
        {isOverridden && (
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">{t('company_kec98a4eb')}</span>
        )}
      </div>

      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead className={TABLE_STYLES.header}>
            <tr>
              <th className={TABLE_STYLES.headerCell}>{t('assignmentRules.colCode')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('assignmentRules.colType')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('assignmentRules.colDesc')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('assignmentRules.colApproval')}</th>
            </tr>
          </thead>
          <tbody>
            {settings.rules.map((rule, i) => (
              <tr key={rule.code} className={TABLE_STYLES.row}>
                <td className={`${TABLE_STYLES.cell} font-medium text-primary`}>{rule.code}</td>
                <td className={TABLE_STYLES.cell}>{rule.label}</td>
                <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>{rule.desc}</td>
                <td className={`${TABLE_STYLES.cell} text-center`}>
                  <button
                    onClick={() => toggleApproval(i)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${rule.requiresApproval ? 'bg-primary/5 text-primary hover:bg-primary/10' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                  >
                    {rule.requiresApproval ? t('assignmentRules.required') : t('assignmentRules.notRequired')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
